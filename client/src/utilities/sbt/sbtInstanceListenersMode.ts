/**
 * @module sbtInstanceListenersMode
 * @description SBT event listener configuration — controls real-time mint/burn/transfer event
 *              subscriptions per SBT instance, with URL and localStorage overrides.
 *
 * Key exports: readSbtInstanceListenersMode, writeSbtInstanceListenersMode, normalizeSbtInstanceListenersMode
 */
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';

const log = createLogger('sbtInstanceListenersMode');
type SbtInstanceListenersMode = 'auto' | 'on' | 'off';

const URL_PARAM_KEY = 'ceSbtInstanceListenersMode';
const LOCAL_STORAGE_KEY = 'ce:sbtInstanceListenersMode';
const GLOBAL_KEY = 'CE_SBT_INSTANCE_LISTENERS_MODE';

export const normalizeSbtInstanceListenersMode = (raw: unknown): SbtInstanceListenersMode => {
  const val = toStr(raw).trim().toLowerCase();
  if (val === 'auto' || val === 'on' || val === 'off') return val;
  return 'auto';
};

export const readSbtInstanceListenersMode = (): SbtInstanceListenersMode => {
  // Precedence:
  // 1) URL param `?ceSbtInstanceListenersMode=auto|on|off`
  // 2) localStorage `ce:sbtInstanceListenersMode`
  // 3) globalThis.CE_SBT_INSTANCE_LISTENERS_MODE
  // 4) default "auto"

  try {
    if (typeof window !== 'undefined') {
      const search = window.location?.search || '';
      const params = new URLSearchParams(search);
      if (params.has(URL_PARAM_KEY)) {
        return normalizeSbtInstanceListenersMode(params.get(URL_PARAM_KEY));
      }
    }
  } catch (e) {
    log.warn('sbtInstanceListenersMode: fallback', e);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored != null) return normalizeSbtInstanceListenersMode(stored);
    }
  } catch (e) {
    log.warn('sbtInstanceListenersMode: fallback', e);
  }

  try {
    const runtimeGlobal = globalThis as Record<string, unknown>;
    if (typeof globalThis !== 'undefined' && typeof runtimeGlobal[GLOBAL_KEY] !== 'undefined') {
      return normalizeSbtInstanceListenersMode(runtimeGlobal[GLOBAL_KEY]);
    }
  } catch (e) {
    log.warn('sbtInstanceListenersMode: fallback', e);
  }

  return 'auto';
};

export const writeSbtInstanceListenersMode = (modeIn: unknown): SbtInstanceListenersMode => {
  const mode = normalizeSbtInstanceListenersMode(modeIn);

  try {
    if (typeof globalThis !== 'undefined') {
      (globalThis as Record<string, unknown>)[GLOBAL_KEY] = mode;
    }
  } catch (e) {
    log.warn('sbtInstanceListenersMode: fallback', e);
  }

  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_STORAGE_KEY, mode);
  } catch (e) {
    log.warn('sbtInstanceListenersMode: fallback', e);
  }

  return mode;
};
