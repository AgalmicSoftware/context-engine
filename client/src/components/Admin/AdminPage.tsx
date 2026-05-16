/** @file AdminPage.tsx */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Label, FormGroup, FormText } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faClipboard, faExternalLinkAlt, faLock, faLockOpen, faPen, faQuestionCircle, faSync, faTimes } from '@fortawesome/free-solid-svg-icons';
import { ethers } from 'ethers';
import styles from './AdminPage.module.scss';
import {
  USE_ONCHAIN_SESSION_REGISTRY,
} from '../../variables/appConfig.js';
import { getDefaultHttpRpc } from '../../variables/chains.js';
import { corsProxyUtils } from '../../utilities/worker/corsProxy.js';
import {
  buildSiweMessage,
  buildSignedAdminActionAuth,
  fetchWorkerWithAuth,
} from '../../utilities/worker/workerAuth.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import { encryptedFieldsUtils } from '../../utilities/crypto/encryptedFields.js';
import { normalizeOriginList } from '../../utilities/urlUtils.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { buildWorkerAllowOrigins } from '../../utilities/worker/workerCorsOrigins.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  loadSessionRegistryCache,
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  sessionRegistryStore,
  setSessionFieldsOnChain,
  setResourceGatesOnChain,
  fetchSessionFromRegistry,
  upsertSessionRegistryCache,
  uploadSessionMetadata,
  updateSessionMetadataOnChain,
  sessionRegistryUtils,
} from '../../utilities/web3/sessionRegistry.js';
import {
  buildSbtAccessControlConditions,
  getGlobalLitHooks,
  resolveLitChain,
} from '../../utilities/crypto/litProtocol.js';
import {
  getCachedSessionWorkerConfig,
  upsertCachedSessionWorkerConfig,
} from '../../utilities/session/sessionWorkerConfigCache.js';
import {
  getUsableSessionWorkerUrl,
  hasUsableSessionWorkerConfig,
} from '../../utilities/session/sessionWorkerAvailability.js';
import { buildSponsoredFlagFields as buildSponsoredSessionFlagFields } from '../../utilities/session/sponsoredFlags.js';
import { toStr } from '../../utilities/shared/primitives.js';
import AudioInput from '../Shared/AudioInput/AudioInput';
import SBTSelector from '../SBTs/SBTSelector';
import { JsonPanel } from '../Shared/Json/JsonControls';
import CETooltip from '../Shared/CETooltip';
import { createLogger } from '../../utilities/logging';
import { notify } from '../../utilities/ui/notify.js';
import {
  buildTxExplorerUrl,
  countSessionsForChain,
  getChainName,
  getErrorMessage,
  inferAiProviderFromModel,
  normalizeAiProvider,
  normalizeSlug,
  normalizeWorkerUrl,
} from './adminPageHelpers';
import {
  ADMIN_ACTION_NONCE_RETRY_ATTEMPTS,
  addSessionConfigHint,
  buildHealthAuthMismatchState,
  isRetryableAdminNonceFailure,
  normalizeAdminWorkerFetchError,
  shouldSeedWorkerConfigFromError,
  sleep,
} from './adminPageWorkerErrorHelpers';
import {
  buildUserPageUrl,
  formatAllowOriginsDraft,
  formatPreviewValue,
  parseAllowOriginsDraft,
} from './adminPageDraftFormattingHelpers';
import {
  buildSessionUrl,
  collectEncryptedEntries,
  getAdminSessionDisplayUrl,
  shortAddress,
} from './adminPageSessionDisplayHelpers';
import {
  dedupeSbtSelections,
  normalizeGateMode,
  resolveDefaultGateFromConfig,
} from './adminPageSbtGateSelectionHelpers';
import {
  buildWorkerSessionConfigPayload,
  getSessionReadRpcConfig,
} from './adminPageWorkerSessionConfigHelpers';
import {
  ADMIN_AI_PROVIDER_OPTIONS,
  ADMIN_EDITABLE_CONTRACT_KEY_SET,
  applyAdminMetadataDraft,
  buildAdminMetadataDraft,
  buildEditableSessionMetadataPayload,
  parseChainIdInput,
  resolveAutoFeatureBySessionSlug,
  shouldShowInlineResourceSummary,
} from './adminPageMetadataDraftHelpers';

const log = createLogger('general');
const renderTestResult = (entry: any) => {
  if (!entry) return 'Not run';
  if (typeof entry === 'string') return entry;
  const label = toStr(entry?.label || entry?.text).trim();
  const href = toStr(entry?.href).trim();
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label || 'View'}
      </a>
    );
  }
  return label || 'OK';
};

export const __adminPageTestUtils = {
  applyAdminMetadataDraft,
  buildAdminMetadataDraft,
  buildWorkerSessionConfigPayload,
  buildEditableSessionMetadataPayload,
  buildHealthAuthMismatchState,
  getAdminSessionDisplayUrl,
  getSessionReadRpcConfig,
};

const AdminPage = ({
  account,
  provider,
  network,
  toggleLoginModal,
  loginComplete,
  ensureLightSbtUniverse,
  initialSessionId,
  initialRegistryChainId,
}: any) => {
  const [sessions, setSessions] = useState<any>([]);
  const [selectedSlug, setSelectedSlug] = useState<any>('');
  const [ignoreRequestedSession, setIgnoreRequestedSession] = useState<any>(false);
  const [workerUrl, setWorkerUrl] = useState<any>('');
  const [workerUrlEditable, setWorkerUrlEditable] = useState<any>(false);
  const [workerStatus, setWorkerStatus] = useState<any>('');
  const [workerDebug, setWorkerDebug] = useState<any>('');
  const [corsPatchStatus, setCorsPatchStatus] = useState<any>('');
  const [corsPatchBusy, setCorsPatchBusy] = useState<any>(false);
  const [allowOriginsDraft, setAllowOriginsDraft] = useState<any>('');
  const [allowOriginsDraftDirty, setAllowOriginsDraftDirty] = useState<any>(false);
  const [showAllowlistEditor, setShowAllowlistEditor] = useState<any>(false);
  const [saveStatus, setSaveStatus] = useState<any>('');
  const [chainStatus, setChainStatus] = useState<any>('');
  const [testStatus, setTestStatus] = useState<any>('');
  const [testResults, setTestResults] = useState<any>({
    health: '',
    ai: '',
    arweave: '',
    faucet: '',
    transcribe: '',
  });
  const [testBusy, setTestBusy] = useState<any>(false);
  const [litTestValue, setLitTestValue] = useState<any>('lit-test');
  const [litTestEnvelope, setLitTestEnvelope] = useState<any>('');
  const [litTestDecrypted, setLitTestDecrypted] = useState<any>('');
  const [litTestStatus, setLitTestStatus] = useState<any>('');
  const [litTestBusy, setLitTestBusy] = useState<any>(false);
  const [deniedStatus, setDeniedStatus] = useState<any>('');
  const [deniedResults, setDeniedResults] = useState<any>({
    login: '',
    ai: '',
    arweave: '',
    transcribe: '',
    faucet: '',
  });
  const [deniedBusy, setDeniedBusy] = useState<any>(false);
  const [transcribeText, setTranscribeText] = useState<any>('');
  const [openSection, setOpenSection] = useState<any>('');
  const [showTestsPanel, setShowTestsPanel] = useState<any>(false);
  const [encryptedFields, setEncryptedFields] = useState<any>({});
  const [decryptedFields, setDecryptedFields] = useState<any>({});
  const [sessionLookupStatus, setSessionLookupStatus] = useState<any>('');
  const [sessionsRefreshStatus, setSessionsRefreshStatus] = useState<any>('');
  const [sessionsRefreshBusy, setSessionsRefreshBusy] = useState<any>(false);
  const [defaultGateTouched, setDefaultGateTouched] = useState<any>(false);
  const [gateConfigDirty, setGateConfigDirty] = useState<any>(false);
  const [metadataBlockLimitsDraft, setMetadataBlockLimitsDraft] = useState<any>({ start: '', end: '' });
  const [metadataDraftTouched, setMetadataDraftTouched] = useState<any>(false);
  const [metadataAutoFeatureDraft, setMetadataAutoFeatureDraft] = useState<any>(true);
  const [metadataAutoFeatureTouched, setMetadataAutoFeatureTouched] = useState<any>(false);
  const [metadataConfigDraft, setMetadataConfigDraft] = useState<any>(() => buildAdminMetadataDraft({}));
  const [metadataContractDraftTouched, setMetadataContractDraftTouched] = useState<any>(false);
  const [metadataContractsVerified, setMetadataContractsVerified] = useState<any>(false);
  const [metadataLatestBlock, setMetadataLatestBlock] = useState<any>(null);
  const [metadataLatestBlockStatus, setMetadataLatestBlockStatus] = useState<any>('');
  const [metadataUpdateBusy, setMetadataUpdateBusy] = useState<any>(false);
  const [metadataUpdateStatus, setMetadataUpdateStatus] = useState<any>('');
  const [copiedRawMetadataJson, setCopiedRawMetadataJson] = useState<any>(false);
  const [heroHeaderImageReady, setHeroHeaderImageReady] = useState<any>(false);
  const [defaultGateDraft, setDefaultGateDraft] = useState<any>({
    sbts: [],
    mode: 'any',
    chainId: '',
  });
  const [gateSyncStatus, setGateSyncStatus] = useState<any>('');
  const [gateSyncResult, setGateSyncResult] = useState<any>(null);
  const [gateSyncBusy, setGateSyncBusy] = useState<any>(false);
  const [secrets, setSecrets] = useState<any>({
    openaiKey: '',
    anthropicKey: '',
    openrouterKey: '',
    customRpcUrl: '',
    customRpcKey: '',
    arweaveJwk: '',
    faucetPrivateKey: '',
    litAccountApiKey: '',
    litUsageApiKey: '',
  });
  const [workerSecretsDirty, setWorkerSecretsDirty] = useState<any>(false);
  const [clearedSecretKeys, setClearedSecretKeys] = useState<any>(() => new Set());
  const [openSecretCards, setOpenSecretCards] = useState<any>({ ai: false, rpc: false, arweave: false, faucet: false, lit: false });
  const [arweaveResource, setArweaveResource] = useState<any>({
    address: '',
    display: 'No JWK entered',
    meta: 'Enter a JWK above to read the public wallet balance.',
    loading: false,
  });
  const [faucetResource, setFaucetResource] = useState<any>({
    address: '',
    display: 'No faucet key entered',
    meta: 'Enter a faucet private key above to read the wallet balance.',
    loading: false,
  });
  const [litResource, setLitResource] = useState<any>({
    address: '',
    display: 'Lit Chipotle not configured',
    meta: 'Enter a Lit account API key or Lit usage API key above, or save Lit Chipotle config to the worker, then refresh status.',
    loading: false,
    manualRefreshAvailable: false,
  });
  const arweaveResourceRequestRef = useRef<any>(0);
  const faucetResourceRequestRef = useRef<any>(0);
  const litResourceRequestRef = useRef<any>(0);
  const rawMetadataCopyResetRef = useRef<any>(null);
  const prevSelectedSlugForDraftRef = useRef<any>(selectedSlug);
  const prevSelectedSlugForAllowOriginsDraftRef = useRef<any>(selectedSlug);
  const metadataDraftTouchedRef = useRef<any>(metadataDraftTouched);
  metadataDraftTouchedRef.current = metadataDraftTouched;

  const handleSecretChange = useCallback((key: any, value: any) => {
    setSecrets((prev: any) => ({ ...prev, [key]: value }));
    setWorkerSecretsDirty(true);
    setClearedSecretKeys((prev: any) => {
      if (!prev.has(key)) return prev;
      const next: any = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleClearSecret = useCallback((key: any) => {
    setSecrets((prev: any) => ({ ...prev, [key]: '' }));
    setWorkerSecretsDirty(true);
    setClearedSecretKeys((prev: any) => {
      const next: any = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const updateMetadataConfigDraft = useCallback((key: any, value: any) => {
    setMetadataDraftTouched(true);
    if (key === 'contractSurveysAddress' || key === 'contractSbtFactoryAddress' || key === 'contractSessionRegistryAddress') {
      setMetadataContractDraftTouched(true);
      setMetadataContractsVerified(false);
    }
    setMetadataConfigDraft((prev: any) => ({ ...prev, [key]: value }));
  }, []);

  const requestedSessionRaw = toStr(initialSessionId).trim();
  const requestedSessionIdHex = sessionRegistryUtils.normalizeSessionIdHex(requestedSessionRaw);
  const requestedSessionSlug = requestedSessionIdHex ? '' : normalizeSlug(requestedSessionRaw);
  const requestedChainId = parseChainIdInput(initialRegistryChainId) || null;
  const requestedFetchKeyRef = useRef<any>('');
  const requestedAutoRefreshKeyRef = useRef<any>('');
  // Avoid any automatic wallet RPC calls in /admin (some wallets show connect popups even for
  // "read-only" methods). Treat wallet as "ready" only if the app believes login is complete.
  const walletReady = !!account && (loginComplete !== false);

  useEffect(() => {
    setIgnoreRequestedSession(false);
  }, [requestedSessionRaw, requestedChainId]);

  const syncSessionsFromRegistryCache = useCallback(() => {
    const cached = sessionRegistryStore.getAllSessionEntries();
    const nextSessions = Array.isArray(cached) ? cached : [];
    setSessions(nextSessions);
    return nextSessions;
  }, []);

  const loadSessions = useCallback(async ({ forceOnChain }: any = {}) => {
    const cached = syncSessionsFromRegistryCache();

    const chainIds = requestedChainId ? [requestedChainId] : undefined;
    const shouldForceRegistryRead = !USE_ONCHAIN_SESSION_REGISTRY || !!forceOnChain;
    const runRegistryLoad = async (bootstrapRpc: any) => {
      try {
        return await loadSessionRegistryCache({
          ...(chainIds ? { chainIds } : {}),
          force: shouldForceRegistryRead,
          // In /admin, never auto-decrypt registry metadata; keep wallet prompts behind user actions.
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
    let refreshed = syncSessionsFromRegistryCache();
    const primaryCount = countSessionsForChain(refreshed, requestedChainId);
    const primaryLoadHadErrors = (
      !!primaryResult?.__error ||
      primaryResult?.__loadMeta?.hadLoadErrors === true
    );
    const shouldRetryWithDefaultRpc = primaryCount <= 0 || primaryLoadHadErrors;

    if (shouldRetryWithDefaultRpc) {
      await runRegistryLoad(false);
      refreshed = syncSessionsFromRegistryCache();
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
        const config: any = await fetchSessionFromRegistry({
          chainId: requestedChainId,
          sessionId: requestedSessionIdHex || '',
          slug: requestedSessionSlug || '',
          // Avoid auto-decrypt in background refreshes.
          providerLike: null,
          account: '',
          lit: null,
          bootstrapRpc: true,
        });
        if (config) {
          upsertSessionRegistryCache({ config });
          const refreshed = sessionRegistryStore.getAllSessionEntries();
          setSessions(refreshed || []);
          setSelectedSlug(normalizeSlug(config.slug));
        }
      }
      setSessionsRefreshStatus('Session list updated.');
    } catch (err: any) {
      setSessionsRefreshStatus(getErrorMessage(err, 'Failed to refresh sessions.'));
    } finally {
      setSessionsRefreshBusy(false);
    }
  }, [
    loadSessions,
    ignoreRequestedSession,
    requestedSessionRaw,
    requestedChainId,
    requestedSessionIdHex,
    requestedSessionSlug,
  ]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const handleRegistryCacheUpdated = () => {
      syncSessionsFromRegistryCache();
    };
    window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, handleRegistryCacheUpdated);
    return () => {
      window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, handleRegistryCacheUpdated);
    };
  }, [syncSessionsFromRegistryCache]);

  const sessionsForChain = useMemo(() => {
    if (!requestedChainId) return sessions || [];
    return (sessions || []).filter(([, cfg]: any) => {
      const chainId = Number(cfg?.__registry?.registryChainId || cfg?.__registry?.chainId || 0) || 0;
      return chainId === requestedChainId;
    });
  }, [sessions, requestedChainId]);

  const availableSessions = useMemo(() => sessionsForChain, [sessionsForChain]);
  const requestedSessionMatch = useMemo(() => {
    if (!requestedSessionRaw) return null;
    if (requestedSessionIdHex) {
      return availableSessions.find(([, cfg]: any) => {
        const cfgId = sessionRegistryUtils.normalizeSessionIdHex(cfg?.__registry?.sessionIdHex || cfg?.sessionId);
        return cfgId && cfgId === requestedSessionIdHex;
      }) || null;
    }
    return availableSessions.find(([slug]: any) => slug === requestedSessionSlug) || null;
  }, [availableSessions, requestedSessionRaw, requestedSessionIdHex, requestedSessionSlug]);

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
    requestedSessionRaw,
    requestedChainId,
    ignoreRequestedSession,
    handleRefreshSessions,
  ]);

  useEffect(() => {
    if (!availableSessions.length) {
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
      setSelectedSlug(availableSessions[0][0] || '');
      return;
    }
    const hasSelected = availableSessions.some(([slug]: any) => slug === selectedSlug);
    if (!hasSelected) setSelectedSlug(availableSessions[0][0] || '');
  }, [
    availableSessions,
    selectedSlug,
    requestedSessionRaw,
    requestedSessionMatch,
    requestedSessionIdHex,
    requestedChainId,
    ignoreRequestedSession,
  ]);

  useEffect(() => {
    if (!requestedSessionRaw || !requestedChainId) return;
    if (ignoreRequestedSession) return;
    if (requestedSessionMatch) return;
    const lookupKey = `${requestedChainId}:${requestedSessionRaw}`;
    if (requestedFetchKeyRef.current === lookupKey) return;
    requestedFetchKeyRef.current = lookupKey;
    let cancelled = false;
    const run = async () => {
      setSessionLookupStatus(`Fetching session from chain ${requestedChainId}…`);
      try {
        const config: any = await fetchSessionFromRegistry({
          chainId: requestedChainId,
          sessionId: requestedSessionIdHex || '',
          slug: requestedSessionSlug || '',
          // Avoid auto-decrypt in background lookups.
          providerLike: null,
          account: '',
          lit: null,
          bootstrapRpc: true,
        });
        if (!config) {
          throw new Error(`Session not found on chain ${requestedChainId}: ${requestedSessionRaw}`);
        }
        upsertSessionRegistryCache({ config });
        const refreshed = sessionRegistryStore.getAllSessionEntries();
        if (cancelled) return;
        setSessions(refreshed || []);
        setSelectedSlug(normalizeSlug(config.slug));
        setSessionLookupStatus('');
      } catch (err: any) {
        if (!cancelled) {
          const message = getErrorMessage(err, `Session not found on chain ${requestedChainId}: ${requestedSessionRaw}`);
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
    requestedSessionRaw,
    requestedChainId,
    requestedSessionIdHex,
    requestedSessionSlug,
    requestedSessionMatch,
    ignoreRequestedSession,
  ]);

  const selectedConfig: any = useMemo(() => {
    const match = availableSessions.find(([slug]: any) => slug === selectedSlug);
    return match ? match[1] : null;
  }, [availableSessions, selectedSlug]);
  const effectiveWorkerAllowOrigins = useMemo(() => {
    if (!selectedConfig) return [];
    const cachedWorkerConfig: any = getCachedSessionWorkerConfig({
      slug: selectedSlug,
      sessionConfig: selectedConfig,
    }) || {};
    if (Object.prototype.hasOwnProperty.call(cachedWorkerConfig, 'allowOrigins')) {
      return parseAllowOriginsDraft(cachedWorkerConfig.allowOrigins);
    }
    return parseAllowOriginsDraft(selectedConfig?.allowOrigins);
  }, [selectedConfig, selectedSlug]);
  const effectiveAllowOriginsDraft = useMemo(() => (
    formatAllowOriginsDraft(effectiveWorkerAllowOrigins)
  ), [effectiveWorkerAllowOrigins]);
  const normalizedAllowOriginsDraft = useMemo(() => (
    parseAllowOriginsDraft(allowOriginsDraft)
  ), [allowOriginsDraft]);
  const normalizedAllowOriginsDraftText = useMemo(() => (
    formatAllowOriginsDraft(normalizedAllowOriginsDraft)
  ), [normalizedAllowOriginsDraft]);
  const allowOriginsHasChanges = normalizedAllowOriginsDraftText !== effectiveAllowOriginsDraft;

  const groupMetadata = useMemo(() => selectedConfig, [selectedConfig]);
  const relevantSessionChainId = useMemo(() => (
    Number(selectedConfig?.networkChainId || selectedConfig?.__registry?.chainId || network?.id || 0) || 0
  ), [selectedConfig, network?.id]);
  const relevantRegistryChainId = useMemo(() => (
    Number(
      selectedConfig?.__registry?.registryChainId ||
      selectedConfig?.__registry?.chainId ||
      selectedConfig?.networkChainId ||
      network?.id ||
      0
    ) || 0
  ), [selectedConfig, network?.id]);
  const relevantSessionChainLabel = useMemo(() => {
    if (!relevantSessionChainId) return '';
    const name = getChainName(relevantSessionChainId);
    return name ? `${name} (${relevantSessionChainId})` : String(relevantSessionChainId);
  }, [relevantSessionChainId]);

  const defaultGate = useMemo(() => (
    resolveDefaultGateFromConfig(groupMetadata || {})
  ), [groupMetadata]);

  // If the default gate is empty, treat /health as public. Otherwise, require an authenticated wallet.
  const defaultGateIsEmpty = !defaultGate?.sbtAddresses?.length;

  useEffect(() => {
    setDefaultGateTouched(false);
    setGateConfigDirty(false);
    setGateSyncStatus('');
    setGateSyncResult(null);
    setLitTestEnvelope('');
    setLitTestDecrypted('');
    setLitTestStatus('');
    setWorkerUrlEditable(false);
    setCorsPatchStatus('');
    setCorsPatchBusy(false);
    setAllowOriginsDraft('');
    setAllowOriginsDraftDirty(false);
    setShowAllowlistEditor(false);
    setSecrets({
      openaiKey: '',
      anthropicKey: '',
      openrouterKey: '',
      customRpcUrl: '',
      customRpcKey: '',
      arweaveJwk: '',
      faucetPrivateKey: '',
      litAccountApiKey: '',
      litUsageApiKey: '',
    });
    setWorkerSecretsDirty(false);
    setClearedSecretKeys(new Set());
    setLitResource({
      address: '',
      display: 'Lit Chipotle not configured',
      meta: 'Enter a Lit account API key or Lit usage API key above, or save Lit Chipotle config to the worker, then refresh status.',
      loading: false,
      manualRefreshAvailable: false,
    });
    setShowTestsPanel(false);
  }, [selectedSlug]);

  useEffect(() => {
    const slugChanged = prevSelectedSlugForDraftRef.current !== selectedSlug;
    prevSelectedSlugForDraftRef.current = selectedSlug;
    // Regression guard: selectedSlug and groupMetadata can update in one commit.
    // Always rehydrate on session changes; only preserve dirty drafts within the same session.
    if (!slugChanged && metadataDraftTouchedRef.current) return;
    setMetadataDraftTouched(false);
    setMetadataContractDraftTouched(false);
    setMetadataContractsVerified(false);
    setMetadataAutoFeatureTouched(false);
    setMetadataUpdateStatus('');
    setMetadataBlockLimitsDraft({
      start: toStr(groupMetadata?.blockLimits?.start).trim(),
      end: toStr(groupMetadata?.blockLimits?.end).trim(),
    });
    setMetadataConfigDraft(buildAdminMetadataDraft(groupMetadata || {}));
    setMetadataAutoFeatureDraft(resolveAutoFeatureBySessionSlug(groupMetadata) !== false);
    setCopiedRawMetadataJson(false);
  }, [groupMetadata, selectedSlug]);

  useEffect(() => {
    const slugChanged = prevSelectedSlugForAllowOriginsDraftRef.current !== selectedSlug;
    prevSelectedSlugForAllowOriginsDraftRef.current = selectedSlug;
    if (!slugChanged && allowOriginsDraftDirty) return;
    setAllowOriginsDraft(effectiveAllowOriginsDraft);
    setAllowOriginsDraftDirty(false);
  }, [selectedSlug, effectiveAllowOriginsDraft, allowOriginsDraftDirty]);

  useEffect(() => () => {
    if (rawMetadataCopyResetRef.current) clearTimeout(rawMetadataCopyResetRef.current);
  }, []);

  useEffect(() => {
    if (!relevantSessionChainId) {
      setMetadataLatestBlock(null);
      setMetadataLatestBlockStatus('');
      return;
    }
    const rpcUrl = (
      getDefaultHttpRpc(relevantSessionChainId, { allowPath: false }) ||
      getDefaultHttpRpc(relevantSessionChainId)
    );
    if (!rpcUrl) {
      setMetadataLatestBlock(null);
      setMetadataLatestBlockStatus('Current block unavailable for the selected session chain.');
      return;
    }
    let cancelled = false;
    setMetadataLatestBlockStatus('Loading current block…');
    const readProvider = new ethers.providers.JsonRpcProvider(rpcUrl, {
      chainId: relevantSessionChainId,
      name: `chain-${relevantSessionChainId}`,
    });
    readProvider.getBlockNumber()
      .then((blockNumber: any) => {
        if (cancelled) return;
        setMetadataLatestBlock(blockNumber);
        setMetadataLatestBlockStatus('');
      })
      .catch(() => {
        if (cancelled) return;
        setMetadataLatestBlock(null);
        setMetadataLatestBlockStatus('Unable to load the current block for the selected session chain.');
      });
    return () => {
      cancelled = true;
    };
  }, [relevantSessionChainId]);

  useEffect(() => {
    if (metadataDraftTouched) return;
    const existingStart = Number(groupMetadata?.blockLimits?.start);
    if (Number.isFinite(existingStart) && existingStart > 0) return;
    const latestBlock = Number(metadataLatestBlock || 0);
    if (!Number.isFinite(latestBlock) || latestBlock <= 0) return;
    setMetadataBlockLimitsDraft((prev: any) => {
      const currentStart = Number(prev?.start || 0);
      if (Number.isFinite(currentStart) && currentStart > 0) return prev;
      return {
        ...(prev || {}),
        start: String(latestBlock),
      };
    });
  }, [groupMetadata?.blockLimits?.start, metadataDraftTouched, metadataLatestBlock]);

  useEffect(() => {
    if (!groupMetadata || defaultGateTouched) return;
    const resolved = resolveDefaultGateFromConfig(groupMetadata);
    setDefaultGateDraft({
      sbts: resolved.sbtAddresses.map((address: any) => ({ address, name: address })),
      mode: resolved.mode || 'any',
      chainId: resolved.chainId ? String(resolved.chainId) : '',
    });
  }, [groupMetadata, defaultGateTouched]);

  useEffect(() => {
    const entries = collectEncryptedEntries(groupMetadata);
    setEncryptedFields(entries);
    if (!Object.keys(entries).length) {
      setDecryptedFields({});
      return;
    }
    // Do not auto-decrypt in /admin; decrypting triggers wallet popups. Users can decrypt on demand.
    const next: Record<string, any> = {};
    Object.entries(entries).forEach(([key, envelope]: any) => {
      next[key] = {
        value: '',
        status: walletReady ? 'locked' : 'wallet-required',
        encryptedAvailable: true,
        envelope,
      };
    });
    setDecryptedFields(next);
  }, [groupMetadata, walletReady]);

  const [decryptFieldsBusy, setDecryptFieldsBusy] = useState<any>(false);
  const handleDecryptEncryptedFields = useCallback(async () => {
    if (!groupMetadata) return;
    if (!walletReady) {
      if (toggleLoginModal) toggleLoginModal(true);
      return;
    }
    const entries = collectEncryptedEntries(groupMetadata);
    if (!Object.keys(entries).length) return;
    const chainId = Number(
      groupMetadata?.networkChainId ||
      groupMetadata?.__registry?.chainId ||
      network?.id ||
      0
    ) || 0;
    setDecryptFieldsBusy(true);
    try {
      const next: Record<string, any> = {};
      for (const [key, envelope] of Object.entries(entries)) {
        // Wallet popups (signature prompts) are expected here: user explicitly clicked Decrypt.
        const resolved = await encryptedFieldsUtils.resolveEncryptedValue(envelope, {
          account,
          providerLike: provider,
          chainId,
        });
        next[key] = { ...resolved, envelope };
      }
      setDecryptedFields(next);
    } finally {
      setDecryptFieldsBusy(false);
    }
  }, [groupMetadata, walletReady, toggleLoginModal, account, provider, network?.id]);

  const currentSponsored = selectedConfig?.sponsoredKeys || {};
  const currentSponsoredLit = (
    currentSponsored?.lit === true ||
    toStr(currentSponsored?.lit).trim() === '1'
  );
  const nextSponsored = useMemo(() => buildSponsoredSessionFlagFields({
    secrets,
    includeCustomRpcInAi: true,
  }), [secrets]);
  const resourceSessionConfig = groupMetadata || selectedConfig;
  const selectedConfigWorkerUrl = useMemo(() => (
    normalizeWorkerUrl(getUsableSessionWorkerUrl({
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
  const sessionReadRpc = useMemo(() => (
    getSessionReadRpcConfig({
      sessionConfig: resourceSessionConfig,
      fallbackChainId: relevantSessionChainId || network?.id || 0,
    })
  ), [resourceSessionConfig, relevantSessionChainId, network?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedConfig) {
        setWorkerUrl('');
        setWorkerStatus('');
        return;
      }
      setWorkerUrl(selectedConfigWorkerUrl);
      setWorkerStatus('Resolving worker URL…');
      let resolved;
      try {
        resolved = await corsProxyUtils.resolveCorsProxyUrl({
          sessionSlug: selectedSlug,
          sessionConfig: selectedConfig,
          // Never auto-decrypt worker URLs here; keep wallet prompts behind user actions.
          context: { account: '', providerLike: null },
        });
      } catch (e: any) {
        if (!cancelled) {
          setWorkerUrl('');
          setWorkerDebug(`error=${getErrorMessage(e, String(e || 'unknown error'))}`);
          setWorkerStatus('Failed to resolve worker URL');
        }
        return;
      }

      if (cancelled) return;
      const resolvedUrl = normalizeWorkerUrl(resolved?.url || '');
      const url = resolvedUrl || '';
      setWorkerUrl(url);
      setWorkerDebug(`source=${resolved?.source || 'unknown'} status=${resolved?.status || 'ok'} url=${resolvedUrl || '(none)'}`);
      if (url) {
        setWorkerStatus(`Resolved (${resolved?.status || 'ok'})`);
      } else {
        setWorkerStatus(resolved?.status ? `Missing (${resolved.status})` : 'Missing worker URL');
      }
      if (typeof window !== 'undefined') {
        // Debug help when worker URL resolution is unexpected.
        log.log('[AdminPage] Worker URL resolved', {
          slug: selectedSlug,
          resolved,
          finalUrl: url,
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedConfig, selectedConfigWorkerUrl, selectedSlug]);

  const refreshArweaveResource = useCallback(async () => {
    const requestId = arweaveResourceRequestRef.current + 1;
    arweaveResourceRequestRef.current = requestId;
    const jwk = toStr(secrets.arweaveJwk).trim();
    if (!jwk) {
      setArweaveResource({
        address: '',
        display: 'No JWK entered',
        meta: 'Enter a JWK above to read the public wallet balance.',
        loading: false,
      });
      return;
    }

    let parsedJwk;
    try {
      parsedJwk = JSON.parse(jwk);
    } catch (_) {
      if (requestId !== arweaveResourceRequestRef.current) return;
      setArweaveResource({
        address: '',
        display: 'Invalid JWK',
        meta: 'The wallet JSON could not be parsed.',
        loading: false,
      });
      return;
    }

    setArweaveResource({
      address: '',
      display: 'Loading...',
      meta: 'Resolving wallet address and balance…',
      loading: true,
    });

    let address = '';
    try {
      const arweaveBalance = await arweaveScripts.readArweaveWalletBalance(parsedJwk);
      address = arweaveBalance.address;
      if (requestId !== arweaveResourceRequestRef.current) return;
      setArweaveResource({
        address,
        display: `${arweaveScripts.formatWinstonToAr(arweaveBalance.winston, 6)} AR`,
        meta: shortAddress(address),
        loading: false,
      });
    } catch (err) {
      if (requestId !== arweaveResourceRequestRef.current) return;
      const message = address ? 'Unable to load balance' : 'Invalid JWK';
      const meta = address
        ? shortAddress(address)
        : 'The wallet JSON is missing required Arweave key fields.';
      setArweaveResource({
        address,
        display: message,
        meta,
        loading: false,
      });
    }
  }, [secrets.arweaveJwk]);

  const refreshFaucetResource = useCallback(async () => {
    const requestId = faucetResourceRequestRef.current + 1;
    faucetResourceRequestRef.current = requestId;
    const faucetPrivateKey = toStr(secrets.faucetPrivateKey).trim();
    if (!faucetPrivateKey) {
      setFaucetResource({
        address: '',
        display: 'No faucet key entered',
        meta: 'Enter a faucet private key above to read the wallet balance.',
        loading: false,
      });
      return;
    }

    let address = '';
    try {
      address = new ethers.Wallet(faucetPrivateKey).address;
    } catch (_) {
      if (requestId !== faucetResourceRequestRef.current) return;
      setFaucetResource({
        address: '',
        display: 'Invalid key',
        meta: 'The private key could not be parsed.',
        loading: false,
      });
      return;
    }

    const sessionChainLabel = relevantSessionChainLabel || (sessionReadRpc.chainId ? String(sessionReadRpc.chainId) : '');
    if (!sessionReadRpc.rpcUrl || !sessionReadRpc.chainId) {
      if (requestId !== faucetResourceRequestRef.current) return;
      setFaucetResource({
        address,
        display: 'RPC unavailable',
        meta: shortAddress(address),
        loading: false,
      });
      return;
    }

    setFaucetResource({
      address,
      display: 'Loading...',
      meta: sessionChainLabel ? `Reading ${sessionChainLabel}` : shortAddress(address),
      loading: true,
    });

    try {
      const readProvider = new ethers.providers.JsonRpcProvider(sessionReadRpc.rpcUrl, {
        chainId: sessionReadRpc.chainId,
        name: `chain-${sessionReadRpc.chainId}`,
      });
      const balanceWei = await readProvider.getBalance(address);
      if (requestId !== faucetResourceRequestRef.current) return;
      const meta = sessionChainLabel
        ? `${shortAddress(address)} • ${sessionChainLabel}`
        : shortAddress(address);
      setFaucetResource({
        address,
        display: `${Number(ethers.utils.formatEther(balanceWei)).toFixed(4)} ETH`,
        meta,
        loading: false,
      });
    } catch (_) {
      if (requestId !== faucetResourceRequestRef.current) return;
      setFaucetResource({
        address,
        display: 'Unable to load balance',
        meta: shortAddress(address),
        loading: false,
      });
    }
  }, [relevantSessionChainLabel, secrets.faucetPrivateKey, sessionReadRpc.chainId, sessionReadRpc.rpcUrl]);

  useEffect(() => {
    refreshArweaveResource();
    return () => {
      arweaveResourceRequestRef.current += 1;
    };
  }, [refreshArweaveResource]);

  useEffect(() => {
    refreshFaucetResource();
    return () => {
      faucetResourceRequestRef.current += 1;
    };
  }, [refreshFaucetResource]);

  const signAdminAction = useCallback(async ({
    action = 'set-config',
    body = {},
    chainId: chainIdOverride = null,
    workerUrl: overrideWorkerUrl,
  }: any = {}) => {
    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect a wallet to sign admin requests.');
    }
    const slug = normalizeSlug(selectedSlug);
    const baseUrl = normalizeWorkerUrl(overrideWorkerUrl || workerUrl || selectedConfigWorkerUrl);
    if (!baseUrl) throw new Error('Worker URL is missing.');

    const chainId = Number(
      chainIdOverride ||
      selectedConfig?.__registry?.chainId ||
      selectedConfig?.networkChainId ||
      network?.id ||
      1
    ) || 1;

    return buildSignedAdminActionAuth({
      action,
      slug,
      body,
      workerUrl: baseUrl,
      context: {
        account,
        chainId,
        providerLike: typeof provider === 'string' ? provider : undefined,
      },
    });
  }, [
    account,
    network?.id,
    provider,
    selectedConfig,
    selectedConfigWorkerUrl,
    selectedSlug,
    toggleLoginModal,
    workerUrl,
  ]);

  const postSignedAdminRequest = useCallback(async ({
    action = 'set-config',
    body = {},
    path,
    chainId: chainIdOverride = null,
    workerUrl: overrideWorkerUrl,
    retryAttempts = ADMIN_ACTION_NONCE_RETRY_ATTEMPTS,
  }: any = {}) => {
    const baseUrl = normalizeWorkerUrl(overrideWorkerUrl || workerUrl || selectedConfigWorkerUrl);
    if (!baseUrl) throw new Error('Worker URL is missing.');

    let lastError: any = null;
    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      const auth = await signAdminAction({
        action,
        body,
        chainId: chainIdOverride,
        workerUrl: baseUrl,
      });
      let res;
      try {
        res = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, ...auth }),
        });
      } catch (error) {
        throw new Error(normalizeAdminWorkerFetchError({
          error,
          workerBase: baseUrl,
        }));
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { baseUrl, response: res, data };
      }

      const responseError = data?.error || '';
      if (attempt < retryAttempts && isRetryableAdminNonceFailure({
        responseStatus: res.status,
        responseError,
      })) {
        // A concurrent admin action may have consumed the previous nonce.
        // Re-sign with a fresh nonce instead of surfacing a transient failure.
        // eslint-disable-next-line no-await-in-loop
        await sleep(250 * attempt);
        continue;
      }

      lastError = new Error(normalizeAdminWorkerFetchError({
        error: responseError || `Request failed (${res.status}).`,
        workerBase: baseUrl,
        responseStatus: res.status,
        responseError,
      }));
      throw lastError;
    }

    throw lastError || new Error(`Failed admin action: ${action}`);
  }, [
    selectedConfigWorkerUrl,
    signAdminAction,
    workerUrl,
  ]);

  const refreshLitResource = useCallback(async ({ includeSignedStatus = true }: any = {}) => {
    const requestId = litResourceRequestRef.current + 1;
    litResourceRequestRef.current = requestId;
    const baseUrl = normalizeWorkerUrl(workerUrl || selectedConfigWorkerUrl);
    const litCredentials = selectedConfig?.litCredentials
      && typeof selectedConfig.litCredentials === 'object'
      && !Array.isArray(selectedConfig.litCredentials)
      ? selectedConfig.litCredentials
      : {};
    const accountApiKey = toStr(secrets.litAccountApiKey).trim();
    const usageApiKey = toStr(secrets.litUsageApiKey).trim();
    const configuredLitApiBase = toStr(litCredentials?.litApiBase).trim();
    const configuredLitGroupId = toStr(litCredentials?.litGroupId).trim();
    const configuredLitPkpId = toStr(litCredentials?.litPkpId).trim();
    const configuredLitActionCid = toStr(litCredentials?.litActionCid).trim();
    const hasChipotleConfig = !!(
      configuredLitApiBase ||
      configuredLitGroupId ||
      configuredLitPkpId ||
      configuredLitActionCid
    );
    const useChipotlePath = !!(accountApiKey || usageApiKey || hasChipotleConfig);

    if (!useChipotlePath && !baseUrl) {
      setLitResource({
        address: '',
        display: 'Lit Chipotle not configured',
        meta: 'Enter a Lit account API key or Lit usage API key above, or save Lit Chipotle config to the worker, then refresh status.',
        loading: false,
        manualRefreshAvailable: false,
      });
      return;
    }

    if (!baseUrl || !selectedConfig) {
      if (requestId !== litResourceRequestRef.current) return;
      setLitResource({
        address: '',
        display: useChipotlePath ? 'Worker unavailable' : 'Lit Chipotle not configured',
        meta: useChipotlePath
          ? 'Resolve the worker URL to read Lit Chipotle status.'
          : 'Enter a Lit account API key or Lit usage API key above, or save Lit Chipotle config to the worker, then refresh status.',
        loading: false,
        manualRefreshAvailable: false,
      });
      return;
    }

    if (!includeSignedStatus) {
      if (requestId !== litResourceRequestRef.current) return;
      setLitResource({
        address: '',
        display: 'Status not loaded',
        meta: [
          accountApiKey ? 'Unsaved account key' : '',
          usageApiKey ? 'Unsaved usage key' : '',
          !accountApiKey && !usageApiKey ? 'Saved worker config' : '',
          configuredLitApiBase ? formatPreviewValue(configuredLitApiBase.replace(/^https?:\/\//, ''), 28) : '',
          configuredLitGroupId ? `group ${formatPreviewValue(configuredLitGroupId, 20)}` : '',
          configuredLitPkpId ? 'PKP configured' : '',
          configuredLitActionCid ? 'Action configured' : '',
          'Click refresh to query the worker for Lit Chipotle status.',
        ].filter(Boolean).join(' • '),
        loading: false,
        manualRefreshAvailable: true,
      });
      return;
    }

    setLitResource({
      address: '',
      display: 'Loading...',
      meta: configuredLitGroupId
        ? `Checking group ${formatPreviewValue(configuredLitGroupId, 20)}`
        : 'Checking Lit Chipotle worker status',
      loading: true,
      manualRefreshAvailable: true,
    });

    try {
      const slug = normalizeSlug(selectedSlug);
      const requestBody = {
        sessionSlug: slug,
        ...(usageApiKey ? { litUsageApiKey: usageApiKey } : {}),
        ...(accountApiKey ? { apiKey: accountApiKey } : {}),
      };
      const { data } = await postSignedAdminRequest({
        action: 'lit-chipotle-status',
        body: requestBody,
        path: '/admin/lit-chipotle-status',
        workerUrl: baseUrl,
      });
      if (requestId !== litResourceRequestRef.current) return;

      const ready = data?.ready === true;
      const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
      const groupSummary = data?.groupSummary && typeof data.groupSummary === 'object'
        ? data.groupSummary
        : {};
      const walletCount = groupSummary.walletCount == null ? null : Number(groupSummary.walletCount);
      const actionCount = groupSummary.actionCount == null ? null : Number(groupSummary.actionCount);
      const hasHardConfigMiss = (
        groupSummary.hasConfiguredPkp === false ||
        groupSummary.hasConfiguredAction === false
      );
      const balanceDisplay = toStr(data?.balance?.balance_display || '').trim();
      setLitResource({
        address: '',
        display: ready
          ? 'Ready'
          : hasHardConfigMiss
            ? 'Needs config'
            : warnings.length
              ? 'Needs review'
              : 'Configured',
        meta: [
          configuredLitApiBase ? formatPreviewValue(configuredLitApiBase.replace(/^https?:\/\//, ''), 28) : '',
          balanceDisplay ? `balance ${balanceDisplay}` : '',
          configuredLitGroupId ? `group ${formatPreviewValue(configuredLitGroupId, 20)}` : '',
          configuredLitPkpId
            ? (groupSummary.hasConfiguredPkp === true
              ? 'PKP ready'
              : groupSummary.hasConfiguredPkp === false
                ? 'PKP missing'
                : 'PKP unchecked')
            : (walletCount != null ? `${walletCount} wallet${walletCount === 1 ? '' : 's'}` : ''),
          configuredLitActionCid
            ? (groupSummary.hasConfiguredAction === true
              ? 'Action ready'
              : groupSummary.hasConfiguredAction === false
                ? 'Action missing'
                : 'Action unchecked')
            : (actionCount != null ? `${actionCount} action${actionCount === 1 ? '' : 's'}` : ''),
          warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : '',
        ].filter(Boolean).join(' • ') || 'Lit Chipotle status loaded.',
        loading: false,
        manualRefreshAvailable: true,
      });
    } catch (error: any) {
      if (requestId !== litResourceRequestRef.current) return;
      setLitResource({
        address: '',
        display: 'Unable to load status',
        meta: getErrorMessage(error, 'Failed to load Lit Chipotle status.'),
        loading: false,
        manualRefreshAvailable: true,
      });
    }
  }, [
    secrets.litAccountApiKey,
    secrets.litUsageApiKey,
    selectedConfig,
    selectedConfigWorkerUrl,
    selectedSlug,
    postSignedAdminRequest,
    workerUrl,
  ]);

  useEffect(() => {
    refreshLitResource({ includeSignedStatus: false });
    return () => {
      litResourceRequestRef.current += 1;
    };
  }, [refreshLitResource]);

  const litResourceLabel = useMemo(() => {
    const litCredentials = selectedConfig?.litCredentials
      && typeof selectedConfig.litCredentials === 'object'
      && !Array.isArray(selectedConfig.litCredentials)
      ? selectedConfig.litCredentials
      : {};
    return (
      toStr(secrets.litAccountApiKey).trim() ||
      toStr(secrets.litUsageApiKey).trim() ||
      toStr(litCredentials?.litApiBase).trim() ||
      toStr(litCredentials?.litGroupId).trim() ||
      toStr(litCredentials?.litPkpId).trim() ||
      toStr(litCredentials?.litActionCid).trim()
    ) ? 'Lit Chipotle status' : 'Lit sponsorship status';
  }, [selectedConfig, secrets.litAccountApiKey, secrets.litUsageApiKey]);

  const resolveSuggestedAllowOrigins = (extraOrigins: any = normalizedAllowOriginsDraft) => {
    let currentOrigin = '';
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        currentOrigin = toStr(window.location.origin).trim();
      }
    } catch (_) {}
    return buildWorkerAllowOrigins({
      currentOrigin,
      extraOrigins,
    });
  };

  const handleAllowOriginsDraftChange = (event: any) => {
    setAllowOriginsDraft(event.target.value);
    setAllowOriginsDraftDirty(true);
  };

  const handleAddRecommendedAllowOrigins = () => {
    const nextAllowOrigins = normalizeOriginList([
      ...normalizedAllowOriginsDraft,
      ...resolveSuggestedAllowOrigins(normalizedAllowOriginsDraft),
    ]);
    const nextDraft = formatAllowOriginsDraft(nextAllowOrigins);
    const addedCount = Math.max(0, nextAllowOrigins.length - normalizedAllowOriginsDraft.length);
    setAllowOriginsDraft(nextDraft);
    if (nextDraft !== normalizedAllowOriginsDraftText) {
      setAllowOriginsDraftDirty(true);
    }
    setCorsPatchStatus(
      addedCount > 0
        ? `Added ${addedCount} recommended origin${addedCount === 1 ? '' : 's'} to the draft. Save allowlist to apply.`
        : 'Recommended origins are already in the draft.'
    );
  };

  const handleSaveAllowOrigins = async () => {
    setCorsPatchBusy(true);
    let baseUrl = '';
    try {
      if (!selectedConfig) throw new Error('Select a session.');
      if (!canAdmin) throw new Error('Connect the admin wallet to update worker config.');
      const slug = normalizeSlug(selectedSlug);
      baseUrl = normalizeWorkerUrl(workerUrl);
      if (!baseUrl) throw new Error('Worker URL is missing.');
      const allowOrigins = normalizedAllowOriginsDraft;
      setCorsPatchStatus('Saving worker allowOrigins…');
      const requestBody = {
        sessionSlug: slug,
        adminAddress: account,
        config: {
          allowOrigins,
        },
      };
      const { baseUrl: savedBaseUrl } = await postSignedAdminRequest({
        action: 'set-config',
        body: requestBody,
        path: '/admin/set-config',
        workerUrl: baseUrl,
      });
      const existingCachedConfig = getCachedSessionWorkerConfig({ slug, sessionConfig: selectedConfig }) || {};
      upsertCachedSessionWorkerConfig({
        slug,
        sessionConfig: selectedConfig,
        config: {
          ...existingCachedConfig,
          corsWorkerUrl: savedBaseUrl,
          allowOrigins,
        },
      });
      setAllowOriginsDraft(formatAllowOriginsDraft(allowOrigins));
      setAllowOriginsDraftDirty(false);
      setCorsPatchStatus(
        allowOrigins.length
          ? `allowOrigins saved (${allowOrigins.length} origins). Re-run the Worker Tests.`
          : 'allowOrigins saved with open CORS (no allowlist). Re-run the Worker Tests.'
      );
    } catch (err) {
      setCorsPatchStatus(
        normalizeAdminWorkerFetchError({
          error: err,
          workerBase: baseUrl || normalizeWorkerUrl(workerUrl),
        })
      );
    } finally {
      setCorsPatchBusy(false);
    }
  };

  const handleSaveWorkerSecrets = async () => {
    try {
      const sessionLabel = selectedConfig?.sessionName
        ? `${selectedSlug || 'general'} — ${selectedConfig.sessionName}`
        : (selectedSlug || 'general');
      setSaveStatus(`Saving worker secrets for ${sessionLabel}…`);
      setChainStatus('');
      const slug = normalizeSlug(selectedSlug);
      if (!selectedConfig) throw new Error('Select a session.');
      const baseUrl = normalizeWorkerUrl(workerUrl);
      if (!baseUrl) throw new Error('Worker URL is missing.');
      // Only send non-empty fields — blank fields are skipped to avoid overwriting existing secrets.
      const secretsPayload = Object.entries(secrets).reduce((acc: any, [key, value]: any) => {
        const trimmed = toStr(value).trim();
        if (trimmed) {
          acc[key] = trimmed;
          return acc;
        }
        if (clearedSecretKeys.has(key)) acc[key] = '';
        return acc;
      }, {});
      const requestBody = {
        sessionSlug: slug,
        secrets: secretsPayload,
      };
      await postSignedAdminRequest({
        action: 'set-secrets',
        body: requestBody,
        path: '/admin/set-secrets',
        workerUrl: baseUrl,
      });
      setSaveStatus(`Worker secrets saved for ${sessionLabel}.`);

      const registryChainId = Number(
        selectedConfig?.__registry?.registryChainId ||
        selectedConfig?.__registry?.chainId ||
        selectedConfig?.networkChainId ||
        network?.id ||
        0
      ) || 0;
      const shouldPreserveSponsoredLit = (
        currentSponsoredLit &&
        !clearedSecretKeys.has('litAccountApiKey') &&
        !clearedSecretKeys.has('litUsageApiKey') &&
        !Object.prototype.hasOwnProperty.call(secretsPayload, 'litAccountApiKey') &&
        !Object.prototype.hasOwnProperty.call(secretsPayload, 'litUsageApiKey')
      );
      const sponsoredFields = buildSponsoredSessionFlagFields({
        secrets: secretsPayload,
        fallbackFields: shouldPreserveSponsoredLit ? { sponsored_lit: '1' } : {},
        includeCustomRpcInAi: true,
      });
      setChainStatus('Updating sponsored flags on-chain…');
      await setSessionFieldsOnChain({
        providerLike: provider,
        chainId: registryChainId,
        slug,
        fields: sponsoredFields,
      });
      setChainStatus('Sponsored flags updated.');
      await loadSessions();
      setClearedSecretKeys(new Set());
      setWorkerSecretsDirty(false);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to update secrets.');
      if (msg.toLowerCase().includes('flag')) {
        setChainStatus(msg);
      } else if (saveStatus) {
        setSaveStatus(msg);
      } else {
        setSaveStatus(msg);
      }
    }
  };

  const attemptWorkerLogin = async () => {
    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect a wallet to run the gated access test.');
    }
    const slug = normalizeSlug(selectedSlug);
    const baseUrl = normalizeWorkerUrl(workerUrl);
    if (!baseUrl) throw new Error('Worker URL is missing.');

    const nonceResp = await fetch(`${baseUrl}/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: account, sessionSlug: slug }),
    });
    const nonceData = await nonceResp.json().catch(() => ({}));
    if (!nonceResp.ok) {
      throw new Error(nonceData?.error || `Nonce request failed (${nonceResp.status}).`);
    }

    const chainId = Number(selectedConfig?.__registry?.chainId || selectedConfig?.networkChainId || network?.id || 1) || 1;
    const message = buildSiweMessage({
      address: account,
      nonce: nonceData?.nonce,
      chainId,
      statement: 'Sign in to Context Engine.',
    });
    const providerObj = cryptoUtils._getProvider(provider || 'wagmi');
    const signer = new ethers.providers.Web3Provider(providerObj, 'any').getSigner();
    const signature = await signer.signMessage(message);

    const loginResp = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: account, message, signature, sessionSlug: slug }),
    });
    const loginData = await loginResp.json().catch(() => ({}));
    return { loginResp, loginData };
  };

  const runDeniedAccessTest = async (key: any) => {
    setDeniedBusy(true);
    setDeniedStatus(`Testing ${key} (expect 403)…`);
    try {
      const { loginResp, loginData } = await attemptWorkerLogin();
      if (loginResp.status === 403) {
        const detail = toStr(loginData?.error || 'Forbidden').trim();
        setDeniedResults((prev: any) => ({ ...prev, [key]: `OK (403 ${detail})` }));
        setDeniedStatus(`Expected 403 for ${key}.`);
        return;
      }
      if (loginResp.ok) {
        setDeniedResults((prev: any) => ({ ...prev, [key]: 'FAILED (login succeeded)' }));
        setDeniedStatus('Unexpectedly allowed login; gating may be misconfigured.');
        return;
      }
      const detail = toStr(loginData?.error || `Login failed (${loginResp.status})`).trim();
      setDeniedResults((prev: any) => ({ ...prev, [key]: `FAILED (${detail})` }));
      setDeniedStatus(detail);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Denied test failed.');
      setDeniedResults((prev: any) => ({ ...prev, [key]: `FAILED (${msg})` }));
      setDeniedStatus(msg);
    } finally {
      setDeniedBusy(false);
    }
  };

  const handleSyncDefaultGate = async () => {
    setGateSyncBusy(true);
    setGateSyncStatus('Updating default gate on-chain…');
    setGateSyncResult(null);
    try {
      if (!selectedConfig) throw new Error('Select a session first.');
      if (!canAdmin) throw new Error('Connect the admin wallet to update gates.');
      const registryChainId = Number(
        selectedConfig?.__registry?.registryChainId ||
        selectedConfig?.__registry?.chainId ||
        selectedConfig?.networkChainId ||
        0
      ) || 0;
      if (!registryChainId) throw new Error('Registry chain id is missing.');
      const registrySlug = sessionRegistryUtils.toRegistrySlug(selectedSlug);
      const sbtAddresses = dedupeSbtSelections(defaultGateDraft.sbts || []).map((entry: any) => entry.address);
      if (!sbtAddresses.length) throw new Error('Provide at least one SBT address.');
      const gateChainId = parseChainIdInput(defaultGateDraft.chainId) ||
        Number(
          selectedConfig?.networkChainId ||
          selectedConfig?.__registry?.chainId ||
          0
        ) || 0;
      const mode = normalizeGateMode(defaultGateDraft.mode) === 'all' ? 1 : 0;
      const result = await setResourceGatesOnChain({
        providerLike: provider,
        chainId: registryChainId,
        slug: registrySlug,
        gates: [{
          resourceKey: 'default',
          sbtAddresses,
          chainId: gateChainId,
          mode,
          perMemberLimit: 0,
        }],
      });
      const txHash = toStr(result?.txs?.[0]?.hash).trim();
      if (txHash) {
        const txUrl = buildTxExplorerUrl(txHash, registryChainId);
        setGateSyncResult({
          label: `View tx ${txHash.slice(0, 12)}…`,
          href: txUrl,
        });
      }
      setGateConfigDirty(false);
      setGateSyncStatus('Default gate updated on-chain.');
    } catch (err: any) {
      setGateSyncResult(null);
      setGateSyncStatus(getErrorMessage(err, 'Failed to update default gate.'));
    } finally {
      setGateSyncBusy(false);
    }
  };

  const adminAddress = toStr(selectedConfig?.__registry?.adminAddress || selectedConfig?.adminAddress).toLowerCase();
  const accountLower = toStr(account).toLowerCase();
  const hasRegistryEntry = !!selectedConfig?.__registry?.registryChainId || !!selectedConfig?.__registry?.adminAddress;
  const isAdminForSelected = !!accountLower && !!adminAddress && adminAddress === accountLower;
  const canAdmin = !!account && !!selectedConfig && isAdminForSelected && hasRegistryEntry;
  const baseWorkerUrl = normalizeWorkerUrl(workerUrl);
  const canRunTests = !!baseWorkerUrl && !!account;
  const canRunHealthTest = !!baseWorkerUrl && (defaultGateIsEmpty || walletReady);
  // NOTE: For now we assume registry chain === session chain; split these if they diverge later.
  const testChainId = Number(
    selectedConfig?.__registry?.chainId ||
    selectedConfig?.networkChainId ||
    network?.id ||
    0
  ) || 0;
  const testContext = { account, providerLike: provider, chainId: testChainId };
  const testSessionConfig = selectedConfig
    ? { ...selectedConfig, corsWorkerUrl: baseWorkerUrl || selectedConfigWorkerUrl || '' }
    : null;
  const ensureWorkerSessionConfig = useCallback(async ({
    sessionConfigOverride,
    action = 'set-config',
    workerUrl: workerUrlOverride,
  }: any = {}) => {
    const sessionConfigForSync = sessionConfigOverride || selectedConfig;
    if (!sessionConfigForSync) throw new Error('Select a session first.');
    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect the admin wallet to seed worker config.');
    }
    const slug = normalizeSlug(selectedSlug);
    const baseUrl = normalizeWorkerUrl(workerUrlOverride || baseWorkerUrl || selectedConfigWorkerUrl);
    if (!baseUrl) throw new Error('Worker URL is missing.');

    const configPayload = buildWorkerSessionConfigPayload({
      sessionConfig: sessionConfigForSync,
      account,
      fallbackChainId: testChainId,
    });
    const requestBody = {
      sessionSlug: slug,
      adminAddress: configPayload.adminAddress || account,
      config: configPayload,
    };
    const { data } = await postSignedAdminRequest({
      action,
      body: requestBody,
      path: '/admin/set-config',
      chainId: testChainId,
      workerUrl: baseUrl,
    });
    upsertCachedSessionWorkerConfig({
      slug,
      sessionConfig: selectedConfig,
      config: {
        ...configPayload,
        corsWorkerUrl: baseUrl,
      },
    });
    return { data, configPayload };
  }, [
    account,
    baseWorkerUrl,
    postSignedAdminRequest,
    selectedConfigWorkerUrl,
    selectedConfig,
    selectedSlug,
    testChainId,
    toggleLoginModal,
  ]);
  const withSessionConfigRetry = useCallback(async (run: any) => {
    try {
      return await run();
    } catch (err: any) {
      const message = toStr(getErrorMessage(err, '')).toLowerCase();
      if (!shouldSeedWorkerConfigFromError(message)) throw err;
      setTestStatus('Worker config missing; seeding from selected session…');
      await ensureWorkerSessionConfig();
      return run();
    }
  }, [ensureWorkerSessionConfig]);

  const runWorkerHealthTest = async () => {
    const healthBase = normalizeWorkerUrl(baseWorkerUrl);
    if (!healthBase) {
      setTestStatus('Worker URL is missing.');
      return;
    }
    let unauthStatus = 0;
    let unauthError = '';
    setTestBusy(true);
    setTestStatus('Testing /health…');
    try {
      const unauthResp = await fetch(`${healthBase}/health`, { method: 'GET' });
      const unauthData = await unauthResp.json().catch(() => ({}));
      unauthStatus = Number(unauthResp.status || 0) || 0;
      unauthError = toStr(unauthData?.error).trim();
      if (unauthResp.ok) {
        setTestResults((prev: any) => ({ ...prev, health: `OK (${unauthData?.ts ? new Date(unauthData.ts).toISOString() : 'healthy'})` }));
        setTestStatus('Health check succeeded.');
        return;
      }
      if (unauthResp.status === 401 || unauthResp.status === 403) {
        const detail = unauthError;
        const suffix = detail ? `: ${detail}` : '';
        if (defaultGateIsEmpty) {
          if (!walletReady) {
            setTestResults((prev: any) => ({ ...prev, health: `Auth required${suffix}` }));
            setTestStatus('Health requires authentication; connect a wallet to verify.');
            return;
          }
          // Fall through to authenticated /health (some deployments always gate /health).
        }
        if (!walletReady) {
          setTestResults((prev: any) => ({ ...prev, health: `Auth required${suffix}` }));
          setTestStatus('Connect a wallet to test /health for gated sessions.');
          return;
        }
      }

      if (canAdmin) {
        try {
          await ensureWorkerSessionConfig();
        } catch (_) {
          // Fall through to withSessionConfigRetry for user-visible errors.
        }
      }
      const data = await withSessionConfigRetry(async () => {
        const resp = await fetchWorkerWithAuth(`${healthBase}/health`, {
          method: 'GET',
        }, {
          sessionSlug: selectedSlug,
          context: testContext,
          workerUrl: baseWorkerUrl,
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(payload?.error || `Health check failed (${resp.status})`);
        return payload;
      });
      setTestResults((prev: any) => ({ ...prev, health: `OK (${data?.ts ? new Date(data.ts).toISOString() : 'healthy'})` }));
      setTestStatus('Health check succeeded.');
    } catch (err: any) {
      const authMismatch = buildHealthAuthMismatchState({
        unauthStatus,
        unauthError,
        authError: getErrorMessage(err, ''),
      });
      if (authMismatch) {
        setTestResults((prev: any) => ({ ...prev, health: authMismatch.healthLabel }));
        setTestStatus(authMismatch.statusMessage);
        return;
      }
      const message = addSessionConfigHint(getErrorMessage(err, 'Health check failed.'));
      setTestResults((prev: any) => ({ ...prev, health: message }));
      setTestStatus(message);
    } finally {
      setTestBusy(false);
    }
  };

  const runWorkerAiTest = async () => {
    if (!baseWorkerUrl) {
      setTestStatus('Worker URL is missing.');
      return;
    }
    if (!account) {
      setTestStatus('Connect a wallet to run the AI test.');
      return;
    }
    setTestBusy(true);
    setTestStatus('Testing AI proxy…');
    try {
      if (canAdmin) {
        try {
          await ensureWorkerSessionConfig();
        } catch (_) {
          // Fall through to withSessionConfigRetry for user-visible errors.
        }
      }
      const aiCfg = selectedConfig?.ai && typeof selectedConfig.ai === 'object' ? selectedConfig.ai : {};
      const fastModelEntry = aiCfg?.models?.fast && typeof aiCfg.models.fast === 'object'
        ? aiCfg.models.fast
        : {};
      const fastModelCandidate = toStr(fastModelEntry.model).trim();
      const legacyModelCandidate = toStr(aiCfg?.model).trim();
      const inferredProvider = inferAiProviderFromModel(fastModelCandidate || legacyModelCandidate);
      const providerMode = normalizeAiProvider(
        fastModelEntry.provider || aiCfg?.mode || aiCfg?.provider || inferredProvider || 'openai'
      );
      const providerCfg = aiCfg?.providers?.[providerMode] || {};
      const providerModelCandidate = toStr(providerCfg.model).trim();
      const inferredFastProvider = inferAiProviderFromModel(fastModelCandidate);
      const inferredLegacyProvider = inferAiProviderFromModel(legacyModelCandidate);
      const fastModelMatchesProvider =
        !!fastModelCandidate &&
        (!inferredFastProvider || inferredFastProvider === providerMode);
      const legacyModelMatchesProvider =
        !!legacyModelCandidate &&
        (!inferredLegacyProvider || inferredLegacyProvider === providerMode);
      const model =
        (fastModelMatchesProvider ? fastModelCandidate : '') ||
        providerModelCandidate ||
        (legacyModelMatchesProvider ? legacyModelCandidate : '') ||
        (providerMode === 'openai'
          ? 'gpt-4o-mini'
          : providerMode === 'openrouter'
            ? 'openai/gpt-4o-mini'
            : providerMode === 'anthropic'
              ? 'claude-3-haiku-20240307'
              : 'gpt-4o-mini');

      const payload = {
        action: 'ai',
        provider: providerMode,
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8,
        temperature: 0,
      };

      const data = await withSessionConfigRetry(async () => {
        const resp = await fetchWorkerWithAuth(`${baseWorkerUrl}/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }, {
          sessionSlug: selectedSlug,
          context: testContext,
          workerUrl: baseWorkerUrl,
        });
        const parsed = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(parsed?.error || `AI test failed (${resp.status})`);
        return parsed;
      });
      const preview = data?.completion || data?.content?.[0]?.text || 'ok';
      setTestResults((prev: any) => ({ ...prev, ai: `OK (${preview.slice(0, 80)})` }));
      setTestStatus('AI test succeeded.');
    } catch (err: any) {
      const msg = addSessionConfigHint(getErrorMessage(err, 'AI test failed.'));
      setTestResults((prev: any) => ({ ...prev, ai: msg }));
      setTestStatus(msg);
    } finally {
      setTestBusy(false);
    }
  };

  const runWorkerArweaveTest = async () => {
    if (!baseWorkerUrl) {
      setTestStatus('Worker URL is missing.');
      return;
    }
    if (!account) {
      setTestStatus('Connect a wallet to run the Arweave test.');
      return;
    }
    setTestBusy(true);
    setTestStatus('Testing Arweave upload…');
    try {
      const payload = {
        type: 'admin-test',
        ts: new Date().toISOString(),
        slug: selectedSlug || 'general',
      };
      const txId = await withSessionConfigRetry(() => arweaveScripts.uploadDataToArweave(payload, 'json', {
        sessionConfig: testSessionConfig,
        sessionSlug: selectedSlug,
        context: testContext,
        workerUrl: baseWorkerUrl,
        arweaveJwk: toStr(secrets.arweaveJwk).trim() || undefined,
      }));
      const tx = String(txId || '').trim();
      const txLabel = tx ? `OK (tx ${tx.slice(0, 12)}…)` : 'OK';
      const txUrl = tx ? arweaveScripts.buildArweaveGatewayUrl(tx) : '';
      setTestResults((prev: any) => ({ ...prev, arweave: { label: txLabel, href: txUrl } }));
      setTestStatus('Arweave upload succeeded.');
    } catch (err: any) {
      const msg = addSessionConfigHint(getErrorMessage(err, 'Arweave test failed.'));
      setTestResults((prev: any) => ({ ...prev, arweave: msg }));
      setTestStatus(msg);
    } finally {
      setTestBusy(false);
    }
  };

  const runWorkerFaucetTest = async () => {
    if (!baseWorkerUrl) {
      setTestStatus('Worker URL is missing.');
      return;
    }
    if (!account) {
      setTestStatus('Connect a wallet to test the faucet.');
      return;
    }
    const burnAddress = ethers.Wallet.createRandom().address;
    setTestBusy(true);
    setTestStatus(`Testing faucet transfer (${shortAddress(burnAddress)})…`);
    try {
      const data = await withSessionConfigRetry(async () => {
        const resp = await fetchWorkerWithAuth(`${baseWorkerUrl}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'request_test_eth',
            address: burnAddress,
            amountEth: '0.0000001',
          }),
        }, {
          sessionSlug: selectedSlug,
          context: testContext,
          workerUrl: baseWorkerUrl,
        });
        const parsed = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const details = [
            parsed?.error,
            parsed?.rpcUrl ? `rpc=${parsed.rpcUrl}` : '',
            parsed?.chainId ? `rpcChainId=${parsed.chainId}` : '',
            parsed?.registryChainId ? `registryChainId=${parsed.registryChainId}` : '',
            parsed?.networkChainId ? `networkChainId=${parsed.networkChainId}` : '',
            parsed?.faucetChainId ? `faucetChainId=${parsed.faucetChainId}` : '',
          ].filter(Boolean).join(' | ');
          throw new Error(details || `Faucet test failed (${resp.status})`);
        }
        return parsed;
      });
      const hash = toStr(data?.txHash).trim();
      const label = hash
        ? `OK (tx ${hash.slice(0, 12)}…)`
        : `OK (sent to ${shortAddress(burnAddress)})`;
      const txUrl = hash ? buildTxExplorerUrl(hash, testChainId) : '';
      setTestResults((prev: any) => ({ ...prev, faucet: { label, href: txUrl } }));
      setTestStatus('Faucet test succeeded.');
    } catch (err: any) {
      const msg = addSessionConfigHint(getErrorMessage(err, 'Faucet test failed.'));
      setTestResults((prev: any) => ({ ...prev, faucet: msg }));
      setTestStatus(msg);
    } finally {
      setTestBusy(false);
    }
  };

  const runLitEncryptTest = async () => {
    try {
      setLitTestStatus('Encrypting with Lit…');
      setLitTestBusy(true);
      setLitTestDecrypted('');
      if (!groupMetadata) throw new Error('Select a session first.');
      if (!account) {
        if (toggleLoginModal) toggleLoginModal(true);
        throw new Error('Connect a wallet to run the Lit test.');
      }
      const hooks = getGlobalLitHooks();
      if (!hooks || typeof hooks.saveKey !== 'function') {
        throw new Error('Lit hooks not initialized.');
      }
      const litNetwork = toStr(hooks?.litNetwork).trim() || 'chipotle';
      const gate = resolveDefaultGateFromConfig(groupMetadata);
      if (!gate.sbtAddresses.length) {
        throw new Error('Default gate has no SBT addresses.');
      }
      const chainId = gate.chainId ||
        Number(groupMetadata?.networkChainId || groupMetadata?.__registry?.chainId || network?.id || 0) ||
        null;
      const litChain = resolveLitChain({ chainId });
      const accessConditions = buildSbtAccessControlConditions({
        sbtAddresses: gate.sbtAddresses,
        chainId,
        litChain,
        mode: gate.mode,
      });
      const value = toStr(litTestValue).trim() || `lit-test-${Date.now()}`;
      const envelope = await cryptoUtils.encryptEnvelopeValue(value, {
        providerLike: provider,
        account,
        chainId,
        contextLabel: `lit-test:${normalizeSlug(selectedSlug) || 'general'}`,
        lit: {
          saveKey: hooks.saveKey,
          accessControlConditions: accessConditions,
          chain: litChain,
          litNetwork,
          providerLike: provider,
        },
      });
      setLitTestEnvelope(envelope);
      setLitTestStatus('Encrypted. Click decrypt to verify.');
    } catch (err: any) {
      setLitTestStatus(getErrorMessage(err, 'Lit encryption failed.'));
    } finally {
      setLitTestBusy(false);
    }
  };

  const runLitDecryptTest = async () => {
    try {
      setLitTestStatus('Decrypting…');
      setLitTestBusy(true);
      if (!litTestEnvelope) throw new Error('Run encrypt first to generate an envelope.');
      if (!account) {
        if (toggleLoginModal) toggleLoginModal(true);
        throw new Error('Connect a wallet to decrypt.');
      }
      const hooks = getGlobalLitHooks();
      if (!hooks || typeof hooks.getKey !== 'function') {
        throw new Error('Lit hooks not initialized.');
      }
      const litNetwork = toStr(hooks?.litNetwork).trim() || 'chipotle';
      const chainId = Number(
        groupMetadata?.networkChainId || groupMetadata?.__registry?.chainId || network?.id || 0
      ) || null;
      const decrypted = await cryptoUtils.decryptEnvelopeValue(litTestEnvelope, {
        account,
        chainId,
        providerLike: provider,
        litOpts: { getKey: hooks.getKey, litNetwork, providerLike: provider },
      });
      const text = decrypted == null ? '' : String(decrypted);
      setLitTestDecrypted(text);
      setLitTestStatus(text ? 'Decrypted.' : 'Decrypted (empty).');
    } catch (err: any) {
      setLitTestStatus(getErrorMessage(err, 'Lit decrypt failed.'));
    } finally {
      setLitTestBusy(false);
    }
  };

  const SECRET_CARDS = [
    { key: 'ai', label: 'AI', fields: ['openaiKey', 'anthropicKey', 'openrouterKey'] },
    { key: 'rpc', label: 'RPC', fields: ['customRpcUrl', 'customRpcKey'] },
    { key: 'arweave', label: 'Arweave', fields: ['arweaveJwk'] },
    { key: 'faucet', label: 'Faucet', fields: ['faucetPrivateKey'] },
    { key: 'lit', label: 'Lit', fields: ['litAccountApiKey', 'litUsageApiKey'] },
  ];
  const cardHasValue = (fields: any) => fields.some((f: any) => toStr(secrets[f]).trim());
  const currentBlockSummary = Number.isFinite(Number(metadataLatestBlock)) && Number(metadataLatestBlock) > 0
    ? `Current block on ${relevantSessionChainLabel || 'selected chain'}: ${Number(metadataLatestBlock).toLocaleString()}`
    : metadataLatestBlockStatus;

  const handleUseCurrentBlockForMetadata = () => {
    const nextStart = Number(metadataLatestBlock || 0);
    if (!Number.isFinite(nextStart) || nextStart <= 0) return;
    setMetadataDraftTouched(true);
    setMetadataBlockLimitsDraft((prev: any) => ({
      ...(prev || {}),
      start: String(nextStart),
    }));
  };

  const handleSaveSessionMetadata = async () => {
    setMetadataUpdateBusy(true);
    setMetadataUpdateStatus('Uploading updated metadata…');
    try {
      if (!groupMetadata) throw new Error('Select a session first.');
      if (!canAdmin) throw new Error('Connect the admin wallet to update session metadata.');
      if (!relevantRegistryChainId) throw new Error('Registry chain id is missing.');
      if (!metadataContractsReadyForSave) {
        throw new Error('Session metadata contracts are currently synthesized defaults. Verify or edit the contract addresses before saving.');
      }

      const metadata = buildEditableSessionMetadataPayload({
        sessionConfig: groupMetadata,
        blockLimits: metadataBlockLimitsDraft,
        fallbackStart: metadataLatestBlock,
        autoFeatureSBTsBySessionSlug: metadataAutoFeatureDraft,
        hasAutoFeatureOverride: metadataAutoFeatureTouched,
        advancedDraft: metadataConfigDraft,
      });
      const uploadResult = await uploadSessionMetadata(metadata, {
        sessionConfig: selectedConfig,
        sessionSlug: selectedSlug,
        context: testContext,
        workerUrl: baseWorkerUrl,
        ...(toStr(secrets.arweaveJwk).trim() ? { arweaveJwk: toStr(secrets.arweaveJwk).trim() } : {}),
      });
      setMetadataUpdateStatus('Updating SessionRegistry metadata URI…');
      const registryResult = await updateSessionMetadataOnChain({
        providerLike: provider,
        chainId: relevantRegistryChainId,
        slug: selectedSlug,
        metadataURI: uploadResult.metadataUri,
        encryptedMetadataURI: toStr(selectedConfig?.__registry?.encryptedMetadataURI).trim(),
      });
      const nextConfig = {
        ...selectedConfig,
        ...metadata,
        __registry: {
          ...(selectedConfig?.__registry || {}),
          metadataURI: uploadResult.metadataUri,
          encryptedMetadataURI: toStr(selectedConfig?.__registry?.encryptedMetadataURI).trim(),
        },
      };
      upsertSessionRegistryCache({ config: nextConfig });
      setSessions(sessionRegistryStore.getAllSessionEntries() || []);
      setMetadataDraftTouched(false);
	      const txUrl = buildTxExplorerUrl(registryResult?.txHash, relevantRegistryChainId);
	      const baseSuccessStatus = txUrl ? `Session metadata updated. ${txUrl}` : 'Session metadata updated.';
	      let workerSyncSuffix = '';
	      try {
	        const metadataSyncWorkerUrl = normalizeWorkerUrl(
	          getUsableSessionWorkerUrl({
	            slug: selectedSlug,
	            sessionConfig: nextConfig,
	            allowSharedFallback: true,
	          }) ||
	          baseWorkerUrl ||
	          selectedConfigWorkerUrl
	        );
	        if (typeof fetch === 'function' && metadataSyncWorkerUrl) {
	          setMetadataUpdateStatus('Syncing worker config…');
	          await ensureWorkerSessionConfig({
	            sessionConfigOverride: nextConfig,
	            action: 'set-config',
	            workerUrl: metadataSyncWorkerUrl,
	          });
	          workerSyncSuffix = ' Worker config synced.';
	        } else {
	          workerSyncSuffix = ' Worker config sync skipped (worker URL missing).';
	        }
      } catch (syncError: any) {
        workerSyncSuffix = ` Worker config sync failed: ${getErrorMessage(syncError, 'unknown error')}`;
      }
      setMetadataUpdateStatus(`${baseSuccessStatus}${workerSyncSuffix}`);
    } catch (err: any) {
      setMetadataUpdateStatus(getErrorMessage(err, 'Failed to update session metadata.'));
    } finally {
      setMetadataUpdateBusy(false);
    }
  };

  const resolvedSessionHeader = normalizeArweaveUrl(
    groupMetadata?.sessionHeaderImg || groupMetadata?.sessionHeader || '',
    { contextLabel: 'session_header_image' }
  );
  useEffect(() => {
    if (!resolvedSessionHeader) {
      setHeroHeaderImageReady(false);
      return;
    }
    if (typeof Image === 'undefined') {
      setHeroHeaderImageReady(true);
      return;
    }
    let active = true;
    const img = new Image();
    setHeroHeaderImageReady(false);
    img.onload = () => {
      if (active) setHeroHeaderImageReady(true);
    };
    img.onerror = () => {
      if (active) setHeroHeaderImageReady(false);
    };
    img.src = resolvedSessionHeader;
    return () => {
      active = false;
    };
  }, [resolvedSessionHeader]);
  const selectedSlugLabel = normalizeSlug(selectedSlug) || 'general';
  const selectedSessionName = toStr(groupMetadata?.sessionName || selectedConfig?.sessionName).trim()
    || (selectedConfig ? selectedSlugLabel : 'No session selected');
  const relevantRegistryChainLabel = relevantRegistryChainId
    ? `${getChainName(relevantRegistryChainId) || 'Chain'} (${relevantRegistryChainId})`
    : '';
  const sessionUrl = getAdminSessionDisplayUrl({
    selectedSlug: selectedSlugLabel,
    selectedConfig,
    groupMetadata,
  });
  const metadataSlugValue = normalizeSlug(groupMetadata?.slug) || '';
  const metadataSlugDisplay = metadataSlugValue || 'general';
  const metadataSessionUrl = groupMetadata
    ? buildSessionUrl(metadataSlugValue, { allowGeneral: true })
    : '';
  const metadataAdminAddress = toStr(groupMetadata?.__registry?.adminAddress || groupMetadata?.adminAddress || '').trim();
  const metadataAdminUrl = buildUserPageUrl(metadataAdminAddress);
  const metadataUriValue = toStr(groupMetadata?.__registry?.metadataURI || '').trim();
  const metadataUriUrl = metadataUriValue
    ? normalizeArweaveUrl(metadataUriValue, { contextLabel: 'admin_metadata_uri' }) || metadataUriValue
    : '';
  const metadataLoadState = toStr(groupMetadata?.__registry?.metadataLoadState).trim() || (metadataUriValue ? 'loaded' : 'none');
  const metadataDefaultedContractKeys = Array.isArray(groupMetadata?.__registry?.metadataDefaultedContractKeys)
    ? groupMetadata.__registry.metadataDefaultedContractKeys
        .map((key: any) => toStr(key).trim())
        .filter(Boolean)
    : [];
  const metadataContractsNeedVerification = (
    metadataLoadState === 'unavailable' &&
    metadataDefaultedContractKeys.length > 0
  );
  const metadataDefaultedEditableContractKeys = metadataDefaultedContractKeys
    .filter((key: any) => ADMIN_EDITABLE_CONTRACT_KEY_SET.has(key));
  const metadataContractsReadyForSave = (
    !metadataContractsNeedVerification ||
    metadataDefaultedEditableContractKeys.length === 0 ||
    metadataContractsVerified ||
    metadataContractDraftTouched
  );
  const metadataLoadStateLabel = (() => {
    if (metadataLoadState === 'loaded') return 'Loaded from session metadata';
    if (metadataLoadState === 'unavailable') return 'Metadata unavailable; contracts below may be chain defaults';
    return 'No registry metadata URI configured';
  })();
  const metadataContracts = groupMetadata?.contracts && typeof groupMetadata.contracts === 'object'
    ? groupMetadata.contracts
    : {};
  const visibleMetadataContracts = Object.entries(metadataContracts).filter(([, value]: any) => value && typeof value === 'object');
  const readonlyMetadataContracts = visibleMetadataContracts.filter(
    ([key]: any) => !ADMIN_EDITABLE_CONTRACT_KEY_SET.has(key)
  );
  const sessionCardTone = selectedConfig ? 'ready' : (availableSessions.length ? 'idle' : 'warning');
  const showHeroMedia = !!resolvedSessionHeader && heroHeaderImageReady;
  const metadataOpen = openSection === 'metadata';
  const defaultGateOpen = openSection === 'defaultGate';
  const workerSecretsOpen = openSection === 'workerSecrets';
  const testsOpen = openSection === 'tests';
  const toggleSection = (key: any) => {
    setOpenSection((prev: any) => (prev === key ? '' : key));
  };
  const renderInfoTooltip = (id: any, content: any) => {
    if (!content) return null;
    return (
      <>
        <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id={id} />
        <CETooltip
          placement="right"
          trigger="hover focus click"
          target={id}
          className={styles.tooltipBubble}
        >
          {content}
        </CETooltip>
      </>
    );
  };
  const renderInlineResourceSummary = ({ key, label, resource, onRefresh, refreshLabel }: any) => {
    if (!shouldShowInlineResourceSummary(resource)) return null;
    return (
      <div key={key} className={styles.inlineResourceCard}>
        <div className={styles.inlineResourceHeader}>
          <div className={styles.resourceLabel}>{label}</div>
          <button
            type="button"
            className={styles.resourceRefreshButton}
            onClick={onRefresh}
            aria-label={refreshLabel}
            title={refreshLabel}
          >
            <FontAwesomeIcon icon={faSync} spin={resource.loading} />
          </button>
        </div>
        <div className={styles.inlineResourceBalance}>{resource.display}</div>
        <div className={styles.inlineResourceStatus}>{resource.meta}</div>
      </div>
    );
  };
  const handleCopyRawMetadata = useCallback(() => {
    if (!groupMetadata || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(JSON.stringify(groupMetadata, null, 2))
      .then(() => {
        setCopiedRawMetadataJson(true);
        if (rawMetadataCopyResetRef.current) clearTimeout(rawMetadataCopyResetRef.current);
        rawMetadataCopyResetRef.current = setTimeout(() => {
          setCopiedRawMetadataJson(false);
        }, 1500);
        notify.success('Copied metadata JSON');
      })
      .catch(() => {});
  }, [groupMetadata]);

  return (
    <div className={styles.adminPage}>
      <header className={`${styles.hero} ${!showHeroMedia ? styles.heroNoMedia : ''}`}>
        <div className={styles.heroContent}>
          <div className={styles.heroTopRow}>
            <div className={styles.heroTitleBlock}>
              <div className={styles.heroTitleRow}>
                <h1>Session Admin</h1>
                {renderInfoTooltip(
                  'admin-session-title-tip',
                  'Keep worker access, metadata, and operator checks tidy in one place.'
                )}
              </div>
            </div>
            {account && (
              <div className={`${styles.connectionBadge} ${styles.connectionBadgeActive}`}>
                Connected · {shortAddress(account)}
              </div>
            )}
          </div>
          <div className={styles.heroStats}>
            <div className={`${styles.heroStat} ${styles[`heroStat${sessionCardTone[0].toUpperCase()}${sessionCardTone.slice(1)}`]}`}>
              <div className={styles.heroSessionPrimaryRow}>
                <div className={styles.heroCardHeaderWithTooltip}>
                  <span className={styles.heroSessionDetailLabel}>Session</span>
                  {renderInfoTooltip(
                    'admin-sessions-tip',
                    'Pick the live session and confirm its worker endpoint.'
                  )}
                </div>
                <div className={styles.heroSessionPrimaryBody}>
                  {!!availableSessions.length ? (
                    <Input
                      type="select"
                      value={selectedSlug}
                      data-testid={E2E_TESTIDS.ADMIN_SESSION_SELECT}
                      className={styles.heroCardSelect}
                      onChange={(e: any) => {
                        setIgnoreRequestedSession(true);
                        setSelectedSlug(e.target.value);
                      }}
                    >
                      {!selectedSlug && requestedSessionRaw && (
                        <option value="" disabled>
                          Requested: {requestedSessionRaw}
                        </option>
                      )}
                      {availableSessions.map(([slug, cfg]: any) => (
                        <option key={slug} value={slug}>
                          {slug || 'general'}{cfg?.sessionName ? ` — ${cfg?.sessionName}` : ''}
                        </option>
                      ))}
                    </Input>
                  ) : (
                    <strong className={styles.heroStatValue}>{selectedSessionName}</strong>
                  )}
                </div>
                <div className={styles.heroCardHeaderActions}>
                  <button
                    type="button"
                    className={styles.heroCardIconButton}
                    onClick={handleRefreshSessions}
                    disabled={sessionsRefreshBusy}
                    aria-label="Refresh sessions"
                    title="Refresh sessions"
                  >
                    <FontAwesomeIcon icon={faSync} spin={sessionsRefreshBusy} />
                  </button>
                  {sessionUrl ? (
                    <a
                      href={sessionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.heroStatExternalLink}
                      aria-label="Open session"
                      title={`Open ${selectedSessionName}`}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                  ) : null}
                </div>
              </div>
              <div className={styles.heroSessionDetails}>
                <div className={`${styles.heroSessionDetailRow} ${styles.heroSessionDetailRowAlignStart}`}>
                  <div className={styles.heroCardHeaderWithTooltip}>
                    <span className={styles.heroSessionDetailLabel}>Worker URL</span>
                    {(workerStatus || workerDebug) && renderInfoTooltip(
                      'admin-worker-url-tip',
                      <div className={styles.tooltipTextStack}>
                        {workerStatus && <div>{workerStatus}</div>}
                        {workerDebug && <div>{workerDebug}</div>}
                      </div>
                    )}
                  </div>
                  {!!selectedConfig ? (
                    <div className={styles.heroSessionDetailBody}>
                      <div className={styles.heroWorkerRow}>
                        <div className={styles.heroCardInputShell}>
                          <Input
                            value={workerUrl}
                            placeholder="https://<worker-name>.<account-subdomain>.workers.dev/"
                            className={styles.heroCardInput}
                            readOnly={!workerUrlEditable}
                            onChange={workerUrlEditable ? (e: any) => setWorkerUrl(e.target.value) : undefined}
                          />
                          <div className={styles.heroCardInputActions}>
                            {workerUrl && (
                              <button
                                type="button"
                                className={`${styles.heroCardInputActionButton} ${styles.heroCardInputIconButton}`}
                                onClick={() => navigator.clipboard.writeText(workerUrl).then(() => notify.success('Copied to clipboard')).catch(() => {})}
                                title="Copy worker URL"
                                aria-label="Copy worker URL"
                            >
                              <FontAwesomeIcon icon={faClipboard} />
                            </button>
                          )}
                            <Button
                              type="button"
                              size="sm"
                              color="secondary"
                              outline
                              className={`${styles.heroCardInputActionButton} ${styles.subtleActionButton}`}
                              onClick={() => {
                                setShowTestsPanel(true);
                                setOpenSection('tests');
                              }}
                              disabled={!normalizeWorkerUrl(workerUrl || selectedConfigWorkerUrl)}
                              title="Open the worker test panel"
                            >
                              Test
                            </Button>
                            {canAdmin && (
                              <button
                                type="button"
                                className={`${styles.heroCardInputActionButton} ${styles.heroCardInputIconButton}`}
                                onClick={() => setWorkerUrlEditable((prev: any) => !prev)}
                                title={workerUrlEditable ? 'Lock worker URL' : 'Edit worker URL'}
                                aria-label={workerUrlEditable ? 'Lock worker URL' : 'Edit worker URL'}
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.heroCardActionRow}>
                        <Button
                          size="sm"
                          color="secondary"
                          outline
                          className={`${styles.actionButton} ${styles.subtleActionButton}`}
                          onClick={() => setShowAllowlistEditor((prev: any) => !prev)}
                          title={showAllowlistEditor ? 'Hide the CORS allowlist editor' : 'Show the CORS allowlist editor'}
                        >
                          Allowlist <FontAwesomeIcon icon={showAllowlistEditor ? faCaretUp : faCaretDown} />
                        </Button>
                        {showAllowlistEditor && canAdmin && (
                          <>
                            <Button
                              size="sm"
                              color="secondary"
                              outline
                              className={styles.actionButton}
                              onClick={handleSaveAllowOrigins}
                              disabled={corsPatchBusy || !workerUrl || !allowOriginsHasChanges}
                              title="Save the edited worker allowOrigins list"
                            >
                              {corsPatchBusy ? 'Saving allowlist…' : 'Save allowlist'}
                            </Button>
                            <Button
                              size="sm"
                              color="secondary"
                              outline
                              className={`${styles.actionButton} ${styles.subtleActionButton}`}
                              onClick={handleAddRecommendedAllowOrigins}
                              disabled={corsPatchBusy}
                              title="Append the current browser origin and the stable default allowlist to the draft"
                            >
                              Add recommended origins
                            </Button>
                          </>
                        )}
                      </div>
                      {showAllowlistEditor && (
                        <div className={styles.heroAllowlistEditor}>
                          <div className={styles.heroAllowlistHeader}>
                            <Label htmlFor="admin-worker-allow-origins" className={styles.heroAllowlistLabel}>
                              CORS allowlist
                            </Label>
                            <span className={styles.heroAllowlistMeta}>
                              {normalizedAllowOriginsDraft.length
                                ? `${normalizedAllowOriginsDraft.length} origin${normalizedAllowOriginsDraft.length === 1 ? '' : 's'}`
                                : 'Open CORS'}
                            </span>
                          </div>
                          <Input
                            id="admin-worker-allow-origins"
                            type="textarea"
                            value={allowOriginsDraft}
                            onChange={handleAllowOriginsDraftChange}
                            readOnly={!canAdmin}
                            placeholder={'https://app.example\nhttp://localhost:3001'}
                            className={styles.heroAllowlistInput}
                          />
                          {!normalizedAllowOriginsDraft.length && (
                            <div className={styles.warningNote}>
                              Empty allowlist: saving this draft keeps CORS open for any browser origin.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.heroSessionDetailValueGroup}>
                      <strong className={styles.heroStatValue}>No worker URL</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.heroStatusStack}>
            {!availableSessions.length && (
              <div className={styles.warningNote}>
                No sessions found in the registry{requestedChainId ? ` for chain ${requestedChainId}` : ''}.
              </div>
            )}
            {sessionsRefreshStatus && <div className={styles.statusNote}>{sessionsRefreshStatus}</div>}
            {sessionLookupStatus && <div className={styles.warningNote}>{sessionLookupStatus}</div>}
            {!!selectedConfig && account && !isAdminForSelected && (
              <div className={styles.warningNote} data-testid={E2E_TESTIDS.ADMIN_NOT_ADMIN_WARNING}>
                You are not the admin for this session; actions are disabled.
              </div>
            )}
            {corsPatchStatus && <div className={styles.statusNote}>{corsPatchStatus}</div>}
            {selectedConfig && !hasRegistryEntry && (
              <div className={styles.warningNote}>
                Session is not registered on-chain yet. Register in /new before using worker actions.
              </div>
            )}
          </div>
        </div>
        {showHeroMedia && (
          <div className={styles.heroMedia}>
            <img
              src={resolvedSessionHeader}
              alt={`${selectedSlug || 'Session'} header`}
              className={styles.sessionHeaderImage}
            />
          </div>
        )}
      </header>

      <div className={styles.sectionStack}>
      <section className={`${styles.panel} ${styles.metadataPanel}`}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <div className={styles.panelTitleRow}>
              <div className={styles.panelTitle}>Session metadata</div>
              {renderInfoTooltip(
                'admin-metadata-tip',
                'Review the canonical config and make careful live edits when needed.'
              )}
            </div>
          </div>
          <Button
            size="sm"
            color="secondary"
            outline
            className={styles.collapseToggle}
            onClick={() => toggleSection('metadata')}
            aria-label="Toggle Session metadata section"
          >
            <FontAwesomeIcon icon={metadataOpen ? faCaretUp : faCaretDown} />
          </Button>
        </div>
        {!groupMetadata && (
          <div className={styles.warningNote}>
            No metadata found for this session yet. Register the session on-chain or select a legacy demo session.
          </div>
        )}
        {metadataOpen && groupMetadata && (
          <>
            <div className={styles.metadataGrid}>
              <div className={styles.metadataItem}>
                <span>Slug</span>
                <span>
                  {metadataSessionUrl ? (
                    <a href={metadataSessionUrl} target="_blank" rel="noreferrer" className={styles.metadataLink}>
                      {metadataSlugDisplay}
                    </a>
                  ) : metadataSlugDisplay}
                </span>
              </div>
              <div className={styles.metadataItem}>
                <span>Session name</span>
                <span>{toStr(groupMetadata.sessionName || '').trim() || '—'}</span>
              </div>
              <div className={styles.metadataItem}>
                <span>Chain / Registry</span>
                <span>{(() => {
                  const chainId = toStr(groupMetadata.networkChainId || groupMetadata.__registry?.chainId || '').trim();
                  const chainName = getChainName(chainId);
                  const registryChainId = toStr(groupMetadata.__registry?.registryChainId || groupMetadata.registryChainId || '').trim();
                  const chainDisplay = chainName ? `${chainName} (${chainId})` : (chainId || '\u2014');
                  const chainNum = Number(chainId);
                  const registryNum = Number(registryChainId);
                  const sameChain = chainId && registryChainId && Number.isFinite(chainNum) && Number.isFinite(registryNum)
                    ? chainNum === registryNum
                    : registryChainId === chainId;
                  if (!registryChainId || sameChain) return chainDisplay;
                  const registryName = getChainName(registryChainId);
                  const registryDisplay = registryName ? `${registryName} (${registryChainId})` : registryChainId;
                  return `${chainDisplay} / ${registryDisplay}`;
                })()}</span>
              </div>
              <div className={styles.metadataItem}>
                <span>Admin</span>
                <span>
                  {metadataAdminUrl ? (
                    <a href={metadataAdminUrl} target="_blank" rel="noreferrer" className={styles.metadataLink}>
                      {shortAddress(metadataAdminAddress) || metadataAdminAddress}
                    </a>
                  ) : '—'}
                </span>
              </div>
              <div className={styles.metadataItem}>
                <span>Metadata URI</span>
                <span>
                  {metadataUriUrl ? (
                    <a href={metadataUriUrl} target="_blank" rel="noreferrer" className={styles.metadataLink}>
                      {metadataUriValue}
                    </a>
                  ) : '—'}
                </span>
              </div>
              <div className={styles.metadataItem}>
                <span>Metadata source</span>
                <span>{metadataLoadStateLabel}</span>
              </div>
            </div>
            {metadataContractsNeedVerification && (
              <div className={styles.warningNote}>
                Session metadata could not be loaded, so the contract addresses below are currently synthesized from chain defaults.
                Verify them before publishing any metadata update.
              </div>
            )}
            {canAdmin && (
              <div className={styles.metadataEditorCard}>
                <div className={styles.metadataEditorIntro}>
                  Publish session defaults and curation metadata here. Block limits, faucet settings,
                  contracts, and registry/RPC context are also synced to worker config when a worker URL is available.
                </div>
                <div className={styles.metadataSectionGrid}>
                  <div className={styles.metadataSectionCard}>
                    <div className={styles.panelSubtitle}>Session defaults</div>
                    <div className={styles.metadataEditorGrid}>
                      <FormGroup>
                        <Label>Default tags</Label>
                        <Input
                          value={metadataConfigDraft.defaultTags}
                          placeholder="ai, governance, survey"
                          onChange={(e: any) => updateMetadataConfigDraft('defaultTags', e.target.value)}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Default SBT tags</Label>
                        <Input
                          value={metadataConfigDraft.defaultSbtTags}
                          placeholder="member, contributor"
                          onChange={(e: any) => updateMetadataConfigDraft('defaultSbtTags', e.target.value)}
                        />
                      </FormGroup>
                    </div>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Question generation prompt</Label>
                      <Input
                        type="textarea"
                        rows={4}
                        value={metadataConfigDraft.questionsGenPrompt}
                        placeholder="Optional prompt used when auto-generating questions"
                        onChange={(e: any) => updateMetadataConfigDraft('questionsGenPrompt', e.target.value)}
                      />
                    </FormGroup>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Default filter state</Label>
                      <Input
                        type="textarea"
                        rows={4}
                        value={metadataConfigDraft.defaultFilterState}
                        placeholder='{"sort":"recent"} or tag=ai&sort=recent'
                        onChange={(e: any) => updateMetadataConfigDraft('defaultFilterState', e.target.value)}
                      />
                    </FormGroup>
                    <FormGroup check className={styles.metadataToggle}>
                      <Label check className={styles.metadataToggleLabel}>
                        <Input
                          type="checkbox"
                          checked={metadataAutoFeatureDraft}
                          onChange={(e: any) => {
                            setMetadataDraftTouched(true);
                            setMetadataAutoFeatureTouched(true);
                            setMetadataAutoFeatureDraft(!!e.target.checked);
                          }}
                        />
                        Auto-feature by session slug
                      </Label>
                    </FormGroup>
                    <FormGroup className={styles.metadataSelectorGroup}>
                      <Label>Default featured SBTs</Label>
                      <SBTSelector
                        id="admin-default-featured-sbts"
                        label=""
                        selectedSBTs={metadataConfigDraft.defaultFeaturedSBTs}
                        onAddSBT={(sbt: any) => {
                          updateMetadataConfigDraft(
                            'defaultFeaturedSBTs',
                            dedupeSbtSelections([...(metadataConfigDraft.defaultFeaturedSBTs || []), sbt])
                          );
                        }}
                        onRemoveSBT={(address: any) => {
                          updateMetadataConfigDraft(
                            'defaultFeaturedSBTs',
                            dedupeSbtSelections(metadataConfigDraft.defaultFeaturedSBTs || []).filter(
                              (entry: any) => toStr(entry.address).toLowerCase() !== toStr(address).toLowerCase()
                            )
                          );
                        }}
                        network={network}
                        chainId={relevantSessionChainId || network?.id || null}
                        sessionSlug={normalizeSlug(selectedSlug)}
                        variant="admin"
                        ensureLightSbtUniverse={ensureLightSbtUniverse}
                        defaultFeaturedSBTs={(metadataConfigDraft.defaultFeaturedSBTs || []).map((entry: any) => entry.address)}
                      />
                    </FormGroup>
                  </div>

                  <div className={styles.metadataSectionCard}>
                    <div className={styles.panelSubtitle}>AI defaults</div>
                    <div className={styles.metadataEditorGrid}>
                      <FormGroup>
                        <Label>Fast provider</Label>
                        <Input
                          type="select"
                          value={metadataConfigDraft.aiFastProvider}
                          onChange={(e: any) => updateMetadataConfigDraft('aiFastProvider', e.target.value)}
                        >
                          {ADMIN_AI_PROVIDER_OPTIONS.map((option: any) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Input>
                      </FormGroup>
                      <FormGroup>
                        <Label>Fast model</Label>
                        <Input
                          value={metadataConfigDraft.aiFastModel}
                          onChange={(e: any) => updateMetadataConfigDraft('aiFastModel', e.target.value)}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Thinking provider</Label>
                        <Input
                          type="select"
                          value={metadataConfigDraft.aiThinkingProvider}
                          onChange={(e: any) => updateMetadataConfigDraft('aiThinkingProvider', e.target.value)}
                        >
                          {ADMIN_AI_PROVIDER_OPTIONS.map((option: any) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Input>
                      </FormGroup>
                      <FormGroup>
                        <Label>Thinking model</Label>
                        <Input
                          value={metadataConfigDraft.aiThinkingModel}
                          onChange={(e: any) => updateMetadataConfigDraft('aiThinkingModel', e.target.value)}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Transcription provider</Label>
                        <Input
                          type="select"
                          value={metadataConfigDraft.aiTranscriptionProvider}
                          onChange={(e: any) => updateMetadataConfigDraft('aiTranscriptionProvider', e.target.value)}
                        >
                          <option value="openai">OpenAI</option>
                        </Input>
                      </FormGroup>
                      <FormGroup>
                        <Label>Transcription model</Label>
                        <Input
                          value={metadataConfigDraft.aiTranscriptionModel}
                          onChange={(e: any) => updateMetadataConfigDraft('aiTranscriptionModel', e.target.value)}
                        />
                      </FormGroup>
                    </div>
                  </div>

                  <div className={styles.metadataSectionCard}>
                    <div className={styles.panelSubtitle}>Runtime sync</div>
                    <div className={styles.metadataEditorGrid}>
                      <FormGroup>
                        <Label>Start block</Label>
                        <Input
                          type="number"
                          value={metadataBlockLimitsDraft.start}
                          onChange={(e: any) => {
                            setMetadataDraftTouched(true);
                            setMetadataBlockLimitsDraft((prev: any) => ({
                              ...(prev || {}),
                              start: e.target.value,
                            }));
                          }}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>End block</Label>
                        <Input
                          type="number"
                          value={metadataBlockLimitsDraft.end}
                          placeholder="Optional"
                          onChange={(e: any) => {
                            setMetadataDraftTouched(true);
                            setMetadataBlockLimitsDraft((prev: any) => ({
                              ...(prev || {}),
                              end: e.target.value,
                            }));
                          }}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Faucet amount (ETH)</Label>
                        <Input
                          value={metadataConfigDraft.faucetAmountEth}
                          placeholder="0.0002"
                          onChange={(e: any) => updateMetadataConfigDraft('faucetAmountEth', e.target.value)}
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label>Faucet threshold (ETH)</Label>
                        <Input
                          value={metadataConfigDraft.faucetBalanceThresholdEth}
                          placeholder="0.001"
                          onChange={(e: any) => updateMetadataConfigDraft('faucetBalanceThresholdEth', e.target.value)}
                        />
                      </FormGroup>
                    </div>
                    {currentBlockSummary && (
                      <div className={styles.statusNote}>{currentBlockSummary}</div>
                    )}
                    <Button
                      size="sm"
                      color="secondary"
                      outline
                      className={styles.actionButton}
                      onClick={handleUseCurrentBlockForMetadata}
                      disabled={metadataUpdateBusy || !metadataLatestBlock}
                    >
                      Use current block
                    </Button>
                  </div>

                  <div className={styles.metadataSectionCard}>
                    <div className={styles.panelSubtitle}>Contracts</div>
                    <div className={styles.metadataEditorGrid}>
                      <FormGroup>
                        <Label>Surveys contract</Label>
                        <Input
                          value={metadataConfigDraft.contractSurveysAddress}
                          placeholder="0x..."
                          onChange={(e: any) => updateMetadataConfigDraft('contractSurveysAddress', e.target.value)}
                        />
                        <FormText color="muted">
                          Chain: {relevantSessionChainLabel || 'Uses session chain'}
                        </FormText>
                      </FormGroup>
                      <FormGroup>
                        <Label>SBT factory contract</Label>
                        <Input
                          value={metadataConfigDraft.contractSbtFactoryAddress}
                          placeholder="0x..."
                          onChange={(e: any) => updateMetadataConfigDraft('contractSbtFactoryAddress', e.target.value)}
                        />
                        <FormText color="muted">
                          Chain: {relevantSessionChainLabel || 'Uses session chain'}
                        </FormText>
                      </FormGroup>
                      <FormGroup>
                        <Label>SessionRegistry contract</Label>
                        <Input
                          value={metadataConfigDraft.contractSessionRegistryAddress}
                          placeholder="0x..."
                          onChange={(e: any) => updateMetadataConfigDraft('contractSessionRegistryAddress', e.target.value)}
                        />
                        <FormText color="muted">
                          Chain: {relevantRegistryChainLabel || relevantSessionChainLabel || 'Uses registry chain'}
                        </FormText>
                      </FormGroup>
                    </div>
                    {metadataContractsNeedVerification && metadataDefaultedEditableContractKeys.length > 0 && (
                      <FormGroup check className={styles.metadataToggle}>
                        <Label check className={styles.metadataToggleLabel}>
                          <Input
                            type="checkbox"
                            checked={metadataContractsVerified}
                            onChange={(e: any) => setMetadataContractsVerified(!!e.target.checked)}
                          />
                          I verified these fallback defaults and want to publish them if I save metadata
                        </Label>
                      </FormGroup>
                    )}
                    {metadataContractsNeedVerification && !metadataContractsReadyForSave && (
                      <div className={styles.warningNote}>
                        Saving is blocked until you verify or edit the synthesized contract addresses above.
                      </div>
                    )}
                    {readonlyMetadataContracts.length ? (
                      <div className={styles.metadataReadonlyGrid}>
                        {readonlyMetadataContracts.map(([key, value]: any) => (
                          <div key={key} className={styles.metadataReadonlyItem}>
                            <span>{key}</span>
                            <strong>{toStr(value?.address).trim() || '—'}</strong>
                            <span>{toStr(value?.chainId).trim() || '—'}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!visibleMetadataContracts.length && (
                      <div className={styles.statusNote}>No contract metadata found for this session.</div>
                    )}
                  </div>
                </div>

                <div className={styles.metadataSectionCard}>
                  <div className={styles.panelSubtitle}>Curated lists</div>
                  <div className={styles.metadataSectionGrid}>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Highlighted question IDs</Label>
                      <Input
                        type="textarea"
                        rows={3}
                        value={metadataConfigDraft.highlightedQuestionIds}
                        placeholder="One question id per line"
                        onChange={(e: any) => updateMetadataConfigDraft('highlightedQuestionIds', e.target.value)}
                      />
                    </FormGroup>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Blocked question IDs</Label>
                      <Input
                        type="textarea"
                        rows={3}
                        value={metadataConfigDraft.blockedQuestionIds}
                        placeholder="One question id per line"
                        onChange={(e: any) => updateMetadataConfigDraft('blockedQuestionIds', e.target.value)}
                      />
                    </FormGroup>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Highlighted survey IDs</Label>
                      <Input
                        type="textarea"
                        rows={3}
                        value={metadataConfigDraft.highlightedSurveyIds}
                        placeholder="One survey id per line"
                        onChange={(e: any) => updateMetadataConfigDraft('highlightedSurveyIds', e.target.value)}
                      />
                    </FormGroup>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Blocked survey IDs</Label>
                      <Input
                        type="textarea"
                        rows={3}
                        value={metadataConfigDraft.blockedSurveyIds}
                        placeholder="One survey id per line"
                        onChange={(e: any) => updateMetadataConfigDraft('blockedSurveyIds', e.target.value)}
                      />
                    </FormGroup>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Ignored SBT list</Label>
                      <Input
                        type="textarea"
                        rows={3}
                        value={metadataConfigDraft.ignoredSbtsList}
                        placeholder="One SBT address per line"
                        onChange={(e: any) => updateMetadataConfigDraft('ignoredSbtsList', e.target.value)}
                      />
                    </FormGroup>
                    <FormGroup className={styles.metadataTextAreaGroup}>
                      <Label>Featured SBT list</Label>
                      <Input
                        type="textarea"
                        rows={3}
                        value={metadataConfigDraft.featuredSbtsList}
                        placeholder="One SBT address per line"
                        onChange={(e: any) => updateMetadataConfigDraft('featuredSbtsList', e.target.value)}
                      />
                    </FormGroup>
                  </div>
                </div>

                <div className={styles.metadataEditorActions}>
                  <Button
                    color="primary"
                    className={styles.actionButton}
                    onClick={handleSaveSessionMetadata}
                    disabled={metadataUpdateBusy}
                  >
                    {metadataUpdateBusy ? 'Updating metadata…' : 'Update metadata'}
                  </Button>
                </div>
                {metadataUpdateStatus && <div className={styles.statusNote}>{metadataUpdateStatus}</div>}
              </div>
            )}
            <div className={styles.metadataJsonSection}>
              <div className={styles.resultBoxLabel}>Raw metadata</div>
              <JsonPanel
                onCopy={handleCopyRawMetadata}
                copied={copiedRawMetadataJson}
                copyTitle="Copy raw metadata JSON"
                as="pre"
                contentProps={{ className: styles.metadataJsonContent }}
                className={styles.metadataJsonPanel}
              >
                {JSON.stringify(groupMetadata, null, 2)}
              </JsonPanel>
            </div>
          </>
        )}
      {!!Object.keys(encryptedFields || {}).length && (
        <>
          <div className={styles.panelHeader}>
            <div className={styles.panelSubtitle} style={{ margin: 0 }}>
              Encrypted fields
            </div>
            <Button
              size="sm"
              color="secondary"
              outline
              onClick={handleDecryptEncryptedFields}
              disabled={decryptFieldsBusy || !walletReady}
              title={!walletReady ? 'Connect a wallet to decrypt fields' : 'Decrypt fields (wallet signature prompts)'}
            >
              {decryptFieldsBusy ? 'Decrypting…' : 'Decrypt'}
            </Button>
          </div>
          {!walletReady && (
            <div className={styles.statusNote}>
              Connect a wallet to decrypt these fields.
            </div>
          )}
          <div className={styles.grid}>
            {Object.entries(encryptedFields).map(([key, envelope]: any) => {
                const resolved = decryptedFields[key] || {};
                const status = resolved.status || 'locked';
                const decrypted = toStr(resolved.value);
                const decryptedPreview = decrypted ? formatPreviewValue(decrypted) : null;
                return (
                  <div
                    key={key}
                    className={`${styles.statusItem} ${!decryptedPreview ? styles.statusItemClickable : ''}`}
                    onClick={() => { if (!decryptedPreview && !decryptFieldsBusy) handleDecryptEncryptedFields(); }}
                    role={!decryptedPreview ? 'button' : undefined}
                    title={!decryptedPreview ? (walletReady ? 'Click to decrypt' : 'Connect wallet to decrypt') : undefined}
                  >
                    <span>{key}</span>
                    <span>{decryptedPreview || '[encrypted]'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className={`${styles.panel} ${styles.gatePanel}`}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <div className={styles.panelTitleRow}>
              <div className={styles.panelTitle}>On-chain default gate</div>
              {renderInfoTooltip(
                'admin-default-gate-tip',
                'Match the default worker-auth gate to the session’s intended access model.'
              )}
            </div>
          </div>
          <Button
            size="sm"
            color="secondary"
            outline
            className={styles.collapseToggle}
            onClick={() => toggleSection('defaultGate')}
            aria-label="Toggle On-chain default gate section"
          >
            <FontAwesomeIcon icon={defaultGateOpen ? faCaretUp : faCaretDown} />
          </Button>
        </div>
        {defaultGateOpen && (
          <>
            <div className={styles.formRow}>
              <FormGroup>
                <Label className={styles.gateLabelRow}>
                  <span>Default gate SBTs</span>
                  <Input
                    type="select"
                    value={defaultGateDraft.mode}
                    data-testid={E2E_TESTIDS.ADMIN_GATE_MODE_SELECT}
                    onChange={(e: any) => {
                      setDefaultGateTouched(true);
                      setGateConfigDirty(true);
                      setDefaultGateDraft((prev: any) => ({ ...prev, mode: e.target.value }));
                    }}
                    className={styles.gateModeSelect}
                  >
                    <option value="any">ANY</option>
                    <option value="all">ALL</option>
                  </Input>
                </Label>
                <SBTSelector
                  id="admin-default-gate-sbts"
                  label=""
                  selectedSBTs={dedupeSbtSelections(defaultGateDraft.sbts || [])}
                  onAddSBT={(sbt: any) => {
                    setDefaultGateTouched(true);
                    setGateConfigDirty(true);
                    setDefaultGateDraft((prev: any) => ({
                      ...prev,
                      sbts: dedupeSbtSelections([...(prev.sbts || []), sbt]),
                    }));
                  }}
                  onRemoveSBT={(address: any) => {
                    setDefaultGateTouched(true);
                    setGateConfigDirty(true);
                    setDefaultGateDraft((prev: any) => ({
                      ...prev,
                      sbts: dedupeSbtSelections(prev.sbts || []).filter(
                        (entry: any) => toStr(entry.address).toLowerCase() !== toStr(address).toLowerCase()
                      ),
                    }));
                  }}
                  network={network}
                  chainId={
                    Number(selectedConfig?.networkChainId || selectedConfig?.__registry?.chainId || network?.id || 0) ||
                    null
                  }
                  sessionSlug={normalizeSlug(selectedSlug)}
                  variant="admin"
                  ensureLightSbtUniverse={ensureLightSbtUniverse}
                />
              </FormGroup>
            </div>
            <Button
              color="primary"
              className={styles.actionButton}
              onClick={handleSyncDefaultGate}
              data-testid={E2E_TESTIDS.ADMIN_GATE_UPDATE_BUTTON}
              disabled={!canAdmin || gateSyncBusy}
              style={{ opacity: gateConfigDirty ? 1 : 0.5 }}
            >
              Update default gate on-chain
            </Button>
            {gateSyncStatus && (
              <div className={styles.statusNote} data-testid={E2E_TESTIDS.ADMIN_GATE_STATUS}>
                {gateSyncStatus}
              </div>
            )}
            {gateSyncResult && <div className={styles.statusNote}>{renderTestResult(gateSyncResult)}</div>}
          </>
        )}
      </section>

      <section className={`${styles.panel} ${styles.secretsPanel}`}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <div className={styles.panelTitleRow}>
              <div className={styles.panelTitle}>Worker secrets</div>
              {renderInfoTooltip(
                'admin-worker-secrets-tip',
                'Edit operator credentials without revealing what is already stored in the worker.'
              )}
            </div>
          </div>
          <Button
            size="sm"
            color="secondary"
            outline
            className={styles.collapseToggle}
            onClick={() => toggleSection('workerSecrets')}
            aria-label="Toggle Worker secrets section"
          >
            <FontAwesomeIcon icon={workerSecretsOpen ? faCaretUp : faCaretDown} />
          </Button>
        </div>
        {workerSecretsOpen && (
          <>
            <div className={styles.secretOptionsGrid}>
              {SECRET_CARDS.map((card: any) => {
                const isOpen = openSecretCards[card.key];
                const hasValue = cardHasValue(card.fields);
                return (
                  <div key={card.key} className={`${styles.secretOptionCard}${isOpen ? ` ${styles.activeOption}` : ''}`}>
                    <button
                      type="button"
                      className={styles.secretOptionHeader}
                      aria-label={card.label}
                      onClick={() => setOpenSecretCards((p: any) => ({ ...p, [card.key]: !p[card.key] }))}
                      aria-expanded={isOpen}
                    >
                      <FontAwesomeIcon icon={hasValue ? faLock : faLockOpen} style={{ opacity: hasValue ? 0.9 : 0.4, marginRight: 8 }} />
                      <span className={styles.secretOptionText}>
                        <span>{card.label}</span>
                        <span className={styles.secretOptionMeta}>{hasValue ? 'Configured' : 'Empty'}</span>
                      </span>
                      <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} style={{ marginLeft: 'auto' }} />
                    </button>
                    {isOpen && (
                      <div className={styles.secretOptionBody}>
                        {card.fields.map((fieldKey: any) => {
                          const secretFieldKey = String(fieldKey);
                          const isTextarea = secretFieldKey === 'arweaveJwk';
                          const isPassword = !isTextarea && secretFieldKey !== 'customRpcUrl';
                          const secretFieldLabels: Record<string, string> = {
                            openaiKey: 'OpenAI API key',
                            anthropicKey: 'Anthropic API key',
                            openrouterKey: 'OpenRouter API key',
                            customRpcUrl: 'Custom RPC URL',
                            customRpcKey: 'Custom RPC key',
                            arweaveJwk: 'Arweave JWK (JSON)',
                            faucetPrivateKey: 'Faucet private key',
                            litAccountApiKey: 'Lit account API key',
                            litUsageApiKey: 'Lit usage API key',
                          };
                          const label = secretFieldLabels[secretFieldKey] || secretFieldKey;
                          return (
                            <FormGroup key={secretFieldKey}>
                              <Label>{label}</Label>
                              <div className={`${styles.secretInputRow}${isTextarea ? ` ${styles.secretInputRowMultiline}` : ''}`}>
                                <Input
                                  type={isTextarea ? 'textarea' : isPassword ? 'password' : 'text'}
                                  rows={isTextarea ? 3 : undefined}
                                  value={secrets[secretFieldKey]}
                                  onChange={(e: any) => handleSecretChange(secretFieldKey, e.target.value)}
                                  className={styles.secretInput}
                                />
                                <button
                                  type="button"
                                  className={`${styles.secretRemoveButton}${clearedSecretKeys.has(secretFieldKey) ? ` ${styles.secretRemoveButtonActive}` : ''}`}
                                  onClick={() => handleClearSecret(secretFieldKey)}
                                  title={`Clear ${label} on next save`}
                                  aria-label={`Clear ${label}`}
                                  data-testid={`ce-admin-secret-remove-${secretFieldKey.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
                                >
                                  <FontAwesomeIcon icon={faTimes} />
                                </button>
                              </div>
                              {secretFieldKey === 'litAccountApiKey' ? (
                                <div className={styles.warningNote}>
                                  Anyone with this key can create new Lit groups, PKPs, usage keys, and actions inside that bundle-owned Lit account. Use disposable per-bundle accounts instead of a shared deployment account.
                                </div>
                              ) : null}
                            </FormGroup>
                          );
                        })}
                        {card.key === 'arweave' && renderInlineResourceSummary({
                          key: 'arweave-resource',
                          label: 'Arweave balance',
                          resource: arweaveResource,
                          onRefresh: refreshArweaveResource,
                          refreshLabel: 'Refresh Arweave balance',
                        })}
                        {card.key === 'faucet' && renderInlineResourceSummary({
                          key: 'faucet-resource',
                          label: 'Faucet balance',
                          resource: faucetResource,
                          onRefresh: refreshFaucetResource,
                          refreshLabel: 'Refresh faucet balance',
                        })}
                        {card.key === 'lit' && renderInlineResourceSummary({
                          key: 'lit-resource',
                          label: litResourceLabel,
                          resource: litResource,
                          onRefresh: () => refreshLitResource({ includeSignedStatus: true }),
                          refreshLabel: 'Refresh Lit status',
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {canAdmin && workerSecretsDirty && (
              <Button
                color="primary"
                className={styles.actionButton}
                onClick={handleSaveWorkerSecrets}
                disabled={!canAdmin}
              >
                Save worker secrets
              </Button>
            )}
            {saveStatus && <div className={styles.statusNote}>{saveStatus}</div>}
            {chainStatus && <div className={styles.statusNote}>{chainStatus}</div>}
          </>
        )}
      </section>

      {showTestsPanel && (
      <section className={`${styles.panel} ${styles.testsPanel}`}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <div className={styles.panelTitleRow}>
              <div className={styles.panelTitle}>Tests</div>
              {renderInfoTooltip(
                'admin-tests-tip',
                <div className={styles.tooltipTextStack}>
                  <div>Run quick checks against the selected worker and the session&apos;s gate rules.</div>
                  <div>Run these as a user who holds the sponsored SBT. Tests use the configured worker URL and auth flow.</div>
                </div>
              )}
            </div>
          </div>
          <Button
            size="sm"
            color="secondary"
            outline
            className={styles.collapseToggle}
            onClick={() => {
              setShowTestsPanel(false);
              setOpenSection((prev: any) => (prev === 'tests' ? '' : prev));
            }}
            aria-label="Toggle Tests section"
          >
            <FontAwesomeIcon icon={testsOpen ? faCaretUp : faCaretDown} />
          </Button>
        </div>
        {testsOpen && (
          <>
        <div className={styles.panelTitleRow}>
          <div className={styles.panelSubtitle}>Lit quick test (no worker)</div>
          {renderInfoTooltip(
            'admin-lit-test-tip',
            'Uses the selected session’s default gate + Lit hooks. Does not call the worker.'
          )}
        </div>
        <FormGroup>
          <Label>Lit test value</Label>
          <Input
            type="textarea"
            rows="2"
            value={litTestValue}
            onChange={(e: any) => setLitTestValue(e.target.value)}
            placeholder="Type a short test string"
          />
        </FormGroup>
        <div className={`${styles.formRow} ${styles.litActionRow}`}>
          <Button
            color="primary"
            outline
            className={styles.actionButton}
            onClick={runLitEncryptTest}
            disabled={litTestBusy}
          >
            Encrypt
          </Button>
          <Button
            color="primary"
            outline
            className={styles.actionButton}
            onClick={runLitDecryptTest}
            disabled={litTestBusy || !litTestEnvelope}
          >
            Decrypt
          </Button>
        </div>
        {litTestStatus && <div className={styles.statusNote}>{litTestStatus}</div>}
        {litTestEnvelope && (
          <div className={styles.resultBox}>
            <div>Envelope</div>
            <pre>{litTestEnvelope}</pre>
          </div>
        )}
        {litTestDecrypted && (
          <div className={styles.statusNote}>
            Decrypted: {litTestDecrypted}
          </div>
        )}
        <div className={styles.inlineRow}>
          <Label>
            Transcription test (AudioInput)
            {!canRunTests && renderInfoTooltip(
              'admin-transcription-tip',
              'Connect a wallet and set a worker URL to test transcription.'
            )}
          </Label>
          {canRunTests ? (
            <AudioInput
              placeholder="Record a short clip to test /transcribe…"
              updateFunction={(next: any) => {
                setTranscribeText(next);
                const trimmed = toStr(next).trim();
                setTestResults((prev: any) => ({ ...prev, transcribe: trimmed ? `OK (${trimmed.slice(0, 80)})` : '' }));
              }}
              toggleEncryption={() => {}}
              value={transcribeText}
              encrypted={false}
              hideEncryption
              disableEncryption
              enableAiRewrite={false}
              sessionSlug={normalizeSlug(selectedSlug)}
              sessionConfig={testSessionConfig}
              context={testContext}
              workerUrl={baseWorkerUrl}
            />
          ) : null}
        </div>
        {testStatus && <div className={styles.statusNote}>{testStatus}</div>}
        <div className={styles.grid}>
            <div
              className={`${styles.statusItem} ${canRunHealthTest ? styles.statusItemClickable : ''}`}
              onClick={() => {
                if (!testBusy && canRunHealthTest) runWorkerHealthTest();
              }}
              role={canRunHealthTest ? 'button' : undefined}
              tabIndex={canRunHealthTest ? 0 : -1}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter' && !testBusy && canRunHealthTest) runWorkerHealthTest();
              }}
              title={(() => {
                if (!baseWorkerUrl) return 'Set a worker URL to test /health';
                if (!defaultGateIsEmpty && !walletReady) return 'Connect a wallet to run the gated access test.';
                return 'Click to test /health';
              })()}
              id={!defaultGateIsEmpty && !walletReady ? 'admin-health-test-chip' : undefined}
            >
            <span>Health</span>
            <span>{testBusy ? 'Testing\u2026' : renderTestResult(testResults.health)}</span>
          </div>
          {!defaultGateIsEmpty && !walletReady && (
            <CETooltip
              placement="top"
              trigger="hover focus click"
              target="admin-health-test-chip"
              className={styles.tooltipBubble}
            >
              Connect a wallet to run the gated access test.
            </CETooltip>
          )}
          <div
            className={`${styles.statusItem} ${account ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!testBusy && account) runWorkerAiTest();
            }}
            role={account ? 'button' : undefined}
            tabIndex={account ? 0 : -1}
            onKeyDown={(e: any) => { if (e.key === 'Enter' && !testBusy && account) runWorkerAiTest(); }}
            title="Click to test AI"
          >
            <span>AI</span>
            <span>{testBusy ? 'Testing\u2026' : renderTestResult(testResults.ai)}</span>
          </div>
          <div
            className={`${styles.statusItem} ${account ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!testBusy && account) runWorkerArweaveTest();
            }}
            role={account ? 'button' : undefined}
            tabIndex={account ? 0 : -1}
            onKeyDown={(e: any) => { if (e.key === 'Enter' && !testBusy && account) runWorkerArweaveTest(); }}
            title="Click to test Arweave upload"
          >
            <span>Arweave</span>
            <span>{testBusy ? 'Testing\u2026' : renderTestResult(testResults.arweave)}</span>
          </div>
          <div
            className={`${styles.statusItem} ${account ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!testBusy && account) runWorkerFaucetTest();
            }}
            role={account ? 'button' : undefined}
            tabIndex={account ? 0 : -1}
            onKeyDown={(e: any) => { if (e.key === 'Enter' && !testBusy && account) runWorkerFaucetTest(); }}
            title="Click to test faucet (0.0000001)"
          >
            <span>Faucet</span>
            <span>{testBusy ? 'Testing\u2026' : renderTestResult(testResults.faucet)}</span>
          </div>
          <div className={styles.statusItem}>
            <span>Transcribe</span>
            <span>{renderTestResult(testResults.transcribe)}</span>
          </div>
        </div>
        <div className={styles.panelTitleRow} style={{ marginTop: 16 }}>
          <div className={styles.panelTitle}>Negative tests (denied access)</div>
          {renderInfoTooltip(
            'admin-negative-tests-tip',
            'Connect a wallet that does NOT hold the sponsored SBT. Each test expects a 403 during login.'
          )}
        </div>
        {deniedStatus && <div className={styles.statusNote}>{deniedStatus}</div>}
        <div className={styles.grid}>
          <div
            className={`${styles.statusItem} ${!deniedBusy ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!deniedBusy) runDeniedAccessTest('login');
            }}
            role={!deniedBusy ? 'button' : undefined}
            tabIndex={!deniedBusy ? 0 : -1}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter' && !deniedBusy) runDeniedAccessTest('login');
            }}
            title="Click to test login denied"
            data-testid="ce-admin-denied-chip-login"
          >
            <span>Login</span>
            <span>{renderTestResult(deniedResults.login)}</span>
          </div>
          <div
            className={`${styles.statusItem} ${!deniedBusy ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!deniedBusy) runDeniedAccessTest('ai');
            }}
            role={!deniedBusy ? 'button' : undefined}
            tabIndex={!deniedBusy ? 0 : -1}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter' && !deniedBusy) runDeniedAccessTest('ai');
            }}
            title="Click to test AI denied"
            data-testid="ce-admin-denied-chip-ai"
          >
            <span>AI</span>
            <span>{renderTestResult(deniedResults.ai)}</span>
          </div>
          <div
            className={`${styles.statusItem} ${!deniedBusy ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!deniedBusy) runDeniedAccessTest('arweave');
            }}
            role={!deniedBusy ? 'button' : undefined}
            tabIndex={!deniedBusy ? 0 : -1}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter' && !deniedBusy) runDeniedAccessTest('arweave');
            }}
            title="Click to test Arweave denied"
            data-testid="ce-admin-denied-chip-arweave"
          >
            <span>Arweave</span>
            <span>{renderTestResult(deniedResults.arweave)}</span>
          </div>
          <div
            className={`${styles.statusItem} ${!deniedBusy ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!deniedBusy) runDeniedAccessTest('transcribe');
            }}
            role={!deniedBusy ? 'button' : undefined}
            tabIndex={!deniedBusy ? 0 : -1}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter' && !deniedBusy) runDeniedAccessTest('transcribe');
            }}
            title="Click to test transcription denied"
            data-testid="ce-admin-denied-chip-transcribe"
          >
            <span>Transcribe</span>
            <span>{renderTestResult(deniedResults.transcribe)}</span>
          </div>
          <div
            className={`${styles.statusItem} ${!deniedBusy ? styles.statusItemClickable : ''}`}
            onClick={() => {
              if (!deniedBusy) runDeniedAccessTest('faucet');
            }}
            role={!deniedBusy ? 'button' : undefined}
            tabIndex={!deniedBusy ? 0 : -1}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter' && !deniedBusy) runDeniedAccessTest('faucet');
            }}
            title="Click to test faucet denied"
            data-testid="ce-admin-denied-chip-faucet"
          >
            <span>Faucet</span>
            <span>{renderTestResult(deniedResults.faucet)}</span>
          </div>
        </div>
          </>
        )}
      </section>
      )}
      </div>
    </div>
  );
};

export default AdminPage;
