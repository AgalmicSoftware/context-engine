const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fills every placeholder in one pass, inserting each value as literal text: a
// value holding a placeholder or a `$&` pattern is never rescanned or rewritten.
export const fillPromptTemplate = (template: string, values: Record<string, unknown>): string => {
  const placeholders = Object.keys(values);
  if (!placeholders.length) return template;
  const pattern = new RegExp(placeholders.map(escapeRegExp).join('|'), 'g');
  return template.replace(pattern, (placeholder) => String(values[placeholder] ?? ''));
};
