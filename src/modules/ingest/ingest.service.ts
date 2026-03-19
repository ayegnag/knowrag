import { vectorDB } from '../../services/vector-db/qdrant/qdrant.service.ts';
import { llm } from '../../config/llm-providers.js';
import { parseDocument } from './documentParser.js';
import { chunkText } from './chunker.js';
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { generateSparseVector } from './bm25.js';

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
  async ingestFile(file: any) {
    console.log(`[Ingest] === STARTING FILE ===`);
    console.log(`[Ingest] Full path received : ${file.path || '(no path)'}`);
    console.log(`[Ingest] originalname      : ${file.originalname}`);
    console.log(`[Ingest] buffer length     : ${file.buffer?.length || 0}`);

    let parsed;
    try {
      parsed = await parseDocument(file);
      console.log(`[Ingest] Parsed length     : ${parsed.content.length}`);
      console.log(`[Ingest] Metadata keys     : ${Object.keys(parsed.metadata)}`);
    } catch (err: any) {
      console.error(`[Ingest] Parse failed     : ${err.message}`);
      throw err;
    }

    const chunks = chunkText(parsed.content);
    console.log(`[Ingest] Created chunks    : ${chunks.length}`);

    // === PATH PARSING (fixed) ===
    const fullPath = file.path || file.originalname || '';
    console.log(`[Ingest] Using fullPath    : ${fullPath}`);

    const pathParts = fullPath.split(/[/\\]/).filter(Boolean);
    const fileName = pathParts.pop() || 'unknown.md';
    const parentFolders = pathParts;

    const relativePath = parentFolders.length
      ? parentFolders.join(' > ') + ' > ' + fileName
      : fileName;

    const topicHint = parentFolders.slice(-3).join(' > ') + ' > ' + fileName; // last 3 folders and file name

    console.log(`[Ingest] Parsed Folders    : [${parentFolders.join(', ')}]`);
    console.log(`[Ingest] topicHint         : "${topicHint}"`);
    console.log(`[Ingest] relativePath      : "${relativePath}"`);

    // === UPSERT ===
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await llm.generateEmbedding(chunk);
      const sparseVector = generateSparseVector(chunk);

      vectors.push({
        id: uuidv4(),
        vector: embedding,
        sparse_vector: { bm25: sparseVector },
        payload: {
          ...parsed.metadata,
          chunkIndex: i,
          text: chunk,
          totalChunks: chunks.length,
          originalFileName: fileName,
          relativePath,
          parentFolders,
          topicHint,
        },
      });
    }

    console.log(`[Ingest] Prepared ${vectors.length} vectors for upsert`);
    const upsertResult = await vectorDB.upsert(vectors);
    console.log(`[Ingest] Upsert completed: `, upsertResult);

    return { success: true, file: fileName, chunksIngested: chunks.length };
  },

  async ingestFolder(folderPath: string) {
    const files = await walkDir(folderPath);
    const results = [];

    for(const filePath of files) {
      console.log('[Ingest Folder] Processing:', filePath);

      try {
        let buffer;
        try {
          buffer = await import('fs/promises').then(fs => fs.readFile(filePath));
          console.log(`[Ingest Folder] Read file OK: ${filePath} (${buffer.length} bytes)`);
        } catch (readErr: any) {
          console.error(`[Ingest Folder] readFile FAILED for ${filePath}: ${readErr.message}`);
          throw readErr;  // re-throw so outer catch sees it
        }

        const file = {
          path: filePath,
          originalname: filePath.split(/[/\\]/).pop() || 'unknown.md',
          buffer,
        } as any;

        const result = await this.ingestFile(file);
        results.push(result);
      } catch (err: any) {
        console.error('[Ingest Folder] Failed on file:', filePath, err.message, err.code || '');
        results.push({ file: filePath, error: err.message });
      }
    }

    return { success: true, totalFiles: files.length, results };
  },
};