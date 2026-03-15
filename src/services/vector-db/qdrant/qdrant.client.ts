import { QdrantClient } from '@qdrant/js-client-rest';
import env from '../../../config/env.js';

let qdrantClient: QdrantClient | null = null;

/**
 * Lazy-initialized singleton Qdrant REST client.
 */
export function getQdrantClient(): QdrantClient {
  if (qdrantClient) {
    return qdrantClient;
  }

  qdrantClient = new QdrantClient({
    url: env.QDRANT_URL,
    // apiKey: env.QDRANT_API_KEY, // add later if you enable auth
  });

  console.log(`Qdrant client initialized (URL: ${env.QDRANT_URL}, collection: ${env.QDRANT_COLLECTION_NAME})`);

  return qdrantClient;
}