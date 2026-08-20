import { ChatMessage, LLMConfig, ToolCall } from '../types';
import { getOpenAITools, getGeminiFunctionDeclarations, SYSTEM_TOOLS } from './toolsSchema';
import { LocalKnowledgeEngine } from './localKnowledgeEngine';

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
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return `${this.config.systemPrompt}\n\n[Live Environment Context: Today is ${dateStr}, Current Time is ${timeStr} (${tz}). Platform: Windows/Cross-Platform Desktop. User: Computer Science Engineering Student. Support CS topics like DSA, Operating Systems, DBMS, Networks, and Code Debugging.]`;
  }

  /**
   * Execute chat generation with streaming, tool calling, and instant fallback
   */
  public async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    try {
      switch (this.config.provider) {
        case 'ollama':
          yield* this.streamOllama(messages, signal);
          break;
        case 'gemini':
          yield* this.streamGemini(messages, signal);
          break;
        case 'openai':
        case 'llamacpp':
          yield* this.streamOpenAICompatible(messages, signal);
          break;
        case 'anthropic':
          yield* this.streamAnthropic(messages, signal);
          break;
        default:
          yield* this.streamOllama(messages, signal);
      }
    } catch (err: any) {
      console.warn('Primary LLM provider failed, switching to Instant Local Knowledge Engine:', err);
      yield* this.streamLocalFallback(messages, err?.message || 'Connection offline');
    }
  }

  // -------------------------------------------------------------
  // Built-in Instant Local Knowledge Engine Fallback
  // -------------------------------------------------------------
  private async *streamLocalFallback(
    messages: ChatMessage[],
    _reason: string
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    const response = await LocalKnowledgeEngine.processQuery(messages, this.config);

    // Stream word deltas cleanly
    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const delta = (i > 0 ? ' ' : '') + words[i];
      yield {
        content: delta,
        isDone: false,
      };
      await new Promise((r) => setTimeout(r, 8));
    }

    yield {
      toolCalls: response.toolCalls,
      isDone: true,
    };
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

    const endpoint = `${this.config.ollamaUrl.replace(/\/$/, '')}/api/chat`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.ollamaModel,
        messages: formattedMessages,
        tools: getOpenAITools(),
        stream: true,
        options: {
          temperature: this.config.temperature,
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
          const json = JSON.parse(trimmed);
          const toolCalls: ToolCall[] = [];

          if (json.message?.tool_calls) {
            for (const tc of json.message.tool_calls) {
              toolCalls.push({
                id: 'call_' + Math.random().toString(36).substring(2, 9),
                name: tc.function.name,
                arguments: tc.function.arguments,
              });
            }
          }

          yield {
            content: json.message?.content || '',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            isDone: json.done || false,
          };
        } catch {
          // ignore
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
    const apiKey = this.config.geminiApiKey;
    if (!apiKey) {
      throw new Error('Gemini API key is missing. Please add your free key in Settings.');
    }

    const model = this.config.geminiModel || 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

    // Filter out welcome message and ensure conversation starts with user message
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

    // Must have at least one user message
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
        temperature: this.config.temperature,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!isLlamaCpp && this.config.openaiApiKey) {
      headers['Authorization'] = `Bearer ${this.config.openaiApiKey}`;
    }

    const payload = {
      model: isLlamaCpp ? 'default' : this.config.openaiModel,
      messages: [
        { role: 'system', content: this.getEnrichedSystemPrompt() },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      tools: getOpenAITools(),
      stream: true,
      temperature: this.config.temperature,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI/Llama.cpp Error (${response.status}): ${errorText}`);
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
        const dataStr = trimmed.substring(6);
        if (dataStr === '[DONE]') {
          yield { isDone: true };
          return;
        }

        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta;
          const toolCalls: ToolCall[] = [];

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              toolCalls.push({
                id: tc.id || 'call_' + Math.random().toString(36).substring(2, 9),
                name: tc.function?.name,
                arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
              });
            }
          }

          yield {
            content: delta?.content || '',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            isDone: false,
          };
        } catch {
          // ignore
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Anthropic Claude Streamer (/v1/messages)
  // -------------------------------------------------------------
  private async *streamAnthropic(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<LLMResponseChunk, void, unknown> {
    if (!this.config.anthropicApiKey) {
      throw new Error('Anthropic API key is not configured.');
    }

    const endpoint = 'https://api.anthropic.com/v1/messages';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: this.config.anthropicModel || 'claude-3-5-sonnet-20241022',
        system: this.getEnrichedSystemPrompt(),
        max_tokens: 4096,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        tools: SYSTEM_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        })),
        stream: true,
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
        try {
          const json = JSON.parse(trimmed.substring(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield {
              content: json.delta.text,
              isDone: false,
            };
          }
          if (json.type === 'message_stop') {
            yield { isDone: true };
          }
        } catch {
          // ignore
        }
      }
    }
  }
}
