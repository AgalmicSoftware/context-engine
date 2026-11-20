import { act, renderHook, waitFor } from '@testing-library/react';
import { useInterviewOpening } from './useInterviewOpening';
import {
  holdSignIn,
  holdSignInAndProof,
  TEST_READ_PROOF,
} from '../../utilities/worker/workerSessionReadHeaders.testUtils';

const originalFetch = global.fetch;
const options = { config: {}, workerUrl: 'https://worker.example', sessionSlug: 'demo', hasQuestions: true };
afterEach(() => {
  global.fetch = originalFetch;
});
it('waits for questions and loads a Worker-cached opening without credentials in the client', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ openingPrompt: 'Which AI view is overlooked?' }) });
  const { result, rerender } = renderHook((props) => useInterviewOpening(props), {
    initialProps: { ...options, hasQuestions: false },
  });
  expect(global.fetch).not.toHaveBeenCalled();
  rerender(options);
  await waitFor(() => expect(result.current.opening).toBe('Which AI view is overlooked?'));
  expect(global.fetch).toHaveBeenCalledWith('https://worker.example/interview/starter?slug=demo', {
    method: 'POST',
    headers: {},
    signal: expect.any(AbortSignal),
  });
});
it('sends an older Worker no sign-in for the opening of a session not known private', async () => {
  const release = holdSignIn(options.workerUrl, 'demo');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ openingPrompt: 'Why?' }) });
  try {
    const { result } = renderHook(() => useInterviewOpening(options));
    await waitFor(() => expect(result.current.opening).toBe('Why?'));
    expect(jest.mocked(global.fetch).mock.calls[0][1]?.headers).toEqual({});
  } finally {
    release();
  }
});
it('sends a private session’s sign-in and invite proof for its opening', async () => {
  const release = holdSignInAndProof(options.workerUrl, 'demo');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ openingPrompt: 'Why?' }) });
  try {
    const { result } = renderHook(() => useInterviewOpening(options));
    await waitFor(() => expect(result.current.opening).toBe('Why?'));
    expect(jest.mocked(global.fetch).mock.calls[0][1]?.headers).toEqual({
      'X-CE-Group-Invite': TEST_READ_PROOF,
      Authorization: 'Bearer member-token',
    });
  } finally {
    release();
  }
});
it('uses owner text without generation', () => {
  global.fetch = jest.fn();
  const { result } = renderHook(() =>
    useInterviewOpening({
      ...options,
      config: { interviewMode: { openingMode: 'owner', openingPrompt: 'What is your AI expertise?' } },
    }),
  );
  expect(result.current.opening).toBe('What is your AI expertise?');
  expect(global.fetch).not.toHaveBeenCalled();
});
it('falls back quietly when generation fails', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useInterviewOpening(options));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toEqual(expect.objectContaining({ opening: '', loading: false }));
  expect(result.current).not.toHaveProperty('notice');
});
it('aborts on close and rejects a late completion', async () => {
  let resolve!: (value: unknown) => void;
  global.fetch = jest.fn().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result, unmount } = renderHook(() => useInterviewOpening(options));
  const signal = jest.mocked(global.fetch).mock.calls[0][1]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => ({ openingPrompt: 'Late' }) }));
  expect(result.current.opening).toBe('');
});

it('clears loading if the question bank disappears during generation', () => {
  global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
  const { result, rerender } = renderHook((props) => useInterviewOpening(props), { initialProps: options });
  expect(result.current.loading).toBe(true);
  rerender({ ...options, hasQuestions: false });
  expect(result.current.loading).toBe(false);
  expect(jest.mocked(global.fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
});
