// Executed by each answer consumer's suite to keep the accepted scale contract aligned.
export const ratingConformance = [
  { name: 'wide unit steps', scale: { min: 0, max: 100, step: 1 }, input: 51, expected: 51 },
  { name: 'wide default step', scale: { min: 0, max: 100 }, input: 51, expected: 51 },
  { name: 'fractional step', scale: { min: -0.5, max: 0.5, step: 0.1 }, input: 0.3, expected: 0.3 },
  { name: 'off grid', scale: { min: 0, max: 10, step: 2 }, input: 3, expected: null },
  { name: 'out of bounds', scale: { min: 0, max: 10 }, input: 10.5, expected: null },
  { name: 'numeric string', scale: { min: 0, max: 10 }, input: '7', expected: 7 },
  { name: 'blank', scale: { min: 0, max: 10 }, input: '', expected: null },
  { name: 'null', scale: { min: 0, max: 10 }, input: null, expected: null },
  { name: 'NaN', scale: { min: 0, max: 10 }, input: NaN, expected: null },
  { name: 'proposal step rejects 51', scale: { min: 0, max: 100, step: 5 }, input: 51, expected: null },
  { name: 'proposal step accepts 55', scale: { min: 0, max: 100, step: 5 }, input: 55, expected: 55 },
  { name: 'decimal rounding', scale: { min: -0.5, max: 0.5, step: 0.1 }, input: 0.30000000000000004, expected: 0.3 },
];
