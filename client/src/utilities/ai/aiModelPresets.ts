import { DEFAULT_AI_MODEL, DEFAULT_AI_MODELS } from '../../../../shared/aiDefaults.mjs';

type AiPresetConfig = {
  provider: string;
  models: Record<string, string>;
  supportsImages: boolean;
};

export const AI_PROVIDERS = Object.freeze({
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  OPENROUTER: 'openrouter',
  CUSTOM: 'custom',
  LOCAL: 'local',
});

const singleModelPreset = (provider: string, model: string): AiPresetConfig =>
  Object.freeze({ supportsImages: true, provider, models: Object.freeze({ fast: model, thinking: model }) });

// A saved preset follows these models as they change; a saved key that is no
// longer here falls back to the default preset.
export const AI_PRESET_CONFIGS: Record<string, AiPresetConfig> = Object.freeze({
  [DEFAULT_AI_MODEL]: Object.freeze({ supportsImages: true, provider: AI_PROVIDERS.OPENAI, models: DEFAULT_AI_MODELS }),
  'gpt-6-astra': singleModelPreset(AI_PROVIDERS.OPENAI, 'gpt-6-astra'),
  'claude-sonnet': singleModelPreset(AI_PROVIDERS.ANTHROPIC, 'claude-sonnet-5-5'),
  'claude-opus': singleModelPreset(AI_PROVIDERS.ANTHROPIC, 'claude-opus-5-5'),
});
