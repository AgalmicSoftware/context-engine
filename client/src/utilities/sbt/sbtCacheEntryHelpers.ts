export const resolveSbtCreationBlock = (...candidates: unknown[]): number | null =>
  candidates.reduce<number | null>((best, value) => {
    if (value == null) return best;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return best;
    const blockNumber = Math.floor(numericValue);
    return best == null || blockNumber < best ? blockNumber : best;
  }, null);
