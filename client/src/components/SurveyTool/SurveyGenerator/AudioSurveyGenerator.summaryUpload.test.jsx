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
import { generateAudioDiscussionSummary, uploadMarkdownSummaryToArweave } from '../../../utilities/ai/aiClient.js';

jest.mock('../../../utilities/session/resourceKeys.js', () => ({
  ...jest.requireActual('../../../utilities/session/resourceKeys.js'),
  getEffectiveArweaveKey: jest.fn(async () => ({ arweaveJwk: '' })),
}));

// An Arweave upload is public and permanent, so a transcript summary goes up only when asked, never as plain text.
describe('transcript summaries and Arweave', () => {
  setupAudioSurveyGeneratorTestLifecycle();
  beforeEach(() => {
    generateAudioDiscussionSummary.mockReset();
    uploadMarkdownSummaryToArweave.mockReset();
    generateAudioDiscussionSummary.mockResolvedValue('# Summary of the breakout');
    uploadMarkdownSummaryToArweave.mockResolvedValue({ url: 'https://arweave.net/summary' });
    mockCallAI.mockResolvedValue(JSON.stringify({ questions: buildAiQuestions(5) }));
  });

  const clickOption = (label) =>
    act(async () => {
      Array.from(container.querySelectorAll('span'))
        .find((node) => node.textContent === label)
        .parentElement.click();
    });
  const generateFromTranscript = async ({ upload = false, encrypt = false } = {}) => {
    await renderSubject(
      <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
    );
    setAudioInputValue('A transcript of the breakout: who decides, who benefits, and how someone could object.');
    await act(async () => container.querySelector('[data-testid="transcript-mode-toggle"]').click());
    if (upload) await clickOption('Upload Summary');
    if (encrypt) await clickOption('Encrypt Summary');
    await act(async () => findGenerateQuestionsButton().click());
    expect(generateAudioDiscussionSummary).toHaveBeenCalledTimes(1);
  };

  it('keeps the summary off Arweave unless asked', async () => {
    await generateFromTranscript();
    expect(uploadMarkdownSummaryToArweave).not.toHaveBeenCalled();
  });

  it('never uploads a summary marked for encryption, because the upload would be plain text', async () => {
    await generateFromTranscript({ upload: true, encrypt: true });
    expect(uploadMarkdownSummaryToArweave).not.toHaveBeenCalled();
  });

  it('uploads the summary when asked and not marked for encryption', async () => {
    await generateFromTranscript({ upload: true });
    expect(uploadMarkdownSummaryToArweave).toHaveBeenCalledTimes(1);
    expect(uploadMarkdownSummaryToArweave.mock.calls[0][0]).toBe('# Summary of the breakout');
  });
});
