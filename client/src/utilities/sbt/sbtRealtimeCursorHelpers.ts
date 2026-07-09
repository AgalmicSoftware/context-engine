export interface SbtRealtimeEventCursor {
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
}

type UnknownRecord = Record<PropertyKey, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object';

const normalizeNonNegativeInteger = (value: unknown): number | null => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return null;
  return Math.floor(numericValue);
};

export const normalizeSbtRealtimeEventCursor = (value: unknown = null): SbtRealtimeEventCursor | null => {
  if (!isUnknownRecord(value)) return null;
  const blockNumber = normalizeNonNegativeInteger(value.blockNumber);
  if (blockNumber == null) return null;
  return {
    blockNumber,
    transactionIndex: normalizeNonNegativeInteger(value.transactionIndex) ?? -1,
    logIndex: normalizeNonNegativeInteger(value.logIndex) ?? -1,
  };
};

export const compareSbtRealtimeEventCursor = (leftIn: unknown = null, rightIn: unknown = null): number => {
  const left = normalizeSbtRealtimeEventCursor(leftIn);
  const right = normalizeSbtRealtimeEventCursor(rightIn);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left.blockNumber !== right.blockNumber) return left.blockNumber - right.blockNumber;
  if (left.transactionIndex !== right.transactionIndex) return left.transactionIndex - right.transactionIndex;
  return left.logIndex - right.logIndex;
};
