type UnknownRecord = Record<string, unknown>;

/** One side of a difference: the letters of the people who hold it, and what they hold. */
export interface CompareSide {
  who: string[];
  view: string;
}

/** A similarity or difference; older replies and the local fallback give `text` alone. */
export interface ComparePoint {
  title?: string;
  text: string;
  sides?: CompareSide[];
}

export interface CompareSummary {
  headline?: string;
  agreements: ComparePoint[];
  disagreements: ComparePoint[];
}

export interface CompareToolkitPayload {
  users: unknown[];
}

const HEADLINE_MAX = 220;
const TITLE_MAX = 60;
const VIEW_MAX = 160;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// A short field is drawn on one line, so line breaks are folded and an overlong reply is cut.
const oneLine = (value: unknown, max: number): string => {
  const line = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};

// Sides name people by the letters the page gave them. A side naming anyone else, or someone
// already placed on another side, is dropped; fewer than two sides is no split worth drawing.
const readSides = (value: unknown, letters: Set<string>): CompareSide[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const placed = new Set<string>();
  const sides = value.flatMap((side): CompareSide[] => {
    if (!isRecord(side) || !Array.isArray(side.who)) return [];
    const who = [...new Set(side.who.map((letter) => String(letter).trim().toUpperCase()))].sort();
    const view = oneLine(side.view, VIEW_MAX);
    if (!view || !who.length || who.some((letter) => !letters.has(letter) || placed.has(letter))) return [];
    who.forEach((letter) => placed.add(letter));
    return [{ who, view }];
  });
  return sides.length >= 2 ? sides : undefined;
};

const readPoint = (item: unknown, letters: Set<string>, withSides: boolean): ComparePoint | null => {
  if (typeof item === 'string') return item.trim() ? { text: item.trim() } : null;
  if (!isRecord(item) || typeof item.text !== 'string' || !item.text.trim()) return null;
  const title = oneLine(item.title, TITLE_MAX);
  const sides = withSides ? readSides(item.sides, letters) : undefined;
  return { ...(title ? { title } : {}), text: item.text.trim(), ...(sides ? { sides } : {}) };
};

/**
 * The AI's compare reply, checked by hand. Both the titled shape and the older plain paragraphs
 * are read; null when any item cannot be read, so the page falls back and says so.
 */
export const readCompareSummary = (candidate: unknown, letters: string[], maxItems = 3): CompareSummary | null => {
  if (!isRecord(candidate) || !Array.isArray(candidate.agreements) || !Array.isArray(candidate.disagreements)) {
    return null;
  }
  const known = new Set(letters);
  // A blank item is left out; anything else that cannot be read fails the reply, so the page says so.
  const blank = (item: unknown): boolean => typeof item === 'string' && !item.trim();
  const agreements = candidate.agreements.filter((item) => !blank(item)).map((item) => readPoint(item, known, false));
  const disagreements = candidate.disagreements
    .filter((item) => !blank(item))
    .map((item) => readPoint(item, known, true));
  const readable = (points: Array<ComparePoint | null>): points is ComparePoint[] => points.every(Boolean);
  if (!readable(agreements) || !readable(disagreements)) return null;
  const headline = oneLine(candidate.headline, HEADLINE_MAX);
  return {
    ...(headline ? { headline } : {}),
    agreements: agreements.slice(0, maxItems),
    disagreements: disagreements.slice(0, maxItems),
  };
};

/** Plain paragraphs, such as the local fallback's, as untitled points with no headline. */
export const compareSummaryFromParagraphs = (
  { agreements, disagreements }: { agreements: string[]; disagreements: string[] },
  maxItems = 3,
): CompareSummary => ({
  agreements: agreements.slice(0, maxItems).map((text) => ({ text })),
  disagreements: disagreements.slice(0, maxItems).map((text) => ({ text })),
});

export const readCompareToolkitTask = (task: unknown): string => String(task || '').toLowerCase();

export const resolveCompareToolkitPayload = (payload: unknown, maxUsers = 10): CompareToolkitPayload => {
  const record = isRecord(payload) ? payload : {};
  return {
    users: Array.isArray(record.users) ? record.users.slice(0, maxUsers) : [],
  };
};
