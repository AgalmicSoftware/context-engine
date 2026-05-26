import { toStr } from '../../utilities/shared/primitives.js';

export type LoginSettingsAiTaskReasoningRow = {
  key: string;
  label: string;
  hint: string;
};

const LOGIN_SETTINGS_AI_PROVIDER_LABELS: Record<string, string> = Object.freeze({
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  custom: 'Custom RPC',
  local: 'Local',
});

export const LOGIN_SETTINGS_AI_REASONING_LEVELS = Object.freeze(['low', 'medium', 'high']);

export const LOGIN_SETTINGS_AI_TASK_REASONING_ROWS: readonly LoginSettingsAiTaskReasoningRow[] = Object.freeze([
  { key: 'generate', label: 'Question Generation', hint: 'Default: low for speed.' },
  { key: 'rewrite', label: 'AI Rewrite', hint: 'Uses the global setting unless overridden.' },
  { key: 'summarize', label: 'Analysis / Summarize', hint: 'Uses the global setting unless overridden.' },
  { key: 'rank', label: 'Filter Ranking', hint: 'Uses the global setting unless overridden.' },
]);

export const formatLoginSettingsAiProviderLabel = (provider: unknown = ''): string => {
  const key = toStr(provider).toLowerCase();
  return LOGIN_SETTINGS_AI_PROVIDER_LABELS[key] || key;
};
