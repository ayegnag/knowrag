import env from '../../config/env.js';
import { vectorDB } from './qdrant/qdrant.service.js'; // currently only qdrant

// Later: switch based on env.VECTOR_DB
export function getVectorDB() {
  // if (env.VECTOR_DB === 'pinecone') { return pineconeService; }
  // if (env.VECTOR_DB === 'chroma') { ... }
  return vectorDB;
}