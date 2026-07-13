import { AUTHORITY_MATRIX } from '../../utilities/session/sessionAuthorityMatrix.js';
import {
  normalizeLitMetadataNetwork,
  normalizeSessionNaming,
  stripAuthoritativeSessionGateFields,
} from '../../utilities/session/sessionMetadata.js';
import { normalizeBlockLimitsForConfig } from '../../utilities/session/blockLimits.js';
import { SESSION_WORKER_METADATA_ALIAS_KEYS } from '../../utilities/session/sessionWorkerUrlCompatibility.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import {
  getSessionWizardContractDefaults,
  getVisibleSessionWizardContractKeys,
  sanitizeSessionWizardContracts,
} from './sessionWizardContracts.js';
import {
  SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS,
  buildSessionWizardRegistrySessionFields,
  cloneValue,
  isObj,
  trimString,
} from '../../domains/sessions/registry/sessionRegistryWriteNormalization.js';
import { buildWorkerLitCredentialsConfig } from './sessionWizardWorkerSecretSupport';
import {
  isWorkerSbtGateCloudflareStorageProfile,
  normalizeSessionStorageProfileConfig,
} from './sessionWizardStorageProfile';
import {
  compileSessionModeProfile,
  hasLegacyTelegramFirstSessionFlags,
  mergeSessionModeProfileStorageAccess,
  profileFromLegacyConfig,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import type {
  AnyRecord,
  ChainIdLike,
  SessionContractLike,
  SessionContractsLike,
  WorkerSecretsLike,
} from '../shellTypes';

const WORKER_METADATA_ALIAS_KEYS = Object.freeze([
  ...SESSION_WORKER_METADATA_ALIAS_KEYS,
  'rpcUrlsByChainId',
  'scopes',
  'embeddedDeployHelperEnabled',
  'deployHelperEnabled',
]);

export { SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS, buildSessionWizardRegistrySessionFields };

const orderMetadataFields = (metadata: AnyRecord, fieldOrder: string[] = []): AnyRecord => {
  if (!isObj(metadata)) return metadata;
  const ordered: AnyRecord = {};
  (Array.isArray(fieldOrder) ? fieldOrder : []).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      ordered[key] = metadata[key];
    }
  });
  Object.keys(metadata).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = metadata[key];
    }
  });
  return ordered;
};

const stripWorkerOnlyMetadataFields = (metadata: AnyRecord): AnyRecord => {
  if (!isObj(metadata)) return metadata;
  const next = cloneValue(metadata);
  [...AUTHORITY_MATRIX.workerConfig.fields, ...WORKER_METADATA_ALIAS_KEYS].forEach((key) => {
    delete next[key];
  });
  return next;
};

const defaultNormalizeAiProvider = (value: unknown, fallback = 'openai'): string => {
  const lowered = trimString(value).toLowerCase();
  return lowered || fallback;
};

const defaultNormalizeAiModels = (raw: AnyRecord = {}): AnyRecord => (isObj(raw) ? cloneValue(raw) : {});

const defaultNormalizeAiModelForProvider = (_modelType: string, _providerValue: string, modelValue: unknown): string =>
  trimString(modelValue);

const buildSessionWizardPublicAiConfig = (value: unknown): AnyRecord => {
  const next = isObj(value) ? (cloneValue(value) as AnyRecord) : {};
  if (!isObj(next.models) || !isObj(next.models.transcription)) return next;

  const transcription = next.models.transcription as AnyRecord;
  // The draft keeps a browser-side transcription endpoint, including an empty
  // default. Worker config is public and provider endpoints belong in secrets.
  next.models.transcription = {
    ...(trimString(transcription.provider) ? { provider: trimString(transcription.provider) } : {}),
    ...(trimString(transcription.model) ? { model: trimString(transcription.model) } : {}),
  };
  return next;
};

export const sanitizeSessionWizardMetadataPayload = (
  metadata: AnyRecord,
  {
    fieldOrder = [],
    sanitizeContracts = sanitizeSessionWizardContracts,
    normalizeAiProvider = defaultNormalizeAiProvider,
    normalizeAiModels = defaultNormalizeAiModels,
    normalizeAiModelForProvider = defaultNormalizeAiModelForProvider,
    defaultAiModels = {},
  }: {
    fieldOrder?: string[];
    sanitizeContracts?: (contracts: SessionContractsLike) => SessionContractsLike;
    normalizeAiProvider?: (value: unknown, fallback?: string) => string;
    normalizeAiModels?: (raw?: AnyRecord, fallbackProvider?: string, transcription?: unknown) => AnyRecord;
    normalizeAiModelForProvider?: (modelType: string, providerValue: string, modelValue: unknown) => string;
    defaultAiModels?: AnyRecord;
  } = {},
): AnyRecord => {
  if (!isObj(metadata)) return metadata;

  let next = cloneValue(metadata) as AnyRecord;
  next = stripAuthoritativeSessionGateFields(next) as AnyRecord;
  next = stripWorkerOnlyMetadataFields(next) as AnyRecord;
  next = normalizeLitMetadataNetwork(next) as AnyRecord;
  next = normalizeSessionNaming(next) as AnyRecord;
  next.sessionName = trimString(next.sessionName);
  next.sessionInfo = trimString(next.sessionInfo);
  delete next.telegram_only;
  if (!next.sessionModeProfile && hasLegacyTelegramFirstSessionFlags(next)) {
    next.sessionModeProfile = profileFromLegacyConfig(next);
  }
  delete next.telegramOnly;
  delete next.telegramMode;
  delete next.telegramBridgeEnabled;
  delete next.sessionMode;
  if (isObj(next.telegram)) {
    delete next.telegram.only;
    delete next.telegram.mode;
    if (!Object.keys(next.telegram).length) delete next.telegram;
  }
  if (!next.sessionName) delete next.sessionName;
  if (!next.sessionInfo) delete next.sessionInfo;
  if (!next.sessionInfoEncrypted) delete next.sessionInfoEncrypted;

  const headerCandidate = trimString(next.sessionHeader || next.sessionHeaderImg);
  if (headerCandidate) {
    next.sessionHeaderImg = headerCandidate;
  } else {
    delete next.sessionHeaderImg;
  }
  delete next.sessionHeader;
  delete next.orgHeader;
  delete next.orgHeaderImg;
  delete next.orderHeaderImg;

  if (isObj(next.ai)) {
    const ai = next.ai as AnyRecord;
    const fallbackProvider = normalizeAiProvider(ai.mode || ai.provider || 'openai');
    ai.models = normalizeAiModels(ai.models, fallbackProvider, ai.transcription);
    if (isObj(ai.models?.fast)) {
      const provider = normalizeAiProvider(ai.models.fast.provider || fallbackProvider || 'openai');
      ai.models.fast.provider = provider;
      ai.models.fast.model = normalizeAiModelForProvider(
        'fast',
        provider,
        ai.models.fast.model || defaultAiModels.fast,
      );
    }
    if (isObj(ai.models?.thinking)) {
      const provider = normalizeAiProvider(ai.models.thinking.provider || fallbackProvider || 'openai');
      ai.models.thinking.provider = provider;
      ai.models.thinking.model = normalizeAiModelForProvider(
        'thinking',
        provider,
        ai.models.thinking.model || defaultAiModels.thinking,
      );
    }
    delete ai.mode;
    delete ai.provider;
    delete ai.providers;
    delete ai.transcription;
    if (isObj(ai.models?.transcription)) {
      ai.models.transcription = {
        provider: normalizeAiProvider(ai.models.transcription.provider || 'openai'),
        model: trimString(ai.models.transcription.model || 'whisper-1'),
      };
    }
  }

  if (isObj(next.sessionModeProfile)) {
    const sessionModeProfile = mergeSessionModeProfileStorageAccess(
      next.sessionModeProfile as SessionModeProfile,
      next.storageProfile,
    );
    next.sessionModeProfile = sessionModeProfile;
    const compiled = compileSessionModeProfile(sessionModeProfile);
    next.storageProfile = normalizeSessionStorageProfileConfig(compiled.storageProfile);
  } else if (Object.prototype.hasOwnProperty.call(next, 'storageProfile')) {
    next.storageProfile = normalizeSessionStorageProfileConfig(next.storageProfile);
  }

  if (isObj(next.faucet)) {
    delete next.faucet.rpcUrl;
    delete next.faucet.privateKey;
    delete next.faucet.encryptedPrivateKey;
  }

  if (isObj(next.blockLimits)) {
    const start = Number(next.blockLimits.start);
    const endRaw = next.blockLimits.end;
    const end = endRaw == null || endRaw === '' ? null : Number(endRaw);
    if (!Number.isFinite(start) || start <= 0) {
      throw new Error('Session config requires blockLimits.start (positive block number).');
    }
    next.blockLimits.start = start;
    next.blockLimits.end = typeof end === 'number' && Number.isFinite(end) && end > 0 && end >= start ? end : null;
  } else if (Object.prototype.hasOwnProperty.call(next, 'blockLimits')) {
    throw new Error('Session config requires blockLimits.start (positive block number).');
  }

  if (isObj(next.contracts)) {
    next.contracts = sanitizeContracts(next.contracts as SessionContractsLike);
  }

  return orderMetadataFields(next, fieldOrder);
};

export const resolveSessionWizardWorkerStorageProfilePayload = ({
  draft = {},
  deployPayload = {},
}: {
  draft?: AnyRecord | null;
  deployPayload?: AnyRecord | null;
} = {}): {
  storageProfile: AnyRecord;
  sessionModeProfile: SessionModeProfile | null;
} => {
  const resolvedDraft = isObj(draft) ? draft : {};
  const resolvedDeployPayload = isObj(deployPayload) ? deployPayload : {};
  const rawStorageProfile = resolvedDraft.storageProfile || resolvedDeployPayload.storageProfile;
  const sessionModeProfile = isObj(resolvedDraft.sessionModeProfile)
    ? (resolvedDraft.sessionModeProfile as SessionModeProfile)
    : hasLegacyTelegramFirstSessionFlags(resolvedDraft)
      ? profileFromLegacyConfig(resolvedDraft)
      : null;
  const effectiveSessionModeProfile = sessionModeProfile
    ? mergeSessionModeProfileStorageAccess(sessionModeProfile, rawStorageProfile)
    : null;
  const compiledProfile = effectiveSessionModeProfile ? compileSessionModeProfile(effectiveSessionModeProfile) : null;
  const storageProfile = normalizeSessionStorageProfileConfig(compiledProfile?.storageProfile || rawStorageProfile);
  return {
    storageProfile,
    sessionModeProfile: effectiveSessionModeProfile,
  };
};

export const buildSessionWizardWorkerConfigPayload = ({
  slug = '',
  draft = {},
  deployPayload = {},
  workerSecrets = {},
  account = '',
  registryAddress = '',
  registryChainId = 0,
  networkChainId = 0,
  sessionId = '',
  latestChainBlock = null,
  workerUrl = '',
  resolveWorkerFaucetConfig = () => ({}),
  normalizeBlockLimits = normalizeBlockLimitsForConfig,
  getContractDefaults = getSessionWizardContractDefaults,
  getVisibleContractKeys = getVisibleSessionWizardContractKeys,
}: {
  slug?: string;
  draft?: AnyRecord;
  deployPayload?: AnyRecord;
  workerSecrets?: WorkerSecretsLike;
  account?: string;
  registryAddress?: string;
  registryChainId?: ChainIdLike;
  networkChainId?: ChainIdLike;
  sessionId?: string;
  latestChainBlock?: number | null;
  workerUrl?: string;
  resolveWorkerFaucetConfig?: () => AnyRecord;
  normalizeBlockLimits?: (blockLimits: unknown, latestBlock?: number | null) => AnyRecord | null;
  getContractDefaults?: (chainId: number) => AnyRecord;
  getVisibleContractKeys?: () => string[];
} = {}): AnyRecord => {
  const resolvedDraft = isObj(draft) ? draft : {};
  const resolvedDeployPayload = isObj(deployPayload) ? deployPayload : {};
  const chainId = Number(registryChainId || resolvedDraft.networkChainId || networkChainId || 0) || 0;
  const normalizedContracts: SessionContractsLike = {};
  const defaults = (getContractDefaults(chainId) || {}) as Record<string, SessionContractLike>;
  const draftContracts = isObj(resolvedDraft.contracts) ? (resolvedDraft.contracts as SessionContractsLike) : {};

  getVisibleContractKeys().forEach((key) => {
    const fromDraft = isObj(draftContracts[key]) ? draftContracts[key] : {};
    const address = trimString(fromDraft.address || defaults?.[key] || '');
    const contractChainId = Number(fromDraft.chainId || chainId || 0) || 0;
    if (!address) return;
    normalizedContracts[key] = {
      address,
      ...(contractChainId ? { chainId: contractChainId } : {}),
    };
  });

  const { storageProfile, sessionModeProfile: effectiveSessionModeProfile } =
    resolveSessionWizardWorkerStorageProfilePayload({
      draft: resolvedDraft,
      deployPayload: resolvedDeployPayload,
    });
  const modeRequirements = resolveSessionWizardModeRequirements(effectiveSessionModeProfile);
  const isWorkerCanonical = modeRequirements.isWorkerCanonical;
  const workerAuthority = isObj(resolvedDeployPayload.workerAuthority)
    ? cloneValue(resolvedDeployPayload.workerAuthority)
    : isWorkerCanonical
      ? {
          version: 1,
          participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'],
          anonymousScopes: [],
        }
      : undefined;
  const next: AnyRecord = {
    slug: trimString(slug),
    adminAddress: trimString(resolvedDeployPayload.adminAddress || account),
    sessionName: trimString(resolvedDraft.sessionName),
    sessionInfo: trimString(resolvedDraft.sessionInfo),
    sessionHeaderImg: trimString(resolvedDraft.sessionHeaderImg),
    ai: buildSessionWizardPublicAiConfig(resolvedDraft.ai),
    registryAddress: isWorkerCanonical ? '' : trimString(resolvedDeployPayload.registryAddress || registryAddress),
    registryChainId: isWorkerCanonical
      ? 0
      : Number(resolvedDeployPayload.registryChainId || registryChainId || chainId || 0) || 0,
    networkChainId: modeRequirements.requiresRpc ? chainId || null : isWorkerCanonical ? null : chainId || null,
    corsWorkerUrl: trimString(workerUrl || resolvedDeployPayload.corsWorkerUrl || resolvedDraft.corsWorkerUrl),
    rpcUrl: !isWorkerCanonical || modeRequirements.requiresRpc ? trimString(resolvedDeployPayload.rpcUrl) : '',
    rpcUrlsByChainId:
      (!isWorkerCanonical || modeRequirements.requiresRpc) && isObj(resolvedDeployPayload.rpcUrlsByChainId)
        ? cloneValue(resolvedDeployPayload.rpcUrlsByChainId)
        : {},
    allowOrigins: Array.isArray(resolvedDeployPayload.allowOrigins)
      ? cloneValue(resolvedDeployPayload.allowOrigins)
      : [],
    limits: isObj(resolvedDeployPayload.limits) ? cloneValue(resolvedDeployPayload.limits) : {},
    scopes: isObj(resolvedDeployPayload.scopes) ? cloneValue(resolvedDeployPayload.scopes) : {},
    faucet:
      !isWorkerCanonical && isObj(resolvedDeployPayload.faucet)
        ? cloneValue(resolvedDeployPayload.faucet)
        : !isWorkerCanonical
          ? cloneValue(resolveWorkerFaucetConfig())
          : {},
    litCredentials:
      isWorkerSbtGateCloudflareStorageProfile(storageProfile) ||
      (modeRequirements.selected && !modeRequirements.requiresLit)
        ? {}
        : buildWorkerLitCredentialsConfig(workerSecrets),
    ...(effectiveSessionModeProfile ? { sessionModeProfile: cloneValue(effectiveSessionModeProfile) } : {}),
    ...(workerAuthority ? { workerAuthority } : {}),
    storageProfile,
  };

  if (isWorkerCanonical) {
    delete next.registryAddress;
    delete next.registryChainId;
    delete next.faucet;
    delete next.rpcUrl;
    delete next.rpcUrlsByChainId;
    if (!modeRequirements.requiresRpc) delete next.networkChainId;
    if (!modeRequirements.requiresLit) {
      delete next.litCredentials;
    }
  }

  if (
    typeof resolvedDeployPayload.embeddedDeployHelperEnabled === 'boolean' ||
    typeof resolvedDraft.embeddedDeployHelperEnabled === 'boolean'
  ) {
    next.embeddedDeployHelperEnabled =
      (resolvedDeployPayload.embeddedDeployHelperEnabled ?? resolvedDraft.embeddedDeployHelperEnabled) !== false;
  }

  const blockLimits = !isWorkerCanonical ? normalizeBlockLimits(resolvedDraft.blockLimits, latestChainBlock) : null;
  if (blockLimits) {
    next.blockLimits = blockLimits;
  }
  if (!isWorkerCanonical && Object.keys(normalizedContracts).length) {
    next.contracts = normalizedContracts;
  }

  const sessionIdHex = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
  if (sessionIdHex) next.sessionId = sessionIdHex;

  return next;
};
