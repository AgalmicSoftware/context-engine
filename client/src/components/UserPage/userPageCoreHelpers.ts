export type UserPageUnknownRecord = Record<string, unknown>;

export const isPlainAnalysisObject = (value: unknown): value is UserPageUnknownRecord =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export const toAnalysisRecord = (value: unknown): UserPageUnknownRecord => (isPlainAnalysisObject(value) ? value : {});
