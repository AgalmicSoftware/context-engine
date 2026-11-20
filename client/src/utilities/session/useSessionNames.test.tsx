import { act, renderHook, waitFor } from '@testing-library/react';
import { NAMES_PENDING_LIMIT_MS, NAMES_RETRY_MS, useSessionNames } from './useSessionNames';
import { resolveSessionNamesSource, subscribeSessionNames, type SessionNamesSource } from './sessionNames';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability';
import { subscribeWorkerSessionToken } from '../worker/workerAuth';

jest.mock('./sessionNames', () => ({ resolveSessionNamesSource: jest.fn(), subscribeSessionNames: jest.fn() }));
jest.mock('./sessionWorkerAvailability', () => ({ getUsableSessionWorkerUrl: jest.fn() }));
jest.mock('../worker/workerAuth', () => ({ subscribeWorkerSessionToken: jest.fn() }));

const A = '0x00000000000000000000000000000000000000aa';
const options = { sessionSlug: 'names-session', sessionConfig: {}, account: A };
const source = (names: Record<string, string>): SessionNamesSource => ({
  enabled: true,
  readAll: jest.fn(async () => names),
  readAllOrFail: jest.fn(async () => names),
  hasSignIn: jest.fn(async () => true),
  signIn: jest.fn(async () => undefined),
  setOwn: jest.fn(),
});

let reload: () => void = () => undefined;
let tokenChanged: () => void = () => undefined;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getUsableSessionWorkerUrl).mockReturnValue('https://names.worker.test');
  jest.mocked(subscribeSessionNames).mockImplementation((listener) => {
    reload = listener;
    return () => undefined;
  });
  jest.mocked(subscribeWorkerSessionToken).mockImplementation((listener) => {
    tokenChanged = listener;
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

it('offers the sign-in only while this tab holds none', async () => {
  const kept = source({});
  jest.mocked(kept.hasSignIn).mockResolvedValue(false);
  jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
  const { result } = renderHook(() => useSessionNames(options));
  await waitFor(() => expect(result.current.signIn).toBe(kept.signIn));

  jest.mocked(kept.hasSignIn).mockResolvedValue(true);
  await act(async () => reload());
  expect(result.current.signIn).toBeNull();
});

it('shows the names and keeps the same state when a reload changes nothing', async () => {
  const kept = source({ [A]: 'Sam' });
  jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
  const { result } = renderHook(() => useSessionNames(options));
  await waitFor(() => expect(result.current.names).toEqual({ [A]: 'Sam' }));
  expect(result.current).toMatchObject({ source: kept, answerNamesShown: false, signIn: null });

  const before = result.current;
  await act(async () => reload());
  expect(result.current).toBe(before);

  jest.mocked(kept.readAllOrFail).mockResolvedValueOnce({ [A]: 'Sam Lee' });
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

describe('status', () => {
  const held = () => {
    let finish: (names: Record<string, string>) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    const kept = source({});
    jest.mocked(kept.readAllOrFail).mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
    );
    jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
    return { kept, finish: (names: Record<string, string>) => finish(names), fail: (error: Error) => fail(error) };
  };

  it('is pending from the first render until the read comes back with names', async () => {
    const read = held();
    const { result } = renderHook(() => useSessionNames(options));
    expect(result.current.status).toBe('pending');
    await waitFor(() => expect(read.kept.readAllOrFail).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe('pending');
    await act(async () => read.finish({ [A]: 'Sam' }));
    expect(result.current).toMatchObject({ status: 'named', names: { [A]: 'Sam' } });
    // One batched read serves every address.
    expect(read.kept.readAllOrFail).toHaveBeenCalledTimes(1);
  });

  it('settles as empty when a signed-in read shows no names, and as failed when it could not be made', async () => {
    const empty = held();
    const first = renderHook(() => useSessionNames(options));
    await waitFor(() => expect(empty.kept.readAllOrFail).toHaveBeenCalled());
    await act(async () => empty.finish({}));
    expect(first.result.current).toMatchObject({ status: 'empty', names: {}, source: empty.kept });
    first.unmount();

    const failing = held();
    const second = renderHook(() => useSessionNames(options));
    await waitFor(() => expect(failing.kept.readAllOrFail).toHaveBeenCalled());
    await act(async () => failing.fail(new Error('503')));
    expect(second.result.current).toMatchObject({ status: 'failed', names: {}, source: failing.kept });

    jest.mocked(resolveSessionNamesSource).mockRejectedValue(new Error('unreachable'));
    const third = renderHook(() => useSessionNames(options));
    await waitFor(() => expect(third.result.current.status).toBe('failed'));
  });

  it('shows nothing pending once a tab without a session sign-in reads, and names when it gains one', async () => {
    const kept = source({});
    jest.mocked(kept.hasSignIn).mockResolvedValue(false);
    jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
    const { result } = renderHook(() => useSessionNames(options));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.signIn).toBe(kept.signIn);

    jest.mocked(kept.hasSignIn).mockResolvedValue(true);
    jest.mocked(kept.readAllOrFail).mockResolvedValue({ [A]: 'Sam' });
    await act(async () => tokenChanged());
    expect(result.current).toMatchObject({ status: 'named', names: { [A]: 'Sam' }, signIn: null });
  });

  it('is never pending for someone signed out, names turned off, an older Worker, or no Worker', async () => {
    jest.mocked(resolveSessionNamesSource).mockResolvedValue(source({}));
    const signedOut = renderHook(() => useSessionNames({ ...options, account: '' }));
    expect(signedOut.result.current.status).toBe('unavailable');
    await waitFor(() => expect(resolveSessionNamesSource).toHaveBeenCalled());
    await act(async () => undefined);
    expect(signedOut.result.current.status).toBe('unavailable');

    jest.mocked(resolveSessionNamesSource).mockResolvedValue({ ...source({}), enabled: false });
    const off = renderHook(() => useSessionNames({ ...options, sessionConfig: { namesEnabled: false } }));
    expect(off.result.current.status).toBe('unavailable');
    await act(async () => undefined);
    expect(off.result.current.status).toBe('unavailable');

    jest.mocked(resolveSessionNamesSource).mockResolvedValue(null);
    const older = renderHook(() => useSessionNames(options));
    await waitFor(() => expect(older.result.current).toMatchObject({ status: 'unavailable', answerNamesShown: true }));

    jest.mocked(getUsableSessionWorkerUrl).mockReturnValue('');
    for (const sessionConfig of [onChainConfig, null]) {
      const { result } = renderHook(() => useSessionNames({ ...options, sessionConfig }));
      expect(result.current.status).toBe('unavailable');
    }
  });
});

it('keeps the newest read when an older one finishes after it', async () => {
  let finishOld: (names: Record<string, string>) => void = () => undefined;
  const kept = source({});
  jest
    .mocked(kept.readAllOrFail)
    .mockImplementationOnce(() => new Promise((resolve) => (finishOld = resolve)))
    .mockResolvedValueOnce({ [A]: 'Sam' });
  jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
  const { result } = renderHook(() => useSessionNames(options));
  await waitFor(() => expect(kept.readAllOrFail).toHaveBeenCalledTimes(1));

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

  it('stops showing a lookup under way when the first read hangs, and still shows names that come later', async () => {
    let finish: (names: Record<string, string>) => void = () => undefined;
    const kept = source({});
    jest.mocked(kept.readAllOrFail).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
    const { result } = renderHook(() => useSessionNames(options));
    await settle();
    await wait(NAMES_PENDING_LIMIT_MS - 1);
    expect(result.current.status).toBe('pending');
    await wait(1);
    expect(result.current.status).toBe('failed');
    await act(async () => finish({ [A]: 'Sam' }));
    expect(result.current).toMatchObject({ status: 'named', names: { [A]: 'Sam' } });
  });

  it('settles a failed names read and asks once more', async () => {
    const kept = source({ [A]: 'Sam' });
    jest.mocked(kept.readAllOrFail).mockRejectedValueOnce(new Error('503'));
    jest.mocked(resolveSessionNamesSource).mockResolvedValue(kept);
    const { result } = renderHook(() => useSessionNames(options));
    await settle();
    expect(result.current.status).toBe('failed');
    await wait(NAMES_RETRY_MS);
    expect(result.current).toMatchObject({ status: 'named', names: { [A]: 'Sam' } });
    expect(kept.readAllOrFail).toHaveBeenCalledTimes(2);
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
