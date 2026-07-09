export type UnknownRecord = Record<string, unknown>;

export type ResponseSlice = {
  answers?: Record<string, unknown> | null;
  importance?: Record<string, unknown> | null;
  conviction?: Record<string, unknown> | null;
  additionalComments?: Record<string, unknown> | null;
} & UnknownRecord;

export type DraftPayload = {
  answers?: Record<string, unknown> | null;
  baseline?: Record<string, unknown> | null;
} & UnknownRecord;

export const buildEmptyResponseSlice = (): ResponseSlice => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

export const isSurveyToolRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
