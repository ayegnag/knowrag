import grayMatter from 'gray-matter';
import mammoth from 'mammoth';
import { readFile } from 'fs/promises';

const pdf = (await import('pdf-parse')).default;

export async function parseDocument(
  file: Express.Multer.File | { path: string; originalname: string; buffer?: Buffer }
): Promise<{ content: string; metadata: Record<string, any> }> {
  const filename = file.originalname.toLowerCase();
  const buffer = file.buffer || (await readFile(file.path));

  if (filename.endsWith('.md')) {
    const { content, data } = grayMatter(buffer.toString('utf-8'));
    return {
      content: content.trim(),
      metadata: {
        ...data, // all frontmatter (tags, aliases, created, etc.)
        sourceType: 'markdown',
        fileName: filename,
      },
    };
  }

  if (filename.endsWith('.pdf')) {
    const data = await pdf(buffer);
    return {
      content: data.text.trim(),
      metadata: { sourceType: 'pdf', fileName: filename, pageCount: data.numpages },
    };
  }

  if (filename.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      content: result.value.trim(),
      metadata: { sourceType: 'docx', fileName: filename },
    };
  }

  if (filename.endsWith('.txt')) {
    return {
      content: buffer.toString('utf-8').trim(),
      metadata: { sourceType: 'txt', fileName: filename },
    };
  }

  throw new Error(`Unsupported file type: ${filename}`);
}