import type { VectorDBProvider } from '../vector-db.interface.js';
import { getQdrantClient } from './qdrant.client.js';
import env from '../../../config/env.js';

export class QdrantService implements VectorDBProvider {
  private collectionName: string = env.QDRANT_COLLECTION_NAME;

  /**
   * Ensure collection exists (create if missing with default config).
   * In production, prefer creating collections via dashboard/CLI.
   */
  private async ensureCollection(): Promise<void> {
    const client = getQdrantClient();
    const collections = await client.getCollections();

    if (!collections.collections.some(c => c.name === this.collectionName)) {
      await client.createCollection(this.collectionName, {
        vectors: {
          size: 1536,               // match your embedding dim (e.g. OpenAI small=1536, nomic=768)
          distance: 'Cosine',       // common default
        },
        // You can add more config: optimizers, hnsw, etc.
      });
      console.log(`Created Qdrant collection: ${this.collectionName}`);
    }
  }

  async upsert(vectors: Array<{ id: string | number; vector: number[]; payload?: Record<string, any> }>): Promise<{ upsertedCount: number }> {
    await this.ensureCollection(); // safe to call multiple times

    const client = getQdrantClient();

    const points = vectors.map(v => ({
      id: v.id,
      vector: v.vector,
      payload: v.payload || {},
    }));

    await client.upsert(this.collectionName, { points });

    return { upsertedCount: points.length };
  }

  async query({
    vector,
    limit = 5,
    filter,
    withPayload = true,
    withVector = false,
  }: {
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
  }) {
    await this.ensureCollection();

    const client = getQdrantClient();

    const result = await client.search(this.collectionName, {
      vector,
      limit,
      filter,
      with_payload: withPayload,
      with_vector: withVector,
    }) as Array<{
      id: string | number;
      score: number;
      payload?: Record<string, any> | null;
      vector?: number[] | null;
      // etc.
    }>;

    // result is ScoredPoint[], but TypeScript infers it automatically in recent versions
    return {
      results: result,               // Array of { id, score, payload?, vector? }
      count: result.length,
    };
  }
  async healthCheck(): Promise<{ status: 'healthy' | 'error'; message?: string }> {
    try {
      const client = getQdrantClient();
      await client.getCollections(); // simple connectivity test
      return { status: 'healthy' };
    } catch (err: any) {
      return {
        status: 'error',
        message: err.message || 'Qdrant connection failed',
      };
    }
  }
}

// Singleton export
export const vectorDB = new QdrantService();