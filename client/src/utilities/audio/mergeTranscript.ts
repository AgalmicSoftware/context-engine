// Overlap-safe merge helper used by streaming and final transcripts.
export const mergeTranscript = (prev: unknown, next: unknown): string => {
  const a = String(prev || '');
  const b = String(next || '');
  if (!a.trim()) {
    return b.trim();
  }
  if (!b.trim()) return a;

  const tokenize = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const A = tokenize(a);
  const B = tokenize(b);

  let bestK = 0;
  const maxK = Math.min(A.length, B.length);
  for (let k = maxK; k >= 1; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (A[A.length - k + i] !== B[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      bestK = k;
      break;
    }
  }

  // Avoid tiny overlaps (e.g., "the", "a")
  if (bestK > 0) {
    const overlappedChars = B.slice(0, bestK).join(' ').length;
    if (overlappedChars < 8) bestK = 0;
  }

  let bTrimmed = b;
  if (bestK > 0) {
    // Drop the first `bestK` tokens from the original `b`, keeping punctuation around them.
    const re = new RegExp(`^(([\\s\\W]*\\w+[\\s\\W]*){${bestK}})`);
    bTrimmed = b.replace(re, '');
  }

  return `${a}${a && bTrimmed && !/\s$/.test(a) ? ' ' : ''}${bTrimmed}`.trim();
};
