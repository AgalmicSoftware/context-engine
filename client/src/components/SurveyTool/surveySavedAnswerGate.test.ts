import * as savedAnswers from './sessionInterviewSavedAnswers';
import { OWN_ANSWER_READ_LIMIT_MS, readOwnAnswersBeforeUpload } from './surveySavedAnswerGate';
import type { SurveyQuestionsRuntimeEngine } from './surveyQuestionsTypes';

const engine = () =>
  ({
    _isMounted: true,
    props: {
      account: '0x00000000000000000000000000000000000000ab',
      sessionSlug: 'edge',
      sessionConfig: { slug: 'edge' },
    },
  }) as unknown as SurveyQuestionsRuntimeEngine;

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('stops waiting on a saved-answer read that never settles, and says the answers are kept', async () => {
  jest.useFakeTimers();
  let readSignal: AbortSignal | undefined;
  jest.spyOn(savedAnswers, 'loadSessionInterviewSavedAnswers').mockImplementation(({ signal }) => {
    readSignal = signal;
    return new Promise(() => {});
  });
  const outcome = readOwnAnswersBeforeUpload(engine(), () => ['q1'], new AbortController().signal);
  await jest.advanceTimersByTimeAsync(OWN_ANSWER_READ_LIMIT_MS - 1);
  expect(readSignal?.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  await expect(outcome).resolves.toEqual({
    status: 'failed',
    message: expect.stringMatching(/took too long.*Nothing was sent.*still here/),
  });
  expect(readSignal?.aborted).toBe(true);
});

it('ends at once, as stale, when its caller stops it', async () => {
  jest.spyOn(savedAnswers, 'loadSessionInterviewSavedAnswers').mockImplementation(() => new Promise(() => {}));
  const caller = new AbortController();
  const outcome = readOwnAnswersBeforeUpload(engine(), () => ['q1'], caller.signal);
  caller.abort();
  await expect(outcome).resolves.toEqual({ status: 'stale' });
});
