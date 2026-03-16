import axios from 'axios';
import env from './env.js';
import { OpenAI } from 'openai';

// ────────────────────────────────────────────────
// Unified LLM Provider Interface
// ────────────────────────────────────────────────

export interface LLMProvider {
  generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { stream?: boolean; temperature?: number; max_tokens?: number }
  ): Promise<any>; // We'll refine return type later when using

  generateEmbedding(text: string | string[]): Promise<number[]>;
}

// ────────────────────────────────────────────────
// OpenAI Implementation
// ────────────────────────────────────────────────

class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required for openai provider');
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options = { stream: false, temperature: 0.7, max_tokens: 2048 }
  ) {
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini', // make configurable later
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: options.stream,
    });
    return completion;
  }

  async generateEmbedding(text: string | string[]): Promise<number[]> {
    const input = Array.isArray(text) ? text : [text];
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input,
    });
    return response.data[0].embedding; // single text case; extend for batch later
  }
}

// ────────────────────────────────────────────────
// Ollama Implementation (complete)
// ────────────────────────────────────────────────

class OllamaProvider implements LLMProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.OLLAMA_HOST.endsWith('/')
      ? env.OLLAMA_HOST.slice(0, -1)
      : env.OLLAMA_HOST;
  }

  private async callOllama<T>(endpoint: string, body: any, stream: boolean = false): Promise<T> {
    try {
      const config: any = {
        headers: { 'Content-Type': 'application/json' },
      };

      if (stream) {
        config.responseType = 'stream';
      } else {
        config.responseType = 'json';  // ← critical addition
      }

      const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, body, config);
      return response.data;
    } catch (err: any) {
      console.error(`Ollama call failed for ${endpoint}:`, err.message);
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
      }
      throw new Error(`Ollama API error (${endpoint}): ${err.message}`);
    }
  }

  async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options = { stream: false, temperature: 0.7, max_tokens: 2048 }
  ) {
    const payload = {
      model: env.OLLAMA_CHAT_MODEL,
      messages,
      options: {
        temperature: options.temperature,
        num_predict: options.max_tokens,  // Ollama uses num_predict for max tokens
      },
      stream: options.stream,
    };

    if (options.stream) {
      // Streaming: return raw axios response for caller to handle
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        payload,
        { responseType: 'stream' }
      );
      return response; // Later: pipe to client or collect chunks
    }

    // Non-streaming: get full response
    const data = await this.callOllama<any>('/api/chat', payload);

    // Defensive check + normalize to OpenAI-like shape
    if (!data || !data.message || typeof data.message.content !== 'string') {
      console.error('Unexpected Ollama chat response format:', data);
      throw new Error('Ollama returned invalid or empty chat response');
    }

    // Return OpenAI-compatible structure
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: data.message.content.trim(),
          },
          finish_reason: data.done_reason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      // Optional: add model, created, etc. if needed
    };
  }

  // async generateEmbedding(text: string | string[]): Promise<number[] | number[][]> {
  //   const inputTexts = Array.isArray(text) ? text : [text];
  //   const results: number[][] = [];

  //   for (const chunk of inputTexts) {
  //     const payload = {
  //       model: env.OLLAMA_EMBEDDING_MODEL,
  //       input: chunk,
  //     };

  //     const data = await this.callOllama<any>('/api/embed', payload, false);

  //     // Ollama returns { embeddings: number[][] } even for single input
  //     if (!data || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
  //       console.error('Invalid embedding response from Ollama:', data);
  //       throw new Error('Ollama embedding response missing or invalid "embeddings" field');
  //     }

  //     // Take the first (and only) embedding vector for this chunk
  //     results.push(data.embeddings[0]);
  //   }

  //   // Return flat array for single input, array of arrays for batch
  //   return inputTexts.length === 1 ? results[0] : results;
  // }

  async generateEmbedding(text: string | string[]): Promise<number[]> {
  const inputTexts = Array.isArray(text) ? text : [text];
  const results: number[][] = [];

  for (const chunk of inputTexts) {
    const payload = {
      model: env.OLLAMA_EMBEDDING_MODEL,
      input: chunk,
    };

    const data = await this.callOllama<any>('/api/embed', payload, false);

    if (!data || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
      throw new Error(`Invalid embedding response: ${JSON.stringify(data)}`);
    }

    results.push(data.embeddings[0]);  // always take first vector
  }

  // For single input → return flat array
  // For batch → return array of vectors (but you don't use batch right now)
  return inputTexts.length === 1 ? results[0] : results.flat();
}
  // async generateEmbedding(text: string | string[]): Promise<number[]> {
  //   const inputTexts = Array.isArray(text) ? text : [text];
  //   const results: number[][] = [];

  //   for (const chunk of inputTexts) {
  //     const payload = {
  //       model: env.OLLAMA_EMBEDDING_MODEL,
  //       input: chunk,  // ← changed from "prompt" to "input"
  //     };


  //     const data = await this.callOllama<{ embedding: number[] }>('/api/embed', payload, false);
  //     if (!data.embedding || !Array.isArray(data.embedding)) {
  //       throw new Error(`Invalid embedding response from Ollama: ${JSON.stringify(data)}`);
  //     }
  //     results.push(data.embedding);
  //   }
  //   return inputTexts.length === 1 ? results[0] : results.flat();
  // }
}

// ────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────

export function getLLMProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case 'openai':
      return new OpenAIProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${env.LLM_PROVIDER}`);
  }
}

export const llm = getLLMProvider(); // singleton for easy import