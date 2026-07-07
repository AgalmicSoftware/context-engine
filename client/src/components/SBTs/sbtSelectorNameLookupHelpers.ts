const NAME_LOOKUP_BASE_DELAY_MS = 30 * 1000;
const NAME_LOOKUP_MAX_DELAY_MS = 60 * 60 * 1000;
const NAME_LOOKUP_MAX_EXPONENT = 8;

export type SbtNameLookupEntry = Record<string, unknown> & {
  attempts?: unknown;
  lastFailureAt?: unknown;
  nextRetryAt?: unknown;
};
export type SbtNameLookupState = Record<string, SbtNameLookupEntry>;

type SbtNameLookupCacheNetNode = Record<string, unknown> & {
  nameLookupState?: SbtNameLookupState;
};

const isNameLookupRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const getNameLookupDelayMs = (attempts: unknown): number => {
  const safeAttempts = Number(attempts || 0);
  const exponent = Math.min(Math.max(safeAttempts - 1, 0), NAME_LOOKUP_MAX_EXPONENT);
  return Math.min(NAME_LOOKUP_BASE_DELAY_MS * 2 ** exponent, NAME_LOOKUP_MAX_DELAY_MS);
};

export const ensureNameLookupState = (sbtCache: Record<string, unknown>, netKey: unknown): SbtNameLookupState => {
  const key = String(netKey || '');
  if (!isNameLookupRecord(sbtCache[key])) {
    sbtCache[key] = { sbtList: {}, nameLookupState: {} };
  }
  const node = sbtCache[key] as SbtNameLookupCacheNetNode;
  if (!isNameLookupRecord(node.nameLookupState)) {
    node.nameLookupState = {};
  }
  return node.nameLookupState as SbtNameLookupState;
};

export const canRetryNameLookup = (
  nameLookupState: SbtNameLookupState,
  addressLower: unknown,
  now: unknown = Date.now(),
): boolean => {
  const retryAt = Number(nameLookupState?.[String(addressLower || '')]?.nextRetryAt || 0);
  return !Number.isFinite(retryAt) || retryAt <= Number(now);
};

export const markNameLookupFailure = (
  nameLookupState: SbtNameLookupState,
  addressLower: unknown,
  now: unknown = Date.now(),
): void => {
  const addressKey = String(addressLower || '');
  const timestamp = Number(now);
  const prevAttempts = Number(nameLookupState?.[addressKey]?.attempts || 0) || 0;
  const attempts = prevAttempts + 1;
  const delayMs = getNameLookupDelayMs(attempts);
  nameLookupState[addressKey] = {
    attempts,
    nextRetryAt: timestamp + delayMs,
    lastFailureAt: timestamp,
  };
};

export const clearNameLookupFailure = (nameLookupState: SbtNameLookupState, addressLower: unknown): void => {
  if (!nameLookupState || !addressLower) return;
  delete nameLookupState[String(addressLower || '')];
};
