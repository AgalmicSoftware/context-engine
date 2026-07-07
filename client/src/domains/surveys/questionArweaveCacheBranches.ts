type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isTerminalArweaveFailureState = (state: unknown): boolean =>
  String(state || '')
    .trim()
    .toLowerCase()
    .startsWith('terminal_');

const pickNewerTextEntry = (a: unknown, b: unknown) => {
  const aRecord = isRecord(a) ? a : {};
  const bRecord = isRecord(b) ? b : {};
  const aTs = Number(aRecord.savedAtMs || 0);
  const bTs = Number(bRecord.savedAtMs || 0);
  if (aTs > bTs) return a;
  if (bTs > aTs) return b;
  const aLen = typeof aRecord.text === 'string' ? aRecord.text.length : 0;
  const bLen = typeof bRecord.text === 'string' ? bRecord.text.length : 0;
  return aLen >= bLen ? a : b;
};

const pickNewerFailureEntry = (a: unknown, b: unknown) => {
  const aRecord = isRecord(a) ? a : {};
  const bRecord = isRecord(b) ? b : {};
  const aTs = Number(aRecord.lastFailedAtMs || aRecord.firstFailedAtMs || 0);
  const bTs = Number(bRecord.lastFailedAtMs || bRecord.firstFailedAtMs || 0);
  if (aTs > bTs) return a;
  if (bTs > aTs) return b;
  const aAttempts = Number(aRecord.attempts || 0);
  const bAttempts = Number(bRecord.attempts || 0);
  if (aAttempts > bAttempts) return a;
  if (bAttempts > aAttempts) return b;
  const aTerminal = isTerminalArweaveFailureState(aRecord.state);
  const bTerminal = isTerminalArweaveFailureState(bRecord.state);
  if (aTerminal && !bTerminal) return a;
  if (bTerminal && !aTerminal) return b;
  return a || b || null;
};

const mergeByKey = (localMap: unknown, freshMap: unknown, chooser: (a: unknown, b: unknown) => unknown) => {
  const local: UnknownRecord = isRecord(localMap) ? localMap : {};
  const fresh: UnknownRecord = isRecord(freshMap) ? freshMap : {};
  const out: UnknownRecord = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(fresh)]);
  keys.forEach((key) => {
    const localEntry = local[key];
    const freshEntry = fresh[key];
    if (localEntry && freshEntry) {
      out[key] = chooser(localEntry, freshEntry);
      return;
    }
    out[key] = localEntry || freshEntry;
  });
  return out;
};

export const ensureQuestionArweaveCacheBranches = (networkNode: unknown) => {
  const node = (isRecord(networkNode) ? networkNode : {}) as UnknownRecord & {
    arweaveTxCache?: unknown;
    arweaveTxFailureCache?: unknown;
  };
  if (!node.arweaveTxCache || typeof node.arweaveTxCache !== 'object') node.arweaveTxCache = {};
  if (!node.arweaveTxFailureCache || typeof node.arweaveTxFailureCache !== 'object') node.arweaveTxFailureCache = {};
  return node;
};

export const mergeQuestionArweaveCacheBranches = (localNode: unknown, freshNode: unknown) => {
  const local = ensureQuestionArweaveCacheBranches(localNode);
  const fresh = ensureQuestionArweaveCacheBranches(isRecord(freshNode) ? freshNode : {});
  local.arweaveTxCache = mergeByKey(local.arweaveTxCache, fresh.arweaveTxCache, pickNewerTextEntry);
  local.arweaveTxFailureCache = mergeByKey(
    local.arweaveTxFailureCache,
    fresh.arweaveTxFailureCache,
    pickNewerFailureEntry,
  );
  return local;
};
