import { act, renderHook } from '@testing-library/react';
import {
  INTERVIEW_QUESTION_CHECK_EVERY_MS,
  INTERVIEW_QUESTION_CHECK_LIMIT_MS,
  useInterviewQuestionUpdates,
} from './useInterviewQuestionUpdates';
const originalFetch = global.fetch;
const questions = Array.from({ length: 5 }, (_, id) => ({
  id: String(id),
  type: 'freeform',
  prompt: `Question ${id}?`,
  options: [],
}));
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});
it('monitors only when enabled, appends additions and keeps them available for mapping', async () => {
  const append = jest.fn<boolean, [string]>(() => true);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ questions: [...questions, { id: 'new', type: 'freeform', prompt: 'New AI concern?' }] }),
  });
  const options = {
    initialQuestions: questions,
    config: { interviewMode: { followNewQuestions: false } },
    workerUrl: 'https://worker.example',
    sessionSlug: 'demo',
    active: true,
    append,
  };
  const { result, rerender, unmount } = renderHook((props) => useInterviewQuestionUpdates(props), {
    initialProps: options,
  });
  await act(async () => jest.advanceTimersByTimeAsync(30000));
  expect(global.fetch).not.toHaveBeenCalled();
  rerender({ ...options, config: { interviewMode: { followNewQuestions: true } } });
  await act(async () => jest.advanceTimersByTimeAsync(30000));
  expect(append).toHaveBeenCalledTimes(1);
  expect(append).toHaveBeenCalledWith(expect.stringContaining('New AI concern?'));
  expect(result.current.questions).toHaveLength(6);
  await act(async () => jest.advanceTimersByTimeAsync(30000));
  expect(append).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => jest.advanceTimersByTimeAsync(30000));
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
it('does not publish a late bank update after stopping', async () => {
  let complete!: (value: unknown) => void;
  const append = jest.fn<boolean, [string]>(() => true);
  global.fetch = jest.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { unmount } = renderHook(() =>
    useInterviewQuestionUpdates({
      initialQuestions: questions,
      config: { interviewMode: { followNewQuestions: true } },
      workerUrl: 'https://worker.example',
      sessionSlug: 'demo',
      active: true,
      append,
    }),
  );
  await act(async () => jest.advanceTimersByTimeAsync(30000));
  unmount();
  await act(async () =>
    complete({ ok: true, json: async () => ({ questions: [...questions, { id: 'new', prompt: 'New question?' }] }) }),
  );
  expect(append).not.toHaveBeenCalled();
});

it('keeps live quadratic additions and their option order and budget available to the interviewer', async () => {
  const append = jest.fn<boolean, [string]>(() => true);
  const quadratic = {
    id: 'new',
    type: 'quadratic',
    prompt: 'Allocate support',
    options: ['Parks', 'Transit'],
    voiceCredits: 25,
  };
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ questions: [...questions, quadratic] }) });
  const { result } = renderHook(() =>
    useInterviewQuestionUpdates({
      initialQuestions: questions,
      config: { interviewMode: { followNewQuestions: true } },
      workerUrl: 'https://worker.example',
      sessionSlug: 'demo',
      active: true,
      append,
    }),
  );
  await act(async () => jest.advanceTimersByTimeAsync(30000));
  expect(result.current.questions.at(-1)).toEqual(quadratic);
  expect(append).toHaveBeenCalledWith(
    expect.stringContaining('25 voice credits; options in order: ["Parks","Transit"]'),
  );
});

it.each([false, true])(
  'describes the selection mode of new choice questions (singleSelect: %s)',
  async (singleSelect) => {
    const append = jest.fn<boolean, [string]>(() => true);
    const choice = {
      id: 'new',
      type: 'multichoice',
      prompt: 'Pick topics',
      options: ['Parks', 'Transit'],
      singleSelect,
    };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ questions: [...questions, choice] }) });
    const { result } = renderHook(() =>
      useInterviewQuestionUpdates({
        initialQuestions: questions,
        config: { interviewMode: { followNewQuestions: true } },
        workerUrl: 'https://worker.example',
        sessionSlug: 'demo',
        active: true,
        append,
      }),
    );
    await act(async () => jest.advanceTimersByTimeAsync(30000));
    expect(result.current.questions.at(-1)).toEqual(choice);
    expect(append).toHaveBeenCalledWith(
      expect.stringContaining(`Choose ${singleSelect ? 'one option' : 'one or more options'}: ["Parks","Transit"]`),
    );
  },
);

it('reads a private session’s questions with the signed-in person’s ticket', async () => {
  const append = jest.fn<boolean, [string]>(() => true);
  global.fetch = jest.fn(async (url: string) =>
    new URL(url).searchParams.get('ticket') === 'ic1.fixture'
      ? { ok: true, json: async () => ({ questions: [...questions, { id: 'group', prompt: 'Group question?' }] }) }
      : { ok: false, status: 401, json: async () => ({}) },
  ) as unknown as typeof fetch;
  const ticket = jest.fn(async (_options: { fresh: boolean }) => 'ic1.fixture');
  const { result } = renderHook(() =>
    useInterviewQuestionUpdates({
      initialQuestions: questions,
      config: { interviewMode: { followNewQuestions: true } },
      workerUrl: 'https://worker.example',
      sessionSlug: 'demo',
      active: true,
      append,
      ticket,
    }),
  );
  await act(async () => jest.advanceTimersByTimeAsync(30000));
  expect(ticket).toHaveBeenCalledWith({ fresh: false });
  expect(append).toHaveBeenCalledWith(expect.stringContaining('Group question?'));
  expect(result.current.notice).toBe('');
});

const NOTICE = 'Could not check for new questions. The interview can continue with its current questions.';
const follow = (append = jest.fn<boolean, [string]>(() => true)) =>
  renderHook(() =>
    useInterviewQuestionUpdates({
      initialQuestions: questions,
      config: { interviewMode: { followNewQuestions: true } },
      workerUrl: 'https://worker.example',
      sessionSlug: 'demo',
      active: true,
      append,
    }),
  );
// A session that answers after `ms`, unless the check gives up first.
const answerAfter = (ms: number, body: unknown, running = { now: 0, most: 0 }) =>
  jest.fn().mockImplementation(
    (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((resolve, reject) => {
        running.now += 1;
        running.most = Math.max(running.most, running.now);
        const done = setTimeout(() => {
          running.now -= 1;
          resolve({ ok: true, json: async () => body });
        }, ms);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(done);
          running.now -= 1;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
  );

it('waits long enough for a session that takes fifteen seconds to list its questions', async () => {
  const append = jest.fn<boolean, [string]>(() => true);
  global.fetch = answerAfter(15_000, {
    questions: [...questions, { id: 'new', type: 'freeform', prompt: 'Late one?' }],
  });
  const { result } = follow(append);
  await act(async () => jest.advanceTimersByTimeAsync(INTERVIEW_QUESTION_CHECK_EVERY_MS + 15_000));
  expect(append).toHaveBeenCalledWith(expect.stringContaining('Late one?'));
  expect(result.current.questions).toHaveLength(6);
  expect(result.current.notice).toBe('');
});

it('gives a check up before the next is due, so two never run at once', async () => {
  expect(INTERVIEW_QUESTION_CHECK_LIMIT_MS).toBeGreaterThanOrEqual(20_000);
  expect(INTERVIEW_QUESTION_CHECK_LIMIT_MS).toBeLessThan(INTERVIEW_QUESTION_CHECK_EVERY_MS);
  const running = { now: 0, most: 0 };
  global.fetch = answerAfter(10 * 60_000, { questions }, running);
  follow();
  await act(async () => jest.advanceTimersByTimeAsync(INTERVIEW_QUESTION_CHECK_EVERY_MS));
  expect(running.now).toBe(1);
  await act(async () => jest.advanceTimersByTimeAsync(INTERVIEW_QUESTION_CHECK_LIMIT_MS - 1));
  expect(running.now).toBe(1);
  await act(async () => jest.advanceTimersByTimeAsync(1));
  expect(running.now).toBe(0);
  await act(async () => jest.advanceTimersByTimeAsync(5 * INTERVIEW_QUESTION_CHECK_EVERY_MS));
  expect(global.fetch).toHaveBeenCalledTimes(6);
  expect(running.most).toBe(1);
});

it('says nothing after one failed check, speaks after two in a row, and stops at the next answer', async () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const fail = () => fetchMock.mockRejectedValueOnce(new Error('offline'));
  // An answer with nothing new still clears the notice.
  const answer = () => fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ questions }) });
  const next = () => act(async () => jest.advanceTimersByTimeAsync(INTERVIEW_QUESTION_CHECK_EVERY_MS));
  const { result } = follow();
  fail();
  await next();
  expect(result.current.notice).toBe('');
  answer();
  await next();
  expect(result.current.notice).toBe('');
  // One failure after an answer starts the count again.
  fail();
  await next();
  expect(result.current.notice).toBe('');
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
  await next();
  expect(result.current.notice).toBe(NOTICE);
  fail();
  await next();
  expect(result.current.notice).toBe(NOTICE);
  answer();
  await next();
  expect(result.current.notice).toBe('');
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
