const DEBUG_ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isDebugEnabled() {
  const raw = process.env.CE_CC_DEBUG;
  if (raw == null) return false;
  return DEBUG_ENABLED_VALUES.has(String(raw).trim().toLowerCase());
}

export function debug(...args) {
  if (isDebugEnabled()) console.log(...args);
}

export function info(...args) {
  console.info(...args);
}

export function warn(...args) {
  console.warn(...args);
}

export function error(...args) {
  console.error(...args);
}
