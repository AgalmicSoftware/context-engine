export type ResponseRecencyPair = Record<string, unknown> & {
  bn: number;
  txi: number;
  li: number;
  ts: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const RESPONSE_RECENCY_KEYS = [
  ['bn', 'blockNumber'],
  ['txi', 'transactionIndex', 'txIndex'],
  ['li', 'logIndex'],
  ['ts', 'timestamp'],
] as const;

const readResponseRecencyField = (value: unknown, keys: readonly string[]): number => {
  const source = isRecord(value) ? value : {};
  const raw = keys.reduce<unknown>((resolved, key) => resolved ?? source[key], undefined);
  return Number(raw ?? 0);
};

const compareResponseRecencyValues = (incomingRecency: unknown, existingRecency: unknown): number | null => {
  for (const keys of RESPONSE_RECENCY_KEYS) {
    const incoming = readResponseRecencyField(incomingRecency, keys);
    const existing = readResponseRecencyField(existingRecency, keys);
    if (!Number.isFinite(incoming) || !Number.isFinite(existing)) return null;
    if (incoming > existing) return 1;
    if (incoming < existing) return -1;
  }
  return 0;
};

export const toResponseRecencyPair = (value: unknown, responseValue: unknown = null): ResponseRecencyPair => {
  const src = isRecord(value) ? value : {};
  const responseObj = isRecord(responseValue) ? responseValue : {};
  return {
    bn: Number(src.bn ?? src.blockNumber ?? responseObj.blockNumber ?? responseObj.bn ?? 0) || 0,
    txi:
      Number(
        src.txi ?? src.transactionIndex ?? src.txIndex ?? responseObj.transactionIndex ?? responseObj.txIndex ?? 0,
      ) || 0,
    li: Number(src.li ?? src.logIndex ?? responseObj.logIndex ?? responseObj.li ?? 0) || 0,
    ts: Number(src.ts ?? src.timestamp ?? responseObj.timestamp ?? 0) || 0,
  };
};

export const isResponseRecencyNewer = (incomingRecency: unknown, existingRecency: unknown): boolean =>
  compareResponseRecencyValues(incomingRecency, existingRecency) === 1;

export const isResponseRecencyAtLeast = (incomingRecency: unknown, existingRecency: unknown): boolean => {
  const comparison = compareResponseRecencyValues(incomingRecency, existingRecency);
  return comparison !== null && comparison >= 0;
};
