import {
  React,
  act,
  AudioSurveyGenerator,
  container,
  findGenerateQuestionsButton,
  setAudioInputValue,
  renderSubject,
  buildAiQuestions,
  mockCallAI,
  setupAudioSurveyGeneratorTestLifecycle,
} from './AudioSurveyGenerator.testUtils';
import { getEffectiveAiConfig, saveLocalAiSettings } from '../../../utilities/ai/aiSettings';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../../utilities/session/sessionModeProfile';

describe('Context AI prompt model preview', () => {
  setupAudioSurveyGeneratorTestLifecycle();
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it.each([false, true])('matches the generated request with local override=%s', async (localOverride) => {
    const sessionConfig = {
      slug: 'worker-session',
      sessionName: 'Synthetic Worker session',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      ai: { models: { fast: { provider: 'openai', model: 'worker-fast-model' } } },
    };
    if (localOverride) saveLocalAiSettings({ useLocal: true, mode: 'openai', models: { fast: 'local-fast-model' } });
    const expectedModel = localOverride ? 'local-fast-model' : 'worker-fast-model';
    mockCallAI.mockResolvedValue(JSON.stringify({ questions: buildAiQuestions(5) }));
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{}}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        activeSessionSlug="worker-session"
        sessionConfig={sessionConfig}
      />,
    );
    setAudioInputValue('Synthetic context with enough source text to generate useful questions for this session.');
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Show AI Prompt')
        .click();
    });
    expect(container.textContent).toContain(`AI Prompt — OpenAI ${expectedModel}`);
    await act(async () => findGenerateQuestionsButton().click());
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    const requestOptions = mockCallAI.mock.calls[0][1];
    expect(requestOptions.sessionConfig.ai).toEqual(sessionConfig.ai);
    expect(await getEffectiveAiConfig({ ...requestOptions, resolveSecrets: false })).toMatchObject({
      provider: 'openai',
      model: expectedModel,
    });
  });
});
