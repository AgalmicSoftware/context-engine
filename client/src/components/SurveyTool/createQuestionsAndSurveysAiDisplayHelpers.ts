type AiPromptModelConfig = {
  provider?: unknown;
  model?: unknown;
};

const AI_PROVIDER_LABELS: Record<string, string> = Object.freeze({
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  custom: 'Custom',
  local: 'Local',
});

export const formatAiPromptModelLabel = (config: AiPromptModelConfig = {}) => {
  const providerKey = String(config?.provider || '')
    .trim()
    .toLowerCase();
  const model = String(config?.model || '').trim();
  const provider =
    AI_PROVIDER_LABELS[providerKey] ||
    (providerKey ? `${providerKey.charAt(0).toUpperCase()}${providerKey.slice(1)}` : '');
  if (provider && model) return `${provider} ${model}`;
  return model || provider || 'Configured model';
};

export const buildCreateSurveyAiPromptModelLabelPatch = (aiPromptModelLabel: unknown) => ({
  aiPromptModelLabel: String(aiPromptModelLabel || 'Configured model'),
});
