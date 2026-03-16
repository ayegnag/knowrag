import { Request, Response } from 'express';
import multer from 'multer';
import type { Multer } from 'multer';
import { ingestService } from './ingest.service.js';

const upload = multer({ storage: multer.memoryStorage() }) as Multer; // Use memory storage for simplicity; can switch to disk if needed

export const ingestRouter = {
  singleFile: upload.single('file'),
  multipleFiles: upload.array('files', 50),
};

export async function ingestFileHandler(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await ingestService.ingestFile(req.file);
    res.json(result);
  } catch (err: any) {
    console.error('[Ingest] File error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function ingestFolderHandler(req: Request, res: Response) {
  try {
    const { folderPath } = req.body;
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ error: 'folderPath is required (string)' });
    }

    const result = await ingestService.ingestFolder(folderPath);
    res.json(result);
  } catch (err: any) {
    console.error('[Ingest] Folder error:', err);
    res.status(500).json({ error: err.message });
  }
}