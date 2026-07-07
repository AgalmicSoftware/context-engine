export type ResponseRecencyPair = Record<string, unknown> & {
  bn: number;
  txi: number;
  li: number;
  ts: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

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

export const compareResponseRecency = (
  incomingRecency: ResponseRecencyPair,
  existingRecency: ResponseRecencyPair,
): number => {
  if (incomingRecency.bn > existingRecency.bn) return 1;
  if (incomingRecency.bn < existingRecency.bn) return -1;
  if (incomingRecency.txi > existingRecency.txi) return 1;
  if (incomingRecency.txi < existingRecency.txi) return -1;
  if (incomingRecency.li > existingRecency.li) return 1;
  if (incomingRecency.li < existingRecency.li) return -1;
  if (incomingRecency.ts > existingRecency.ts) return 1;
  if (incomingRecency.ts < existingRecency.ts) return -1;
  return 0;
};
