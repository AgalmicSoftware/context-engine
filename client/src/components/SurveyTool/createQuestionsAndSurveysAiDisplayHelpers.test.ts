import {
  buildCreateSurveyAiPromptModelLabelPatch,
  formatAiPromptModelLabel,
} from './createQuestionsAndSurveysAiDisplayHelpers';

describe('createQuestionsAndSurveysAiDisplayHelpers', () => {
  it('formats AI prompt model labels with provider precedence', () => {
    expect(formatAiPromptModelLabel({ provider: 'openai', model: 'gpt-4o' })).toBe('OpenAI gpt-4o');
    expect(formatAiPromptModelLabel({ provider: 'anthropic', model: 'claude-sonnet' })).toBe('Anthropic claude-sonnet');
    expect(formatAiPromptModelLabel({ provider: 'custom', model: '' })).toBe('Custom');
    expect(formatAiPromptModelLabel({ provider: '', model: 'local-model' })).toBe('local-model');
    expect(formatAiPromptModelLabel({ provider: 'bespoke', model: 'model-a' })).toBe('Bespoke model-a');
    expect(formatAiPromptModelLabel({})).toBe('Configured model');
  });

  it('builds AI prompt model label patches with configured fallback', () => {
    expect(buildCreateSurveyAiPromptModelLabelPatch('OpenAI gpt-4o')).toEqual({
      aiPromptModelLabel: 'OpenAI gpt-4o',
    });
    expect(buildCreateSurveyAiPromptModelLabelPatch('')).toEqual({
      aiPromptModelLabel: 'Configured model',
    });
  });
});
