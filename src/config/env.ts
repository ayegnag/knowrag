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
  OLLAMA_CLASSIFIER_MODEL: z.string().optional(), // if not set, will use OLLAMA_CHAT_MODEL for classification
  OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

  VECTOR_DB: z.enum(['qdrant']).default('qdrant'),  // for now only qdrant; extend later
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_COLLECTION_NAME: z.string().default('knowrag'),

  SECURITY_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
});

const env = envSchema.parse(process.env);

export default env;