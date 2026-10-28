export type RatingScale = { min: number; max: number; minLabel: string; maxLabel: string };
export const DEFAULT_RATING_SCALE: Readonly<RatingScale>;
export function hasRatingScaleMetadata(question?: object): boolean;
export function normalizeRatingScale(question?: object): RatingScale | null;
export function ratingStepFor(question?: object): number;
export function normalizeRatingAnswer(value: unknown, question?: object): number | null;
