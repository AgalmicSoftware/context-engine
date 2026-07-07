import {
  CE_ARWEAVE_AR_IO_URL,
  CE_ARWEAVE_DIRECT_TO_AR_IO,
  CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS,
  CE_ARWEAVE_PREFLIGHT_SBT_METADATA,
  CE_ARWEAVE_PREFLIGHT_SESSION_METADATA,
  CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED,
  CE_GETLOGS_MAX_CONCURRENCY,
  CE_GETLOGS_MAX_RETRIES,
  CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS,
  CE_PROFILE_SCAN_COLD_DIAG,
  CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS,
  CE_PROFILE_SCAN_SBT_BURST_SIZE,
  CE_PROFILE_SCAN_SBT_TIMEOUT_MS,
  CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP,
  CE_RPC_LOG_PROVIDER_SUCCESS,
  CE_RPC_PROVIDER_MODE,
  CE_RPC_TESTING_MODE,
  CE_RPC_VERBOSE_ERRORS,
  CE_SBT_FULL_SCAN_POLICY,
  CE_SBT_INSTANCE_LISTENERS_MODE,
  CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES,
  CE_SESSION_SCAN_SCOPE,
  CE_SESSION_SCAN_SLUGS,
  CE_USE_INFURA_RPC,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS,
  ENABLE_TARGETED_SBT_METADATA_LOOKUP,
  PREFER_PATH_RPC,
  SHOW_DEMO_SESSIONS,
} from '../../variables/appConfig';
import type { UnknownRecord } from './sessionTypes.js';

type RuntimeGlobals = typeof globalThis & UnknownRecord;

const getRuntimeGlobals = (): RuntimeGlobals => globalThis as RuntimeGlobals;

export const readBoolish = (raw: unknown, defaultVal = false): boolean => {
  if (typeof raw === 'boolean') return raw;
  const val = (raw == null ? '' : String(raw)).trim().toLowerCase();
  if (val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
  if (val === '0' || val === 'false' || val === 'no' || val === 'off') return false;
  return defaultVal;
};

export const isRpcTestingModeEnabled = (): boolean => {
  // Precedence:
  // 1) URL param `?ceRpcTestingMode=1|0|true|false`
  // 2) localStorage `ce:rpcTestingMode`
  // 3) globalThis.CE_RPC_TESTING_MODE
  // 4) default false

  try {
    if (typeof window !== 'undefined') {
      const search = window.location?.search || '';
      const params = new URLSearchParams(search);
      if (params.has('ceRpcTestingMode')) {
        return readBoolish(params.get('ceRpcTestingMode'), false);
      }
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('ce:rpcTestingMode');
      if (stored != null) return readBoolish(stored, false);
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }

  try {
    const runtimeGlobals = getRuntimeGlobals();
    if (typeof runtimeGlobals.CE_RPC_TESTING_MODE !== 'undefined') {
      return readBoolish(runtimeGlobals.CE_RPC_TESTING_MODE, false);
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }

  return !!CE_RPC_TESTING_MODE;
};

export const normalizeSessionScanSlug = (raw: unknown): string => {
  const slug = (raw == null ? '' : String(raw)).trim().toLowerCase();
  if (!slug || slug === 'general') return '';
  return slug;
};

export const normalizeSessionScanSlugList = (raw: unknown): string[] => {
  const list = Array.isArray(raw) ? raw : String(raw == null ? '' : raw).split(',');
  const seen = new Set<string>();
  const out: string[] = [];
  list.forEach((item) => {
    const slug = normalizeSessionScanSlug(item);
    if (slug === '' || slug) {
      if (seen.has(slug)) return;
      seen.add(slug);
      out.push(slug);
    }
  });
  return out;
};

export const parseStoredSessionScanSlugList = (raw: unknown): string[] => {
  const str = String(raw == null ? '' : raw).trim();
  if (!str) return [];
  if (str.startsWith('[')) {
    try {
      const arr = JSON.parse(str);
      return normalizeSessionScanSlugList(arr);
    } catch (e) {
      void e; /* fallback: runtime override lookup. */
    }
  }
  return normalizeSessionScanSlugList(str);
};

export const readSessionScanSlugsForTestingMode = (): string[] => {
  try {
    if (typeof window !== 'undefined') {
      const search = window.location?.search || '';
      const params = new URLSearchParams(search);
      if (params.has('ceSessionScanSlugs')) {
        return normalizeSessionScanSlugList(params.get('ceSessionScanSlugs'));
      }
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('ce:sessionScanSlugs');
      if (stored != null) return parseStoredSessionScanSlugList(stored);
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }

  try {
    const runtimeGlobals = getRuntimeGlobals();
    if (typeof runtimeGlobals.CE_SESSION_SCAN_SLUGS !== 'undefined') {
      return normalizeSessionScanSlugList(runtimeGlobals.CE_SESSION_SCAN_SLUGS);
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }

  return normalizeSessionScanSlugList(CE_SESSION_SCAN_SLUGS);
};

export const initializeRuntimeConfig = (): void => {
  if (typeof globalThis === 'undefined') return;
  const runtimeGlobals = getRuntimeGlobals();

  const testingMode = isRpcTestingModeEnabled();
  if (typeof runtimeGlobals.CE_RPC_TESTING_MODE === 'undefined') {
    runtimeGlobals.CE_RPC_TESTING_MODE = testingMode;
  }

  if (typeof runtimeGlobals.CE_USE_INFURA_RPC === 'undefined') {
    runtimeGlobals.CE_USE_INFURA_RPC = CE_USE_INFURA_RPC;
  }
  if (typeof runtimeGlobals.CE_RPC_PROVIDER_MODE === 'undefined') {
    runtimeGlobals.CE_RPC_PROVIDER_MODE = CE_RPC_PROVIDER_MODE;
  }
  if (typeof runtimeGlobals.CE_PREFER_PATH_RPC === 'undefined') {
    runtimeGlobals.CE_PREFER_PATH_RPC = PREFER_PATH_RPC;
  }
  if (typeof runtimeGlobals.CE_GETLOGS_MAX_CONCURRENCY === 'undefined') {
    runtimeGlobals.CE_GETLOGS_MAX_CONCURRENCY = CE_GETLOGS_MAX_CONCURRENCY;
  }
  if (typeof runtimeGlobals.CE_GETLOGS_MAX_RETRIES === 'undefined') {
    runtimeGlobals.CE_GETLOGS_MAX_RETRIES = CE_GETLOGS_MAX_RETRIES;
  }
  if (typeof runtimeGlobals.CE_SESSION_SCAN_SCOPE === 'undefined') {
    runtimeGlobals.CE_SESSION_SCAN_SCOPE = CE_SESSION_SCAN_SCOPE;
  }
  if (typeof runtimeGlobals.CE_SESSION_SCAN_SLUGS === 'undefined') {
    runtimeGlobals.CE_SESSION_SCAN_SLUGS = normalizeSessionScanSlugList(CE_SESSION_SCAN_SLUGS);
  }
  if (typeof runtimeGlobals.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED === 'undefined') {
    runtimeGlobals.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED = CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED;
  }
  const hasLegacyProfileScanRuntimeOverride = typeof runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS !== 'undefined';
  const legacyProfileScanRuntimeValue = hasLegacyProfileScanRuntimeOverride
    ? readBoolish(runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS, !!CE_USER_PROFILE_SCAN_ALL_SESSIONS)
    : !!CE_USER_PROFILE_SCAN_ALL_SESSIONS;
  if (typeof runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS === 'undefined') {
    runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS = CE_USER_PROFILE_SCAN_ALL_SESSIONS;
  }
  if (typeof runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS === 'undefined') {
    runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS = hasLegacyProfileScanRuntimeOverride
      ? legacyProfileScanRuntimeValue
      : CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS;
  }
  if (typeof runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS === 'undefined') {
    runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS = hasLegacyProfileScanRuntimeOverride
      ? legacyProfileScanRuntimeValue
      : CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS;
  }
  if (typeof runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS === 'undefined') {
    runtimeGlobals.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS = hasLegacyProfileScanRuntimeOverride
      ? legacyProfileScanRuntimeValue
      : CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS;
  }
  if (typeof runtimeGlobals.CE_PROFILE_SCAN_SBT_BURST_SIZE === 'undefined') {
    runtimeGlobals.CE_PROFILE_SCAN_SBT_BURST_SIZE = CE_PROFILE_SCAN_SBT_BURST_SIZE;
  }
  if (typeof runtimeGlobals.CE_PROFILE_SCAN_SBT_TIMEOUT_MS === 'undefined') {
    runtimeGlobals.CE_PROFILE_SCAN_SBT_TIMEOUT_MS = CE_PROFILE_SCAN_SBT_TIMEOUT_MS;
  }
  if (typeof runtimeGlobals.CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS === 'undefined') {
    runtimeGlobals.CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS = CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS;
  }
  if (typeof runtimeGlobals.CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS === 'undefined') {
    runtimeGlobals.CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS = CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS;
  }
  if (typeof runtimeGlobals.CE_PROFILE_SCAN_COLD_DIAG === 'undefined') {
    runtimeGlobals.CE_PROFILE_SCAN_COLD_DIAG = CE_PROFILE_SCAN_COLD_DIAG;
  }
  if (typeof runtimeGlobals.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP === 'undefined') {
    runtimeGlobals.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP;
  }
  if (typeof runtimeGlobals.CE_SBT_INSTANCE_LISTENERS_MODE === 'undefined') {
    runtimeGlobals.CE_SBT_INSTANCE_LISTENERS_MODE = CE_SBT_INSTANCE_LISTENERS_MODE;
  }
  if (typeof runtimeGlobals.CE_SBT_FULL_SCAN_POLICY === 'undefined') {
    runtimeGlobals.CE_SBT_FULL_SCAN_POLICY = CE_SBT_FULL_SCAN_POLICY;
  }
  if (typeof runtimeGlobals.SHOW_DEMO_SESSIONS === 'undefined') {
    runtimeGlobals.SHOW_DEMO_SESSIONS = SHOW_DEMO_SESSIONS;
  }

  if (testingMode) {
    // Intentionally set these on globalThis (not localStorage) so they are easy to enable/disable
    // while still allowing URL/localStorage overrides for specific knobs.
    runtimeGlobals.CE_USE_INFURA_RPC = false;
    const scopedSlugs = readSessionScanSlugsForTestingMode();
    runtimeGlobals.CE_SESSION_SCAN_SLUGS = scopedSlugs;
    runtimeGlobals.CE_SESSION_SCAN_SCOPE = scopedSlugs.length ? 'list' : 'general';

    if (!runtimeGlobals.__CE_DID_LOG_RPC_TESTING_MODE__) {
      runtimeGlobals.__CE_DID_LOG_RPC_TESTING_MODE__ = true;
      try {
        console.info(
          `[Context Engine] CE_RPC_TESTING_MODE enabled (` +
            `CE_SESSION_SCAN_SCOPE=${runtimeGlobals.CE_SESSION_SCAN_SCOPE}).`,
        );
      } catch (e) {
        void e; /* fallback: runtime override lookup. */
      }
    }
  }

  if (typeof runtimeGlobals.CE_RPC_VERBOSE_ERRORS === 'undefined') {
    runtimeGlobals.CE_RPC_VERBOSE_ERRORS = CE_RPC_VERBOSE_ERRORS;
  }
  if (typeof runtimeGlobals.CE_RPC_LOG_PROVIDER_SUCCESS === 'undefined') {
    runtimeGlobals.CE_RPC_LOG_PROVIDER_SUCCESS = CE_RPC_LOG_PROVIDER_SUCCESS;
  }
  if (typeof runtimeGlobals.ENABLE_TARGETED_SBT_METADATA_LOOKUP === 'undefined') {
    runtimeGlobals.ENABLE_TARGETED_SBT_METADATA_LOOKUP = ENABLE_TARGETED_SBT_METADATA_LOOKUP;
  }
  if (typeof runtimeGlobals.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES === 'undefined') {
    runtimeGlobals.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES = CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES;
  }
  if (typeof runtimeGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO === 'undefined') {
    runtimeGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = CE_ARWEAVE_DIRECT_TO_AR_IO;
  }
  if (typeof runtimeGlobals.CE_ARWEAVE_AR_IO_URL === 'undefined') {
    runtimeGlobals.CE_ARWEAVE_AR_IO_URL = CE_ARWEAVE_AR_IO_URL;
  }
  if (typeof runtimeGlobals.CE_ARWEAVE_PREFLIGHT_SESSION_METADATA === 'undefined') {
    runtimeGlobals.CE_ARWEAVE_PREFLIGHT_SESSION_METADATA = CE_ARWEAVE_PREFLIGHT_SESSION_METADATA;
  }
  if (typeof runtimeGlobals.CE_ARWEAVE_PREFLIGHT_SBT_METADATA === 'undefined') {
    runtimeGlobals.CE_ARWEAVE_PREFLIGHT_SBT_METADATA = CE_ARWEAVE_PREFLIGHT_SBT_METADATA;
  }
  if (typeof runtimeGlobals.CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS === 'undefined') {
    runtimeGlobals.CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS = CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS;
  }
};
