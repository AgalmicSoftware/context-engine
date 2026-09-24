// Interview provenance uses exact JSON values. Legacy form state additionally
// accepts numeric strings and treats absent scalar answers as the same empty value.
export const responseValuesEqual = (left: unknown, right: unknown, numericFormValues = false): boolean => {
  if (numericFormValues) {
    if (Array.isArray(left) || Array.isArray(right)) {
      return JSON.stringify(Array.isArray(left) ? left : []) === JSON.stringify(Array.isArray(right) ? right : []);
    }
    const empty = (value: unknown) => value === undefined || value === null || value === '';
    if (empty(left) || empty(right)) return empty(left) && empty(right);
    const numeric = (value: unknown) => typeof value !== 'object' && !Number.isNaN(Number(value));
    if (numeric(left) || numeric(right)) return Number(left) === Number(right);
    return String(left) === String(right);
  }
  try {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  } catch (_) {
    return left === right;
  }
};
