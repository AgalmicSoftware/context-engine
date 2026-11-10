import type { RatingScale } from './ratingScale.mjs';
export const QUESTION_TYPES: readonly string[];
export const BINARY_ANSWERS: readonly string[];
export function ratingScaleFor(question?: object): RatingScale & { step: number };
export function optionsOf(question: { options?: unknown }): string[];
export function isSingleSelect(question: object): boolean;
export function normalizeAnswerValue(question: object, value: unknown):
  { ok: true; value: string | number | string[] | number[] } | { ok: false; error: string };
