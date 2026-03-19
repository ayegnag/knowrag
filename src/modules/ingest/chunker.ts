/**
 * Simple recursive character chunker with overlap (Markdown-aware)
 * Good default for Obsidian notes + other docs
 */
// src/modules/ingest/chunker.ts
export function chunkText(text: string, maxChunkSize = 650, overlap = 150): string[] {
  const chunks: string[] = [];
  let current = '';

  // Split on headings first (Obsidian-friendly)
  const sections = text.split(/(?=^#{1,6}\s)/gm);

  for (const section of sections) {
    const paragraphs = section.split(/\n\s*\n/);
    for (const para of paragraphs) {
      if ((current.length + para.length) > maxChunkSize && current) {
        chunks.push(current.trim());
        current = current.slice(-overlap); // overlap last part
      }
      current += para + '\n\n';
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.filter(c => c.length > 40);
}