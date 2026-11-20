// The AI-named dimensions both "Where they stand" views draw from: the same positions, the same
// words for them, and the same way of keeping dots that would touch apart.
import type { ComparisonUser } from './compareAnswers';

export type ComparisonCompass = {
  axes?: Array<{ label?: string; description?: string; negativeLabel?: string; positiveLabel?: string }>;
  points?: Array<{ address?: string; x: number; y: number }>;
  evidence?: { x?: unknown; y?: unknown };
};
export type Dimension = {
  label: string;
  negative: string;
  positive: string;
  description: string;
  evidence: string[];
  /** Each placed person by their index, at -1 (the negative end) to 1 (the positive end). */
  values: Map<number, number>;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Both dimensions in order, or null for one the AI gave no name: a nameless scale means nothing. An end it left
 * unnamed reads "Lower" or "Higher", so a dimension that was paid for is still drawn.
 */
export const readDimensions = (compass: ComparisonCompass | null, users: ComparisonUser[]): Array<Dimension | null> =>
  [0, 1].map((axisIndex) => {
    const axis = compass?.axes?.[axisIndex];
    const label = text(axis?.label);
    if (!label) return null;
    const negative = text(axis?.negativeLabel) || 'Lower';
    const positive = text(axis?.positiveLabel) || 'Higher';
    const key = axisIndex ? 'y' : 'x';
    const values = new Map<number, number>();
    users.forEach((user, index) => {
      const point = compass?.points?.find(
        (candidate) => String(candidate.address).toLowerCase() === String(user.address).toLowerCase(),
      );
      const value = Number(point?.[key]);
      if (point && Number.isFinite(value)) values.set(index, Math.max(-1, Math.min(1, value)));
    });
    const evidence = compass?.evidence?.[key];
    return values.size
      ? {
          label,
          negative,
          positive,
          description: text(axis?.description),
          evidence: Array.isArray(evidence) ? evidence.filter((item): item is string => typeof item === 'string') : [],
          values,
        }
      : null;
  });

export const describePlace = (value: number, { negative, positive }: Dimension) =>
  value <= -0.6
    ? `near ${negative}`
    : value < -0.2
      ? `leaning to ${negative}`
      : value <= 0.2
        ? 'in the middle'
        : value < 0.6
          ? `leaning to ${positive}`
          : `near ${positive}`;

/**
 * A row for each dot, taken in order, so that no two dots in one row are closer than `gap` on every
 * axis given (positions in percent). Dots that would touch move to the next row instead.
 */
export const assignRows = (points: number[][], gap: number): number[] => {
  const rows: number[] = [];
  points.forEach((point, index) => {
    const touches = (other: number[], otherIndex: number, row: number) =>
      rows[otherIndex] === row && other.every((value, axis) => Math.abs(value - point[axis]) < gap);
    let row = 0;
    while (points.slice(0, index).some((other, otherIndex) => touches(other, otherIndex, row))) row += 1;
    rows[index] = row;
  });
  return rows;
};
