import { act, renderHook, waitFor } from '@testing-library/react';
import { useInterviewSavedAnswers, type InterviewSavedAnswerLoader } from './useInterviewSavedAnswers';
import type { InterviewSavedSlice } from './sessionInterviewSavedAnswers';
const empty: InterviewSavedSlice = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
it('invalidates account/session/question changes synchronously and ignores stale completions', async () => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: InterviewSavedSlice) => void }> = [];
  const load: InterviewSavedAnswerLoader = (_ids, signal) =>
    new Promise((resolve) => pending.push({ signal, resolve }));
  const onLoaded = jest.fn();
  const { result, rerender, unmount } = renderHook(
    ({ contextKey, questionIds }) =>
      useInterviewSavedAnswers({ load, active: true, contextKey, questionIds, onLoaded }),
    { initialProps: { contextKey: 'account-a|session-a', questionIds: ['q1'] } },
  );
  rerender({ contextKey: 'account-b|session-a', questionIds: ['q1'] });
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => pending[0].resolve(empty));
  expect(result.current.ready).toBe(false);
  expect(onLoaded).not.toHaveBeenCalled();
  await act(async () => pending[1].resolve(empty));
  expect(result.current.ready).toBe(true);
  rerender({ contextKey: 'account-b|session-a', questionIds: ['q1', 'q2'] });
  expect(result.current.ready).toBe(false);
  unmount();
  expect(pending[2].signal.aborted).toBe(true);
});
it('keeps errors unready and retries the same scope without using a partial answer set', async () => {
  const load = jest
    .fn<ReturnType<InterviewSavedAnswerLoader>, Parameters<InterviewSavedAnswerLoader>>()
    .mockRejectedValueOnce(new Error('Page unavailable'))
    .mockResolvedValueOnce(empty);
  const { result } = renderHook(() =>
    useInterviewSavedAnswers({ load, active: true, contextKey: 'a', questionIds: ['q1'], onLoaded: jest.fn() }),
  );
  await waitFor(() => expect(result.current.error).toBe('Page unavailable'));
  expect(result.current.ready).toBe(false);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.ready).toBe(true));
});

it('keeps the legacy fallback separate from an empty saved slice and invalidates it on identity changes', async () => {
  const load = jest.fn().mockResolvedValue(null);
  const onLoaded = jest.fn();
  const { result, rerender } = renderHook(
    ({ contextKey, active }) => useInterviewSavedAnswers({ load, active, contextKey, questionIds: ['q1'], onLoaded }),
    { initialProps: { contextKey: 'a', active: true } },
  );
  await waitFor(() => expect(result.current.legacy).toBe(true));
  expect(result.current.ready).toBe(false);
  expect(onLoaded).not.toHaveBeenCalled();
  rerender({ contextKey: 'b', active: false });
  expect(result.current.legacy).toBe(false);
});
