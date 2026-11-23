// An AI prompt shown to read: each value it carries is drawn as a named stand-in, `<SessionName>` where the
// name is. The text that is copied or sent keeps every value.

/** `shown` is what stands in for the value; left out, `<name>`. */
export type PromptVariable = { name: string; value: string; shown?: string };

export type PromptPiece = { text: string; variable?: string };

/** The prompt cut into plain text and stand-ins, in order. Longer values are taken first. */
export const splitPromptByVariables = (prompt: string, variables: PromptVariable[]): PromptPiece[] => {
  let pieces: PromptPiece[] = [{ text: prompt }];
  for (const { name, value, shown = `<${name}>` } of [...variables].sort((a, b) => b.value.length - a.value.length)) {
    if (!value) continue;
    pieces = pieces.flatMap((piece) => {
      if (piece.variable) return [piece];
      const parts = piece.text.split(value);
      return parts.flatMap((text, index) => [
        ...(index ? [{ text: shown, variable: name }] : []),
        ...(text ? [{ text }] : []),
      ]);
    });
  }
  return pieces;
};

const NAMED = /<([A-Za-z][A-Za-z0-9_]*)>|\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
// A Worker's build prompts also describe a placeholder in words: `<Topic, left out for a whole branch>`.
const NAMED_OR_DESCRIBED = /<([A-Z][A-Za-z0-9_ ,]*)>|\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;

/**
 * The placeholders a prompt template is written with, `<Name>` or `{{name}}`: each stands in as written.
 * `described` also takes one that starts with a capital and goes on in words.
 */
export const findPromptPlaceholders = (template: string, { described = false } = {}): PromptVariable[] => {
  const found = new Map<string, PromptVariable>();
  for (const [value, angled, braced] of template.matchAll(described ? NAMED_OR_DESCRIBED : NAMED)) {
    if (!found.has(value)) found.set(value, { name: angled || braced, value, shown: value });
  }
  return [...found.values()];
};
