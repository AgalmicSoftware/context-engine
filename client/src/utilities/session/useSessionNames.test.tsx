import { act, renderHook, waitFor } from '@testing-library/react';
import { NAMES_RETRY_MS, useSessionNames } from './useSessionNames';
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

describe('after a read that failed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const settle = () => act(async () => undefined);
  const wait = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

  it("asks once more, so an older Worker's slow answer doesn't hide answers' own names for the visit", async () => {
    jest.mocked(resolveSessionNamesSource).mockRejectedValueOnce(new Error('timed out')).mockResolvedValue(null);
    const { result } = renderHook(() => useSessionNames(options));
    await settle();
    expect(result.current.answerNamesShown).toBe(false);
    await wait(NAMES_RETRY_MS - 1);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(1);
    await wait(1);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ source: null, answerNamesShown: true });
  });

  it("shows a Worker's names when its second answer comes", async () => {
    const kept = source({ [A]: 'Sam' });
    jest.mocked(resolveSessionNamesSource).mockRejectedValueOnce(new Error('503')).mockResolvedValue(kept);
    const { result } = renderHook(() => useSessionNames(options));
    await settle();
    await wait(NAMES_RETRY_MS);
    expect(result.current).toMatchObject({ source: kept, names: { [A]: 'Sam' }, answerNamesShown: false });
  });

  it('asks only once more while the Worker keeps failing, and again after a later change', async () => {
    jest.mocked(resolveSessionNamesSource).mockRejectedValue(new Error('unreachable'));
    const { result } = renderHook(() => useSessionNames(options));
    await settle();
    await wait(NAMES_RETRY_MS);
    await wait(NAMES_RETRY_MS * 4);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(2);
    expect(result.current.answerNamesShown).toBe(false);
    // A save or a sign-in asks again by itself; a failure straight after two others earns no further retry.
    await act(async () => reload());
    await wait(NAMES_RETRY_MS * 4);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(3);
  });

  it('still asks once more when a sign-in or a save read early and failed too', async () => {
    jest.mocked(resolveSessionNamesSource).mockRejectedValue(new Error('unreachable'));
    renderHook(() => useSessionNames(options));
    await settle();
    await wait(1000);
    await act(async () => reload());
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(2);
    // The retry waits its full time from the newest failure, then runs once.
    await wait(NAMES_RETRY_MS - 1);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(2);
    await wait(1);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(3);
    await wait(NAMES_RETRY_MS * 4);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(3);
  });

  it('drops a waiting retry when a newer read starts or the view goes', async () => {
    jest.mocked(resolveSessionNamesSource).mockRejectedValueOnce(new Error('timed out')).mockResolvedValue(null);
    const first = renderHook(() => useSessionNames(options));
    await settle();
    // A sign-in or a save reads again before the retry is due: that read is the retry.
    await act(async () => reload());
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(2);
    await wait(NAMES_RETRY_MS * 2);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(2);
    first.unmount();

    jest.mocked(resolveSessionNamesSource).mockClear();
    jest.mocked(resolveSessionNamesSource).mockRejectedValue(new Error('unreachable'));
    const second = renderHook(() => useSessionNames(options));
    await settle();
    second.unmount();
    await wait(NAMES_RETRY_MS * 2);
    expect(resolveSessionNamesSource).toHaveBeenCalledTimes(1);
  });
});
