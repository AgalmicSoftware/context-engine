import { __test__getSessionWizardDefaultAiSettings } from './sessionWizardConfig';

describe('SessionWizard AI defaults', () => {
  it('seeds new sessions with Terra and low reasoning effort', () => {
    expect(__test__getSessionWizardDefaultAiSettings()).toEqual(
      expect.objectContaining({
        reasoningEffort: 'low',
        models: expect.objectContaining({
          fast: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-5.6-terra',
          }),
          thinking: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-5.6-terra',
          }),
          transcription: expect.objectContaining({
            provider: 'openai',
            model: 'whisper-1',
          }),
        }),
      }),
    );
  });
});
