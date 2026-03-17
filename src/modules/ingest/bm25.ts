const vocabulary = new Map<string, number>(); // word → dimension index
let nextDim = 0;

function getTokenIndex(token: string): number {
  if (!vocabulary.has(token)) {
    vocabulary.set(token, nextDim++);
  }
  return vocabulary.get(token)!;
}

export function generateSparseVector(text: string): Record<number, number> {
  const tokens = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const tf = new Map<string, number>();
  tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));

  const sparse: Record<number, number> = {};
  for (const [token, count] of tf) {
    const index = getTokenIndex(token);
    // Simple BM25 approximation (good enough for most cases)
    sparse[index] = Math.log(1 + count) * (1.2 + 1); // tf * (k1 + 1) rough
  }

  return sparse;
}