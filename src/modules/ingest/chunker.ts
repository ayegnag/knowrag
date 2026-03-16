/**
 * Simple recursive character chunker with overlap (Markdown-aware)
 * Good default for Obsidian notes + other docs
 */
export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break on paragraph or heading if possible
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastNewline = slice.lastIndexOf('\n\n');
      const lastHeading = slice.lastIndexOf('\n#');
      if (lastNewline > chunkSize * 0.6) end = start + lastNewline;
      else if (lastHeading > chunkSize * 0.6) end = start + lastHeading;
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks.filter(c => c.length > 20);
}