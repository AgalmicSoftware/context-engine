import { canonicalizeSessionSlug } from '../session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../session/sessionWorkerDiscovery.js';

export const WORKER_GROUPS_CHANGED_EVENT = 'ce:worker-groups-changed';

export type WorkerGroupsChangedDetail = {
  sessionSlug: string;
  sessionId: string;
};

const normalizeWorkerGroupsChangedDetail = (value: unknown): WorkerGroupsChangedDetail | null => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const sessionSlug = canonicalizeSessionSlug(source.sessionSlug);
  const sessionId = normalizeWorkerCanonicalSessionIdHex(source.sessionId);
  return sessionSlug && sessionId ? { sessionSlug, sessionId } : null;
};

const getWindow = (): Window | null =>
  typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;

export const dispatchWorkerGroupsChanged = (value: unknown): WorkerGroupsChangedDetail | null => {
  const detail = normalizeWorkerGroupsChangedDetail(value);
  const target = getWindow();
  if (!detail || !target || typeof target.dispatchEvent !== 'function') return detail;
  try {
    target.dispatchEvent(new CustomEvent<WorkerGroupsChangedDetail>(WORKER_GROUPS_CHANGED_EVENT, { detail }));
  } catch (_) {}
  return detail;
};

export const subscribeWorkerGroupsChanged = (listener: (detail: WorkerGroupsChangedDetail) => void): (() => void) => {
  const target = getWindow();
  if (!target) return () => undefined;
  const handler = (event: Event) => {
    const detail = normalizeWorkerGroupsChangedDetail((event as CustomEvent<unknown>).detail);
    if (detail) listener(detail);
  };
  target.addEventListener(WORKER_GROUPS_CHANGED_EVENT, handler);
  return () => target.removeEventListener(WORKER_GROUPS_CHANGED_EVENT, handler);
};
