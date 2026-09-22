type RecordLike = Record<string, unknown>;
const record = (value: unknown): RecordLike =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : {};
const text = (value: unknown): string => String(value || '').trim();

export const isWorkerResponseNewer = (timestamp: number, storageRefId: string, current: unknown): boolean => {
  const prior = record(current);
  const parsed = Number(prior.ts ?? prior.timestamp ?? 0);
  const priorTimestamp = Number.isFinite(parsed) ? parsed : 0;
  // Worker time is authoritative; payload EVM fields cannot order these rows.
  // Equal times have no chronology, so immutable refs provide a stable tie-break.
  return timestamp > priorTimestamp || (timestamp === priorTimestamp && storageRefId > text(prior.storageRefId));
};

export const getSubmittedWorkerResponseRecency = (
  receipt: unknown,
  questionId: string,
): { ts: number; storageRefId: string } => {
  const refs = record(receipt).questionResponseRefs;
  const entry = Array.isArray(refs)
    ? refs.find((value) => text(record(value).questionId).toLowerCase() === questionId.toLowerCase())
    : undefined;
  const ref = record(record(entry).storageRef);
  const createdAt = Date.parse(text(ref.createdAt));
  return {
    // Older receipts lack per-question refs. Keep their optimistic fallback precise.
    ts: Number.isFinite(createdAt) && createdAt > 0 ? createdAt / 1000 : Date.now() / 1000,
    storageRefId: text(ref.id),
  };
};
