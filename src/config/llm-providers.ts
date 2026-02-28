import { OpenAI } from 'openai';
import env from './env.js';

// Unified interface we'll implement later in services/llm/
export interface LLMProvider {
  generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { stream?: boolean; temperature?: number }
  ): Promise<any>; // We'll type better later

  generateEmbedding(text: string): Promise<number[]>;
}

class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
    }
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options = { stream: false, temperature: 0.7 }
  ) {
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini', // or gpt-4o, etc. — make configurable later
      messages,
      temperature: options.temperature,
      stream: options.stream,
    });
    return completion;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
}

// Placeholder — we'll implement Ollama later
class OllamaProvider implements LLMProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.OLLAMA_HOST;
  }

  async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options = { stream: false, temperature: 0.7 }
  ) {
    // We'll implement real Ollama /api/chat call here in next step
    throw new Error('Ollama provider not yet implemented');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('Ollama provider not yet implemented');
  }
}

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

export const llm = getLLMProvider(); // singleton export for easy import