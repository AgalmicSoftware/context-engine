import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard, faLock, faLockOpen, faPen } from '@fortawesome/free-solid-svg-icons';
import styles from '../Admin/AdminPage.module.scss';
import CEDateTimeInput from '../Shared/CEDateTimeInput';
import {
  USE_ONCHAIN_SESSION_REGISTRY,
} from '../../variables/appConfig.js';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import { sponsoredBundlePort } from '../../domains/storage/sponsoredBundlePorts.js';
import { adminArweavePort } from '../../domains/storage/adminArweavePorts.js';
import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts.js';
import {
  getUsableSessionWorkerUrl,
  hasUsableSessionWorkerConfig,
} from '../../utilities/session/sessionWorkerAvailability.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr, normalizeSlug as canonicalizeSlug } from '../../utilities/shared/primitives.js';
import { notify } from '../../utilities/ui/notify.js';

const getErrorMessage = (error: any, fallback = 'Unknown error') => (
  error instanceof Error && error.message ? error.message : String(error?.message || error || fallback)
);

const normalizeSlug = (raw: any) => {
  const slug = canonicalizeSlug(raw);
  return slug === 'general' ? '' : slug;
};
const parseChainIdInput = (raw: any) => {
  const matches = toStr(raw).match(/\d+/g);
  if (!matches || !matches.length) return 0;
  return Number(matches[matches.length - 1]) || 0;
};
const countSessionsForChain = (entries: any = [], chainId: any = null) => {
  const list = Array.isArray(entries) ? entries : [];
  if (!chainId) return list.length;
  return list.filter(([, cfg]: any) => {
    const cfgChainId = Number(cfg?.__registry?.registryChainId || cfg?.__registry?.chainId || 0) || 0;
    return cfgChainId === chainId;
  }).length;
};
const stableCreateContextValue = (value: any, seen = new WeakSet<object>()): any => {
  if (value == null) return value;
  const valueType = typeof value;
  if (valueType === 'bigint') return value.toString();
  if (valueType !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((entry) => stableCreateContextValue(entry, seen));
    seen.delete(value);
    return result;
  }
  const result = Object.keys(value).sort().reduce((acc: Record<string, any>, key) => {
    const nextValue = value[key];
    if (typeof nextValue !== 'function' && typeof nextValue !== 'undefined') {
      acc[key] = stableCreateContextValue(nextValue, seen);
    }
    return acc;
  }, {});
  seen.delete(value);
  return result;
};
const buildCreateConfigSignature = (sessionConfig: any = null) => {
  try {
    return JSON.stringify(stableCreateContextValue(sessionConfig || null));
  } catch (_) {
    return '';
  }
};
const shortAddress = (addr: any) => {
  const value = toStr(addr).trim();
  if (!value) return '';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};
const normalizeExpiryToIso = (raw: any) => {
  const now = Date.now();
  if (raw instanceof Date) {
    const ts = raw.getTime();
    if (!Number.isFinite(ts)) throw new Error('Expiry must be a valid date/time.');
    if (ts < now) throw new Error('Expiry must be in the future.');
    return new Date(ts).toISOString();
  }
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  const ts = Date.parse(trimmed);
  if (!Number.isFinite(ts)) throw new Error('Expiry must be a valid date/time.');
  if (ts < now) throw new Error('Expiry must be in the future.');
  return new Date(ts).toISOString();
};
const SPONSOR_PAGE_CACHE_KEY = 'ce:sponsorPageDraft:v1';
const SPONSOR_PAGE_CACHE_VERSION = 1;
const DEFAULT_REMEMBER_SPONSOR_DRAFT = process.env.NODE_ENV !== 'production';
const buildEmptyBundleForm = () => ({
  label: '',
  openaiKey: '',
  anthropicKey: '',
  openrouterKey: '',
  arweaveJwk: '',
  faucetPrivateKey: '',
  customRpcUrl: '',
  litApiBase: '',
  litGroupId: '',
  litPkpId: '',
  litActionCid: '',
  litAccountApiKey: '',
  litUsageApiKey: '',
  cloudflareApiToken: '',
});
const normalizeSponsorBundleForm = (raw: any = {}) => {
  const next: Record<string, string> = buildEmptyBundleForm();
  Object.keys(next).forEach((key: any) => {
    next[key] = toStr(raw?.[key] || '').trim();
  });
  return next;
};
const normalizeSponsorBundleDraftForm = (raw: any = {}) => ({
  ...buildEmptyBundleForm(),
  label: toStr(raw?.label || '').trim(),
});
const readSponsorPageCache = () => {
  const fallback = {
    persistBundleDraft: DEFAULT_REMEMBER_SPONSOR_DRAFT,
    bundleForm: buildEmptyBundleForm(),
    expiresAt: null,
  };
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SPONSOR_PAGE_CACHE_KEY) || 'null');
    if (!parsed || Number(parsed.v || 0) !== SPONSOR_PAGE_CACHE_VERSION) return fallback;
    const persistBundleDraft = typeof parsed.persistBundleDraft === 'boolean'
      ? parsed.persistBundleDraft
      : typeof parsed.persistBundleSecrets === 'boolean'
        ? parsed.persistBundleSecrets
        : fallback.persistBundleDraft;
    const expiresAtRaw = toStr(parsed.expiresAt || '').trim();
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    return {
      persistBundleDraft,
      bundleForm: persistBundleDraft ? normalizeSponsorBundleDraftForm(parsed.bundleForm) : buildEmptyBundleForm(),
      expiresAt: expiresAt instanceof Date && Number.isFinite(expiresAt.getTime()) ? expiresAt : null,
    };
  } catch (_) {
    return fallback;
  }
};
const writeSponsorPageCache = ({
  persistBundleDraft = DEFAULT_REMEMBER_SPONSOR_DRAFT,
  bundleForm = {},
  expiresAt = null,
}: any = {}) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SPONSOR_PAGE_CACHE_KEY, JSON.stringify({
      v: SPONSOR_PAGE_CACHE_VERSION,
      persistBundleDraft: !!persistBundleDraft,
      persistBundleSecrets: false,
      bundleForm: persistBundleDraft ? normalizeSponsorBundleDraftForm(bundleForm) : {},
      expiresAt: persistBundleDraft && expiresAt instanceof Date && Number.isFinite(expiresAt.getTime())
        ? expiresAt.toISOString()
        : '',
    }));
  } catch (_) {}
};
const getCurrentOrigin = () => (
  typeof window !== 'undefined' && window.location
    ? toStr(window.location.origin).trim()
    : ''
);
const buildSponsorGrantCorsMessage = (workerBase: any, detail: any = '') => {
  const origin = getCurrentOrigin() || '<current-origin>';
  const worker = toStr(workerBase).trim() || 'sponsoring worker';
  const suffix = detail ? ` (${detail})` : '';
  return `Sponsored grant request could not reach ${worker}${suffix}. This is usually CORS or worker availability; ensure ${origin} is in that worker session's allowOrigins and retry.`;
};
const normalizeSponsorGrantErrorMessage = ({
  error,
  workerBase,
  responseStatus = 0,
  responseError = '',
}: any = {}) => {
  const raw = toStr(error?.message || error).trim();
  const lowered = raw.toLowerCase();
  const detail = toStr(responseError).trim();
  const detailLower = detail.toLowerCase();
  if ((Number(responseStatus || 0) === 403 && detailLower.includes('origin')) || detailLower.includes('origin not allowed')) {
    return buildSponsorGrantCorsMessage(workerBase, detail || 'Origin not allowed');
  }
  if (lowered.includes('origin not allowed')) {
    return buildSponsorGrantCorsMessage(workerBase, raw);
  }
  if (lowered.includes('failed to fetch') || lowered.includes('networkerror')) {
    return buildSponsorGrantCorsMessage(workerBase);
  }
  if (raw) return raw;
  if (Number(responseStatus || 0) > 0) {
    return `Failed to issue sponsored bootstrap grants (${responseStatus}).`;
  }
  return 'Failed to issue sponsored bootstrap grants.';
};

const SPONSORED_FIELD_GROUPS = Object.freeze([
  {
    key: 'ai',
    label: 'AI',
    fields: [
      { key: 'openaiKey', label: 'OpenAI key', type: 'password', placeholder: 'sk-...' },
      { key: 'anthropicKey', label: 'Anthropic key', type: 'password', placeholder: 'sk-ant-...' },
      { key: 'openrouterKey', label: 'OpenRouter key', type: 'password', placeholder: 'sk-or-...' },
    ],
  },
  {
    key: 'arweave',
    label: 'Arweave',
    fields: [
      { key: 'arweaveJwk', label: 'Arweave JWK', type: 'textarea', rows: 5, placeholder: '{ "kty": "RSA", ... }' },
    ],
  },
  {
    key: 'faucet',
    label: 'Faucet',
    fields: [
      { key: 'faucetPrivateKey', label: 'Faucet private key', type: 'password', placeholder: '0x...' },
    ],
  },
  {
    key: 'rpc',
    label: 'RPC',
    fields: [
      // Intentionally omit customRpcKey until sponsored bundles support PATH auth.
      { key: 'customRpcUrl', label: 'Custom RPC URL', type: 'text', placeholder: 'https://...' },
    ],
  },
  {
    key: 'lit',
    label: 'Lit',
    notice: 'Account API keys are authority for bundle-owned Lit accounts. Usage API keys are scoped runtime secrets. Group, PKP, and Lit Action identifiers are operational config.',
    fields: [
      { key: 'litApiBase', label: 'Lit API base', type: 'text', placeholder: 'https://api.chipotle.litprotocol.com' },
      { key: 'litGroupId', label: 'Lit group ID', type: 'text', placeholder: 'group_...' },
      { key: 'litPkpId', label: 'Lit PKP ID', type: 'text', placeholder: 'pkp_...' },
      { key: 'litActionCid', label: 'Lit Action CID', type: 'text', placeholder: 'bafy...' },
      { key: 'litAccountApiKey', label: 'Lit account API key', type: 'password', placeholder: 'lit-account-...' },
      { key: 'litUsageApiKey', label: 'Lit usage API key', type: 'password', placeholder: 'lit-usage-...' },
    ],
  },
  {
    key: 'deploy',
    label: 'Deploy (sponsoring session)',
    notice: 'Issue one-time deploy grants through the selected sponsoring session worker instead of writing raw deploy credentials into the bundle.',
    fields: [
      { key: 'cloudflareApiToken', label: 'Cloudflare API token', type: 'password', placeholder: 'cf-...' },
    ],
  },
]);

const SponsorPage = ({
  account,
  provider,
  network,
  toggleLoginModal,
  initialSessionId,
  initialRegistryChainId,
}: any) => {
  const initialCacheRef = useRef<any>(null);
  if (!initialCacheRef.current) {
    initialCacheRef.current = readSponsorPageCache();
  }
  const initialCache = initialCacheRef.current;
  const [sessions, setSessions] = useState<any>([]);
  const [selectedSlug, setSelectedSlug] = useState<any>('');
  const [ignoreRequestedSession, setIgnoreRequestedSession] = useState<any>(false);
  const [sessionLookupStatus, setSessionLookupStatus] = useState<any>('');
  const [sessionsRefreshStatus, setSessionsRefreshStatus] = useState<any>('');
  const [sessionsRefreshBusy, setSessionsRefreshBusy] = useState<any>(false);
  const [workerUrl, setWorkerUrl] = useState<any>('');
  const [workerUrlEditable, setWorkerUrlEditable] = useState<any>(false);
  const [persistBundleDraft, setPersistBundleDraft] = useState<any>(initialCache.persistBundleDraft);
  const [bundleForm, setBundleForm] = useState<any>(initialCache.bundleForm);
  const [expiresAt, setExpiresAt] = useState<any>(initialCache.expiresAt);
  const [createBusy, setCreateBusy] = useState<any>(false);
  const [createStatus, setCreateStatus] = useState<any>('');
  const [shareUrl, setShareUrl] = useState<any>('');
  const [shareTxId, setShareTxId] = useState<any>('');
  const shareTxUrl = shareTxId
    ? (() => {
        const normalized = adminArweavePort.normalizeArweaveUrl(shareTxId);
        return normalized === shareTxId ? `https://ar-io.dev/${shareTxId}` : normalized;
      })()
    : '';
  const [workerUrlOverrideDirty, setWorkerUrlOverrideDirty] = useState<any>(false);
  const requestedFetchKeyRef = useRef<any>('');
  const requestedAutoRefreshKeyRef = useRef<any>('');
  const prevSelectedSlugRef = useRef<any>('');
  const workerUrlOverrideDirtyRef = useRef<any>(false);
  const createRequestSeqRef = useRef(0);
  const requestedSessionRaw = toStr(initialSessionId).trim();
  const requestedSessionIdHex = sessionRegistryReadsPort.normalizeSessionIdHex(requestedSessionRaw);
  const requestedSessionSlug = requestedSessionIdHex ? '' : normalizeSlug(requestedSessionRaw);
  const requestedChainId = parseChainIdInput(initialRegistryChainId) || null;

  useEffect(() => {
    setIgnoreRequestedSession(false);
  }, [requestedSessionRaw, requestedChainId]);

  useEffect(() => {
    writeSponsorPageCache({
      persistBundleDraft,
      bundleForm,
      expiresAt,
    });
  }, [persistBundleDraft, bundleForm, expiresAt]);

  const syncSessionsFromRegistryCache = useCallback(({ isCancelled }: any = {}) => {
    const cached = sessionRegistryReadsPort.getAllSessionEntries();
    const nextSessions = Array.isArray(cached) ? cached : [];
    if (typeof isCancelled === 'function' && isCancelled()) return nextSessions;
    setSessions(nextSessions);
    return nextSessions;
  }, []);

  const loadSessions = useCallback(async ({ forceOnChain, isCancelled }: any = {}) => {
    const cached = syncSessionsFromRegistryCache({ isCancelled });

    const chainIds = requestedChainId ? [requestedChainId] : undefined;
    const shouldForceRegistryRead = !USE_ONCHAIN_SESSION_REGISTRY || !!forceOnChain;
    const runRegistryLoad = async (bootstrapRpc: any) => {
      try {
        return await sessionRegistryReadsPort.loadSessionRegistryCache({
          ...(chainIds ? { chainIds } : {}),
          force: shouldForceRegistryRead,
          providerLike: null,
          account: '',
          lit: null,
          bootstrapRpc,
        });
      } catch (error) {
        return { __error: error };
      }
    };

    const primaryResult: any = await runRegistryLoad(true);
    let refreshed = syncSessionsFromRegistryCache({ isCancelled });
    if (typeof isCancelled === 'function' && isCancelled()) return refreshed;
    const primaryCount = countSessionsForChain(refreshed, requestedChainId);
    const primaryLoadHadErrors = (
      !!primaryResult?.__error ||
      primaryResult?.__loadMeta?.hadLoadErrors === true
    );
    const shouldRetryWithDefaultRpc = primaryCount <= 0 || primaryLoadHadErrors;
    if (shouldRetryWithDefaultRpc) {
      await runRegistryLoad(false);
      refreshed = syncSessionsFromRegistryCache({ isCancelled });
    }
    return refreshed;
  }, [requestedChainId, syncSessionsFromRegistryCache]);

  const handleRefreshSessions = useCallback(async () => {
    setSessionsRefreshBusy(true);
    setSessionsRefreshStatus('Refreshing sessions…');
    try {
      requestedFetchKeyRef.current = '';
      await loadSessions({ forceOnChain: true });
      if (!ignoreRequestedSession && requestedSessionRaw && requestedChainId) {
        const config = await sessionRegistryReadsPort.fetchSessionFromRegistry({
          chainId: requestedChainId,
          sessionId: requestedSessionIdHex || '',
          slug: requestedSessionSlug || '',
          providerLike: null,
          account: '',
          lit: null,
          bootstrapRpc: true,
        });
        if (config) {
          sessionRegistryReadsPort.upsertSessionRegistryCache({ config });
          const refreshed = sessionRegistryReadsPort.getAllSessionEntries();
          setSessions(refreshed || []);
          setSelectedSlug(normalizeSlug((config as any).slug));
        }
      }
      setSessionsRefreshStatus('Session list updated.');
    } catch (error) {
      setSessionsRefreshStatus(getErrorMessage(error, 'Failed to refresh sessions.'));
    } finally {
      setSessionsRefreshBusy(false);
    }
  }, [
    ignoreRequestedSession,
    loadSessions,
    requestedChainId,
    requestedSessionIdHex,
    requestedSessionRaw,
    requestedSessionSlug,
  ]);

  useEffect(() => {
    let cancelled = false;
    loadSessions({ isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadSessions]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const handleRegistryCacheUpdated = () => {
      syncSessionsFromRegistryCache();
    };
    return sessionRegistryReadsPort.subscribeToCacheUpdates(window, handleRegistryCacheUpdated);
  }, [syncSessionsFromRegistryCache]);

  const sessionsForChain = useMemo(() => {
    if (!requestedChainId) return sessions || [];
    return (sessions || []).filter(([, cfg]: any) => {
      const chainId = Number(cfg?.__registry?.registryChainId || cfg?.__registry?.chainId || 0) || 0;
      return chainId === requestedChainId;
    });
  }, [sessions, requestedChainId]);

  const requestedSessionMatch = useMemo(() => {
    if (!requestedSessionRaw) return null;
    if (requestedSessionIdHex) {
      return sessionsForChain.find(([, cfg]: any) => {
        const cfgId = sessionRegistryReadsPort.normalizeSessionIdHex(cfg?.__registry?.sessionIdHex || cfg?.sessionId);
        return cfgId && cfgId === requestedSessionIdHex;
      }) || null;
    }
    return sessionsForChain.find(([slug]: any) => slug === requestedSessionSlug) || null;
  }, [requestedSessionIdHex, requestedSessionRaw, requestedSessionSlug, sessionsForChain]);

  useEffect(() => {
    if (!requestedSessionRaw || ignoreRequestedSession) return;
    const autoRefreshKey = `${requestedChainId || 'default'}:${requestedSessionRaw}`;
    if (requestedAutoRefreshKeyRef.current === autoRefreshKey) return;
    requestedAutoRefreshKeyRef.current = autoRefreshKey;
    const timeoutId = setTimeout(() => {
      handleRefreshSessions();
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [
    handleRefreshSessions,
    ignoreRequestedSession,
    requestedChainId,
    requestedSessionRaw,
  ]);

  useEffect(() => {
    if (!sessionsForChain.length) {
      setSelectedSlug('');
      setSessionLookupStatus('');
      return;
    }
    if (requestedSessionRaw && !ignoreRequestedSession) {
      if (requestedSessionMatch) {
        setSelectedSlug(requestedSessionMatch[0]);
        setSessionLookupStatus('');
        return;
      }
      if (!requestedChainId) {
        const label = requestedSessionIdHex ? 'sessionId' : 'slug';
        const chainLabel = requestedChainId || 'default';
        setSessionLookupStatus(`Session not found for ${label} on chain ${chainLabel}: ${requestedSessionRaw}`);
        return;
      }
      return;
    }
    if (!selectedSlug) {
      setSelectedSlug(sessionsForChain[0][0] || '');
      return;
    }
    const hasSelected = sessionsForChain.some(([slug]: any) => slug === selectedSlug);
    if (!hasSelected) setSelectedSlug(sessionsForChain[0][0] || '');
  }, [
    ignoreRequestedSession,
    requestedChainId,
    requestedSessionIdHex,
    requestedSessionMatch,
    requestedSessionRaw,
    selectedSlug,
    sessionsForChain,
  ]);

  useEffect(() => {
    if (!requestedSessionRaw || !requestedChainId || ignoreRequestedSession || requestedSessionMatch) return;
    const lookupKey = `${requestedChainId}:${requestedSessionRaw}`;
    if (requestedFetchKeyRef.current === lookupKey) return;
    requestedFetchKeyRef.current = lookupKey;
    let cancelled = false;
    const run = async () => {
      setSessionLookupStatus(`Fetching session from chain ${requestedChainId}…`);
      try {
        const config = await sessionRegistryReadsPort.fetchSessionFromRegistry({
          chainId: requestedChainId,
          sessionId: requestedSessionIdHex || '',
          slug: requestedSessionSlug || '',
          providerLike: null,
          account: '',
          lit: null,
          bootstrapRpc: true,
        });
        if (!config) {
          throw new Error(`Session not found on chain ${requestedChainId}: ${requestedSessionRaw}`);
        }
        sessionRegistryReadsPort.upsertSessionRegistryCache({ config });
        const refreshed = sessionRegistryReadsPort.getAllSessionEntries();
        if (cancelled) return;
        setSessions(refreshed || []);
        setSelectedSlug(normalizeSlug((config as any).slug));
        setSessionLookupStatus('');
      } catch (error) {
        if (!cancelled) {
          const message = getErrorMessage(error, `Session not found on chain ${requestedChainId}: ${requestedSessionRaw}`);
          setSessionLookupStatus(message);
          notify.error(message);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    ignoreRequestedSession,
    requestedChainId,
    requestedSessionIdHex,
    requestedSessionMatch,
    requestedSessionRaw,
    requestedSessionSlug,
  ]);

  const selectedConfig = useMemo(() => {
    const match = sessionsForChain.find(([slug]: any) => slug === selectedSlug);
    return match ? match[1] : null;
  }, [selectedSlug, sessionsForChain]);
  const relevantSessionChainId = useMemo(() => (
    Number(selectedConfig?.networkChainId || selectedConfig?.__registry?.chainId || network?.id || 0) || 0
  ), [network?.id, selectedConfig]);
  const selectedConfigWorkerUrl = useMemo(() => (
    adminWorkerPorts.workerUrl.normalizeWorkerUrl(getUsableSessionWorkerUrl({
      slug: selectedSlug,
      sessionConfig: selectedConfig,
      allowSharedFallback: true,
    }))
  ), [selectedConfig, selectedSlug]);
  const selectedSessionHasUsableWorker = useMemo(() => (
    hasUsableSessionWorkerConfig({
      slug: selectedSlug,
      sessionConfig: selectedConfig,
      allowSharedFallback: true,
    })
  ), [selectedConfig, selectedSlug]);
  const normalizedEnteredWorkerUrl = useMemo(() => adminWorkerPorts.workerUrl.normalizeWorkerUrl(workerUrl), [workerUrl]);
  const hasManualWorkerUrlOverride = workerUrlOverrideDirty && !!normalizedEnteredWorkerUrl;
  const deploySponsoringWorkerUrl = normalizedEnteredWorkerUrl || selectedConfigWorkerUrl || '';
  const accountLower = toStr(account || '').toLowerCase();
  const selectedConfigCreateSignature = useMemo(
    () => buildCreateConfigSignature(selectedConfig),
    [selectedConfig]
  );
  const createContextKey = useMemo(() => [
    normalizeSlug(selectedSlug),
    accountLower,
    String(relevantSessionChainId || ''),
    deploySponsoringWorkerUrl,
    selectedConfigCreateSignature,
  ].join('|'), [
    accountLower,
    deploySponsoringWorkerUrl,
    relevantSessionChainId,
    selectedConfigCreateSignature,
    selectedSlug,
  ]);
  const activeCreateContextKeyRef = useRef(createContextKey);
  activeCreateContextKeyRef.current = createContextKey;
  const selectedSessionSupportsEmbeddedDeploy = useMemo(() => (
    selectedConfig?.embeddedDeployHelperEnabled !== false
  ), [selectedConfig]);
  const canCreateSponsoredUrl = !!selectedConfig && (
    selectedSessionHasUsableWorker || hasManualWorkerUrlOverride
  );

  useEffect(() => {
    createRequestSeqRef.current += 1;
    setCreateBusy(false);
    setCreateStatus('');
    setShareUrl('');
    setShareTxId('');
  }, [createContextKey]);

  useEffect(() => {
    if (prevSelectedSlugRef.current === selectedSlug) return;
    prevSelectedSlugRef.current = selectedSlug;
    workerUrlOverrideDirtyRef.current = false;
    setWorkerUrlOverrideDirty(false);
    setWorkerUrlEditable(false);
    setCreateStatus('');
    setShareUrl('');
    setShareTxId('');
  }, [selectedSlug]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedConfig) {
        setWorkerUrl('');
        return;
      }
      if (!workerUrlOverrideDirtyRef.current) {
        setWorkerUrl(selectedConfigWorkerUrl);
      }
      let resolved;
      try {
        resolved = await adminWorkerPorts.workerUrl.resolveCorsProxyUrl({
          sessionSlug: selectedSlug,
          sessionConfig: selectedConfig,
          context: { account: '', providerLike: null },
        });
      } catch (error) {
        if (!cancelled && !workerUrlOverrideDirtyRef.current) {
          setWorkerUrl('');
        }
        return;
      }
      if (cancelled || workerUrlOverrideDirtyRef.current) return;
      const resolvedUrl = adminWorkerPorts.workerUrl.normalizeWorkerUrl(resolved?.url || '');
      setWorkerUrl(resolvedUrl);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedConfig, selectedConfigWorkerUrl, selectedSlug]);

  const adminAddress = toStr(selectedConfig?.__registry?.adminAddress || selectedConfig?.adminAddress).toLowerCase();
  const hasRegistryEntry = !!selectedConfig?.__registry?.registryChainId || !!selectedConfig?.__registry?.adminAddress;
  // Sponsor uploads intentionally only support direct `adminAddress` sessions today.
  // Future admin auth models can be added here once they are actually implemented
  // end-to-end in the product UI and setup flows.
  const missingSupportedAdminConfig = !adminAddress;
  const isAdminForSelected = !!accountLower && !!adminAddress && adminAddress === accountLower;
  const canAdmin = !!account && !!selectedConfig && !missingSupportedAdminConfig && isAdminForSelected && hasRegistryEntry;

  const updateBundleField = useCallback((key: any, value: any) => {
    setBundleForm((prev: any) => ({ ...prev, [key]: value }));
  }, []);

  const buildBootstrapUploadAuth = useCallback(async ({ workerUrl: overrideWorkerUrl }: any = {}) => {
    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect a wallet to sign admin requests.');
    }
    const slug = normalizeSlug(selectedSlug);
    const baseUrl = adminWorkerPorts.workerUrl.normalizeWorkerUrl(overrideWorkerUrl || workerUrl || selectedConfigWorkerUrl);
    if (!baseUrl) throw new Error('Worker URL is missing.');
    const chainId = Number(selectedConfig?.__registry?.chainId || selectedConfig?.networkChainId || network?.id || 1) || 1;
    return adminWorkerPorts.adminAuth.buildSignedBootstrapAdminAuth({
      slug,
      workerUrl: baseUrl,
      statement: 'Admin request: bootstrap arweave upload',
      context: {
        account,
        chainId,
        providerLike: typeof provider === 'string' ? provider : undefined,
      },
    });
  }, [account, network?.id, provider, selectedConfig, selectedConfigWorkerUrl, selectedSlug, toggleLoginModal, workerUrl]);

  const buildGrantIssueAuth = useCallback(async ({ workerUrl: overrideWorkerUrl, body }: any = {}) => {
    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect a wallet to sign admin requests.');
    }
    const slug = normalizeSlug(selectedSlug);
    const baseUrl = adminWorkerPorts.workerUrl.normalizeWorkerUrl(overrideWorkerUrl || workerUrl || selectedConfigWorkerUrl);
    if (!baseUrl) throw new Error('Worker URL is missing.');
    const chainId = Number(selectedConfig?.__registry?.chainId || selectedConfig?.networkChainId || network?.id || 1) || 1;
    return adminWorkerPorts.adminAuth.buildSignedAdminActionAuth({
      action: 'issue-sponsored-grants',
      slug,
      body,
      workerUrl: baseUrl,
      context: {
        account,
        chainId,
        providerLike: typeof provider === 'string' ? provider : undefined,
      },
    });
  }, [account, network?.id, provider, selectedConfig, selectedConfigWorkerUrl, selectedSlug, toggleLoginModal, workerUrl]);

  const handleCreateSponsoredUrl = useCallback(async () => {
    const requestSeq = createRequestSeqRef.current + 1;
    createRequestSeqRef.current = requestSeq;
    const requestContextKey = activeCreateContextKeyRef.current;
    const isCurrentCreateRequest = () => (
      createRequestSeqRef.current === requestSeq &&
      activeCreateContextKeyRef.current === requestContextKey
    );
    const setCreateStatusIfCurrent = (nextStatus: string) => {
      if (isCurrentCreateRequest()) setCreateStatus(nextStatus);
    };

    setCreateBusy(true);
    setCreateStatus('');
    setShareUrl('');
    setShareTxId('');
    try {
      if (!selectedConfig) throw new Error('Select a session.');
      if (missingSupportedAdminConfig) {
        throw new Error('Sponsored uploads currently require a session with a direct adminAddress.');
      }
      if (!canAdmin) throw new Error('Connect the admin wallet for the selected session.');
      const label = toStr(bundleForm.label).trim();
      if (!label) throw new Error('Label is required.');
      const resolvedWorkerUrl = adminWorkerPorts.workerUrl.normalizeWorkerUrl(workerUrl || selectedConfigWorkerUrl);
      if (!resolvedWorkerUrl) throw new Error('Worker URL is missing.');
      const normalizedExpiry = normalizeExpiryToIso(expiresAt);
      const cloudflareApiToken = toStr(bundleForm.cloudflareApiToken).trim();

      const grantRequest = {
        bootstrapWorkerUrl: resolvedWorkerUrl,
        ...(normalizedExpiry ? { expiresAt: normalizedExpiry } : {}),
        ...(cloudflareApiToken
          ? {
              deploy: {
                cloudflareApiToken,
              },
            }
          : {}),
        ...(toStr(bundleForm.faucetPrivateKey).trim()
          ? {
              faucet: {
                faucetPrivateKey: toStr(bundleForm.faucetPrivateKey).trim(),
              },
            }
          : {}),
      };
      let deployGrantToken = '';
      let faucetGrantToken = '';
      let resolvedGrantWorkerUrl = resolvedWorkerUrl;
      if (grantRequest.deploy || grantRequest.faucet) {
        setCreateStatusIfCurrent('Issuing sponsored bootstrap grants…');
        const grantRequestBody = {
          sessionSlug: selectedSlug,
          grantRequest,
        };
        const grantAuth = await buildGrantIssueAuth({
          workerUrl: resolvedWorkerUrl,
          body: grantRequestBody,
        });
        if (!isCurrentCreateRequest()) return;
        let grantResponse;
        try {
          grantResponse = await fetch(`${resolvedWorkerUrl}/admin/issue-sponsored-grants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...grantRequestBody,
              ...grantAuth,
            }),
          });
        } catch (error) {
          throw new Error(normalizeSponsorGrantErrorMessage({
            error,
            workerBase: resolvedWorkerUrl,
          }));
        }
        if (!isCurrentCreateRequest()) return;
        const grantData = await grantResponse.json().catch(() => ({}));
        if (!isCurrentCreateRequest()) return;
        if (!grantResponse.ok) {
          throw new Error(normalizeSponsorGrantErrorMessage({
            error: grantData?.error || `Failed to issue sponsored bootstrap grants (${grantResponse.status}).`,
            workerBase: resolvedWorkerUrl,
            responseStatus: grantResponse.status,
            responseError: grantData?.error || '',
          }));
        }
        deployGrantToken = toStr(grantData?.deployGrantToken).trim();
        faucetGrantToken = toStr(grantData?.faucetGrantToken).trim();
        resolvedGrantWorkerUrl = adminWorkerPorts.workerUrl.normalizeWorkerUrl(grantData?.bootstrapWorkerUrl || resolvedWorkerUrl);
        if (grantRequest.deploy && !deployGrantToken) {
          throw new Error('Sponsored deploy grant issuance did not return a deploy token.');
        }
        if (grantRequest.faucet && !faucetGrantToken) {
          throw new Error('Sponsored faucet grant issuance did not return a faucet token.');
        }
      }

      const sponsoredBundlePayload = sponsoredBundlePort.buildSponsoredBundlePlaintext({
        openaiKey: bundleForm.openaiKey,
        anthropicKey: bundleForm.anthropicKey,
        openrouterKey: bundleForm.openrouterKey,
        arweaveJwk: bundleForm.arweaveJwk,
        faucetPrivateKey: bundleForm.faucetPrivateKey,
        customRpcUrl: bundleForm.customRpcUrl,
        litApiBase: bundleForm.litApiBase,
        litGroupId: bundleForm.litGroupId,
        litPkpId: bundleForm.litPkpId,
        litActionCid: bundleForm.litActionCid,
        litAccountApiKey: bundleForm.litAccountApiKey,
        litUsageApiKey: bundleForm.litUsageApiKey,
        bootstrapWorkerUrl: resolvedGrantWorkerUrl,
        deployGrantToken,
        faucetGrantToken,
        meta: {
          sourceSessionSlug: selectedSlug,
          sourceWorkerUrl: resolvedWorkerUrl,
        },
      });
      if (!sponsoredBundlePort.hasSponsoredBundleFields(sponsoredBundlePayload)) {
        throw new Error('Add at least one sponsored credential before creating a URL.');
      }

      const secret = sponsoredBundlePort.generateSponsoredBundleSecret();
      setCreateStatusIfCurrent('Uploading sponsored bundle…');

      const adminAuth = await buildBootstrapUploadAuth({ workerUrl: resolvedWorkerUrl });
      if (!isCurrentCreateRequest()) return;
      const result = await sponsoredBundlePort.uploadSponsoredBundle({
        secret,
        label,
        expiresAt: normalizedExpiry,
        createdBy: account,
        arweaveJwk: toStr(bundleForm.arweaveJwk).trim(),
        workerUrl: resolvedWorkerUrl,
        sessionSlug: selectedSlug,
        sessionConfig: selectedConfig,
        context: {
          account,
          providerLike: provider,
          chainId: relevantSessionChainId || network?.id || 0,
        },
        adminAuth,
        skipAuth: true,
        bundle: sponsoredBundlePayload,
      });
      if (!isCurrentCreateRequest()) return;
      setShareUrl(result.url);
      setShareTxId(result.txId);
      setCreateStatus('Sponsored URL ready.');
    } catch (error) {
      if (isCurrentCreateRequest()) {
        setCreateStatus(getErrorMessage(error, 'Failed to create sponsored URL.'));
      }
    } finally {
      if (isCurrentCreateRequest()) setCreateBusy(false);
    }
  }, [
    account,
    bundleForm,
    canAdmin,
    expiresAt,
    buildGrantIssueAuth,
    missingSupportedAdminConfig,
    network?.id,
    provider,
    relevantSessionChainId,
    selectedConfig,
    selectedConfigWorkerUrl,
    selectedSlug,
    buildBootstrapUploadAuth,
    workerUrl,
  ]);

  const handleCopy = useCallback(async (value: any, successLabel: any) => {
    const text = toStr(value).trim();
    if (!text || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      notify.success(successLabel);
    } catch (_) {}
  }, []);

  return (
    <div className={styles.adminPage}>
      <header className={`${styles.hero} ${styles.heroNoMedia}`}>
        <div className={styles.heroContent}>
          <div className={styles.heroTopRow}>
            <div className={styles.heroTitleBlock}>
              <div className={styles.heroTitleRow}>
                <h1>Sponsor Session URL</h1>
              </div>
              <div className={styles.subtitle}>
                Create a one-click setup link for future session creation.
              </div>
            </div>
            {account ? (
              <div className={`${styles.connectionBadge} ${styles.connectionBadgeActive}`}>
                Connected · {shortAddress(account)}
              </div>
            ) : (
              <div className={`${styles.connectionBadge} ${styles.connectionBadgeIdle}`}>
                Connect an admin wallet to sign uploads
              </div>
            )}
          </div>
          <div className={styles.heroStats}>
            <div className={`${styles.heroStat} ${styles.heroStatReady}`}>
              <div className={styles.heroSessionPrimaryRow}>
                <div className={styles.heroCardHeaderWithTooltip}>
                  <span className={styles.heroSessionDetailLabel}>Session</span>
                </div>
                <div className={styles.heroSessionPrimaryBody}>
                  {sessionsForChain.length ? (
                    <Input
                      type="select"
                      value={selectedSlug}
                      className={styles.heroCardSelect}
                      data-testid={E2E_TESTIDS.ADMIN_SESSION_SELECT}
                      onChange={(e: any) => {
                        setIgnoreRequestedSession(true);
                        setSelectedSlug(e.target.value);
                      }}
                    >
                      {!selectedSlug && requestedSessionRaw ? (
                        <option value="" disabled>
                          Requested: {requestedSessionRaw}
                        </option>
                      ) : null}
                      {sessionsForChain.map(([slug, cfg]: any) => (
                        <option key={slug || 'general'} value={slug}>
                          {toStr(cfg?.sessionName || slug || 'General session').trim() || 'Untitled session'}
                        </option>
                      ))}
                    </Input>
                  ) : (
                    <div className={styles.heroStatValue}>No sessions found.</div>
                  )}
                </div>
                <Button
                  size="sm"
                  color="secondary"
                  outline
                  className={styles.actionButton}
                  onClick={handleRefreshSessions}
                  disabled={sessionsRefreshBusy}
                >
                  {sessionsRefreshBusy ? 'Refreshing…' : 'Refresh sessions'}
                </Button>
              </div>
            </div>
          </div>
          <div className={styles.heroStatusStack}>
            {sessionLookupStatus ? <div className={styles.warningNote}>{sessionLookupStatus}</div> : null}
            {sessionsRefreshStatus ? <div className={styles.statusNote}>{sessionsRefreshStatus}</div> : null}
            {!canCreateSponsoredUrl && selectedConfig ? (
              <div className={styles.warningNote}>Select a session with a usable worker-backed config before creating a sponsored link.</div>
            ) : null}
            {selectedConfig && missingSupportedAdminConfig ? (
              <div className={styles.warningNote}>Sponsor uploads currently require a session with a direct `adminAddress`.</div>
            ) : null}
            {selectedConfig && !missingSupportedAdminConfig && !canAdmin && account ? (
              <div className={styles.warningNote}>Connected wallet is not the admin for the selected session.</div>
            ) : null}
            {selectedConfig && deploySponsoringWorkerUrl && selectedSessionSupportsEmbeddedDeploy === false ? (
              <div className={styles.warningNote}>
                Deploy grants are unavailable until embedded deploy-helper is enabled on the sponsoring session worker.
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={styles.sectionStack}>
        <section className={`${styles.panel} ${styles.secretsPanel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <div className={styles.panelTitle}>Sponsored bundle fields</div>
              <div className={styles.panelHint}>Paste credentials directly. This page never reads back worker KV secrets.</div>
              <Label className={styles.workerToggle}>
                <Input
                  type="checkbox"
                  checked={persistBundleDraft}
                  onChange={(e: any) => setPersistBundleDraft(!!e.target.checked)}
                />
                <span>Remember non-secret draft fields</span>
              </Label>
              <div className={styles.panelHint}>
                Stores only non-secret metadata such as label and expiry in localStorage. API keys, private keys, tokens, JWKs, and RPC URLs are never restored.
              </div>
            </div>
          </div>
          <div className={styles.secretOptionsGrid}>
            {SPONSORED_FIELD_GROUPS.map((group: any) => {
              const hasValue = group.fields.some((field: any) => toStr(bundleForm[field.key]).trim());
              return (
                <div key={group.key} className={`${styles.secretOptionCard} ${styles.activeOption}`}>
                  <div className={styles.secretOptionHeader}>
                    <FontAwesomeIcon icon={hasValue ? faLock : faLockOpen} style={{ opacity: hasValue ? 0.9 : 0.4, marginRight: 8 }} />
                    <span className={styles.secretOptionText}>
                      <span>{group.label}</span>
                      <span className={styles.secretOptionMeta}>{hasValue ? 'Ready to bundle' : 'Empty'}</span>
                    </span>
                  </div>
                  <div className={styles.secretOptionBody}>
                    {group.fields.map((field: any) => {
                      const isTextarea = field.type === 'textarea';
                      return (
                        <FormGroup key={field.key}>
                          <Label>{field.label}</Label>
                          <Input
                            type={isTextarea ? 'textarea' : field.type}
                            rows={isTextarea ? field.rows || 3 : undefined}
                            value={bundleForm[field.key]}
                            placeholder={field.placeholder || ''}
                            readOnly={field.readOnly === true}
                            onChange={(e: any) => updateBundleField(field.key, e.target.value)}
                          />
                        </FormGroup>
                      );
                    })}
                    {group.key === 'deploy' ? (
                      <div className={styles.statusNote}>
                        Uses sponsoring worker: {deploySponsoringWorkerUrl || 'Select a session with a usable worker URL.'}
                      </div>
                    ) : null}
                    {group.notice ? <div className={styles.warningNote}>{group.notice}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.metadataPanel}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <div className={styles.panelTitle}>Create share URL</div>
              <div className={styles.panelHint}>`txId` lives in the query string and the decrypt secret stays in `#k=` client-side only.</div>
            </div>
          </div>

          <FormGroup>
            <Label>Label</Label>
            <Input
              value={bundleForm.label}
              placeholder="Launch week sponsor bundle"
              onChange={(e: any) => updateBundleField('label', e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>Expiry</Label>
            <CEDateTimeInput
              data-testid="ce-sponsor-expiry-input"
              selected={expiresAt}
              onChange={(date: any) => setExpiresAt(date)}
              minDate={new Date()}
              isClearable
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="time"
              dateFormat="MMMM d, yyyy h:mm aa"
              placeholderText="No expiry"
              className={`form-control ${styles.sponsorDatePickerInput}`}
            />
            <div className={styles.panelHint}>
              Optional. If set, the wizard rejects the link after this date and time.
            </div>
          </FormGroup>

          {canAdmin ? (
            <div className={styles.heroCardActionRow}>
              <Button
                type="button"
                size="sm"
                color="secondary"
                outline
                className={styles.actionButton}
                onClick={() => setWorkerUrlEditable((prev: any) => !prev)}
                data-testid={E2E_TESTIDS.SPONSOR_WORKER_URL_TOGGLE}
              >
                {workerUrlEditable ? 'Hide upload worker' : 'Edit upload worker URL'}
              </Button>
            </div>
          ) : null}

          {workerUrlEditable ? (
            <div className={styles.heroCardInputShell}>
              <Input
                value={workerUrl}
                placeholder="https://<worker-name>.<account-subdomain>.workers.dev/"
                className={styles.heroCardInput}
                readOnly={!workerUrlEditable}
                data-testid={E2E_TESTIDS.SPONSOR_WORKER_URL}
                onChange={workerUrlEditable ? (e: any) => {
                  workerUrlOverrideDirtyRef.current = true;
                  setWorkerUrlOverrideDirty(true);
                  setWorkerUrl(e.target.value);
                } : undefined}
              />
              <div className={styles.heroCardInputActions}>
                <button
                  type="button"
                  className={`${styles.heroCardInputActionButton} ${styles.heroCardInputIconButton}`}
                  onClick={() => handleCopy(workerUrl, 'Copied worker URL')}
                  title="Copy worker URL"
                  aria-label="Copy worker URL"
                  disabled={!workerUrl}
                >
                  <FontAwesomeIcon icon={faClipboard} />
                </button>
                <button
                  type="button"
                  className={`${styles.heroCardInputActionButton} ${styles.heroCardInputIconButton}`}
                  onClick={() => setWorkerUrlEditable(false)}
                  title="Lock worker URL"
                  aria-label="Lock worker URL"
                >
                  <FontAwesomeIcon icon={faPen} />
                </button>
              </div>
            </div>
          ) : null}

          <Button
            color="primary"
            className={styles.actionButton}
            onClick={handleCreateSponsoredUrl}
            disabled={createBusy || !canCreateSponsoredUrl}
            data-testid={E2E_TESTIDS.SPONSOR_CREATE}
          >
            {createBusy ? 'Creating…' : 'Create sponsored URL'}
          </Button>

          {createStatus ? (
            <div className={styles.statusNote} data-testid={E2E_TESTIDS.SPONSOR_STATUS}>
              {createStatus}
            </div>
          ) : null}

          {shareUrl ? (
            <>
              <div className={styles.heroCardInputShell}>
                <Input
                  value={shareUrl}
                  readOnly
                  className={styles.heroCardInput}
                  aria-label="Sponsored share URL"
                  data-testid={E2E_TESTIDS.SPONSOR_SHARE_URL}
                />
                <div className={styles.heroCardInputActions}>
                  <button
                    type="button"
                    className={`${styles.heroCardInputActionButton} ${styles.heroCardInputIconButton}`}
                    onClick={() => handleCopy(shareUrl, 'Copied sponsored URL')}
                    title="Copy sponsored URL"
                    aria-label="Copy sponsored URL"
                  >
                    <FontAwesomeIcon icon={faClipboard} />
                  </button>
                </div>
              </div>
              {shareTxId ? (
                <div className={styles.statusNote} data-testid={E2E_TESTIDS.SPONSOR_TX_ID}>
                  Arweave tx:{' '}
                  <a href={shareTxUrl} target="_blank" rel="noreferrer">
                    {shareTxId}
                  </a>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default SponsorPage;
