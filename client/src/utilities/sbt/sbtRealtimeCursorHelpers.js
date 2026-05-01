export const normalizeSbtRealtimeEventCursor = (value = null) => {
  if (!value || typeof value !== 'object') return null;
  const blockNumber = Number(value.blockNumber);
  if (!Number.isFinite(blockNumber) || blockNumber < 0) return null;
  const transactionIndexRaw = Number(value.transactionIndex);
  const logIndexRaw = Number(value.logIndex);
  return {
    blockNumber: Math.floor(blockNumber),
    transactionIndex: Number.isFinite(transactionIndexRaw) && transactionIndexRaw >= 0
      ? Math.floor(transactionIndexRaw)
      : -1,
    logIndex: Number.isFinite(logIndexRaw) && logIndexRaw >= 0
      ? Math.floor(logIndexRaw)
      : -1,
  };
};


export const compareSbtRealtimeEventCursor = (leftIn = null, rightIn = null) => {
  const left = normalizeSbtRealtimeEventCursor(leftIn);
  const right = normalizeSbtRealtimeEventCursor(rightIn);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left.blockNumber !== right.blockNumber) return left.blockNumber - right.blockNumber;
  if (left.transactionIndex !== right.transactionIndex) return left.transactionIndex - right.transactionIndex;
  return left.logIndex - right.logIndex;
};
