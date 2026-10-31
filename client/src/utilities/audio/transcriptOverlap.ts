type TranscriptToken = { value: string; end: number };

const tokenize = (text: string): TranscriptToken[] =>
  Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu), (match) => ({
    value: match[0].toLowerCase(),
    end: (match.index || 0) + match[0].length,
  }));

/** What `next` adds after the speech `previous` already ends with, or null when they share none. */
export const transcriptOverlapTail = (previous: unknown, next: unknown, maxTokens = Infinity): string | null => {
  const a = String(previous || '').trim();
  const b = String(next || '').trim();
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
    return tail.trimStart();
  }
  return null;
};

/** Joins speech, without a space before punctuation. */
export const joinTranscriptText = (previous: string, next: string): string =>
  `${previous}${/^[.,!?;:]/.test(next) ? '' : ' '}${next}`;

export const mergeTranscriptOverlap = (previous: unknown, next: unknown, maxTokens = Infinity): string => {
  const a = String(previous || '').trim();
  const b = String(next || '').trim();
  if (!a) return b;
  if (!b) return a;
  const tail = transcriptOverlapTail(a, b, maxTokens);
  if (tail == null) return `${a} ${b}`;
  return tail ? joinTranscriptText(a, tail) : a;
};
