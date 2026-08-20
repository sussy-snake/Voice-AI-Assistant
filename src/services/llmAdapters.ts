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
   * Execute real generative AI inference with cascading multi-provider fallback.
   */
  public async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const errors: string[] = [];

    // 1. Google Gemini (Official Cloud)
    if (this.config.provider === 'gemini' || this.config.geminiApiKey?.trim() || this.config.googleAccessToken?.trim()) {
      try {
        yield* this.streamGemini(messages, signal);
        return;
      } catch (err: any) {
        errors.push(`Gemini: ${err.message || err}`);
        console.warn('Gemini stream failed, attempting next available provider:', err);
      }
    }

    // 2. Groq Cloud (Free Ultra-Fast Cloud Fallback)
    if (this.config.provider === 'groq' || this.config.groqApiKey?.trim()) {
      try {
        yield* this.streamGroq(messages, signal);
        return;
      } catch (err: any) {
        errors.push(`Groq: ${err.message || err}`);
        console.warn('Groq stream failed:', err);
      }
    }

    // 3. Localhost Ollama (100% Offline)
    try {
      yield* this.streamOllama(messages, signal);
      return;
    } catch (ollamaErr: any) {
      errors.push(`Ollama: ${ollamaErr.message || ollamaErr}`);
      console.warn('Ollama stream failed:', ollamaErr);
    }

    // 4. OpenRouter / OpenAI / Anthropic
    if (this.config.provider === 'openrouter' || this.config.openrouterApiKey?.trim()) {
      try {
        yield* this.streamOpenRouter(messages, signal);
        return;
      } catch (err: any) {
        errors.push(`OpenRouter: ${err.message || err}`);
      }
    }

    if (this.config.provider === 'openai' && this.config.openaiApiKey?.trim()) {
      try {
        yield* this.streamOpenAICompatible(messages, signal);
        return;
      } catch (err: any) {
        errors.push(`OpenAI: ${err.message || err}`);
      }
    }

    if (this.config.provider === 'anthropic' && this.config.anthropicApiKey?.trim()) {
      try {
        yield* this.streamAnthropic(messages, signal);
        return;
      } catch (err: any) {
        errors.push(`Anthropic: ${err.message || err}`);
      }
    }

    // 5. Honest Setup Notice
    const errorDetails = errors.length > 0 ? `⚠️ **Provider Notices:**\n${errors.map((e) => `- ${e}`).join('\n')}\n\n` : '';
    const notice =
      errorDetails +
      'To enable live generative AI inference, please connect one of the following:\n\n' +
      '1. **Google Gemini (Recommended):**\n' +
      '   - Paste your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) in **Account Profile (👤)**.\n\n' +
      '2. **Groq Cloud (Ultra-Fast Free):**\n' +
      '   - Enter your free Groq API key in **Settings (⚙️)**.\n\n' +
      '3. **Local Ollama (100% Offline):**\n' +
      '   - Run Ollama locally: `ollama run llama3.2` on `http://localhost:11434`!';

    for (const word of notice.split(' ')) {
      yield { content: word + ' ', isDone: false };
      await new Promise((r) => setTimeout(r, 10));
    }
    yield { isDone: true };
  }

  // -------------------------------------------------------------
  // Google Gemini Streamer (v1beta & v1 Stable)
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

    const rawModel = this.config.geminiModel || 'gemini-1.5-flash';
    const userModel = rawModel.trim().replace(/^models\//i, '');

    const candidateUrls = apiKey
      ? [
          `https://generativelanguage.googleapis.com/v1beta/models/${userModel}:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${apiKey}&alt=sse`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:streamGenerateContent?key=${apiKey}&alt=sse`,
        ]
      : [
          `https://generativelanguage.googleapis.com/v1beta/models/${userModel}:streamGenerateContent?alt=sse`,
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
          console.info(`[Gemini] Connected via: ${url.split('?')[0]}`);
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
          // ignore
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Groq Cloud Streamer (OpenAI Compatible)
  // -------------------------------------------------------------
  private async *streamGroq(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const apiKey = this.config.groqApiKey?.trim();
    if (!apiKey) {
      throw new Error('Groq API key is missing.');
    }

    const formattedMessages = [
      { role: 'system', content: this.getEnrichedSystemPrompt() },
      ...messages.map((m) => ({
        role: m.role === 'tool' ? 'tool' : m.role,
        content: m.content || '',
      })),
    ];

    const modelCandidates = [
      this.config.groqModel || 'llama-3.1-8b-instant',
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ];

    let response: Response | null = null;
    let lastErr = '';

    for (const model of modelCandidates) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: formattedMessages,
            tools: getOpenAITools(),
            stream: true,
            temperature: this.config.temperature || 0.7,
          }),
          signal,
        });

        if (res.ok && res.body) {
          response = res;
          console.info(`[Groq] Connected via: ${model}`);
          break;
        } else {
          lastErr = await res.text().catch(() => res.statusText);
        }
      } catch (err: any) {
        lastErr = err.message || 'Fetch error';
      }
    }

    if (!response || !response.body) {
      throw new Error(`Groq API Error: ${lastErr}`);
    }

    yield* this.consumeOpenAIStream(response.body);
  }

  // -------------------------------------------------------------
  // OpenRouter Streamer (OpenAI Compatible)
  // -------------------------------------------------------------
  private async *streamOpenRouter(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const apiKey = this.config.openrouterApiKey?.trim();
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing.');
    }

    const formattedMessages = [
      { role: 'system', content: this.getEnrichedSystemPrompt() },
      ...messages.map((m) => ({
        role: m.role === 'tool' ? 'tool' : m.role,
        content: m.content || '',
      })),
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free',
        messages: formattedMessages,
        tools: getOpenAITools(),
        stream: true,
        temperature: this.config.temperature || 0.7,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`OpenRouter API Error (${response.status}): ${err}`);
    }

    yield* this.consumeOpenAIStream(response.body);
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
      throw new Error(`Ollama Error (${response.status}): ${errorText}`);
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
          // ignore
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

    yield* this.consumeOpenAIStream(response.body);
  }

  // -------------------------------------------------------------
  // Helper: Consume SSE chunks from OpenAI-compatible streams
  // -------------------------------------------------------------
  private async *consumeOpenAIStream(body: ReadableStream<Uint8Array>): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const reader = body.getReader();
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
