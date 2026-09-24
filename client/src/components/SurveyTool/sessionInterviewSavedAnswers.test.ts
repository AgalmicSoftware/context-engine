import { LegacyOwnResponseListingError } from '../../utilities/storage/storageClient';
import { loadSessionInterviewSavedAnswers, mergeInterviewSavedAnswerBaseline } from './sessionInterviewSavedAnswers';
import { loadWorkerResponses } from '../../utilities/survey/workerResponseHydration';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
jest.mock('../../utilities/survey/workerResponseHydration', () => ({
  ...jest.requireActual<typeof import('../../utilities/survey/workerResponseHydration')>(
    '../../utilities/survey/workerResponseHydration',
  ),
  loadWorkerResponses: jest.fn(),
}));
jest.mock('../../domains/surveys/surveyQuestionReadsPort', () => ({
  surveyQuestionReadsPort: { getResponseHash: jest.fn(), getResponse: jest.fn() },
}));
const base = {
  questionIds: ['q1', 'q2'],
  account: '0xabc',
  sessionSlug: 'alpha',
  sessionConfig: {},
  signal: new AbortController().signal,
};
beforeEach(() => {
  jest.resetAllMocks();
});
it('uses strict per-account chain reads, distinguishing missing answers from failed reads', async () => {
  jest.mocked(surveyQuestionReadsPort.getResponseHash).mockResolvedValueOnce('hash').mockResolvedValueOnce(null);
  jest.mocked(surveyQuestionReadsPort.getResponse).mockResolvedValue({ answer: { value: 'latest' } });
  await expect(loadSessionInterviewSavedAnswers(base)).resolves.toEqual([
    { questionID: 'q1', answer: { value: 'latest' } },
  ]);
  expect(surveyQuestionReadsPort.getResponseHash).toHaveBeenCalledWith(
    undefined,
    '0xabc',
    'q1',
    {},
    { throwOnError: true },
  );
  jest.mocked(surveyQuestionReadsPort.getResponseHash).mockRejectedValue(new Error('RPC unavailable'));
  await expect(loadSessionInterviewSavedAnswers(base)).rejects.toThrow('RPC unavailable');
});
it('chooses the latest Hosted edit with stable same-time ordering', async () => {
  const row = {
    questionId: 'q1',
    responder: '0xabc',
    timestamp: 2,
    storageRefId: 'ref-b',
    response: { answer: 'latest' },
  };
  jest
    .mocked(loadWorkerResponses)
    .mockResolvedValue([
      row,
      { ...row, storageRefId: 'ref-a', response: { answer: 'older' } },
      { ...row, timestamp: 1, storageRefId: 'ref-z', response: { answer: 'oldest' } },
    ]);
  await expect(
    loadSessionInterviewSavedAnswers({
      ...base,
      sessionConfig: { sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) },
    }),
  ).resolves.toEqual([{ answer: 'latest', questionID: 'q1' }]);
  expect(loadWorkerResponses).toHaveBeenCalledWith(expect.objectContaining({ ownResponses: true, account: '0xabc' }));
});
it('merges the saved baseline without discarding in-flight local edits or unrelated questions', () => {
  const merged = mergeInterviewSavedAnswerBaseline(
    { answers: { q1: 'local edit', q2: 'old', q3: 'unrelated' }, importance: { q1: 0 } },
    { answers: { q1: 'old', q2: 'old' }, importance: { q1: 0 } },
    { answers: { q1: 'saved', q2: 'latest' }, importance: { q1: 4 } },
    ['q1', 'q2'],
    Object.is,
  );
  expect(merged.slice.answers).toEqual({ q1: 'local edit', q2: 'latest', q3: 'unrelated' });
  expect(merged.baseline.answers).toEqual({ q1: 'saved', q2: 'latest' });
  expect(merged.slice.importance.q1).toBe(4);
});

it('requests the public-cache fallback only for the verified legacy listing', async () => {
  const options = {
    ...base,
    sessionConfig: { sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) },
  };
  jest.mocked(loadWorkerResponses).mockRejectedValueOnce(new LegacyOwnResponseListingError());
  await expect(loadSessionInterviewSavedAnswers(options)).resolves.toBeNull();
  jest
    .mocked(loadWorkerResponses)
    .mockRejectedValueOnce(new Error('This Worker could not verify your complete saved answers.'));
  await expect(loadSessionInterviewSavedAnswers(options)).rejects.toThrow('complete saved answers');
});
