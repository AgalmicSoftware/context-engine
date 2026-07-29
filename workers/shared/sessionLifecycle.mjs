const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

export const normalizeSessionEndsAt = (value) => {
  const raw = toTrimmedString(value);
  if (!raw) return { ok: true, value: '' };
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, value: '' };
  }
  return {
    ok: true,
    value: new Date(timestamp).toISOString(),
  };
};

export const resolveSessionLifecycle = (config, { now = Date.now } = {}) => {
  const normalized = normalizeSessionEndsAt(config?.sessionEndsAt);
  const nowMs = Number(typeof now === 'function' ? now() : now);
  return {
    sessionEndsAt: normalized.ok ? normalized.value : '',
    ended:
      normalized.ok &&
      !!normalized.value &&
      Number.isFinite(nowMs) &&
      Date.parse(normalized.value) <= nowMs,
  };
};

export const buildSessionEndedResponse = ({ config, headers, json, now } = {}) => {
  const lifecycle = resolveSessionLifecycle(config, { now });
  if (!lifecycle.ended) return null;
  return json?.(
    {
      error: 'This session has ended.',
      code: 'session_ended',
      sessionEndsAt: lifecycle.sessionEndsAt,
    },
    410,
    headers,
  );
};
