import { __test__getSessionWizardDefaultAiSettings } from './sessionWizardConfig';

describe('SessionWizard AI defaults', () => {
  it('seeds new sessions with Terra, Sol, gpt-transcribe and low reasoning effort', () => {
    expect(__test__getSessionWizardDefaultAiSettings()).toEqual(
      expect.objectContaining({
        reasoningEffort: 'low',
        models: expect.objectContaining({
          fast: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-6.1-terra',
          }),
          thinking: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-6.1-sol',
          }),
          transcription: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-transcribe',
          }),
        }),
      }),
    );
  });
});
