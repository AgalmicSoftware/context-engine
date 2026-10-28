export const ratingConformance: {
  name: string;
  scale: { min: number; max: number; step?: number };
  input: number | string | null;
  expected: number | null;
}[];
