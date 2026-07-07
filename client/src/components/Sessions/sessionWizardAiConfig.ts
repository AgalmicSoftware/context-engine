import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

export const DEFAULT_AI_MODELS = Object.freeze({
  fast: 'gpt-5',
  thinking: 'gpt-5',
});

export const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter', disabled: true },
  { value: 'custom', label: 'Custom', disabled: true },
];

export const AI_MODEL_OPTIONS = Object.freeze({
  anthropic: {
    fast: ['claude-sonnet-4-5-20250929', 'claude-3-5-sonnet-20240620'],
    thinking: ['claude-3-5-sonnet-20240620', 'claude-sonnet-4-5-20250929'],
  },
  openai: {
    fast: ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    thinking: ['gpt-5', 'o3-mini', 'gpt-4o', 'gpt-4o-mini'],
  },
  openrouter: {
    fast: [],
    thinking: [],
  },
  custom: {
    fast: [],
    thinking: [],
  },
  transcription: ['whisper-1'],
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
    model: toStr(obj.model || 'whisper-1').trim(),
    rpcUrl: toStr(obj.rpcUrl || '').trim(),
  };
};

export const normalizeAiModels = (
  raw: AnyRecord | null | undefined,
  fallbackProvider: string,
  transcriptionRaw: AnyRecord | null | undefined,
): AnyRecord => {
  const obj: AnyRecord = raw && typeof raw === 'object' ? raw : {};
  const transcriptionSource =
    transcriptionRaw && typeof transcriptionRaw === 'object' ? transcriptionRaw : obj.transcription;
  return {
    fast: normalizeAiModelEntry(obj.fast || obj.default, DEFAULT_AI_MODELS.fast, fallbackProvider),
    thinking: normalizeAiModelEntry(obj.thinking || obj.reasoning, DEFAULT_AI_MODELS.thinking, fallbackProvider),
    transcription: normalizeAiTranscriptionEntry(transcriptionSource),
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
