export type ResponseValueType = 'text' | 'rating';
export type ResponseValuesEqual = (
  left: unknown,
  right: unknown,
  questionId?: string,
  field?: 'answer' | 'additional',
) => boolean;

export const answerValueType = (questionKind: unknown): ResponseValueType =>
  questionKind === 'rating' ? 'rating' : 'text';

/** Text stays exact; only a declared rating field accepts numeric strings. */
export const responseValuesEqual = (left: unknown, right: unknown, type: ResponseValueType = 'text'): boolean => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(Array.isArray(left) ? left : []) === JSON.stringify(Array.isArray(right) ? right : []);
  }
  const empty = (value: unknown) => value === undefined || value === null || value === '';
  if (empty(left) || empty(right)) return empty(left) && empty(right);
  if (type === 'rating') {
    const numeric = (value: unknown) =>
      (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value));
    if (numeric(left) && numeric(right)) return Number(left) === Number(right);
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (_) {
    return left === right;
  }
};
