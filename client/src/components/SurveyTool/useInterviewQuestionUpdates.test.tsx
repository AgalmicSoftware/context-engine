import { act, renderHook } from '@testing-library/react';
import { useInterviewQuestionUpdates } from './useInterviewQuestionUpdates';
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
