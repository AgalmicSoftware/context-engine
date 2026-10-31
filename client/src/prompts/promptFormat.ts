const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fills every placeholder in one pass, inserting each value as literal text: a
// value holding a placeholder or a `$&` pattern is never rescanned or rewritten.
export const fillPromptTemplate = (template: string, values: Record<string, unknown>): string => {
  const placeholders = Object.keys(values);
  if (!placeholders.length) return template;
  const pattern = new RegExp(placeholders.map(escapeRegExp).join('|'), 'g');
  return template.replace(pattern, (placeholder) => String(values[placeholder] ?? ''));
};

export type JsonSchemaResponseFormat = {
  type: 'json_schema';
  json_schema: { name: string; schema: Record<string, unknown>; strict: true };
};

// A strict JSON schema for parsed replies. OpenAI and Claude both enforce it;
// other providers get the prompt's own description of the shape.
export const jsonSchemaResponseFormat = (name: string, schema: Record<string, unknown>): JsonSchemaResponseFormat => ({
  type: 'json_schema',
  json_schema: { name, schema, strict: true },
});
