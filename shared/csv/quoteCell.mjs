// Spreadsheet apps run a cell that starts with one of these characters as a
// formula. Participant text must stay text, so it gets a leading apostrophe.
const CSV_FORMULA_START = /^[=+\-@\t\r]/;
const CSV_PLAIN_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export const quoteCsvCell = (value) => {
  const text = String(value !== undefined && value !== null ? value : '');
  const safeText = CSV_FORMULA_START.test(text) && !CSV_PLAIN_NUMBER.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};
