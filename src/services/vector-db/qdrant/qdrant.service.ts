import { getQdrantClient } from './qdrant.client.js';
import env from '../../../config/env.js';

export class QdrantService {
    private collectionName = env.QDRANT_COLLECTION_NAME;

    async healthCheck() {
        const client = getQdrantClient();
        try {
            await client.getCollections();
            return { status: 'healthy' };
        } catch (err: any) {
            console.error('[Qdrant gRPC Health] Failed:', err.message);
            return { status: 'error', message: err.message };
        }
    }

    async ensureCollection() {
        const client = getQdrantClient();
        const { collections } = await client.getCollections();

        if (!collections.some((c: any) => c.name === this.collectionName)) {
            await client.createCollection(this.collectionName, {
                vectors: {
                    size: 4096,
                    distance: 'Cosine',
                },
                sparse_vectors: {
                    bm25: {
                        modifier: "idf"// 1.0,
                    },
                },
            });
            console.log(`[Qdrant] Created hybrid collection: ${this.collectionName}`);
        }
    }

    async upsert(vectors: Array<{
        id: string | number;
        vector: number[];                          // dense
        sparse_vector?: { bm25: Record<number, number> };  // sparse
        payload?: Record<string, any>;
    }>) {
        const client = getQdrantClient();

        const points = vectors.map(v => {
            const point: any = {
                id: String(v.id),
                vector: v.vector,  // dense vector goes here (top-level key)
                payload: v.payload || {},
            };

            // Add sparse if present
            if (v.sparse_vector?.bm25) {
                point.sparse_vector = {
                    bm25: {
                        indices: Object.keys(v.sparse_vector.bm25).map(Number),
                        values: Object.values(v.sparse_vector.bm25),
                    },
                };
            }

            return point;
        });

        console.log(`[Qdrant Upsert] Sending ${points.length} points`);

        await client.upsert(this.collectionName, {
            points,
        });

        console.log('[Qdrant Upsert] Success');
        return { upsertedCount: points.length };
    }

    async query({
        vector,
        sparseVector,
        limit = 8,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        vector: number[];                              // dense vector
        sparseVector?: { bm25: Record<number, number> };  // sparse indices/values
        limit?: number;
        filter?: Record<string, any>;
        withPayload?: boolean;
        withVector?: boolean;
    }) {
        const client = getQdrantClient();
        console.log(`[Qdrant Hybrid] Starting search (limit: ${limit})`);

        // Build prefetch array
        const prefetch: any[] = [];

        // Dense prefetch
        prefetch.push({
            query: vector,
            // using: 'dense',          // must match your vectors config name
            limit: limit * 2,
        });
        console.log('[Qdrant Hybrid] Added dense prefetch');

        // Sparse prefetch (if provided)
        if (sparseVector?.bm25) {
            const indices = Object.keys(sparseVector.bm25).map(Number);
            const values = Object.values(sparseVector.bm25);

            prefetch.push({
                query: { indices, values },
                using: 'bm25',         // must match your sparse_vectors config name
                limit: limit * 2,
            });
            console.log(`[Qdrant Hybrid] Added sparse prefetch (indices: ${indices.length})`);
        }

        // Single query call with prefetch + fusion
        const result = await client.query(this.collectionName, {
            prefetch,
            query: prefetch.length > 1 ? { fusion: 'rrf' } : undefined,
            limit,
            with_payload: withPayload,
            // with_vectors: withVector,
            filter,
        });

        console.log(`[Qdrant Hybrid] Returned ${result.points.length} points`);

        return {
            results: result.points.map((p: any) => ({
                id: p.id,
                score: p.score,
                payload: p.payload,
            })),
            count: result.points.length,
        };
    }
}

// Singleton export
export const vectorDB = new QdrantService();