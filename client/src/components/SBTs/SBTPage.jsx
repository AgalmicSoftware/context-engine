/** @file SBTPage.jsx */

import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faLock, faCopy, faCheck, faBookmark, faExpand, faChevronUp, faChevronDown, faUser, faSpinner, faArrowLeft, faInfinity, faTimes, faExternalLinkAlt, faInfoCircle, faCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalHeader, ModalBody, Alert } from 'reactstrap';
import { ethers } from 'ethers';
import contractScripts from '../../utilities/web3/contractScripts.js';
import {
  getChainLabelById,
  getDemoSessionConfigBySlug,
  getSessionSlugByName,
  getSessionChainId,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { getChainBlockTimeMs } from '../../variables/chains.js';
import { getShortenedAddress, getShortenedTransactionHash } from '../../utilities/ui/displayHelpers.js';
import styles from './SBTPage.module.scss';
import SBTFilter from '../SBTs/SBTFilter';
import contextEngineLoadingGif from '../../assets/img/context_engine_logo_animation.gif';
import defaultSbtImage from '../../assets/img/ce_circuit_logo.png';
import DocumentLibraryPanel from '../DocumentLibrary/DocumentLibraryPanel.jsx';

import { cryptoUtils } from 'utilities/crypto/cryptography.js';
import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { getGlobalLitHooks, litStorage } from 'utilities/crypto/litProtocol.js';
import { createLogger } from 'utilities/logging.js';
import { sessionRegistryStore } from '../../utilities/web3/sessionRegistry.js';
import { buildArweaveGatewayUrlCandidates, normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { listNamespaceEntriesSync, peekCacheSync, readCache, writeCache } from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { notify } from '../../utilities/ui/notify.js';
import {
  getSbtDescriptionText,
  getSbtDisplayName,
  getSbtMaskedFieldValue,
  isSbtFieldLocked,
} from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { isCryptoMode, sbtBasePath, sbtsListPath, t } from '../../utilities/ui/terminology.js';
import CETooltip from '../Shared/CETooltip';

const sbtLog = createLogger('sbt');
const inviteLog = createLogger('inviteDebug');
const buildSessionRoutePath = (slugRaw = '', basePath = '') => {
  const slug = normalizeSessionSlug(slugRaw || '');
  const normalizedBasePath = String(basePath || '').replace(/\/+$/, '');
  return normalizedBasePath + (slug ? `/session/${encodeURIComponent(slug)}` : '/session');
};


const resolveSbtAddress = (input) => {
  if (Array.isArray(input)) {
    const found = input.find(entry => entry && entry.sbtAddress !== undefined);
    return found ? found.sbtAddress : null;
  }
  if (input && input.sbtAddress !== undefined) return input.sbtAddress;
  return input || null;
};

class SBTPage extends Component {
  _isMounted = false;
  hasAttemptedListMint = false; // Flag for sequential minting
  // Per-instance guards (no background loops)
  _metaHydrationTried = {};     // key: `${netId}:${addrLower}` => true
  _eventScanTried = {};         // key: `${netId}:${addrLower}` => true
  _descDecryptTried = {};       // key: `${netId}:${addrLower}:${account}` => true
  _activeScanKey = null;
  _loadSbtInfoInFlight = false;
  _loadSbtInfoPending = false;
  _loadSbtInfoPendingForce = false;
  _loadSbtInfoPendingOptions = null;
  _latestLoadSbtInfoRequestKey = '';
  _localStorageWriteCache = {};
  _queuedLocalStorageWrites = new Map();
  _localStorageWriteTimer = null;
  _netHoldersMemo = {
    mintedRef: null,
    burnedRef: null,
    mintedSignature: '',
    burnedSignature: '',
    result: [],
  };
  _filteredMintedUsersSignatureMemo = {
    listRef: null,
    listToken: '',
    signature: '',
  };
  _sessionSBTAddressesKey = '';
  _sessionSBTAddressesValue = [];
  _decryptedImageBlobUrl = '';

  state = {
    sbtInfo: null,
    userHasSBT: false,
    userIsSbtAdmin: false,
    claimCountdown: 5,
    error: null,
    copiedAddress: null,
    network: this.props.network,
    bookmarked: false,
    showModal: false,
    showFullImage: false,
    mintedAddresses: [],
    burnedAddresses: [],
    countsLoaded: false,
    // Guards stale-while-revalidate holder preservation so we never carry counts across a different SBT/network.
    holdersMetaKey: null,
    mintedTokensOverride: null,
    showStats: true,
    showActions: true,
    showMoreDetails: false,
    showAdminSection: false,
    showDocsSection: true,
    intervalId: null,
    loadingMintersBurners: true,
    mintingStatus: 'idle',
    burningStatus: 'idle',
    mintPassword: '',
    groupPasswordInput: '',
    mintStep: 0,
    relevantQuestions: [],
    relevantDocuments: [],
    showPasswordAlert: false,
    mintCountdown: null,
    transactionHash: null,
    burnSearchInput: '',
    burnSearchResult: null,
    burnSearchType: null,
    filteredMintedUsers: [],
    filteredMintedUsersSignature: '',
    loadingMintedFilter: false,
    lastTransactionType: null,
    adminInvitesToGenerate: '',
    adminGeneratedPasswords: [],
    manualPasswordInput: '',
    createGroupMode: false,
    passwordGenerationCount: '',
    mintingAddressesFilterInitialized: false,
    includePreviousPasswords: false,
    exportFormat: 'json',
    cachedPasswords: [],
    newPasswords: [],
    lastMintTxHash: null,
    lastBurnTxHash: null,
    showMiniPasswordInput: false,
    hasGroupPasswordMint: false,
    hasInviteMint: false,
    groupPasswordHash: null,
    groupPasswordHashLoaded: false,
    docModalOpen: false,
    docModalLoading: false,
    docModalError: '',
    docModalContent: '',
    docModalName: '',
    docModalBlobUrl: '',
    resolvedSessionSlug: null,
    logScanProgress: null,
    displayImageFallbackKey: '',
    displayImageFallbackIndex: 0,
  };

  getActiveChainId = () => {
    const networkChainId = Number(this.state?.network?.id || this.props?.network?.id || 0);
    if (networkChainId > 0) return networkChainId;
    const sbtChainId = Number(this.state?.sbtInfo?.chainID || this.state?.sbtInfo?.chainId || 0);
    if (sbtChainId > 0) return sbtChainId;
    const sessionChainId = Number(getSessionChainId(this.getEffectiveSessionSlug()) || 0);
    return sessionChainId > 0 ? sessionChainId : null;
  };

  getActiveBlockTimeMs = (multiplier = 1) => {
    const factor = Number(multiplier || 1);
    const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
    return Math.round(getChainBlockTimeMs(this.getActiveChainId()) * safeFactor);
  };

  componentDidMount() {
    this._isMounted = true;
    const { SBTAddress } = this.props;
    (async () => {
      if (SBTAddress) {
        await this.loadSBTInfo();
      }
      this.startMintingEndCountdown();
      this.checkForMintPassword();
      this.fetchRelevantInfo();
      this.loadCachedPasswords();

      // Demo/modern auto-mint (prop-driven)
      if (this.props.autoMintingMode && typeof this.props.sbtMintPassword === 'string' && !this.state.userHasSBT && this.state.mintingStatus === 'idle' && this.state.sbtInfo) {
        this.handleMint();
      }
      if (this.props.loginComplete && this.props.autoMintingMode && Array.isArray(this.props.sbtMintPassword) && !this.hasAttemptedListMint) {
        this.hasAttemptedListMint = true;
        this.attemptMintWithPasswordList(this.props.sbtMintPassword);
      }

      try {
        await this.handleUrlAutoMintIntent();
      } catch (err) {
        sbtLog.warn("Error parsing auto-mint params:", err);
      }
    })().catch(e => sbtLog.warn('componentDidMount async error:', e));
  }

  componentDidUpdate(prevProps, prevState) {
    const { SBTAddress, network, sbtMintPassword, account, sbtCacheRevision, autoMintingMode, loginComplete } = this.props;

    const prevAddress = resolveSbtAddress(prevProps.SBTAddress);
    const nextAddress = resolveSbtAddress(SBTAddress);
    const sbtAddressChanged =
      String(prevAddress || '').toLowerCase() !== String(nextAddress || '').toLowerCase();

    if (sbtAddressChanged || (network?.id !== prevProps.network?.id)) {
      if (this._isMounted) {
        const resetMintUiState = sbtAddressChanged ? {
          showMiniPasswordInput: false,
          mintStep: 0,
          mintingStatus: 'idle',
          burningStatus: 'idle',
          manualPasswordInput: '',
          groupPasswordInput: '',
          mintPassword: '',
          showPasswordAlert: false,
          error: null
        } : null;

        if (network && network.id !== this.state.network?.id) {
          this.setState({ ...(resetMintUiState || {}), network: network }, () => {
            if (this._isMounted) {
              this.loadSBTInfo();
              this.checkForMintPassword();
            }
          });
        } else {
          if (resetMintUiState) {
            this.setState(resetMintUiState);
          }
          this.loadSBTInfo();
          this.checkForMintPassword();
        }
      }
      return;
    }

    const prevSessionSlug = prevProps.sessionSlug ?? prevProps.slug ?? '';
    const nextSessionSlug = this.props.sessionSlug ?? this.props.slug ?? '';
    if (prevSessionSlug !== nextSessionSlug) {
      if (nextSessionSlug) {
        if (this._isMounted) {
          this.setState({ resolvedSessionSlug: nextSessionSlug }, () => {
            if (this._isMounted) this.loadSBTInfo();
          });
        } else {
          this.loadSBTInfo();
        }
      } else if (this.state.resolvedSessionSlug == null) {
        if (this._isMounted) this.loadSBTInfo();
      }
      return;
    }

    if (account !== prevProps.account) {
      if (this._isMounted) {
        // Avoid briefly showing the prior account's holder-derived flags while the refresh is in-flight.
        const nextLower = (account || '').toLowerCase();
        try {
          const minted = Array.isArray(this.state?.mintedAddresses) ? this.state.mintedAddresses : [];
          const burned = Array.isArray(this.state?.burnedAddresses) ? this.state.burnedAddresses : [];
          const net = this.computeNetCounts(minted, burned);
          const nextUserHasSBT = nextLower ? ((net.get(nextLower) || 0) > 0) : false;
          const adminAddr = this.state?.sbtInfo ? (this.state.sbtInfo.admin || this.state.sbtInfo.admin_ || '') : '';
          const nextUserIsAdmin = nextLower && adminAddr && (nextLower === String(adminAddr).toLowerCase());
          if (nextUserHasSBT !== this.state.userHasSBT || nextUserIsAdmin !== this.state.userIsSbtAdmin) {
            this.setState({ userHasSBT: nextUserHasSBT, userIsSbtAdmin: nextUserIsAdmin });
          }
        } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
        this.loadSBTInfo();
      }
      try {
        this.handleUrlAutoMintIntent().catch((e) => {
          if (this._isMounted) this.setState({ error: e?.message || 'Auto-mint failed.', mintingStatus: 'failure' });
        });
      } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
      return;
    }

    if (sbtCacheRevision !== prevProps.sbtCacheRevision) {
      if (this._isMounted && SBTAddress) {
        // Re-attempt centralized meta hydration on a new cache revision; no event scan here.
        this._metaHydrationTried = {};
        this.loadSBTInfo(false);
      }
      return;
    }

    if (sbtMintPassword !== prevProps.sbtMintPassword && this._isMounted) {
      this.checkForMintPassword();
    }

    // Demo/modern auto-mint (prop-driven)
    if (autoMintingMode && typeof sbtMintPassword === 'string' && !this.state.userHasSBT && this.state.mintingStatus === 'idle' && this.state.sbtInfo) {
      this.handleMint();
    }
    if (loginComplete && autoMintingMode && Array.isArray(sbtMintPassword) && !this.hasAttemptedListMint) {
      this.hasAttemptedListMint = true;
      this.attemptMintWithPasswordList(sbtMintPassword);
    }
  }


  componentWillUnmount() {
    this._isMounted = false;
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
    }
    if (this._burnSearchTimer) {
      clearTimeout(this._burnSearchTimer);
      this._burnSearchTimer = null;
    }
    if (this._localStorageWriteTimer) {
      clearTimeout(this._localStorageWriteTimer);
      this._localStorageWriteTimer = null;
    }
    this.releaseDecryptedImageBlobUrl();
    this.flushQueuedLocalStorageWrites();
  }

  releaseDecryptedImageBlobUrl = () => {
    const blobUrl = this._decryptedImageBlobUrl;
    if (!blobUrl || typeof URL === 'undefined') return;
    try { URL.revokeObjectURL(blobUrl); } catch (e) { sbtLog.warn('SBTPage: cleanup', e); }
    this._decryptedImageBlobUrl = '';
  };

  flushQueuedLocalStorageWrites = () => {
    if (typeof localStorage === 'undefined') return;
    if (!this._queuedLocalStorageWrites || this._queuedLocalStorageWrites.size === 0) return;
    this._queuedLocalStorageWrites.forEach((nextJson, key) => {
      try {
        const cached = this._localStorageWriteCache[key];
        if (cached === nextJson) return;
        const currentRaw = localStorage.getItem(key) || '';
        if (currentRaw === nextJson) {
          this._localStorageWriteCache[key] = nextJson;
          return;
        }
        localStorage.setItem(key, nextJson);
        this._localStorageWriteCache[key] = nextJson;
      } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
    });
    this._queuedLocalStorageWrites.clear();
  };

  queueLocalStorageJsonWrite = (key, value, options = {}) => {
    if (typeof localStorage === 'undefined') return false;
    const storageKey = String(key || '');
    if (!storageKey) return false;
    let nextJson = '';
    try {
      nextJson = JSON.stringify(value);
    } catch (_) {
      return false;
    }
    if (typeof nextJson !== 'string') return false;
    try {
      if (this._localStorageWriteCache[storageKey] === nextJson) return false;
      const currentRaw = localStorage.getItem(storageKey) || '';
      if (currentRaw === nextJson) {
        this._localStorageWriteCache[storageKey] = nextJson;
        return false;
      }
    } catch (e) { sbtLog.warn('SBTPage: fallback', e); }

    this._queuedLocalStorageWrites.set(storageKey, nextJson);
    if (options?.immediate === true) {
      this.flushQueuedLocalStorageWrites();
      return true;
    }
    if (this._localStorageWriteTimer) return true;
    this._localStorageWriteTimer = setTimeout(() => {
      this._localStorageWriteTimer = null;
      this.flushQueuedLocalStorageWrites();
    }, 24);
    return true;
  };

  readQueuedOrStoredLocalStorageJson = (key, fallback = {}) => {
    if (typeof localStorage === 'undefined') return fallback;
    const storageKey = String(key || '');
    if (!storageKey) return fallback;
    try {
      const pendingRaw = this._queuedLocalStorageWrites.get(storageKey);
      const raw = (typeof pendingRaw === 'string' ? pendingRaw : localStorage.getItem(storageKey)) || '';
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  };

  isAutoHashEnabled() {
    try {
      const qs = (typeof window !== 'undefined' && window.location.search)
        ? window.location.search.replace(/^\?/, '')
        : '';
      const qp = new URLSearchParams(qs);
      if (qp.get('auto') === '1') return true;
      for (const key of qp.keys()) {
        if (/^auto\d+$/.test(key) && qp.get(key) === '1') return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  clearAutoMintUrlIntent = () => {
    try {
      if (this.isAutoHashEnabled()) {
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          const url = new URL(window.location.href);
          const params = url.searchParams;
          let changed = false;

          const hasAutoFlag = (() => {
            if (params.get('auto') === '1') return true;
            for (const k of params.keys()) {
              if (/^auto\d+$/.test(k) && params.get(k) === '1') return true;
            }
            return false;
          })();

          if (hasAutoFlag) {
            params.delete('auto');
            params.delete('sbt');
            params.delete('gp');
            params.delete('inv');
            Array.from(params.keys()).forEach((k) => {
              if (/^(sbt|gp|inv|auto)\d+$/.test(k)) params.delete(k);
            });
            changed = true;
          }

          if (changed) {
            const qs = params.toString();
            const cleanUrl = url.pathname + (qs ? `?${qs}` : '');
            window.history.replaceState(null, '', cleanUrl);
          }
        }
      }
    } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
  };

  normalizeInviteCode = (raw) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('inv:')) return trimmed.slice(4).trim();
    if (lower.startsWith('invite:')) return trimmed.slice(7).trim();
    return trimmed;
  };

  decodeInviteInput = (raw) => {
    const normalized = this.normalizeInviteCode(raw);
    if (!normalized) return null;
    const payload = cryptoUtils.decodeInvite(normalized);
    if (!payload) return null;
    return { ...payload, inviteCode: normalized };
  };

  getCurrentSbtAddressInfo = (propsIn = this.props) => {
    const prop = propsIn?.SBTAddress;
    const original = Array.isArray(prop)
      ? (prop.find((entry) => entry && entry.sbtAddress !== undefined)?.sbtAddress || '')
      : ((prop && prop.sbtAddress !== undefined ? prop.sbtAddress : prop) || '');
    return {
      original,
      lower: String(original || '').toLowerCase(),
    };
  };

  collectAutoMintPairsFromSearchParams = (searchParams) => {
    const sp = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
    const globalAuto = sp.get('auto') === '1';
    const pairs = [];

    if (sp.has('sbt')) {
      pairs.push({
        sbt: sp.get('sbt'),
        gp: sp.get('gp'),
        inv: sp.get('inv'),
        auto: globalAuto,
      });
    }

    for (const key of sp.keys()) {
      const match = key.match(/^sbt(\d+)$/);
      if (!match) continue;
      const idx = match[1];
      const sbtVal = sp.get(key);
      if (!sbtVal) continue;
      pairs.push({
        sbt: sbtVal,
        gp: sp.get(`gp${idx}`),
        inv: sp.get(`inv${idx}`),
        auto: globalAuto || sp.get(`auto${idx}`) === '1',
      });
    }

    return { pairs, globalAuto };
  };

  resolveUrlAutoMintIntent = (searchRaw = null, propsIn = this.props) => {
    const { original: currentSbtAddress, lower: currentSbtAddrLower } = this.getCurrentSbtAddressInfo(propsIn);
    if (!currentSbtAddress) return null;

    const qs = typeof searchRaw === 'string'
      ? searchRaw.replace(/^\?/, '')
      : ((typeof window !== 'undefined' && window.location.search)
        ? window.location.search.replace(/^\?/, '')
        : '');
    if (!qs) return null;

    const sp = new URLSearchParams(qs);
    const { pairs, globalAuto } = this.collectAutoMintPairsFromSearchParams(sp);
    const matchedPair = pairs.find((pair) => (pair.sbt || '').toLowerCase() === currentSbtAddrLower);

    let targetInvite = null;
    let targetPassword = null;
    let shouldAutoMint = false;

    if (matchedPair) {
      targetInvite = matchedPair.inv || null;
      targetPassword = matchedPair.gp || null;
      shouldAutoMint = matchedPair.auto;
    } else if (pairs.length === 0) {
      const legacyInv = sp.get('inv');
      const legacyGp = sp.get('gp');
      if (legacyInv && !sp.has('sbt')) {
        targetInvite = legacyInv;
        shouldAutoMint = globalAuto;
      } else if (legacyGp && !sp.has('sbt')) {
        targetPassword = legacyGp;
        shouldAutoMint = globalAuto;
      } else if (globalAuto) {
        shouldAutoMint = true;
      }
    }

    const targetCode = targetInvite || targetPassword;
    const autoKey = currentSbtAddrLower ? `autoMint:${currentSbtAddrLower}` : null;
    const alreadyTried = !!(
      autoKey &&
      typeof window !== 'undefined' &&
      window.sessionStorage &&
      window.sessionStorage.getItem(autoKey) === 'done'
    );

    return {
      currentSbtAddress,
      targetInvite,
      targetPassword,
      targetCode,
      shouldAttemptAuto: (
        shouldAutoMint &&
        propsIn.loginComplete &&
        !this.state.userHasSBT &&
        this.state.mintingStatus === 'idle' &&
        !alreadyTried
      ),
      autoKey,
    };
  };

  // Keep mount/update auto-mint routing centralized so query handling stays consistent.
  handleUrlAutoMintIntent = async (propsIn = this.props) => {
    const intent = this.resolveUrlAutoMintIntent(null, propsIn);
    if (!intent) return false;

    const {
      currentSbtAddress,
      targetInvite,
      targetPassword,
      targetCode,
      shouldAttemptAuto,
      autoKey,
    } = intent;

    if (targetCode && !shouldAttemptAuto) {
      if (this._isMounted) this.setState({ groupPasswordInput: targetCode });
      return false;
    }

    if (!shouldAttemptAuto) {
      return false;
    }

    if (autoKey && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(autoKey, 'done');
    }

    if (!targetCode) {
      await this.autoMintPublicIfAllowed(currentSbtAddress);
      return true;
    }

    await new Promise((resolve) => {
      if (this._isMounted) {
        this.setState({ groupPasswordInput: targetCode }, resolve);
      } else {
        resolve();
      }
    });

    if (targetInvite) {
      await this.claimWithInviteCode(targetInvite, currentSbtAddress);
      return true;
    }

    const slug = this.getEffectiveSessionSlug();
    let sbtInfo = this.state.sbtInfo;
    if (!sbtInfo || typeof sbtInfo !== 'object') {
      try {
        sbtInfo = await contractScripts.getSbtMetadata('none', currentSbtAddress, slug);
      } catch (_) {
        sbtInfo = null;
      }
      if (sbtInfo && this._isMounted) {
        this.setState({ sbtInfo });
      }
    }

    if (sbtInfo?.hasPasswordMint) {
      await this.claimWithGroupPassword(targetPassword, currentSbtAddress);
      return true;
    }

    const onchainGph = await contractScripts.getGroupPasswordHash('none', currentSbtAddress, slug);
    if (onchainGph && onchainGph !== ethers.constants.HashZero) {
      await this.mintUnlimitedWithGroupPassword();
      return true;
    }

    if (this._isMounted) {
      this.setState({ error: `Invite code required for this ${t('sbt')}.`, mintingStatus: 'failure' });
    }
    return false;
  };

  resolveSessionSlugFromInfo = (info) => {
    if (info && Object.prototype.hasOwnProperty.call(info, 'sessionSlug')) {
      const hasExplicitFlag = Object.prototype.hasOwnProperty.call(info, 'sessionSlugExplicit');
      const isExplicitSessionSlug = info.sessionSlugExplicit === true;
      // Authoritatively route by sessionSlug only when metadata marked it explicit.
      if (isExplicitSessionSlug || !hasExplicitFlag) {
        return normalizeSessionSlug(info.sessionSlug || '');
      }
    }
    // Legacy fallback for historical metadata that linked by display name only.
    const name = String(info?.sessionName || '').trim();
    if (!name) return null;
    return getSessionSlugByName(name);
  };

  hasExplicitSessionSlugProp = (props = this.props) => (
    !!props && (
      Object.prototype.hasOwnProperty.call(props, 'sessionSlug') ||
      Object.prototype.hasOwnProperty.call(props, 'slug')
    )
  );

  getExplicitSessionSlug = (props = this.props) => {
    if (!this.hasExplicitSessionSlugProp(props)) return null;
    const raw = Object.prototype.hasOwnProperty.call(props || {}, 'sessionSlug')
      ? props?.sessionSlug
      : props?.slug;
    return normalizeSessionSlug(raw || '');
  };

  getEffectiveSessionSlug = () => {
    const explicitSlug = this.getExplicitSessionSlug();
    if (explicitSlug != null) return explicitSlug;
    if (this.state.resolvedSessionSlug != null) return this.state.resolvedSessionSlug;
    const fromInfo = this.resolveSessionSlugFromInfo(this.state.sbtInfo);
    if (fromInfo != null) return fromInfo;
    return this.props.sessionSlug || this.props.slug || '';
  };

  getSessionDisplayConfig = (sessionSlugRaw = this.getEffectiveSessionSlug()) => {
    const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
    try {
      return (
        getSessionConfigBySlugOrDefault(sessionSlug || '')
        || getDemoSessionConfigBySlug(sessionSlug || '', { allowDemoFallback: true })
        || null
      );
    } catch (_) {
      return null;
    }
  };

  getSessionDisplayLabel = (sessionSlugRaw = this.getEffectiveSessionSlug()) => {
    const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
    const sessionConfig = this.getSessionDisplayConfig(sessionSlug);
    const sessionName = String(sessionConfig?.sessionName || '').trim();
    if (!sessionSlug) return sessionName || 'General';
    return sessionName || sessionSlug;
  };

  hasUsableScanProgress = (progress) => {
    if (!progress || typeof progress !== 'object') return false;
    const totalBlocks = Number(progress?.totalBlocks || 0);
    const currentBlock = Number(progress?.currentBlock || 0);
    const latestBlock = Number(progress?.latestBlock || 0);
    const remainingBlocks = Number(progress?.remainingBlocks);
    return (
      (Number.isFinite(totalBlocks) && totalBlocks > 0) ||
      (
        Number.isFinite(currentBlock) &&
        currentBlock >= 0 &&
        Number.isFinite(latestBlock) &&
        latestBlock > 0 &&
        latestBlock >= currentBlock
      ) ||
      (Number.isFinite(remainingBlocks) && remainingBlocks >= 0)
    );
  };

  isActiveScanProgress = (progress) => {
    if (!this.hasUsableScanProgress(progress)) return false;
    const remainingBlocks = Number(progress?.remainingBlocks);
    if (Number.isFinite(remainingBlocks)) return remainingBlocks > 0;

    const totalBlocks = Number(progress?.totalBlocks || 0);
    const scannedBlocks = Number(progress?.scannedBlocks);
    if (
      Number.isFinite(totalBlocks) &&
      totalBlocks > 0 &&
      Number.isFinite(scannedBlocks)
    ) {
      return scannedBlocks < totalBlocks;
    }

    const currentBlock = Number(progress?.currentBlock || 0);
    const latestBlock = Number(progress?.latestBlock || 0);
    return (
      Number.isFinite(currentBlock) &&
      currentBlock >= 0 &&
      Number.isFinite(latestBlock) &&
      latestBlock > currentBlock
    );
  };

  getParentSessionScanProgress = () => {
    const progress = (this.props?.sbtScanProgress && typeof this.props.sbtScanProgress === 'object')
      ? this.props.sbtScanProgress
      : null;
    if (!progress) return null;

    const sessionSlug = this.getEffectiveSessionSlug();
    const currentBlock = Math.max(0, Math.floor(Number(progress?.currentBlock || 0)));
    const latestBlock = Math.max(currentBlock, Math.floor(Number(progress?.latestBlock || 0)));
    if (!Number.isFinite(currentBlock) || !Number.isFinite(latestBlock) || latestBlock <= 0) {
      return null;
    }

    const sessionConfig = this.getSessionDisplayConfig(sessionSlug);
    const startCandidate = Math.floor(Number(sessionConfig?.blockLimits?.start || 0));
    const hasStartBlock = Number.isFinite(startCandidate) && startCandidate > 0;
    const startBlock = hasStartBlock ? Math.min(startCandidate, latestBlock) : 0;
    const totalBlocks = hasStartBlock
      ? Math.max(1, latestBlock - startBlock + 1)
      : null;
    const scannedBlocks = totalBlocks != null
      ? Math.max(0, Math.min(totalBlocks, currentBlock - startBlock + 1))
      : null;

    return {
      ...progress,
      source: 'session',
      phase: progress?.phase || 'activity',
      currentBlock,
      latestBlock,
      fromBlock: hasStartBlock ? startBlock : undefined,
      toBlock: latestBlock,
      totalBlocks: totalBlocks != null ? totalBlocks : undefined,
      scannedBlocks: scannedBlocks != null ? scannedBlocks : undefined,
      remainingBlocks: Math.max(0, latestBlock - currentBlock),
      sessionSlug,
      sessionLabel: this.getSessionDisplayLabel(sessionSlug),
    };
  };

  getEffectiveHolderScanProgress = () => {
    const localProgress = (this.state?.logScanProgress && typeof this.state.logScanProgress === 'object')
      ? this.state.logScanProgress
      : null;
    if (this.hasUsableScanProgress(localProgress)) {
      return {
        sessionSlug: this.getEffectiveSessionSlug(),
        sessionLabel: this.getSessionDisplayLabel(),
        ...localProgress,
      };
    }
    const parentProgress = this.getParentSessionScanProgress();
    if (this.hasUsableScanProgress(parentProgress)) return parentProgress;
    return null;
  };

  isHolderScanActive = () => (
    this.isActiveScanProgress(this.getEffectiveHolderScanProgress()) ||
    this.state.loadingMintersBurners ||
    this.state.loadingMintedFilter ||
    this.props.sbtScanInProgress ||
    this.props.sbtScanPending
  );

  getSbtDetailPath = (sbtAddress) => (
    buildSbtDetailPath(sbtAddress, this.getEffectiveSessionSlug())
  );

  getSessionSBTAddresses = () => {
    const pushAddress = (input, out, seen) => {
      const raw = String(input || '').trim();
      if (!raw || !ethers.utils.isAddress(raw)) return;
      const lower = raw.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      out.push(lower);
    };
    const listSignature = (input) => {
      if (!Array.isArray(input)) return '';
      return input
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean)
        .join(',');
    };

    const sessionSlug = this.getEffectiveSessionSlug();
    let sessionConfig = null;
    try {
      sessionConfig = (
        getSessionConfigBySlugOrDefault(sessionSlug || '')
        || getDemoSessionConfigBySlug(sessionSlug || '', { allowDemoFallback: true })
        || null
      );
    } catch (_) {
      sessionConfig = null;
    }
    const sessionConfigDefaultFeaturedSignature = listSignature(sessionConfig?.defaultFeaturedSBTs);
    const sessionConfigFeaturedListSignature = listSignature(sessionConfig?.featured_SBTs_LIST);
    const cacheKey = [
      String(this.state?.sbtAddress || '').trim().toLowerCase(),
      String(this.props?.match?.params?.address || '').trim().toLowerCase(),
      String(resolveSbtAddress(this.props?.SBTAddress) || '').trim().toLowerCase(),
      String(sessionSlug || '').trim().toLowerCase(),
      sessionConfigDefaultFeaturedSignature,
      sessionConfigFeaturedListSignature,
    ].join('|');
    if (this._sessionSBTAddressesKey === cacheKey) {
      return this._sessionSBTAddressesValue;
    }

    const addresses = [];
    const seen = new Set();

    pushAddress(this.state?.sbtAddress, addresses, seen);
    pushAddress(this.props?.match?.params?.address, addresses, seen);
    pushAddress(resolveSbtAddress(this.props?.SBTAddress), addresses, seen);

    const fromSession = [
      ...(Array.isArray(sessionConfig?.defaultFeaturedSBTs) ? sessionConfig.defaultFeaturedSBTs : []),
      ...(Array.isArray(sessionConfig?.featured_SBTs_LIST) ? sessionConfig.featured_SBTs_LIST : []),
    ];
    fromSession.forEach((address) => pushAddress(address, addresses, seen));

    this._sessionSBTAddressesKey = cacheKey;
    this._sessionSBTAddressesValue = addresses;
    return addresses;
  };

  refreshSbtDataWithSlug = (sbtAddress, options, slugOverride = null) => {
    if (!sbtAddress) return null;
    const slug = slugOverride != null ? slugOverride : this.getEffectiveSessionSlug();
    try {
      return this.props.refreshSbtData && this.props.refreshSbtData(sbtAddress, slug, options);
    } catch (_) {
      return null;
    }
  };

  autoMintPublicIfAllowed = async (sbtAddress) => {
    if (!sbtAddress) return false;

    const slug = this.getEffectiveSessionSlug();
    let sbtInfo = this.state.sbtInfo;
    if (!sbtInfo || typeof sbtInfo !== 'object') {
      try {
        sbtInfo = await contractScripts.getSbtMetadata('none', sbtAddress, slug);
      } catch (_) {
        sbtInfo = null;
      }
      if (sbtInfo && this._isMounted) this.setState({ sbtInfo });
    }

    if (!sbtInfo) {
      if (this._isMounted) this.setState({ error: `Unable to load ${t('sbt')} metadata.`, mintingStatus: 'failure' });
      return false;
    }

    let onchainGph = null;
    try {
      onchainGph = await contractScripts.getGroupPasswordHash('none', sbtAddress, slug);
    } catch (_) {
      onchainGph = null;
    }

    if (sbtInfo.hasPasswordMint) {
      if (this._isMounted) this.setState({ error: `Password required for this ${t('sbt')}.`, mintingStatus: 'failure' });
      return false;
    }
    if (onchainGph && onchainGph !== ethers.constants.HashZero) {
      if (this._isMounted) this.setState({ error: `Group password required for this ${t('sbt')}.`, mintingStatus: 'failure' });
      return false;
    }

    await this.handleMint(true);
    return true;
  };

  handleGroupPasswordInputChange = (event) => {
    const raw = event?.target?.value;
    const value = typeof raw === 'string' ? raw.replace(/\s+/g, '') : raw;
    this.setState({ groupPasswordInput: value });
  };

  claimWithInvitePayload = async (payload, sbtOverride, options = {}) => {
    try {
      if (!this.props.account) {
        this.props.toggleLoginModal(true);
        return { ok: false, error: new Error(`${t('wallet')} not connected`) };
      }
      if (!payload || payload.nonce == null || !payload.signature) {
        if (this._isMounted && !options.suppressErrors) {
          this.setState({ error: 'Invalid invite code.', mintingStatus: 'failure' });
        }
        return { ok: false, error: new Error('Invalid invite code.') };
      }

      const { SBTAddress: SBTAddressProp } = this.props;
      const sbt = sbtOverride || (Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(e => e.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp));

      if (!sbt) return { ok: false, error: new Error(`Missing ${t('sbt')} address`) };

      if (this._isMounted) this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint', error: null });
      const tx = await contractScripts.claimWithInvite(this.props.provider, sbt, payload.nonce, payload.signature);

      await this.loadSBTInfo(true);
      if (this._isMounted) {
        this.setState({
          mintingStatus: 'success',
          transactionHash: tx.transactionHash,
          lastTransactionType: 'mint',
          lastMintTxHash: tx.transactionHash
        });
      }

      const meLower = this.props.account.toLowerCase();
      this.applyLocalMintSuccess(meLower);
      this.refreshSbtDataWithSlug(sbt);

      this.clearAutoMintUrlIntent();

      try {
        window.dispatchEvent(new CustomEvent('sbt-mint-success', { detail: { sbtAddress: sbt, txHash: tx.transactionHash } }));
      } catch (e) { sbtLog.warn('SBTPage: telemetry', e); }
      return { ok: true, tx };
    } catch (error) {
      inviteLog.error('[INVITE] claimWithInvite failed:', error);
      if (this._isMounted && !options.suppressErrors) {
        this.setState({ error: error?.message || 'Invite claim failed.', mintingStatus: 'failure' });
      }
      return { ok: false, error };
    }
  };

  claimWithGroupPassword = async (rawPassword, sbtOverride) => {
    try {
      if (!this.props.account) {
        this.props.toggleLoginModal(true);
        return;
      }
      const password = cryptoUtils.normalizeGroupPasswordInput(rawPassword);
      if (!password) {
        if (this._isMounted) this.setState({ error: 'Group password is required.', mintingStatus: 'failure' });
        return;
      }

      const { SBTAddress: SBTAddressProp } = this.props;
      const sbt = sbtOverride || (Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(e => e.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp));

      if (!sbt) return;

      const slug = this.getEffectiveSessionSlug();
      let sbtInfo = this.state.sbtInfo;
      if (!sbtInfo || typeof sbtInfo !== 'object') sbtInfo = {};

      let onchainHash = this.state.groupPasswordHash || null;
      if (!onchainHash) {
        try { onchainHash = await contractScripts.getGroupPasswordHash('none', sbt, slug); } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
      }
      let walletScopeSbtAddress = sbt;
      if (onchainHash && onchainHash !== ethers.constants.HashZero) {
        walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
          password,
          sbtAddress: sbt,
          groupPasswordHash: onchainHash
        });
        const localHash = walletScopeSbtAddress === null
          ? null
          : contractScripts.computeGroupPasswordHash({
              password,
              sbtAddress: walletScopeSbtAddress
            });
        inviteLog.log('[INVITE_DEBUG v4] local groupPasswordHash:', localHash);
        inviteLog.log('[INVITE_DEBUG v4] on-chain groupPasswordHash:', onchainHash);
        if (!localHash || String(localHash).toLowerCase() !== String(onchainHash).toLowerCase()) {
          if (this._isMounted) {
            this.setState({ error: 'Group password mismatch.', mintingStatus: 'failure' });
          }
          return;
        }
      }

      let maxTokens = null;
      try {
        const rawMax = sbtInfo?.maxTokens;
        if (rawMax !== undefined && rawMax !== null && rawMax !== '' && rawMax !== '0') {
          maxTokens = ethers.BigNumber.from(rawMax);
        }
      } catch (_) {
        maxTokens = null;
      }

      const maxAttempts = 3;
      let lastError = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let mintedTokens = null;
        try {
          mintedTokens = await contractScripts.getMintedTokens('none', sbt, slug);
        } catch (_) {
          mintedTokens = null;
        }

        if (mintedTokens === null) {
          if (this._isMounted) this.setState({ error: 'Unable to load minted count.', mintingStatus: 'failure' });
          return;
        }

        let mintedBig = null;
        try {
          mintedBig = ethers.BigNumber.from(mintedTokens);
        } catch (_) {
          mintedBig = null;
        }

        if (mintedBig === null) {
          if (this._isMounted) this.setState({ error: 'Unable to parse minted count.', mintingStatus: 'failure' });
          return;
        }

        if (maxTokens && mintedBig.gte(maxTokens)) {
          if (this._isMounted) this.setState({ error: 'Group limit reached.', mintingStatus: 'failure' });
          return;
        }

        const nonce = mintedBig.add(1).toString();
        const invites = await contractScripts.generateInvitePayloads({
          password,
          sbtAddress: sbt,
          nonces: [nonce],
          walletScopeSbtAddress
        });
        const payload = invites && invites[0];
        if (!payload) {
          if (this._isMounted) this.setState({ error: 'Failed to generate invite.', mintingStatus: 'failure' });
          return;
        }

        const suppressErrors = attempt < maxAttempts - 1;
        const result = await this.claimWithInvitePayload(payload, sbt, { suppressErrors });
        if (result && result.ok) return;

        lastError = result?.error || new Error('Invite claim failed.');

        let mintedAfter = null;
        try {
          mintedAfter = await contractScripts.getMintedTokens('none', sbt, slug);
        } catch (_) {
          mintedAfter = null;
        }

        let mintedAfterBig = null;
        try {
          mintedAfterBig = mintedAfter !== null ? ethers.BigNumber.from(mintedAfter) : null;
        } catch (_) {
          mintedAfterBig = null;
        }

        if (mintedAfterBig === null || mintedAfterBig.lte(mintedBig)) {
          if (this._isMounted && suppressErrors) {
            this.setState({ error: lastError?.message || 'Invite claim failed.', mintingStatus: 'failure' });
          }
          return;
        }
      }
    } catch (error) {
      inviteLog.error('[INVITE] claimWithGroupPassword failed:', error);
      if (this._isMounted) this.setState({ error: error?.message || 'Invite claim failed.', mintingStatus: 'failure' });
    }
  };

  claimWithInviteCode = async (rawCode, sbtOverride) => {
    const payload = this.decodeInviteInput(rawCode);
    if (payload) {
      await this.claimWithInvitePayload(payload, sbtOverride);
      return;
    }
    await this.claimWithGroupPassword(rawCode, sbtOverride);
  };

  // Helpers
  sanitizeMintedTokensOverride = (value) => {
    if (value == null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null;
    return String(parsed);
  };

  normalizeCountMap = (value = null) => {
    const out = {};
    Object.entries(value || {}).forEach(([addrRaw, countRaw]) => {
      const addr = String(addrRaw || '').toLowerCase();
      if (!addr) return;
      const count = Math.max(0, Math.floor(Number(countRaw || 0)));
      if (count <= 0) return;
      out[addr] = count;
    });
    return out;
  };

  expandAddressListFromCountMap = (countMapIn = null, fallbackList = []) => {
    const hasStructuredCountMap =
      !!countMapIn &&
      typeof countMapIn === 'object' &&
      !Array.isArray(countMapIn);
    if (!hasStructuredCountMap) {
      return (Array.isArray(fallbackList) ? fallbackList : []).map((addr) => String(addr || '').toLowerCase());
    }
    const normalized = this.normalizeCountMap(countMapIn);
    if (!Object.keys(normalized).length && Array.isArray(fallbackList) && fallbackList.length > 0) {
      return fallbackList.map((addr) => String(addr || '').toLowerCase());
    }
    const expanded = [];
    Object.entries(normalized).forEach(([addr, count]) => {
      for (let i = 0; i < count; i += 1) {
        expanded.push(addr);
      }
    });
    return expanded;
  };

  buildAddressOccurrenceMap = (list = []) => {
    const counts = new Map();
    (Array.isArray(list) ? list : []).forEach((entry) => {
      const normalized = String(entry || '').toLowerCase();
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return counts;
  };

  computeNetCounts = (mintsArr = [], burnsArr = []) => {
    const counts = new Map();
    (mintsArr || []).forEach(a => {
      const k = (a || '').toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    (burnsArr || []).forEach(a => {
      const k = (a || '').toLowerCase();
      counts.set(k, (counts.get(k) || 0) - 1);
    });
    return counts; // Map<addressLower, netCount>
  };

  computeNetHoldersList = (mintsArr = [], burnsArr = []) => {
    const counts = this.computeNetCounts(mintsArr, burnsArr);
    return Array.from(counts.entries())
      .filter(([, v]) => v > 0)
      .map(([k]) => k);
  };

  buildHolderListSignature = (list = []) => {
    const entries = Array.isArray(list) ? list : [];
    let hash = 2166136261;
    for (let i = 0; i < entries.length; i += 1) {
      const normalized = String(entries[i] || '').toLowerCase();
      for (let j = 0; j < normalized.length; j += 1) {
        hash ^= normalized.charCodeAt(j);
        hash = Math.imul(hash, 16777619);
      }
      hash ^= 124;
      hash = Math.imul(hash, 16777619);
    }
    return `${entries.length}:${hash >>> 0}`;
  };

  getMemoizedNetHoldersList = (mintsArr = [], burnsArr = []) => {
    const mintedRef = Array.isArray(mintsArr) ? mintsArr : [];
    const burnedRef = Array.isArray(burnsArr) ? burnsArr : [];
    const memo = this._netHoldersMemo;
    if (memo.mintedRef === mintedRef && memo.burnedRef === burnedRef) {
      return memo.result;
    }
    const mintedSignature = this.buildHolderListSignature(mintedRef);
    const burnedSignature = this.buildHolderListSignature(burnedRef);
    if (
      memo.mintedSignature === mintedSignature &&
      memo.burnedSignature === burnedSignature
    ) {
      this._netHoldersMemo = {
        ...memo,
        mintedRef,
        burnedRef,
      };
      return memo.result;
    }
    const next = measureSync('ce.sbtPage.computeNetHoldersList', () =>
      this.computeNetHoldersList(mintedRef, burnedRef)
    );
    this._netHoldersMemo = {
      mintedRef,
      burnedRef,
      mintedSignature,
      burnedSignature,
      result: next,
    };
    return next;
  };

  buildAddressListSignature = (list = []) => {
    const entries = Array.isArray(list) ? list : [];
    const listToken = Array.isArray(entries)
      ? entries.map((entry) => String(entry || '').toLowerCase()).join('|')
      : '';
    const memo = this._filteredMintedUsersSignatureMemo;
    if (
      memo.listRef === entries &&
      memo.listToken === listToken &&
      typeof memo.signature === 'string'
    ) {
      return memo.signature;
    }
    const signature = measureSync('ce.sbtPage.filteredMintedUsersSignature', () => {
      let hash = 2166136261;
      for (let i = 0; i < entries.length; i += 1) {
        const normalized = String(entries[i] || '').toLowerCase();
        for (let j = 0; j < normalized.length; j += 1) {
          hash ^= normalized.charCodeAt(j);
          hash = Math.imul(hash, 16777619);
        }
        hash ^= 124;
        hash = Math.imul(hash, 16777619);
      }
      return `${entries.length}:${hash >>> 0}`;
    });
    this._filteredMintedUsersSignatureMemo = {
      listRef: entries,
      listToken,
      signature,
    };
    return signature;
  };

  buildNextFilteredHolderRows = ({
    prevFilteredRows = [],
    prevNetHolders = [],
    nextNetHolders = [],
    replaceRows = false,
  } = {}) => {
    const prevFiltered = (Array.isArray(prevFilteredRows) ? prevFilteredRows : [])
      .map((entry) => String(entry || '').toLowerCase())
      .filter(Boolean);
    const nextRows = (Array.isArray(nextNetHolders) ? nextNetHolders : [])
      .map((entry) => String(entry || '').toLowerCase())
      .filter(Boolean);
    if (replaceRows) {
      const prevWasFullHolderSet =
        this.buildAddressListSignature(prevFiltered) === this.buildAddressListSignature(prevNetHolders);
      if (prevWasFullHolderSet) {
        return nextRows;
      }
    }
    const nextSet = new Set(nextRows);
    return prevFiltered.filter((entry) => nextSet.has(entry));
  };

  mergeBurnEvidenceIntoPreservedHolderState = (
    prevMinted = [],
    prevBurned = [],
    nextMinted = [],
    nextBurned = []
  ) => {
    const preservedMinted = Array.isArray(prevMinted) ? prevMinted.map((entry) => String(entry || '').toLowerCase()) : [];
    const preservedBurned = Array.isArray(prevBurned) ? prevBurned.map((entry) => String(entry || '').toLowerCase()) : [];
    const nextMintedSafe = Array.isArray(nextMinted) ? nextMinted : [];
    const nextBurnedSafe = Array.isArray(nextBurned) ? nextBurned : [];
    const prevNetCounts = this.computeNetCounts(preservedMinted, preservedBurned);
    const nextNetCounts = this.computeNetCounts(nextMintedSafe, nextBurnedSafe);
    const prevBurnCounts = this.buildAddressOccurrenceMap(preservedBurned);
    const nextBurnCounts = this.buildAddressOccurrenceMap(nextBurnedSafe);
    let burnDiscovered = false;

    prevNetCounts.forEach((prevNetCount, addr) => {
      if (prevNetCount <= 0) return;
      const prevBurnCount = prevBurnCounts.get(addr) || 0;
      const nextBurnCount = nextBurnCounts.get(addr) || 0;
      const nextNetCount = nextNetCounts.get(addr) || 0;
      if (nextBurnCount <= prevBurnCount || nextNetCount >= prevNetCount) return;
      const burnDelta = nextBurnCount - prevBurnCount;
      for (let i = 0; i < burnDelta; i += 1) {
        preservedBurned.push(addr);
      }
      burnDiscovered = true;
    });

    return {
      mintedAddresses: preservedMinted,
      burnedAddresses: preservedBurned,
      burnDiscovered,
    };
  };

  // Regression guard: once holder rows are visible for the active SBT/network, only a
  // resolved replacement set or per-address burn evidence may remove them.
  reconcileHolderRefreshState = ({
    prevState,
    nextMintedAddresses,
    nextBurnedAddresses,
    nextCountsLoaded,
    nextHoldersMetaKey,
    nextMintedTokensOverride,
    userLower,
  }) => {
    const prev = prevState || {};
    const prevMinted = Array.isArray(prev.mintedAddresses) ? prev.mintedAddresses : [];
    const prevBurned = Array.isArray(prev.burnedAddresses) ? prev.burnedAddresses : [];
    const nextMinted = Array.isArray(nextMintedAddresses) ? nextMintedAddresses : [];
    const nextBurned = Array.isArray(nextBurnedAddresses) ? nextBurnedAddresses : [];
    const nextCountsLoadedFlag = nextCountsLoaded === true;
    const sameHoldersKey =
      !!nextHoldersMetaKey &&
      !!prev?.holdersMetaKey &&
      String(prev.holdersMetaKey) === String(nextHoldersMetaKey);
    const prevNetHolders = this.computeNetHoldersList(prevMinted, prevBurned);
    const nextNetHolders = this.computeNetHoldersList(nextMinted, nextBurned);
    const hasResolvedReplacement = nextCountsLoadedFlag && nextNetHolders.length > 0;
    const shouldPreserveExisting =
      sameHoldersKey &&
      prevNetHolders.length > 0 &&
      !hasResolvedReplacement;
    const shouldManageVisibleRows =
      prev.showModal === true ||
      prev.mintingAddressesFilterInitialized === true ||
      (Array.isArray(prev.filteredMintedUsers) && prev.filteredMintedUsers.length > 0);

    let mintedAddresses = nextMinted;
    let burnedAddresses = nextBurned;
    let filteredMintedUsers = Array.isArray(prev.filteredMintedUsers) ? prev.filteredMintedUsers : [];

    if (shouldPreserveExisting) {
      const merged = this.mergeBurnEvidenceIntoPreservedHolderState(
        prevMinted,
        prevBurned,
        nextMinted,
        nextBurned
      );
      mintedAddresses = merged.mintedAddresses;
      burnedAddresses = merged.burnedAddresses;
      if (shouldManageVisibleRows && merged.burnDiscovered) {
        const nextVisibleHolders = this.computeNetHoldersList(mintedAddresses, burnedAddresses);
        filteredMintedUsers = this.buildNextFilteredHolderRows({
          prevFilteredRows: filteredMintedUsers,
          prevNetHolders,
          nextNetHolders: nextVisibleHolders,
          replaceRows: false,
        });
      }
    } else if (shouldManageVisibleRows) {
      filteredMintedUsers = this.buildNextFilteredHolderRows({
        prevFilteredRows: filteredMintedUsers,
        prevNetHolders,
        nextNetHolders,
        replaceRows: true,
      });
    }

    const effectiveNetCounts = this.computeNetCounts(mintedAddresses, burnedAddresses);
    const prevMintedTokensOverride = this.sanitizeMintedTokensOverride(prev.mintedTokensOverride);
    const incomingMintedTokensOverride = this.sanitizeMintedTokensOverride(nextMintedTokensOverride);
    const shouldKeepPrevApproximation =
      !nextCountsLoadedFlag ||
      nextNetHolders.length > 0;

    return {
      mintedAddresses,
      burnedAddresses,
      countsLoaded: shouldPreserveExisting
        ? (prev.countsLoaded === true || nextCountsLoadedFlag)
        : nextCountsLoadedFlag,
      mintedTokensOverride: shouldPreserveExisting
        ? (incomingMintedTokensOverride != null ? incomingMintedTokensOverride : prevMintedTokensOverride)
        : (
          incomingMintedTokensOverride != null
            ? incomingMintedTokensOverride
            : (shouldKeepPrevApproximation ? prevMintedTokensOverride : null)
        ),
      userHasSBT: userLower ? ((effectiveNetCounts.get(userLower) || 0) > 0) : false,
      filteredMintedUsers,
      filteredMintedUsersSignature: shouldManageVisibleRows
        ? this.buildAddressListSignature(filteredMintedUsers)
        : (
          typeof prev.filteredMintedUsersSignature === 'string'
            ? prev.filteredMintedUsersSignature
            : this.buildAddressListSignature(filteredMintedUsers)
        ),
    };
  };

  handleModalFilteredMintedUsers = (filtered) => {
    if (!this._isMounted) return;
    const safeFiltered = Array.isArray(filtered) ? filtered : [];
    const preserveDuringRefresh =
      safeFiltered.length === 0 &&
      this.isHolderScanActive() &&
      Array.isArray(this.state.filteredMintedUsers) &&
      this.state.filteredMintedUsers.length > 0;
    if (preserveDuringRefresh) {
      if (this.state.loadingMintedFilter) {
        this.setState({ loadingMintedFilter: false });
      }
      return;
    }
    const nextSignature = this.buildAddressListSignature(safeFiltered);
    if (nextSignature !== this.state.filteredMintedUsersSignature) {
      this.setState({
        filteredMintedUsers: safeFiltered,
        filteredMintedUsersSignature: nextSignature,
        loadingMintedFilter: false,
      });
      return;
    }
    if (this.state.loadingMintedFilter) {
      this.setState({ loadingMintedFilter: false });
    }
  };

  applyLocalMintSuccess = (addrLower) => {
    if (!this._isMounted || !addrLower) return;
    this.setState(prev => {
      const minted = (prev.mintedAddresses || []).concat(addrLower);
      const burned = Array.isArray(prev.burnedAddresses) ? [...prev.burnedAddresses] : [];
      const idx = burned.indexOf(addrLower);
      if (idx !== -1) burned.splice(idx, 1); // cancel out one prior burn if present
      const net = this.computeNetCounts(minted, burned);
      return {
        mintedAddresses: minted,
        burnedAddresses: burned,
        userHasSBT: (net.get(addrLower) || 0) > 0
      };
    });
  };

  applyLocalBurnSuccess = (addrLower) => {
    if (!this._isMounted || !addrLower) return;
    this.setState(prev => {
      const minted = Array.isArray(prev.mintedAddresses) ? prev.mintedAddresses : [];
      const burned = (prev.burnedAddresses || []).concat(addrLower);
      const net = this.computeNetCounts(minted, burned);
      const prevNetHolders = this.computeNetHoldersList(prev.mintedAddresses, prev.burnedAddresses);
      const nextNetHolders = this.computeNetHoldersList(minted, burned);
      const shouldManageVisibleRows =
        prev.showModal === true ||
        prev.mintingAddressesFilterInitialized === true ||
        (Array.isArray(prev.filteredMintedUsers) && prev.filteredMintedUsers.length > 0);
      const filteredMintedUsers = shouldManageVisibleRows
        ? this.buildNextFilteredHolderRows({
          prevFilteredRows: prev.filteredMintedUsers,
          prevNetHolders,
          nextNetHolders,
          replaceRows: false,
        })
        : (Array.isArray(prev.filteredMintedUsers) ? prev.filteredMintedUsers : []);
      return {
        burnedAddresses: burned,
        userHasSBT: (net.get(addrLower) || 0) > 0,
        filteredMintedUsers,
        filteredMintedUsersSignature: shouldManageVisibleRows
          ? this.buildAddressListSignature(filteredMintedUsers)
          : prev.filteredMintedUsersSignature,
      };
    });
  };

  toggleFullImage = () => {
    if (this._isMounted) {
      this.setState(prevState => ({ showFullImage: !prevState.showFullImage }));
    }
  };

  async attemptMintWithPasswordList(passwordList) {
    try {
      if (!Array.isArray(passwordList) || passwordList.length === 0) return;

      const { SBTAddress: SBTAddressProp, provider } = this.props;
      const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);

      if (!sbtAddressOriginalCase || !provider) return;

      let chosen = null;
      let inviteToken = null;
      for (const token of passwordList) {
        const payload = this.decodeInviteInput(token);
        if (payload) {
          inviteToken = token;
          break;
        }
      }

      if (inviteToken) {
        await new Promise(resolve => {
          if (this._isMounted) {
            this.setState({
              groupPasswordInput: inviteToken,
              mintingStatus: 'idle',
              mintStep: 0,
              error: null
            }, resolve);
          } else {
            resolve();
          }
        });

        await this.claimWithInviteCode(inviteToken, sbtAddressOriginalCase);
        return;
      }

      if (this.state.hasInviteMint) {
        const fallbackPassword = passwordList[0];
        if (fallbackPassword) {
          await new Promise(resolve => {
            if (this._isMounted) {
              this.setState({
                groupPasswordInput: fallbackPassword,
                mintingStatus: 'idle',
                mintStep: 0,
                error: null
              }, resolve);
            } else {
              resolve();
            }
          });
          await this.claimWithGroupPassword(fallbackPassword, sbtAddressOriginalCase);
          return;
        }
      }

      for (const token of passwordList) {
        const hashed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(token));
        let ok = false;
        try {
          ok = await contractScripts.isPasswordValid(provider, sbtAddressOriginalCase, hashed, this.getEffectiveSessionSlug());
        } catch {
          ok = false;
        }
        if (ok) { chosen = token; break; }
      }

      if (!chosen) {
        if (this._isMounted) this.setState({ error: "All claim codes have been used." });
        return;
      }

      await new Promise(resolve => {
        if (this._isMounted) {
          this.setState({
            manualPasswordInput: chosen,
            mintingStatus: 'idle',
            mintStep: 0,
            error: null
          }, resolve);
        } else {
          resolve();
        }
      });

      await this.handleMint(false);
      if (this.state.mintingStatus !== 'success') {
        // Rare race: if it failed after check, fall through silently (the UI already shows error)
      }
    } catch (err) {
      if (this._isMounted) this.setState({ error: err.message || 'Failed to mint with provided codes.' });
    }
  }

  loadCachedPasswords = () => {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem('createdSBTs')) || {}; } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
    const normalizedStored = {};
    for (let k in stored) {
      normalizedStored[k.toLowerCase()] = stored[k];
    }

    let sbtAddress;

    if (Array.isArray(this.props.SBTAddress)) {
      const foundEntry = this.props.SBTAddress.find(entry => entry.sbtAddress !== undefined);
      sbtAddress = foundEntry ? foundEntry.sbtAddress : null;
    } else {
      sbtAddress = this.props.SBTAddress && this.props.SBTAddress.sbtAddress !== undefined
        ? this.props.SBTAddress.sbtAddress
        : this.props.SBTAddress;
    }

    if (typeof sbtAddress === 'string') {
      sbtAddress = sbtAddress.toLowerCase();
    }

    let cached = [];
    if (sbtAddress && normalizedStored[sbtAddress] && Array.isArray(normalizedStored[sbtAddress].passwords)) {
      cached = normalizedStored[sbtAddress].passwords;
    } else if (Array.isArray(normalizedStored.passwords)) { // Fallback for older structure if needed
      cached = normalizedStored.passwords;
    }

    if (this._isMounted) {
      this.setState({ cachedPasswords: cached });
    }
  };

  openMintedModal = () => {
    if (this._isMounted) this.setState({ showModal: true }, () => {
      if (this._isMounted) {
        const netHolders = this.getMemoizedNetHoldersList(this.state.mintedAddresses, this.state.burnedAddresses);
        this.setState({
          filteredMintedUsers: netHolders,
          filteredMintedUsersSignature: this.buildAddressListSignature(netHolders),
          mintingAddressesFilterInitialized: true,
          loadingMintedFilter: false
        });
      }
      // One-shot explicit event scan when the user opens the holders modal.
      // This triggers 'loadingMintersBurners' -> true, updating the spinner state in header.
      this.loadSBTInfo({ forceEventFetch: true, preferCountsOnly: true });
    });
  };


  closeModal = () => {
    if (this._isMounted) this.setState({ showModal: false });
    // Allow another one-shot scan next time modal is opened
    this._eventScanTried = {};
  };

  closeDocModal = () => {
    const blobUrl = this.state.docModalBlobUrl;
    if (blobUrl && typeof URL !== 'undefined') {
      try { URL.revokeObjectURL(blobUrl); } catch (e) { sbtLog.warn('SBTPage: cleanup', e); }
    }
    if (this._isMounted) {
      this.setState({
        docModalOpen: false,
        docModalLoading: false,
        docModalError: '',
        docModalContent: '',
        docModalName: '',
        docModalBlobUrl: '',
      });
    }
  };

  openEncryptedDoc = async (url) => {
    if (!litStorage.isLitArweaveUrl(url)) return;
    const litHooks = getGlobalLitHooks();
    if (!litHooks || typeof litHooks.getKey !== 'function') {
      if (this._isMounted) {
        this.setState({
          docModalOpen: true,
          docModalLoading: false,
          docModalError: `Connect a ${t('walletLower')} to decrypt this document.`,
          docModalContent: '',
          docModalName: 'Encrypted document',
          docModalBlobUrl: '',
        });
      }
      return;
    }

    if (this._isMounted) {
      this.setState({
        docModalOpen: true,
        docModalLoading: true,
        docModalError: '',
        docModalContent: '',
        docModalName: 'Decrypting…',
        docModalBlobUrl: '',
      });
    }

    try {
      const { payload } = await litStorage.downloadEncryptedArweaveData({
        url,
        providerLike: this.props.provider,
        account: this.props.account,
        chainId: this.props.network?.id || null,
        lit: { getKey: litHooks.getKey },
      });

      const name = (payload && payload.name) ? String(payload.name) : 'Encrypted document';
      const text = litStorage.decodeLitPayloadToText(payload);
      let blobUrl = '';
      if (!text) {
        const blob = litStorage.decodeLitPayloadToBlob(payload);
        if (blob && typeof URL !== 'undefined') {
          blobUrl = URL.createObjectURL(blob);
        }
      }

      if (this._isMounted) {
        this.setState({
          docModalLoading: false,
          docModalError: (!text && !blobUrl) ? 'Unable to decode encrypted document.' : '',
          docModalContent: text || '',
          docModalName: name,
          docModalBlobUrl: blobUrl,
        });
      }
    } catch (err) {
      if (this._isMounted) {
        this.setState({
          docModalLoading: false,
          docModalError: err?.message || 'Failed to decrypt document.',
        });
      }
    }
  };

  toggleStats = () => {
    if (this._isMounted) this.setState(prevState => ({ showStats: !prevState.showStats }));
  };

  toggleActions = () => {
    if (this._isMounted) this.setState(prevState => ({ showActions: !prevState.showActions }));
  };

  toggleMoreDetails = () => {
    if (this._isMounted) this.setState(prevState => ({ showMoreDetails: !prevState.showMoreDetails }));
  };

  toggleAdminSection = () => {
    if (this._isMounted) this.setState(prevState => ({ showAdminSection: !prevState.showAdminSection }));
  };

  toggleDocsSection = () => {
    if (this._isMounted) this.setState(prevState => ({ showDocsSection: !prevState.showDocsSection }));
  };

  renderAddressLink = (address, key = 'contract') => {
    const normalized = String(address || '').trim();
    const isZeroAddress =
      normalized.toLowerCase() === String(ethers.constants.AddressZero || '').toLowerCase();
    if (!normalized || isZeroAddress || !ethers.utils.isAddress(normalized)) return "N/A";
    const shortenedAddress = getShortenedAddress(normalized, false);
    return (
      <>
        <a href={`/u/${normalized}`} target="_blank" rel="noopener noreferrer">
          {shortenedAddress}
        </a>
        <button onClick={() => this.copyToClipboard(normalized, key)} className={styles.copyButton}>
          <FontAwesomeIcon icon={this.state.copiedAddress === key ? faCheck : faCopy} />
        </button>
        <a href={this.getExplorerUrl(normalized)} target="_blank" rel="noopener noreferrer" className={styles.expandButton}>
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
      </>
    );
  };

  getOpenMintAutoJoinUrl = (addressOverride = null) => {
    const sbtAddress = String(addressOverride || resolveSbtAddress(this.props.SBTAddress) || '').trim();
    if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) return '';

    const { sbtInfo, hasInviteMint, hasGroupPasswordMint, groupPasswordHash } = this.state;
    const normalizedHash = String(groupPasswordHash || '').trim().toLowerCase();
    const zeroHash = String(ethers.constants.HashZero || '').toLowerCase();
    const hasGroupHash = !!normalizedHash && normalizedHash !== zeroHash;
    if (sbtInfo?.hasPasswordMint || hasInviteMint || hasGroupPasswordMint || hasGroupHash) {
      return '';
    }

    const origin = (typeof window !== 'undefined' && window.location?.origin)
      ? String(window.location.origin).replace(/\/+$/, '')
      : '';
    if (!origin) return '';

    const basePath = readPublicUrlBasePath();
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug(), basePath);
    return `${origin}${demoPath}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`;
  };

  decodeJsonDataUri = (uriRaw) => {
    const raw = String(uriRaw || '').trim();
    if (!/^data:application\/json/i.test(raw)) return null;
    const commaIndex = raw.indexOf(',');
    if (commaIndex < 0) return null;
    const header = raw.slice(0, commaIndex).toLowerCase();
    const payload = raw.slice(commaIndex + 1);
    if (!payload) return null;
    let text = '';
    try {
      if (header.includes(';base64')) {
        if (typeof Buffer !== 'undefined') {
          text = Buffer.from(payload, 'base64').toString('utf8');
        } else if (typeof window !== 'undefined' && typeof window.atob === 'function') {
          text = decodeURIComponent(escape(window.atob(payload)));
        }
      } else {
        text = decodeURIComponent(payload);
      }
    } catch (_) {
      return null;
    }
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  isImageLikeUri = (uriRaw) => {
    const raw = String(uriRaw || '').trim();
    if (!raw) return false;
    if (/^data:image\//i.test(raw)) return true;
    try {
      const parsed = new URL(raw);
      const path = String(parsed.pathname || '').toLowerCase();
      if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff?)$/i.test(path)) return true;
      const extHint = String(
        parsed.searchParams.get('ext') ||
        parsed.searchParams.get('format') ||
        ''
      ).toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'tif', 'tiff'].includes(extHint)) {
        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  };

  resolveDisplayImageHref = (sbtInfo) => {
    const candidates = this.getDisplayImageUrlCandidates(sbtInfo);
    const candidate = candidates[0] || '';
    return candidate || defaultSbtImage;
  };

  getDisplayImageUrlCandidates = (sbtInfo) => {
    const imageValue = sbtInfo?.image;
    return buildArweaveGatewayUrlCandidates(imageValue, { gateway: '' });
  };

  getDisplayImageRenderState = (sbtInfo) => {
    const sourceKey = String(sbtInfo?.image || '').trim();
    const candidates = this.getDisplayImageUrlCandidates(sbtInfo);
    const activeIndex = this.state.displayImageFallbackKey === sourceKey
      ? Math.max(0, Number(this.state.displayImageFallbackIndex || 0))
      : 0;
    const src = candidates[activeIndex] || defaultSbtImage;
    return {
      sourceKey,
      candidates,
      activeIndex,
      src,
      canRetry: activeIndex < candidates.length,
    };
  };

  // Keep SBT artwork resilient when the preferred Arweave gateway flakes out mid-load.
  handleDisplayImageError = ({ sourceKey = '', activeIndex = 0, candidates = [] } = {}) => {
    const maxIndex = Array.isArray(candidates) ? candidates.length : 0;
    if (activeIndex >= maxIndex) return;
    this.setState((prevState) => {
      const currentIndex = prevState.displayImageFallbackKey === sourceKey
        ? Math.max(0, Number(prevState.displayImageFallbackIndex || 0))
        : 0;
      if (currentIndex !== activeIndex) return null;
      return {
        displayImageFallbackKey: sourceKey,
        displayImageFallbackIndex: Math.min(activeIndex + 1, maxIndex),
      };
    });
  };

  normalizeCanonicalMetadataHref = (candidateRaw) => {
    const candidate = String(candidateRaw || '').trim();
    if (!candidate) return '';
    const normalized = normalizeArweaveUrl(candidate, { contextLabel: 'sbt_page_token_uri' });
    if (!normalized || /^data:/i.test(normalized)) return '';
    if (this.isImageLikeUri(normalized)) return '';
    return normalized;
  };

  resolveTokenMetadataHref = (tokenUriRaw) => {
    const raw = String(tokenUriRaw || '').trim();
    if (!raw) return '';

    const normalizedDirect = this.normalizeCanonicalMetadataHref(raw);
    if (normalizedDirect) return normalizedDirect;
    if (!/^data:application\/json/i.test(raw)) return '';

    // For embedded JSON tokenURI, prefer explicit SBT token URI fields first.
    // Some payloads also include session-level metadataUri fields; those should
    // not override a concrete SBT token URI.
    const decoded = this.decodeJsonDataUri(raw);
    if (!decoded) return '';
    const candidates = [
      decoded.tokenURI,
      decoded.tokenUri,
      decoded.token_uri,
      decoded.uri,
      decoded.sbtTokenURI,
      decoded.sbtTokenUri,
      decoded.sbt_token_uri,
      decoded.metadataUri,
      decoded.metadataURI,
      decoded.metadata_uri,
      decoded.arweaveUri,
      decoded.arweaveURL,
      (typeof decoded.arweaveTxId === 'string' ? `ar://${decoded.arweaveTxId}` : null),
    ];
    for (const candidate of candidates) {
      const normalized = this.normalizeCanonicalMetadataHref(candidate);
      if (normalized) return normalized;
    }
    return '';
  };

  getLoadSbtInfoRequestKey = () => {
    const sbtAddress = resolveSbtAddress(this.props.SBTAddress);
    const activeSlug = this.getExplicitSessionSlug() ?? '';
    const currentNetwork = this.state.network || this.props.network;
    return [
      String(sbtAddress || '').trim().toLowerCase(),
      normalizeSessionSlug(activeSlug || ''),
      String(Number(currentNetwork?.id || 0) || 0),
      String(this.props.account || '').trim().toLowerCase(),
      String(Number(this.props.sbtCacheRevision || 0) || 0),
    ].join('|');
  };

  normalizeLoadSbtInfoOptions = (optionsOrForce = false) => {
    if (optionsOrForce && typeof optionsOrForce === 'object' && !Array.isArray(optionsOrForce)) {
      return {
        forceEventFetch: optionsOrForce.forceEventFetch === true || optionsOrForce.force === true,
        preferCountsOnly: optionsOrForce.preferCountsOnly === true || optionsOrForce.countsOnly === true,
      };
    }
    return {
      forceEventFetch: optionsOrForce === true,
      preferCountsOnly: false,
    };
  };

  isCurrentLoadSbtInfoRequest = (requestKey) => (
    !!requestKey && requestKey === this._latestLoadSbtInfoRequestKey
  );

  fetchHolderAddressesByTokenOwnership = async (sbtAddress, sessionSlug, mintedCountRaw) => {
    const mintedCount = Math.floor(Number(mintedCountRaw || 0));
    if (!Number.isFinite(mintedCount) || mintedCount <= 0) return [];
    const MAX_OWNER_LOOKUPS = 512;
    if (mintedCount > MAX_OWNER_LOOKUPS) {
      sbtLog.warn('[SBTPage] skipping ownerOf fallback due large minted count', {
        sbtAddress,
        mintedCount,
        maxLookups: MAX_OWNER_LOOKUPS,
      });
      return [];
    }
    const zero = String(ethers.constants.AddressZero || '').toLowerCase();
    const holders = new Set();
    const probeOwnerByTokenId = async (tokenId) => {
      let owner = null;
      try {
        owner = await contractScripts.getOwnerByTokenId('none', sbtAddress, tokenId, sessionSlug);
      } catch (_) {
        owner = null;
      }
      const normalized = String(owner || '').trim().toLowerCase();
      if (!normalized || normalized === zero) return;
      if (!ethers.utils.isAddress(normalized)) return;
      holders.add(normalized);
    };
    // Probe canonical one-based ids first (CustomSBT), then also probe tokenId 0 for zero-based legacy contracts.
    const BATCH_SIZE = 10;
    for (let i = 1; i <= mintedCount; i += BATCH_SIZE) {
      const batch = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE, mintedCount + 1); j += 1) {
        batch.push(probeOwnerByTokenId(j));
      }
      await Promise.all(batch);
    }
    await probeOwnerByTokenId(0);
    return Array.from(holders).sort();
  };

  // Load SBT info. Always signal loading state so render() can decide whether
  // to show a full placeholder (first load) or a subtle indicator (refresh).

  async loadSBTInfo(optionsOrForce = false) {
    const loadOptions = this.normalizeLoadSbtInfoOptions(optionsOrForce);
    const { forceEventFetch, preferCountsOnly } = loadOptions;
    const { SBTAddress: SBTAddressProp } = this.props;
    const currentNetwork = this.state.network || this.props.network;

    // Resolve address
    const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
      ? SBTAddressProp.find(entry => entry?.sbtAddress !== undefined)?.sbtAddress
      : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);
    const requestKey = this.getLoadSbtInfoRequestKey();
    this._latestLoadSbtInfoRequestKey = requestKey;
    const isCurrentLoad = () => this.isCurrentLoadSbtInfoRequest(requestKey);

    if (this._loadSbtInfoInFlight) {
      this._loadSbtInfoPending = true;
      const pendingOptions = this._loadSbtInfoPendingOptions || {
        forceEventFetch: false,
        preferCountsOnly: false,
      };
      this._loadSbtInfoPendingOptions = {
        forceEventFetch: pendingOptions.forceEventFetch || forceEventFetch,
        preferCountsOnly: pendingOptions.preferCountsOnly || preferCountsOnly,
      };
      if (forceEventFetch) this._loadSbtInfoPendingForce = true;
      return;
    }

    if (!sbtAddressOriginalCase) {
      if (this._isMounted) this.setState({ loadingMintersBurners: false });
      return;
    }
    this._loadSbtInfoInFlight = true;
    const addrLower = sbtAddressOriginalCase.toLowerCase();
    const normalizedExplicitSlug = this.getExplicitSessionSlug();
    const hasExplicitSlug = normalizedExplicitSlug != null;
    const initialSlug = hasExplicitSlug ? normalizedExplicitSlug : this.getEffectiveSessionSlug();
    const logContext = {
      address: sbtAddressOriginalCase,
      addrLower,
      explicitSlug: normalizedExplicitSlug,
      initialSlug,
      forceEventFetch,
      preferCountsOnly,
      account: this.props.account ? this.props.account.toLowerCase() : null,
      networkId: currentNetwork?.id ?? null
    };
    sbtLog.info('[SBTPage] loadSBTInfo:start', logContext);

    const toSec = (v) => {
      const n = Number(v || 0);
      if (!Number.isFinite(n) || n < 0) return 0;
      return n > 1e12 ? Math.floor(n / 1000) : n;
    };
    const normalizeHistorySummary = (value) => {
      if (!value || typeof value !== 'object') return null;
      const normalizeField = (fieldValue) => {
        const raw = String(fieldValue ?? '').trim();
        if (!/^\d+$/.test(raw)) return null;
        return raw.replace(/^0+(?=\d)/, '') || '0';
      };
      const totalMinted = normalizeField(value.totalMinted);
      const totalBurned = normalizeField(value.totalBurned);
      const activeSupply = normalizeField(value.activeSupply);
      const currentHolderCount = normalizeField(value.currentHolderCount);
      const historicalHolderCount = normalizeField(value.historicalHolderCount);
      if (
        totalMinted == null ||
        totalBurned == null ||
        activeSupply == null ||
        currentHolderCount == null ||
        historicalHolderCount == null
      ) {
        return null;
      }
      return {
        totalMinted,
        totalBurned,
        activeSupply,
        currentHolderCount,
        historicalHolderCount,
      };
    };

    const fillFromChainIfMissing = async (infoIn, addr, slugForRead) => {
      const info = { ...(infoIn || {}) };
      const zeroAddress = String(ethers.constants.AddressZero || '').toLowerCase();
      const adminRaw = String(info.admin || info.admin_ || '').trim();
      const needMax = (info.maxTokens == null);
      // Keep fully hydrated cache entries on the fast path. Only re-read burnAuth when
      // it is missing or a caller explicitly flags the cached value as stale.
      const needBurn = info.burnAuthNeedsOnChainRefresh === true || !Number.isFinite(Number(info.burnAuth));
      const needEnd = !(Number(info.mintingEndTime) >= 0);
      const needHasPw = (typeof info.hasPasswordMint !== 'boolean');
      const needAdmin = !adminRaw || adminRaw.toLowerCase() === zeroAddress;
      const withSoftReadTimeout = (task, fallbackValue = null, timeoutMs = 750) => new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        };
        const timer = setTimeout(() => finish(fallbackValue), timeoutMs);
        Promise.resolve(task)
          .then((value) => finish(value))
          .catch(() => finish(fallbackValue));
      });
      const SBT_ABI_FRAG = [
        "function maxTokens() view returns (uint256)",
        "function collectionBurnAuth() view returns (uint8)",
        "function mintingEndTime() view returns (uint256)",
        "function hasPasswordMint() view returns (bool)",
        "function admin() view returns (address)",
        "function owner() view returns (address)"
      ];
      if (!needMax && !needBurn && !needEnd && !needHasPw && !needAdmin) {
        return info;
      }
      try {
        const ro = contractScripts.getReadProviderForGroup(slugForRead, { contractKey: 'sbtFactory' });
        const c = new ethers.Contract(addr, SBT_ABI_FRAG, ro);
        const [max, burn, end, hasPw, adminAddr, ownerAddr] = await Promise.all([
          needMax ? withSoftReadTimeout(c.maxTokens(), null) : null,
          needBurn ? withSoftReadTimeout(c.collectionBurnAuth(), null) : null,
          needEnd ? withSoftReadTimeout(c.mintingEndTime(), null) : null,
          needHasPw ? withSoftReadTimeout(c.hasPasswordMint(), null) : null,
          needAdmin ? withSoftReadTimeout(c.admin(), null) : null,
          needAdmin ? withSoftReadTimeout(c.owner(), null) : null,
        ]);
        if (max != null) info.maxTokens = ethers.BigNumber.isBigNumber(max) ? max.toString() : String(max);
        if (burn != null) {
          info.burnAuth = Number(ethers.BigNumber.isBigNumber(burn) ? burn.toNumber() : burn);
          info.burnAuthVerifiedOnChain = true;
          delete info.burnAuthNeedsOnChainRefresh;
        }
        if (end != null) info.mintingEndTime = toSec(ethers.BigNumber.isBigNumber(end) ? end.toNumber() : Number(end));
        if (hasPw != null) info.hasPasswordMint = !!hasPw;
        const nextAdmin = [adminAddr, ownerAddr]
          .map((value) => String(value || '').trim())
          .find((value) => value && value.toLowerCase() !== zeroAddress);
        if (nextAdmin) {
          info.admin = nextAdmin;
          info.admin_ = nextAdmin;
          if (!info.deployer) info.deployer = nextAdmin;
          if (!info.creator) info.creator = nextAdmin;
        }
      } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
      return info;
    };

    const readCacheForSlug = async (slugForCache, netKeyForCache) => {
      try {
        const parsedRaw = await readCache('sbtCache', slugForCache);
        let parsed = (parsedRaw && typeof parsedRaw === 'object') ? parsedRaw : {};
        if (parsed[netKeyForCache] == null) {
          const legacy = Object.keys(parsed || {}).find(k => k !== netKeyForCache && Number(k) === Number(netKeyForCache));
          if (legacy) parsed[netKeyForCache] = { ...(parsed[netKeyForCache] || {}), ...(parsed[legacy] || {}) };
        }
        return parsed;
      } catch { return {}; }
    };

    const needsTokenUriFields = (i) => {
      if (!i || typeof i !== 'object') return true;
      const has = (value) => value !== undefined && value !== null && String(value).trim() !== '';
      const tokenUri = i.tokenURI ?? i.tokenUri ?? null;
      const image = i.image ?? null;
      const hasImageMetadata =
        has(image) ||
        i?.imageLocked === true ||
        !!i?.imageEncrypted ||
        !!i?.encryptedImage ||
        !!(i?.encryptedFields && typeof i.encryptedFields === 'object' && i.encryptedFields.image);
      const endOk = Number.isFinite(Number(i.mintingEndTime));
      const burnOk = Number.isFinite(Number(i.burnAuth));
      const hasPw = (typeof i.hasPasswordMint === 'boolean');
      const maxTok = has(i.maxTokens);
      const adminAddress = String(i.admin || i.admin_ || i.deployer || '').trim();
      const adminOk =
        !!adminAddress &&
        adminAddress.toLowerCase() !== String(ethers.constants.AddressZero || '').toLowerCase();
      return !(has(tokenUri) && hasImageMetadata && endOk && burnOk && hasPw && maxTok && adminOk);
    };
    const needsDirectMetadataHydration = (i) => {
      if (!i || typeof i !== 'object') return true;
      return Object.keys(i).length === 0;
    };

    const findCachedEntryAcrossGroups = ({ excludeSlug = null } = {}) => {
      const excludedSlug = normalizeSessionSlug(excludeSlug || '');
      try {
        const entries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
        for (const item of entries) {
          const s = item?.slug || '';
          const normalizedSourceSlug = normalizeSessionSlug(s);
          if (excludedSlug && normalizedSourceSlug === excludedSlug) continue;
          const parsed = (item?.value && typeof item.value === 'object') ? item.value : {};
          for (const netKey of Object.keys(parsed || {})) {
            const entry = parsed?.[netKey]?.sbtList?.[addrLower];
            if (entry) {
              const candidateSlug = normalizeSessionSlug(entry.slug != null ? entry.slug : s);
              if (excludedSlug && candidateSlug === excludedSlug) continue;
              return {
                slug: candidateSlug,
                entry,
                netKey: String(netKey)
              };
            }
          }
        }
      } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
      return null;
    };

    const deriveNetKeyForSlug = (slugForCache, netKeyHint = null, infoHint = null) => {
      const chainIdHint =
        infoHint?.chainID ||
        infoHint?.chainId ||
        netKeyHint;
      const chainId =
        getSessionChainId(slugForCache) ||
        (chainIdHint != null ? Number(chainIdHint) : null) ||
        currentNetwork?.id ||
        null;
      return chainId != null ? String(chainId) : '';
    };
    const buildDirectMetadataContext = (slugForRead, netKeyHint = null, infoHint = null) => {
      const normalizedSlug = normalizeSessionSlug(slugForRead || '');
      const chainId =
        Number(getSessionChainId(normalizedSlug) || infoHint?.chainID || infoHint?.chainId || netKeyHint || currentNetwork?.id || 0)
        || null;
      const ctx = {};
      if (normalizedSlug) ctx.slug = normalizedSlug;
      if (chainId) ctx.networkChainId = chainId;
      return Object.keys(ctx).length ? ctx : (normalizedSlug || '');
    };

    const syncResolvedSessionSlug = (slugToSync) => {
      if (!this._isMounted || !isCurrentLoad()) return;
      const targetSlug = hasExplicitSlug ? normalizedExplicitSlug : slugToSync;
      if (this.state.resolvedSessionSlug !== targetSlug) {
        this.setState({ resolvedSessionSlug: targetSlug });
      }
    };

    // Signal loading start (allows render() to choose between placeholder or subtle spinner)
    if (this._isMounted) {
      this.setState({
        loadingMintersBurners: true,
        logScanProgress: null,
        ...(hasExplicitSlug ? { resolvedSessionSlug: normalizedExplicitSlug } : {}),
      });
    }

    try {
      let cacheHit = hasExplicitSlug ? null : findCachedEntryAcrossGroups();
      let resolvedSlug = hasExplicitSlug ? normalizedExplicitSlug : (cacheHit?.slug || initialSlug);
      let netIdStr = deriveNetKeyForSlug(resolvedSlug, cacheHit?.netKey, cacheHit?.entry?.sbtInfo);
      if (!netIdStr) {
        netIdStr = deriveNetKeyForSlug(initialSlug, cacheHit?.netKey, cacheHit?.entry?.sbtInfo);
      }

      syncResolvedSessionSlug(resolvedSlug);

      let cache = await readCacheForSlug(resolvedSlug, netIdStr);
      if (!isCurrentLoad()) return;
      let entry = cache[netIdStr]?.sbtList?.[addrLower] || (hasExplicitSlug ? null : cacheHit?.entry) || null;
      let sbtInfo = entry?.sbtInfo || null;

      if (hasExplicitSlug && (entry == null || needsTokenUriFields(sbtInfo))) {
        const crossGroupFallbackHit = findCachedEntryAcrossGroups({ excludeSlug: resolvedSlug });
        if (crossGroupFallbackHit) {
          netIdStr = deriveNetKeyForSlug(resolvedSlug, crossGroupFallbackHit.netKey, crossGroupFallbackHit.entry?.sbtInfo);
          if (!netIdStr) {
            netIdStr = deriveNetKeyForSlug(initialSlug, crossGroupFallbackHit.netKey, crossGroupFallbackHit.entry?.sbtInfo);
          }
          if (crossGroupFallbackHit.entry?.sbtInfo) {
            sbtInfo = {
              ...(crossGroupFallbackHit.entry.sbtInfo || {}),
              ...(sbtInfo && typeof sbtInfo === 'object' ? sbtInfo : {}),
            };
          }
          sbtLog.info('[SBTPage] explicit slug fallback to cached cross-group entry', {
            explicitSlug: normalizedExplicitSlug,
            fallbackSlug: crossGroupFallbackHit.slug || null,
            netIdStr,
            entryFound: !!crossGroupFallbackHit.entry,
          });
        }
      }

      sbtLog.info('[SBTPage] cache lookup', {
        resolvedSlug,
        netIdStr,
        cacheHitSlug: cacheHit?.slug || null,
        entryFound: !!entry,
        countsLoaded: entry?.countsLoaded === true,
        mintedAddresses: Array.isArray(entry?.mintedAddresses) ? entry.mintedAddresses.length : 0,
        burnedAddresses: Array.isArray(entry?.burnedAddresses) ? entry.burnedAddresses.length : 0,
        mintedEventCount: entry?.mintedEventCount ?? null,
        burnedEventCount: entry?.burnedEventCount ?? null,
        blockNumber: entry?.blockNumber ?? null,
        creationBlock: entry?.creationBlock ?? entry?.sbtInfo?.creationBlock ?? null,
        sbtInfoChainId: entry?.sbtInfo?.chainID ?? null,
        sbtInfoSessionName: entry?.sbtInfo?.sessionName ?? null
      });
      const canReportProgress = !this.props.miniaturized;
      const makeProgressHandler = (slugForProgress) => {
        if (!canReportProgress || !isCurrentLoad()) return null;
        const scanKey = `${String(slugForProgress || '')}:${addrLower}:${Date.now()}`;
        this._activeScanKey = scanKey;
        return (progress) => {
          if (!this._isMounted || this._activeScanKey !== scanKey || !isCurrentLoad()) return;
          this.setState({ logScanProgress: { ...progress, slug: slugForProgress } });
        };
      };

      const buildRefreshOptions = (_countsLoadedFlag, slugForProgress) => {
        if (!forceEventFetch) return undefined;
        const onProgress = makeProgressHandler(slugForProgress);
        const refreshOptions = onProgress ? { forceCounts: true, onProgress } : { forceCounts: true };
        if (preferCountsOnly) refreshOptions.countsOnly = true;
        return refreshOptions;
      };
      let refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);
      const applyPrimaryMetadataState = (nextSbtInfo, extraState = {}) => {
        if (!this._isMounted || !isCurrentLoad()) return;
        const adminAddr = nextSbtInfo ? (nextSbtInfo.admin || nextSbtInfo.admin_ || '') : '';
        const nextUserLower = String(this.props.account || '').toLowerCase();
        const nextUserIsAdmin = nextUserLower && adminAddr && (nextUserLower === String(adminAddr).toLowerCase());
        this.setState((prev) => ({
          sbtInfo: nextSbtInfo || prev.sbtInfo || null,
          userIsSbtAdmin: nextUserIsAdmin,
          ...extraState,
        }));
      };

      // Centralized metadata hydration
      const usingCentralHydration = (typeof this.props.refreshSbtData === 'function');
      const parentOwnsInitialRefresh = (
        usingCentralHydration &&
        forceEventFetch !== true &&
        this.props.isSBTCacheReady === false
      );
      let metaKey = `${normalizeSessionSlug(resolvedSlug || '')}:${netIdStr}:${addrLower}`;
      if (
        usingCentralHydration &&
        !parentOwnsInitialRefresh &&
        needsTokenUriFields(sbtInfo) &&
        !this._metaHydrationTried[metaKey]
      ) {
        if (!isCurrentLoad()) return;
        this._metaHydrationTried[metaKey] = true;
        try { await this.refreshSbtDataWithSlug(sbtAddressOriginalCase, refreshOptions, resolvedSlug); } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
        if (!isCurrentLoad()) return;
        cache = await readCacheForSlug(resolvedSlug, netIdStr);
        if (!isCurrentLoad()) return;
        entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
        sbtInfo = entry?.sbtInfo || sbtInfo;
        refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);
      }

      if (
        (parentOwnsInitialRefresh && needsTokenUriFields(sbtInfo)) ||
        (!usingCentralHydration && needsDirectMetadataHydration(sbtInfo))
      ) {
        if (!isCurrentLoad()) return;
        try {
          const directMetadata = await contractScripts.getSbtMetadata(
            'none',
            sbtAddressOriginalCase,
            buildDirectMetadataContext(resolvedSlug, netIdStr, sbtInfo)
          );
          if (!isCurrentLoad()) return;
          if (directMetadata && typeof directMetadata === 'object') {
            sbtInfo = {
              ...(sbtInfo && typeof sbtInfo === 'object' ? sbtInfo : {}),
              ...directMetadata,
              ...(Number.isFinite(Number(directMetadata?.burnAuth))
                ? { burnAuthVerifiedOnChain: true }
                : {}),
            };
          }
        } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
      }

      const slugFromName = this.resolveSessionSlugFromInfo(sbtInfo);
      if (!hasExplicitSlug && slugFromName && slugFromName !== resolvedSlug) {
        resolvedSlug = slugFromName;
        syncResolvedSessionSlug(resolvedSlug);
        sbtLog.info('[SBTPage] slug override from metadata', {
          previousSlug: cacheHit?.slug || normalizedExplicitSlug || initialSlug,
          resolvedSlug,
          sessionName: sbtInfo?.sessionName || null
        });
        netIdStr = deriveNetKeyForSlug(resolvedSlug, cacheHit?.netKey, sbtInfo);
        metaKey = `${normalizeSessionSlug(resolvedSlug || '')}:${netIdStr}:${addrLower}`;
        cache = await readCacheForSlug(resolvedSlug, netIdStr);
        if (!isCurrentLoad()) return;
        entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
        sbtInfo = entry?.sbtInfo || sbtInfo;
        refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);

        if (
          usingCentralHydration &&
          !parentOwnsInitialRefresh &&
          needsTokenUriFields(sbtInfo) &&
          !this._metaHydrationTried[metaKey]
        ) {
          if (!isCurrentLoad()) return;
          this._metaHydrationTried[metaKey] = true;
          try { await this.refreshSbtDataWithSlug(sbtAddressOriginalCase, refreshOptions, resolvedSlug); } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
          if (!isCurrentLoad()) return;
          cache = await readCacheForSlug(resolvedSlug, netIdStr);
          if (!isCurrentLoad()) return;
          entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
          sbtInfo = entry?.sbtInfo || sbtInfo;
          refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);
        }
        if (
          (parentOwnsInitialRefresh && needsTokenUriFields(sbtInfo)) ||
          (!usingCentralHydration && needsDirectMetadataHydration(sbtInfo))
        ) {
          if (!isCurrentLoad()) return;
          try {
            const directMetadata = await contractScripts.getSbtMetadata(
              'none',
              sbtAddressOriginalCase,
              buildDirectMetadataContext(resolvedSlug, netIdStr, sbtInfo)
            );
            if (!isCurrentLoad()) return;
            if (directMetadata && typeof directMetadata === 'object') {
              sbtInfo = {
                ...(sbtInfo && typeof sbtInfo === 'object' ? sbtInfo : {}),
                ...directMetadata,
                ...(Number.isFinite(Number(directMetadata?.burnAuth))
                  ? { burnAuthVerifiedOnChain: true }
                  : {}),
              };
            }
          } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
        }
      } else if (hasExplicitSlug && slugFromName && slugFromName !== resolvedSlug) {
        sbtLog.info('[SBTPage] ignoring metadata slug override because route session is pinned', {
          explicitSlug: normalizedExplicitSlug,
          metadataSlug: slugFromName,
          sessionName: sbtInfo?.sessionName || null,
        });
      }

      sbtInfo = await fillFromChainIfMissing(sbtInfo || {}, sbtAddressOriginalCase, resolvedSlug);
      if (!isCurrentLoad()) return;
      applyPrimaryMetadataState(sbtInfo);

      const resolvedChainId = Number(getSessionChainId(resolvedSlug) || sbtInfo?.chainID || currentNetwork?.id || 0) || null;
      const encryptedFields = (sbtInfo?.encryptedFields && typeof sbtInfo.encryptedFields === 'object')
        ? sbtInfo.encryptedFields
        : {};
      const nameEnvelope =
        encryptedFields?.name ||
        sbtInfo?.nameEncrypted ||
        sbtInfo?.encryptedName ||
        null;
      const descriptionEnvelope =
        encryptedFields?.description ||
        sbtInfo?.descriptionEncrypted ||
        sbtInfo?.encryptedDescription ||
        null;
      const tagsEnvelope =
        encryptedFields?.tags ||
        sbtInfo?.tagsEncrypted ||
        sbtInfo?.encryptedTags ||
        null;
      const documentUrlsEnvelope =
        encryptedFields?.documentURLs ||
        sbtInfo?.documentURLsEncrypted ||
        sbtInfo?.docUrlsEncrypted ||
        null;
      const imageEnvelope =
        encryptedFields?.image ||
        sbtInfo?.imageEncrypted ||
        sbtInfo?.encryptedImage ||
        null;
      const litHooks = getGlobalLitHooks();
      const lit = litHooks && typeof litHooks.getKey === 'function'
        ? { getKey: litHooks.getKey }
        : null;
      const activeAccount = this.props.account;
      const envelopeFingerprint = [
        nameEnvelope ? 'n' : '',
        descriptionEnvelope ? 'd' : '',
        tagsEnvelope ? 't' : '',
        documentUrlsEnvelope ? 'u' : '',
        imageEnvelope ? 'i' : '',
      ].join('');
      const decryptKey = `${metaKey}:${activeAccount || ''}:${envelopeFingerprint}`;
      if ((nameEnvelope || descriptionEnvelope || tagsEnvelope || documentUrlsEnvelope || imageEnvelope) && !this._descDecryptTried[decryptKey]) {
        if (!isCurrentLoad()) return;
        const coerceStringArray = (value) => {
          if (Array.isArray(value)) return value.map((entry) => String(entry));
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            if (trimmed.startsWith('[')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map((entry) => String(entry));
              } catch (_) {}
            }
            return [trimmed];
          }
          return [];
        };
        if (lit && activeAccount) {
          let allFieldsOk = true;
          if (nameEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(nameEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.name = String(decrypted);
                sbtInfo.nameDecrypted = true;
              }
            } catch (e) { allFieldsOk = false; sbtLog.warn('SBTPage: name decrypt fallback', e); }
          }
          if (descriptionEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(descriptionEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.description = String(decrypted);
                sbtInfo.descriptionDecrypted = true;
              }
            } catch (e) { allFieldsOk = false; sbtLog.warn('SBTPage: description decrypt fallback', e); }
          }
          if (tagsEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(tagsEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.tags = coerceStringArray(decrypted);
                sbtInfo.tagsDecrypted = true;
              }
            } catch (e) { allFieldsOk = false; sbtLog.warn('SBTPage: tags decrypt fallback', e); }
          }
          if (documentUrlsEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(documentUrlsEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.documentURLs = coerceStringArray(decrypted);
                sbtInfo.documentURLsDecrypted = true;
              }
            } catch (e) { allFieldsOk = false; sbtLog.warn('SBTPage: documentURLs decrypt fallback', e); }
          }
          if (imageEnvelope) {
            try {
              if (
                imageEnvelope &&
                typeof imageEnvelope === 'object' &&
                (
                  imageEnvelope.storage === 'lit-arweave' ||
                  imageEnvelope.txId ||
                  imageEnvelope.url
                )
              ) {
                const { payload } = await litStorage.downloadEncryptedArweaveData({
                  url: imageEnvelope.url,
                  txId: imageEnvelope.txId,
                  providerLike: this.props.provider,
                  account: activeAccount,
                  chainId: resolvedChainId,
                  lit: { getKey: lit.getKey },
                });
                if (!isCurrentLoad()) return;
                const blob = litStorage.decodeLitPayloadToBlob(payload);
                if (blob && typeof URL !== 'undefined') {
                  const blobUrl = URL.createObjectURL(blob);
                  this.releaseDecryptedImageBlobUrl();
                  this._decryptedImageBlobUrl = blobUrl;
                  sbtInfo.image = blobUrl;
                  sbtInfo.imageDecrypted = true;
                }
              } else {
                const decrypted = await cryptoUtils.decryptEnvelopeValue(imageEnvelope, {
                  account: activeAccount,
                  chainId: resolvedChainId,
                  providerLike: this.props.provider,
                  litOpts: lit,
                });
                if (!isCurrentLoad()) return;
                if (decrypted != null && decrypted !== '') {
                  sbtInfo.image = String(decrypted);
                  sbtInfo.imageDecrypted = true;
                }
              }
            } catch (e) { allFieldsOk = false; sbtLog.warn('SBTPage: image decrypt fallback', e); }
          }
          // Only mark as tried when all fields succeeded — allow retry on transient failures
          if (allFieldsOk) {
            this._descDecryptTried[decryptKey] = true;
          }
        }
      }
      applyPrimaryMetadataState(sbtInfo);

      const shouldReuseCachedGroupPasswordHash =
        preferCountsOnly &&
        this.state.groupPasswordHashLoaded === true;
      const groupPasswordHash = shouldReuseCachedGroupPasswordHash
        ? this.state.groupPasswordHash
        : await contractScripts.getGroupPasswordHash('none', sbtAddressOriginalCase, resolvedSlug);
      if (!isCurrentLoad()) return;
      const hasGroupHash = !!groupPasswordHash && groupPasswordHash !== ethers.constants.HashZero;
      const hasInviteMint = hasGroupHash && !!sbtInfo?.hasPasswordMint;
      const hasGroupPasswordMint = hasGroupHash && !sbtInfo?.hasPasswordMint;

      let historySummary = normalizeHistorySummary(entry?.historySummary);
      let mintedAddresses = this.expandAddressListFromCountMap(
        entry?.mintedCountByAddress,
        entry?.mintedAddresses
      );
      let burnedAddresses = this.expandAddressListFromCountMap(
        entry?.burnedCountByAddress,
        entry?.burnedAddresses
      );
      let countsLoaded = entry?.countsLoaded === true;
      let mintedTokensOverride = null;
      let mintedTokensSource = null;
      let ownerLookupUpperBound = null;
      const setSummaryFallbacks = (summaryValue, sourceLabel) => {
        const holderCount = this.sanitizeMintedTokensOverride(summaryValue?.currentHolderCount);
        const totalMinted = this.sanitizeMintedTokensOverride(summaryValue?.totalMinted);
        if (holderCount != null) {
          mintedTokensOverride = holderCount;
          mintedTokensSource = sourceLabel;
        }
        if (totalMinted != null) {
          ownerLookupUpperBound = totalMinted;
        }
      };
      if (!countsLoaded || mintedAddresses.length === 0) {
        setSummaryFallbacks(historySummary, 'summary-cache');
        if (mintedTokensOverride == null) {
          try {
            const summaryRaw = await contractScripts.getSbtHistorySummary('none', sbtAddressOriginalCase, resolvedSlug);
            if (!isCurrentLoad()) return;
            historySummary = normalizeHistorySummary(summaryRaw) || historySummary;
            setSummaryFallbacks(historySummary, 'summary-group');
            sbtLog.info('[SBTPage] history summary load via group', {
              resolvedSlug,
              historySummary,
              mintedTokensOverride
            });
          } catch (err) {
            sbtLog.warn('[SBTPage] history summary fallback failed', { resolvedSlug, error: err?.message || err });
          }
        }
        if (mintedTokensOverride == null && sbtInfo?.chainID != null) {
          try {
            const fallbackCfg = { networkChainId: Number(sbtInfo.chainID) };
            const summaryRaw = await contractScripts.getSbtHistorySummary('none', sbtAddressOriginalCase, fallbackCfg);
            if (!isCurrentLoad()) return;
            historySummary = normalizeHistorySummary(summaryRaw) || historySummary;
            setSummaryFallbacks(historySummary, 'summary-chainId');
            sbtLog.info('[SBTPage] history summary fallback via chainID', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              historySummary,
              mintedTokensOverride
            });
          } catch (err) {
            sbtLog.warn('[SBTPage] history summary chain fallback failed', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              error: err?.message || err
            });
          }
        }
        if (mintedTokensOverride == null) {
          try {
            const mintedTokensRaw = await contractScripts.getMintedTokens('none', sbtAddressOriginalCase, resolvedSlug);
            if (!isCurrentLoad()) return;
            mintedTokensOverride = this.sanitizeMintedTokensOverride(mintedTokensRaw);
            if (mintedTokensOverride != null) {
              mintedTokensSource = 'mintedTokens-group';
              ownerLookupUpperBound = mintedTokensOverride;
            }
          } catch (_) {
            mintedTokensOverride = null;
          }
        }
        if (mintedTokensOverride == null && sbtInfo?.chainID != null) {
          try {
            const fallbackCfg = { networkChainId: Number(sbtInfo.chainID) };
            const mintedTokensRaw = await contractScripts.getMintedTokens('none', sbtAddressOriginalCase, fallbackCfg);
            if (!isCurrentLoad()) return;
            mintedTokensOverride = this.sanitizeMintedTokensOverride(mintedTokensRaw);
            if (mintedTokensOverride != null) {
              mintedTokensSource = 'mintedTokens-chainId';
              ownerLookupUpperBound = mintedTokensOverride;
            }
            sbtLog.info('[SBTPage] mintedTokens fallback via chainID', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              mintedTokensOverride
            });
          } catch (err) {
            sbtLog.warn('[SBTPage] mintedTokens fallback failed', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              error: err?.message || err
            });
          }
        }
      }
      if (sbtInfo?.chainID != null) {
        const groupChainId = getSessionChainId(resolvedSlug);
        const sbtChainId = Number(sbtInfo.chainID);
        const chainMismatch =
          groupChainId &&
          Number.isFinite(Number(groupChainId)) &&
          Number.isFinite(sbtChainId) &&
          Number(groupChainId) !== sbtChainId;
        if (chainMismatch) {
          sbtLog.warn('[SBTPage] chainId mismatch', {
            resolvedSlug,
            groupChainId,
            sbtInfoChainId: sbtInfo.chainID
          });
          if (mintedTokensSource === 'summary-group' || mintedTokensSource === 'mintedTokens-group') {
            sbtLog.warn('[SBTPage] ignoring holder summary from mismatched group chain', {
              resolvedSlug,
              groupChainId,
              sbtInfoChainId: sbtInfo.chainID
            });
            mintedTokensOverride = null;
            mintedTokensSource = null;
            ownerLookupUpperBound = null;
          }
        }
      }
      let ownerLookupTokenCount = ownerLookupUpperBound != null ? Number(ownerLookupUpperBound) : NaN;
      if (!Number.isFinite(ownerLookupTokenCount) && mintedTokensOverride != null) {
        ownerLookupTokenCount = Number(mintedTokensOverride);
      }
      if (
        !usingCentralHydration &&
        forceEventFetch === true &&
        !preferCountsOnly &&
        countsLoaded !== true &&
        mintedAddresses.length === 0 &&
        burnedAddresses.length === 0 &&
        Number.isFinite(ownerLookupTokenCount) &&
        ownerLookupTokenCount > 0
      ) {
        const ownerFallback = await this.fetchHolderAddressesByTokenOwnership(
          sbtAddressOriginalCase,
          resolvedSlug,
          ownerLookupTokenCount
        );
        if (!isCurrentLoad()) return;
        if (ownerFallback.length > 0) {
          mintedAddresses = ownerFallback;
          burnedAddresses = [];
          countsLoaded = true;
          mintedTokensOverride = null;
          mintedTokensSource = 'ownerOf-fallback';
        }
      }
      const sanitizedMintedTokensOverride = this.sanitizeMintedTokensOverride(mintedTokensOverride);
      sbtLog.info('[SBTPage] counts snapshot', {
        resolvedSlug,
        countsLoaded,
        mintedAddresses: mintedAddresses.length,
        burnedAddresses: burnedAddresses.length,
        mintedTokensOverride: sanitizedMintedTokensOverride,
        mintedTokensSource
      });
      const userLower = String(this.props.account || '').toLowerCase();

      // Calculate Admin Status
      const adminAddr = sbtInfo ? (sbtInfo.admin || sbtInfo.admin_ || '') : '';
      const userIsSbtAdmin = userLower && adminAddr && (userLower === adminAddr.toLowerCase());
      if (this._isMounted && isCurrentLoad()) {
        this.setState((prev) => {
          const nextHoldersMetaKey = metaKey || null;
          const holderState = this.reconcileHolderRefreshState({
            prevState: prev,
            nextMintedAddresses: mintedAddresses,
            nextBurnedAddresses: burnedAddresses,
            nextCountsLoaded: countsLoaded,
            nextHoldersMetaKey,
            nextMintedTokensOverride: sanitizedMintedTokensOverride,
            userLower,
          });

          return {
            sbtInfo: sbtInfo || null,
            mintedAddresses: holderState.mintedAddresses,
            burnedAddresses: holderState.burnedAddresses,
            countsLoaded: holderState.countsLoaded,
            mintedTokensOverride: holderState.mintedTokensOverride,
            userHasSBT: holderState.userHasSBT,
            userIsSbtAdmin,
            groupPasswordHash: groupPasswordHash || null,
            groupPasswordHashLoaded: true,
            hasInviteMint,
            hasGroupPasswordMint,
            filteredMintedUsers: holderState.filteredMintedUsers,
            filteredMintedUsersSignature: holderState.filteredMintedUsersSignature,
            holdersMetaKey: nextHoldersMetaKey
          };
        });
      }

      // Optional one-shot event scan (counts refresh or user-initiated)
      const shouldRefreshCounts =
        forceEventFetch === true ||
        (
          !countsLoaded &&
          mintedAddresses.length === 0 &&
          burnedAddresses.length === 0 &&
          mintedTokensOverride == null
        );
      // Regression guard: MainSite already owns the initial cold-load refresh for /sbt.
      // Kicking off another forced refresh here doubles the same log scan before cache lands.
      sbtLog.info('[SBTPage] refresh decision', {
        resolvedSlug,
        shouldRefreshCounts,
        parentOwnsInitialRefresh,
        forceEventFetch,
        countsLoaded,
        mintedAddresses: mintedAddresses.length,
        burnedAddresses: burnedAddresses.length,
        mintedTokensOverride
      });
      if (
        shouldRefreshCounts &&
        usingCentralHydration &&
        !parentOwnsInitialRefresh &&
        (!refreshOptions || !refreshOptions.forceCounts)
      ) {
        const onProgress = makeProgressHandler(resolvedSlug);
        refreshOptions = onProgress ? { forceCounts: true, onProgress } : { forceCounts: true };
      }
      if (
        shouldRefreshCounts &&
        usingCentralHydration &&
        !parentOwnsInitialRefresh &&
        !this._eventScanTried[metaKey]
      ) {
        if (!isCurrentLoad()) return;
        this._eventScanTried[metaKey] = true;
        try { await this.refreshSbtDataWithSlug(sbtAddressOriginalCase, refreshOptions, resolvedSlug); } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
        if (!isCurrentLoad()) return;
        cache = await readCacheForSlug(resolvedSlug, netIdStr);
        if (!isCurrentLoad()) return;
        entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
        let minted2 = this.expandAddressListFromCountMap(
          entry?.mintedCountByAddress,
          entry?.mintedAddresses || mintedAddresses
        );
        let burned2 = this.expandAddressListFromCountMap(
          entry?.burnedCountByAddress,
          entry?.burnedAddresses || burnedAddresses
        );
        let refreshedCountsLoaded = entry?.countsLoaded === true;
        const hasMintedCountHint = Number.isFinite(ownerLookupTokenCount) && ownerLookupTokenCount > 0;
        const needsOwnerFallback =
          !preferCountsOnly &&
          minted2.length === 0 &&
          burned2.length === 0 &&
          hasMintedCountHint;
        if (needsOwnerFallback) {
          const ownerFallback = await this.fetchHolderAddressesByTokenOwnership(
            sbtAddressOriginalCase,
            resolvedSlug,
            ownerLookupTokenCount
          );
          if (!isCurrentLoad()) return;
          if (ownerFallback.length > 0) {
            minted2 = ownerFallback;
            burned2 = [];
            refreshedCountsLoaded = true;
          }
        }
        if (!refreshedCountsLoaded) {
          delete this._eventScanTried[metaKey];
        }
        if (this._isMounted && isCurrentLoad()) {
          this.setState((prev) => {
            const nextHoldersMetaKey = metaKey || null;
            const holderState = this.reconcileHolderRefreshState({
              prevState: prev,
              nextMintedAddresses: minted2,
              nextBurnedAddresses: burned2,
              nextCountsLoaded: refreshedCountsLoaded,
              nextHoldersMetaKey,
              nextMintedTokensOverride: mintedTokensOverride,
              userLower,
            });

            return {
              mintedAddresses: holderState.mintedAddresses,
              burnedAddresses: holderState.burnedAddresses,
              userHasSBT: holderState.userHasSBT,
              countsLoaded: holderState.countsLoaded,
              mintedTokensOverride: holderState.mintedTokensOverride,
              filteredMintedUsers: holderState.filteredMintedUsers,
              filteredMintedUsersSignature: holderState.filteredMintedUsersSignature,
            };
          });
        }
        sbtLog.info('[SBTPage] refresh results', {
          resolvedSlug,
          refreshedCountsLoaded,
          mintedAddresses: minted2.length,
          burnedAddresses: burned2.length,
          ownerOfFallbackApplied: needsOwnerFallback && minted2.length > 0
        });
      }
    } catch (err) {
      sbtLog.error("Error loading SBT info:", err);
    } finally {
      this._loadSbtInfoInFlight = false;
      const isCurrentRequest = this.isCurrentLoadSbtInfoRequest(requestKey);
      const shouldRerun = this._loadSbtInfoPending === true;
      const rerunOptions = this._loadSbtInfoPendingOptions;
      const rerunForce = this._loadSbtInfoPendingForce === true;
      if (this._isMounted && (isCurrentRequest || !shouldRerun)) {
        this.setState({ loadingMintersBurners: false });
      }
      this._loadSbtInfoPending = false;
      this._loadSbtInfoPendingForce = false;
      this._loadSbtInfoPendingOptions = null;
      if (shouldRerun && this._isMounted) {
        // Keep this immediate: it coalesces in-flight refresh calls, not a block-confirmation wait.
        setTimeout(() => {
          if (this._isMounted) this.loadSBTInfo(rerunOptions || rerunForce);
        }, 0);
      }
    }
  }



  startMintingEndCountdown() {
    const pollingIntervalMs = Math.max(1000, this.getActiveBlockTimeMs(1));
    const intervalId = setInterval(() => {
      if (!this._isMounted) {
        clearInterval(intervalId);
        return;
      }
      const { sbtInfo } = this.state;
      if (sbtInfo && sbtInfo.mintingEndTime != null) {
        const now = Date.now();
        const endSecRaw = Number(sbtInfo.mintingEndTime || 0);
        const endMs = (endSecRaw > 1e12 ? Math.floor(endSecRaw / 1000) : endSecRaw) * 1000;
        const distance = endMs - now;

        if (distance <= 0) {
          clearInterval(intervalId);
          if (this._isMounted) this.setState({ mintCountdown: null });
        } else {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          if (this._isMounted) this.setState({
            mintCountdown: `${days}d ${hours}h ${minutes}m ${seconds}s`,
          });
        }
      }
    }, pollingIntervalMs);

    if (this._isMounted) this.setState({ intervalId });
  }


  checkForMintPassword = () => {
    const { sbtMintPassword } = this.props;
    const finalPasswordToUse = sbtMintPassword;

    if (finalPasswordToUse && this._isMounted) {
      const isList = Array.isArray(finalPasswordToUse);
      const invitePayload = (!isList && typeof finalPasswordToUse === 'string')
        ? this.decodeInviteInput(finalPasswordToUse)
        : null;

      this.setState({
        mintPassword: (isList || invitePayload) ? '' : finalPasswordToUse,
        manualPasswordInput: (isList || invitePayload) ? '' : finalPasswordToUse,
        groupPasswordInput: invitePayload ? invitePayload.inviteCode : (this.state.groupPasswordInput || ''),
        mintStep: 0,
        showPasswordAlert: !isList && !invitePayload
      });
    } else if (!finalPasswordToUse && (this.state.mintPassword || this.state.manualPasswordInput) && this._isMounted) {
      this.setState({
        mintPassword: '',
        manualPasswordInput: '',
        showPasswordAlert: false
      });
    }
  };

  async mintUnlimitedWithGroupPassword() {
    sbtLog.log('[MANUAL-MINT] Starting manual mint...');
    try {
      if (!this.props.account) {
        this.props.toggleLoginModal(true);
        return;
      }
      const password = cryptoUtils.normalizeGroupPasswordInput(this.state.groupPasswordInput);
      if (!password) {
        this.setState({ error: 'Enter group password first.' });
        return;
      }

      const { SBTAddress: SBTAddressProp } = this.props;
      const sbt = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(e => e.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);

      sbtLog.log('[MANUAL-MINT] Preparing mint for', sbt, '...');
      const slug = this.getEffectiveSessionSlug();

      sbtLog.log('[MANUAL-MINT] Reading on-chain groupPasswordHash...');
      const onchain = await contractScripts.getGroupPasswordHash('none', sbt, slug);
      sbtLog.log('[MANUAL-MINT] On-chain groupPasswordHash:', onchain);
      if (!onchain || onchain === ethers.constants.HashZero) {
        this.setState({ error: `This ${t('sbt')} does not support group-password signature ${t('mintLower')}.` });
        return;
      }

      const walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
        password,
        sbtAddress: sbt,
        groupPasswordHash: onchain
      });
      const local = walletScopeSbtAddress === null
        ? null
        : contractScripts.computeGroupPasswordHash({
            password,
            sbtAddress: walletScopeSbtAddress
          });
      if (!local || local.toLowerCase() !== onchain.toLowerCase()) {
        sbtLog.error('[MANUAL-MINT] Sanity check FAILED', { expected: onchain, computed: local });
        this.setState({ error: 'Incorrect group password.' });
        return;
      }

      this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint' });

      sbtLog.log('[MANUAL-MINT] Signing authorization...');
      const sig = await contractScripts.signGroupMintAuthorization({
        password,
        sbtAddress: sbt,
        userAddress: this.props.account,
        walletScopeSbtAddress,
      });
      sbtLog.log('[MANUAL-MINT] Signature:', sig);

      sbtLog.log('[MANUAL-MINT] Sending transaction...');
      const tx = await contractScripts.mintWithGroupSignature(this.props.provider, sbt, sig);
      sbtLog.log('[MANUAL-MINT] Tx hash:', tx.transactionHash);

      await this.loadSBTInfo(true);
      this.setState({
        mintingStatus: 'success',
        transactionHash: tx.transactionHash,
        lastTransactionType: 'mint',
        lastMintTxHash: tx.transactionHash
      });

      // Optimistic + parent refresh to ensure counters update everywhere
      const meLower = this.props.account.toLowerCase();
      this.applyLocalMintSuccess(meLower);
      this.refreshSbtDataWithSlug(sbt);

      // Cleanup auto-mint intent to prevent loop on refresh
      this.clearAutoMintUrlIntent();

      try {
        window.dispatchEvent(new CustomEvent('sbt-mint-success', { detail: { sbtAddress: sbt, txHash: tx.transactionHash } }));
      } catch (e) { sbtLog.warn('SBTPage: telemetry', e); }
    } catch (error) {
      sbtLog.error('Manual mint flow failed:', error);
      this.setState({ error: error?.message || `${t('mint')} failed.`, mintingStatus: 'failure' });
    }
  }

  fetchRelevantInfo = () => {
    if (this._isMounted) this.setState({
      relevantQuestions: [`What is the purpose of this ${t('sbt')}?`, `How can I use this ${t('sbt')}?`],
      relevantDocuments: [`${t('sbt')} Whitepaper`, 'Community Guidelines'],
    });
  };

  handleMint = async (forceEventRefreshOnSuccess = true) => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }

    const { SBTAddress: SBTAddressProp } = this.props;
    const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);

    if (!sbtAddressOriginalCase) return;

    const { sbtInfo, mintPassword, mintStep, manualPasswordInput } = this.state;

    try {
      if (sbtInfo.hasPasswordMint) {
        const effectivePassword = (mintPassword && mintPassword.trim() !== '' ? mintPassword : (manualPasswordInput || '').trim());
        if (effectivePassword === '') {
          if (this._isMounted) this.setState({ error: `Password is required for this ${t('sbt')}.`, mintingStatus: 'failure' });
          return;
        }

        if (mintStep === 0) {
          // PRD 137: Pre-validate password before spending gas on startClaim().
          // isPasswordValid() is a free view call — saves two wasted txs on bad passwords.
          const hashedPassword = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(effectivePassword));
          try {
            const isValid = await contractScripts.isPasswordValid(
              this.props.provider,
              sbtAddressOriginalCase,
              hashedPassword,
              this.getEffectiveSessionSlug()
            );
            if (!isValid) {
              if (this._isMounted) this.setState({ error: 'Invalid password.', mintingStatus: 'failure' });
              return;
            }
          } catch (preCheckErr) {
            // If the view call fails (e.g. network issue), proceed with the mint anyway —
            // the on-chain transaction will catch invalid passwords. Don't block the user.
            sbtLog.warn('[SBTPage] Password pre-validation call failed, proceeding with mint:', preCheckErr);
          }

          if (this._isMounted) this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint' });

          const userCommit = ethers.utils.solidityKeccak256(
            ["string", "address"],
            [effectivePassword, this.props.account]
          );

          const tx = await contractScripts.startClaim(this.props.provider, sbtAddressOriginalCase, userCommit);
          if (this._isMounted) this.setState({
            mintStep: 1,
            mintingStatus: 'idle',
            transactionHash: tx.transactionHash
          });
          this.startClaimCountdown();
          this.cacheTransactionHash(tx.transactionHash);
        } else if (mintStep === 2) {
          if (this._isMounted) this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint' });
          const tx = await contractScripts.claimWithPassword(this.props.provider, sbtAddressOriginalCase, effectivePassword);
          if (this._isMounted) this.setState({
            mintStep: 3,
            manualPasswordInput: '',
            mintingStatus: 'success',
            transactionHash: tx.transactionHash,
            lastTransactionType: 'mint',
            lastMintTxHash: tx.transactionHash
          });
          await this.loadSBTInfo(forceEventRefreshOnSuccess);
          this.cacheTransactionHash(tx.transactionHash);

          // Optimistic + parent refresh
          const meLower = this.props.account.toLowerCase();
          this.applyLocalMintSuccess(meLower);
          this.refreshSbtDataWithSlug(sbtAddressOriginalCase);

          // Cleanup auto-mint intent to prevent loop on refresh
          this.clearAutoMintUrlIntent();

          try {
            window.dispatchEvent(new CustomEvent('sbt-mint-success', {
              detail: { sbtAddress: sbtAddressOriginalCase, txHash: tx.transactionHash }
            }));
          } catch (e) { sbtLog.warn('SBTPage: telemetry', e); }
        }
      } else {
        if (this._isMounted) this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint' });
        const tx = await contractScripts.claim(this.props.provider, sbtAddressOriginalCase);
        if (this._isMounted) this.setState({
          mintingStatus: 'success',
          transactionHash: tx.transactionHash,
          lastTransactionType: 'mint',
          lastMintTxHash: tx.transactionHash
        });
        await this.loadSBTInfo(forceEventRefreshOnSuccess);
        this.cacheTransactionHash(tx.transactionHash);

        // Optimistic + parent refresh
        const meLower = this.props.account.toLowerCase();
        this.applyLocalMintSuccess(meLower);
        this.refreshSbtDataWithSlug(sbtAddressOriginalCase);

        // Cleanup auto-mint intent to prevent loop on refresh
        this.clearAutoMintUrlIntent();

        try {
          window.dispatchEvent(new CustomEvent('sbt-mint-success', {
            detail: { sbtAddress: sbtAddressOriginalCase, txHash: tx.transactionHash }
          }));
        } catch (e) { sbtLog.warn('SBTPage: telemetry', e); }
      }
    } catch (error) {
      sbtLog.error("Minting failed in handleMint:", error);
      if (this._isMounted) this.setState({ error: error.message || `${t('minting')} failed.`, mintingStatus: 'failure' });
    }
  };

  miniMintHandler = async () => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }
    await this.handleMint(true); // Pass true to force event refresh on success
  };

  miniBurnHandler = async () => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }
    try {
      if (this._isMounted) this.setState({ burningStatus: 'pending', lastTransactionType: 'burn' });

      const { SBTAddress: SBTAddressProp } = this.props;
      const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);

      if (!sbtAddressOriginalCase) return;

      const tokenIdToBurn = await contractScripts.getSBTTokenIdByOwner(this.props.provider, sbtAddressOriginalCase, this.props.account, this.getEffectiveSessionSlug());
      if (!tokenIdToBurn) {
        if (this._isMounted) this.setState({ error: "No valid token ID found", burningStatus: 'failure' });
        return;
      }

      const tx = await contractScripts.burnToken(this.props.provider, sbtAddressOriginalCase, tokenIdToBurn);
      await this.loadSBTInfo(true);
      if (this._isMounted) this.setState({
        burningStatus: 'success',
        transactionHash: tx.transactionHash,
        lastTransactionType: 'burn',
        lastBurnTxHash: tx.transactionHash
      });
      this.cacheTransactionHash(tx.transactionHash);

      // Optimistic + parent refresh
      this.applyLocalBurnSuccess(this.props.account.toLowerCase());
      this.refreshSbtDataWithSlug(sbtAddressOriginalCase);
    } catch (error) {
      sbtLog.error("Burn failed in miniBurnHandler:", error);
      if (this._isMounted) this.setState({ error: error.message, burningStatus: 'failure' });
    }
  };


  handleBurnSearchChange = (event) => {
    const input = event.target.value;

    if (this._isMounted) {
      this.setState({
        burnSearchInput: input,
        burnSearchResult: null,
        burnSearchType: null,
      });
    }

    // Clear any in-flight debounce
    if (this._burnSearchTimer) {
      clearTimeout(this._burnSearchTimer);
      this._burnSearchTimer = null;
    }

    if (!input) return;

    // Wait 300ms after the last keystroke before hitting RPC
    this._burnSearchTimer = setTimeout(() => {
      this._burnSearchTimer = null;
      this.performBurnSearch(this.state.burnSearchInput);
    }, 300);
  };

  // Extracted the actual RPC logic so it can be debounced
  performBurnSearch = async (rawInput) => {
    const input = (rawInput || '').trim();
    if (!input) return;

    const { SBTAddress: SBTAddressProp } = this.props;
    const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
      ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
      : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined
          ? SBTAddressProp.sbtAddress
          : SBTAddressProp);

    if (!sbtAddressOriginalCase) return;

    try {
      // Full address search
      if (input.startsWith('0x') && input.length === 42) {
        const tokenId = await contractScripts.getSBTTokenIdByOwner(
          this.props.provider,
          sbtAddressOriginalCase,
          input,
          this.getEffectiveSessionSlug()
        );
        if (tokenId && this._isMounted) {
          this.setState({
            burnSearchResult: { address: input, tokenId },
            burnSearchType: 'address',
          });
        }
      }
      // Numeric tokenId search
      else if (/^\d+$/.test(input)) {
        const address = await contractScripts.getOwnerByTokenId(
          this.props.provider,
          sbtAddressOriginalCase,
          input,
          this.getEffectiveSessionSlug()
        );
        if (address && this._isMounted) {
          this.setState({
            burnSearchResult: { address, tokenId: input },
            burnSearchType: 'tokenId',
          });
        }
      }
    } catch (error) {
      sbtLog.error("Error searching burn target:", error);
    }
  };


  handleBurn = async () => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }

    const { SBTAddress: SBTAddressProp } = this.props;
    const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);
    if (!sbtAddressOriginalCase) return;

    const { sbtInfo, burnSearchResult } = this.state;

    const userAddress = this.props.account.toLowerCase();
    const adminAddr = sbtInfo.admin || sbtInfo.admin_;
    const isAdminBurn = this.state.userIsSbtAdmin && (sbtInfo.burnAuth === 0 || sbtInfo.burnAuth === 2);
    const isOwnerBurn = this.state.userHasSBT &&
      (
        sbtInfo.burnAuth === 1 ||
        sbtInfo.burnAuth === 2 ||
        (sbtInfo.burnAuth === 0 && adminAddr && adminAddr.toLowerCase() === userAddress) ||
        (sbtInfo.burnAuth === 1 && this.state.userHasSBT)
      );

    let tokenIdToBurn;
    let burnedAddrLower = null;

    if (isAdminBurn && burnSearchResult && burnSearchResult.tokenId) {
      tokenIdToBurn = burnSearchResult.tokenId;
      burnedAddrLower = burnSearchResult.address ? burnSearchResult.address.toLowerCase() : null;
    } else if (isOwnerBurn) {
      tokenIdToBurn = await contractScripts.getSBTTokenIdByOwner(this.props.provider, sbtAddressOriginalCase, this.props.account, this.getEffectiveSessionSlug());
      burnedAddrLower = userAddress;
      if (!tokenIdToBurn) {
        if (this._isMounted) this.setState({ error: "No valid token ID found", burningStatus: 'failure' });
        return;
      }
    } else if (this.state.userIsSbtAdmin && (sbtInfo.burnAuth === 0 || sbtInfo.burnAuth === 2) && !burnSearchResult) {
      if (this._isMounted) this.setState({ error: "Admin burn requires specifying token ID or owner.", burningStatus: 'failure' });
      return;
    } else {
      if (this._isMounted) this.setState({ error: `You are not authorized to ${t('burnLower')} this ${t('sbt')}.`, burningStatus: 'failure' });
      return;
    }

    try {
      if (this._isMounted) this.setState({ burningStatus: 'pending', lastTransactionType: 'burn' });
      const tx = await contractScripts.burnToken(this.props.provider, sbtAddressOriginalCase, tokenIdToBurn);
      await this.loadSBTInfo(true);
      if (this._isMounted) this.setState({
        burningStatus: 'success',
        transactionHash: tx.transactionHash,
        burnSearchInput: '',
        burnSearchResult: null,
        burnSearchType: null,
        lastTransactionType: 'burn',
        lastBurnTxHash: tx.transactionHash
      });
      this.cacheTransactionHash(tx.transactionHash);

      // Optimistic + parent refresh
      if (burnedAddrLower) this.applyLocalBurnSuccess(burnedAddrLower);
      this.refreshSbtDataWithSlug(sbtAddressOriginalCase);
    } catch (error) {
      if (this._isMounted) this.setState({
        error: error.message,
        burningStatus: 'failure',
        burnSearchInput: '',
        burnSearchResult: null,
        burnSearchType: null
      });
    }
  };


  startClaimCountdown = () => {
    const confirmationBlocks = 5;
    const intervalMs = Math.max(1000, this.getActiveBlockTimeMs(1));
    const waitMs = this.getActiveBlockTimeMs(confirmationBlocks);
    const toDisplaySeconds = (remainingMs) => Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
    let remainingMs = waitMs;
    if (this._isMounted) this.setState({ claimCountdown: toDisplaySeconds(remainingMs) });
    const countdownInterval = setInterval(() => {
      if (!this._isMounted) {
        clearInterval(countdownInterval);
        return;
      }
      remainingMs = Math.max(0, remainingMs - intervalMs);
      if (this._isMounted) this.setState({ claimCountdown: toDisplaySeconds(remainingMs) });
      if (remainingMs === 0) {
        clearInterval(countdownInterval);
        if (this._isMounted) this.setState({ mintStep: 2, claimCountdown: toDisplaySeconds(waitMs) }); // CHANGED reset
      }
    }, intervalMs);
  };


  copyToClipboard = (text, addressType) => {
    navigator.clipboard.writeText(text).then(() => {
      notify.success('Copied to clipboard');
      if (this._isMounted) this.setState({ copiedAddress: addressType }, () => {
        setTimeout(() => { if (this._isMounted) this.setState({ copiedAddress: null }) }, 2500);
      });
    });
  };

  bookmarkSBT = () => {
    const { SBTAddress: SBTAddressProp } = this.props;
    const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);
    if (!sbtAddressOriginalCase) return;
    const sbtAddressLower = String(sbtAddressOriginalCase || '').toLowerCase();
    const bookmarksSlug = String(
      this.state?.resolvedSessionSlug ??
      this.props?.activeSessionSlug ??
      this.props?.activeSessionSlug ??
      this.props?.sessionSlug ??
      this.props?.sessionSlug ??
      ''
    );

    try {
      const existingManaged = peekCacheSync('bookmarksCache', bookmarksSlug, { clone: false });
      const baseManaged = (existingManaged && typeof existingManaged === 'object') ? existingManaged : {};
      const managedBookmarks = {
        ...baseManaged,
        sbts: Array.isArray(baseManaged.sbts) ? [...baseManaged.sbts] : [],
      };
      const alreadyManaged = managedBookmarks.sbts.some((entry) => String(entry || '').toLowerCase() === sbtAddressLower);
      if (!alreadyManaged) {
        managedBookmarks.sbts.push(sbtAddressLower);
        void writeCache('bookmarksCache', bookmarksSlug, managedBookmarks).catch((e) => { sbtLog.warn('SBTPage: fallback', e); });
      }
    } catch (e) { sbtLog.warn('SBTPage: fallback', e); }

    try {
      const bookmarks = this.readQueuedOrStoredLocalStorageJson('bookmarks', {});
      if (!bookmarks.sbts) bookmarks.sbts = [];
      if (!bookmarks.sbts.includes(sbtAddressOriginalCase)) {
        bookmarks.sbts.push(sbtAddressOriginalCase);
        this.queueLocalStorageJsonWrite('bookmarks', bookmarks);
        if (this._isMounted) this.setState({ bookmarked: true });
      }
    } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
    this.storeSBTDetails();
  };

  storeSBTDetails = () => {
    const { SBTAddress: SBTAddressProp } = this.props;
    const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);
    if (!sbtAddressOriginalCase) return;

    try {
      const sbtDetails = { ...this.state.sbtInfo, address: sbtAddressOriginalCase };
      this.queueLocalStorageJsonWrite('sbtDetails', sbtDetails);
    } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
  };

  getExplorerUrl = (address) => {
    const currentNetwork = this.state.network || this.props.network;
    return currentNetwork?.blockExplorers?.default?.url ? `${currentNetwork.blockExplorers.default.url}/address/${address}` : `https://sepolia.etherscan.io/address/${address}`;
  };

  getExplorerLink = (hash) => {
    const currentNetwork = this.state.network || this.props.network;
    return currentNetwork?.blockExplorers?.default?.url ? `${currentNetwork.blockExplorers.default.url}/tx/${hash}` : `https://sepolia.etherscan.io/tx/${hash}`;
  };

  handleGenerateAdminInvites = async () => {
    if (!this.state.passwordGenerationCount || this.state.passwordGenerationCount <= 0) return;

    const newPasswordList = this.generateRandomPasswords(this.state.passwordGenerationCount);

    const hashedPasswords = newPasswordList.map(password => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)));

    try {
      const { SBTAddress: SBTAddressProp } = this.props;
      const sbtAddressOriginalCase = Array.isArray(SBTAddressProp)
        ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
        : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);
      if (!sbtAddressOriginalCase) return;

      const tx = await contractScripts.addHashedPasswords(this.props.provider, sbtAddressOriginalCase, hashedPasswords);
      sbtLog.log("addHashedPasswords transaction hash:", tx.transactionHash);

      this.cacheTransactionHash(tx.transactionHash);

      let createdSBTs = this.readQueuedOrStoredLocalStorageJson('createdSBTs', {});
      const sbtAddrLower = sbtAddressOriginalCase.toLowerCase();
      if (!createdSBTs[sbtAddrLower]) {
        createdSBTs[sbtAddrLower] = { passwords: [] };
      }
      createdSBTs[sbtAddrLower].passwords = [...(createdSBTs[sbtAddrLower].passwords || []), ...newPasswordList];
      this.queueLocalStorageJsonWrite('createdSBTs', createdSBTs, { immediate: true });

      if (this._isMounted) this.setState({ adminGeneratedPasswords: newPasswordList, passwordGenerationCount: '' });
      this.loadCachedPasswords();
    } catch (error) {
      sbtLog.error("Error adding hashed passwords:", error);
      if (this._isMounted) this.setState({ error: error.message });
    }
  };


  generateRandomPasswords = (count) => {
    const generated = new Set();
    while (generated.size < count) {
      // 16 bytes => 32 hex chars (128-bit)
      let arr;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        arr = new Uint8Array(16);
        window.crypto.getRandomValues(arr);
      } else {
        arr = ethers.utils.randomBytes(16);
      }
      const token = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      generated.add(token);
    }
    return Array.from(generated);
  };

  exportPasswords = () => {
    const { exportFormat, includePreviousPasswords, cachedPasswords, adminGeneratedPasswords } = this.state;
    const { SBTAddress: SBTAddressProp } = this.props;
    const isInvite = !!this.state.hasInviteMint;
    const codeLabel = isInvite ? 'groupPassword' : 'password';
    const fileLabel = isInvite ? 'group-passwords' : 'passwords';

    let sbtAddr = Array.isArray(SBTAddressProp)
      ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
      : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);

    if (typeof sbtAddr === 'string') {
      sbtAddr = sbtAddr.toLowerCase();
    } else {
        sbtLog.error("SBT Address for export is undefined.");
        return;
    }

    const combinedPasswords = [...(cachedPasswords || []), ...(adminGeneratedPasswords || [])];
    const onlyCachedPasswords = (adminGeneratedPasswords.length === 0 && combinedPasswords.length > 0);
    const effectiveIncludePreviousPasswords = onlyCachedPasswords ? true : includePreviousPasswords;
    let passwordsToExport;
    if (adminGeneratedPasswords.length > 0) {
      passwordsToExport = effectiveIncludePreviousPasswords ? combinedPasswords : adminGeneratedPasswords;
    } else {
      passwordsToExport = combinedPasswords;
    }

    const baseUrl = window.location.origin;
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug());
    const encodeGroupPassword = (code) => {
      const normalized = cryptoUtils.normalizeGroupPasswordInput(code);
      return cryptoUtils.encodeGroupPasswordForUrl(normalized) || '';
    };
    const inviteLinks = passwordsToExport.map((code) => ({
      [codeLabel]: code,
      inviteLink: isInvite
        ? `${baseUrl}${demoPath}?auto=1&sbt=${encodeURIComponent(sbtAddr)}&gp=${encodeURIComponent(encodeGroupPassword(code))}`
        : `${baseUrl}${sbtBasePath()}/${sbtAddr}/${code}`
    }));

    const date = new Date().toISOString().slice(0, 10);
    const sbtSymbolOrName = getSbtDisplayName(this.state.sbtInfo) || t('sbt');

    let content;
    let fileName;
    if (exportFormat === 'json') {
      content = JSON.stringify(inviteLinks, null, 2);
      fileName = `${sbtSymbolOrName}_${fileLabel}_${date}.json`;
    } else if (exportFormat === 'csv') {
      content = `index,${codeLabel},inviteLink\n` +
        inviteLinks.map((item, index) => `${index},${item[codeLabel]},${item.inviteLink}`).join('\n');
      fileName = `${sbtSymbolOrName}_${fileLabel}_${date}.csv`;
    } else {
        return;
    }

    const blob = new Blob([content], { type: exportFormat === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

renderMintButton() {
  const { sbtInfo, mintStep, claimCountdown, mintingStatus, userHasSBT, burningStatus, manualPasswordInput, lastMintTxHash } = this.state;
  if (userHasSBT && burningStatus !== 'success') return null;
  if (!sbtInfo) return null;

  const now = Math.floor(Date.now() / 1000);
  if (sbtInfo.mintingEndTime !== 0 && sbtInfo.mintingEndTime < now) return null;

  // Unlimited (signature) path - hide inputs after success
  if (this.state.hasGroupPasswordMint) {
    if (mintingStatus === 'success') return null;
    return (
      <div id={styles.mintButtonArea}>
        <div className={styles.passwordEntry}>
          <input
            type="password"
            className={styles.input}
            value={this.state.groupPasswordInput || ''}
            onChange={this.handleGroupPasswordInputChange}
            placeholder="Group Password"
          />
        </div>
        <button
          onClick={() => this.mintUnlimitedWithGroupPassword()}
          disabled={mintingStatus === 'pending' || !((this.state.groupPasswordInput || '').trim())}
          className={`${styles.actionButton} ${styles.mintButton}`}
        >
          {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Join'}
        </button>
      </div>
    );
  }

  // Limited group-password - hide inputs after success
  if (this.state.hasInviteMint) {
    if (mintingStatus === 'success') return null;
    return (
      <div id={styles.mintButtonArea}>
        <div className={styles.passwordEntry}>
          <input
            type="password"
            className={styles.input}
            value={this.state.groupPasswordInput || ''}
            onChange={this.handleGroupPasswordInputChange}
            placeholder="Group Password"
          />
        </div>
        <button
          onClick={() => this.claimWithInviteCode(this.state.groupPasswordInput)}
          disabled={mintingStatus === 'pending' || !((this.state.groupPasswordInput || '').trim())}
          className={`${styles.actionButton} ${styles.mintButton}`}
        >
          {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Join'}
        </button>
      </div>
    );
  }

  // Legacy per-claim-code flow
  if (!sbtInfo.hasPasswordMint) {
    const isMinted = mintingStatus === 'success' && burningStatus !== 'success';
    const canOpenMintTx = !!(isMinted && lastMintTxHash);
    return (
      <div>
        <button
          onClick={() => {
            if (canOpenMintTx) {
              window.open(this.getExplorerLink(lastMintTxHash), '_blank', 'noopener,noreferrer');
              return;
            }
            this.handleMint(true);
          }}
          disabled={mintingStatus === 'pending' || (isMinted && !canOpenMintTx)}
          className={`${styles.actionButton} ${styles.mintButton}`}
          title={canOpenMintTx ? `View ${t('mintLower')} transaction` : undefined}
        >
          {mintingStatus === 'idle' && 'Join'}
          {mintingStatus === 'pending' && <FontAwesomeIcon icon={faSpinner} spin />}
          {isMinted && <>{t('minted')} <FontAwesomeIcon icon={faCheck} /></>}
          {mintingStatus === 'failure' && <>Failed <FontAwesomeIcon icon={faTimes} /></>}
        </button>
      </div>
    );
  }

  switch (mintStep) {
    case 0:
      return (
        <div id={styles.mintButtonArea}>
          <div className={styles.passwordEntry}>
            <input
              type="text"
              className={styles.input}
              value={manualPasswordInput || ''}
              onChange={(e) => this.setState({ manualPasswordInput: e.target.value })}
              placeholder="Claim Code"
            />
          </div>
          <button
            onClick={() => this.handleMint(true)}
            disabled={(mintingStatus === 'pending') || ((manualPasswordInput || '').trim() === '')}
            className={`${styles.actionButton} ${styles.mintButton}`}
          >
            {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Start Claim'}
          </button>
        </div>
      );
    case 1:
      return (
        <div className={styles.mintProcess}>
          <p className={styles.claimCountdown}>Waiting period: {claimCountdown} seconds</p>
        </div>
      );
    case 2:
      return (
        <div id={styles.mintButtonArea}>
          <div className={styles.passwordEntry}>
            <input
              type="text"
              className={styles.input}
              value={manualPasswordInput || ''}
              onChange={(e) => this.setState({ manualPasswordInput: e.target.value })}
              placeholder="Claim Code"
            />
          </div>
          <button
            onClick={() => this.handleMint(true)}
            disabled={(mintingStatus === 'pending') || ((manualPasswordInput || '').trim() === '')}
            className={`${styles.actionButton} ${styles.mintButton}`}
          >
            {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Finish Claim'}
          </button>
        </div>
      );
    case 3:
      return <div className={styles.mintProcess}><p className={styles.mintSuccess}>{`${t('sbt')} successfully ${t('mintedLower')}!`}</p></div>;
    default:
      return null;
  }
}




  renderBurnButton = () => {
    const { sbtInfo, userHasSBT, burningStatus } = this.state;
    if (!sbtInfo) return null;

    const userAddressLower = this.props.account ? this.props.account.toLowerCase() : null;
    const adminAddr = sbtInfo.admin || sbtInfo.admin_;
    const canOwnerBurn = userHasSBT && (
      sbtInfo.burnAuth === 1 || // OwnerOnly
      sbtInfo.burnAuth === 2 || // Both
      (sbtInfo.burnAuth === 0 && adminAddr && adminAddr.toLowerCase() === userAddressLower) ||
      (sbtInfo.burnAuth === 1 && userHasSBT)
    );

    if (!userHasSBT || !canOwnerBurn) {
      return null;
    }

    return (
      <div>
        <button
          onClick={this.handleBurn}
          disabled={burningStatus !== 'idle' && burningStatus !== 'success' && burningStatus !== 'failure'}
          className={`${styles.actionButton} ${styles.burnButton}`}
        >
          {burningStatus === 'idle' && t('burn')}
          {burningStatus === 'pending' && <FontAwesomeIcon icon={faSpinner} spin />}
          {burningStatus === 'success' && <>{t('burned')} <FontAwesomeIcon icon={faCheck} /></>}
          {burningStatus === 'failure' && <>Failed <FontAwesomeIcon icon={faTimes} /></>}
        </button>
      </div>
    );
  };

  renderRelevantInfo = () => {
    const { sbtInfo } = this.state;
    const documentURLs = sbtInfo && sbtInfo.documentURLs ? sbtInfo.documentURLs : [];
    const tags = sbtInfo && sbtInfo.tags ? sbtInfo.tags : [];
    const documentIDHashes = sbtInfo && sbtInfo.documentIDHashes ? sbtInfo.documentIDHashes : [];

    return (
      <div className={styles.relevantInfo}>
        <Alert color="info">
          <FontAwesomeIcon icon={faInfoCircle} style={{opacity:0.5}}/>
          This section shows relevant documents, URLs, tags, and IDs.
        </Alert>
        {documentURLs.length > 0 && (
          <div className={styles.docUrlsSection}>
            <h4>Document URLs:</h4>
            <ul className={styles.docUrlList}>
              {documentURLs.map((url, index) => {
                const litDoc = litStorage.isLitArweaveUrl(url);
                return (
                  <li key={index} className={styles.docUrlItem}>
                    <span className={styles.docUrlBadge}>
                      {litDoc ? 'Encrypted Doc' : 'Doc URL'}
                    </span>
                    {litDoc ? (
                      <button
                        type="button"
                        className={styles.docUrlButton}
                        onClick={() => this.openEncryptedDoc(url)}
                      >
                        Decrypt and view
                      </button>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {url}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {documentIDHashes.length > 0 && (
          <div className={styles.docIDsSection}>
            <h4>Document ID Hashes:</h4>
            <ul className={styles.docIdList}>
              {documentIDHashes.map((hash, index) => {
                const docHash = encodeURIComponent(hash);
                return (
                  <li key={index} className={styles.docIdItem}>
                    <span className={styles.docIdBadge}>Doc ID</span>
                    <a href={`${window.location.origin}/doc/${docHash}`} target="_blank" rel="noopener noreferrer">
                      {hash}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {tags.length > 0 && (
          <div className={styles.tagsSection}>
            <h4>Tags:</h4>
            <ul className={styles.tagList}>
              {tags.map((tag, index) => {
                const tagEnc = encodeURIComponent(tag);
                return (
                  <li key={index} className={styles.tagItem}>
                    <span className={styles.tagBadge}>Tag</span>
                    <a href={`${window.location.origin}/tag/${tagEnc}`} target="_blank" rel="noopener noreferrer">
                      {tag}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };


  cacheTransactionHash = (txHash) => {
    const userAddress = this.props.account?.toLowerCase();
    if (!userAddress) return;
    try {
      let txCache = this.readQueuedOrStoredLocalStorageJson('transactions', {});
      if (!txCache[userAddress]) txCache[userAddress] = [];
      txCache[userAddress].push(txHash);
      this.queueLocalStorageJsonWrite('transactions', txCache);
    } catch (e) { sbtLog.warn('SBTPage: fallback', e); }
  };

  handleExportFormatChange = (event) => {
    if (this._isMounted) this.setState({ exportFormat: event.target.value });
  };

  handleIncludePreviousPasswordsChange = (event) => {
    if (this._isMounted) this.setState({ includePreviousPasswords: event.target.checked });
  };

  renderAdminActions = () => {
    const { userIsSbtAdmin, sbtInfo, burnSearchInput, burnSearchResult, burningStatus, adminGeneratedPasswords, cachedPasswords, includePreviousPasswords, exportFormat } = this.state;
    if (!userIsSbtAdmin || !sbtInfo) return null;

    const isInvite = !!this.state.hasInviteMint;
    const adminAddr = sbtInfo.admin || sbtInfo.admin_;
    const canAdminBurn = (sbtInfo.burnAuth === 0 || sbtInfo.burnAuth === 2) && adminAddr?.toLowerCase() === this.props.account?.toLowerCase();
    const showPasswordGen = (sbtInfo.hasPasswordMint && sbtInfo.maxTokens === "0");
    const showNoMoreInvites = (sbtInfo.hasPasswordMint && sbtInfo.maxTokens !== "0");

    const combinedPasswords = [...(cachedPasswords || []), ...(adminGeneratedPasswords || [])];

    const { SBTAddress: SBTAddressProp } = this.props;
    let sbtAddr = Array.isArray(SBTAddressProp)
      ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
      : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);

    if (typeof sbtAddr === 'string') {
      sbtAddr = sbtAddr.toLowerCase();
    } else {
        sbtAddr = "unknown_sbt";
    }

    const baseUrl = window.location.origin;
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug());
    const encodeGroupPassword = (code) => {
      const normalized = cryptoUtils.normalizeGroupPasswordInput(code);
      return cryptoUtils.encodeGroupPasswordForUrl(normalized) || '';
    };
    const buildInviteLink = (code) => (
      isInvite
        ? `${baseUrl}${demoPath}?auto=1&sbt=${encodeURIComponent(sbtAddr)}&gp=${encodeURIComponent(encodeGroupPassword(code))}`
        : `${baseUrl}${sbtBasePath()}/${sbtAddr}/${code}`
    );
    const openMintAutoJoinUrl = this.getOpenMintAutoJoinUrl(sbtAddr);
    const justGeneratedPasswords = adminGeneratedPasswords.length > 0;
    const onlyCachedPasswords = (adminGeneratedPasswords.length === 0 && combinedPasswords.length > 0);
    const renderIncludePreviousCheckbox = justGeneratedPasswords;
    const effectiveIncludePreviousPasswords = onlyCachedPasswords ? true : includePreviousPasswords;

    return (
      <div className={styles.adminActions}>
        {openMintAutoJoinUrl && (
          <div className={styles.autoMintUrlCard} data-testid={E2E_TESTIDS.SBT_PAGE_OPEN_MINT_URL}>
            <h4>URL Where Anyone Can Join</h4>
            <p className={styles.autoMintUrlHelp}>
              Share this session link to trigger the open-mint flow for this group.
            </p>
            <div className={styles.autoMintUrlRow}>
              <span className={styles.autoMintUrlText} title={openMintAutoJoinUrl}>
                {openMintAutoJoinUrl}
              </span>
              <button
                type="button"
                className={styles.autoMintUrlButton}
                onClick={() => this.copyToClipboard(openMintAutoJoinUrl, 'open-mint-url')}
                aria-label="Copy open mint URL"
                title="Copy open mint URL"
              >
                <FontAwesomeIcon icon={this.state.copiedAddress === 'open-mint-url' ? faCheck : faCopy} />
              </button>
              <a
                href={openMintAutoJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.autoMintUrlButton}
                aria-label="Open open mint URL"
                title="Open open mint URL"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            </div>
          </div>
        )}
        {canAdminBurn && (
          <div className={styles.adminBurnSection}>
            <h4>{`${t('burn')} ${t('sbt')}`}</h4>
            <div className={styles.burnInputGroup}>
              <input
                type="text"
                value={burnSearchInput}
                onChange={this.handleBurnSearchChange}
                placeholder="Enter Address (0x...) or Token ID"
                className={styles.input}
              />
              {burnSearchResult && (
                <div className={styles.burnSearchResult}>
                  {burnSearchResult.tokenId && (
                    <p>Token ID: {burnSearchResult.tokenId}</p>
                  )}
                  {burnSearchResult.address && (
                    <p>Owner: {getShortenedAddress(burnSearchResult.address, false)}</p>
                  )}
                </div>
              )}
              <button
                onClick={async () => {
                  if (!burnSearchResult) {
                    if (this._isMounted) this.setState({ error: "No token selected to burn" });
                    return;
                  }
                  if (this._isMounted) this.setState({ burningStatus: 'pending', lastTransactionType: 'burn' });
                  // Ensure sbtAddr (original case) is used for contract interaction
                  const sbtAddressOriginalCaseForAdminBurn = Array.isArray(SBTAddressProp)
                    ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
                    : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);

                  if (!sbtAddressOriginalCaseForAdminBurn) {
                    if (this._isMounted) this.setState({ error: `${t('sbt')} address not found for admin ${t('burnLower')}.`, burningStatus: 'failure' });
                    return;
                  }

                  const tx = await contractScripts.burnToken(this.props.provider, sbtAddressOriginalCaseForAdminBurn, burnSearchResult.tokenId);
                  await this.loadSBTInfo(true); // Force event fetch after admin burn
                  if (this._isMounted) this.setState({
                    burningStatus: 'success',
                    transactionHash: tx.transactionHash,
                    burnSearchInput: '',
                    burnSearchResult: null,
                    burnSearchType: null,
                    lastTransactionType: 'burn',
                    lastBurnTxHash: tx.transactionHash
                  });
                  this.cacheTransactionHash(tx.transactionHash);
                }}
                className={styles.actionButton}
                disabled={(burningStatus !== 'idle' && burningStatus !== 'success' && burningStatus !== 'failure') || !burnSearchResult}
              >
                {burningStatus === 'idle' && `${t('burn')} ${t('sbt')}`}
                {burningStatus === 'pending' && <FontAwesomeIcon icon={faSpinner} spin />}
                {burningStatus === 'success' && <>{t('burned')} <FontAwesomeIcon icon={faCheck} /></>}
                {burningStatus === 'failure' && <>Failed <FontAwesomeIcon icon={faTimes} /></>}
              </button>
            </div>
          </div>
        )}

        {showPasswordGen && (
          <div className={styles.inviteGenerationSection}>
            <h4>Generate Additional Password Invites</h4>
            <p>Since there's no max token limit, you can generate more password-based invites as admin.</p>
            <div className={styles.inviteGenerationControls}>
              <input
                type="number"
                value={this.state.passwordGenerationCount || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (this._isMounted) this.setState({ passwordGenerationCount: isNaN(val) ? '' : val });
                }}
                placeholder="Number of additional passwords"
                className={styles.input}
              />
              <button
                onClick={this.handleGenerateAdminInvites}
                className={styles.actionButton}
                disabled={!this.state.passwordGenerationCount || this.state.passwordGenerationCount <= 0}
              >
                Generate Invites
              </button>
            </div>
            {(combinedPasswords && combinedPasswords.length > 0) ? (
              <div className={styles.generatedPasswordsList}>
                <h5>Generated Passwords (including cached):</h5>
                <ul>
                  {combinedPasswords.map((pw, idx) => (
                    <li key={idx}>
                      {pw} - <a href={buildInviteLink(pw)} target="_blank" rel="noopener noreferrer">{buildInviteLink(pw)}</a>
                    </li>
                  ))}
                </ul>
                <p>These passwords are now stored in localStorage and/or newly generated.</p>
                <div className={styles.exportOptions}>
                  {renderIncludePreviousCheckbox && (
                    <label>
                      <input
                        type="checkbox"
                        checked={effectiveIncludePreviousPasswords}
                        onChange={this.handleIncludePreviousPasswordsChange}
                      />
                      Include previous passwords
                    </label>
                  )}
                  {!renderIncludePreviousCheckbox && onlyCachedPasswords && (
                    <p style={{fontStyle:'italic'}}>All previously cached passwords are included.</p>
                  )}
                  <select value={exportFormat} onChange={this.handleExportFormatChange} className={styles.exportFormatSelect}>
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                  <button onClick={this.exportPasswords} className={styles.exportButton}>Export Passwords</button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {showNoMoreInvites && combinedPasswords.length > 0 && (
          <div className={styles.inviteGenerationSection}>
            <h4>Previously Generated Password Invites</h4>
            <p>{`These were previously cached or generated passwords from when the ${t('sbt')} was created:`}</p>
            <ul>
              {combinedPasswords.map((pw, idx) => (
                <li key={idx}>
                  {pw} - <a href={buildInviteLink(pw)} target="_blank" rel="noopener noreferrer">{buildInviteLink(pw)}</a>
                </li>
              ))}
            </ul>
            <div className={styles.exportOptions}>
              {adminGeneratedPasswords.length > 0 && (
                <label>
                  <input
                    type="checkbox"
                    checked={effectiveIncludePreviousPasswords}
                    onChange={this.handleIncludePreviousPasswordsChange}
                  />
                  Include previous passwords
                </label>
              )}
              {adminGeneratedPasswords.length === 0 && combinedPasswords.length > 0 && (
                <p style={{fontStyle:'italic'}}>All previously cached passwords are included.</p>
              )}
              <select value={exportFormat} onChange={this.handleExportFormatChange} className={styles.exportFormatSelect}>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <button onClick={this.exportPasswords} className={styles.exportButton}>Export Passwords</button>
            </div>
          </div>
        )}

        {showNoMoreInvites && combinedPasswords.length === 0 && (
          <div className={styles.inviteGenerationSection}>
            <h4>No Additional Password Invites</h4>
            <p>Max tokens are set, so all invites should have been created initially. No more invites can be generated, and there are no cached passwords found.</p>
          </div>
        )}
      </div>
    );
  };

  copyErrorToClipboard = () => {
    const raw = (typeof this.state.error === 'string' && this.state.error)
      ? this.state.error
      : (this.state.error && this.state.error.message ? this.state.error.message : '');
    if (!raw) return;
    try {
      navigator.clipboard.writeText(raw).then(() => {
        notify.success('Copied to clipboard');
        if (this._isMounted) {
          this.setState({ copiedError: true }, () => {
            setTimeout(() => { if (this._isMounted) this.setState({ copiedError: false }); }, 2000);
          });
        }
      });
    } catch (e) { void e; notify.warn('Copy failed'); }
  };


  render() {
    const { SBTAddress: SBTAddressProp, miniaturized, miniMintable } = this.props;
    const {
      sbtInfo,
      userHasSBT,
      userIsSbtAdmin,
      mintCountdown,
      error,
      bookmarked,
      showModal,
      mintedAddresses,
      burnedAddresses,
      countsLoaded,
      showStats,
      showActions,
      showMoreDetails,
      showAdminSection,
      showDocsSection,
      loadingMintersBurners,
      mintingStatus,
      burningStatus,
      showPasswordAlert,
      transactionHash,
      lastMintTxHash,
      lastBurnTxHash,
      mintStep,
      mintPassword,
      manualPasswordInput,
      claimCountdown,
      docModalOpen,
      docModalLoading,
      docModalError,
      docModalContent,
      docModalName,
      docModalBlobUrl,
    } = this.state;

    const sbtAddressForDisplay = Array.isArray(SBTAddressProp)
      ? SBTAddressProp.find(entry => entry.sbtAddress !== undefined)?.sbtAddress
      : (SBTAddressProp && SBTAddressProp.sbtAddress !== undefined ? SBTAddressProp.sbtAddress : SBTAddressProp);
    const sbtNameText = getSbtDisplayName(sbtInfo) || `Unnamed ${t('sbt')}`;
    const sbtDescriptionText = getSbtDescriptionText(sbtInfo);
    const displayImageState = sbtInfo ? this.getDisplayImageRenderState(sbtInfo) : null;
    const imageUrl = displayImageState?.src || defaultSbtImage;
    const imageErrorHandler = displayImageState?.canRetry
      ? () => this.handleDisplayImageError(displayImageState)
      : undefined;

    // Miniaturized card view
    if (miniaturized) {
      if (!sbtInfo) {
        return <div className={styles.loading}><FontAwesomeIcon icon={faSpinner} spin /> Loading...</div>;
      }
      if (!sbtAddressForDisplay) {
        return null;
      }
      if (error && !sbtInfo) {
        return <div className={styles.error}>Error: {error}</div>;
      }

      const sbtName = sbtNameText;
      const showMiniSbtAddress = isCryptoMode();
      const now = Math.floor(Date.now() / 1000);
      const isMintingActive = (sbtInfo.mintingEndTime === 0 || sbtInfo.mintingEndTime > now);
      const mintStatusId = `mintStatus-${(sbtAddressForDisplay || '').toLowerCase()}`;

      const justJoined = (mintingStatus === 'success' && burningStatus !== 'success');
      const hasTokenMini = userHasSBT || justJoined;

      let miniMintArea = null;

      if (!hasTokenMini) {
        if (!isMintingActive) {
          miniMintArea = null;
        } else if (miniMintable) {
          if (this.state.hasGroupPasswordMint) {
            if (!this.state.showMiniPasswordInput) {
              miniMintArea = (
                <button
                  onClick={() => this.setState({ showMiniPasswordInput: true })}
                  className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                  style={{ marginTop: '10px' }}
                >
                  Join
                </button>
              );
            } else {
              miniMintArea = (
                <div className={styles.miniMintPasswordArea} style={{ marginTop: '10px' }}>
                  <input
                    type="password"
                    className={styles.miniPasswordInput}
                    value={this.state.groupPasswordInput || ''}
                    onChange={this.handleGroupPasswordInputChange}
                    placeholder="Password"
                    disabled={mintingStatus === 'pending'}
                    style={{ maxWidth: '100px' }}
                  />
                  <button
                    onClick={() => this.mintUnlimitedWithGroupPassword()}
                    disabled={mintingStatus === 'pending' || !((this.state.groupPasswordInput || '').trim())}
                    className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                  >
                    {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Join'}
                  </button>
                </div>
              );
            }
          }
          else if (this.state.hasInviteMint) {
            if (!this.state.showMiniPasswordInput) {
              miniMintArea = (
                <button
                  onClick={() => this.setState({ showMiniPasswordInput: true })}
                  className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                  style={{ marginTop: '10px' }}
                >
                  Join
                </button>
              );
            } else {
              miniMintArea = (
                <div className={styles.miniMintPasswordArea} style={{ marginTop: '10px' }}>
                  <input
                    type="password"
                    className={styles.miniPasswordInput}
                    value={this.state.groupPasswordInput || ''}
                    onChange={this.handleGroupPasswordInputChange}
                    placeholder="Invite Code"
                    disabled={mintingStatus === 'pending'}
                    style={{ maxWidth: '140px' }}
                  />
                  <button
                    onClick={() => this.claimWithInviteCode(this.state.groupPasswordInput)}
                    disabled={mintingStatus === 'pending' || !((this.state.groupPasswordInput || '').trim())}
                    className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                  >
                    {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Join'}
                  </button>
                </div>
              );
            }
          }
          else if (sbtInfo.hasPasswordMint) {
            if (mintStep === 0 && !this.state.showMiniPasswordInput) {
              miniMintArea = (
                <button
                  onClick={() => this.setState({ showMiniPasswordInput: true })}
                  className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                  style={{ marginTop: '10px' }}
                >
                  Join
                </button>
              );
            } else if (mintStep === 0) {
              miniMintArea = (
                <div className={styles.miniMintPasswordArea} style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    className={styles.miniPasswordInput}
                    value={manualPasswordInput}
                    onChange={(e) => this.setState({ manualPasswordInput: e.target.value })}
                    placeholder="Password"
                    disabled={mintingStatus === 'pending'}
                    style={{ maxWidth: '100px' }}
                  />
                  <button
                    onClick={this.miniMintHandler}
                    disabled={mintingStatus === 'pending' || (manualPasswordInput || '').trim() === ""}
                    className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                  >
                    {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Join'}
                  </button>
                </div>
              );
            } else if (mintStep === 1) {
              miniMintArea = (
                <div className={styles.miniActionStatus} style={{ marginTop: '10px' }}>
                  Wait: {claimCountdown}s
                </div>
              );
            } else if (mintStep === 2) {
              miniMintArea = (
                <div className={styles.miniMintPasswordArea} style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    className={styles.miniPasswordInput}
                    value={manualPasswordInput}
                    onChange={(e) => this.setState({ manualPasswordInput: e.target.value })}
                    placeholder="Password"
                    disabled={mintingStatus === 'pending'}
                  />
                  <button
                    onClick={this.miniMintHandler}
                    disabled={mintingStatus === 'pending' || (manualPasswordInput || '').trim() === ""}
                    className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                  >
                    {mintingStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Finish'}
                  </button>
                </div>
              );
            } else if (mintStep >= 3) {
              miniMintArea = <div className={styles.miniActionStatus} style={{ marginTop: '10px' }}>{`${t('minted')}!`}</div>;
            }
          }
          else {
            miniMintArea = (
              <button
                onClick={this.miniMintHandler}
                className={`${styles.actionButton} ${styles.mintButton} ${styles.miniButton}`}
                style={{ marginTop: '10px' }}
                disabled={mintingStatus === 'pending'}
              >
                {mintingStatus === 'idle' && 'Join'}
                {mintingStatus === 'pending' && <FontAwesomeIcon icon={faSpinner} spin />}
                {mintingStatus === 'failure' && <>Failed <FontAwesomeIcon icon={faTimes} /></>}
                {mintingStatus === 'success' && <>{t('minted')} <FontAwesomeIcon icon={faCheck} /></>}
              </button>
            );
          }
        }
      } else {
        const userAddressLower = this.props.account ? this.props.account.toLowerCase() : null;
        const adminAddr = sbtInfo.admin || sbtInfo.admin_;
        const canOwnerBurn =
          (sbtInfo.burnAuth === 1) ||
          (sbtInfo.burnAuth === 2) ||
          (sbtInfo.burnAuth === 0 && adminAddr && adminAddr.toLowerCase() === userAddressLower);
        const canAdminBurn = userIsSbtAdmin && (sbtInfo.burnAuth === 0 || sbtInfo.burnAuth === 2);
        const canBurnMini = canOwnerBurn || canAdminBurn;

        if (burningStatus === 'success') {
          miniMintArea = <div className={styles.miniActionStatus} style={{ marginTop: '10px' }}>{`${t('burned')}!`}</div>;
        } else if (canBurnMini) {
          miniMintArea = (
            <button
              onClick={this.miniBurnHandler}
              className={`${styles.actionButton} ${styles.burnButton} ${styles.miniButton}`}
              style={{ marginTop: '10px' }}
              disabled={burningStatus === 'pending'}
            >
              {burningStatus === 'pending' ? <FontAwesomeIcon icon={faSpinner} spin /> : t('burn')}
            </button>
          );
        } else {
          miniMintArea = <div className={styles.miniActionStatus} style={{ marginTop: '10px' }}>Joined!</div>;
        }
      }

      if (mintingStatus === 'failure' && !hasTokenMini) {
        miniMintArea = <div className={styles.miniActionStatus} style={{ marginTop: '10px', color: 'red' }}>{`${t('mint')} Failed`}</div>;
      }
      if (burningStatus === 'failure' && hasTokenMini) {
        miniMintArea = <div className={styles.miniActionStatus} style={{ marginTop: '10px', color: 'red' }}>{`${t('burn')} Failed`}</div>;
      }

      return (
        <div
          className={styles.sbtItem}
          style={{ cursor: 'pointer' }}
          role='button'
          tabIndex={0}
          onClick={(event) => {
            const interactiveAncestor = event.target?.closest?.('button, a, input, [role="button"]');
            if (interactiveAncestor && interactiveAncestor !== event.currentTarget) return;
            event.preventDefault();
            event.stopPropagation();
            window.open(`${window.location.origin}${this.getSbtDetailPath(sbtAddressForDisplay)}`, '_blank', 'noopener,noreferrer');
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const interactiveAncestor = event.target?.closest?.('button, a, input, [role="button"]');
            if (interactiveAncestor && interactiveAncestor !== event.currentTarget) return;
            event.preventDefault();
            window.open(`${window.location.origin}${this.getSbtDetailPath(sbtAddressForDisplay)}`, '_blank', 'noopener,noreferrer');
          }}
        >
          <div className={styles.iconOverlay}>
            {isMintingActive
              ? <div className={styles.liveIndicator} id={mintStatusId} aria-label={`${t('minting')} Live`}></div>
              : <div className={styles.endedIndicator} id={mintStatusId} aria-label={`${t('minting')} Ended`}></div>
            }
            <CETooltip
              placement="top"
              target={mintStatusId}
              trigger="hover focus click"
              className={styles.tooltipBubble}
              innerClassName={styles.tooltipInner}
            >
              {isMintingActive ? `${t('minting')} Live` : `${t('minting')} Ended`}
            </CETooltip>
            {(sbtInfo.hasPasswordMint || this.state.hasGroupPasswordMint) && (
              <FontAwesomeIcon icon={faLock} className={styles.lockIcon} />
            )}
          </div>
          <div
            className={styles.miniImageContainer}
            data-featured-card-ignore-nav="true"
          >
            <img
              src={imageUrl}
              alt={sbtName}
              className={styles.sbtImage}
              data-testid={E2E_TESTIDS.SBT_PAGE_IMAGE}
              onError={imageErrorHandler}
            />
          </div>
          <p id={styles.miniSbtName}>{sbtName}</p>
          {showMiniSbtAddress ? (
            <p id={styles.miniSbtAddress}>{getShortenedAddress(sbtAddressForDisplay, false)}</p>
          ) : null}
          {miniMintArea}
        </div>
      );
    }

    // Full page view
    if (!sbtAddressForDisplay) {
      return null;
    }
    if (error && !sbtInfo) {
      return <div className={styles.error}>Error: {error}</div>;
    }
    const loadingScreen = (
      <div className={styles.loadingPage}>
        <img
          src={contextEngineLoadingGif}
          alt="Context Engine loading"
          className={styles.loadingLogo}
        />
        <div className={styles.loadingTitle}>{`Loading ${t('sbt')} Details`}</div>
      </div>
    );
    if (!sbtInfo && !error) {
      return loadingScreen;
    }

    let mintEndDisplay;
    let fullMintEndDate = '';
    if (sbtInfo && sbtInfo.mintingEndTime) {
      const endTime = sbtInfo.mintingEndTime * 1000;
      fullMintEndDate = new Date(endTime).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
      });
      const unixTS = sbtInfo.mintingEndTime;

      if (endTime > Date.now()) {
        mintEndDisplay = (
          <p>
            <span className={styles.label}>{`${t('minting')} ends:`}</span>
            <span>{mintCountdown || "Calculating..."}</span>
          </p>
        );
      } else {
        mintEndDisplay = (
          <p>
            <span className={styles.label}>{`${t('minting')} Expired`}</span>:
            <span
              className={styles.expiredTime}
              id="mintExpiredTooltip"
              style={{ cursor: 'pointer' }}
              onClick={() => this.copyToClipboard(unixTS.toString(), 'time')}
            >
              {fullMintEndDate}
            </span>
            <FontAwesomeIcon
              icon={faQuestionCircle}
              style={{ marginLeft: '5px', color: '#00ff9d', cursor: 'pointer', opacity: 0.5 }}
              id="expiredTimeQuestionMark"
            />
            <CETooltip
              placement="right"
              target="expiredTimeQuestionMark"
              delay={{ show: 0, hide: 2500 }}
              className={styles.tooltipBubble}
              innerClassName={styles.tooltipInner}
            >
              Click date to copy Unix timestamp: {unixTS}
            </CETooltip>
          </p>
        );
      }
    } else if (sbtInfo && sbtInfo.mintingEndTime === 0) {
      mintEndDisplay = (
        <p>
          <span className={styles.label}>{`${t('minting')} ends:`}</span>
          <span><FontAwesomeIcon icon={faInfinity} /> Never</span>
        </p>
      );
    }

    const burnAuthLabels = ["Admin Only", "Owner Only", "Both", "Neither"];
    const addressDisplay = getShortenedAddress(sbtAddressForDisplay, false);

    const netHolders = this.getMemoizedNetHoldersList(mintedAddresses, burnedAddresses);
    // For the holders modal, treat any non-empty holders list as "ready" even if the
    // latest refresh pass temporarily flips countsLoaded back to false.
    const hasComputedHolders = netHolders.length > 0;
    const hasFilteredHolders = this.state.filteredMintedUsers.length > 0;
    const mintedTokensOverride = this.sanitizeMintedTokensOverride(this.state.mintedTokensOverride);
    const scanProgress = this.getEffectiveHolderScanProgress();
    const hasScanProgress = this.hasUsableScanProgress(scanProgress);
    const hasActiveScanProgress = this.isActiveScanProgress(scanProgress);
    const isScanActive = this.isHolderScanActive();
    // If the refresh has fully settled without counts or a mintedTokens fallback,
    // render the empty state instead of treating the modal/page as perpetually loading.
    const terminalEmptyHoldersState =
      !loadingMintersBurners &&
      !this.state.loadingMintedFilter &&
      !isScanActive &&
      mintedTokensOverride == null &&
      !hasComputedHolders &&
      !hasFilteredHolders;
    const holdersReady =
      countsLoaded === true ||
      hasComputedHolders ||
      hasFilteredHolders ||
      terminalEmptyHoldersState;
    const shouldOverrideMinted =
      mintedTokensOverride != null &&
      (!countsLoaded || netHolders.length === 0);
    const netMinted = shouldOverrideMinted ? String(mintedTokensOverride) : String(netHolders.length);

    // STALE-WHILE-REVALIDATE LOGIC:
    // 1. Initial Load: If counts aren't confirmed yet, show a big spinner.
    //    We also check global scan status from MainSite to prevent flash of '0' during retries.
    const countsReady = countsLoaded === true || mintedTokensOverride != null || terminalEmptyHoldersState;
    const isGlobalLoading = this.props.sbtScanInProgress || (this.props.sbtScanPending && !countsReady);
    const isLocalLoading = loadingMintersBurners || !countsReady;
    const effectiveLoading = isLocalLoading || isGlobalLoading;

    const _burnMap = { AdminOnly: 0, OwnerOnly: 1, Both: 2, Neither: 3 };
    const burnIdx = (typeof sbtInfo.burnAuth === 'string')
      ? (_burnMap[sbtInfo.burnAuth] ?? undefined)
      : (sbtInfo.burnAuth != null ? Number(sbtInfo.burnAuth) : undefined);
    const burnLabel = (Number.isInteger(burnIdx) && burnIdx >= 0 && burnIdx < burnAuthLabels.length)
      ? burnAuthLabels[burnIdx]
      : '?';

    const maxTokensDisplay = (sbtInfo.maxTokens === "0")
      ? "∞"
      : (sbtInfo.maxTokens != null ? String(sbtInfo.maxTokens) : "-");

    const tokenUriRaw = sbtInfo?.tokenURI || sbtInfo?.tokenUri || '';
    const tokenUriHref = this.resolveTokenMetadataHref(tokenUriRaw);
    const adminAddress = sbtInfo?.admin || sbtInfo?.admin_ || sbtInfo?.deployer || '';
    const creatorAddress = sbtInfo?.creator || adminAddress || sbtInfo?.deployer || sbtInfo?.admin_ || '';

    const isInitialLoading = !countsReady && effectiveLoading;

    // 2. Refreshing: If we have data (netMinted > 0) AND we are loading, show Data + Small Spinner.
    const isRefreshing = (!isInitialLoading) && effectiveLoading;
    const rawRemainingBlocksCount = hasScanProgress
      ? Math.max(
        0,
        Number.isFinite(Number(scanProgress?.remainingBlocks))
          ? Number(scanProgress?.remainingBlocks)
          : (Number(scanProgress?.totalBlocks || 0) - Number(scanProgress?.scannedBlocks || 0))
      )
      : 0;
    const showScanProgress = hasActiveScanProgress && (effectiveLoading || rawRemainingBlocksCount > 0);
    const addressesNeedResolutionHint =
      mintedTokensOverride != null &&
      Number(mintedTokensOverride) > 0 &&
      mintedAddresses.length === 0;
    const addressesAreResolving =
      addressesNeedResolutionHint &&
      (loadingMintersBurners || this.state.loadingMintedFilter || isRefreshing || showScanProgress);
    const holdersDisplayCount = shouldOverrideMinted
      ? `~${mintedTokensOverride}`
      : String(netHolders.length);
    const formatBlockCount = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '-');
    const scanPhaseLabel = 'Scanning mint/burn history';
    const remainingBlocksCount = showScanProgress ? rawRemainingBlocksCount : 0;
    const scanProgressText = showScanProgress
      ? `${scanPhaseLabel}: ${formatBlockCount(remainingBlocksCount)} blocks remaining`
      : null;
    const scanProgressSessionText = showScanProgress
      ? `Session: ${String(scanProgress?.sessionLabel || this.getSessionDisplayLabel(scanProgress?.sessionSlug || this.getEffectiveSessionSlug()) || '').trim()}`
      : null;
    const scanProgressPct = showScanProgress
      ? (
        Number.isFinite(Number(scanProgress?.totalBlocks)) &&
        Number(scanProgress?.totalBlocks) > 0 &&
        Number.isFinite(Number(scanProgress?.scannedBlocks))
          ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                (Number(scanProgress.scannedBlocks || 0) / Number(scanProgress.totalBlocks || 1)) * 100
              )
            )
          )
          : 0
      )
      : 0;
    const keepStaleFilterRowsWhileRefreshing =
      hasFilteredHolders &&
      !hasComputedHolders &&
      isScanActive;
    const holderItemsForFilter = hasComputedHolders
      ? netHolders
      : (keepStaleFilterRowsWhileRefreshing ? this.state.filteredMintedUsers : []);

    // Filter Logic for Modal
    const showEmptyStateInModal =
      !hasFilteredHolders &&
      !hasComputedHolders &&
      !isInitialLoading &&
      !this.state.loadingMintedFilter &&
      !addressesAreResolving &&
      holdersReady &&
      !shouldOverrideMinted;
    const waitingForHolderDetails =
      addressesAreResolving ||
      (
        shouldOverrideMinted &&
        !hasFilteredHolders &&
        !hasComputedHolders &&
        (
          loadingMintersBurners ||
          this.state.loadingMintedFilter ||
          isRefreshing ||
          showScanProgress
        )
      );
    const showApproximateCountHint =
      !hasFilteredHolders &&
      !hasComputedHolders &&
      !showEmptyStateInModal &&
      !addressesAreResolving &&
      !isScanActive &&
      shouldOverrideMinted;
    const showSpinnerInModalBody =
      !hasFilteredHolders &&
      !hasComputedHolders &&
      !showEmptyStateInModal &&
      (waitingForHolderDetails || !holdersReady || isInitialLoading || this.state.loadingMintedFilter);
    const showScanProgressInModal =
      showModal &&
      hasActiveScanProgress &&
      (
        showScanProgress ||
        showSpinnerInModalBody ||
        this.state.loadingMintedFilter ||
        hasActiveScanProgress
      );
    const showCornerSpinner =
      (
        hasActiveScanProgress ||
        this.state.loadingMintedFilter ||
        (loadingMintersBurners && (holdersReady || hasFilteredHolders)) ||
        (isRefreshing && hasActiveScanProgress)
      ) &&
      (holdersReady || hasFilteredHolders);
    const showHeaderCount = holdersReady || shouldOverrideMinted;
    const mintedCountTitle =
      shouldOverrideMinted
        ? 'Holder list not loaded yet; showing an on-chain holder count estimate.'
        : undefined;
    const filterNetwork = this.state.network || this.props.network || null;
    const holdersModalClose = (
      <button
        type="button"
        className={styles.modalCloseButton}
        onClick={this.closeModal}
        aria-label="Close holders"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    );

    return (
      <div className={styles.sbtPage}>
        <button onClick={() => window.location.href = sbtsListPath()} className={styles.backButton}>
          <FontAwesomeIcon icon={faArrowLeft} /> {`${t('sbt')} list`}
        </button>
        {showPasswordAlert && (mintPassword || this.props.sbtMintPassword) && (
          <Alert color="info" className={styles.passwordAlert}>
            Password detected – click "start claim" to mint
          </Alert>
        )}
        {sbtInfo ? (
          <>
            <div className={styles.sbtInfo}>
              <div className={styles.leftColumn}>
                <div className={styles.bookmarkIcon}>
                  <button
                    onClick={this.bookmarkSBT}
                    className={styles.bookmarkButton}
                    style={{ color: bookmarked ? '#FFD700' : undefined }}
                  >
                    <FontAwesomeIcon icon={faBookmark} />
                  </button>
                  <a
                    href={this.getExplorerUrl(sbtAddressForDisplay)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.contractLink}
                  >
                    {addressDisplay}
                  </a>
                  <button
                    onClick={() => this.copyToClipboard(sbtAddressForDisplay, 'contract')}
                    className={styles.copyButton}
                  >
                    <FontAwesomeIcon icon={this.state.copiedAddress === 'contract' ? faCheck : faCopy} />
                  </button>
                  {tokenUriHref && (
                    <a
                      href={tokenUriHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.copyButton}
                      title="Open token metadata"
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                  )}
                </div>
                <div className={styles.image}>
                  <div className={styles.imageWrapper} onClick={this.toggleFullImage}>
                    <img
                      src={imageUrl}
                      alt={sbtNameText}
                      data-testid={E2E_TESTIDS.SBT_PAGE_IMAGE}
                      onError={imageErrorHandler}
                    />
                    <div className={styles.expandOverlay}>
                      <FontAwesomeIcon icon={faExpand} />
                    </div>
                  </div>
                </div>
                <div className={styles.description}>
                  <h1 data-testid={E2E_TESTIDS.SBT_PAGE_NAME}>{sbtNameText}</h1>
                  {sbtDescriptionText ? (
                    <p data-testid={E2E_TESTIDS.SBT_PAGE_DESCRIPTION}>
                      {isSbtFieldLocked(sbtInfo, 'description') && !String(sbtInfo?.description || '').trim() ? (
                        <FontAwesomeIcon icon={faLock} style={{ marginRight: '6px' }} />
                      ) : null}
                      {sbtDescriptionText}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className={styles.rightColumn}>
                <div className={styles.statsSection}>
                  <h2 className={`${styles.sectionHeader} ${styles.roundedHeader}`} onClick={this.toggleStats}>
                    STATS <FontAwesomeIcon icon={showStats ? faChevronUp : faChevronDown} />
                  </h2>
                  {showStats && (
                    <div className={styles.stats}>
                      <p>
                        <span className={styles.label}>{`${t('minted')}:`}</span>
                        {/* Logic: Show spinner ONLY if we have no data and are loading. Else show count. */}
                        {isInitialLoading ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                          <span title={mintedCountTitle}>
                            {`${netMinted} / ${maxTokensDisplay}`}
                          </span>
                        )}
                        {/* Logic: Show subtle spinner if we have data BUT are refreshing. */}
                        {isRefreshing && (
                          <span style={{ marginLeft: '10px', fontSize: '0.8em', opacity: 0.7 }} title="Refreshing...">
                            <FontAwesomeIcon icon={faSpinner} spin />
                          </span>
                        )}

                        <button onClick={this.openMintedModal} className={styles.expandButton}>
                          <FontAwesomeIcon icon={faUser} />
                        </button>
                      </p>
                      {showScanProgress && (
                        <div className={styles.scanProgress}>
                          <FontAwesomeIcon icon={faSpinner} spin className={styles.scanSpinner} />
                          <div className={styles.scanProgressContent}>
                            <span className={styles.scanProgressText}>{scanProgressText}</span>
                            {scanProgressSessionText ? (
                              <span className={styles.scanProgressSession}>{scanProgressSessionText}</span>
                            ) : null}
                            <div
                              className={styles.scanProgressBar}
                              role="progressbar"
                              aria-valuenow={scanProgressPct}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            >
                              <div className={styles.scanProgressFill} style={{ width: `${scanProgressPct}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                      {mintEndDisplay}
                      <p>
                        <span className={styles.label}>Burnable by:</span> {burnLabel}
                        <FontAwesomeIcon
                          icon={faQuestionCircle}
                          className={styles.tooltip}
                          id="burnAuthQuestionMark"
                          style={{ marginLeft: '5px', color: '#00ff9d', cursor: 'pointer', opacity: 0.5 }}
                        />
                        <CETooltip
                          placement="right"
                          target="burnAuthQuestionMark"
                          delay={{ show: 0, hide: 2500 }}
                          className={styles.tooltipBubble}
                          innerClassName={styles.tooltipInner}
                        >
                          Specify who can burn the token: Admin Only, Owner Only, Both, or Neither.
                        </CETooltip>
                      </p>
                      <p>
                        <span className={styles.label}>Network:</span>{' '}
                        {getChainLabelById(sbtInfo?.chainID || this.state.network?.id)}
                      </p>

                      <p>
                        <span className={styles.label}>Admin:</span> {this.renderAddressLink(adminAddress, 'admin')}
                      </p>
                      <p>
                        <span className={styles.label}>Creator:</span> {this.renderAddressLink(creatorAddress, 'creator')}
                      </p>
                    </div>
                  )}
                </div>
                <div className={styles.actionsSection}>
                  <h2 className={`${styles.sectionHeader} ${styles.roundedHeader}`} onClick={this.toggleActions}>
                    ACTIONS <FontAwesomeIcon icon={showActions ? faChevronUp : faChevronDown} />
                  </h2>
                  {showActions && (
                    <div className={styles.actions}>
                      {this.renderMintButton()}
                      {this.renderBurnButton()}
                      {mintingStatus === 'success' && lastMintTxHash && burningStatus !== 'success' && (
                        <div className={styles.mintProcess}>
                          <p className={styles.mintSuccess}>
                            {`${t('sbt')} successfully ${t('mintedLower')}!`}
                            <br />
                            {`${t('mint')} Tx Hash:`}{' '}
                            <a
                              href={this.getExplorerLink(lastMintTxHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {getShortenedTransactionHash(lastMintTxHash)}
                            </a>
                          </p>
                        </div>
                      )}
                      {burningStatus === 'success' && lastBurnTxHash && (
                        <div className={styles.mintProcess}>
                          <p className={styles.mintSuccess}>
                            {`${t('sbt')} successfully ${t('burnedLower')}!`}
                            <br />
                            {`${t('burn')} Tx Hash:`}{' '}
                            <a
                              href={this.getExplorerLink(lastBurnTxHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {getShortenedTransactionHash(lastBurnTxHash)}
                            </a>
                          </p>
                        </div>
                      )}
                      {error && (mintingStatus === 'failure' || burningStatus === 'failure') && (
                        <Alert color="danger" className={styles.txErrorAlert}>
                          <FontAwesomeIcon icon={faExclamationTriangle} /> Transaction Failed: {this.state.error}
                          <button
                            onClick={this.copyErrorToClipboard}
                            aria-label="Copy error message"
                            title="Copy error message"
                            style={{ background: 'transparent', border: 'none', marginLeft: '8px', cursor: 'pointer' }}
                          >
                            <FontAwesomeIcon icon={this.state.copiedError ? faCheck : faCopy} />
                          </button>
                          {transactionHash && (
                            <>
                              <br />
                              Tx Hash:{' '}
                              <a href={this.getExplorerLink(transactionHash)} target="_blank" rel="noopener noreferrer">
                                {getShortenedTransactionHash(transactionHash)}
                              </a>
                            </>
                          )}
                        </Alert>
                      )}
                    </div>
                  )}
                </div>
                {userIsSbtAdmin && (
                  <div className={styles.adminSection}>
                    <h2 className={`${styles.sectionHeader} ${styles.roundedHeader}`} onClick={this.toggleAdminSection}>
                      ADMIN <FontAwesomeIcon icon={showAdminSection ? faChevronUp : faChevronDown} />
                    </h2>
                    {showAdminSection && (
                      <div className={styles.adminContainer}>
                        {this.renderAdminActions()}
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.moreDetailsSection}>
                  <h2 className={`${styles.sectionHeader} ${styles.roundedHeader}`} onClick={this.toggleMoreDetails}>
                    MORE <FontAwesomeIcon icon={showMoreDetails ? faChevronUp : faChevronDown} />
                  </h2>
                  {showMoreDetails && this.renderRelevantInfo()}
                </div>
              </div>
            </div>
          </>
        ) : (
          !error && loadingScreen
        )}

        <Modal
          isOpen={showModal}
          toggle={this.closeModal}
          className={styles.modal}
          contentClassName={styles.modalContent} // Applies dark theme via SCSS
          size="lg"
          centered
        >
          <ModalHeader toggle={this.closeModal} close={holdersModalClose} className={styles.modalHeader}>
            <div className={styles.modalTitleStack}>
              <span className={styles.modalTitle}>
                Holders
                {showHeaderCount && (
                  <span className={styles.modalTitleCount}>({holdersDisplayCount})</span>
                )}
              </span>
              {showCornerSpinner && (
                <span className={styles.modalTitleSpinnerRow}>
                  <FontAwesomeIcon icon={faSpinner} spin className={styles.cornerSpinner} title="Refreshing holders..." />
                </span>
              )}
            </div>
          </ModalHeader>
          <ModalBody className={styles.modalBody}>
            <div>
              <SBTFilter
                items={holderItemsForFilter}
                mode="addresses"
                provider={this.props.provider}
                network={filterNetwork}
                sessionSlug={this.getEffectiveSessionSlug()}
                defaultFeaturedSBTs={this.getSessionSBTAddresses()}
                onFilter={this.handleModalFilteredMintedUsers}
                autoExpand={false}
                isSBTCacheReady={this.props.isSBTCacheReady}
                sbtCacheRevision={this.props.sbtCacheRevision}
              />

              {this.state.loadingMintedFilter && !hasFilteredHolders && !hasComputedHolders && (
                <div className={styles.filteringStatus}>Filtering...</div>
              )}
              <div className={styles.userList}>
                {showScanProgressInModal && (
                  <div className={styles.scanProgress}>
                    <FontAwesomeIcon icon={faSpinner} spin className={styles.scanSpinner} />
                    <div className={styles.scanProgressContent}>
                      <span className={styles.scanProgressText}>{scanProgressText}</span>
                      {scanProgressSessionText ? (
                        <span className={styles.scanProgressSession}>{scanProgressSessionText}</span>
                      ) : null}
                      <div
                        className={styles.scanProgressBar}
                        role="progressbar"
                        aria-valuenow={scanProgressPct}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <div className={styles.scanProgressFill} style={{ width: `${scanProgressPct}%` }} />
                      </div>
                    </div>
                  </div>
                )}
                {/* Body logic: Only show empty state if NOT initial loading */}
                {showEmptyStateInModal && (
                  <div className={styles.emptyState}>No holders found.</div>
                )}
                {showApproximateCountHint && (
                  <div className={styles.emptyState}>Holder addresses not available yet. Showing approximate count only.</div>
                )}
                {/* Body logic: Show spinner if initial loading */}
                {showSpinnerInModalBody && (
                  <div className={styles.emptyState}><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                )}

                {this.state.filteredMintedUsers.map((address, index) => {
                  const seed = String(address || 'contextengine-default-seed').toLowerCase();
                  const blockieUrl = generateBlockieDataUrl(seed, 8, 4);
                  return (
                    <div key={index} className={styles.userItem}>
                      <div className={styles.userItemLeft}>
                        {blockieUrl ? (
                          <img
                            src={blockieUrl}
                            alt=""
                            className={styles.userBlockie}
                          />
                        ) : null}
                        <a href={`/u/${address}`} target="_blank" rel="noopener noreferrer" className={styles.userAddressLink}>
                          {getShortenedAddress(address, false)}
                        </a>
                      </div>
                      <div className={styles.userItemActions}>
                        <button onClick={() => this.copyToClipboard(address, `modal-addr-${index}`)} className={styles.copyButtonSmall}>
                          <FontAwesomeIcon icon={this.state.copiedAddress === `modal-addr-${index}` ? faCheck : faCopy} />
                        </button>
                        <a href={this.getExplorerUrl(address)} target="_blank" rel="noopener noreferrer" className={styles.explorerLinkSmall}>
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalBody>
        </Modal>

        {/* Full Image Modal */}
        <Modal
          isOpen={this.state.showFullImage}
          toggle={this.toggleFullImage}
          centered
          size="xl"
          contentClassName={styles.imageModalContent}
        >
          <ModalBody className={styles.imageModalBody} onClick={this.toggleFullImage}>
            {sbtInfo && (
              <img
                src={imageUrl}
                alt={sbtNameText}
                onError={imageErrorHandler}
              />
            )}
          </ModalBody>
        </Modal>

        <Modal
          isOpen={docModalOpen}
          toggle={this.closeDocModal}
          className={styles.modal}
          contentClassName={styles.modalContent}
          size="lg"
        >
          <ModalHeader toggle={this.closeDocModal} className={styles.modalHeader}>
            <span className={styles.modalTitle}>{docModalName || 'Encrypted document'}</span>
            {docModalLoading && (
              <FontAwesomeIcon icon={faSpinner} spin className={styles.headerSpinner} />
            )}
          </ModalHeader>
          <ModalBody className={styles.modalBody}>
            {docModalError && (
              <div className={styles.modalError}>{docModalError}</div>
            )}
            {!docModalError && docModalLoading && (
              <div className={styles.modalLoading}>
                <FontAwesomeIcon icon={faSpinner} spin /> Decrypting…
              </div>
            )}
            {!docModalError && !docModalLoading && docModalContent && (
              <pre className={styles.docModalContent}>{docModalContent}</pre>
            )}
            {!docModalError && !docModalLoading && !docModalContent && docModalBlobUrl && (
              <div className={styles.docModalDownload}>
                <a href={docModalBlobUrl} download={docModalName || 'document'}>
                  Download decrypted file
                </a>
              </div>
            )}
          </ModalBody>
        </Modal>
      </div>
    );
  }
}

export default SBTPage;
