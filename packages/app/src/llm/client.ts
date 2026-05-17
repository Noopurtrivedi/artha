/**
 * LLM Client — Single OpenAI-compatible REST adapter.
 *
 * Covers Ollama (localhost:11434), LM Studio (localhost:1234),
 * llama.cpp server, and cloud providers (OpenAI, Anthropic via proxy).
 * No per-runtime code: one adapter, configured by base URL.
 */
import OpenAI from 'openai';
import { getDb } from '../db/schema';

export interface LLMConfig {
  baseUrl: string;        // e.g. http://localhost:11434/v1
  apiKey?: string;        // 'ollama' for local, real key for cloud
  model: string;          // e.g. 'llama3:8b-instruct-q4_K_M'
  maxTokens?: number;
  temperature?: number;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

export class LLMClient {
  private client: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey ?? 'ollama',
    });
  }

  /** Stream a chat completion. Yields tokens via callbacks. */
  async streamChat(
    messages: OpenAI.ChatCompletionMessageParam[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        stream: true,
        max_tokens: this.config.maxTokens ?? 4096,
        temperature: this.config.temperature ?? 0.7,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? '';
        if (token) {
          fullText += token;
          callbacks.onToken(token);
        }
      }
      callbacks.onDone(fullText);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** Non-streaming completion — for tool call parsing, planning steps. */
  async complete(
    messages: OpenAI.ChatCompletionMessageParam[],
    tools?: OpenAI.ChatCompletionTool[]
  ): Promise<OpenAI.ChatCompletion> {
    return this.client.chat.completions.create({
      model: this.config.model,
      messages,
      tools,
      tool_choice: tools?.length ? 'auto' : undefined,
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0.3,
      stream: false,
    });
  }
}

/** Returns an LLMClient configured from the active model in the DB. */
export function getActiveLLMClient(): LLMClient {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM llm_models WHERE is_active = 1 LIMIT 1`)
    .get() as Record<string, unknown> | undefined;

  if (!row) {
    // Default: Ollama with llama3.2 — safest starting point
    return new LLMClient({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'ollama',
      model: 'llama3.2:3b-instruct-q4_K_M',
    });
  }

  return new LLMClient({
    baseUrl: (row.base_url as string) ?? 'http://localhost:11434/v1',
    apiKey: (row.api_key as string) ?? 'ollama',
    model: row.ollama_name as string,
  });
}
