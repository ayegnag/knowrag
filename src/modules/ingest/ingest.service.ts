import { vectorDB } from '../../services/vector-db/qdrant/qdrant.service.js';
import { llm } from '../../config/llm-providers.js';
import { parseDocument } from './documentParser.js';
import { chunkText } from './chunker.js';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const SUPPORTED_EXT = ['.md', '.pdf', '.docx', '.txt'];
const IGNORE_DIRS = ['.obsidian', 'attachments', 'node_modules', '.git'];

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !IGNORE_DIRS.includes(entry.name)) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.isFile() && SUPPORTED_EXT.includes(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

export const ingestService = {
  async ingestFile(file: Express.Multer.File | { path: string; originalname: string; buffer?: Buffer }) {
    console.log('[Ingest] Starting file:', file.originalname || file.path);

    let parsed;
    try {
      parsed = await parseDocument(file);
      console.log('[Ingest] Parsed content length:', parsed.content.length);
      console.log('[Ingest] Metadata keys:', Object.keys(parsed.metadata));
    } catch (err: any) {
      console.error('[Ingest] Parse failed:', err.message);
      throw err;
    }

    const chunks = chunkText(parsed.content);
    console.log('[Ingest] Created chunks:', chunks.length);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let embedding;
      try {
        embedding = await llm.generateEmbedding(chunk);
        console.log(`[Ingest] Embedding for chunk ${i}: length = ${embedding.length}`);
      } catch (err: any) {
        console.error(`[Ingest] Embedding failed for chunk ${i}:`, err.message);
        throw new Error(`Embedding failed: ${err.message}`);
      }

      vectors.push({
        // id: `${parsed.metadata.fileName || 'unknown'}-chunk-${i}`,
        id: uuidv4(),
        vector: embedding,
        payload: {
          ...parsed.metadata,
          chunkIndex: i,
          text: chunk,
          totalChunks: chunks.length,
        },
      });
    }

    console.log('[Ingest] Prepared vectors:', vectors.length);

    try {
      const upsertResult = await vectorDB.upsert(vectors);
      console.log('[Ingest] Upsert success:', upsertResult);
      return { success: true, file: parsed.metadata.fileName, chunksIngested: chunks.length };
    } catch (err: any) {
      console.error('[Ingest] Upsert failed:', err);
      console.error('[Ingest] Error details:', err.message, err.stack);
      throw new Error(`Upsert failed: ${err.message}`);
    }
  },

  async ingestFolder(folderPath: string) {
    const files = await walkDir(folderPath);
    const results = [];

    for (const filePath of files) {
      console.log('[Ingest Folder] Processing:', filePath);
      try {
        const file = {
          originalname: filePath.split('/').pop()!,
          buffer: await import('fs/promises').then(fs => fs.readFile(filePath)),
        } as any;

        const result = await this.ingestFile(file);
        results.push(result);
      } catch (err: any) {
        console.error('[Ingest Folder] Failed on file:', filePath, err.message);
        results.push({ file: filePath, error: err.message });
      }
    }

    return { success: true, totalFiles: files.length, results };
  },
};