import { __test__getSessionWizardDefaultAiSettings } from './sessionWizardConfig';

describe('SessionWizard AI defaults', () => {
  it('seeds new sessions with GPT-5 and low reasoning effort', () => {
    expect(__test__getSessionWizardDefaultAiSettings()).toEqual(
      expect.objectContaining({
        reasoningEffort: 'low',
        models: expect.objectContaining({
          fast: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-5',
          }),
          thinking: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-5',
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
