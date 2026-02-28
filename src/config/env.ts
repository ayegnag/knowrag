import { config } from 'dotenv';
import { z } from 'zod';

config(); // Load .env

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  LLM_PROVIDER: z.enum(['openai', 'ollama']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_HOST: z.string().url().optional().default('http://localhost:11434'),
  OLLAMA_CHAT_MODEL: z.string().default('llama3.1:8b'),
  OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

  PINECONE_API_KEY: z.string(),
  PINECONE_INDEX_NAME: z.string().default('onboarding-rag'),
  PINECONE_NAMESPACE: z.string().optional().default('default'),

  SECURITY_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
});

const env = envSchema.parse(process.env);

export default env;