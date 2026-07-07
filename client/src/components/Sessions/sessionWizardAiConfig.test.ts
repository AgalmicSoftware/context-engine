import {
  AI_PROVIDER_OPTIONS,
  DEFAULT_AI_MODELS,
  getAiModelOptions,
  normalizeAiModelForProvider,
  normalizeAiModels,
  normalizeAiProvider,
  resolveSessionWizardAiModelProviderPatch,
  resolveSessionWizardAutoFeatureBySessionSlug,
} from './sessionWizardAiConfig';

describe('sessionWizardAiConfig', () => {
  it('normalizes providers and exposes stable provider options', () => {
    expect(normalizeAiProvider('ANTHROPIC')).toBe('anthropic');
    expect(normalizeAiProvider('', 'openai')).toBe('openai');
    expect(AI_PROVIDER_OPTIONS.map((option) => option.value)).toEqual(['openai', 'anthropic', 'openrouter', 'custom']);
  });

  it('normalizes ai model groups from legacy and sparse shapes', () => {
    expect(
      normalizeAiModels(
        {
          default: { model: 'gpt-4o-mini', provider: 'openai' },
          reasoning: { model: 'gpt-5', provider: 'anthropic' },
        },
        'openai',
        null,
      ),
    ).toEqual({
      fast: { model: 'gpt-4o-mini', provider: 'openai' },
      thinking: { model: 'gpt-5', provider: 'anthropic' },
      transcription: { provider: 'openai', model: 'whisper-1', rpcUrl: '' },
    });

    expect(
      normalizeAiModels(null, 'anthropic', {
        provider: 'openai',
        model: 'whisper-1',
        rpcUrl: 'https://rpc.example',
      }),
    ).toEqual({
      fast: { model: DEFAULT_AI_MODELS.fast, provider: 'anthropic' },
      thinking: { model: DEFAULT_AI_MODELS.thinking, provider: 'anthropic' },
      transcription: { provider: 'openai', model: 'whisper-1', rpcUrl: 'https://rpc.example' },
    });
  });

  it('returns provider-specific model options and normalizes invalid model picks', () => {
    expect(getAiModelOptions('fast', 'openai')).toContain('gpt-5');
    expect(getAiModelOptions('thinking', 'anthropic')[0]).toBe('claude-3-5-sonnet-20240620');
    expect(getAiModelOptions('transcription', 'openai')).toEqual(['whisper-1']);

    expect(normalizeAiModelForProvider('fast', 'openai', 'not-a-real-model')).toBe('gpt-5');
    expect(normalizeAiModelForProvider('thinking', 'anthropic', 'claude-sonnet-4-5-20250929')).toBe(
      'claude-sonnet-4-5-20250929',
    );
    expect(normalizeAiModelForProvider('fast', 'openrouter', 'custom/model')).toBe('custom/model');
  });

  it('describes provider-specific ai model corrections for the wizard draft', () => {
    expect(
      resolveSessionWizardAiModelProviderPatch({
        models: {
          fast: { provider: 'anthropic', model: 'gpt-5' },
          thinking: { provider: 'openai', model: 'gpt-5' },
        },
      }),
    ).toEqual({
      hasChanges: true,
      models: {
        fast: 'claude-sonnet-4-5-20250929',
      },
    });
  });

  it('keeps valid and custom ai model picks unchanged', () => {
    expect(
      resolveSessionWizardAiModelProviderPatch({
        models: {
          fast: { provider: 'openai', model: 'gpt-4o-mini' },
          thinking: { provider: 'openrouter', model: 'custom/thinking' },
        },
      }),
    ).toEqual({
      hasChanges: false,
      models: {},
    });
  });

  it('prefers the explicit auto-feature field and falls back to the legacy alias', () => {
    expect(
      resolveSessionWizardAutoFeatureBySessionSlug({
        autoFeatureSBTsBySessionSlug: true,
        autoFeatureSBTsWithFeaturedSbtTags: false,
      }),
    ).toBe(true);

    expect(
      resolveSessionWizardAutoFeatureBySessionSlug({
        autoFeatureSBTsWithFeaturedSbtTags: true,
      }),
    ).toBe(true);
  });
});
