import { ethers } from 'ethers';

import { normalizeBlockLimitsForConfig } from '../../utilities/session/blockLimits.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { sanitizeSessionWizardMetadataPayload } from '../Sessions/sessionWizardWriteNormalization.js';
import { inferAiProviderFromModel, normalizeAiProvider } from './adminPageHelpers';
import {
  formatDefaultFilterStateDraft,
  formatDelimitedDraftList,
  parseDefaultFilterStateDraft,
  parseDelimitedDraftList,
} from './adminPageDraftFormattingHelpers';
import { dedupeSbtSelections } from './adminPageSbtGateSelectionHelpers';

const deepClone = (value: any) => JSON.parse(JSON.stringify(value || {}));

export const ADMIN_DEFAULT_AI_MODELS = Object.freeze({
  fast: 'gpt-5',
  thinking: 'gpt-5',
});

export const ADMIN_AI_PROVIDER_OPTIONS = Object.freeze([
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom RPC' },
]);

const ADMIN_EDITABLE_CONTRACT_FIELDS = Object.freeze([
  { contractKey: 'surveys', draftKey: 'contractSurveysAddress', label: 'Surveys contract' },
  { contractKey: 'sbtFactory', draftKey: 'contractSbtFactoryAddress', label: 'SBT factory contract' },
  { contractKey: 'sessionRegistry', draftKey: 'contractSessionRegistryAddress', label: 'SessionRegistry contract' },
]);

export const ADMIN_EDITABLE_CONTRACT_KEY_SET: any = new Set(
  ADMIN_EDITABLE_CONTRACT_FIELDS.map(({ contractKey }: any) => contractKey),
);

const getAdminContractChainIdFallback = (metadata: any = {}, contractKey: any = '') => {
  const existingChainId = Number(metadata?.contracts?.[contractKey]?.chainId || 0) || 0;
  if (existingChainId) return existingChainId;
  if (contractKey === 'sessionRegistry') {
    return (
      Number(
        metadata?.__registry?.registryChainId ||
          metadata?.registryChainId ||
          metadata?.__registry?.chainId ||
          metadata?.networkChainId ||
          0,
      ) || 0
    );
  }
  return (
    Number(metadata?.networkChainId || metadata?.__registry?.chainId || metadata?.__registry?.registryChainId || 0) || 0
  );
};

const normalizeAdminContractAddress = (raw: any, label: any) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  try {
    return ethers.utils.getAddress(trimmed);
  } catch (_) {
    throw new Error(`${label} must be a valid EVM address.`);
  }
};

export const buildAdminMetadataDraft = (metadata: any = {}) => {
  const fastModel =
    toStr(metadata?.ai?.models?.fast?.model || metadata?.ai?.model || ADMIN_DEFAULT_AI_MODELS.fast).trim() ||
    ADMIN_DEFAULT_AI_MODELS.fast;
  const thinkingModel =
    toStr(
      metadata?.ai?.models?.thinking?.model || metadata?.ai?.thinkingModel || ADMIN_DEFAULT_AI_MODELS.thinking,
    ).trim() || ADMIN_DEFAULT_AI_MODELS.thinking;
  const transcriptionModel =
    toStr(metadata?.ai?.models?.transcription?.model || metadata?.ai?.transcription || 'whisper-1').trim() ||
    'whisper-1';

  return {
    defaultTags: toStr(metadata?.defaultTags).trim(),
    questionsGenPrompt: toStr(metadata?.questionsGenPrompt).trim(),
    defaultSbtTags: toStr(metadata?.defaultSbtTags).trim(),
    defaultFilterState: formatDefaultFilterStateDraft(metadata?.defaultFilterState),
    contractSurveysAddress: toStr(metadata?.contracts?.surveys?.address).trim(),
    contractSbtFactoryAddress: toStr(metadata?.contracts?.sbtFactory?.address).trim(),
    contractSessionRegistryAddress: toStr(metadata?.contracts?.sessionRegistry?.address).trim(),
    defaultFeaturedSBTs: dedupeSbtSelections(metadata?.defaultFeaturedSBTs || []),
    highlightedQuestionIds: formatDelimitedDraftList(metadata?.HIGHLIGHTED_QUESTION_IDS),
    blockedQuestionIds: formatDelimitedDraftList(metadata?.BLOCKED_QUESTION_IDS),
    highlightedSurveyIds: formatDelimitedDraftList(metadata?.HIGHLIGHTED_SURVEY_IDS),
    blockedSurveyIds: formatDelimitedDraftList(metadata?.BLOCKED_SURVEY_IDS),
    ignoredSbtsList: formatDelimitedDraftList(metadata?.ignored_SBTs_LIST),
    featuredSbtsList: formatDelimitedDraftList(metadata?.featured_SBTs_LIST),
    faucetAmountEth: toStr(metadata?.faucet?.amountEth).trim(),
    faucetBalanceThresholdEth: toStr(metadata?.faucet?.balanceThresholdEth).trim(),
    aiFastProvider: normalizeAiProvider(
      metadata?.ai?.models?.fast?.provider ||
        inferAiProviderFromModel(metadata?.ai?.models?.fast?.model) ||
        metadata?.ai?.provider ||
        metadata?.ai?.mode ||
        'openai',
    ),
    aiFastModel: fastModel,
    aiThinkingProvider: normalizeAiProvider(
      metadata?.ai?.models?.thinking?.provider ||
        inferAiProviderFromModel(metadata?.ai?.models?.thinking?.model) ||
        metadata?.ai?.provider ||
        metadata?.ai?.mode ||
        'openai',
    ),
    aiThinkingModel: thinkingModel,
    aiTranscriptionProvider: normalizeAiProvider(metadata?.ai?.models?.transcription?.provider || 'openai', 'openai'),
    aiTranscriptionModel: transcriptionModel,
  };
};

export const applyAdminMetadataDraft = (metadata: any = {}, draft: any = {}) => {
  const next = deepClone(metadata && typeof metadata === 'object' ? metadata : {});

  next.defaultTags = toStr(draft.defaultTags).trim();
  next.questionsGenPrompt = toStr(draft.questionsGenPrompt).trim();
  next.defaultSbtTags = toStr(draft.defaultSbtTags).trim();
  next.defaultFilterState = parseDefaultFilterStateDraft(draft.defaultFilterState);
  next.defaultFeaturedSBTs = dedupeSbtSelections(draft.defaultFeaturedSBTs || []).map((entry: any) => entry.address);
  next.HIGHLIGHTED_QUESTION_IDS = parseDelimitedDraftList(draft.highlightedQuestionIds);
  next.BLOCKED_QUESTION_IDS = parseDelimitedDraftList(draft.blockedQuestionIds);
  next.HIGHLIGHTED_SURVEY_IDS = parseDelimitedDraftList(draft.highlightedSurveyIds);
  next.BLOCKED_SURVEY_IDS = parseDelimitedDraftList(draft.blockedSurveyIds);
  next.ignored_SBTs_LIST = parseDelimitedDraftList(draft.ignoredSbtsList);
  next.featured_SBTs_LIST = parseDelimitedDraftList(draft.featuredSbtsList);

  const existingContracts = next.contracts && typeof next.contracts === 'object' ? { ...next.contracts } : {};
  ADMIN_EDITABLE_CONTRACT_FIELDS.forEach(({ contractKey, draftKey, label }: any) => {
    const normalizedAddress = normalizeAdminContractAddress(draft[draftKey], label);
    if (!normalizedAddress) return;
    const existingEntry =
      existingContracts[contractKey] && typeof existingContracts[contractKey] === 'object'
        ? { ...existingContracts[contractKey] }
        : {};
    const fallbackChainId = getAdminContractChainIdFallback(next, contractKey);
    existingContracts[contractKey] = {
      ...existingEntry,
      address: normalizedAddress,
      ...(fallbackChainId ? { chainId: fallbackChainId } : {}),
    };
  });
  if (Object.keys(existingContracts).length) next.contracts = existingContracts;

  const faucet = next.faucet && typeof next.faucet === 'object' ? { ...next.faucet } : {};
  const faucetAmountEth = toStr(draft.faucetAmountEth).trim();
  const faucetBalanceThresholdEth = toStr(draft.faucetBalanceThresholdEth).trim();
  if (faucetAmountEth) faucet.amountEth = faucetAmountEth;
  else delete faucet.amountEth;
  if (faucetBalanceThresholdEth) faucet.balanceThresholdEth = faucetBalanceThresholdEth;
  else delete faucet.balanceThresholdEth;
  if (Object.keys(faucet).length) next.faucet = faucet;
  else delete next.faucet;

  const hasExistingAi = !!(metadata && metadata.ai && typeof metadata.ai === 'object');
  const aiDefaults = buildAdminMetadataDraft({});
  const aiDraftTouched =
    normalizeAiProvider(draft.aiFastProvider, aiDefaults.aiFastProvider) !== aiDefaults.aiFastProvider ||
    (toStr(draft.aiFastModel).trim() || aiDefaults.aiFastModel) !== aiDefaults.aiFastModel ||
    normalizeAiProvider(draft.aiThinkingProvider, aiDefaults.aiThinkingProvider) !== aiDefaults.aiThinkingProvider ||
    (toStr(draft.aiThinkingModel).trim() || aiDefaults.aiThinkingModel) !== aiDefaults.aiThinkingModel ||
    normalizeAiProvider(draft.aiTranscriptionProvider, aiDefaults.aiTranscriptionProvider) !==
      aiDefaults.aiTranscriptionProvider ||
    (toStr(draft.aiTranscriptionModel).trim() || aiDefaults.aiTranscriptionModel) !== aiDefaults.aiTranscriptionModel;

  if (hasExistingAi || aiDraftTouched) {
    const ai = next.ai && typeof next.ai === 'object' ? { ...next.ai } : {};
    const existingModels = ai.models && typeof ai.models === 'object' ? ai.models : {};
    ai.models = {
      ...existingModels,
      fast: {
        ...(existingModels.fast && typeof existingModels.fast === 'object' ? existingModels.fast : {}),
        provider: normalizeAiProvider(draft.aiFastProvider, 'openai'),
        model: toStr(draft.aiFastModel).trim() || ADMIN_DEFAULT_AI_MODELS.fast,
      },
      thinking: {
        ...(existingModels.thinking && typeof existingModels.thinking === 'object' ? existingModels.thinking : {}),
        provider: normalizeAiProvider(draft.aiThinkingProvider, 'openai'),
        model: toStr(draft.aiThinkingModel).trim() || ADMIN_DEFAULT_AI_MODELS.thinking,
      },
      transcription: {
        ...(existingModels.transcription && typeof existingModels.transcription === 'object'
          ? existingModels.transcription
          : {}),
        provider: normalizeAiProvider(draft.aiTranscriptionProvider, 'openai'),
        model: toStr(draft.aiTranscriptionModel).trim() || 'whisper-1',
      },
    };
    next.ai = ai;
  }

  return next;
};

const parseResourceDisplayAmount = (display: any) => {
  const match = toStr(display)
    .trim()
    .match(/^([0-9]+(?:\.[0-9]+)?)\s+(AR|ETH)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
};

export const shouldShowInlineResourceSummary = (resource: any = {}) => {
  if (resource?.manualRefreshAvailable === true) return true;
  const display = toStr(resource?.display).trim();
  if (!display) return false;
  if (resource?.loading || display === 'Loading...') return true;
  if (['Invalid JWK', 'Invalid key', 'Unable to load balance', 'RPC unavailable'].includes(display)) return true;
  const amount = parseResourceDisplayAmount(display);
  return amount != null && amount > 0;
};

export const parseChainIdInput = (raw: any) => {
  const matches = toStr(raw).match(/\d+/g);
  if (!matches || !matches.length) return 0;
  return Number(matches[matches.length - 1]) || 0;
};

export const resolveAutoFeatureBySessionSlug = (metadata: any) =>
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags;

export const buildEditableSessionMetadataPayload = ({
  sessionConfig,
  blockLimits,
  fallbackStart = null,
  autoFeatureSBTsBySessionSlug,
  autoFeatureSBTsWithFeaturedSbtTags,
  hasAutoFeatureOverride = false,
  advancedDraft = null,
}: any = {}) => {
  const metadata = deepClone(sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : {});
  delete metadata.__registry;
  delete metadata.sponsoredKeys;
  const normalizedBlockLimits = normalizeBlockLimitsForConfig(
    blockLimits && typeof blockLimits === 'object' ? blockLimits : metadata.blockLimits,
    fallbackStart,
  );
  if (!normalizedBlockLimits) {
    throw new Error('Session metadata requires blockLimits.start (positive block number).');
  }
  metadata.blockLimits = normalizedBlockLimits;
  const existingAutoFeature = resolveAutoFeatureBySessionSlug(metadata);
  delete metadata.autoFeatureSBTsWithFeaturedSbtTags;
  if (hasAutoFeatureOverride) {
    const overrideAutoFeature =
      autoFeatureSBTsBySessionSlug !== undefined ? autoFeatureSBTsBySessionSlug : autoFeatureSBTsWithFeaturedSbtTags;
    metadata.autoFeatureSBTsBySessionSlug = overrideAutoFeature === true;
  } else if (existingAutoFeature !== undefined) {
    metadata.autoFeatureSBTsBySessionSlug = existingAutoFeature;
  }
  const withAdvancedEdits = advancedDraft ? applyAdminMetadataDraft(metadata, advancedDraft) : metadata;
  const sanitized = sanitizeSessionWizardMetadataPayload(withAdvancedEdits, {
    defaultAiModels: ADMIN_DEFAULT_AI_MODELS,
  });
  delete sanitized.autoFeatureSBTsWithFeaturedSbtTags;
  const originalContracts = metadata.contracts && typeof metadata.contracts === 'object' ? metadata.contracts : {};
  const sanitizedContracts = sanitized.contracts && typeof sanitized.contracts === 'object' ? sanitized.contracts : {};
  const mergedContracts = { ...originalContracts, ...sanitizedContracts };
  if (Object.keys(mergedContracts).length) {
    sanitized.contracts = mergedContracts;
  } else {
    delete sanitized.contracts;
  }
  return sanitized;
};
