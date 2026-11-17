import { act, renderHook, waitFor } from '@testing-library/react';
import { useSessionNames } from './useSessionNames';
import { resolveSessionNamesSource, subscribeSessionNames, type SessionNamesSource } from './sessionNames';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability';

jest.mock('./sessionNames', () => ({ resolveSessionNamesSource: jest.fn(), subscribeSessionNames: jest.fn() }));
jest.mock('./sessionWorkerAvailability', () => ({ getUsableSessionWorkerUrl: jest.fn() }));
jest.mock('../worker/workerAuth', () => ({ subscribeWorkerSessionToken: () => () => undefined }));

const A = '0x00000000000000000000000000000000000000aa';
const options = { sessionSlug: 'names-session', sessionConfig: {}, account: A };
const source = (names: Record<string, string>): SessionNamesSource => ({
  enabled: true,
  readAll: jest.fn(async () => names),
  setOwn: jest.fn(),
});

let reload: () => void = () => undefined;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getUsableSessionWorkerUrl).mockReturnValue('https://names.worker.test');
  jest.mocked(subscribeSessionNames).mockImplementation((listener) => {
    reload = listener;
    return () => undefined;
  });
});

const onChainConfig = { __registry: { registryChainId: 84532, sessionId: '0x01' } };

it("lets answers' own names show only in a session with no place for names", async () => {
  jest.mocked(getUsableSessionWorkerUrl).mockReturnValue('');
  const onChain = renderHook(() => useSessionNames({ ...options, sessionConfig: onChainConfig }));
  expect(onChain.result.current).toMatchObject({ source: null, answerNamesShown: true });
  expect(resolveSessionNamesSource).not.toHaveBeenCalled();

  jest.mocked(getUsableSessionWorkerUrl).mockReturnValue('https://older.worker.test');
  jest.mocked(resolveSessionNamesSource).mockResolvedValue(null);
  const older = renderHook(() => useSessionNames(options));
  expect(older.result.current.answerNamesShown).toBe(false);
  await waitFor(() => expect(older.result.current.answerNamesShown).toBe(true));
});

it("keeps answers' own names hidden while a Worker's names load or can't be learned", async () => {
  jest.mocked(resolveSessionNamesSource).mockRejectedValue(new Error('unreachable'));
  const { result } = renderHook(() => useSessionNames(options));
  await waitFor(() => expect(resolveSessionNamesSource).toHaveBeenCalled());
  await act(async () => undefined);
  expect(result.current).toMatchObject({ source: null, names: {}, answerNamesShown: false });
});

it('shows the names and keeps the same state when a reload changes nothing', async () => {
  const kept = source({ [A]: 'Sam' });
  jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
  const { result } = renderHook(() => useSessionNames(options));
  await waitFor(() => expect(result.current.names).toEqual({ [A]: 'Sam' }));
  expect(result.current).toMatchObject({ source: kept, answerNamesShown: false });

  const before = result.current;
  await act(async () => reload());
  expect(result.current).toBe(before);

  jest.mocked(kept.readAll).mockResolvedValueOnce({ [A]: 'Sam Lee' });
  await act(async () => reload());
  expect(result.current.names).toEqual({ [A]: 'Sam Lee' });
});

it("keeps answers' own names hidden until a loaded config says the session has no place for names", () => {
  jest.mocked(getUsableSessionWorkerUrl).mockReturnValue('');
  // Still loading, or a config the exact Worker check can't match to this slug: neither means on-chain.
  for (const sessionConfig of [null, {}]) {
    const { result } = renderHook(() => useSessionNames({ ...options, sessionConfig }));
    expect(result.current.answerNamesShown).toBe(false);
  }
  expect(resolveSessionNamesSource).not.toHaveBeenCalled();
});

it('keeps the newest read when an older one finishes after it', async () => {
  let finishOld: (names: Record<string, string>) => void = () => undefined;
  const kept = source({});
  jest
    .mocked(kept.readAll)
    .mockImplementationOnce(() => new Promise((resolve) => (finishOld = resolve)))
    .mockResolvedValueOnce({ [A]: 'Sam' });
  jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
  const { result } = renderHook(() => useSessionNames(options));
  await waitFor(() => expect(kept.readAll).toHaveBeenCalledTimes(1));

  await act(async () => reload());
  await waitFor(() => expect(result.current.names).toEqual({ [A]: 'Sam' }));
  await act(async () => finishOld({}));
  expect(result.current.names).toEqual({ [A]: 'Sam' });
});
