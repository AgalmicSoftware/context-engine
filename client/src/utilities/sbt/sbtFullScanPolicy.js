/**
 * @module sbtFullScanPolicy
 * @description SBT full-scan trigger policy — controls when a complete re-scan of SBT holdings
 *              is triggered vs. relying on cached data, with URL and localStorage overrides.
 *
 * Key exports: readSbtFullScanPolicy, writeSbtFullScanPolicy, normalizeSbtFullScanPolicy
 */
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';

const log = createLogger('sbtFullScanPolicy');


const URL_PARAM_KEY = 'ceSbtFullScanPolicy';
const LOCAL_STORAGE_KEY = 'ce:sbtFullScanPolicy';
const GLOBAL_KEY = 'CE_SBT_FULL_SCAN_POLICY';

export const normalizeSbtFullScanPolicy = (raw) => {
  const val = toStr(raw).trim().toLowerCase();
  if (val === 'auto' || val === 'sbts' || val === 'manual') return val;
  return 'auto';
};

export const readSbtFullScanPolicy = () => {
  // Precedence:
  // 1) URL param `?ceSbtFullScanPolicy=auto|sbts|manual`
  // 2) localStorage `ce:sbtFullScanPolicy`
  // 3) globalThis.CE_SBT_FULL_SCAN_POLICY
  // 4) default "auto"

  try {
    if (typeof window !== 'undefined') {
      const search = window.location?.search || '';
      const params = new URLSearchParams(search);
      if (params.has(URL_PARAM_KEY)) {
        return normalizeSbtFullScanPolicy(params.get(URL_PARAM_KEY));
      }
    }
  } catch (e) { log.warn('sbtFullScanPolicy: fallback', e); }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored != null) return normalizeSbtFullScanPolicy(stored);
    }
  } catch (e) { log.warn('sbtFullScanPolicy: fallback', e); }

  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis[GLOBAL_KEY] !== 'undefined') {
      return normalizeSbtFullScanPolicy(globalThis[GLOBAL_KEY]);
    }
  } catch (e) { log.warn('sbtFullScanPolicy: fallback', e); }

  return 'auto';
};

export const writeSbtFullScanPolicy = (policyIn) => {
  const policy = normalizeSbtFullScanPolicy(policyIn);

  try {
    if (typeof globalThis !== 'undefined') globalThis[GLOBAL_KEY] = policy;
  } catch (e) { log.warn('sbtFullScanPolicy: fallback', e); }

  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_STORAGE_KEY, policy);
  } catch (e) { log.warn('sbtFullScanPolicy: fallback', e); }

  return policy;
};
