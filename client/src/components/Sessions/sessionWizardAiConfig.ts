import {
  DEFAULT_AI_MODELS as SHARED_AI_MODELS,
  DEFAULT_TRANSCRIPTION_MODEL,
  TRANSCRIPTION_FALLBACK_MODEL,
} from '../../../../shared/aiDefaults.mjs';
import {
  DEFAULT_WORKERS_AI_MODEL,
  WORKERS_AI_MODEL_IDS,
  WORKERS_AI_PROVIDER,
  WORKERS_AI_TASK,
} from '../../../../shared/workersAiModels.mjs';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

export const DEFAULT_AI_MODELS = SHARED_AI_MODELS;

export const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter', disabled: true },
  { value: 'custom', label: 'Custom', disabled: true },
];

// The one model list for setup, editing and the admin AI test. The first entry
// is each role's default. Sessions keep a stored model that is no longer listed.
export const AI_MODEL_OPTIONS = Object.freeze({
  anthropic: {
    fast: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5', 'claude-fable-5-1'],
    thinking: ['claude-opus-5-5', 'claude-fable-5-1', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  },
  openai: {
    fast: ['gpt-6.1-terra', 'gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra'],
    thinking: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6.1-terra'],
  },
  openrouter: {
    fast: [],
    thinking: [],
  },
  custom: {
    fast: [],
    thinking: [],
  },
  transcription: [DEFAULT_TRANSCRIPTION_MODEL, TRANSCRIPTION_FALLBACK_MODEL],
});

export const normalizeAiProvider = (value: unknown, fallback = 'openai'): string => {
  const lowered = toStr(value).trim().toLowerCase();
  return lowered || fallback;
};

const normalizeAiModelEntry = (
  entry: AnyRecord | string | null | undefined,
  fallbackModel: string,
  fallbackProvider: string,
): { model: string; provider: string } => {
  if (entry && typeof entry === 'object') {
    const model = toStr(entry.model || entry.name || entry.value || fallbackModel).trim();
    const provider = normalizeAiProvider(entry.provider, fallbackProvider);
    return { model: model || fallbackModel || '', provider };
  }
  const model = toStr(entry || fallbackModel).trim();
  return { model: model || fallbackModel || '', provider: normalizeAiProvider(fallbackProvider) };
};

const normalizeAiTranscriptionEntry = (entry: AnyRecord | null | undefined): AnyRecord => {
  const obj: AnyRecord = entry && typeof entry === 'object' ? entry : {};
  return {
    provider: normalizeAiProvider(obj.provider || 'openai'),
    model: toStr(obj.model || DEFAULT_TRANSCRIPTION_MODEL).trim(),
    rpcUrl: toStr(obj.rpcUrl || '').trim(),
  };
};

// The Session Agent's own model, when it answers on Cloudflare: a listed
// Workers AI model, or nothing. Every other task uses the fast and thinking models.
const readSessionAgentModel = (models: unknown): { provider: string; model: string } | null => {
  const entry = models && typeof models === 'object' ? (models as AnyRecord)[WORKERS_AI_TASK] : null;
  if (!entry || typeof entry !== 'object' || normalizeAiProvider(entry.provider, '') !== WORKERS_AI_PROVIDER)
    return null;
  const model = toStr(entry.model).trim();
  return {
    provider: WORKERS_AI_PROVIDER,
    model: (WORKERS_AI_MODEL_IDS as readonly string[]).includes(model) ? model : DEFAULT_WORKERS_AI_MODEL,
  };
};

export const sessionAgentOnCloudflare = (ai: unknown): boolean =>
  !!readSessionAgentModel(ai && typeof ai === 'object' ? (ai as AnyRecord).models : null);

/** The models with the Session Agent answering on Cloudflare's open model, or on the session's own. */
export const withSessionAgentOnCloudflare = (models: unknown, on: boolean): AnyRecord => {
  const { [WORKERS_AI_TASK]: _previous, ...rest } = models && typeof models === 'object' ? (models as AnyRecord) : {};
  return on ? { ...rest, [WORKERS_AI_TASK]: { provider: WORKERS_AI_PROVIDER, model: DEFAULT_WORKERS_AI_MODEL } } : rest;
};

export const normalizeAiModels = (
  raw: AnyRecord | null | undefined,
  fallbackProvider: string,
  transcriptionRaw: AnyRecord | null | undefined,
): AnyRecord => {
  const obj: AnyRecord = raw && typeof raw === 'object' ? raw : {};
  const transcriptionSource =
    transcriptionRaw && typeof transcriptionRaw === 'object' ? transcriptionRaw : obj.transcription;
  const sessionAgent = readSessionAgentModel(obj);
  return {
    fast: normalizeAiModelEntry(obj.fast || obj.default, DEFAULT_AI_MODELS.fast, fallbackProvider),
    thinking: normalizeAiModelEntry(obj.thinking || obj.reasoning, DEFAULT_AI_MODELS.thinking, fallbackProvider),
    transcription: normalizeAiTranscriptionEntry(transcriptionSource),
    ...(sessionAgent ? { [WORKERS_AI_TASK]: sessionAgent } : {}),
  };
};

export const getAiModelOptions = (modelType: string, providerValue: unknown): string[] => {
  if (modelType === 'transcription') return AI_MODEL_OPTIONS.transcription;
  const provider = normalizeAiProvider(providerValue, 'openai');
  const providerOptions = (AI_MODEL_OPTIONS as Record<string, AnyRecord>)[provider] || {};
  const openAiOptions = AI_MODEL_OPTIONS.openai as Record<string, string[] | undefined>;
  return providerOptions[modelType] || openAiOptions[modelType] || [];
};

export const normalizeAiModelForProvider = (modelType: string, providerValue: unknown, modelValue: unknown): string => {
  const options = getAiModelOptions(modelType, providerValue);
  const model = toStr(modelValue).trim();
  if (!options.length) return model;
  return options.includes(model) ? model : options[0];
};

type AiModelPatchKey = 'fast' | 'thinking';

export type SessionWizardAiModelProviderPatch = {
  hasChanges: boolean;
  models: Partial<Record<AiModelPatchKey, string>>;
};

const isAiConfigRecord = (value: unknown): value is AnyRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readAiModelRecord = (ai: unknown, modelKey: AiModelPatchKey): AnyRecord => {
  const aiRecord = isAiConfigRecord(ai) ? ai : {};
  const models = isAiConfigRecord(aiRecord.models) ? aiRecord.models : {};
  const model = models[modelKey];
  return isAiConfigRecord(model) ? model : {};
};

export const resolveSessionWizardAiModelProviderPatch = (ai: unknown): SessionWizardAiModelProviderPatch => {
  const fast = readAiModelRecord(ai, 'fast');
  const thinking = readAiModelRecord(ai, 'thinking');
  const fastProvider = normalizeAiProvider(fast.provider || 'openai');
  const thinkingProvider = normalizeAiProvider(thinking.provider || 'openai');
  const fastCurrent = toStr(fast.model).trim();
  const thinkingCurrent = toStr(thinking.model).trim();
  const fastNext = normalizeAiModelForProvider('fast', fastProvider, fastCurrent);
  const thinkingNext = normalizeAiModelForProvider('thinking', thinkingProvider, thinkingCurrent);
  const models: SessionWizardAiModelProviderPatch['models'] = {};
  if (fastNext !== fastCurrent) {
    models.fast = fastNext;
  }
  if (thinkingNext !== thinkingCurrent) {
    models.thinking = thinkingNext;
  }
  return {
    hasChanges: Object.keys(models).length > 0,
    models,
  };
};

export const resolveSessionWizardAutoFeatureBySessionSlug = (metadata: AnyRecord | null | undefined) =>
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags;
