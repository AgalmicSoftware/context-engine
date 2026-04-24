import { normalizeTagList } from '../defaultTags.js';

export const getQuestionTagDisplayList = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];

  const seen = new Set();
  const out: string[] = [];

  tags.forEach((rawTag) => {
    const displayTag = String(rawTag ?? '').trim();
    const normalizedTag = normalizeTagList([displayTag])[0];

    if (!displayTag || !normalizedTag || seen.has(normalizedTag)) return;

    seen.add(normalizedTag);
    out.push(displayTag);
  });

  return out;
};
