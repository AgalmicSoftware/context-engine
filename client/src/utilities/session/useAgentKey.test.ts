import { act, renderHook } from '@testing-library/react';
import type { AgentDelegateKey } from './agentHandoff';
import { useAgentKey } from './useAgentKey';

const keyFor = (token: string, minutes: number): AgentDelegateKey => ({
  token,
  expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
  sessionSlug: 'demo',
  workerUrl: 'https://worker.example',
  submitAnswers: true,
});

afterEach(() => {
  jest.useRealTimers();
});

it('drops a key when its time comes, with the page left open, and makes another while one is wanted', async () => {
  jest.useFakeTimers();
  const requestKey = jest
    .fn<Promise<AgentDelegateKey>, [{ prompt: boolean }]>()
    .mockImplementationOnce(async () => keyFor('ceagt_first_key_0123456789', 10))
    .mockImplementationOnce(async () => keyFor('ceagt_second_key_0123456789', 60));
  const { result, rerender } = renderHook(({ wanted }) => useAgentKey(requestKey, wanted), {
    initialProps: { wanted: true },
  });
  await act(async () => {});
  expect(result.current.promptKey?.key.token).toBe('ceagt_first_key_0123456789');
  // Nothing redraws the page in the meantime: the key's own end does.
  await act(async () => {
    jest.advanceTimersByTime(10 * 60 * 1000 + 1);
  });
  expect(requestKey).toHaveBeenCalledTimes(2);
  expect(result.current.promptKey?.key.token).toBe('ceagt_second_key_0123456789');
  // No longer wanted, the next key's end leaves the prompt without one and asks for nothing.
  rerender({ wanted: false });
  await act(async () => {
    jest.advanceTimersByTime(60 * 60 * 1000 + 1);
  });
  expect(result.current.promptKey).toBeNull();
  expect(requestKey).toHaveBeenCalledTimes(2);
});
