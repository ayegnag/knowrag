// Global IDF cache (simple, approximate)
const docCount = 1000; // rough estimate of total chunks in vault
const termDocFreq = new Map<string, number>(); // term → number of chunks it appears in

export function generateSparseVector(text: string): Record<number, number> {
  const tokens = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const tf = new Map<string, number>();
  tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));

  const sparse: Record<number, number> = {};
  for (const [token, count] of tf) {
    const df = termDocFreq.get(token) || 1; // fallback to 1
    const idf = Math.log((docCount + 1) / (df + 0.5)) + 1; // BM25 IDF
    const score = count * idf / (count + 1.2 * (1 - 0.75 + 0.75 * (tokens.length / 500))); // rough k1=1.2, b=0.75
    sparse[token.charCodeAt(0) % 10000] = score; // simple hash for index (improve later)
  }

  return sparse;
}

// Optional: update IDF during ingestion (call after each chunk)
export function updateIDF(tokens: string[]) {
  tokens.forEach(t => termDocFreq.set(t, (termDocFreq.get(t) || 0) + 1));
}