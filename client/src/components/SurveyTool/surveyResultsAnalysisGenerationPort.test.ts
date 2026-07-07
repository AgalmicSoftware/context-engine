import { bindSurveyResultsAnalysisGenerationPort } from './surveyResultsAnalysisGenerationPort';

describe('surveyResultsAnalysisGenerationPort', () => {
  it('calls AI with the existing analysis request options', async () => {
    const callAI = jest.fn(async () => ({ ok: true }));
    const port = bindSurveyResultsAnalysisGenerationPort({
      aiClient: () => ({ callAI }),
    });

    await expect(
      port.generateSection({
        maxTokens: 1200,
        prompt: 'Generate risk matrix JSON',
        sessionSlug: 'demo-session',
      }),
    ).resolves.toEqual({ ok: true });

    expect(callAI).toHaveBeenCalledWith('Generate risk matrix JSON', {
      maxTokens: 1200,
      response_format: { type: 'json_object' },
      sessionSlug: 'demo-session',
      taskType: 'analysis',
      thinking: true,
    });
  });

  it('performs call-time AI lookup so module mocks keep intercepting', async () => {
    const firstCallAI = jest.fn(async () => 'first');
    const secondCallAI = jest.fn(async () => 'second');
    const aiClient = {
      callAI: firstCallAI,
    };
    const port = bindSurveyResultsAnalysisGenerationPort({
      aiClient: () => aiClient,
    });

    await expect(
      port.generateSection({
        maxTokens: 1,
        prompt: 'first prompt',
        sessionSlug: 'alpha',
      }),
    ).resolves.toBe('first');
    aiScripts.callAI = secondCallAI;
    await expect(
      port.generateSection({
        maxTokens: 2,
        prompt: 'second prompt',
        sessionSlug: 'beta',
      }),
    ).resolves.toBe('second');

    expect(firstCallAI).toHaveBeenCalledWith(
      'first prompt',
      expect.objectContaining({
        maxTokens: 1,
        sessionSlug: 'alpha',
      }),
    );
    expect(secondCallAI).toHaveBeenCalledWith(
      'second prompt',
      expect.objectContaining({
        maxTokens: 2,
        sessionSlug: 'beta',
      }),
    );
  });
});
