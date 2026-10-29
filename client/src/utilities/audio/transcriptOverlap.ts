type TranscriptToken = { value: string; end: number };

const tokenize = (text: string): TranscriptToken[] =>
  Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu), (match) => ({
    value: match[0].toLowerCase(),
    end: (match.index || 0) + match[0].length,
  }));

export const mergeTranscriptOverlap = (previous: unknown, next: unknown, maxTokens = Infinity): string => {
  const a = String(previous || '').trim();
  const b = String(next || '').trim();
  if (!a) return b;
  if (!b) return a;
  const left = tokenize(a);
  const right = tokenize(b);
  for (let size = Math.min(left.length, right.length, maxTokens); size > 0; size -= 1) {
    if (!right.slice(0, size).every((token, index) => token.value === left[left.length - size + index].value)) continue;
    if (
      right
        .slice(0, size)
        .map((token) => token.value)
        .join(' ').length < 8
    )
      break;
    // Offsets refer to the original text, before case folding. The next
    // script, accent or symbol is never consumed as a non-word separator.
    let tail = b.slice(right[size - 1].end);
    const leftSuffix = a.slice(left[left.length - 1].end);
    if (leftSuffix && tail.startsWith(leftSuffix)) tail = tail.slice(leftSuffix.length);
    tail = tail.trimStart();
    if (!tail) return a;
    return `${a}${/^[.,!?;:]/.test(tail) ? '' : ' '}${tail}`;
  }
  return `${a} ${b}`;
};
