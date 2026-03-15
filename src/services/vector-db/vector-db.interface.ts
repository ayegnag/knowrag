/**
 * Unified interface for vector database operations.
 */
export interface VectorDBProvider {
  /**
   * Upsert vectors (with IDs, embeddings, and metadata/payload).
   */
  upsert(vectors: Array<{
    id: string | number;
    vector: number[];
    payload?: Record<string, any> | null;  // ← allow null
  }>): Promise<{ upsertedCount: number }>;

  /**
   * Query for similar vectors.
   * Returns scored points with payload (which may be null).
   */
  query(params: {
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
  }): Promise<{
    results: Array<{
      id: string | number;
      score: number;
      payload?: Record<string, any> | null;   // ← key: allow null explicitly
      vector?: number[] | null;               // ← simplified, allow null
      // Ignore version, shard_key, etc. — TypeScript will allow extra props
    }>;
    count?: number;
  }>;

  /**
   * Basic health/connectivity check.
   */
  healthCheck(): Promise<{ status: 'healthy' | 'error'; message?: string }>;
}