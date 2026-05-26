import {
  LOGIN_SETTINGS_AI_REASONING_LEVELS,
  LOGIN_SETTINGS_AI_TASK_REASONING_ROWS,
  formatLoginSettingsAiProviderLabel,
} from './loginSettingsAiDisplayHelpers.js';

describe('loginSettingsAiDisplayHelpers', () => {
  it('keeps reasoning controls in the existing order', () => {
    expect(LOGIN_SETTINGS_AI_REASONING_LEVELS).toEqual(['low', 'medium', 'high']);
    expect(LOGIN_SETTINGS_AI_TASK_REASONING_ROWS).toEqual([
      { key: 'generate', label: 'Question Generation', hint: 'Default: low for speed.' },
      { key: 'rewrite', label: 'AI Rewrite', hint: 'Uses the global setting unless overridden.' },
      { key: 'summarize', label: 'Analysis / Summarize', hint: 'Uses the global setting unless overridden.' },
      { key: 'rank', label: 'Filter Ranking', hint: 'Uses the global setting unless overridden.' },
    ]);
  });

  it('formats AI provider labels with the existing lowercase fallback', () => {
    const before = JSON.stringify(LOGIN_SETTINGS_AI_TASK_REASONING_ROWS);

    expect(formatLoginSettingsAiProviderLabel('openai')).toBe('OpenAI');
    expect(formatLoginSettingsAiProviderLabel(' ANTHROPIC ')).toBe(' anthropic ');
    expect(formatLoginSettingsAiProviderLabel('openrouter')).toBe('OpenRouter');
    expect(formatLoginSettingsAiProviderLabel('custom')).toBe('Custom RPC');
    expect(formatLoginSettingsAiProviderLabel('local')).toBe('Local');
    expect(formatLoginSettingsAiProviderLabel('VendorX')).toBe('vendorx');
    expect(formatLoginSettingsAiProviderLabel(null)).toBe('');

    expect(JSON.stringify(LOGIN_SETTINGS_AI_TASK_REASONING_ROWS)).toBe(before);
  });
});
