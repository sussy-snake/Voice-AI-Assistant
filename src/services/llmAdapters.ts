import { ChatMessage, LLMConfig, ToolCall } from '../types';
import { getOpenAITools, getGeminiFunctionDeclarations } from './toolsSchema';

export interface LLMResponseChunk {
  content?: string;
  toolCalls?: ToolCall[];
  isDone: boolean;
}

export class LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  public updateConfig(newConfig: Partial<LLMConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  private getEnrichedSystemPrompt(): string {
    return (
      'You are an intelligent, versatile, and direct AI desktop assistant.\n' +
      'Answer user questions accurately, concisely, and naturally across all general knowledge, coding, analysis, and reasoning domains.\n' +
      'Execute tool calls (file search, task scheduling, email, git, database) when explicitly requested or required.\n' +
      'Do not use rigid canned templates or generic disclaimers.'
    );
  }

  /**
   * Execute real generative AI inference with streaming, function calling, and dual cloud/local fallback.
   */
  public async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    let lastError: string | null = null;

    // 1. Primary Cloud Inference: Google Gemini 2.0 Flash
    if (this.config.geminiApiKey?.trim() || this.config.googleAccessToken?.trim()) {
      try {
        yield* this.streamGemini(messages, signal);
        return;
      } catch (err: any) {
        lastError = err?.message || 'Gemini stream error';
        console.warn('Gemini stream failed, attempting local Ollama fallback:', err);
      }
    }

    // 2. Localhost LLM Inference: Ollama (llama3.2 / qwen2.5 / mistral)
    try {
      yield* this.streamOllama(messages, signal);
      return;
    } catch (ollamaErr: any) {
      console.warn('Ollama stream failed:', ollamaErr);
    }

    // 3. OpenAI / Llama.cpp / Anthropic Providers
    if (this.config.provider === 'openai' && this.config.openaiApiKey?.trim()) {
      try {
        yield* this.streamOpenAICompatible(messages, signal);
        return;
      } catch (err) {
        console.warn('OpenAI stream failed:', err);
      }
    }

    if (this.config.provider === 'anthropic' && this.config.anthropicApiKey?.trim()) {
      try {
        yield* this.streamAnthropic(messages, signal);
        return;
      } catch (err) {
        console.warn('Anthropic stream failed:', err);
      }
    }

    // 4. Honest Unconfigured Guidance (Zero Mock Templates)
    const errorPrefix = lastError ? `⚠️ **Gemini Notice:** *${lastError}*\n\n` : '';
    const notice =
      errorPrefix +
      'To enable real-time generative AI inference, please connect one of the following:\n\n' +
      '1. **Google Gemini (Free Cloud AI — Recommended):**\n' +
      '   - Click **Account Profile (👤)** in the top bar.\n' +
      '   - Paste your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) into the **Google Gemini API Key** box and click **Save**.\n\n' +
      '2. **Local Ollama / Llama (100% Offline):**\n' +
      '   - Run Ollama locally on your computer: `ollama run llama3.2` or `ollama run qwen2.5`.\n' +
      '   - The assistant will connect automatically to `http://localhost:11434`!';

    for (const word of notice.split(' ')) {
      yield { content: word + ' ', isDone: false };
      await new Promise((r) => setTimeout(r, 12));
    }
    yield { isDone: true };
  }

  // -------------------------------------------------------------
  // Ollama Native Streamer (/api/chat)
  // -------------------------------------------------------------
  private async *streamOllama(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const formattedMessages = [
      { role: 'system', content: this.getEnrichedSystemPrompt() },
      ...messages.map((m) => {
        if (m.role === 'tool' && m.toolResults) {
          return {
            role: 'tool',
            content: JSON.stringify(m.toolResults),
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      }),
    ];

    const endpoint = `${(this.config.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/chat`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.ollamaModel || 'llama3.2',
        messages: formattedMessages,
        tools: getOpenAITools(),
        stream: true,
        options: {
          temperature: this.config.temperature || 0.7,
        },
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama API Error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const item = JSON.parse(trimmed);
          const contentDelta = item.message?.content || '';
          const rawTools = item.message?.tool_calls;

          let toolCalls: ToolCall[] | undefined = undefined;
          if (rawTools && Array.isArray(rawTools)) {
            toolCalls = rawTools.map((t: any) => ({
              id: 'call_' + Math.random().toString(36).substring(2, 9),
              name: t.function.name,
              arguments: t.function.arguments,
            }));
          }

          yield {
            content: contentDelta,
            toolCalls,
            isDone: item.done || false,
          };
        } catch {
          // ignore chunk parse errors
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Google Gemini Streamer (v1beta)
  // -------------------------------------------------------------
  private async *streamGemini(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const apiKey = this.config.geminiApiKey?.trim();
    const googleToken = this.config.googleAccessToken?.trim();

    if (!apiKey && !googleToken) {
      throw new Error('Google Gemini API Key is missing. Enter your key in Account Profile.');
    }

    const filteredMessages = messages.filter((m) => m.id !== 'welcome');
    const firstUserIndex = filteredMessages.findIndex((m) => m.role === 'user');
    const validMessages = firstUserIndex >= 0 ? filteredMessages.slice(firstUserIndex) : filteredMessages;

    const contents: any[] = [];
    for (const m of validMessages) {
      const parts: any[] = [];

      if (m.role === 'assistant') {
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
            });
          }
        }
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
      } else if (m.role === 'tool' && m.toolResults) {
        for (const tr of m.toolResults) {
          parts.push({
            functionResponse: {
              name: tr.name,
              response: { name: tr.name, content: tr.result || tr.error || 'ok' },
            },
          });
        }
        if (parts.length > 0) {
          contents.push({ role: 'user', parts });
        }
      } else if (m.role === 'user') {
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (parts.length > 0) {
          contents.push({ role: 'user', parts });
        }
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const bodyPayload = {
      systemInstruction: {
        parts: [{ text: this.getEnrichedSystemPrompt() }],
      },
      contents,
      tools: getGeminiFunctionDeclarations(),
      generationConfig: {
        temperature: this.config.temperature || 0.7,
      },
    };

    let response: Response | null = null;
    let lastErrorText = '';

    const candidateUrls = apiKey
      ? [
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?key=${apiKey}&alt=sse`,
        ]
      : [
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse`,
        ];

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!apiKey && googleToken) {
      headers['Authorization'] = `Bearer ${googleToken}`;
    }

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
          signal,
        });

        if (res.ok && res.body) {
          response = res;
          break;
        } else {
          lastErrorText = await res.text().catch(() => res.statusText);
        }
      } catch (err: any) {
        lastErrorText = err.message || 'Fetch error';
      }
    }

    if (!response || !response.body) {
      throw new Error(`Gemini API Error: ${lastErrorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.substring(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const item = JSON.parse(jsonStr);
          const candidate = item.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          let text = '';
          const toolCalls: ToolCall[] = [];

          for (const part of parts) {
            if (part.text) text += part.text;
            if (part.functionCall) {
              toolCalls.push({
                id: 'call_' + Math.random().toString(36).substring(2, 9),
                name: part.functionCall.name,
                arguments: part.functionCall.args || {},
              });
            }
          }

          yield {
            content: text,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            isDone: candidate?.finishReason === 'STOP',
          };
        } catch {
          // ignore parsing error for chunk
        }
      }
    }
  }

  // -------------------------------------------------------------
  // OpenAI & Llama.cpp Compatible Streamer (/v1/chat/completions)
  // -------------------------------------------------------------
  private async *streamOpenAICompatible(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const isLlamaCpp = this.config.provider === 'llamacpp';
    const endpoint = isLlamaCpp
      ? `${this.config.llamacppUrl.replace(/\/$/, '')}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';

    const formattedMessages = [
      { role: 'system', content: this.getEnrichedSystemPrompt() },
      ...messages.map((m) => ({
        role: m.role === 'tool' ? 'tool' : m.role,
        content: m.content || '',
        ...(m.toolResults
          ? {
              tool_call_id: m.toolResults[0]?.toolCallId,
              name: m.toolResults[0]?.name,
            }
          : {}),
      })),
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!isLlamaCpp && this.config.openaiApiKey) {
      headers['Authorization'] = `Bearer ${this.config.openaiApiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: isLlamaCpp ? 'local-model' : this.config.openaiModel,
        messages: formattedMessages,
        tools: getOpenAITools(),
        stream: true,
        temperature: this.config.temperature,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI-compatible Error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.substring(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const item = JSON.parse(jsonStr);
          const delta = item.choices?.[0]?.delta;
          const isFinished = Boolean(item.choices?.[0]?.finish_reason);

          yield {
            content: delta?.content || '',
            isDone: isFinished,
          };
        } catch {
          // ignore
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Anthropic Claude Streamer (messages API)
  // -------------------------------------------------------------
  private async *streamAnthropic(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const apiKey = this.config.anthropicApiKey;
    if (!apiKey) {
      throw new Error('Anthropic API key is missing.');
    }

    const endpoint = 'https://api.anthropic.com/v1/messages';
    const formattedMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      }));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.anthropicModel || 'claude-3-5-sonnet-20241022',
        messages: formattedMessages,
        system: this.getEnrichedSystemPrompt(),
        max_tokens: 2048,
        stream: true,
        temperature: this.config.temperature,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Anthropic API Error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.substring(6).trim();

        try {
          const item = JSON.parse(jsonStr);
          if (item.type === 'content_block_delta') {
            yield {
              content: item.delta?.text || '',
              isDone: false,
            };
          } else if (item.type === 'message_stop') {
            yield { isDone: true };
          }
        } catch {
          // ignore
        }
      }
    }
  }
}
