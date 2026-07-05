import { getDefaultHttpRpc } from '../../variables/chains.js';
import {
  CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED,
  DEFAULT_CHAIN_ID,
  DEFAULT_SESSION_SLUG,
} from '../../variables/appConfig.js';
import rpcDefaults from '../../variables/rpcDefaults.js';
import { normalizeLitMetadataNetwork, normalizeSessionNaming } from '../../utilities/session/sessionMetadata.js';
import { getDemoTemplateSeed } from '../../utilities/session/sessionDemoCompat.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { DEFAULT_REASONING_EFFORT } from '../../utilities/ai/aiSettings.js';
import {
  DEFAULT_AI_MODELS,
  normalizeAiModels,
  normalizeAiProvider,
  resolveSessionWizardAutoFeatureBySessionSlug,
} from './sessionWizardAiConfig';
import { normalizeSessionStorageProfileConfig } from './sessionWizardStorageProfile';
import {
  compileSessionModeProfile,
  hasLegacyTelegramFirstSessionFlags,
  profileFromLegacyConfig,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import type { AnyRecord } from '../shellTypes';

const { getPathRpcUrl } = rpcDefaults;

export const DEFAULT_NEW_SESSION_SBT_TAGS = 'group, event, idea, demographic, location';

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj ?? {}));
const mergeSessionWizardDraftDeep = (target: AnyRecord, source: AnyRecord): AnyRecord => {
  const out: AnyRecord = { ...(target || {}) };
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeSessionWizardDraftDeep(out[key] as AnyRecord || {}, value as AnyRecord);
    } else {
      out[key] = value;
    }
  });
  return out;
};

export const normalizeSessionWizardDraftShape = (draftIn: AnyRecord = {}): AnyRecord => {
  const draft = normalizeSessionNaming(draftIn && typeof draftIn === 'object' ? draftIn : {}) as AnyRecord;
  const chainId = Number(draft.networkChainId || DEFAULT_CHAIN_ID || 0) || DEFAULT_CHAIN_ID;
  draft.sessionName = toStr(draft.sessionName || '').trim();
  draft.sessionInfo = toStr(draft.sessionInfo || '').trim();
  delete draft.telegram_only;
  delete draft.telegramOnly;
  delete draft.telegramMode;
  delete draft.sessionMode;
  delete draft.telegramBridgeEnabled;
  if (draft.telegram && typeof draft.telegram === 'object') {
    delete draft.telegram.only;
    delete draft.telegram.mode;
    if (!Object.keys(draft.telegram).length) delete draft.telegram;
  }
  if (!draft.sessionModeProfile && hasLegacyTelegramFirstSessionFlags(draftIn)) {
    draft.sessionModeProfile = profileFromLegacyConfig(draftIn);
  }
  if (!draft.sessionInfoEncrypted) {
    delete draft.sessionInfoEncrypted;
  }

  const headerCandidate = toStr(draft.sessionHeader || draft.sessionHeaderImg).trim();
  if (headerCandidate) {
    draft.sessionHeader = headerCandidate;
  }
  delete draft.sessionHeaderImg;
  delete draft.orgHeader;
  delete draft.orgHeaderImg;
  delete draft.orderHeaderImg;

  const ai = draft.ai && typeof draft.ai === 'object' ? draft.ai : {};
  const fallbackProvider = normalizeAiProvider(ai.mode || ai.provider || 'openai');
  ai.models = normalizeAiModels(ai.models, fallbackProvider, ai.transcription);
  delete ai.mode;
  delete ai.provider;
  delete ai.providers;
  delete ai.transcription;
  draft.ai = ai;

  if (!draft.rpc || typeof draft.rpc !== 'object') {
    draft.rpc = {
      provider: 'default',
      providers: {
        path: {
          rpcUrl: '',
          rpcUrlsByChainId: {},
          apiKey: '',
          encryptedApiKey: '',
        },
      },
    };
  }
  const pathProvider = draft.rpc?.providers?.path || draft.rpc?.path || {};
  if (!toStr(pathProvider.rpcUrl).trim()) {
    pathProvider.rpcUrl = getPathRpcUrl(chainId);
  }
  if (!draft.rpc.providers) draft.rpc.providers = {};
  draft.rpc.providers.path = pathProvider;

  if (!draft.faucet || typeof draft.faucet !== 'object') {
    draft.faucet = {
      rpcUrl: '',
      amountEth: '0.0002',
      balanceThresholdEth: '0.001',
      privateKey: '',
      encryptedPrivateKey: '',
    };
  }
  if (!toStr(draft.faucet.rpcUrl).trim()) {
    draft.faucet.rpcUrl = getDefaultHttpRpc(chainId) || draft.faucet.rpcUrl;
  }
  const resolvedAutoFeature = resolveSessionWizardAutoFeatureBySessionSlug(draft);
  draft.sessionEndsAt = toStr(draft.sessionEndsAt).trim();
  draft.defaultGroupTags =
    typeof draft.defaultGroupTags === 'string' ? draft.defaultGroupTags.trim() : DEFAULT_NEW_SESSION_SBT_TAGS;
  delete draft.autoFeatureSBTsWithFeaturedSbtTags;
  if (typeof resolvedAutoFeature !== 'boolean') {
    draft.autoFeatureSBTsBySessionSlug = true;
  } else {
    draft.autoFeatureSBTsBySessionSlug = resolvedAutoFeature;
  }
  if (typeof draft.embeddedDeployHelperEnabled !== 'boolean') {
    draft.embeddedDeployHelperEnabled = CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED !== false;
  }
  if (draft.sessionModeProfile && typeof draft.sessionModeProfile === 'object') {
    const compiled = compileSessionModeProfile(draft.sessionModeProfile as SessionModeProfile);
    draft.storageProfile = normalizeSessionStorageProfileConfig(compiled.storageProfile);
  } else {
    draft.storageProfile = normalizeSessionStorageProfileConfig(draft.storageProfile || draft.sessionStorageProfile || draft.storage);
  }
  delete draft.sessionStorageProfile;
  delete draft.storage;

  return normalizeLitMetadataNetwork(draft) as AnyRecord;
};

export const buildSessionWizardDefaultTemplate = (): AnyRecord => {
  const base = getDemoTemplateSeed('wizardBase') as AnyRecord;
  const draft = deepClone(base) as AnyRecord;
  draft.slug = DEFAULT_SESSION_SLUG;
  draft.sessionName = '';
  draft.sessionInfo = '';
  draft.sessionHeader = '';
  delete draft.sessionModeProfile;
  delete draft.telegramOnly;
  delete draft.telegram_only;
  delete draft.telegramMode;
  delete draft.sessionMode;
  delete draft.telegramBridgeEnabled;
  delete draft.telegram;
  delete draft.sessionHeaderImg;
  delete draft.sessionInfoEncrypted;
  draft.corsWorkerUrl = '';
  draft.defaultTags = '';
  draft.defaultGroupTags = DEFAULT_NEW_SESSION_SBT_TAGS;
  draft.defaultSbtTags = DEFAULT_NEW_SESSION_SBT_TAGS;
  draft.questionsGenPrompt = '';
  draft.defaultFilterState = draft.defaultFilterState ?? null;
  // The wizard seed reuses the default-session demo config, but fresh `/new`
  // drafts should start with session-group auto-feature enabled.
  delete draft.autoFeatureSBTsWithFeaturedSbtTags;
  draft.autoFeatureSBTsBySessionSlug = true;
  draft.embeddedDeployHelperEnabled = CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED !== false;
  draft.litCredentials = {};
  draft.perMemberSpendLimits = draft.perMemberSpendLimits || { ai: '', arweave: '', txGas: '' };
  draft.arweave = draft.arweave || { jwk: '', encryptedJwk: '' };
  draft.storageProfile = normalizeSessionStorageProfileConfig(draft.storageProfile);
  draft.faucet = draft.faucet || {
    rpcUrl: '',
    amountEth: '0.0002',
    balanceThresholdEth: '0.001',
    privateKey: '',
    encryptedPrivateKey: '',
  };
  delete draft.sponsoredSbtAddress;
  draft.sponsored = {
    ...(draft.sponsored && typeof draft.sponsored === 'object' ? draft.sponsored : {}),
    defaultGateId: 'gate-1',
    gates: {},
    resources: {},
  };
  const aiModels = draft.ai?.models && typeof draft.ai.models === 'object' ? draft.ai.models : {};
  draft.ai = {
    ...(draft.ai && typeof draft.ai === 'object' ? draft.ai : {}),
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    models: {
      ...aiModels,
      fast: {
        ...(aiModels.fast && typeof aiModels.fast === 'object' ? aiModels.fast : {}),
        provider: 'openai',
        model: DEFAULT_AI_MODELS.fast,
      },
      thinking: {
        ...(aiModels.thinking && typeof aiModels.thinking === 'object' ? aiModels.thinking : {}),
        provider: 'openai',
        model: DEFAULT_AI_MODELS.thinking,
      },
    },
  };
  if (draft.lit && typeof draft.lit === 'object') {
    draft.lit.defaultGateId = 'gate-1';
  }
  return normalizeSessionWizardDraftShape(draft);
};

export const buildSessionWizardInitialDraftFromCache = ({
  cachedWizard = null,
  defaultTemplate = buildSessionWizardDefaultTemplate(),
  normalModeSharedHostedWorkerEnabled = true,
  sourceEmbeddedDeployHelperDefault = null,
}: {
  cachedWizard?: AnyRecord | null;
  defaultTemplate?: AnyRecord;
  normalModeSharedHostedWorkerEnabled?: unknown;
  sourceEmbeddedDeployHelperDefault?: unknown;
} = {}): AnyRecord => {
  const cachedDraft = (
    cachedWizard?.draft &&
    typeof cachedWizard.draft === 'object'
  ) ? cachedWizard.draft as AnyRecord : null;
  const cachedDraftHasEmbeddedDeployHelperEnabled = (
    typeof cachedDraft?.embeddedDeployHelperEnabled === 'boolean'
  );
  const base = deepClone(defaultTemplate || {});
  if (
    !cachedDraftHasEmbeddedDeployHelperEnabled &&
    typeof sourceEmbeddedDeployHelperDefault === 'boolean'
  ) {
    base.embeddedDeployHelperEnabled = sourceEmbeddedDeployHelperDefault;
  }
  const merged = cachedDraft ? mergeSessionWizardDraftDeep(base, cachedDraft) : base;
  const normalized = normalizeSessionWizardDraftShape(merged);
  if (normalModeSharedHostedWorkerEnabled === false && !cachedWizard?.deployComplete) {
    normalized.corsWorkerUrl = '';
  }
  return normalized;
};

export const buildSessionWizardCacheWritePayload = ({
  sessionId = '',
  draft = {},
  privateSlugMode = false,
  lastManualSlug = '',
  encryptionGates = [],
  encryptedFieldGates = {},
  gateSelections = {},
  defaultGateId = '',
  featuredDraftGateAutoLink = null,
  resourceGateMap = {},
  manualGasLimit = '',
  manualGasPriceGwei = '',
  manualMaxFeePerGasGwei = '',
  manualMaxPriorityFeePerGasGwei = '',
  workerSecretsEnabled = true,
  effectivePersistWorkerSecrets = false,
  workerSecrets = {},
  deployForm = {},
  deployComplete = false,
  deployWorkerUrl = '',
  provisionedSponsoredContext = null,
}: AnyRecord = {}): AnyRecord => {
  const workerSecretsRecord = (
    workerSecrets &&
    typeof workerSecrets === 'object' &&
    !Array.isArray(workerSecrets)
  ) ? workerSecrets as AnyRecord : {};
  const redactedSecrets: AnyRecord = {};
  Object.keys(workerSecretsRecord).forEach((key) => {
    redactedSecrets[key] = workerSecretsRecord[key] ? '[redacted]' : '';
  });
  const deployFormRecord = (
    deployForm &&
    typeof deployForm === 'object' &&
    !Array.isArray(deployForm)
  ) ? deployForm as AnyRecord : {};
  const durableDeployForm = {
    workerName: toStr(deployFormRecord.workerName || '').trim(),
    adminAddress: toStr(deployFormRecord.adminAddress || '').trim() || undefined,
    accountId: toStr(deployFormRecord.accountId || '').trim(),
    bundleUrl: toStr(deployFormRecord.bundleUrl || '').trim(),
  };

  return {
    sessionId,
    draft,
    privateSlugMode,
    lastManualSlug,
    encryptionGates,
    // Regression guard: pending CREATE2 SBT drafts remain sessionStorage-only;
    // this durable wizard cache must not turn them into long-lived local data.
    pendingSbtDrafts: [],
    encryptedFieldGates,
    gateSelections,
    defaultGateId,
    featuredDraftGateAutoLink,
    resourceGateMap,
    manualGasLimit,
    manualGasPriceGwei,
    manualMaxFeePerGasGwei,
    manualMaxPriorityFeePerGasGwei,
    workerSecretsEnabled,
    persistWorkerSecrets: !!effectivePersistWorkerSecrets,
    workerSecrets: effectivePersistWorkerSecrets ? workerSecretsRecord : redactedSecrets,
    deployForm: durableDeployForm,
    deployComplete,
    deployWorkerUrl,
    provisionedSponsoredContext,
  };
};
