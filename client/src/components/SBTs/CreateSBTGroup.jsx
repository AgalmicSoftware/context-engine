/** @file CreateSBTGroup.jsx */

import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faQuestionCircle,
  faCheck,
  faPlus,
  faChevronDown,
  faChevronUp,
  faSpinner,
  faExclamationCircle,
  faExternalLinkAlt,
  faCopy,
  faDownload,
  faImage,
  faClipboard,
  faBookmark,
  faQrcode,
  faTimes,
  faEraser
} from '@fortawesome/free-solid-svg-icons';
import { ethers } from 'ethers';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import { resolvePublishArweaveUploadOptions, isPublishUploadBootstrapReachabilityError } from '../../utilities/arweave/publishUploadAuth.js';
import { normalizeArweaveUrl, parseArweaveTxId } from '../../utilities/arweave/arweaveUrls.js';
import contractScripts, { getSessionConfigBySlugOrDefault, normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { fetchImageFromURL } from '../../utilities/ui/imageScripts.js'
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import styles from './CreateSBTGroup.module.scss';
import { QRCodeSVG } from 'qrcode.react';
import {
  getChainById,
  getSessionContractsForChain,
  getSessionRegistryChains,
} from '../../variables/chains.js';
import { JsonButtonRow, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import JsonDisplay from '../Shared/Json/JsonDisplay';
import CETooltip from '../Shared/CETooltip';
import CEDateTimeInput from '../Shared/CEDateTimeInput';
import GateMultiSelectLock from '../Gates/GateMultiSelectLock';
import CompactImageChooser from '../Shared/CompactImageChooser';
import { readCompactImageClipboard } from '../Shared/compactImageClipboard.js';
import { resolveSessionContractRef } from '../../utilities/session/sessionNaming.js';

import { cryptoUtils }  from '../../utilities/crypto/cryptography.js';
import {
  buildSbtAccessControlConditions,
  getGlobalLitHooks,
  resolveLitChain,
  uploadEncryptedArweaveData,
} from '../../utilities/crypto/litProtocol.js';
import { createLogger } from '../../utilities/logging.js';
import { peekCacheSync, writeCache } from '../../utilities/cache/cacheScripts.js';
import { notify } from '../../utilities/ui/notify.js';
import { getRelevantDefaultTags, normalizeTagList } from '../../utilities/defaultTags.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  getGateSbtAddresses,
  normalizeGateMode,
  resolveSponsoredGateStateForResource,
  SPONSORED_GATE_STATES,
} from '../../utilities/web3/sponsoredAccess.js';
import { resolveSbtAddressFromFactoryReceipt } from '../../utilities/web3/sbtFactoryReceipt.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import {
  getScopedCreateSbtFormCacheKey,
  hasMeaningfulCreateSbtFormPayload,
  LEGACY_CREATE_SBT_FORM_CACHE_KEY as FORM_CACHE_KEY,
} from '../../utilities/sbt/createSbtFormCache.js';
import { isCryptoMode, t } from '../../utilities/ui/terminology.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerAuth.js';

const sbtLog = createLogger('sbt');
const SBT_TOOLTIP_LABEL = isCryptoMode() ? 'Soulbound tokens (SBTs)' : `${t('sbtFull')}s`;


const DEFAULT_SBT_IMAGE_ARWEAVE_TX = 'h8Z3ZLldhuZafwvUODixAeGZKg8ZBAuwH86UvNzRCuw';
const DEFERRED_DRAFT_CREATE2_SALT_PREFIX = 'draft/';
const buildDeferredDraftCreate2Salt = () => (
  `${DEFERRED_DRAFT_CREATE2_SALT_PREFIX}${ethers.utils.hexlify(ethers.utils.randomBytes(16)).replace(/^0x/, '')}`
);
const buildSessionRoutePath = (slugRaw = '', basePath = '') => {
  const slug = normalizeSessionSlug(slugRaw || '');
  const normalizedBasePath = String(basePath || '').replace(/\/+$/, '');
  return normalizedBasePath + (slug ? `/session/${encodeURIComponent(slug)}` : '/session');
};
const ENCRYPTION_GATE_COLORS = ['#5affc2', '#5b8cff', '#ffb347', '#ff6bcb', '#ffd166'];
const LOCKED_FIELD_MASK = '[encrypted]';
const DEFERRED_MODAL_SURFACE_BG = '#11182c';
const METADATA_LOCK_FIELDS = Object.freeze(['name', 'description', 'tags', 'documentURLs', 'image']);
const AUTHORING_GATE_RESOURCE_LABELS = Object.freeze({
  default: 'default',
  ai: 'ai',
  arweave: 'arweave',
  docUrls: 'docs',
  questionResponses: 'questions',
  surveyResponses: 'survey',
});
const DISTRIBUTION_OPTION_CONFIGS = Object.freeze([
  {
    value: 'hasPasswords',
    label: 'One-use URLs',
    helpText: 'Generate a unique claim link for each participant.',
    tooltipId: 'oneUseTooltip',
    tooltipText: `Generate unique, one-time use links for each member to claim their ${t('sbtLower')}.`,
  },
  {
    value: 'groupPassword',
    label: 'Group Password',
    helpText: 'Share one password with the whole group.',
    tooltipId: 'groupPasswordTooltip',
    tooltipText: 'Create a single shared password for the group.',
  },
  {
    value: 'anyoneCanMint',
    label: 'public URL',
    helpText: 'Anyone with the link can mint.',
    tooltipId: 'anyoneCanMintTooltip',
    tooltipText: `Generate a URL where anyone can ${t('mintLower')} the ${t('sbtLower')}.`,
  },
]);

const isPlainObject = (value) => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const normalizePositiveChainId = (value) => {
  const id = Number(value || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
};
const normalizeComparableAddress = (value) => toStr(value).trim().toLowerCase();
const shouldFallbackDeferredDraftUpload = (error) => {
  const message = toStr(error?.message || error).trim().toLowerCase();
  if (!message) return false;
  return (
    isPublishUploadBootstrapReachabilityError(error) ||
    message.includes('worker url is missing') ||
    message.includes('connect a wallet to authenticate with the worker') ||
    message.includes('connect a wallet to sign admin requests') ||
    message.includes('failed to request worker nonce') ||
    message.includes('worker auth nonce route not supported') ||
    message.includes('worker auth login route not supported') ||
    message.includes('worker login failed') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message === 'invalid address' ||
    message === 'invalid address.'
  );
};

const stableGateColor = (gateId) => {
  const str = String(gateId || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash * 31) + str.charCodeAt(i)) >>> 0;
  }
  return ENCRYPTION_GATE_COLORS[hash % ENCRYPTION_GATE_COLORS.length];
};

const normalizeGateIds = (value) => {
  if (Array.isArray(value)) {
    return value.map((id) => String(id || '').trim()).filter(Boolean);
  }
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? [raw] : [];
};

const normalizeGateText = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\[object\s+object\]$/i.test(text)) return '';
  return text;
};

const getConfiguredContractAddress = (value) => normalizeGateText(
  isPlainObject(value) ? value.address : value
);

const hasUsableSbtFactoryForChain = (chainId) => (
  getConfiguredContractAddress(getSessionContractsForChain(chainId)?.sbtFactory) !== ''
);

const selectPreferredChainId = (candidateIds = [], availableChainIds = []) => {
  const normalizedCandidates = candidateIds
    .map((value) => normalizePositiveChainId(value))
    .filter(Boolean);
  const allowedIds = new Set(
    (Array.isArray(availableChainIds) ? availableChainIds : [])
      .map((value) => normalizePositiveChainId(value))
      .filter(Boolean)
  );
  if (allowedIds.size > 0) {
    const allowedMatch = normalizedCandidates.find((id) => allowedIds.has(id));
    if (allowedMatch) return allowedMatch;
  }
  return normalizedCandidates[0] || null;
};

const normalizeSessionContractRef = (value, fallbackChainId = null) => {
  const contractRef = isPlainObject(value) ? { ...value } : {};
  const address = getConfiguredContractAddress(value);
  const chainId = normalizePositiveChainId(
    contractRef.chainId ||
    contractRef.chainID ||
    contractRef.networkChainId ||
    contractRef.chain ||
    fallbackChainId
  );
  if (!address && !chainId) return null;
  return {
    ...(address ? { address } : {}),
    ...(chainId ? { chainId } : {}),
  };
};

const contractRefMatchesChain = (contractRef, targetChainId, fallbackChainId = null) => {
  if (!contractRef?.address) return false;
  const effectiveChainId = normalizePositiveChainId(contractRef.chainId || fallbackChainId);
  if (!effectiveChainId) return true;
  return effectiveChainId === targetChainId;
};

const AUTHORING_CHAIN_CONTRACT_KEYS = Object.freeze(['surveys', 'sbtFactory']);

const buildAuthoringContractRefs = ({ sessionConfig, networkId }) => {
  const selectedChainId = normalizePositiveChainId(networkId);
  if (!selectedChainId) return {};

  const baseContracts = (sessionConfig?.contracts && typeof sessionConfig.contracts === 'object')
    ? sessionConfig.contracts
    : {};
  const sessionChainId = normalizePositiveChainId(sessionConfig?.networkChainId);
  const chainDefaultContracts = getSessionContractsForChain(selectedChainId);
  const contractKeys = new Set([
    ...Object.keys(baseContracts),
    ...Object.keys(chainDefaultContracts || {}),
    ...AUTHORING_CHAIN_CONTRACT_KEYS,
  ]);
  const contracts = {};

  contractKeys.forEach((key) => {
    const sessionResolvedRef = AUTHORING_CHAIN_CONTRACT_KEYS.includes(key)
      ? resolveSessionContractRef({ sessionConfig, contractKey: key })
      : { address: '', chainId: undefined };
    const explicitSessionContractRef = normalizeSessionContractRef(baseContracts[key], sessionChainId);
    const aliasSessionContractRef = normalizeSessionContractRef(
      (sessionResolvedRef?.address || sessionResolvedRef?.chainId) ? sessionResolvedRef : null,
      sessionChainId
    );
    const sessionContractRef = explicitSessionContractRef || aliasSessionContractRef;
    const chainDefaultRef = normalizeSessionContractRef(chainDefaultContracts?.[key], selectedChainId);

    // Regression guard: when the authoring chain changes, keep only session-specific
    // contracts that already belong to that chain; otherwise swap to that chain's defaults.
    const resolvedRef = (
      chainDefaultRef?.address &&
      !contractRefMatchesChain(sessionContractRef, selectedChainId, sessionChainId)
    )
      ? chainDefaultRef
      : (sessionContractRef || chainDefaultRef);

    if (!resolvedRef) return;
    contracts[key] = {
      ...resolvedRef,
      ...(normalizePositiveChainId(resolvedRef.chainId || selectedChainId)
        ? { chainId: normalizePositiveChainId(resolvedRef.chainId || selectedChainId) }
        : {}),
    };
  });

  return contracts;
};

const normalizeAddressList = (values = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const address = String(value || '').trim();
    if (!address) return;
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  });
  return out;
};

const createEmptyMetadataLockGateIds = () => ({
  name: [],
  description: [],
  tags: [],
  documentURLs: [],
  image: [],
});

const normalizeMetadataLockGateIds = (value = {}) => {
  const source = isPlainObject(value) ? value : {};
  const next = createEmptyMetadataLockGateIds();
  METADATA_LOCK_FIELDS.forEach((fieldKey) => {
    next[fieldKey] = normalizeGateIds(source[fieldKey]);
  });
  return next;
};

const getMetadataFieldLockGateIds = (lockMap = {}, fieldKey = '') => (
  normalizeGateIds(lockMap?.[fieldKey])
);

const areStringArraysEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i] || '') !== String(b[i] || '')) return false;
  }
  return true;
};

const areMetadataLockGateMapsEqual = (a = {}, b = {}) => (
  METADATA_LOCK_FIELDS.every((fieldKey) => (
    areStringArraysEqual(
      getMetadataFieldLockGateIds(a, fieldKey),
      getMetadataFieldLockGateIds(b, fieldKey)
    )
  ))
);

const resolveLockAudienceSessionName = (sessionConfig = {}) => {
  const direct = normalizeGateText(sessionConfig?.sessionName || sessionConfig?.slug);
  return direct || 'session';
};

const buildResourceKeyByGateId = (sessionConfig = {}) => {
  const out = {};
  const registerGateId = (gateId, resourceKey) => {
    const normalizedGateId = normalizeGateText(gateId);
    const normalizedResourceKey = normalizeGateText(resourceKey);
    if (!normalizedGateId || !normalizedResourceKey) return;
    if (!out[normalizedGateId]) out[normalizedGateId] = normalizedResourceKey;
  };

  const resources = isPlainObject(sessionConfig?.sponsored?.resources)
    ? sessionConfig.sponsored.resources
    : {};
  Object.entries(resources).forEach(([resourceKey, resourceCfg]) => {
    const gateIds = [
      ...(Array.isArray(resourceCfg?.gateIds) ? resourceCfg.gateIds : []),
      resourceCfg?.gateId,
    ];
    gateIds.forEach((gateId) => registerGateId(gateId, resourceKey));
  });

  [
    'default',
    'ai',
    'arweave',
    'docUrls',
    'questionResponses',
    'surveyResponses',
  ].forEach((resourceKey) => {
    const state = resolveSponsoredGateStateForResource(sessionConfig, resourceKey);
    if (state?.status !== SPONSORED_GATE_STATES.RESTRICTED || !state?.gate) return;
    registerGateId(state.gate?.gateId || state.gate?.id, resourceKey);
  });

  return out;
};

const sanitizeGateForMetadata = (gate = {}, chainIdFallback = null) => {
  const gateId = normalizeGateText(gate?.gateId || gate?.id);
  const sbtAddresses = normalizeAddressList([
    ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
    gate?.sbtAddress,
  ]);
  if (!gateId || !sbtAddresses.length) return null;

  const chainId = Number(gate?.chainId || chainIdFallback || 0) || chainIdFallback || null;
  const litChain = resolveLitChain({ chainId, litChain: gate?.litChain || gate?.chain });

  return {
    type: gate?.type || 'sbt',
    gateId,
    id: gateId,
    label: normalizeGateText(
      gate?.label ||
      gate?.name ||
      gate?.title ||
      gate?.displayLabel ||
      gateId
    ) || gateId,
    displayLabel: normalizeGateText(gate?.displayLabel || gate?.label || gateId) || gateId,
    badgeLabel: normalizeGateText(
      gate?.badgeLabel ||
      gate?.label ||
      gate?.name ||
      gateId
    ) || gateId,
    secondaryLabel: normalizeGateText(gate?.secondaryLabel || ''),
    resourceKey: normalizeGateText(gate?.resourceKey || ''),
    color: normalizeGateText(gate?.color) || stableGateColor(gateId),
    mode: normalizeGateMode(gate),
    requireAll: gate?.requireAll === true || normalizeGateMode(gate) === 'all',
    sbtAddresses,
    sbtAddress: sbtAddresses[0] || '',
    chainId,
    litChain,
  };
};

const buildScopedLockGateId = (sessionSlug = '', gateId = '') => {
  const normalizedGateId = normalizeGateText(gateId);
  if (!normalizedGateId) return '';
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug || '');
  return `session:${normalizedSessionSlug || 'general'}::${normalizedGateId}`;
};

const buildGateOptionsFromConfig = ({
  sessionConfig = {},
  encryptionGates = [],
  defaultGateId = '',
  chainIdFallback = null,
} = {}) => {
  const gateMap = {};
  const sessionLabel = resolveLockAudienceSessionName(sessionConfig);
  const resourceKeyByGateId = buildResourceKeyByGateId(sessionConfig);
  const registerGate = (rawGate = {}, preferredGateId = '') => {
    const gateId = normalizeGateText(preferredGateId || rawGate?.gateId || rawGate?.id);
    if (!gateId) return;

    const sbtAddressesFromHelper = getGateSbtAddresses(rawGate);
    const sbtAddresses = sbtAddressesFromHelper.length
      ? sbtAddressesFromHelper
      : normalizeAddressList([
          ...(Array.isArray(rawGate?.sbtAddresses) ? rawGate.sbtAddresses : []),
          rawGate?.sbtAddress,
        ]);
    if (!sbtAddresses.length) return;

    const chainId = Number(rawGate?.chainId || chainIdFallback || 0) || chainIdFallback || null;
    const litChain = resolveLitChain({ chainId, litChain: rawGate?.litChain || rawGate?.chain });
    const resourceKey = normalizeGateText(
      rawGate?.resourceKey ||
      rawGate?.secondaryLabel ||
      resourceKeyByGateId[gateId]
    );
    const resourceLabel = AUTHORING_GATE_RESOURCE_LABELS[resourceKey] || resourceKey;

    gateMap[gateId] = {
      ...rawGate,
      type: rawGate?.type || 'sbt',
      gateId,
      id: gateId,
      resourceKey,
      secondaryLabel: resourceLabel || '',
      label: sessionLabel,
      displayLabel: sessionLabel,
      badgeLabel: sessionLabel,
      color: normalizeGateText(rawGate?.color) || stableGateColor(gateId),
      mode: normalizeGateMode(rawGate),
      requireAll: rawGate?.requireAll === true || normalizeGateMode(rawGate) === 'all',
      sbtAddresses,
      sbtAddress: sbtAddresses[0] || '',
      chainId,
      litChain,
    };
  };

  if (Array.isArray(encryptionGates) && encryptionGates.length > 0) {
    encryptionGates.forEach((gate) => registerGate(gate, gate?.id || gate?.gateId));
  } else {
    const sponsoredGates = isPlainObject(sessionConfig?.sponsored?.gates)
      ? sessionConfig.sponsored.gates
      : {};
    Object.entries(sponsoredGates).forEach(([gateId, gate]) => registerGate(gate, gateId));

    const defaultGateState = resolveSponsoredGateStateForResource(sessionConfig, 'default');
    if (
      defaultGateState?.status === SPONSORED_GATE_STATES.RESTRICTED &&
      defaultGateState?.gate
    ) {
      registerGate(
        defaultGateState.gate,
        defaultGateState.gate?.gateId || defaultGateId || 'default'
      );
    }
  }

  const gateEntries = Object.values(gateMap)
    .sort((a, b) => String(a?.resourceKey || a?.gateId || '').localeCompare(String(b?.resourceKey || b?.gateId || '')));
  const gateIds = gateEntries.map((gate) => gate.gateId).filter(Boolean);
  const requestedDefaultGateId = normalizeGateText(defaultGateId);
  const configuredDefaultGateId = normalizeGateText(
    sessionConfig?.sponsored?.defaultGateId ||
    sessionConfig?.lit?.defaultGateId
  );
  const resolvedDefaultGateId = [
    requestedDefaultGateId,
    configuredDefaultGateId,
    gateEntries[0]?.gateId,
  ].find((gateId) => gateId && gateIds.includes(gateId)) || (gateEntries[0]?.gateId || '');
  const selectedGate = gateEntries.find((gate) => gate.gateId === resolvedDefaultGateId) || gateEntries[0] || null;
  // SBT metadata authoring intentionally collapses session-derived resource gates
  // to the canonical default gate instead of exposing per-resource lock picking.
  const gateOptions = selectedGate ? [{
    id: selectedGate.gateId,
    label: sessionLabel,
    displayLabel: sessionLabel,
    badgeLabel: sessionLabel,
    secondaryLabel: '',
    color: selectedGate.color,
    mode: selectedGate.mode,
    requireAll: selectedGate.requireAll === true,
    sbtAddresses: selectedGate.sbtAddresses,
    sbtAddress: selectedGate.sbtAddress,
    chainId: selectedGate.chainId,
    litChain: selectedGate.litChain,
    resourceKey: selectedGate.resourceKey || '',
  }] : [];

  return {
    gateMap,
    gateOptions,
    defaultGateId: resolvedDefaultGateId,
  };
};

const buildGateOptionsFromSessionSources = ({
  sessionSources = [],
  preferredSessionSlug = '',
  chainIdFallback = null,
} = {}) => {
  const gateMap = {};
  const gateOptions = [];
  const normalizedPreferredSessionSlug = normalizeSessionSlug(preferredSessionSlug || '');

  (Array.isArray(sessionSources) ? sessionSources : []).forEach((source) => {
    const sessionConfig = isPlainObject(source?.sessionConfig) ? source.sessionConfig : null;
    if (!sessionConfig) return;

    const sessionSlug = normalizeSessionSlug(source?.sessionSlug || sessionConfig?.slug || '');
    const resolvedChainIdFallback = normalizePositiveChainId(
      source?.chainIdFallback ||
      source?.sessionConfig?.networkChainId ||
      chainIdFallback
    ) || chainIdFallback || null;
    const scopedGateSet = buildGateOptionsFromConfig({
      sessionConfig,
      encryptionGates: Array.isArray(source?.encryptionGates) ? source.encryptionGates : [],
      defaultGateId: source?.defaultGateId || '',
      chainIdFallback: resolvedChainIdFallback,
    });

    (Array.isArray(scopedGateSet.gateOptions) ? scopedGateSet.gateOptions : []).forEach((option) => {
      const rawGateId = normalizeGateText(option?.id || option?.gateId);
      if (!rawGateId) return;

      const scopedId = buildScopedLockGateId(sessionSlug, rawGateId);
      if (!scopedId || gateMap[scopedId]) return;

      const sourceGate = scopedGateSet.gateMap?.[rawGateId] || option;
      const sbtAddresses = normalizeAddressList([
        ...(Array.isArray(option?.sbtAddresses) ? option.sbtAddresses : []),
        ...(Array.isArray(sourceGate?.sbtAddresses) ? sourceGate.sbtAddresses : []),
        option?.sbtAddress,
        sourceGate?.sbtAddress,
      ]);
      const chainId = normalizePositiveChainId(
        option?.chainId ||
        sourceGate?.chainId ||
        resolvedChainIdFallback
      ) || resolvedChainIdFallback || null;
      const litChain = (
        normalizeGateText(option?.litChain || sourceGate?.litChain || option?.chain || sourceGate?.chain)
        || resolveLitChain({ chainId })
      );

      const scopedGate = {
        ...sourceGate,
        gateId: scopedId,
        id: scopedId,
        sourceGateId: rawGateId,
        sourceSessionSlug: sessionSlug,
        label: normalizeGateText(option?.label || sourceGate?.label) || resolveLockAudienceSessionName(sessionConfig),
        displayLabel: normalizeGateText(option?.displayLabel || option?.label || sourceGate?.displayLabel || sourceGate?.label)
          || resolveLockAudienceSessionName(sessionConfig),
        badgeLabel: normalizeGateText(option?.badgeLabel || option?.displayLabel || option?.label || sourceGate?.badgeLabel || sourceGate?.label)
          || resolveLockAudienceSessionName(sessionConfig),
        secondaryLabel: normalizeGateText(option?.secondaryLabel || sourceGate?.secondaryLabel || ''),
        color: normalizeGateText(option?.color || sourceGate?.color) || stableGateColor(scopedId),
        mode: normalizeGateMode(option?.mode ? option : sourceGate),
        requireAll: option?.requireAll === true || sourceGate?.requireAll === true || normalizeGateMode(option?.mode ? option : sourceGate) === 'all',
        sbtAddresses,
        sbtAddress: sbtAddresses[0] || '',
        chainId,
        litChain,
        resourceKey: normalizeGateText(option?.resourceKey || sourceGate?.resourceKey || ''),
      };

      gateMap[scopedId] = scopedGate;
      gateOptions.push(scopedGate);
    });
  });

  const preferredGateId = gateOptions.find((gate) => (
    normalizeSessionSlug(gate?.sourceSessionSlug || '') === normalizedPreferredSessionSlug
  ))?.id || '';

  return {
    gateMap,
    gateOptions,
    defaultGateId: preferredGateId || (gateOptions[0]?.id || ''),
  };
};

class CreateSBTGroup extends Component {
  constructor(props) {
    super(props);
    const initialAuthoringChain = this.getAuthoringChainState();
    const autoExpandAllSections = !!props.deferredDeploy;
    this.state = {
      sbtName: '',
      sbtDescription: '',
      sbtImageFile: null,
      sbtImageUrl: '',
      useImageUrl: false,
      sbtCodes: [],
      groupSubmitted: false,
      groupHash: '',
      sbtDistribution: {
        isLimited: false,
        limitedNumber: 0,
        hasAdmin: false,
        adminAddress: props.account || '',
        isRevocable: false,
        isTimeLimited: false,
        mintingEndTime: null,
        distributionOption: 'anyoneCanMint',
        burnAuth: 'AdminOnly',
        burnAdmin: props.account || '',
        network: initialAuthoringChain.chain,
        unlisted: false,
      },
      imageUploaded: false,
      tokenURI: '',
      tokenUriUploaded: false,
      sbtMinted: false,
      sbtAddress: '',
      passwordList: [],
      sbtInviteLinks: [],
      sbtInviteBackupDate: '',
      textToUpload: '',
      csvAddresses: '',
      estimatedMintCost: '0',
      tokenInfoCollapsed: false,
      mintOptionsCollapsed: !autoExpandAllSections,
      distributionOptionsCollapsed: !autoExpandAllSections,
      currentStep: 0,
      mintingFailed: false,
      numInviteLinks: 10,
      network: initialAuthoringChain.chainId || '',
      copiedLinkIndex: null,
      exportFormat: 'json',
      countdown: 12,
      countdownActive: false,
      sbtSymbol: '',
      tags: [],
      currentTagInput: '',
      documentIDHashes: '',
      documentUrl: '',
      showTagsInput: false,
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      documentURLs: [],
      startedMinting: false,
      // Group password
      groupPassword: '',
      arweaveTxId: '',
      shareableUrl: '',
      error: '',
      autoJoinUrl: '',

      openLockKey: '',
      metadataLockGateIds: createEmptyMetadataLockGateIds(),
      lockedImageAsset: null,
      create2Salt: '',
      deferredCreate2Salt: props.deferredDeploy ? buildDeferredDraftCreate2Salt() : '',
      predictableAddressEnabled: !!props.deferredDeploy,
      predictedAddress: '',
      predictedAddressStatus: '',
      predictedAddressBusy: false,
      autoAppliedDefaultTags: [],
      dismissedDefaultTags: [],

      showJson: false,
      copyJsonSuccess: false,
      copyLinkSuccess: false,
      copyIdSuccess: false,
      bookmarkedSbtsSet: new Set()
    };

    // internal: avoid redundant writes
    this._lastSavedCacheJSON = null;
    this._isMounted = false;
    this._trackedTimeouts = new Map();
    this.countdownTimer = null;
    this.predictAddressTimer = null;
    this._predictAddressRequestSeq = 0;
    this._predictedAddressShapeSignature = '';
    this._autoCreate2SaltForGroupPassword = false;
    this._suppressFormCachePersistence = false;
  }

  /* =========================
   * Cache helpers (sessionStorage)
   * ========================= */
  _fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  _dataUrlToBlob = (dataUrl) => {
    const [header, data] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(data);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  getNormalizedDocumentUrlDraft = (value = this.state.documentUrl) => (
    String(value || '').trim()
  );

  getEffectiveDocumentURLs = ({
    documentURLs = this.state.documentURLs,
    documentUrl = this.state.documentUrl,
  } = {}) => {
    const nextDocumentUrls = Array.isArray(documentURLs)
      ? documentURLs.map((url) => String(url || '').trim()).filter(Boolean)
      : [];
    const pendingDocumentUrl = this.getNormalizedDocumentUrlDraft(documentUrl);
    if (pendingDocumentUrl && nextDocumentUrls.length < 10) {
      nextDocumentUrls.push(pendingDocumentUrl);
    }
    return nextDocumentUrls;
  };

  resumeFormCachePersistence = () => {
    this._suppressFormCachePersistence = false;
  };

  suppressFormCachePersistenceAfterSuccess = () => {
    this._suppressFormCachePersistence = true;
    this.clearFormCache();
  };

  buildCachePayload = () => {
    const {
      sbtName, sbtDescription, sbtImageUrl, useImageUrl, sbtDistribution,
      tags, documentIDHashes, documentURLs, documentUrl, groupPassword, numInviteLinks,
      exportFormat, metadataLockGateIds, create2Salt, predictableAddressEnabled,
      deferredCreate2Salt, autoAppliedDefaultTags, dismissedDefaultTags
    } = this.state;
    const selectedAuthoringChainId = this.getSelectedAuthoringChainId();

    const safeDist = { ...sbtDistribution };
    // Serialize Date -> ISO
    safeDist.mintingEndTime = safeDist.mintingEndTime
      ? new Date(safeDist.mintingEndTime).toISOString()
      : null;
    // Keep the selected authoring chain id so reloads preserve the deploy target.
    safeDist.network = selectedAuthoringChainId || 'not connected';

    return {
      sbtName: (sbtName || '').trim(),
      sbtDescription: (sbtDescription || '').trim(),
      sbtImageUrl,
      useImageUrl,
      sbtDistribution: safeDist,
      tags, // Array is safely JSON serialized
      documentIDHashes,
      documentURLs,
      documentUrl: this.getNormalizedDocumentUrlDraft(documentUrl),
      groupPassword,
      metadataLockGateIds: normalizeMetadataLockGateIds(metadataLockGateIds),
      predictableAddressEnabled: !!predictableAddressEnabled,
      autoAppliedDefaultTags: Array.isArray(autoAppliedDefaultTags) ? autoAppliedDefaultTags : [],
      dismissedDefaultTags: Array.isArray(dismissedDefaultTags) ? dismissedDefaultTags : [],
      numInviteLinks,
      exportFormat,
      create2Salt,
      deferredCreate2Salt,
      _sessionSlug: this.getEffectiveSessionSlug() || ''
    };
  };

  _cacheWriteSeq = 0;
  _memoizedImageDataUrl = null;
  _memoizedImageFileRef = null;

  getScopedFormCacheKey = () => (
    getScopedCreateSbtFormCacheKey(this.getEffectiveSessionSlug())
  );

  persistFormCache = () => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      if (this._suppressFormCachePersistence) {
        ++this._cacheWriteSeq;
        return;
      }
      const payload = this.buildCachePayload();
      const imageFile = this.state.sbtImageFile;
      const scopedCacheKey = this.getScopedFormCacheKey();

      // If image is same file ref, reuse memoized data URL
      if (imageFile && imageFile === this._memoizedImageFileRef && this._memoizedImageDataUrl) {
        payload._imageDataUrl = this._memoizedImageDataUrl;
      }

      const json = JSON.stringify(payload);
      if (json !== this._lastSavedCacheJSON) {
        sessionStorage.setItem(scopedCacheKey, json);
        sessionStorage.removeItem(FORM_CACHE_KEY);
        this._lastSavedCacheJSON = json;
      }

      // Async: serialize new image file (only if file ref changed)
      if (imageFile && imageFile !== this._memoizedImageFileRef) {
        const seq = ++this._cacheWriteSeq;
        this._fileToDataUrl(imageFile).then(dataUrl => {
          if (seq !== this._cacheWriteSeq) return; // stale — discard
          this._memoizedImageDataUrl = dataUrl;
          this._memoizedImageFileRef = imageFile;
          try {
            const freshPayload = this.buildCachePayload();
            freshPayload._imageDataUrl = dataUrl;
            const fullJson = JSON.stringify(freshPayload);
            sessionStorage.setItem(scopedCacheKey, fullJson);
            sessionStorage.removeItem(FORM_CACHE_KEY);
            this._lastSavedCacheJSON = fullJson;
          } catch (e) { sbtLog.warn('CreateSBTGroup: fallback', e); }
        }).catch((e) => { sbtLog.warn('CreateSBTGroup: fallback', e); });
      } else if (!imageFile) {
        ++this._cacheWriteSeq; // Invalidate any in-flight serialization
        this._memoizedImageDataUrl = null;
        this._memoizedImageFileRef = null;
      }
    } catch (e) { sbtLog.warn('CreateSBTGroup: fallback', e); }
  };

  buildSerializableAuthoringPayload = async () => {
    const payload = this.buildCachePayload();
    const imageFile = this.state.sbtImageFile;
    if (!imageFile) return payload;

    if (imageFile === this._memoizedImageFileRef && this._memoizedImageDataUrl) {
      return {
        ...payload,
        _imageDataUrl: this._memoizedImageDataUrl,
      };
    }

    return {
      ...payload,
      _imageDataUrl: await this._fileToDataUrl(imageFile),
    };
  };

  buildRestoredFormStateFromPayload = (parsed = {}) => {
    if (!parsed || typeof parsed !== 'object') return null;

    const { gateOptions } = this.resolveLockGateOptions();
    const validGateIds = (Array.isArray(gateOptions) ? gateOptions : []).map((opt) => opt.id).filter(Boolean);
    const legacyDescriptionAddresses = new Set(
      (Array.isArray(parsed.descriptionGateSBTs) ? parsed.descriptionGateSBTs : [])
        .map((entry) => String(entry?.address || entry || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const legacyDescriptionLockGateIds = legacyDescriptionAddresses.size > 0
      ? (Array.isArray(gateOptions) ? gateOptions : [])
          .filter((gate) => {
            if (!Array.isArray(gate?.sbtAddresses) || gate.sbtAddresses.length !== 1) return false;
            return legacyDescriptionAddresses.has(String(gate.sbtAddresses[0] || '').toLowerCase());
          })
          .map((gate) => gate.id)
          .filter(Boolean)
      : [];
    const cachedMetadataLockGateIds = normalizeMetadataLockGateIds(parsed.metadataLockGateIds);
    const restoredMetadataLockGateIds = normalizeMetadataLockGateIds({
      ...cachedMetadataLockGateIds,
      description: normalizeGateIds(cachedMetadataLockGateIds.description).length > 0
        ? cachedMetadataLockGateIds.description
        : (
          normalizeGateIds(parsed.descriptionLockGateIds).length > 0
            ? parsed.descriptionLockGateIds
            : legacyDescriptionLockGateIds
        ),
      tags: normalizeGateIds(cachedMetadataLockGateIds.tags).length > 0
        ? cachedMetadataLockGateIds.tags
        : parsed.tagsLockGateIds,
      documentURLs: normalizeGateIds(cachedMetadataLockGateIds.documentURLs).length > 0
        ? cachedMetadataLockGateIds.documentURLs
        : parsed.docsLockGateIds,
    });

    const nextDist = {
      ...this.state.sbtDistribution,
      ...(parsed.sbtDistribution || {})
    };
    const cachedNetworkChainId = normalizePositiveChainId(
      parsed?.sbtDistribution?.network?.id ||
      parsed?.sbtDistribution?.network?.chainId ||
      parsed?.sbtDistribution?.network
    );
    const restoredAuthoringChain = this.getAuthoringChainState({ selectedChainId: cachedNetworkChainId });
    nextDist.mintingEndTime = parsed?.sbtDistribution?.mintingEndTime
      ? new Date(parsed.sbtDistribution.mintingEndTime)
      : null;
    nextDist.network = restoredAuthoringChain.chain;

    let restoredTags = [];
    if (Array.isArray(parsed.tags)) {
      restoredTags = parsed.tags;
    } else if (typeof parsed.tags === 'string' && parsed.tags.trim().length > 0) {
      restoredTags = parsed.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    const shouldExpandSections = hasMeaningfulCreateSbtFormPayload({
      ...parsed,
      tags: restoredTags,
      metadataLockGateIds: restoredMetadataLockGateIds,
    });

    return {
      sbtName: parsed.sbtName || '',
      sbtDescription: parsed.sbtDescription || '',
      sbtImageUrl: parsed.sbtImageUrl || '',
      useImageUrl: !!parsed.useImageUrl,
      network: restoredAuthoringChain.chainId || '',
      sbtDistribution: nextDist,
      tags: restoredTags,
      documentIDHashes: parsed.documentIDHashes || '',
      documentURLs: Array.isArray(parsed.documentURLs) ? parsed.documentURLs : [],
      documentUrl: this.getNormalizedDocumentUrlDraft(parsed.documentUrl),
      groupPassword: parsed.groupPassword || '',
      metadataLockGateIds: METADATA_LOCK_FIELDS.reduce((acc, fieldKey) => {
        acc[fieldKey] = this.normalizeSelectedGateIds(restoredMetadataLockGateIds[fieldKey], validGateIds);
        return acc;
      }, createEmptyMetadataLockGateIds()),
      lockedImageAsset: null,
      openLockKey: '',
      autoAppliedDefaultTags: Array.isArray(parsed.autoAppliedDefaultTags) ? parsed.autoAppliedDefaultTags : [],
      dismissedDefaultTags: Array.isArray(parsed.dismissedDefaultTags) ? parsed.dismissedDefaultTags : [],
      numInviteLinks: typeof parsed.numInviteLinks === 'number' ? parsed.numInviteLinks : this.state.numInviteLinks,
      exportFormat: parsed.exportFormat || this.state.exportFormat,
      create2Salt: parsed.create2Salt || '',
      deferredCreate2Salt: (
        typeof parsed.deferredCreate2Salt === 'string' && parsed.deferredCreate2Salt.trim()
      ) ? parsed.deferredCreate2Salt : this.state.deferredCreate2Salt,
      predictableAddressEnabled: typeof parsed.predictableAddressEnabled === 'boolean'
        ? parsed.predictableAddressEnabled
        : this.state.predictableAddressEnabled,
      imageLoadError: false,
      sbtImageFile: parsed._imageDataUrl ? this._dataUrlToBlob(parsed._imageDataUrl) : null,
      tokenInfoCollapsed: false,
      mintOptionsCollapsed: shouldExpandSections ? false : this.state.mintOptionsCollapsed,
      distributionOptionsCollapsed: shouldExpandSections ? false : this.state.distributionOptionsCollapsed,
    };
  };

  applyAuthoringPayload = (parsed = {}) => {
    const nextState = this.buildRestoredFormStateFromPayload(parsed);
    if (!nextState) return false;
    this.setState(nextState, () => {
      this.updateGroupHash();
    });
    return true;
  };

  loadFormCache = () => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return false;
      const scopedCacheKey = this.getScopedFormCacheKey();
      const raw = sessionStorage.getItem(scopedCacheKey) || sessionStorage.getItem(FORM_CACHE_KEY);
      if (!raw) return false;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        // Bad JSON — clear it
        sessionStorage.removeItem(scopedCacheKey);
        sessionStorage.removeItem(FORM_CACHE_KEY);
        return false;
      }
      if (!parsed || typeof parsed !== 'object') return false;
      const cachedSlug = (parsed._sessionSlug || 'general').toLowerCase();
      const currentSlug = (this.getEffectiveSessionSlug() || 'general').toLowerCase();
      if (cachedSlug !== currentSlug) {
        // Session changed — clear stale cache and fall through to defaults
        sessionStorage.removeItem(scopedCacheKey);
        sessionStorage.removeItem(FORM_CACHE_KEY);
        return false;
      }
      try {
        sessionStorage.setItem(scopedCacheKey, raw);
        sessionStorage.removeItem(FORM_CACHE_KEY);
      } catch (e) { sbtLog.warn('CreateSBTGroup: fallback', e); }
      if (!this.applyAuthoringPayload(parsed)) return false;

      // Keep last snapshot so we don't immediately rewrite
      this._lastSavedCacheJSON = raw;
      return true;
    } catch (e) {
      return false;
    }
  };

  clearFormCache = () => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;

      ++this._cacheWriteSeq;
      sessionStorage.removeItem(FORM_CACHE_KEY);
      sessionStorage.removeItem(this.getScopedFormCacheKey());

      this._lastSavedCacheJSON = null;
    } catch (e) { sbtLog.warn('CreateSBTGroup: fallback', e); }
  };

  getEffectiveSessionSlug = () => {
    const slugFromProps = this.props.sessionSlug || this.props.slug || '';
    if (slugFromProps) return slugFromProps;
    if (typeof window === 'undefined') return '';
    const path = window.location.pathname || '';
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'demo' && parts[1]) return parts[1];
    if (parts[0] === 'sbts' && parts[1] && parts[1] !== 'new') return parts[1];
    return '';
  };

  getSessionConfigSources = () => {
    const slug = this.getEffectiveSessionSlug();
    const sessionConfigOverride = isPlainObject(this.props.sessionConfigOverride)
      ? this.props.sessionConfigOverride
      : (isPlainObject(this.props.sessionConfig) ? this.props.sessionConfig : null);
    const resolvedSessionConfig = sessionConfigOverride || getSessionConfigBySlugOrDefault(slug);
    return {
      slug,
      sessionConfigOverride,
      resolvedSessionConfig,
    };
  };

  getAuthoringChainOptions = () => (
    getSessionRegistryChains().filter((chain) => hasUsableSbtFactoryForChain(chain?.id))
  );

  resolveAuthoringChainId = ({ selectedChainId = null, sessionConfigOverride = undefined, resolvedSessionConfig = undefined } = {}) => {
    const sources = (
      sessionConfigOverride === undefined || resolvedSessionConfig === undefined
        ? this.getSessionConfigSources()
        : { sessionConfigOverride, resolvedSessionConfig }
    );
    // Regression guard: authoring follows the form/session chain first and only
    // consults the connected wallet as a last-resort fallback.
    return selectPreferredChainId(
      [
        selectedChainId,
        sources.sessionConfigOverride?.networkChainId,
        sources.resolvedSessionConfig?.networkChainId,
        this.props.network?.id,
        this.props.network?.chainId,
      ],
      this.getAuthoringChainOptions().map((chain) => chain.id)
    );
  };

  getSelectedAuthoringChainId = () => (
    this.resolveAuthoringChainId({ selectedChainId: this.state?.network })
  );

  getSelectedAuthoringChain = () => {
    const selectedChainId = this.getSelectedAuthoringChainId();
    if (!selectedChainId) return null;
    return this.getAuthoringChainOptions().find((chain) => chain.id === selectedChainId) ||
      getChainById(selectedChainId) ||
      { id: selectedChainId, name: `Chain ${selectedChainId}` };
  };

  getAuthoringChainState = ({ selectedChainId = null, sessionConfigOverride = undefined, resolvedSessionConfig = undefined } = {}) => {
    const chainId = this.resolveAuthoringChainId({
      selectedChainId,
      sessionConfigOverride,
      resolvedSessionConfig,
    });
    return {
      chainId,
      chain: chainId
        ? (
            this.getAuthoringChainOptions().find((option) => option.id === chainId) ||
            getChainById(chainId) ||
            { id: chainId, name: `Chain ${chainId}` }
          )
        : 'not connected',
    };
  };

  getSessionConfigForNetwork = () => {
    const { slug, sessionConfigOverride, resolvedSessionConfig } = this.getSessionConfigSources();
    const networkId = this.resolveAuthoringChainId({
      selectedChainId: this.state?.network,
      sessionConfigOverride,
      resolvedSessionConfig,
    });
    if (!resolvedSessionConfig || !Number.isFinite(networkId) || networkId <= 0) {
      // Keep unresolved requested slugs intact so downstream authoring/mint helpers
      // can stay fail-closed instead of silently inheriting the general session.
      return resolvedSessionConfig || slug || '';
    }

    const contracts = buildAuthoringContractRefs({
      sessionConfig: resolvedSessionConfig,
      networkId,
    });

    return {
      ...resolvedSessionConfig,
      networkChainId: networkId,
      sbtFactoryAddress: getConfiguredContractAddress(contracts?.sbtFactory),
      contracts
    };
  };

  getArweaveUploadSessionSlug = () => {
    const sessionConfig = this.getSessionConfigForNetwork();
    return toStr(this.getEffectiveSessionSlug() || sessionConfig?.slug || '').trim();
  };

  getResolvedArweaveUploadWorkerUrl = () => {
    const sessionConfig = this.getSessionConfigForNetwork();
    return normalizeWorkerUrl(toStr(sessionConfig?.corsWorkerUrl).trim());
  };

  getArweaveUploadRequestOptions = () => {
    const sessionConfig = this.getSessionConfigForNetwork();
    const authoringChainId = normalizePositiveChainId(
      sessionConfig?.networkChainId ||
      this.getSelectedAuthoringChainId() ||
      this.props.network?.id ||
      this.props.network?.chainId
    );
    return {
      sessionSlug: toStr(this.getEffectiveSessionSlug() || sessionConfig?.slug || '').trim(),
      sessionConfig,
      context: {
        account: this.props.account,
        providerLike: this.props.provider,
        chainId: authoringChainId,
      },
      skipAuth: this.shouldSkipArweaveWorkerAuth(),
    };
  };

  getEffectiveArweaveUploadKey = async () => {
    const override = toStr(this.props.arweaveJwkOverride).trim();
    if (override) {
      return {
        arweaveJwk: override,
        source: 'override',
        status: 'override',
      };
    }
    return getEffectiveArweaveKey({
      sessionSlug: this.getArweaveUploadSessionSlug(),
      sessionConfig: this.getSessionConfigForNetwork(),
      context: {
        account: this.props.account,
        providerLike: this.props.provider,
        chainId: normalizePositiveChainId(
          this.getSessionConfigForNetwork()?.networkChainId ||
          this.getSelectedAuthoringChainId() ||
          this.props.network?.id ||
          this.props.network?.chainId
        ),
      },
    });
  };

  shouldSkipArweaveWorkerAuth = () => (
    toStr(this.props.arweaveJwkOverride).trim() !== ''
  );

  getArweaveUploadBootstrapAuth = async ({ workerUrl = '' } = {}) => {
    if (!this.shouldSkipArweaveWorkerAuth()) return null;
    if (typeof this.props.signAdminAction !== 'function') {
      throw new Error('Arweave bootstrap signing is unavailable for this draft upload.');
    }
    const sessionConfig = this.getSessionConfigForNetwork();
    const sessionSlug = toStr(this.getEffectiveSessionSlug() || sessionConfig?.slug || '').trim();
    return this.props.signAdminAction({
      statement: 'Admin request: bootstrap arweave upload',
      targetSlug: sessionSlug,
      workerUrl: workerUrl || this.getResolvedArweaveUploadWorkerUrl(),
    });
  };

  buildArweaveUploadRequestOptions = async () => {
    const baseOptions = this.getArweaveUploadRequestOptions();
    if (!this.shouldSkipArweaveWorkerAuth()) return baseOptions;
    const workerUrl = this.getResolvedArweaveUploadWorkerUrl();
    const arweaveJwk = toStr(this.props.arweaveJwkOverride).trim();

    return {
      ...baseOptions,
      // Regression guard: deferred /new publish should still finish when a
      // just-deployed worker cannot serve bootstrap auth yet but the sponsored
      // Arweave JWK is already available in wizard state.
      ...(await resolvePublishArweaveUploadOptions({
        arweaveJwk,
        workerUrl,
        preferDirectArweaveUpload: this.props.preferDirectArweaveUpload === true,
        allowDirectFallbackOnBootstrapFailure: true,
        requireAdminAuthWithoutJwk: false,
        missingAdminAuthMessage: 'Arweave bootstrap signing is unavailable for this draft upload.',
        buildAdminAuth: ({ workerUrl: resolvedWorkerUrl }) => this.getArweaveUploadBootstrapAuth({
          workerUrl: resolvedWorkerUrl,
        }),
      })),
    };
  };

  resolveLockGateOptions = () => {
    const lockGateSessionSources = Array.isArray(this.props.lockGateSessionSources)
      ? this.props.lockGateSessionSources
      : [];
    const sessionConfig = this.getSessionConfigForNetwork();
    const chainIdFallback = this.getSelectedAuthoringChainId() ||
      Number(sessionConfig?.networkChainId || this.props.network?.id || this.props.network?.chainId || 0) ||
      null;
    if (lockGateSessionSources.length > 0) {
      return buildGateOptionsFromSessionSources({
        sessionSources: lockGateSessionSources,
        preferredSessionSlug: this.props.lockGatePreferredSessionSlug || this.getEffectiveSessionSlug(),
        chainIdFallback,
      });
    }
    return buildGateOptionsFromConfig({
      sessionConfig: isPlainObject(sessionConfig) ? sessionConfig : {},
      encryptionGates: Array.isArray(this.props.encryptionGates) ? this.props.encryptionGates : [],
      defaultGateId: this.props.defaultGateId || '',
      chainIdFallback,
    });
  };

  getMetadataEncryptionContextBase = () => {
    const slug = normalizeSessionSlug(this.getEffectiveSessionSlug() || '');
    const hashSuffix = String(this.state.groupHash || '').replace(/^0x/i, '').slice(0, 12);
    if (slug && hashSuffix) return `${slug}:${hashSuffix}`;
    if (hashSuffix) return `group:${hashSuffix}`;
    return slug || 'group';
  };

  getMetadataLockGateIds = (fieldKey = '') => (
    getMetadataFieldLockGateIds(this.state.metadataLockGateIds, fieldKey)
  );

  normalizeSelectedGateIds = (value, validGateIds = []) => {
    const normalized = normalizeGateIds(value);
    if (!Array.isArray(validGateIds) || validGateIds.length === 0) return normalized;
    const validGateSet = new Set(validGateIds);
    return normalized.filter((gateId) => validGateSet.has(gateId));
  };

  setLockGateIds = (fieldKey, nextIds, validGateIds = []) => {
    this.resetFormStateForEdit();
    const normalized = this.normalizeSelectedGateIds(nextIds, validGateIds);
    this.setState((prev) => ({
      metadataLockGateIds: {
        ...normalizeMetadataLockGateIds(prev.metadataLockGateIds),
        [fieldKey]: normalized,
      },
      openLockKey: normalized.length ? prev.openLockKey : '',
    }), () => {
      this.updateGroupHash();
      this.persistFormCache();
    });
  };

  toggleLockPopover = ({
    lockKey,
    fieldKey,
    nextOpen,
    selectedGateIds = [],
    defaultGateId = '',
    validGateIds = [],
  } = {}) => {
    if (!nextOpen) {
      this.setState({ openLockKey: '' });
      return;
    }

    const normalizedSelected = this.normalizeSelectedGateIds(selectedGateIds, validGateIds);
    const fallbackGateIds = this.normalizeSelectedGateIds(defaultGateId ? [defaultGateId] : [], validGateIds);
    if (normalizedSelected.length === 0 && fallbackGateIds.length > 0) {
      this.resetFormStateForEdit();
      this.setState({
        metadataLockGateIds: {
          ...normalizeMetadataLockGateIds(this.state.metadataLockGateIds),
          [fieldKey]: fallbackGateIds,
        },
        openLockKey: lockKey,
      }, () => {
        this.updateGroupHash();
        this.persistFormCache();
      });
      return;
    }

    this.setState({ openLockKey: lockKey });
  };

  buildGateObjectsAndRecipients = (gateIds, gateMap = {}, chainIdFallback = null) => {
    const knownGateIds = this.normalizeSelectedGateIds(gateIds, Object.keys(gateMap || {}));
    const gates = [];
    const recipients = [];
    const dedupe = new Set();

    knownGateIds.forEach((gateId) => {
      const rawGate = gateMap?.[gateId];
      if (!rawGate) return;

      const chainId = Number(rawGate.chainId || chainIdFallback || 0) || chainIdFallback || null;
      const litChain = resolveLitChain({ chainId, litChain: rawGate.litChain });
      const sbtAddresses = normalizeAddressList([
        ...(Array.isArray(rawGate.sbtAddresses) ? rawGate.sbtAddresses : []),
        rawGate.sbtAddress,
      ]);
      if (!sbtAddresses.length) return;

      const mode = normalizeGateMode(rawGate);
      const label = normalizeGateText(rawGate.label || rawGate.name || gateId) || gateId;
      const color = normalizeGateText(rawGate.color) || stableGateColor(gateId);

      gates.push({
        ...rawGate,
        type: rawGate.type || 'sbt',
        gateId,
        id: gateId,
        sbtAddresses,
        sbtAddress: sbtAddresses[0] || '',
        chainId,
        litChain,
        mode,
        label,
        color,
      });

      const accessControlConditions = buildSbtAccessControlConditions({
        sbtAddresses,
        chainId,
        litChain,
        mode,
      });
      if (!accessControlConditions) return;

      const recipient = { accessControlConditions, chain: litChain };
      const sig = JSON.stringify({ accessControlConditions, chain: litChain });
      if (dedupe.has(sig)) return;
      dedupe.add(sig);
      recipients.push(recipient);
    });

    return { gates, recipients };
  };

  requireRecipientsForGateSelection = ({ gateIds, recipients, scopeLabel } = {}) => {
    const selectedGateIds = normalizeGateIds(gateIds);
    if (!selectedGateIds.length) return;
    if (Array.isArray(recipients) && recipients.length > 0) return;
    throw new Error(
      `Selected lock ${selectedGateIds.length === 1 ? t('gateLower') : t('gatesLower')} (${selectedGateIds.join(', ')}) for ${scopeLabel || 'content'} do not resolve to valid Lit recipients.`,
    );
  };

  encryptValueWithRecipients = async ({
    value,
    maskedValue,
    contextLabel,
    recipients,
    chainIdFallback = null,
  } = {}) => {
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) return { value, encrypted: null };

    const litHooks = getGlobalLitHooks();
    if (!litHooks || typeof litHooks.saveKey !== 'function') {
      throw new Error(`Lit hooks not initialized; connect a ${t('walletLower')} to encrypt.`);
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error(`Selected ${t('gateLower')} does not provide any Lit recipients.`);
    }

    const combinedAccessControlConditions = [];
    recipients.forEach((recipient) => {
      const conditions = recipient?.accessControlConditions;
      if (!Array.isArray(conditions) || conditions.length === 0) return;
      if (combinedAccessControlConditions.length > 0) {
        combinedAccessControlConditions.push({ operator: 'or' });
      }
      combinedAccessControlConditions.push(...conditions);
    });

    const envelope = await cryptoUtils.encryptEnvelopeValue(value, {
      providerLike: this.props.provider,
      account: this.props.account,
      chainId: chainIdFallback,
      contextLabel,
      lit: {
        saveKey: litHooks.saveKey,
        accessControlConditions: combinedAccessControlConditions.length
          ? combinedAccessControlConditions
          : recipients[0]?.accessControlConditions,
        chain: recipients[0]?.chain || null,
        recipients,
      },
    });

    return { value: maskedValue, encrypted: envelope };
  };

  buildEncryptedImageAsset = ({ uploadResult = {} } = {}) => {
    const txId = normalizeGateText(uploadResult?.txId || '');
    if (!txId) return null;
    return {
      storage: 'lit-arweave',
      txId,
    };
  };

  buildPreviewEncryptedImageAsset = () => ({
    storage: 'lit-arweave',
    txId: LOCKED_FIELD_MASK,
  });

  buildFieldAccessDescriptor = ({
    gateIds = [],
    gateMap = {},
    chainIdFallback = null,
  } = {}) => {
    const selectedGateIds = this.normalizeSelectedGateIds(gateIds, Object.keys(gateMap || {}));
    if (!selectedGateIds.length) return null;

    const gates = selectedGateIds
      .map((gateId) => sanitizeGateForMetadata(gateMap?.[gateId], chainIdFallback))
      .filter(Boolean);
    if (!gates.length) return null;

    const sbtAddresses = normalizeAddressList(
      gates.flatMap((gate) => (Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []))
    );
    const primaryGate = gates[0] || null;
    const resolvedChainId = Number(primaryGate?.chainId || chainIdFallback || 0) || chainIdFallback || null;

    return {
      type: 'sbt',
      gateIds: selectedGateIds,
      gates,
      sbtAddresses,
      sbtAddress: sbtAddresses[0] || '',
      chainId: resolvedChainId,
      litChain: primaryGate?.litChain || resolveLitChain({ chainId: resolvedChainId }),
    };
  };

  buildMetadataEncryption = ({
    encryptedFieldGates = {},
    gateMap = {},
    chainIdFallback = null,
    defaultGateId = '',
  } = {}) => {
    const normalizedFieldGates = {};
    const metadataGateMap = {};
    const targets = {};

    Object.entries(encryptedFieldGates || {}).forEach(([fieldKey, rawGateIds]) => {
      const selectedGateIds = this.normalizeSelectedGateIds(rawGateIds, Object.keys(gateMap || {}));
      if (!selectedGateIds.length) return;

      normalizedFieldGates[fieldKey] = selectedGateIds.length === 1
        ? selectedGateIds[0]
        : selectedGateIds;
      targets[fieldKey] = true;

      selectedGateIds.forEach((gateId) => {
        const sanitized = sanitizeGateForMetadata(gateMap?.[gateId], chainIdFallback);
        if (!sanitized) return;
        metadataGateMap[gateId] = sanitized;
      });
    });

    const gates = Object.values(metadataGateMap);
    const gateIds = gates.map((gate) => gate.gateId).filter(Boolean);
    const resolvedDefaultGateId = normalizeGateText(defaultGateId);
    return {
      encryptedFieldGates: Object.keys(normalizedFieldGates).length
        ? normalizedFieldGates
        : null,
      encryption: gates.length > 0 && Object.keys(targets).length > 0
        ? {
            enabled: true,
            status: 'lit-v1',
            defaultGateId: gateIds.includes(resolvedDefaultGateId) ? resolvedDefaultGateId : (gateIds[0] || ''),
            gateIds,
            gate: gates[0] || null,
            gates,
            targets,
          }
        : null,
    };
  };

  componentDidMount() {
    this._isMounted = true;
    this.loadFormCache();
    this.loadBookmarks();
    this.schedulePredictedAddressRefresh();
  }

  componentDidUpdate(prevProps, prevState) {
    const authoringContextChanged =
      this.props.network !== prevProps.network ||
      this.props.sessionConfigOverride !== prevProps.sessionConfigOverride ||
      this.props.sessionConfig !== prevProps.sessionConfig ||
      this.props.sessionSlug !== prevProps.sessionSlug ||
      this.props.slug !== prevProps.slug;
    const lockAudienceChanged =
      authoringContextChanged ||
      prevState.network !== this.state.network ||
      prevState.sbtDistribution?.network !== this.state.sbtDistribution?.network ||
      this.props.encryptionGates !== prevProps.encryptionGates ||
      this.props.defaultGateId !== prevProps.defaultGateId ||
      this.props.lockGateSessionSources !== prevProps.lockGateSessionSources ||
      this.props.lockGatePreferredSessionSlug !== prevProps.lockGatePreferredSessionSlug;
    if (authoringContextChanged) {
      const syncedChain = this.getAuthoringChainState({ selectedChainId: this.state.network });
      const currentDistributionNetwork = this.state.sbtDistribution?.network;
      const currentDistributionChainId = normalizePositiveChainId(
        currentDistributionNetwork?.id ||
        currentDistributionNetwork?.chainId ||
        currentDistributionNetwork
      );
      if (
        (this.state.network || '') !== (syncedChain.chainId || '') ||
        currentDistributionChainId !== syncedChain.chainId ||
        currentDistributionNetwork?.name !== syncedChain.chain?.name
      ) {
        this.setState((currentState) => ({
          network: syncedChain.chainId || '',
          sbtDistribution: {
            ...currentState.sbtDistribution,
            network: syncedChain.chain,
          },
        }));
        return;
      }
    }
    if (lockAudienceChanged) {
      const validGateIds = Object.keys(this.resolveLockGateOptions().gateMap || {});
      const normalizedLocks = normalizeMetadataLockGateIds(this.state.metadataLockGateIds);
      const scrubbedLocks = METADATA_LOCK_FIELDS.reduce((acc, fieldKey) => {
        acc[fieldKey] = this.normalizeSelectedGateIds(normalizedLocks[fieldKey], validGateIds);
        return acc;
      }, createEmptyMetadataLockGateIds());
      if (!areMetadataLockGateMapsEqual(normalizedLocks, scrubbedLocks)) {
        this.setState({ metadataLockGateIds: scrubbedLocks });
        return;
      }
    }
    const prevAccountAddress = normalizeComparableAddress(prevProps.account);
    const nextAccountAddress = normalizeComparableAddress(this.props.account);
    if (prevAccountAddress !== nextAccountAddress) {
      const currentBurnAdmin = toStr(this.state.sbtDistribution?.burnAdmin).trim();
      const currentAdminAddress = toStr(this.state.sbtDistribution?.adminAddress).trim();
      const shouldSyncBurnAdmin = !currentBurnAdmin || normalizeComparableAddress(currentBurnAdmin) === prevAccountAddress;
      const shouldSyncAdminAddress = !currentAdminAddress || normalizeComparableAddress(currentAdminAddress) === prevAccountAddress;

      if (shouldSyncBurnAdmin || shouldSyncAdminAddress) {
        const nextAccount = toStr(this.props.account).trim();
        this.setState((currentState) => ({
          sbtDistribution: {
            ...currentState.sbtDistribution,
            ...(shouldSyncBurnAdmin ? { burnAdmin: nextAccount } : {}),
            ...(shouldSyncAdminAddress ? { adminAddress: nextAccount } : {}),
          },
        }));
        return;
      }
    }
    if (prevProps.defaultSbtTags !== this.props.defaultSbtTags) {
      this.syncRelevantDefaultTags({ replaceAutoApplied: true, resetDismissed: true });
    }

    if (
      this.state.sbtName !== prevState.sbtName ||
      this.state.sbtDescription !== prevState.sbtDescription
    ) {
      this.syncRelevantDefaultTags();
    }

    if (
      this.state.sbtDistribution.isLimited !== prevState.sbtDistribution.isLimited ||
      this.state.sbtDistribution.limitedNumber !== prevState.sbtDistribution.limitedNumber
    ) {
      this.updateNumInviteLinks();
    }
    if (this.maybeClearAutoPredictableAddressForGroupPasswordExit(prevState)) {
      return;
    }
    if (this.maybeAutoEnablePredictableAddressForGroupPassword(prevState)) {
      return;
    }

    // Log when error message changes
    if (this.state.error && this.state.error !== prevState.error) {
      sbtLog.error('[CreateSBTGroup] Error:', this.state.error);
    }

    // Ensure any missed changes still get cached (no-op if unchanged)
    this.persistFormCache();

    const predictiveInputsChanged =
      prevState.sbtName !== this.state.sbtName ||
      prevState.create2Salt !== this.state.create2Salt ||
      prevState.deferredCreate2Salt !== this.state.deferredCreate2Salt ||
      prevState.predictableAddressEnabled !== this.state.predictableAddressEnabled ||
      prevState.groupHash !== this.state.groupHash ||
      prevState.groupPassword !== this.state.groupPassword ||
      prevState.numInviteLinks !== this.state.numInviteLinks ||
      prevState.passwordList !== this.state.passwordList ||
      prevState.metadataLockGateIds !== this.state.metadataLockGateIds ||
      prevState.sbtDistribution !== this.state.sbtDistribution ||
      prevProps.account !== this.props.account ||
      prevProps.network !== this.props.network ||
      prevProps.provider !== this.props.provider ||
      prevProps.deferredDeploy !== this.props.deferredDeploy;
    if (predictiveInputsChanged) {
      this.schedulePredictedAddressRefresh();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.clearCountdownTimer();
    this.clearTrackedTimeouts();
    this.clearPredictAddressTimer();
  }

  clearCountdownTimer = () => {
    if (!this.countdownTimer) return;
    clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  };

  scheduleTrackedStateReset = (timerKey, nextState, delayMs) => {
    if (!timerKey) return;
    const existing = this._trackedTimeouts.get(timerKey);
    if (existing) {
      clearTimeout(existing);
      this._trackedTimeouts.delete(timerKey);
    }
    const timeoutId = setTimeout(() => {
      if (this._trackedTimeouts.get(timerKey) === timeoutId) {
        this._trackedTimeouts.delete(timerKey);
      }
      if (!this._isMounted) return;
      this.setState(nextState);
    }, Math.max(0, Number(delayMs) || 0));
    this._trackedTimeouts.set(timerKey, timeoutId);
  };

  clearTrackedTimeouts = () => {
    if (!this._trackedTimeouts || this._trackedTimeouts.size === 0) return;
    this._trackedTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this._trackedTimeouts.clear();
  };

  clearPredictAddressTimer = () => {
    if (!this.predictAddressTimer) return;
    clearTimeout(this.predictAddressTimer);
    this.predictAddressTimer = null;
  };

  setStateAsync = (update) => new Promise((resolve) => this.setState(update, resolve));

  isDeferredDeployMode = () => !!this.props.deferredDeploy;

  isPredictableAddressEnabled = () => (
    this.isDeferredDeployMode() ||
    !!this.state.predictableAddressEnabled ||
    !!String(this.state.create2Salt || '').trim()
  );

  maybeClearAutoPredictableAddressForGroupPasswordExit = (prevState) => {
    const prevDistributionOption = prevState?.sbtDistribution?.distributionOption;
    const nextDistributionOption = this.state.sbtDistribution?.distributionOption;
    if (
      prevDistributionOption !== 'groupPassword' ||
      nextDistributionOption === 'groupPassword' ||
      !this._autoCreate2SaltForGroupPassword
    ) {
      return false;
    }

    this._autoCreate2SaltForGroupPassword = false;
    this.setState(
      {
        create2Salt: '',
        predictableAddressEnabled: false,
      },
      this.persistFormCache
    );
    return true;
  };

  maybeAutoEnablePredictableAddressForGroupPassword = (prevState) => {
    const prevDistributionOption = prevState?.sbtDistribution?.distributionOption;
    const nextDistributionOption = this.state.sbtDistribution?.distributionOption;
    if (
      nextDistributionOption !== 'groupPassword' ||
      prevDistributionOption === 'groupPassword' ||
      this.isDeferredDeployMode() ||
      this.isPredictableAddressEnabled()
    ) {
      return false;
    }

    const autoSalt = this.buildAutoCreate2SaltSource();
    if (!autoSalt) return false;

    // Group-password hashes must stay scoped to the deterministic SBT address.
    this._autoCreate2SaltForGroupPassword = true;
    this.setState(
      {
        create2Salt: autoSalt,
        predictableAddressEnabled: true,
      },
      this.persistFormCache
    );
    return true;
  };

  shouldHideNetworkSelector = () => (
    !!this.props.hideNetworkSelector || this.isDeferredDeployMode()
  );

  buildAutoCreate2SaltSource = () => {
    const sessionSlug = normalizeSessionSlug(this.getEffectiveSessionSlug() || '') || 'general';
    const rawName = String(this.state.sbtName || '').trim().toLowerCase();
    const nameSlug = rawName
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    if (nameSlug) return `${sessionSlug}/${nameSlug}`;
    const hashSuffix = String(this.state.groupHash || '').replace(/^0x/i, '').slice(0, 10) || 'draft';
    return `${sessionSlug}/group-${hashSuffix}`;
  };

  getAutoCreate2SaltSource = () => {
    if (this.isDeferredDeployMode()) {
      return String(this.state.deferredCreate2Salt || '').trim() || this.buildAutoCreate2SaltSource();
    }
    return this.buildAutoCreate2SaltSource();
  };

  getResolvedCreate2SaltSource = () => {
    const manual = String(this.state.create2Salt || '').trim();
    if (manual) return manual;
    return this.getAutoCreate2SaltSource();
  };

  buildDeterministicSbtSymbol = (saltSource = '') => {
    const digest = ethers.utils.id(String(saltSource || 'context-engine-sbt'));
    return `CE-SBT-${digest.slice(2, 8).toUpperCase()}`;
  };

  ensurePredictablePasswordList = ({ usesClaimCodes, targetCount, allowStateMutation = true } = {}) => {
    if (!usesClaimCodes) return [];
    const desiredCount = Math.max(0, Math.floor(Number(targetCount || 0) || 0));
    const current = Array.isArray(this.state.passwordList)
      ? this.state.passwordList.filter((entry) => String(entry || '').trim())
      : [];
    if (desiredCount > 0 && current.length === desiredCount) return current;
    const next = Array.from({ length: desiredCount }, () => this.generateRandomString(32));
    if (allowStateMutation) {
      this.setState({ passwordList: next });
    }
    return null;
  };

  buildPredictableDeployShape = ({ allowStateMutation = true } = {}) => {
    if (!this.isPredictableAddressEnabled()) return null;

    const {
      sbtName,
      sbtDistribution,
      numInviteLinks,
      groupPassword: rawGroupPassword,
      metadataLockGateIds,
    } = this.state;
    const sbtNameTrimmed = String(sbtName || '').trim();
    if (!sbtNameTrimmed) {
      return { unavailableReason: 'Enter a group name to preview the address.' };
    }

    const {
      isLimited,
      limitedNumber,
      burnAdmin,
      isTimeLimited,
      burnAuth,
      distributionOption,
      mintingEndTime,
    } = sbtDistribution || {};
    const adminAddress = String(burnAdmin || this.props.account || '').trim();
    if (!adminAddress) {
      return { unavailableReason: `Connect a ${t('walletLower')} to preview the address.` };
    }

    const usesClaimCodes = distributionOption === 'hasPasswords';
    const usesInviteCodes = distributionOption === 'groupPassword' && !!isLimited;
    const hasPasswordMintOnChain = usesClaimCodes || usesInviteCodes;
    const limitedCountRaw = isLimited ? Number(limitedNumber) : 0;
    const limitedCount = Number.isFinite(limitedCountRaw) ? Math.floor(limitedCountRaw) : 0;
    if (isLimited && limitedCount <= 0) {
      return { unavailableReason: 'Set a positive mint limit to preview the address.' };
    }

    const targetPasswordCount = usesClaimCodes
      ? (isLimited && limitedCount > 0 ? limitedCount : Math.max(1, Number(numInviteLinks || 0) || 0))
      : 0;
    const passwordList = this.ensurePredictablePasswordList({
      usesClaimCodes,
      targetCount: targetPasswordCount,
      allowStateMutation,
    });
    if (usesClaimCodes && passwordList === null) {
      return {
        unavailableReason: 'Generating invite codes…',
        pendingStateUpdate: allowStateMutation,
      };
    }

    const create2Salt = this.getResolvedCreate2SaltSource();
    const symbol = this.buildDeterministicSbtSymbol(create2Salt);
    const nameLocked = getMetadataFieldLockGateIds(metadataLockGateIds, 'name').length > 0;
    const contractName = nameLocked ? symbol : sbtNameTrimmed;
    const burnAuthEnum = this.getBurnAuthEnum(burnAuth);
    const hashedPasswords = usesClaimCodes
      ? passwordList.map((password) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)))
      : [];
    const groupPassword = cryptoUtils.normalizeGroupPasswordInput(rawGroupPassword);
    if (distributionOption === 'groupPassword' && !groupPassword) {
      return { unavailableReason: 'Enter a group password to preview the address.' };
    }

    return {
      contractName,
      displayName: sbtNameTrimmed,
      symbol,
      limitedNumber: isLimited ? limitedCount : 0,
      adminAddress,
      mintingEndTimeUnix: (isTimeLimited && mintingEndTime)
        ? Math.floor(new Date(mintingEndTime).getTime() / 1000)
        : 0,
      hasPasswordMintOnChain,
      burnAuthEnum,
      hashedPasswords,
      passwordList: Array.isArray(passwordList) ? passwordList : [],
      distributionOption,
      groupPassword,
      create2Salt,
      initializeGroupPasswordHash: distributionOption === 'groupPassword',
      usesClaimCodes,
      usesInviteCodes,
      groupCfg: this.getSessionConfigForNetwork(),
    };
  };

  getPredictedAddressDisplayText = () => {
    const predictedAddress = String(this.state.predictedAddress || '').trim();
    if (predictedAddress) return predictedAddress;

    if (this.state.predictedAddressBusy) {
      return 'Pending…';
    }

    const predictionShape = this.buildPredictableDeployShape({ allowStateMutation: false });
    const unavailableReason = String(predictionShape?.unavailableReason || '').trim();
    if (unavailableReason === 'Enter a group name to preview the address.') {
      return 'Pending group name…';
    }
    if (unavailableReason === `Connect a ${t('walletLower')} to preview the address.`) {
      return 'Pending admin account…';
    }

    return 'Pending…';
  };

  buildPredictableDeploySignature = (predictionShape) => {
    if (!predictionShape || typeof predictionShape !== 'object') return '';
    const groupCfg = predictionShape.groupCfg && typeof predictionShape.groupCfg === 'object'
      ? predictionShape.groupCfg
      : {};
    const sbtFactoryAddress = String(
      groupCfg?.contracts?.sbtFactory?.address ||
      groupCfg?.sbtFactoryAddress ||
      ''
    ).trim().toLowerCase();
    const networkChainId = Number(
      groupCfg?.networkChainId ||
      groupCfg?.contracts?.sbtFactory?.chainId ||
      this.getSelectedAuthoringChainId() ||
      this.props.network?.id ||
      this.props.network?.chainId ||
      0
    ) || 0;

    return JSON.stringify({
      contractName: String(predictionShape.contractName || '').trim(),
      symbol: String(predictionShape.symbol || '').trim(),
      limitedNumber: Number(predictionShape.limitedNumber || 0) || 0,
      adminAddress: String(predictionShape.adminAddress || '').trim().toLowerCase(),
      mintingEndTimeUnix: Number(predictionShape.mintingEndTimeUnix || 0) || 0,
      hasPasswordMintOnChain: predictionShape.hasPasswordMintOnChain === true,
      burnAuthEnum: Number(predictionShape.burnAuthEnum || 0) || 0,
      hashedPasswords: Array.isArray(predictionShape.hashedPasswords) ? predictionShape.hashedPasswords : [],
      create2Salt: String(predictionShape.create2Salt || '').trim(),
      initializeGroupPasswordHash: predictionShape.initializeGroupPasswordHash === true,
      sbtFactoryAddress,
      networkChainId,
    });
  };

  resolvePredictedAddressForShape = async (predictionShape, { allowCached = true } = {}) => {
    const predictionSignature = this.buildPredictableDeploySignature(predictionShape);
    const cachedPredictedAddress = allowCached &&
      predictionSignature &&
      predictionSignature === this._predictedAddressShapeSignature
      ? String(this.state.predictedAddress || '').trim()
      : '';

    if (cachedPredictedAddress) {
      return {
        predictedAddress: cachedPredictedAddress,
        predictionSignature,
      };
    }

    const predictedAddress = await contractScripts.predictSBTAddress(
      this.props.provider || 'none',
      predictionShape.contractName,
      predictionShape.symbol,
      predictionShape.limitedNumber,
      predictionShape.adminAddress,
      predictionShape.mintingEndTimeUnix,
      predictionShape.hasPasswordMintOnChain,
      predictionShape.burnAuthEnum,
      predictionShape.hashedPasswords,
      '',
      ethers.constants.HashZero,
      predictionShape.groupCfg,
      predictionShape.create2Salt,
      {
        useConfiguredDeterministic: true,
        initializeGroupPasswordHash: predictionShape.initializeGroupPasswordHash,
      }
    );

    return {
      predictedAddress: String(predictedAddress || '').trim(),
      predictionSignature,
    };
  };

  refreshPredictedAddress = async ({ requestSeq = null } = {}) => {
    const activeRequestSeq = requestSeq == null
      ? (this._predictAddressRequestSeq += 1)
      : requestSeq;
    const predictionShape = this.buildPredictableDeployShape();
    if (!predictionShape) {
      if (activeRequestSeq !== this._predictAddressRequestSeq) return;
      this._predictedAddressShapeSignature = '';
      this.setState({
        predictedAddress: '',
        predictedAddressStatus: '',
        predictedAddressBusy: false,
      });
      return;
    }
    if (predictionShape.pendingStateUpdate) return;
    if (predictionShape.unavailableReason) {
      if (activeRequestSeq !== this._predictAddressRequestSeq) return;
      this._predictedAddressShapeSignature = '';
      this.setState({
        predictedAddress: '',
        predictedAddressStatus: predictionShape.unavailableReason,
        predictedAddressBusy: false,
      });
      return;
    }

    this.setState({ predictedAddressBusy: true, predictedAddressStatus: 'Calculating address…' });
    try {
      const { predictedAddress, predictionSignature } = await this.resolvePredictedAddressForShape(
        predictionShape,
        { allowCached: false }
      );
      if (activeRequestSeq !== this._predictAddressRequestSeq || !this._isMounted) return;
      // Regression guard: older async predictions can resolve after later edits.
      // Only the latest request may publish a preview as authoritative.
      this._predictedAddressShapeSignature = predictionSignature;
      this.setState({
        predictedAddress,
        predictedAddressStatus: predictedAddress ? '' : `No ${t('sbt')} factory configured for this session.`,
        predictedAddressBusy: false,
      });
    } catch (error) {
      if (activeRequestSeq !== this._predictAddressRequestSeq || !this._isMounted) return;
      this._predictedAddressShapeSignature = '';
      this.setState({
        predictedAddress: '',
        predictedAddressStatus: error?.message || 'Unable to calculate the predicted address.',
        predictedAddressBusy: false,
      });
    }
  };

  schedulePredictedAddressRefresh = () => {
    this.clearPredictAddressTimer();
    this._predictedAddressShapeSignature = '';
    if (!this.isPredictableAddressEnabled()) {
      this._predictAddressRequestSeq += 1;
      this.setState({
        predictedAddress: '',
        predictedAddressStatus: '',
        predictedAddressBusy: false,
      });
      return;
    }
    const requestSeq = ++this._predictAddressRequestSeq;
    this.predictAddressTimer = setTimeout(() => {
      this.predictAddressTimer = null;
      void this.refreshPredictedAddress({ requestSeq });
    }, 250);
  };

  /* =========================
   * UX / State Helpers
   * ========================= */

  getBookmarksSlug = () => (this.props.sessionSlug == null ? '' : this.props.sessionSlug);

  loadBookmarks = () => {
    try {
      const parsed = peekCacheSync('bookmarksCache', this.getBookmarksSlug(), { clone: false }) || { sbts: [] };
      // Handle legacy cache structure or missing keys
      const list = Array.isArray(parsed.sbts) ? parsed.sbts : [];
      const s = new Set(list.map(x => String(x).toLowerCase()));
      this.setState({ bookmarkedSbtsSet: s });
    } catch {
      this.setState({ bookmarkedSbtsSet: new Set() });
    }
  };

  bookmarkSBT = (sbtAddress) => {
    if (!sbtAddress) return;
    let bookmarksCache;
    try {
      const parsed = peekCacheSync('bookmarksCache', this.getBookmarksSlug(), { clone: false });
      bookmarksCache = (parsed && typeof parsed === 'object')
        ? {
            ...parsed,
            sbts: Array.isArray(parsed.sbts) ? [...parsed.sbts] : [],
          }
        : {};
    } catch {
      bookmarksCache = {};
    }

    if (!Array.isArray(bookmarksCache.sbts)) bookmarksCache.sbts = [];

    const idL = String(sbtAddress).toLowerCase();
    const set = new Set(this.state.bookmarkedSbtsSet);

    if (set.has(idL)) {
      set.delete(idL);
      bookmarksCache.sbts = bookmarksCache.sbts.filter(x => String(x).toLowerCase() !== idL);
    } else {
      set.add(idL);
      bookmarksCache.sbts = Array.from(new Set([...bookmarksCache.sbts, idL]));
    }

    void writeCache('bookmarksCache', this.getBookmarksSlug(), bookmarksCache);
    this.setState({ bookmarkedSbtsSet: set });
  };

  // Helper to parse default tags from props
  getDefaultTags = () => {
    if (typeof this.props.defaultSbtTags === 'string' && this.props.defaultSbtTags.trim().length > 0) {
      return this.props.defaultSbtTags.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  };

  getRelevantDefaultTags = () => (
    getRelevantDefaultTags(
      [this.state.sbtName, this.state.sbtDescription],
      this.getDefaultTags()
    )
  );

  buildUniqueTags = (rawTags = []) => {
    const out = [];
    const seen = new Set();
    (Array.isArray(rawTags) ? rawTags : []).forEach((raw) => {
      const trimmed = String(raw ?? '').trim();
      const normalized = trimmed.toLowerCase();
      if (!trimmed || seen.has(normalized)) return;
      seen.add(normalized);
      out.push(trimmed);
    });
    return out;
  };

  syncRelevantDefaultTags = ({ resetDismissed = false } = {}) => {
    const relevantDefaults = this.getRelevantDefaultTags();
    const prevAutoLower = new Set(normalizeTagList(this.state.autoAppliedDefaultTags || []));
    const nextDismissed = resetDismissed ? [] : (this.state.dismissedDefaultTags || []);
    const dismissedLower = new Set(normalizeTagList(nextDismissed));
    const currentTags = Array.isArray(this.state.tags) ? this.state.tags : [];
    const baseTags = currentTags.filter(
      (tag) => !prevAutoLower.has(String(tag || '').trim().toLowerCase())
    );
    const nextTags = this.buildUniqueTags(baseTags);
    const currentTagLower = new Set(normalizeTagList(nextTags));
    const nextAuto = [];
    const nextAutoLower = new Set();

    relevantDefaults.forEach((tag) => {
      const lower = String(tag || '').trim().toLowerCase();
      if (!lower || dismissedLower.has(lower) || nextAutoLower.has(lower)) return;
      if (currentTagLower.has(lower)) return;
      currentTagLower.add(lower);
      nextAuto.push(tag);
      nextAutoLower.add(lower);
      nextTags.push(tag);
    });

    const currentTagsNormalized = normalizeTagList(currentTags);
    const nextTagsNormalized = normalizeTagList(nextTags);
    const currentAutoNormalized = normalizeTagList(this.state.autoAppliedDefaultTags || []);
    const nextAutoNormalized = normalizeTagList(nextAuto);
    const dismissedNormalized = normalizeTagList(nextDismissed);
    const currentDismissedNormalized = normalizeTagList(this.state.dismissedDefaultTags || []);
    const tagsUnchanged = (
      currentTagsNormalized.length === nextTagsNormalized.length &&
      currentTagsNormalized.every((tag, index) => tag === nextTagsNormalized[index])
    );
    const autoUnchanged = (
      currentAutoNormalized.length === nextAutoNormalized.length &&
      currentAutoNormalized.every((tag, index) => tag === nextAutoNormalized[index])
    );
    const dismissedUnchanged = (
      currentDismissedNormalized.length === dismissedNormalized.length &&
      currentDismissedNormalized.every((tag, index) => tag === dismissedNormalized[index])
    );
    const showTagsInput = nextTags.length > 0;

    if (
      tagsUnchanged &&
      autoUnchanged &&
      dismissedUnchanged &&
      this.state.showTagsInput === showTagsInput
    ) {
      return;
    }

    this.setState({
      tags: nextTags,
      autoAppliedDefaultTags: nextAuto,
      dismissedDefaultTags: nextDismissed,
      showTagsInput,
    });
  };

  resetForm = () => {
    const nextAuthoringChain = this.getAuthoringChainState();
    this.resumeFormCachePersistence();
    this.clearFormCache();
    this._autoCreate2SaltForGroupPassword = false;

    this.setState({
      sbtName: '',
      sbtDescription: '',
      sbtImageFile: null,
      sbtImageUrl: '',
      useImageUrl: false,
      sbtDistribution: {
        isLimited: false,
        limitedNumber: 0,
        hasAdmin: false,
        adminAddress: this.props.account || '',
        isRevocable: false,
        isTimeLimited: false,
        mintingEndTime: null,
        distributionOption: 'anyoneCanMint',
        burnAuth: 'AdminOnly',
        burnAdmin: this.props.account || '',
        network: nextAuthoringChain.chain,
        unlisted: false,
      },
      tags: [],
      currentTagInput: '',
      autoAppliedDefaultTags: [],
      dismissedDefaultTags: [],
      documentURLs: [],
      documentUrl: '',
      groupPassword: '',
      openLockKey: '',
      metadataLockGateIds: createEmptyMetadataLockGateIds(),
      lockedImageAsset: null,
      create2Salt: '',
      deferredCreate2Salt: this.props.deferredDeploy ? buildDeferredDraftCreate2Salt() : '',
      predictableAddressEnabled: !!this.props.deferredDeploy,
      predictedAddress: '',
      predictedAddressStatus: '',
      predictedAddressBusy: false,
      sbtMinted: false,
      sbtAddress: '',
      currentStep: 0,
      startedMinting: false,
      mintingFailed: false,
      error: '',
      network: nextAuthoringChain.chainId || '',
      imageUploaded: false,
      tokenUriUploaded: false,
      tokenURI: '',
      showJson: false,
      showTagsInput: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    }, () => {
      this.updateGroupHash();
    });
  };

  resetFormStateForEdit = () => {
    this.resumeFormCachePersistence();
    if (this.state.sbtMinted) {
      this.setState({
        sbtMinted: false,
        sbtAddress: '',
        currentStep: 0,
        startedMinting: false,
        mintingFailed: false,
        error: '',
        // We keep imageUploaded/tokenUriUploaded true to avoid re-uploading if they haven't changed,
        // but if the user edits the form, they likely need to re-upload metadata.
        // For safety, we force a re-flow:
        imageUploaded: false,
        tokenUriUploaded: false
      });
    }
  };

  toggleShowJson = () => {
    this.setState(prev => ({ showJson: !prev.showJson }));
  };

  buildSessionAutoJoinUrl = (sbtAddressOverride = null) => {
    const sbtAddress = String(sbtAddressOverride || this.state?.sbtAddress || '').trim();
    const origin = (typeof window !== 'undefined' && window.location?.origin)
      ? String(window.location.origin).replace(/\/+$/, '')
      : '';
    if (!origin || !sbtAddress) return '';
    const basePath = readPublicUrlBasePath();
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug(), basePath);
    return `${origin}${demoPath}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`;
  };

  buildSbtPagePath = (sbtAddressOverride = null) => (
    buildSbtDetailPath(
      String(sbtAddressOverride || this.state?.sbtAddress || '').trim(),
      this.getEffectiveSessionSlug()
    )
  );

  copySbtLinkToClipboard = () => {
    const { shareableUrl } = this.state;
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl).then(() => {
      notify.success('Copied to clipboard');
      if (!this._isMounted) return;
      this.setState({ copyLinkSuccess: true });
      this.scheduleTrackedStateReset('copyLinkSuccess', { copyLinkSuccess: false }, 2000);
    });
  };

  copySbtIdToClipboard = () => {
    const { sbtAddress } = this.state;
    if (!sbtAddress) return;
    navigator.clipboard.writeText(sbtAddress).then(() => {
      notify.success('Copied to clipboard');
      if (!this._isMounted) return;
      this.setState({ copyIdSuccess: true });
      this.scheduleTrackedStateReset('copyIdSuccess', { copyIdSuccess: false }, 2000);
    });
  };

  copyJsonPreview = (jsonData) => {
    try {
      const str = JSON.stringify(jsonData, null, 2);
      navigator.clipboard.writeText(str).then(() => {
        notify.success('Copied to clipboard');
        if (!this._isMounted) return;
        this.setState({ copyJsonSuccess: true });
        this.scheduleTrackedStateReset('copyJsonSuccess', { copyJsonSuccess: false }, 1500);
      });
    } catch (e) { void e; notify.warn('Copy failed'); }
  };

  handleInputChange = (event) => {
    this.resetFormStateForEdit();
    const target = event.target;
    let value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    // Special handling for tags is done via separate handlers, ignore here if accidentally caught
    if (name === 'tags') return;
    if (name === 'groupPassword' && typeof value === 'string') {
      value = value.replace(/\s+/g, '');
    }

    if (name.startsWith('sbtDistribution.')) {
      const key = name.split('.')[1];
      this.setState(
        (prevState) => {
          const nextDist = { ...prevState.sbtDistribution, [key]: value };

          const updates = { sbtDistribution: nextDist };
          return updates;
        },
        () => { this.updateGroupHash(); this.persistFormCache(); }
      );
    } else {
      this.setState({
        [name]: value,
        ...(name === 'sbtImageUrl' ? { lockedImageAsset: null } : {}),
        ...(name === 'sbtImageUrl'
          ? { imageChooserStatusText: '', imageChooserStatusTone: 'default' }
          : {}),
      }, () => {
        this.updateGroupHash();
        this.persistFormCache();
      });

      if (name === 'sbtImageUrl') {
        this.setState({ imageLoadError: false }, async () => {
          const trimmedUrl = this.state.sbtImageUrl.trim();
          const fetchableUrl = this.getFetchableImageUrl(trimmedUrl);

          if (trimmedUrl !== '' && fetchableUrl) {
            try {
              const file = await fetchImageFromURL(fetchableUrl);
              this.setState({ sbtImageFile: file, imageLoadError: false, lockedImageAsset: null }, () => {
                this.updateGroupHash();
                this.persistFormCache();
              });
            } catch (error) {
              sbtLog.error("Failed to fetch image via worker:", error);
              this.setState({ imageLoadError: true, sbtImageFile: null, lockedImageAsset: null }, () => {
                this.persistFormCache();
              });
            }
          } else {
            this.setState({ sbtImageFile: null, lockedImageAsset: null }, () => this.persistFormCache());
          }
        });
      }
    }
  };


  handleImageUpload = (event) => {
    const file = event.target.files[0];
    this.applySelectedImageFile(file);
  };

  applySelectedImageFile = (file, {
    useImageUrl = false,
    statusText = '',
    statusTone = 'default',
  } = {}) => {
    if (file && file.size > 10 * 1024 * 1024) {
      sbtLog.error("Image too large (>10MB)");
      if (statusText) {
        this.setState({
          imageChooserStatusText: statusText,
          imageChooserStatusTone: statusTone,
        });
      }
      return false;
    }
    this.resetFormStateForEdit();
    this.setState(
      {
        useImageUrl: !!useImageUrl,
        sbtImageFile: file,
        sbtImageUrl: '',
        imageLoadError: false,
        imageChooserStatusText: statusText,
        imageChooserStatusTone: statusText ? statusTone : 'default',
        lockedImageAsset: null,
      },
      () => { this.updateGroupHash(); this.persistFormCache(); }
    );
    return true;
  };

  getFetchableImageUrl = (value) => {
    const normalizedValue = normalizeArweaveUrl(String(value || '').trim());
    if (!normalizedValue) return '';
    try {
      const urlObj = new URL(normalizedValue);
      return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') ? normalizedValue : '';
    } catch (_) {
      return '';
    }
  };

  getCanonicalMetadataImageUrl = (value) => {
    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) return '';
    const txId = parseArweaveTxId(trimmedValue);
    if (txId && txId === trimmedValue) {
      return `ar://${txId}`;
    }
    return trimmedValue;
  };

  handlePasteImage = async () => {
    const clipboardResult = await readCompactImageClipboard({
      fileNamePrefix: 'clipboard-sbt-image',
    });

    if (clipboardResult?.kind === 'file' && clipboardResult.file) {
      const applied = this.applySelectedImageFile(clipboardResult.file, {
        useImageUrl: false,
      });
      if (!applied) {
        this.setState({
          imageChooserStatusText: 'Image too large (>10MB)',
          imageChooserStatusTone: 'error',
        });
      }
      return;
    }

    if (clipboardResult?.kind === 'text') {
      const pastedUrl = String(clipboardResult.text || '').trim();
      const fetchableUrl = this.getFetchableImageUrl(pastedUrl);
      if (!fetchableUrl) {
        this.setState({
          imageChooserStatusText: clipboardResult?.error || 'Clipboard does not contain a supported image or URL.',
          imageChooserStatusTone: 'error',
        });
        return;
      }

      this.setState({
        imageChooserStatusText: 'Loading preview...',
        imageChooserStatusTone: 'loading',
      });

      try {
        const file = await fetchImageFromURL(fetchableUrl);
        this.resetFormStateForEdit();
        await this.setStateAsync({
          useImageUrl: true,
          sbtImageUrl: pastedUrl,
          sbtImageFile: file,
          imageLoadError: false,
          imageChooserStatusText: '',
          imageChooserStatusTone: 'default',
          lockedImageAsset: null,
        });
        this.updateGroupHash();
        this.persistFormCache();
      } catch (error) {
        sbtLog.error("Failed to fetch pasted image via worker:", error);
        this.setState({
          imageChooserStatusText: error?.message || 'Image preview unavailable.',
          imageChooserStatusTone: 'error',
        });
      }
      return;
    }

    this.setState({
      imageChooserStatusText: clipboardResult?.error || 'Clipboard does not contain a supported image or URL.',
      imageChooserStatusTone: 'error',
    });
  };

  toggleImageUploadMethod = () => {
    this.setImageUploadMethod(!this.state.useImageUrl);
  };

  setImageUploadMethod = (useImageUrl, afterUpdate = null) => {
    this.resetFormStateForEdit();
    this.setState(() => ({
      useImageUrl: !!useImageUrl,
      sbtImageFile: null,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    }), () => {
      this.updateGroupHash();
      this.persistFormCache();
      if (typeof afterUpdate === 'function') afterUpdate();
    });
  };

  openImageUploadPicker = () => {
    if (this.state.useImageUrl) {
      this.setImageUploadMethod(false, () => this.fileInput?.click());
      return;
    }
    this.setState({
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    });
    this.fileInput?.click();
  };

  resetImage = () => {
    this.resetFormStateForEdit();
    this.setState({
      sbtImageFile: null,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      useImageUrl: false,
      lockedImageAsset: null,
    }, () => { this.updateGroupHash(); this.persistFormCache(); });
  };

  toggleCollapse = (section) => {
    this.setState((prevState) => ({
      [section]: !prevState[section],
    }));
  };

  renderCollapsibleHeader = (title, sectionKey) => {
    const isCollapsed = !!this.state[sectionKey];
    return (
      <button
        type="button"
        className={`${styles.sectionHeaderButton} ${!isCollapsed ? styles.sectionHeaderButtonOpen : ''}`}
        onClick={() => this.toggleCollapse(sectionKey)}
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
        data-testid={E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}
        data-ce-section-key={sectionKey}
      >
        {isCollapsed ? <span className={styles.sectionHeaderTitleText}>{title}</span> : null}
        <FontAwesomeIcon icon={isCollapsed ? faChevronDown : faChevronUp} />
      </button>
    );
  };

  updateGroupHash = () => {
    const {
      sbtName,
      sbtDescription,
      sbtImageFile,
      sbtImageUrl,
      sbtDistribution,
      tags,
      documentURLs,
      documentUrl,
      metadataLockGateIds,
    } = this.state;
    const groupData = {
      sbtName,
      sbtDescription,
      sbtImageFile,
      sbtImageUrl,
      sbtDistribution,
      tags,
      documentURLs: this.getEffectiveDocumentURLs({ documentURLs, documentUrl }),
      metadataLockGateIds: normalizeMetadataLockGateIds(metadataLockGateIds),
    };

    const newGroupHash = ethers.utils.id(JSON.stringify(groupData));
    this.setState({ groupHash: newGroupHash });
  };

  handleMintingEndTimeChange = (date) => {
    this.resetFormStateForEdit();
    this.setState(
      (prevState) => ({
        sbtDistribution: {
          ...prevState.sbtDistribution,
          mintingEndTime: date,
        },
      }),
      () => { this.updateGroupHash(); this.persistFormCache(); }
    );
  };

  handleBurnAuthChange = (event) => {
    this.resetFormStateForEdit();
    const value = event.target.value;
    this.setState((prevState) => ({
      sbtDistribution: {
        ...prevState.sbtDistribution,
        burnAuth: value,
      },
    }), this.persistFormCache);
  };

  /* =========================
   * Tag Handling (Pill UI)
   * ========================= */
  handleTagInputKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.handleAddTag();
    }
  };

  handleAddTag = () => {
    const val = (this.state.currentTagInput || '').trim();
    if (!val) return;

    // Prevent duplicates
    if (this.state.tags.includes(val)) {
      this.setState({ currentTagInput: '' });
      return;
    }

    this.setState(prev => ({
      tags: [...prev.tags, val],
      currentTagInput: '',
      autoAppliedDefaultTags: (prev.autoAppliedDefaultTags || []).filter(
        (tag) => String(tag || '').trim().toLowerCase() !== val.toLowerCase()
      ),
      dismissedDefaultTags: (prev.dismissedDefaultTags || []).filter(
        (tag) => String(tag || '').trim().toLowerCase() !== val.toLowerCase()
      ),
      showTagsInput: true
    }), () => {
      this.persistFormCache();
    });
  };

  removeTag = (indexToRemove) => {
    const removedTag = this.state.tags[indexToRemove];
    const removedTagLower = String(removedTag || '').trim().toLowerCase();
    const defaultTagLowerSet = new Set(normalizeTagList(this.getDefaultTags()));
    this.setState(prev => ({
      tags: prev.tags.filter((_, i) => i !== indexToRemove),
      autoAppliedDefaultTags: (prev.autoAppliedDefaultTags || []).filter(
        (tag) => String(tag || '').trim().toLowerCase() !== removedTagLower
      ),
      dismissedDefaultTags: defaultTagLowerSet.has(removedTagLower)
        ? this.buildUniqueTags([...(prev.dismissedDefaultTags || []), removedTag])
        : (prev.dismissedDefaultTags || [])
    }), () => {
      this.persistFormCache();
    });
  };

  startClaim = async () => {
    if (this.state.countdownActive || this.countdownTimer) return;
    this.clearCountdownTimer();
    this.setState({ countdownActive: true, countdown: 12 });
    this.countdownTimer = setInterval(() => {
      if (!this._isMounted) return;
      this.setState((prevState) => {
        const nextCountdown = Math.max(0, Number(prevState.countdown || 0) - 1);
        return {
          countdown: nextCountdown,
          ...(nextCountdown === 0 ? { countdownActive: false } : null),
        };
      }, () => {
        if (this.state.countdown === 0) {
          this.clearCountdownTimer();
        }
      });
    }, 1000);
  };

  generatePasswords = () => {
    const { numInviteLinks, sbtDistribution } = this.state;
    const count = sbtDistribution.isLimited && sbtDistribution.limitedNumber > 0
      ? sbtDistribution.limitedNumber
      : numInviteLinks;
    const newPasswordList = Array.from({ length: count }, () => this.generateRandomString(32));
    this.setState({ passwordList: newPasswordList });
    return newPasswordList;
  };

  generateInviteNonces = (count) => {
    const raw = Number(count || 0);
    const target = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    const nonces = new Set();
    while (nonces.size < target) {
      let bytes;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        bytes = new Uint8Array(12);
        window.crypto.getRandomValues(bytes);
      } else {
        bytes = ethers.utils.randomBytes(12);
      }
      const hex = ethers.utils.hexlify(bytes);
      nonces.add(ethers.BigNumber.from(hex).toString());
    }
    return Array.from(nonces);
  };


  generateRandomString = (length) => {
    const bytes = Math.ceil(length / 2);
    let arr;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      arr = new Uint8Array(bytes);
      window.crypto.getRandomValues(arr);
    } else {
      arr = ethers.utils.randomBytes(bytes);
    }
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, length);
  };

  async uploadImageToArweave() {
    if (!this.props.loginComplete) {
      return null;
    }

    await this.setStateAsync({ currentStep: 1, mintingFailed: false });

    const {
      sbtImageFile,
      sbtImageUrl,
      useImageUrl,
      metadataLockGateIds,
    } = this.state;

    try {
      const { gateMap } = this.resolveLockGateOptions();
      const chainID = this.getSelectedAuthoringChainId();
      const selectedImageGateIds = this.normalizeSelectedGateIds(
        getMetadataFieldLockGateIds(metadataLockGateIds, 'image'),
        Object.keys(gateMap || {})
      );
      const isImageLocked = selectedImageGateIds.length > 0;
      const shouldUseLockedUrlFlow = isImageLocked && useImageUrl;
      let fileToUpload = sbtImageFile;
      let imageFormat = 'png';

      if (!fileToUpload || shouldUseLockedUrlFlow) {
        await this.setStateAsync({
          imageUploaded: true,
          lockedImageAsset: null,
          sbtImageUrl: String(sbtImageUrl || '').trim(),
          currentStep: 2,
        });
        return {
          imageUploaded: true,
          lockedImageAsset: null,
          sbtImageUrl: String(sbtImageUrl || '').trim(),
        };
      }

      if (fileToUpload.type === 'image/jpeg' || fileToUpload.type === 'image/jpg') {
        imageFormat = 'jpg';
      } else {
        imageFormat = 'png';
      }

      const arweaveKey = await this.getEffectiveArweaveUploadKey();
      const arweaveRequestOptions = await this.buildArweaveUploadRequestOptions();
      if (isImageLocked) {
        const imageEncryption = this.buildGateObjectsAndRecipients(selectedImageGateIds, gateMap, chainID);
        this.requireRecipientsForGateSelection({
          gateIds: selectedImageGateIds,
          recipients: imageEncryption?.recipients,
          scopeLabel: 'image',
        });
        const litHooks = getGlobalLitHooks();
        if (!litHooks || typeof litHooks.saveKey !== 'function') {
          throw new Error(`Lit hooks not initialized; connect a ${t('walletLower')} to encrypt.`);
        }
        const combinedAccessControlConditions = [];
        (Array.isArray(imageEncryption?.recipients) ? imageEncryption.recipients : []).forEach((recipient) => {
          const conditions = recipient?.accessControlConditions;
          if (!Array.isArray(conditions) || conditions.length === 0) return;
          if (combinedAccessControlConditions.length > 0) {
            combinedAccessControlConditions.push({ operator: 'or' });
          }
          combinedAccessControlConditions.push(...conditions);
        });
        const uploadResult = await uploadEncryptedArweaveData({
          data: fileToUpload,
          name: fileToUpload?.name || 'image',
          mime: fileToUpload?.type || 'application/octet-stream',
          arweaveJwk: arweaveKey?.arweaveJwk || '',
          providerLike: this.props.provider,
          account: this.props.account,
          chainId: chainID,
          contextLabel: `sbt:${this.getMetadataEncryptionContextBase()}:image-asset`,
          arweave: arweaveRequestOptions,
          lit: {
            saveKey: litHooks.saveKey,
            accessControlConditions: combinedAccessControlConditions,
            chain: imageEncryption.recipients?.[0]?.chain || null,
          },
        });
        const lockedAsset = this.buildEncryptedImageAsset({
          uploadResult,
        });
        if (!lockedAsset) {
          throw new Error('Failed to prepare encrypted image asset.');
        }
        await this.setStateAsync({
          imageUploaded: true,
          lockedImageAsset: lockedAsset,
          sbtImageUrl: '',
          currentStep: 2,
        });
        return {
          imageUploaded: true,
          lockedImageAsset: lockedAsset,
          sbtImageUrl: '',
        };
      }
      const imageTxId = await arweaveScripts.uploadDataToArweave(fileToUpload, imageFormat, {
        arweaveJwk: arweaveKey?.arweaveJwk || '',
        ...arweaveRequestOptions,
      });
      sbtLog.log("Image uploaded to Arweave with transaction ID:", imageTxId);

      await this.setStateAsync({
        imageUploaded: true,
        sbtImageUrl: imageTxId,
        lockedImageAsset: null,
        currentStep: 2,
      });
      return {
        imageUploaded: true,
        sbtImageUrl: imageTxId,
        lockedImageAsset: null,
      };
    } catch (error) {
      sbtLog.error("Failed to upload image to Arweave:", error);
      this.setState({ mintingFailed: true, startedMinting: false, currentStep: 0, error: error?.message || 'Failed to upload image to Arweave.' });
      throw error;
    }
  }

  async uploadTokenUriToArweave() {
    await this.setStateAsync({ currentStep: 2, mintingFailed: false });
    try {
      const {
        sbtName,
        sbtDescription,
        sbtImageUrl,
        sbtDistribution,
        tags,
        documentIDHashes,
        metadataLockGateIds,
        useImageUrl,
        sbtImageFile,
        lockedImageAsset,
      } = this.state;
      const { burnAuth, network } = sbtDistribution;
      const { gateMap, defaultGateId } = this.resolveLockGateOptions();
      const validGateIds = Object.keys(gateMap || {});
      const knownGateIds = new Set(validGateIds);
      const scrubGateIds = (ids) => normalizeGateIds(ids).filter((gateId) => knownGateIds.has(gateId));
      const finalDocURLs = this.getEffectiveDocumentURLs();

      // Use tags array directly (ensure no empty strings)
      const tokenTags = tags.filter(t => t.trim().length > 0);
      const docIDHashesArray = documentIDHashes.trim().length > 0 ? documentIDHashes.split(',').map(d => d.trim()) : [];
      const chainID = this.getSelectedAuthoringChainId();
      const creator = this.props.account;
      const normalizedLockMap = normalizeMetadataLockGateIds(metadataLockGateIds);
      const resolveFieldGateIds = (fieldKey) => {
        const rawGateIds = getMetadataFieldLockGateIds(normalizedLockMap, fieldKey);
        const selectedGateIds = scrubGateIds(rawGateIds);
        if (rawGateIds.length > 0 && selectedGateIds.length !== rawGateIds.length) {
          throw new Error(`${fieldKey} encryption ${t('gatesLower')} could not be resolved. Please reselect the lock or configure valid ${t('gatesLower')}.`);
        }
        return selectedGateIds;
      };
      const imageSourceValue = (() => {
        const explicit = this.getCanonicalMetadataImageUrl(sbtImageUrl);
        if (useImageUrl && explicit) return explicit;
        if (explicit) return explicit;
        return this.getCanonicalMetadataImageUrl(DEFAULT_SBT_IMAGE_ARWEAVE_TX);
      })();

      let finalImageUrl = imageSourceValue;
      let finalName = sbtName || "";
      let finalDescription = sbtDescription || "";
      let finalTags = tokenTags;
      let finalDocumentURLs = finalDocURLs;
      const encryptedFields = {};
      const encryptedFieldGates = {};
      const contextBase = this.getMetadataEncryptionContextBase();
      const markEncryptedField = (fieldKey, selectedGateIds) => {
        const normalized = this.normalizeSelectedGateIds(selectedGateIds, validGateIds);
        if (!normalized.length) return;
        encryptedFieldGates[fieldKey] = normalized.length === 1 ? normalized[0] : normalized;
      };

      const selectedNameGateIds = resolveFieldGateIds('name');
      const nameEncryption = selectedNameGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedNameGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedNameGateIds,
        recipients: nameEncryption?.recipients,
        scopeLabel: 'group name',
      });
      if (nameEncryption && nameEncryption.recipients.length) {
        const nameResult = await this.encryptValueWithRecipients({
          value: finalName,
          maskedValue: '',
          contextLabel: `sbt:${contextBase}:name`,
          recipients: nameEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalName = nameResult.value;
        if (nameResult.encrypted) {
          encryptedFields.name = nameResult.encrypted;
          markEncryptedField('name', selectedNameGateIds);
        }
      }

      const selectedDescriptionGateIds = resolveFieldGateIds('description');
      const descriptionEncryption = selectedDescriptionGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedDescriptionGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedDescriptionGateIds,
        recipients: descriptionEncryption?.recipients,
        scopeLabel: 'group description',
      });
      if (descriptionEncryption && descriptionEncryption.recipients.length) {
        const descriptionResult = await this.encryptValueWithRecipients({
          value: finalDescription,
          maskedValue: '',
          contextLabel: `sbt:${contextBase}:description`,
          recipients: descriptionEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalDescription = descriptionResult.value;
        if (descriptionResult.encrypted) {
          encryptedFields.description = descriptionResult.encrypted;
          markEncryptedField('description', selectedDescriptionGateIds);
        }
      }

      const selectedTagsGateIds = resolveFieldGateIds('tags');
      const tagsEncryption = selectedTagsGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedTagsGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedTagsGateIds,
        recipients: tagsEncryption?.recipients,
        scopeLabel: 'group tags',
      });
      if (tagsEncryption && tagsEncryption.recipients.length) {
        const tagsResult = await this.encryptValueWithRecipients({
          value: finalTags,
          maskedValue: [],
          contextLabel: `sbt:${contextBase}:tags`,
          recipients: tagsEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalTags = tagsResult.value;
        if (tagsResult.encrypted) {
          encryptedFields.tags = tagsResult.encrypted;
          markEncryptedField('tags', selectedTagsGateIds);
        }
      }

      const selectedDocsGateIds = resolveFieldGateIds('documentURLs');
      const docsEncryption = selectedDocsGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedDocsGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedDocsGateIds,
        recipients: docsEncryption?.recipients,
        scopeLabel: 'document URLs',
      });
      if (docsEncryption && docsEncryption.recipients.length) {
        const docsResult = await this.encryptValueWithRecipients({
          value: finalDocumentURLs,
          maskedValue: [],
          contextLabel: `sbt:${contextBase}:document-urls`,
          recipients: docsEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalDocumentURLs = docsResult.value;
        if (docsResult.encrypted) {
          encryptedFields.documentURLs = docsResult.encrypted;
          markEncryptedField('documentURLs', selectedDocsGateIds);
        }
      }

      const selectedImageGateIds = resolveFieldGateIds('image');
      const imageEncryption = selectedImageGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedImageGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedImageGateIds,
        recipients: imageEncryption?.recipients,
        scopeLabel: 'image',
      });
      if (imageEncryption && imageEncryption.recipients.length) {
        if (!useImageUrl && sbtImageFile && lockedImageAsset?.txId && lockedImageAsset?.url) {
          finalImageUrl = '';
          encryptedFields.image = lockedImageAsset;
          markEncryptedField('image', selectedImageGateIds);
        } else {
          const imageResult = await this.encryptValueWithRecipients({
            value: finalImageUrl,
            maskedValue: '',
            contextLabel: `sbt:${contextBase}:image`,
            recipients: imageEncryption.recipients,
            chainIdFallback: chainID,
          });
          finalImageUrl = imageResult.value;
          if (imageResult.encrypted) {
            encryptedFields.image = imageResult.encrypted;
            markEncryptedField('image', selectedImageGateIds);
          }
        }
      }

      const metadataSessionSlug = this.getResolvedMetadataSessionSlug();
      const metadataEncryption = this.buildMetadataEncryption({
        encryptedFieldGates,
        gateMap,
        chainIdFallback: chainID,
        defaultGateId,
      });
      const tokenUriBase = this.buildTokenUriMetadata({
        name: finalName,
        imageUrl: finalImageUrl,
        description: finalDescription,
        metadataSessionSlug,
        tokenTags: finalTags,
        docIDHashesArray,
        finalDocURLs: finalDocumentURLs,
        burnAuth,
        networkName: network?.name,
        chainID,
        creator,
        encryptedFields,
        encryptedFieldGates: metadataEncryption.encryptedFieldGates,
        encryption: metadataEncryption.encryption,
      });

      const tokenUriData = JSON.stringify(tokenUriBase);
      const arweaveKey = await this.getEffectiveArweaveUploadKey();
      const arweaveRequestOptions = await this.buildArweaveUploadRequestOptions();
      const tokenUriTxId = await arweaveScripts.uploadDataToArweave(tokenUriData, 'json', {
        arweaveJwk: arweaveKey?.arweaveJwk || '',
        ...arweaveRequestOptions,
      });

      await this.setStateAsync({
        tokenUriUploaded: true,
        tokenURI: `${tokenUriTxId}`,
        currentStep: 3,
      });
      return `${tokenUriTxId}`;
    } catch (error) {
      sbtLog.error('uploadTokenUriToArweave failed:', error);
      this.setState({ mintingFailed: true, startedMinting: false, currentStep: 0, error: error?.message || 'Failed to upload tokenURI.' });
      throw error;
    }
  }

  persistCreatedSbtCodes = ({ sbtAddress, hasPasswordMintOnChain, codesToStore = [] } = {}) => {
    if (!hasPasswordMintOnChain || !sbtAddress || !Array.isArray(codesToStore) || codesToStore.length === 0) {
      return;
    }
    const createdSBTs = JSON.parse(localStorage.getItem('createdSBTs') || '{}');
    if (!createdSBTs[sbtAddress]) createdSBTs[sbtAddress] = {};
    createdSBTs[sbtAddress].passwords = codesToStore;
    localStorage.setItem('createdSBTs', JSON.stringify(createdSBTs));
  };

  handleDeferredSave = async () => {
    if (typeof this.props.onSaveDraft !== 'function') {
      throw new Error('Session draft save is unavailable.');
    }
    await this.commitPendingDocumentUrl();
    const draftPayload = await this.buildDeferredDraftPayload();
    await this.props.onSaveDraft(draftPayload);
    this.clearFormCache();
    await this.setStateAsync({
      startedMinting: false,
      mintingFailed: false,
      currentStep: 0,
      error: '',
    });
    return draftPayload;
  };

  getBurnAuthEnum = (burnAuth) => {
    switch (burnAuth) {
      case 'AdminOnly': return 0;
      case 'OwnerOnly': return 1;
      case 'Both': return 2;
      case 'Neither': return 3;
      default: throw new Error(`Unsupported burnAuth value: ${burnAuth}`);
    }
  };

  buildTokenUriMetadata = ({
    name = this.state.sbtName,
    imageUrl,
    description,
    metadataSessionSlug = normalizeSessionSlug(this.getEffectiveSessionSlug() || ''),
    tokenTags = this.state.tags.filter((tag) => (tag || '').trim().length > 0),
    docIDHashesArray = (this.state.documentIDHashes || '').trim().length > 0
      ? this.state.documentIDHashes.split(',').map((hash) => hash.trim()).filter(Boolean)
      : [],
    finalDocURLs = this.getEffectiveDocumentURLs(),
    burnAuth = this.state.sbtDistribution.burnAuth,
    networkName = this.getSelectedAuthoringChain()?.name || this.state.sbtDistribution.network?.name,
    chainID = this.getSelectedAuthoringChainId(),
    creator = this.props.account,
    encryptedFields = null,
    encryptedFieldGates = null,
    encryption = null,
  } = {}) => {
    const { sbtDistribution } = this.state;
    const metadata = {
      v: 2,
      name: (name || '').trim(),
      description: (description || '').trim(),
      image: typeof imageUrl === 'string' ? imageUrl : '',
      burnAuth,
      network: networkName,
      unlisted: sbtDistribution.unlisted,
      tags: tokenTags,
      maxTokens: sbtDistribution.isLimited ? sbtDistribution.limitedNumber : 0,
      hasPasswordMint:
        sbtDistribution.distributionOption === 'hasPasswords' ||
        (sbtDistribution.distributionOption === 'groupPassword' && sbtDistribution.isLimited),
      chainID,
      creator,
      documentIDHashes: docIDHashesArray,
      documentURLs: finalDocURLs,
      sessionSlug: metadataSessionSlug,
    };

    if (encryptedFields && typeof encryptedFields === 'object' && Object.keys(encryptedFields).length > 0) {
      metadata.encryptedFields = encryptedFields;
    }
    if (encryptedFieldGates && typeof encryptedFieldGates === 'object' && Object.keys(encryptedFieldGates).length > 0) {
      metadata.encryptedFieldGates = encryptedFieldGates;
    }
    if (encryption && typeof encryption === 'object') {
      metadata.encryption = encryption;
    }

    return metadata;
  };

  getResolvedMetadataSessionSlug = () => {
    const sessionConfig = this.getSessionConfigForNetwork();
    const metadataSessionSlug = normalizeSessionSlug(
      this.getEffectiveSessionSlug() || sessionConfig?.slug || ''
    );
    if (this.isDeferredDeployMode() && !metadataSessionSlug) {
      throw new Error(`Set the session URL before adding this ${t('sbt')} to the session.`);
    }
    return metadataSessionSlug;
  };

  buildMetadataPreview = () => {
    const {
      sbtName,
      sbtDescription,
      sbtImageUrl,
      tags,
      metadataLockGateIds,
      useImageUrl,
      sbtImageFile,
    } = this.state;
    const chainID = this.getSelectedAuthoringChainId();
    const { gateMap, defaultGateId } = this.resolveLockGateOptions();
    const validGateIds = Object.keys(gateMap || {});
    const previewEncryptedFieldGates = {};
    const previewEncryptedFields = {};
    const previewDocURLs = this.getEffectiveDocumentURLs();
    const previewTags = (Array.isArray(tags) ? tags : []).filter((tag) => (tag || '').trim().length > 0);

    let previewName = sbtName || '';
    let previewDescription = sbtDescription || '';
    let previewTagList = previewTags;
    let previewDocumentList = previewDocURLs;
    let previewImage = this.getCanonicalMetadataImageUrl(sbtImageUrl)
      || this.getCanonicalMetadataImageUrl(DEFAULT_SBT_IMAGE_ARWEAVE_TX);
    const normalizedLockMap = normalizeMetadataLockGateIds(metadataLockGateIds);

    const registerPreviewField = (fieldKey, selectedGateIds) => {
      const normalized = this.normalizeSelectedGateIds(selectedGateIds, validGateIds);
      if (!normalized.length) return false;
      previewEncryptedFieldGates[fieldKey] = normalized.length === 1 ? normalized[0] : normalized;
      return true;
    };

    if ((previewDescription || '').trim().length > 0) {
      if (registerPreviewField('description', normalizedLockMap.description)) {
        previewDescription = '';
        previewEncryptedFields.description = LOCKED_FIELD_MASK;
      }
    }

    if (previewTagList.length > 0) {
      if (registerPreviewField('tags', normalizedLockMap.tags)) {
        previewTagList = [];
        previewEncryptedFields.tags = LOCKED_FIELD_MASK;
      }
    }

    if (previewDocumentList.length > 0) {
      if (registerPreviewField('documentURLs', normalizedLockMap.documentURLs)) {
        previewDocumentList = [];
        previewEncryptedFields.documentURLs = LOCKED_FIELD_MASK;
      }
    }

    if ((previewName || '').trim().length > 0) {
      if (registerPreviewField('name', normalizedLockMap.name)) {
        previewName = '';
        previewEncryptedFields.name = LOCKED_FIELD_MASK;
      }
    }

    if ((previewImage || '').trim().length > 0) {
      if (registerPreviewField('image', normalizedLockMap.image)) {
        previewImage = '';
        previewEncryptedFields.image = (!useImageUrl && sbtImageFile)
          ? this.buildPreviewEncryptedImageAsset()
          : LOCKED_FIELD_MASK;
      }
    }

    const metadataEncryption = this.buildMetadataEncryption({
      encryptedFieldGates: previewEncryptedFieldGates,
      gateMap,
      chainIdFallback: chainID,
      defaultGateId,
    });
    const preview = this.buildTokenUriMetadata({
      name: previewName,
      imageUrl: previewImage,
      description: previewDescription,
      tokenTags: previewTagList,
      finalDocURLs: previewDocumentList,
      encryptedFields: previewEncryptedFields,
      encryptedFieldGates: metadataEncryption.encryptedFieldGates,
      encryption: metadataEncryption.encryption,
    });

    return preview;
  };

  resolvePredictableDeployPlan = async ({ tokenURI }) => {
    const predictionShape = this.buildPredictableDeployShape();
    if (!predictionShape || predictionShape.pendingStateUpdate) {
      throw new Error('Address preview is still preparing. Please retry in a moment.');
    }
    if (predictionShape.unavailableReason) {
      throw new Error(predictionShape.unavailableReason);
    }
    const { predictedAddress, predictionSignature } = await this.resolvePredictedAddressForShape(predictionShape);
    if (!predictedAddress || !ethers.utils.isAddress(predictedAddress)) {
      throw new Error(`Unable to resolve the predicted ${t('sbt')} address.`);
    }
    // Regression guard: a non-empty preview is only reusable when it matches the
    // current deterministic deploy inputs; otherwise we must recompute.
    this._predictedAddressShapeSignature = predictionSignature;

    const finalGroupPasswordHash = predictionShape.initializeGroupPasswordHash
      ? contractScripts.computeGroupPasswordHash({
          password: predictionShape.groupPassword,
          sbtAddress: predictedAddress,
        })
      : ethers.constants.HashZero;

    return {
      ...predictionShape,
      predictedAddress,
      tokenURI,
      finalGroupPasswordHash,
      createOptions: {
        useConfiguredDeterministic: true,
        initializeGroupPasswordHash: predictionShape.initializeGroupPasswordHash,
      },
    };
  };

  buildDeferredDraftPayload = async () => {
    const authoringPayload = await this.buildSerializableAuthoringPayload();
    const arweaveKey = await this.getEffectiveArweaveUploadKey();
    let tokenURI = String(this.state.tokenURI || '').trim();
    let metadataUploadStatus = tokenURI ? 'ready' : 'pending-upload';
    const shouldAttemptImmediateDeferredUpload = this.props.attemptImmediateDeferredUpload !== false;

    if (!tokenURI && shouldAttemptImmediateDeferredUpload) {
      const hasConnectedCreator = ethers.utils.isAddress(toStr(this.props.account).trim());
      const hasImmediateUploadPath = (
        hasConnectedCreator && (
          !!toStr(arweaveKey?.arweaveJwk).trim() ||
          !!this.getResolvedArweaveUploadWorkerUrl()
        )
      );
      if (hasImmediateUploadPath) {
        try {
          await this.uploadImageToArweave();
          tokenURI = String(await this.uploadTokenUriToArweave()).trim();
          metadataUploadStatus = tokenURI ? 'ready' : 'pending-upload';
        } catch (error) {
          if (!shouldFallbackDeferredDraftUpload(error)) {
            throw error;
          }
          await this.setStateAsync({
            tokenURI: '',
            tokenUriUploaded: false,
            mintingFailed: false,
            startedMinting: false,
            currentStep: 0,
            error: '',
          });
          tokenURI = '';
          metadataUploadStatus = 'pending-upload';
        }
      }
    }
    const deployPlan = await this.resolvePredictableDeployPlan({ tokenURI });
    const metadataPreview = this.buildMetadataPreview();
    return {
      id: deployPlan.predictedAddress.toLowerCase(),
      predictedAddress: deployPlan.predictedAddress,
      displayName: deployPlan.displayName,
      contractName: deployPlan.contractName,
      symbol: deployPlan.symbol,
      create2Salt: deployPlan.create2Salt,
      limitedNumber: deployPlan.limitedNumber,
      adminAddress: deployPlan.adminAddress,
      mintingEndTimeUnix: deployPlan.mintingEndTimeUnix,
      hasPasswordMintOnChain: deployPlan.hasPasswordMintOnChain,
      burnAuthEnum: deployPlan.burnAuthEnum,
      hashedPasswords: deployPlan.hashedPasswords,
      tokenURI: deployPlan.tokenURI,
      metadataUploadStatus,
      finalGroupPasswordHash: deployPlan.finalGroupPasswordHash,
      createOptions: deployPlan.createOptions,
      distributionOption: deployPlan.distributionOption,
      passwordList: deployPlan.passwordList,
      groupPassword: deployPlan.groupPassword,
      usesInviteCodes: deployPlan.usesInviteCodes,
      authoringPayload,
      metadataPreview,
      sessionSlug: this.getEffectiveSessionSlug(),
      imageUrl: metadataPreview?.image || '',
    };
  };

  async mintSBT() {
    if (!this.props.loginComplete) {
      this.props.toggleLoginModal(true);
      return;
    }

    await this.setStateAsync({ currentStep: 3, mintingFailed: false });

    const {
      sbtName,
      sbtDistribution,
      passwordList,
      numInviteLinks,
      tokenURI,
      groupPassword: rawGroupPassword,
      create2Salt,
      metadataLockGateIds,
    } = this.state;

    const {
      isLimited,
      limitedNumber,
      burnAdmin,
      isTimeLimited,
      burnAuth,
      distributionOption
    } = sbtDistribution;

    // Validation: require name
    const sbtNameTrimmed = (sbtName || '').trim();
    if (!sbtNameTrimmed) {
      this.setState({ mintingFailed: true, error: `${t('sbt')} Name is required.` });
      return;
    }

    // Validation: require group password when using groupPassword distribution
    const groupPassword = cryptoUtils.normalizeGroupPasswordInput(rawGroupPassword);
    if (distributionOption === 'groupPassword' && !groupPassword) {
      this.setState({ mintingFailed: true, error: 'Group password is required for group minting.' });
      return;
    }

    const usesClaimCodes = distributionOption === 'hasPasswords';
    const usesInviteCodes = distributionOption === 'groupPassword' && isLimited;
    const hasPasswordMintOnChain = usesClaimCodes || usesInviteCodes;

    const burnAuthEnum = this.getBurnAuthEnum(burnAuth);

    const limitedCountRaw = isLimited ? Number(limitedNumber) : 0;
    const limitedCount = Number.isFinite(limitedCountRaw) ? Math.floor(limitedCountRaw) : 0;
    const tokenUriFull = String(tokenURI || '').trim();

    if (isLimited && limitedCount <= 0) {
      this.setState({ mintingFailed: true, error: 'Limited groups require a positive token limit.' });
      return;
    }
    if (!tokenUriFull) {
      this.setState({ mintingFailed: true, error: 'Token metadata must be uploaded before minting.' });
      return;
    }

    try {
      const groupCfg = this.getSessionConfigForNetwork();
      let deploymentExpectation = null;
      let finalPasswordList = Array.isArray(passwordList) ? passwordList : [];
      let hashedPasswords = [];
      let mintingEndTimeUnix = 0;
      let groupPasswordHashForCreate = ethers.constants.HashZero;
      let sbtSymbol = '';
      let contractName = '';
      let effectiveCreate2Salt = create2Salt;
      let createOptions = {};

      if (this.isPredictableAddressEnabled()) {
        deploymentExpectation = await this.resolvePredictableDeployPlan({ tokenURI: tokenUriFull });
        finalPasswordList = deploymentExpectation.passwordList;
        hashedPasswords = deploymentExpectation.hashedPasswords;
        mintingEndTimeUnix = deploymentExpectation.mintingEndTimeUnix;
        groupPasswordHashForCreate = deploymentExpectation.finalGroupPasswordHash;
        sbtSymbol = deploymentExpectation.symbol;
        contractName = deploymentExpectation.contractName;
        effectiveCreate2Salt = deploymentExpectation.create2Salt;
        createOptions = deploymentExpectation.createOptions;
      } else {
        const sbtCount = await contractScripts.countSBTCreated(this.props.provider, groupCfg);
        sbtSymbol = `CE-SBT-${sbtCount + 1}`;
        contractName = getMetadataFieldLockGateIds(metadataLockGateIds, 'name').length > 0
          ? sbtSymbol
          : sbtNameTrimmed;
        if (usesClaimCodes && (!finalPasswordList || finalPasswordList.length === 0)) {
          finalPasswordList = this.generatePasswords();
        }
        hashedPasswords = usesClaimCodes
          ? finalPasswordList.map((password) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)))
          : [];
        mintingEndTimeUnix = (isTimeLimited && sbtDistribution.mintingEndTime)
          ? Math.floor(sbtDistribution.mintingEndTime.getTime() / 1000)
          : 0;
      }

      this.setState({ sbtSymbol });

      const receipt = await contractScripts.createSBT(
        this.props.provider,
        contractName,
        sbtSymbol,
        isLimited ? limitedCount : 0,
        burnAdmin || this.props.account,
        mintingEndTimeUnix,
        hasPasswordMintOnChain,
        burnAuthEnum,
        hashedPasswords,
        tokenUriFull,
        groupPasswordHashForCreate,
        groupCfg,
        effectiveCreate2Salt,
        createOptions
      );

      const sbtAddress = resolveSbtAddressFromFactoryReceipt(receipt);

      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
        throw new Error(`Failed to resolve ${t('sbt')} address from SBTCreated event.`);
      }
      if (
        deploymentExpectation?.predictedAddress &&
        deploymentExpectation.predictedAddress.toLowerCase() !== sbtAddress.toLowerCase()
      ) {
        throw new Error(
          `Deterministic deployment mismatch: expected ${deploymentExpectation.predictedAddress}, received ${sbtAddress}.`
        );
      }

      // Persist plaintext codes for creator (export/admin tools)
      const codesToStore = usesInviteCodes ? [groupPassword] : finalPasswordList;
      this.persistCreatedSbtCodes({ sbtAddress, hasPasswordMintOnChain, codesToStore });
      this.suppressFormCachePersistenceAfterSuccess();

      this.setState({
        sbtMinted: true,
        sbtAddress,
        currentStep: 3,
        passwordList: usesInviteCodes ? [groupPassword] : finalPasswordList
      });

      // Shareable links
      const publicAutoJoinUrl = this.buildSessionAutoJoinUrl(sbtAddress);
      const encodedGroupPassword = cryptoUtils.encodeGroupPasswordForUrl(groupPassword);

      if (distributionOption === 'groupPassword' && !isLimited) {
        const secureUrl = publicAutoJoinUrl; // no password in URL
        const oneClick  = `${secureUrl}&gp=${encodeURIComponent(encodedGroupPassword)}`; // password embedded

        this.setState({
          shareableUrl: oneClick,
          autoJoinUrl: oneClick
        });
      } else if (distributionOption === 'groupPassword' && isLimited) {
        const autoJoinUrl = `${publicAutoJoinUrl}&gp=${encodeURIComponent(encodedGroupPassword)}`;
        this.setState({ shareableUrl: autoJoinUrl, autoJoinUrl });
        await this.generateSBTInviteLinks(sbtAddress, [groupPassword]);
      } else if (distributionOption === 'anyoneCanMint') {
        const autoJoinUrl = publicAutoJoinUrl;
        this.setState({
          shareableUrl: autoJoinUrl,
          autoJoinUrl: autoJoinUrl
        });
      } else if (distributionOption === 'hasPasswords') {
        await this.generateSBTInviteLinks(sbtAddress);
      }

    } catch (error) {
      sbtLog.error('[CreateSBTGroup] Mint failed:', error);
      this.setState({ mintingFailed: true, startedMinting: false, currentStep: 0, error: error?.message || `${t('minting')} failed.` });
    }
  }


  async generateSBTInviteLinks(sbtAddress, listOverride = null) {
    const list = Array.isArray(listOverride) && listOverride.length > 0
      ? listOverride
      : (this.state.passwordList || []);
    const { sbtDistribution } = this.state;
    const isInvite = sbtDistribution.isLimited && sbtDistribution.distributionOption === 'groupPassword';
    const base = window.location.origin;
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug());
    const encodeGroupPassword = (code) => {
      const normalized = cryptoUtils.normalizeGroupPasswordInput(code);
      return cryptoUtils.encodeGroupPasswordForUrl(normalized) || '';
    };
    const detailPath = this.buildSbtPagePath(sbtAddress);
    const [detailPathname, detailQuery = ''] = String(detailPath || '').split('?');
    const detailQuerySuffix = detailQuery ? `?${detailQuery}` : '';
    const sbtInviteLinks = list.map(code => (
      isInvite
        ? `${base}${demoPath}?auto=1&sbt=${encodeURIComponent(sbtAddress)}&gp=${encodeURIComponent(encodeGroupPassword(code))}`
        : `${base}${detailPathname}/${encodeURIComponent(code)}${detailQuerySuffix}`
    ));
    const sbtInviteBackupDate = new Date().toISOString().slice(0, 10);
    this.setState({ sbtInviteLinks, sbtInviteBackupDate });
  }

  massSendSBTs = async () => {
    const { csvAddresses } = this.state;
    const addresses = csvAddresses.split(',').map((address) => address.trim());
    try {
      // placeholder
    } catch (e) { sbtLog.warn('CreateSBTGroup: fallback', e); }
  };

  updateNumInviteLinks = () => {
    if (this.state.sbtDistribution.isLimited && (this.state.sbtDistribution.distributionOption === 'hasPasswords' || this.state.sbtDistribution.distributionOption === 'groupPassword')) {
      this.setState({ numInviteLinks: this.state.sbtDistribution.limitedNumber }, this.persistFormCache);
    }
  };

  handleNumInviteLinksChange = (event) => {
    const numInviteLinks = parseInt(event.target.value, 10);
    this.setState({ numInviteLinks }, this.persistFormCache);
  };

  copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      notify.success('Copied to clipboard');
      if (!this._isMounted) return;
      this.setState({ copiedLinkIndex: index });
      this.scheduleTrackedStateReset('copiedLinkIndex', { copiedLinkIndex: null }, 2000);
    });
  };

  handleExportFormatChange = (event) => {
    this.setState({ exportFormat: event.target.value }, this.persistFormCache);
  };

  exportPasswords = () => {
    const { passwordList, sbtInviteLinks, exportFormat, sbtSymbol, sbtName, sbtDistribution } = this.state;
    const date = new Date().toISOString().slice(0, 10);
    let content;
    let fileName;
    const isInvite = sbtDistribution.isLimited && sbtDistribution.distributionOption === 'groupPassword';
    const codeLabel = isInvite ? 'groupPassword' : 'password';
    const fileLabel = isInvite ? 'group-passwords' : 'passwords';

    if (exportFormat === 'json') {
      content = JSON.stringify(passwordList.map((code, index) => ({
        index,
        [codeLabel]: code,
        inviteLink: sbtInviteLinks[index]
      })), null, 2);
      fileName = `${sbtSymbol}_${sbtName}_${fileLabel}_${date}.json`;
    } else if (exportFormat === 'csv') {
      content = `index,${codeLabel},inviteLink\n` +
        passwordList.map((code, index) =>
          `${index},${code},${sbtInviteLinks[index]}`
        ).join('\n');
      fileName = `${sbtSymbol}_${sbtName}_${fileLabel}_${date}.csv`;
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


  handleMintClick = async () => {
    // Must be connected
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }

    // Block re-entry if flow already started
    if (this.state.currentStep > 0) return;

    await this.commitPendingDocumentUrl();

    // Validation: require a name
    const sbtNameTrimmed = (this.state.sbtName || '').trim();
    if (!sbtNameTrimmed) {
      this.setState({ error: `Please enter a group name (${t('sbt')} Name) before creating.` });
      return;
    }

    // Validation: groupPassword flow requires a non-empty password
    if (this.state.sbtDistribution.distributionOption === 'groupPassword') {
      const gpNormalized = cryptoUtils.normalizeGroupPasswordInput(this.state.groupPassword);
      if (!gpNormalized) {
        this.setState({ error: 'Group password is required for group minting.' });
        return;
      }
    }

    // Proceed
    this.setState({ startedMinting: true, mintingFailed: false, error: '' });

    const fetchableImageUrl = this.getFetchableImageUrl(this.state.sbtImageUrl);
    if (this.state.useImageUrl && fetchableImageUrl && !this.state.sbtImageFile) {
      try {
        const file = await fetchImageFromURL(fetchableImageUrl);
        // Await state update so sbtImageFile is set before uploadImageToArweave reads it
        await new Promise(resolve => {
          this.setState({ sbtImageFile: file, imageLoadError: false }, () => {
            this.updateGroupHash();
            this.persistFormCache();
            resolve();
          });
        });
      } catch (error) {
        this.setState({ imageLoadError: true }, this.persistFormCache);
      }
    }

    try {
      if (this.isDeferredDeployMode()) {
        await this.handleDeferredSave();
      } else {
        await this.uploadImageToArweave();
        await this.uploadTokenUriToArweave();
        await this.mintSBT();
      }
    } catch (error) {
      if (this.state.error) return;
      this.setState({
        mintingFailed: true,
        startedMinting: false,
        currentStep: 0,
        error: error?.message || `Unable to create this ${t('sbt')}.`,
      });
    }
  };


  async handleImageLoaded(imgRef) {
    try {
      imgRef.crossOrigin = "anonymous";
      const imageElement = imgRef;
      if (!imageElement.complete || imageElement.naturalWidth === 0) {
        this.setState({ sbtImageFile: null, imageLoadError: true }, this.persistFormCache);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const ctx = canvas.getContext('2d');

      imageElement.setAttribute('crossOrigin', 'anonymous');

      ctx.drawImage(imageElement, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (!b) reject(new Error("Failed to create blob from canvas"));
          resolve(b);
        }, 'image/png');
      });
      if (!blob) {
        this.setState({ sbtImageFile: null, imageLoadError: true }, this.persistFormCache);
        return;
      }
      const file = new File([blob], "url_image.png", { type: "image/png" });
      this.setState({ sbtImageFile: file, imageLoadError: false }, () => {
        this.updateGroupHash();
        this.persistFormCache();
      });
    } catch (error) {
      this.setState({ sbtImageFile: null, imageLoadError: true }, this.persistFormCache);
    }
  }

  commitPendingDocumentUrl = async ({ persist = true } = {}) => {
    this.resetFormStateForEdit();
    const pendingDocumentUrl = this.getNormalizedDocumentUrlDraft();
    if (!pendingDocumentUrl || this.state.documentURLs.length >= 10) {
      return false;
    }

    await this.setStateAsync((prevState) => ({
      documentURLs: [...prevState.documentURLs, pendingDocumentUrl],
      documentUrl: '',
    }));
    this.updateGroupHash();
    if (persist) this.persistFormCache();
    return true;
  };

  addDocumentURL = () => {
    void this.commitPendingDocumentUrl();
  };

  handleDocUrlKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addDocumentURL();
    }
  };

  removeDocumentURL = (index) => {
    this.resetFormStateForEdit();
    this.setState((prevState) => {
      const newURLs = [...prevState.documentURLs];
      newURLs.splice(index, 1);
      return { documentURLs: newURLs };
    }, () => { this.updateGroupHash(); this.persistFormCache(); });
  };

  processQrImage = (elementId) => {
    return new Promise((resolve, reject) => {
      const svg = document.getElementById(elementId);
      if (!svg) return reject(new Error("QR Code not found"));

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      // Add white background for PNG transparency safety
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
           resolve(blob);
        }, "image/png");
      };

      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });
  }

  downloadQR = (elementId, filename) => {
    this.processQrImage(elementId).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }).catch(e => sbtLog.error(e));
  }

  copyQRImage = (elementId, indexKey) => {
     this.processQrImage(elementId).then(blob => {
        try {
            // Clipboard API usually requires secure context (https or localhost)
            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard.write([item]);
            if (!this._isMounted) return;
            this.setState({ copiedLinkIndex: indexKey });
            this.scheduleTrackedStateReset('copiedLinkIndex', { copiedLinkIndex: null }, 2000);
        } catch (err) {
            sbtLog.error("Clipboard write failed", err);
        }
     }).catch(e => sbtLog.error(e));
  }

  handleNetworkChange = async (event) => {
    const targetChainId = normalizePositiveChainId(event.target.value);
    if (!targetChainId) return;
    const nextChain = this.getAuthoringChainOptions().find((chain) => chain.id === targetChainId) ||
      getChainById(targetChainId) ||
      { id: targetChainId, name: `Chain ${targetChainId}` };
    if (window.ethereum && this.props.account) {
      try {
        // Hexlify the chain ID for the wallet request.
        const chainIdHex = ethers.utils.hexValue(Number(targetChainId));
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (error) {
        sbtLog.error('Failed to switch network', error);
        return;
      }
    }
    this.setState((currentState) => ({
      network: targetChainId,
      sbtDistribution: {
        ...currentState.sbtDistribution,
        network: nextChain,
      },
    }));
  };

/* FUNCTION: renderShareableBlock */
  renderShareableBlock = (title, tooltipText, description, url, qrId, fileSuffix, testId = null) => {
    const { copiedLinkIndex, sbtAddress } = this.state;
    const copyKeyUrl = `url_${qrId}`;
    const copyKeyImg = `img_${qrId}`;

    // Derive ID for the hidden high-res QR code
    const highResQrId = `${qrId}_high_res`;

    // Robust hiding style: keeps element in render tree so XMLSerializer captures dimensions correctly
    const hiddenStyle = {
      position: 'absolute',
      opacity: 0,
      pointerEvents: 'none',
      zIndex: -1,
      width: '1px',
      height: '1px',
      overflow: 'hidden'
    };

    return (
      <div className={styles.shareableBlock} {...(testId ? { 'data-testid': testId } : {})}>
        {/* Left Column: Title & URL */}
        <div className={styles.leftCol}>
          <h3 className={styles.blockTitle}>
            {title}
            {tooltipText && (
              <>
                <FontAwesomeIcon
                  icon={faQuestionCircle}
                  className={styles.tooltip}
                  id={`tt_${qrId}`}
                  style={{ opacity: 0.5, marginLeft: '8px', fontSize: '0.8em' }}
                />
                <CETooltip placement="right" target={`tt_${qrId}`} className={styles.tooltipBubble}>
                  {tooltipText}
                </CETooltip>
              </>
            )}
          </h3>

          <div className={styles.urlContainer}>
            <span className={styles.urlText} title={url}>{url}</span>
            <button
              onClick={() => this.copyToClipboard(url, copyKeyUrl)}
              className={styles.copyButton}
              title="Copy URL"
            >
              <FontAwesomeIcon icon={copiedLinkIndex === copyKeyUrl ? faCheck : faCopy} />
            </button>
          </div>
        </div>

        {/* Right Column: Compact QR & Actions */}
        <div className={styles.rightCol}>
          <div className={styles.qrCodeContainer}>
            {/* Visible Small QR (64px) */}
            <QRCodeSVG
              id={qrId}
              value={url}
              size={64}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level="L"
              includeMargin={false}
            />
            {/* Hidden High-Res QR (1024px) for Copy/Download */}
            <div style={hiddenStyle}>
              <QRCodeSVG
                id={highResQrId}
                value={url}
                size={1024}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level="L"
                includeMargin={true}
              />
            </div>
          </div>
          <div className={styles.qrActionsColumn}>
            <button
              className={styles.qrActionButton}
              onClick={() => this.copyQRImage(highResQrId, copyKeyImg)}
              title="Copy QR Image to Clipboard"
            >
              <FontAwesomeIcon icon={copiedLinkIndex === copyKeyImg ? faCheck : faClipboard} />
            </button>
            <button
              className={styles.qrActionButton}
              onClick={() => this.downloadQR(highResQrId, `ContextEngine_Sbt_${sbtAddress}_${fileSuffix}.png`)}
              title="Download QR Code"
            >
              <FontAwesomeIcon icon={faDownload} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const {
      sbtName,
      sbtDescription,
      sbtImageFile,
      sbtImageUrl,
      useImageUrl,
      sbtDistribution,
      imageUploaded,
      tokenURI,
      tokenUriUploaded,
      sbtMinted,
      sbtAddress,
      csvAddresses,
      tokenInfoCollapsed,
      mintOptionsCollapsed,
      distributionOptionsCollapsed,
      currentStep,
      mintingFailed,
      sbtInviteLinks,
      numInviteLinks,
      network,
      copiedLinkIndex,
      exportFormat,
      sbtSymbol,
      tags,
      currentTagInput,
      documentIDHashes,
      documentUrl,
      showTagsInput,
      imageLoadError,
      imageChooserStatusText,
      imageChooserStatusTone,
      documentURLs,
      startedMinting,
      groupPassword,
      shareableUrl,
      autoJoinUrl,
      openLockKey,
      metadataLockGateIds,
      showJson,
      copyJsonSuccess,
      create2Salt,
      predictableAddressEnabled,
      predictedAddressBusy
    } = this.state;

    const calendarStyles = { color: 'black' };
    const isPasswordDistribution =
      sbtDistribution.distributionOption === 'hasPasswords' ||
      sbtDistribution.distributionOption === 'groupPassword';
    const isLimitedWithPasswords = sbtDistribution.isLimited && isPasswordDistribution;
    const authoringChain = this.getSelectedAuthoringChain();
    const authoringChainId = authoringChain?.id || this.getSelectedAuthoringChainId() || '';

    // JSON Data for Preview
    const jsonData = {
      sbtName,
      sbtAddress,
      tokenURI: normalizeArweaveUrl(tokenURI),
      network: authoringChain?.name || (typeof network === 'string' ? network : ''),
      distribution: sbtDistribution.distributionOption,
      groupPassword: sbtDistribution.distributionOption === 'groupPassword' ? groupPassword : undefined,
      autoJoinUrl,
      shareableUrl
    };
    const metadataPreview = this.buildMetadataPreview();
    const deferredDeployMode = this.isDeferredDeployMode();
    const rootSurfaceStyle = deferredDeployMode
      ? { '--ce-create-group-surface-bg': DEFERRED_MODAL_SURFACE_BG }
      : undefined;
    const predictableAddressActive = this.isPredictableAddressEnabled();
    const predictableAddressLocked = deferredDeployMode || sbtDistribution.distributionOption === 'groupPassword';
    const openMintAutoJoinUrl = (
      sbtDistribution.distributionOption === 'anyoneCanMint'
        ? (autoJoinUrl || this.buildSessionAutoJoinUrl(sbtAddress))
        : ''
    );

    // Prepare chain options for dropdown
    const chainOptions = this.getAuthoringChainOptions();
    const { gateOptions, defaultGateId } = this.resolveLockGateOptions();
    const validGateIds = (Array.isArray(gateOptions) ? gateOptions : []).map((opt) => opt.id).filter(Boolean);
    const normalizedMetadataLocks = normalizeMetadataLockGateIds(metadataLockGateIds);
    const nameSelectedGateIds = this.normalizeSelectedGateIds(normalizedMetadataLocks.name, validGateIds);
    const descriptionSelectedGateIds = this.normalizeSelectedGateIds(normalizedMetadataLocks.description, validGateIds);
    const tagsSelectedGateIds = this.normalizeSelectedGateIds(normalizedMetadataLocks.tags, validGateIds);
    const docsSelectedGateIds = this.normalizeSelectedGateIds(normalizedMetadataLocks.documentURLs, validGateIds);
    const imageSelectedGateIds = this.normalizeSelectedGateIds(normalizedMetadataLocks.image, validGateIds);
    const trimmedImageUrl = String(sbtImageUrl || '').trim();
    const hasImagePreview = !!(sbtImageFile && !imageLoadError);
    const hasPendingImagePreview = useImageUrl && trimmedImageUrl.length > 0 && !hasImagePreview && !imageLoadError;
    const showImagePreviewError = useImageUrl && trimmedImageUrl.length > 0 && imageLoadError;
    const effectiveImageStatusText = imageChooserStatusText || (
      hasPendingImagePreview
        ? 'Loading preview...'
        : showImagePreviewError
          ? 'Image preview unavailable.'
          : ''
    );
    const effectiveImageStatusTone = imageChooserStatusText
      ? imageChooserStatusTone
      : hasPendingImagePreview
        ? 'loading'
        : showImagePreviewError
          ? 'error'
          : 'default';
    const renderFieldLock = (lockKey, fieldKey, selectedGateIds) => (
      <GateMultiSelectLock
        gateOptions={gateOptions}
        selectedGateIds={selectedGateIds}
        onChangeSelectedGateIds={(nextIds) => this.setLockGateIds(fieldKey, nextIds, validGateIds)}
        open={openLockKey === lockKey}
        onToggleOpen={(nextOpen) => this.toggleLockPopover({
          lockKey,
          fieldKey,
          nextOpen,
          selectedGateIds,
          defaultGateId,
          validGateIds,
        })}
        disabled={!gateOptions.length}
        showDots={false}
      />
    );

    // Calculate dirty state for "Clear" button visibility
    const isDirty =
      (sbtName && sbtName.trim().length > 0) ||
      (sbtDescription && sbtDescription.trim().length > 0) ||
      sbtImageFile ||
      (sbtImageUrl && sbtImageUrl.trim().length > 0) ||
      this.getNormalizedDocumentUrlDraft(documentUrl).length > 0 ||
      documentURLs.length > 0 ||
      nameSelectedGateIds.length > 0 ||
      descriptionSelectedGateIds.length > 0 ||
      tagsSelectedGateIds.length > 0 ||
      docsSelectedGateIds.length > 0 ||
      imageSelectedGateIds.length > 0 ||
      (create2Salt && create2Salt.trim().length > 0) ||
      tags.length > 0;
    const headerTitle = deferredDeployMode ? 'Add to Session' : 'Create';
    const createActionLabel = deferredDeployMode ? 'Add to Session' : 'Create';
    const distributionOptions = DISTRIBUTION_OPTION_CONFIGS.map((option) => ({
      ...option,
      selected: sbtDistribution.distributionOption === option.value,
    }));

    return (
      <div id={styles.createGroupExpanded} style={rootSurfaceStyle}>
        <div className={styles.headerContainer}>
          <h1 className={styles.createGroupTitle}>{headerTitle}</h1>
          <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="learnMoreTooltip" style={{opacity:0.5}} />
          <CETooltip placement="right" target="learnMoreTooltip" delay={{ show: 0, hide: 5000 }} className={styles.tooltipBubble}>
            {SBT_TOOLTIP_LABEL} enable groups to organize membership, roles, and permissions on-chain. <br />
            <a href="https://www.radicalxchange.org/wiki/social-identity/" target="_blank" rel="noopener noreferrer">
              Learn More
            </a>
          </CETooltip>

          {isDirty && !sbtMinted && (
             <button onClick={this.resetForm} className={styles.clearFormButton} title="Clear all fields and reset to defaults">
               <FontAwesomeIcon icon={faEraser} /> Clear
             </button>
          )}
        </div>

        {/* Visible error surface for contract rejections and other failures */}
        {this.state.error && String(this.state.error).trim() !== '' && (
          <div style={{
            margin: '10px 0 16px',
            padding: '10px 12px',
            border: '1px solid #dc3545',
            background: '#ffecec',
            color: '#a4000f',
            borderRadius: '6px',
            fontWeight: 600
          }}
            data-testid={E2E_TESTIDS.SBT_CREATE_ERROR}
          >
            {this.state.error}
          </div>
        )}

        <div className={styles.collapsibleSection}>
          {this.renderCollapsibleHeader('Info', 'tokenInfoCollapsed')}
          {!tokenInfoCollapsed && (
            <div className={styles.inputColumn}>
              <div className={styles.tokenInfoTopGrid}>
                <div className={styles.tokenInfoPrimaryColumn}>
                  <div className={styles.fieldLockRow} data-testid={E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW}>
                    <input
                      type="text"
                      name="sbtName"
                      value={sbtName}
                      onChange={this.handleInputChange}
                      placeholder="Name"
                      id={styles.sbtName}
                      data-testid={E2E_TESTIDS.SBT_CREATE_NAME_INPUT}
                    />
                    <div className={styles.fieldLockControl}>
                      {renderFieldLock('name', 'name', nameSelectedGateIds)}
                    </div>
                  </div>
                  {nameSelectedGateIds.length > 0 && (
                    <div className={styles.fieldHelpText}>
                      Locked names deploy with a public placeholder contract name like <code>CE-SBT-12</code> and render as {LOCKED_FIELD_MASK} until decrypted.
                    </div>
                  )}
                  <div className={styles.fieldLockRow} data-testid={E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW}>
                    <textarea
                      name="sbtDescription"
                      value={sbtDescription}
                      onChange={this.handleInputChange}
                      placeholder="Event / Group Description"
                      id={styles.sbtDescription}
                      className={styles.lockableTextarea}
                      rows="4"
                      data-testid={E2E_TESTIDS.SBT_CREATE_DESCRIPTION_INPUT}
                    />
                    <div className={styles.fieldLockControl}>
                      {renderFieldLock('description', 'description', descriptionSelectedGateIds)}
                    </div>
                  </div>
                </div>

                <div className={styles.tokenInfoCompactColumn}>
                  <div className={styles.imageUploadContainer} data-testid={E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW}>
                    <div className={styles.imageUploadHeader}>
                      <label className={styles.imageUploadLabel}>Image</label>
                      <div className={styles.fieldLockControl}>
                        {renderFieldLock('image', 'image', imageSelectedGateIds)}
                      </div>
                    </div>
                    <CompactImageChooser
                      isUrlMode={useImageUrl}
                      isUploadMode={!useImageUrl}
                      showUrlInput={useImageUrl}
                      urlValue={sbtImageUrl}
                      urlInputName="sbtImageUrl"
                      onUrlChange={this.handleInputChange}
                      onToggleUrlMode={() => this.setImageUploadMethod(true)}
                      onPaste={this.handlePasteImage}
                      onUploadClick={this.openImageUploadPicker}
                      onFileChange={this.handleImageUpload}
                      fileInputRef={(fileInput) => { this.fileInput = fileInput; }}
                      fileInputTestId={E2E_TESTIDS.SBT_CREATE_IMAGE_FILE_INPUT}
                      pasteButtonTestId={E2E_TESTIDS.SBT_CREATE_IMAGE_PASTE}
                      urlInputTestId={E2E_TESTIDS.SBT_CREATE_IMAGE_URL_INPUT}
                      urlPlaceholder="Paste image URL"
                      urlInputAriaLabel="Image URL"
                      selectedFileLabel={!useImageUrl && sbtImageFile ? sbtImageFile.name : ''}
                      previewFile={hasImagePreview ? sbtImageFile : null}
                      previewAlt="SBT artwork preview"
                      onClear={this.resetImage}
                      statusText={effectiveImageStatusText}
                      statusTone={effectiveImageStatusTone}
                      helpText={imageSelectedGateIds.length > 0
                        ? 'URL mode encrypts the image URL. Upload mode encrypts the image bytes into a Lit-Arweave asset.'
                        : ''}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.tokenInfoMetaGrid}>
                <div className={styles.tokenInfoMetaCard} data-testid={E2E_TESTIDS.SBT_CREATE_DOCS_LOCK_ROW}>
                  <div id={styles.addDocUrlSection} className={styles.docUrlField}>
                    <input
                      type="text"
                      name="documentUrl"
                      value={documentUrl}
                      onChange={this.handleInputChange}
                      onKeyDown={this.handleDocUrlKeyDown}
                      placeholder="Document URL"
                      aria-label="Document URL"
                      data-testid={E2E_TESTIDS.SBT_CREATE_DOC_URL_INPUT}
                    />
                    <button
                      type="button"
                      onClick={this.addDocumentURL}
                      disabled={documentUrl.trim() === '' || documentURLs.length >= 10}
                      className={styles.addDocUrlActionButton}
                      data-testid={E2E_TESTIDS.SBT_CREATE_DOC_URL_ADD}
                    >
                      <FontAwesomeIcon icon={faPlus} id={styles.addDocUrlButton} />
                    </button>
                    <div className={`${styles.fieldLockControl} ${styles.inlineFieldLockControl}`}>
                      {renderFieldLock('docs', 'documentURLs', docsSelectedGateIds)}
                    </div>
                  </div>
                  {documentURLs.length > 0 && (
                    <ul className={styles.docUrlList}>
                      {documentURLs.map((url, index) => (
                        <li key={index}>
                          <span>{url}</span>
                          <button type="button" onClick={() => this.removeDocumentURL(index)}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div
                  className={`${styles.fieldSection} ${styles.tokenInfoMetaCard}`}
                  data-testid={E2E_TESTIDS.SBT_CREATE_TAGS_LOCK_ROW}
                >
                  <div className={styles.tagsContainer}>
                    <div className={styles.tagsInlineRow}>
                      <div className={styles.tagInputGroup}>
                        <input
                          type="text"
                          className={styles.tagInput}
                          value={currentTagInput}
                          onChange={(e) => this.setState({ currentTagInput: e.target.value })}
                          onKeyDown={this.handleTagInputKeyDown}
                          placeholder="Add tag..."
                          aria-label="Add tag"
                          data-testid={E2E_TESTIDS.SBT_CREATE_TAG_INPUT}
                        />
                        {currentTagInput && currentTagInput.trim().length > 0 && (
                          <button
                            type="button"
                            className={styles.addTagButton}
                            onClick={this.handleAddTag}
                            data-testid={E2E_TESTIDS.SBT_CREATE_TAG_ADD}
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                        )}
                      </div>
                      <div className={`${styles.fieldLockControl} ${styles.inlineFieldLockControl}`}>
                        {renderFieldLock('tags', 'tags', tagsSelectedGateIds)}
                      </div>
                    </div>
                    {tags.length > 0 && tags.map((tag, index) => (
                      <span key={index} className={styles.tagPill}>
                        {tag}
                        <FontAwesomeIcon
                          icon={faTimes}
                          className={styles.removeTagIcon}
                          onClick={() => this.removeTag(index)}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.collapsibleSection}>
          {this.renderCollapsibleHeader(`${t('mint')} Options`, 'mintOptionsCollapsed')}
          {!mintOptionsCollapsed && (
            <div className={styles.sbtTokenOptions}>

              {/* Top Row: Limited & Time-Limited Cards */}
              <div className={styles.optionsGrid}>
                {/* 1. Limited Tokens Card */}
                <div className={`${styles.optionCard} ${sbtDistribution.isLimited ? styles.activeOption : ''}`}>
                  <label className={styles.optionHeader}>
                    <input
                      type="checkbox"
                      name="sbtDistribution.isLimited"
                      checked={sbtDistribution.isLimited}
                      onChange={this.handleInputChange}
                    />
                    <span>Limited Tokens</span>
                    <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="limitedNumberTooltip" style={{opacity:0.5}} />
                    <CETooltip placement="right" target="limitedNumberTooltip" className={styles.tooltipBubble}>
                      {`Specify the maximum number of ${t('sbts')} that can be ${t('mintedLower')}.`}
                    </CETooltip>
                  </label>

                  {sbtDistribution.isLimited && (
                    <div className={styles.optionBody}>
                      <input
                        type="number"
                        name="sbtDistribution.limitedNumber"
                        value={sbtDistribution.limitedNumber}
                        onChange={this.handleInputChange}
                        placeholder="Qty (e.g. 100)"
                        className={styles.inlineNumberInput}
                      />
                    </div>
                  )}
                </div>

                {/* 2. Time-Limited Card */}
                <div className={`${styles.optionCard} ${sbtDistribution.isTimeLimited ? styles.activeOption : ''}`}>
                  <label className={styles.optionHeader}>
                    <input
                      type="checkbox"
                      name="sbtDistribution.isTimeLimited"
                      checked={sbtDistribution.isTimeLimited}
                      onChange={this.handleInputChange}
                    />
                    <span>Time-Limited</span>
                    <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="timeLimitedTooltip" style={{opacity:0.5}} />
                    <CETooltip placement="right" target="timeLimitedTooltip" className={styles.tooltipBubble}>
                      Set an end time for the minting period.
                    </CETooltip>
                  </label>

                  {sbtDistribution.isTimeLimited && (
                    <div className={styles.timeLimitedOptions}>
                      <CEDateTimeInput
                        selected={sbtDistribution.mintingEndTime}
                        onChange={this.handleMintingEndTimeChange}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        timeCaption="time"
                        dateFormat="MMMM d, yyyy h:mm aa"
                        calendarClassName={styles.blackText}
                        style={calendarStyles}
                        placeholderText="Select End Date"
                        // className={styles.datePickerInput}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.settingsStack}>
                <div className={styles.settingRow}>
                  <div className={styles.settingCopy}>
                    <span className={styles.settingLabel}>
                      {`${t('burn')} Auth`}
                      <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="burnAuthTooltip" style={{opacity:0.5}} />
                    </span>
                    <CETooltip placement="right" target="burnAuthTooltip" className={styles.tooltipBubble}>
                      Specify who can burn the token.
                    </CETooltip>
                  </div>
                  <select
                    name="sbtDistribution.burnAuth"
                    value={sbtDistribution.burnAuth}
                    onChange={this.handleBurnAuthChange}
                    className={styles.compactSelect}
                  >
                    <option value="AdminOnly">Admin Only</option>
                    <option value="OwnerOnly">Owner Only</option>
                    <option value="Both">Both</option>
                    <option value="Neither">Neither</option>
                  </select>
                </div>

                <div className={styles.settingRow}>
                  <div className={styles.settingCopy}>
                    <span className={styles.settingLabel}>
                      Admin Address
                      <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="burnAdminTooltip" style={{opacity:0.5}} />
                    </span>
                    <CETooltip placement="right" target="burnAdminTooltip" className={styles.tooltipBubble}>
                      Enter the address that can burn the token.
                    </CETooltip>
                  </div>
                  <input
                    type="text"
                    name="sbtDistribution.burnAdmin"
                    value={sbtDistribution.burnAdmin}
                    onChange={this.handleInputChange}
                    placeholder="0x... (default: deployer)"
                    className={styles.compactTextInput}
                  />
                </div>

                {!this.shouldHideNetworkSelector() ? (
                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <span className={styles.settingLabel}>
                        Network
                        <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="networkTooltip" style={{opacity:0.5}} />
                      </span>
                      <CETooltip placement="right" target="networkTooltip" className={styles.tooltipBubble}>
                        Select the network for minting.
                      </CETooltip>
                    </div>
                    <select
                      className={styles.compactSelect}
                      value={authoringChainId}
                      onChange={this.handleNetworkChange}
                    >
                      {chainOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className={styles.settingRow}>
                    <div className={styles.settingCopy}>
                      <span className={styles.settingLabel}>Network</span>
                    </div>
                    <span className={styles.readonlyPill}>{authoringChain?.name || 'Session chain'}</span>
                  </div>
                )}

                <div className={`${styles.settingRow} ${styles.settingToggleRow} ${predictableAddressActive ? styles.settingRowActive : ''}`}>
                  <label className={styles.settingToggleLabel}>
                    <input
                      type="checkbox"
                      checked={predictableAddressActive}
                      disabled={predictableAddressLocked}
                      onChange={(e) => this.setState(
                        { predictableAddressEnabled: e.target.checked },
                        () => {
                          this.persistFormCache();
                          this.schedulePredictedAddressRefresh();
                        }
                      )}
                      data-testid={E2E_TESTIDS.SBT_CREATE_PREDICTABLE_TOGGLE}
                    />
                    <span className={styles.settingCopy}>
                      <span className={styles.settingLabel}>
                        Make address predictable before deploy
                        <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="create2SaltTooltip" style={{opacity:0.5}} />
                      </span>
                    </span>
                    <CETooltip placement="right" target="create2SaltTooltip" className={styles.tooltipBubble}>
                      {`Use deterministic deployment so the ${t('sbt')} address is known before on-chain creation.`}
                    </CETooltip>
                  </label>
                  {predictableAddressActive && (
                    <div className={styles.settingRowDetails}>
                      <div className={styles.addressPreviewRow}>
                        <span className={styles.previewLabel}>Predicted address</span>
                        <code
                          className={styles.addressPreviewValue}
                          data-testid={E2E_TESTIDS.SBT_CREATE_PREDICTED_ADDRESS}
                        >
                          {this.getPredictedAddressDisplayText()}
                        </code>
                      </div>
                      {predictedAddressBusy && (
                        <div className={styles.fieldHelpText}>Calculating address…</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        <div className={styles.collapsibleSection}>
          {this.renderCollapsibleHeader('Distribution Options', 'distributionOptionsCollapsed')}
          {!distributionOptionsCollapsed && (
            <div className={styles.distributionSection}>
              <div className={styles.distributionGrid}>
                {distributionOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`${styles.distributionCard} ${option.selected ? styles.distributionCardActive : ''}`}
                  >
                    <span className={styles.distributionCardTop}>
                      <span className={styles.distributionChoice}>
                        <input
                          type="radio"
                          name="sbtDistribution.distributionOption"
                          value={option.value}
                          checked={option.selected}
                          onChange={this.handleInputChange}
                        />
                        <span>{option.label}</span>
                      </span>
                      <span className={styles.distributionTooltipWrap}>
                        <FontAwesomeIcon
                          icon={faQuestionCircle}
                          className={styles.tooltip}
                          id={option.tooltipId}
                          style={{ opacity: 0.5 }}
                        />
                        <CETooltip placement="right" target={option.tooltipId} className={styles.tooltipBubble}>
                          {option.tooltipText}
                        </CETooltip>
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {sbtDistribution.distributionOption === 'groupPassword' && (
                <div className={styles.groupPasswordInputContainer}>
                  <input
                    type="text"
                    name="groupPassword"
                    value={groupPassword}
                    onChange={this.handleInputChange}
                    placeholder="Enter the group password"
                    className={styles.groupPasswordInput}
                  />
                </div>
              )}

              <label className={styles.distributionCheckboxRow}>
                <span className={styles.distributionChoice}>
                  <input
                    type="checkbox"
                    name="sbtDistribution.unlisted"
                    checked={sbtDistribution.unlisted}
                    onChange={this.handleInputChange}
                  />
                  <span>Unlisted</span>
                </span>
                <span className={styles.distributionTooltipWrap}>
                  <FontAwesomeIcon
                    icon={faQuestionCircle}
                    className={styles.tooltip}
                    id="unlistedTooltip"
                    style={{opacity:0.5}}
                  />
                  <CETooltip placement="right" target="unlistedTooltip" className={styles.tooltipBubble}>
                    {`If checked, the ${t('sbtLower')} will not appear in the public list but will still be discoverable via the Arweave transaction if not encrypted.`}
                  </CETooltip>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className={styles.mintingSteps}>
          <button
            onClick={this.handleMintClick}
            disabled={sbtMinted || startedMinting}
            data-testid={E2E_TESTIDS.SBT_CREATE_SUBMIT}
            className={styles.primaryCreateButton}
          >
            <span className={styles.primaryCreateButtonContent}>
              {sbtMinted ? `${t('minted')}!` :
               currentStep === 0 ? createActionLabel :
               currentStep === 1 ? 'Uploading Image...' :
               currentStep === 2 ? 'Uploading URI...' :
               currentStep === 3 ? (deferredDeployMode ? 'Saving Draft...' : `${t('minting')}...`) :
               createActionLabel}
              {mintingFailed && currentStep > 0 && <FontAwesomeIcon icon={faExclamationCircle} style={{ color: 'red' }} />}
            </span>
          </button>

          {sbtMinted && (
             <button
               onClick={this.resetForm}
               className={styles.startFreshBtn}
               title="Reset form to start fresh"
             >
               Create New (Start Fresh)
             </button>
          )}
        </div>

        <div className={styles.jsonPreviewBlock}>
          <JsonDisplay data={metadataPreview} label="View .json" />
        </div>

        {startedMinting && (
          <div className={styles.progressIndicator}>
            <div className={currentStep >= 1 ? styles.stepCompleted : styles.step}>
              <FontAwesomeIcon icon={currentStep === 1 ? faSpinner : currentStep > 1 ? faCheck : faExclamationCircle} spin={currentStep === 1} />
              <span>Upload Image</span>
            </div>
            <div className={currentStep >= 2 ? styles.stepCompleted : styles.step}>
              <FontAwesomeIcon icon={currentStep === 2 ? faSpinner : currentStep > 2 ? faCheck : faExclamationCircle} spin={currentStep === 2} />
              <span>Upload URI</span>
            </div>
            <div className={currentStep >= 3 ? styles.stepCompleted : styles.step}>
              <FontAwesomeIcon icon={currentStep === 3 && !sbtMinted ? faSpinner : currentStep >= 3 ? faCheck : faExclamationCircle} spin={currentStep === 3 && !sbtMinted} />
              <span>{t('mint')}</span>
            </div>
          </div>
        )}

        {startedMinting && (
          <div className={styles.sbtContractAddress}>
            <span>Contract Address: </span>
            {sbtAddress ? (
              <a href={this.buildSbtPagePath(sbtAddress)} target="_blank" rel="noopener noreferrer">
                <FontAwesomeIcon icon={faExternalLinkAlt} /> {`Page (${sbtAddress})`}
              </a>
            ) : (
              <span>-</span>
            )}
          </div>
        )}

        {sbtMinted && (
          <div className={styles.surveySubmissionConfirmation} data-testid={E2E_TESTIDS.SBT_CREATE_SUCCESS}>
            <h3>Created</h3>

            {/* Compact Actions Row */}
            <div className={styles.successActionsRow}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={this.copySbtLinkToClipboard}
                title="Copy Link to Page"
              >
                <FontAwesomeIcon
                  icon={this.state.copyLinkSuccess ? faCheck : faClipboard}
                  style={{ marginRight: '5px' }}
                />
                Copy Link
              </button>

              {/* Copy QR button */}
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => this.copyQRImage("hidden-page-qr", "page_qr_copy")}
                title="Copy QR for Page Link"
              >
                 <FontAwesomeIcon icon={this.state.copiedLinkIndex === "page_qr_copy" ? faCheck : faQrcode} style={{ marginRight: '5px' }} />
                 Copy QR
              </button>

              <a
                href={this.buildSbtPagePath(sbtAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.actionBtn} ${styles.actionLink}`}
                title="Open Page in New Tab"
                data-testid={E2E_TESTIDS.SBT_CREATE_SUCCESS_PAGE_LINK}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
                View Page
              </a>

              {tokenURI && (
                <a
                  href={normalizeArweaveUrl(tokenURI)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.actionBtn} ${styles.actionLink}`}
                  title="View on Arweave"
                  data-testid={E2E_TESTIDS.SBT_CREATE_SUCCESS_ARWEAVE_LINK}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  Arweave
                </a>
              )}

              <button
                type="button"
                onClick={() => this.bookmarkSBT(sbtAddress)}
                className={styles.actionBtn}
                title="Bookmark"
              >
                <FontAwesomeIcon
                  icon={faBookmark}
                  style={{ color: this.state.bookmarkedSbtsSet.has(String(sbtAddress).toLowerCase()) ? '#ffe082' : undefined }}
                />
                Bookmark
              </button>

              <button
                type="button"
                onClick={this.copySbtIdToClipboard}
                className={styles.actionBtn}
                title="Copy Address"
              >
                <FontAwesomeIcon icon={this.state.copyIdSuccess ? faCheck : faClipboard} />
                {this.state.copyIdSuccess ? 'Copied!' : 'Copy ID'}
              </button>
            </div>

            {/* Hidden QR Code for the Page Link (Used by the top row button) */}
            <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -1, width: '1px', height: '1px', overflow: 'hidden' }}>
              <QRCodeSVG
                id="hidden-page-qr"
                value={shareableUrl}
                size={1024}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level="L"
                includeMargin={true}
              />
            </div>

            {/* Visual QR Blocks: "Auto-Join" only. "Page Link" block is removed. */}
            {openMintAutoJoinUrl && (
                <>
                    {/* Auto-Join URL */}
                    {this.renderShareableBlock(
                      "URL Where Anyone Can Join",
                      "Anyone with this link can open the session page and trigger the open-mint flow immediately.",
                      null,
                      openMintAutoJoinUrl,
                      "qr-code-auto-join",
                      "autojoin",
                      E2E_TESTIDS.SBT_CREATE_OPEN_MINT_URL
                    )}
                </>
            )}

            {sbtDistribution.distributionOption === 'groupPassword' && (
                <>
                    {/* Auto-Join URL (Group Password) */}
                    {this.renderShareableBlock(
                      sbtDistribution.isLimited ? "Auto-Join URL (Group Password)" : "Auto-Join URL (One-Click)",
                      "Password embedded - use with caution. Anyone with this link can join immediately.",
                      null,
                      autoJoinUrl,
                      "qr-code-one-click",
                      "oneclick"
                    )}
                </>
            )}

            <JsonButtonRow align="center">
              <JsonToggleButton
                label={showJson ? 'Hide JSON' : 'Show JSON'}
                active={showJson}
                onClick={this.toggleShowJson}
              />
            </JsonButtonRow>
          </div>
        )}

        {/* JSON preview area */}
        {showJson && sbtMinted && (
          <JsonPanel
            as="pre"
            onCopy={() => this.copyJsonPreview(jsonData)}
            copied={copyJsonSuccess}
            copyTitle="Copy JSON"
          >
            {JSON.stringify(jsonData, null, 2)}
          </JsonPanel>
        )}

        {sbtMinted &&
          sbtDistribution.distributionOption === 'hasPasswords' &&
          sbtInviteLinks.length > 0 && (
          <div className={styles.sbtInviteLinks}>
            <h3>Invite Links:</h3>
            <ul>
              {sbtInviteLinks.map((link, index) => (
                <li key={index} className={styles.inviteLinkItem}>
                  <span className={styles.inviteLink}>{link}</span>
                  <button onClick={() => this.copyToClipboard(link, index)} className={styles.copyButton}>
                    <FontAwesomeIcon icon={copiedLinkIndex === index ? faCheck : faClipboard} />
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.exportOptions}>
              <select value={exportFormat} onChange={this.handleExportFormatChange} className={styles.exportFormatSelect}>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <button onClick={this.exportPasswords} className={styles.exportButton}>Export Passwords</button>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export const finalizeDeferredCreateSbtDraftUpload = async ({
  authoringPayload = null,
  componentProps = {},
} = {}) => {
  if (!authoringPayload || typeof authoringPayload !== 'object') {
    throw new Error('Pending SBT draft authoring payload is missing.');
  }

  const instance = new CreateSBTGroup({
    deferredDeploy: true,
    hideNetworkSelector: true,
    loginComplete: true,
    toggleLoginModal: () => {},
    ...componentProps,
  });
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  instance._isMounted = true;

  if (!instance.applyAuthoringPayload(authoringPayload)) {
    throw new Error('Pending SBT draft authoring payload is invalid.');
  }

  await instance.uploadImageToArweave();
  const tokenURI = String(await instance.uploadTokenUriToArweave()).trim();
  if (!tokenURI) {
    throw new Error('Pending SBT draft metadata upload did not return a token URI.');
  }

  return {
    tokenURI,
    metadataPreview: instance.buildMetadataPreview(),
    authoringPayload: await instance.buildSerializableAuthoringPayload(),
  };
};

export default CreateSBTGroup;
