export const normalizeScssContract = (source: string): string =>
  source
    .replace(/(["'])((?:\\.|(?!\1).)*)\1/g, (_match, _quote, value: string) => `'${value}'`)
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
