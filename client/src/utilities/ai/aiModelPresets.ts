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

export const AI_PRESET_CONFIGS: Record<string, AiPresetConfig> = Object.freeze({
  [DEFAULT_AI_MODEL]: Object.freeze({ supportsImages: true, provider: AI_PROVIDERS.OPENAI, models: DEFAULT_AI_MODELS }),
  'gpt-5': Object.freeze({
    supportsImages: true,
    provider: AI_PROVIDERS.OPENAI,
    models: Object.freeze({
      fast: 'gpt-5',
      thinking: 'gpt-5',
    }),
  }),
  'gpt-4o': Object.freeze({
    supportsImages: true,
    provider: AI_PROVIDERS.OPENAI,
    models: Object.freeze({
      fast: 'gpt-4o',
      thinking: 'gpt-4o',
    }),
  }),
  'claude-sonnet': Object.freeze({
    supportsImages: true,
    provider: AI_PROVIDERS.ANTHROPIC,
    models: Object.freeze({
      fast: 'claude-sonnet-4-6',
      thinking: 'claude-sonnet-4-6',
    }),
  }),
  'claude-opus': Object.freeze({
    supportsImages: true,
    provider: AI_PROVIDERS.ANTHROPIC,
    models: Object.freeze({
      fast: 'claude-opus-4-6',
      thinking: 'claude-opus-4-6',
    }),
  }),
});
