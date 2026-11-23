import { act, renderHook, waitFor } from '@testing-library/react';

import {
  RESULTS_BUILD_ACTIVE_POLL_MS,
  RESULTS_BUILD_FOLLOW_FAILED_READS,
  RESULTS_BUILD_KEPT_BUILDS,
  useSessionResultsBuild,
} from './useSessionResultsBuild';
import {
  readResultsBuild,
  requestResultsBuild,
  type ResultsBuildJob,
  type ResultsBuildResult,
  type ResultsBuildSummary,
} from '../../domains/resultsBuilds/resultsBuildWorkerClient';
import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';

jest.mock('../../domains/resultsBuilds/resultsBuildWorkerClient', () => ({
  ...jest.requireActual<object>('../../domains/resultsBuilds/resultsBuildWorkerClient'),
  readResultsBuild: jest.fn(),
  requestResultsBuild: jest.fn(),
}));
jest.mock('../../domains/worker/adminWorkerPorts', () => ({
  adminWorkerPorts: { adminAuth: { buildSignedAdminActionAuth: jest.fn(async () => ({ signed: true })) } },
}));
jest.mock('../../utilities/session/sessionWorkerAvailability', () => ({
  getUsableSessionWorkerUrl: () => 'https://worker.example',
}));

// Builds of any kind, as the tests hand them back.
type RequestBuild = (
  ...args: Parameters<typeof requestResultsBuild>
) => Promise<ResultsBuildResult<ResultsBuildSummary>>;
const read = jest.mocked(readResultsBuild);
const requestBuild = jest.mocked(requestResultsBuild as RequestBuild);
const address = (digit: number) => `0x${String(digit).repeat(40)}`;
const summary = (id: string) => ({ id, builtAt: '2026-11-08T14:05:00.000Z', counts: { responses: 12 } });
const build = (id: string) => ({ ...summary(id), branches: [] });
const shown = (id: string) => ({ ok: true, status: 200, builds: [summary(id)], build: build(id) });
const baseConfig = {
  slug: 'salon',
  sessionId: `0x${'a'.repeat(32)}`,
  adminAddress: address(1),
  resultsAdminAddresses: [address(2)],
  networkChainId: 84532,
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  debateAtlas: true,
};

type Props = { account: string; enabled: boolean; sessionConfig: Record<string, unknown>; sessionSlug: string };
const renderAtlas = (props: Partial<Props> = {}) =>
  renderHook(
    ({ account, enabled, sessionConfig, sessionSlug }: Props) =>
      useSessionResultsBuild({
        account,
        chainId: 1,
        enabled,
        kind: 'debate-atlas',
        provider: 'wallet',
        sessionConfig,
        sessionSlug,
      }),
    { initialProps: { account: '', enabled: true, sessionConfig: baseConfig, sessionSlug: 'salon', ...props } },
  );

// Lets the reads and presses the tests answer at once settle.
const flush = () =>
  act(async () => {
    for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
  });
const checkBack = async () => {
  await act(async () => {
    jest.advanceTimersByTime(RESULTS_BUILD_ACTIVE_POLL_MS);
  });
  await flush();
};
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const showPage = (state: DocumentVisibilityState) =>
  act(async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  });
const dropped = { ok: false, status: 0, dropped: true, error: 'The connection dropped.' };
// A Worker that answers a press at once, and the press's job as its reads tell it.
const started: ResultsBuildResult<ResultsBuildSummary> = {
  ok: true,
  status: 202,
  started: { jobId: 'job-a', startedAtMs: 49_000 },
};
const job = (state: ResultsBuildJob['state'], more: Partial<ResultsBuildJob> = {}): ResultsBuildJob => ({
  jobId: 'job-a',
  state,
  startedAtMs: 49_000,
  ...more,
});

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue(shown('atlas_k2_00000002'));
});

afterEach(() => {
  jest.useRealTimers();
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  else Reflect.deleteProperty(document, 'visibilityState');
});

it('does nothing on a Worker that does not build atlases, even for its admin', () => {
  const { result } = renderAtlas({ account: address(1), sessionConfig: { ...baseConfig, debateAtlas: undefined } });
  expect(result.current.supported).toBe(false);
  expect(result.current.canBuild).toBe(false);
  expect(read).not.toHaveBeenCalled();
});

it('reads the newest atlas when Results opens, and only then', async () => {
  const { result, rerender } = renderAtlas({ enabled: false });
  expect(read).not.toHaveBeenCalled();
  rerender({ account: '', enabled: true, sessionConfig: baseConfig, sessionSlug: 'salon' });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  expect(read).toHaveBeenCalledWith(
    expect.objectContaining({ id: '', sessionSlug: 'salon', workerUrl: 'https://worker.example' }),
  );
  expect(result.current.builds.map((entry) => entry.id)).toEqual(['atlas_k2_00000002']);
});

it.each([
  ['a viewer', address(9), false, false],
  ['the creator', address(1), false, true],
  ['a results admin', address(2), false, true],
  ['an account the Worker says may build', address(9), true, true],
])('offers Build to %s: %s', async (_who, account, serverCanBuild, canBuild) => {
  read.mockResolvedValue({ ok: true, status: 200, builds: [], build: null, canBuild: serverCanBuild });
  const { result } = renderAtlas({ account });
  await waitFor(() => expect(read).toHaveBeenCalled());
  await waitFor(() => expect(result.current.canBuild).toBe(canBuild));
});

it('starts empty for another reader or session, and shows a refused reader nothing', async () => {
  const { result, rerender } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({ ok: false, status: 403, error: 'Not visible.' });
  rerender({ account: address(9), enabled: true, sessionConfig: baseConfig, sessionSlug: 'salon' });
  expect(result.current.build).toBeNull();
  await waitFor(() => expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ account: address(9) })));
  expect(result.current.build).toBeNull();
  expect(result.current.builds).toEqual([]);
  expect(result.current.error).toBe('');

  read.mockResolvedValue(shown('atlas_k3_00000003'));
  rerender({
    account: address(9),
    enabled: true,
    sessionConfig: { ...baseConfig, slug: 'other' },
    sessionSlug: 'other',
  });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k3_00000003'));
  rerender({
    account: address(9),
    enabled: true,
    sessionConfig: { ...baseConfig, debateAtlas: undefined },
    sessionSlug: 'other',
  });
  expect(result.current.build).toBeNull();
});

it.each([
  [{ ok: true, status: 200, builds: [], build: null }, true],
  [{ ok: false, status: 401, error: 'Sign in again.' }, true],
  [{ ok: false, status: 403, error: 'Not visible.' }, true],
  [{ ok: false, status: 500, error: 'Atlases are unavailable.' }, false],
])('counts a read answered %j as loaded: %s, and starts unloaded for another reader', async (answer, loaded) => {
  let answerRead: (value: unknown) => void = () => {};
  read.mockImplementation(() => new Promise((resolve) => (answerRead = resolve)) as never);
  const { result, rerender } = renderAtlas({ account: address(1) });
  expect(result.current.loaded).toBe(false);
  await waitFor(() => expect(read).toHaveBeenCalled());
  await act(async () => answerRead(answer));
  expect(result.current.loaded).toBe(loaded);
  rerender({ account: address(9), enabled: true, sessionConfig: baseConfig, sessionSlug: 'salon' });
  expect(result.current.loaded).toBe(false);
});

it('clears the atlas when a later read is refused', async () => {
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({ ok: false, status: 401, error: 'Sign in again.' });
  act(() => result.current.selectBuild('atlas_k1_00000001'));
  await waitFor(() => expect(result.current.build).toBeNull());
  expect(result.current.builds).toEqual([]);
});

it('keeps the shown atlas through a transient failure and says why', async () => {
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({ ok: false, status: 503, error: 'Atlases are unavailable; retry.' });
  act(() => result.current.selectBuild('atlas_k1_00000001'));
  await waitFor(() => expect(result.current.error).toBe('Atlases are unavailable; retry.'));
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
});

it('opens the newest build when the one asked for is no longer kept', async () => {
  const { result } = renderAtlas();
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValueOnce({ ok: false, status: 404, error: 'That atlas is no longer kept.' });
  read.mockResolvedValueOnce(shown('atlas_k3_00000003'));
  act(() => result.current.selectBuild('atlas_k1_00000001'));
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k3_00000003'));
  expect(read.mock.calls.slice(-2).map(([request]) => request.id)).toEqual(['atlas_k1_00000001', '']);
  expect(result.current.error).toBe('');
});

it('signs the build as the account and lists the new atlas first, keeping as many as the Worker', async () => {
  const kept = Array.from({ length: RESULTS_BUILD_KEPT_BUILDS }, (_, index) =>
    summary(`atlas_k${index}_0000000${index}`),
  );
  read.mockResolvedValue({ ok: true, status: 200, builds: kept, build: build(kept[0].id) });
  requestBuild.mockImplementation(async ({ signAdminAction }) => {
    await signAdminAction({
      action: 'debate-atlas/build',
      body: { sessionSlug: 'salon' },
      chainId: 84532,
      workerUrl: 'https://worker.example',
    });
    return { ok: true, status: 200, build: build('atlas_kz_0000000f') };
  });
  const { result } = renderAtlas({ account: address(2) });
  await waitFor(() => expect(result.current.builds).toHaveLength(RESULTS_BUILD_KEPT_BUILDS));
  let built = false;
  await act(async () => {
    built = await result.current.startBuild();
  });
  expect(built).toBe(true);
  expect(requestBuild).toHaveBeenCalledWith(
    expect.objectContaining({ chainId: 84532, sessionSlug: 'salon', workerUrl: 'https://worker.example' }),
  );
  expect(adminWorkerPorts.adminAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'debate-atlas/build',
      slug: 'salon',
      sessionId: baseConfig.sessionId,
      sessionAuthorityMode: 'worker_canonical',
      context: { account: address(2), chainId: 84532, providerLike: 'wallet' },
    }),
  );
  expect(result.current.build?.id).toBe('atlas_kz_0000000f');
  expect(result.current.builds).toHaveLength(RESULTS_BUILD_KEPT_BUILDS);
  expect(result.current.builds[0].id).toBe('atlas_kz_0000000f');
  expect(result.current.builds.some((entry) => entry.id === kept.at(-1)?.id)).toBe(false);
  expect('branches' in result.current.builds[0]).toBe(false);
});

it('drops a build that finishes after the reader changed', async () => {
  let finish: (value: ResultsBuildResult<ResultsBuildSummary>) => void = () => {};
  requestBuild.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const { result, rerender } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  let pending: Promise<boolean> = Promise.resolve(true);
  act(() => {
    pending = result.current.startBuild();
  });
  expect(result.current.building).toBe(true);
  read.mockResolvedValue({ ok: false, status: 403, error: 'Not visible.' });
  rerender({ account: address(9), enabled: true, sessionConfig: baseConfig, sessionSlug: 'salon' });
  expect(result.current.building).toBe(false);
  await act(async () => {
    finish({ ok: true, status: 200, build: build('atlas_kz_0000000f') });
    expect(await pending).toBe(false);
  });
  expect(result.current.build).toBeNull();
  expect(result.current.builds).toEqual([]);
});

it('keeps the shown atlas and reports why a build failed', async () => {
  requestBuild.mockResolvedValue({ ok: false, status: 422, error: 'Needs at least 2 participants.' });
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  let built = true;
  await act(async () => {
    built = await result.current.startBuild();
  });
  expect(built).toBe(false);
  expect(result.current.error).toBe('Needs at least 2 participants.');
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
  expect(result.current.activeSinceMs).toBeNull();
});

it("shows someone else's running build when a press is refused for it, and checks back", async () => {
  jest.useFakeTimers();
  requestBuild.mockResolvedValue({
    ok: false,
    status: 409,
    error: 'An atlas is already being built.',
    active: { startedAtMs: 7 },
  });
  const { result } = renderAtlas({ account: address(1) });
  await act(async () => {
    await Promise.resolve();
  });
  read.mockClear();
  await act(async () => {
    await result.current.startBuild();
  });
  expect(result.current.activeSinceMs).toBe(7);
  expect(result.current.error).toBe('An atlas is already being built.');
  expect(read).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(RESULTS_BUILD_ACTIVE_POLL_MS);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(1);
});

it('checks back on the build the reader picked, not the newest', async () => {
  jest.useFakeTimers();
  const running = { ...shown('atlas_k2_00000002'), active: { startedAtMs: 5 } };
  read.mockResolvedValue(running);
  const { result } = renderAtlas();
  await act(async () => {
    await Promise.resolve();
  });
  act(() => result.current.selectBuild('atlas_k1_00000001'));
  await act(async () => {
    await Promise.resolve();
  });
  expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'atlas_k1_00000001' }));
  read.mockClear();
  await act(async () => {
    jest.advanceTimersByTime(RESULTS_BUILD_ACTIVE_POLL_MS);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'atlas_k1_00000001' }));
});

it("keeps checking back while someone else's build is still running", async () => {
  jest.useFakeTimers();
  const running = { ok: true, status: 200, builds: [], build: null, active: { startedAtMs: 5 } };
  read.mockResolvedValueOnce(running).mockResolvedValueOnce(running).mockResolvedValueOnce(running);
  const { result } = renderAtlas();
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.activeSinceMs).toBe(5);
  for (const expectedReads of [2, 3]) {
    await act(async () => {
      jest.advanceTimersByTime(RESULTS_BUILD_ACTIVE_POLL_MS);
      await Promise.resolve();
    });
    expect(read).toHaveBeenCalledTimes(expectedReads);
    expect(result.current.activeSinceMs).toBe(5);
  }
  await act(async () => {
    jest.advanceTimersByTime(RESULTS_BUILD_ACTIVE_POLL_MS);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(4);
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
  await act(async () => {
    jest.advanceTimersByTime(RESULTS_BUILD_ACTIVE_POLL_MS * 2);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(4);
});

it('follows the build of a press that dropped from the press, reading at once and checking back until it shows', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(50_000);
  requestBuild.mockResolvedValue(dropped);
  const { result } = renderAtlas({ account: address(1) });
  await flush();
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
  read.mockClear();
  let answerRead: (value: unknown) => void = () => {};
  read.mockImplementationOnce(() => new Promise((resolve) => (answerRead = resolve)) as never);
  let answered: boolean | null = null;
  act(() => {
    void result.current.startBuild().then((built) => (answered = built));
  });
  await flush();
  // Not a failure: the Worker may build on, so the build runs from the press and is read at once.
  expect(result.current.dropped).toBe(true);
  expect(result.current.error).toBe('');
  expect(result.current.building).toBe(false);
  expect(result.current.activeSinceMs).toBe(50_000);
  expect(result.current.buildStartedAtMs).toBe(50_000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ id: '' }));
  await act(async () => answerRead({ ...shown('atlas_k2_00000002'), active: { startedAtMs: 49_900 } }));
  expect(result.current.activeSinceMs).toBe(49_900);
  expect(result.current.dropped).toBe(true);
  expect(answered).toBeNull();

  // The check-back finds the new atlas: the follow ends, and the press is answered as built, so it opens.
  read.mockResolvedValue(shown('atlas_k3_00000003'));
  await checkBack();
  expect(read).toHaveBeenCalledTimes(2);
  expect(result.current.build?.id).toBe('atlas_k3_00000003');
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.dropped).toBe(false);
  expect(result.current.error).toBe('');
  expect(answered).toBe(true);
});

it("says a dropped press's build didn't finish when a read finds none running and no new one", async () => {
  requestBuild.mockResolvedValue(dropped);
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  let built: boolean | null = null;
  await act(async () => {
    built = await result.current.startBuild();
  });
  expect(built).toBe(false);
  expect(result.current.dropped).toBe(false);
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.error).toBe("The atlas build didn't finish. Press Build to try again.");
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
});

it('follows a dropped press through failed reads, and says so once it still cannot check', async () => {
  jest.useFakeTimers();
  requestBuild.mockResolvedValue(dropped);
  const { result } = renderAtlas({ account: address(1) });
  await flush();
  read.mockClear();
  const offline = { ok: false, status: 0, error: 'Load failed' };
  // Offline, back with the build running, then offline for good: a read that comes back starts the count again.
  read
    .mockResolvedValueOnce(offline)
    .mockResolvedValueOnce({ ...shown('atlas_k2_00000002'), active: { startedAtMs: 5 } })
    .mockResolvedValue(offline);
  let answered: boolean | null = null;
  act(() => {
    void result.current.startBuild().then((built) => (answered = built));
  });
  await flush();
  const reads = 2 + RESULTS_BUILD_FOLLOW_FAILED_READS;
  for (let done = 1; done < reads; done += 1) {
    expect(read).toHaveBeenCalledTimes(done);
    expect(result.current.dropped).toBe(true);
    expect(result.current.error).toBe('');
    await checkBack();
  }
  expect(read).toHaveBeenCalledTimes(reads);
  expect(result.current.dropped).toBe(false);
  expect(result.current.activeSinceMs).toBeNull();
  // In the site's words, not the browser's.
  expect(result.current.error).toBe("Couldn't check on the atlas build. Reload to see if it finished.");
  expect(answered).toBe(false);
  await checkBack();
  expect(read).toHaveBeenCalledTimes(reads);
});

it('reads again when the page is shown while a build is pressed or running, and not otherwise', async () => {
  let finish: (value: ResultsBuildResult<ResultsBuildSummary>) => void = () => {};
  requestBuild.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockClear();
  await showPage('hidden');
  await showPage('visible');
  expect(read).not.toHaveBeenCalled();

  // A press in flight, which a phone may have cut while the page was hidden.
  let pending: Promise<boolean> = Promise.resolve(false);
  act(() => {
    pending = result.current.startBuild();
  });
  await showPage('hidden');
  expect(read).not.toHaveBeenCalled();
  await showPage('visible');
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({ ok: true, status: 200, build: build('atlas_kz_0000000f') });
    await pending;
  });

  // Someone else's build running.
  read.mockResolvedValue({ ...shown('atlas_kz_0000000f'), active: { startedAtMs: 5 } });
  act(() => result.current.selectBuild(''));
  await waitFor(() => expect(result.current.activeSinceMs).toBe(5));
  read.mockClear();
  await showPage('visible');
  expect(read).toHaveBeenCalledTimes(1);
});

it("shows a press's failure though a read while it built found its build running", async () => {
  let finish: (value: ResultsBuildResult<ResultsBuildSummary>) => void = () => {};
  requestBuild.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  let pending: Promise<boolean> = Promise.resolve(true);
  act(() => {
    pending = result.current.startBuild();
  });
  // Back on the page while it builds: the read finds the press's own build running.
  read.mockResolvedValue({ ...shown('atlas_k2_00000002'), active: { startedAtMs: 5 } });
  await showPage('visible');
  expect(result.current.activeSinceMs).toBe(5);
  await act(async () => {
    finish({ ok: false, status: 502, error: 'Planning the atlas failed.' });
    await pending;
  });
  // Nothing runs to check back on, so the failure stays shown.
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.error).toBe('Planning the atlas failed.');
});

it.each([
  ['an older build as not its own', '2026-11-08T14:05:00.000Z', false],
  ['a build from after the press as its own', '2026-11-20T10:03:00.000Z', true],
])('takes, for a dropped press made before any read came back, %s', async (_what, builtAt, built) => {
  jest.useFakeTimers();
  jest.setSystemTime(Date.parse('2026-11-20T10:00:00.000Z'));
  requestBuild.mockResolvedValue(dropped);
  read.mockImplementationOnce(() => new Promise(() => {}) as never);
  const { result } = renderAtlas({ account: address(1) });
  await flush();
  expect(result.current.loaded).toBe(false);
  read.mockResolvedValue({
    ok: true,
    status: 200,
    builds: [{ ...summary('atlas_k2_00000002'), builtAt }],
    build: { ...build('atlas_k2_00000002'), builtAt },
  });
  let answered: boolean | null = null;
  act(() => {
    void result.current.startBuild().then((value) => (answered = value));
  });
  await flush();
  expect(answered).toBe(built);
  expect(result.current.dropped).toBe(false);
  expect(result.current.error).toBe(built ? '' : "The atlas build didn't finish. Press Build to try again.");
});

it('follows a build the Worker said it started until a read says its job built', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(50_000);
  requestBuild.mockResolvedValue(started);
  const { result } = renderAtlas({ account: address(1) });
  await flush();
  read.mockClear();
  read.mockResolvedValue({ ...shown('atlas_k2_00000002'), active: { startedAtMs: 49_000 }, job: job('running') });
  let answered: boolean | null = null;
  act(() => {
    void result.current.startBuild().then((built) => (answered = built));
  });
  await flush();
  // Not dropped: the build runs, timed from when the Worker started it, and is read at once.
  expect(read).toHaveBeenCalledTimes(1);
  expect(result.current.dropped).toBe(false);
  expect(result.current.building).toBe(false);
  expect(result.current.error).toBe('');
  expect(result.current.buildStartedAtMs).toBe(49_000);
  expect(answered).toBeNull();

  // Still running at the check-back, so still followed.
  await checkBack();
  expect(read).toHaveBeenCalledTimes(2);
  expect(result.current.activeSinceMs).toBe(49_000);
  expect(answered).toBeNull();

  read.mockResolvedValue({
    ...shown('atlas_k3_00000003'),
    job: job('done', { finishedAtMs: 500_000, ok: true, buildId: 'atlas_k3_00000003' }),
  });
  await checkBack();
  expect(read).toHaveBeenCalledTimes(3);
  expect(result.current.build?.id).toBe('atlas_k3_00000003');
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.error).toBe('');
  expect(answered).toBe(true);
});

it('says why a build the Worker said it started failed, in the words of its job', async () => {
  requestBuild.mockResolvedValue(started);
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({
    ...shown('atlas_k2_00000002'),
    job: job('done', { finishedAtMs: 80_000, ok: false, error: 'Planning the atlas failed.' }),
  });
  let built: boolean | null = null;
  await act(async () => {
    built = await result.current.startBuild();
  });
  expect(built).toBe(false);
  expect(result.current.error).toBe('Planning the atlas failed.');
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
});

it.each([
  [
    'a newer job, and no new build, as not built',
    job('done', { jobId: 'job-b', startedAtMs: 60_000, ok: false, error: 'Planning the atlas failed.' }),
    'atlas_k2_00000002',
    false,
  ],
  ['no job, as to a reader not told of jobs, and a new build, as built', undefined, 'atlas_k3_00000003', true],
  // Its lease bounds the follow, as before: a job that runs on without one is stuck.
  [
    'its job still running without its lease, and no new build, as not built',
    job('running'),
    'atlas_k2_00000002',
    false,
  ],
])('goes by the builds listed when a read tells of %s', async (_what, readJob, newestId, built) => {
  requestBuild.mockResolvedValue(started);
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({ ...shown(newestId), ...(readJob ? { job: readJob } : {}) });
  let answered: boolean | null = null;
  await act(async () => {
    answered = await result.current.startBuild();
  });
  expect(answered).toBe(built);
  expect(result.current.error).toBe(built ? '' : "The atlas build didn't finish. Press Build to try again.");
});

it('tells a reader whose reads are refused that the build their press started runs on', async () => {
  requestBuild.mockResolvedValue(started);
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({ ok: false, status: 401, error: 'Sign in again.' });
  let built: boolean | null = null;
  await act(async () => {
    built = await result.current.startBuild();
  });
  expect(built).toBe(false);
  expect(result.current.build).toBeNull();
  expect(result.current.canBuild).toBe(true);
  expect(result.current.error).toBe(
    "The atlas build runs on, but this page can't read it. Sign in again or reload to see it once it's built.",
  );
});

it('answers a followed press as not built when the reader changes', async () => {
  requestBuild.mockResolvedValue(dropped);
  const { result, rerender } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({ ...shown('atlas_k2_00000002'), active: { startedAtMs: 5 } });
  let answered: boolean | null = null;
  act(() => {
    void result.current.startBuild().then((value) => (answered = value));
  });
  await waitFor(() => expect(result.current.activeSinceMs).toBe(5));
  expect(result.current.dropped).toBe(true);
  read.mockResolvedValue({ ok: false, status: 403, error: 'Not visible.' });
  rerender({ account: address(9), enabled: true, sessionConfig: baseConfig, sessionSlug: 'salon' });
  await waitFor(() => expect(answered).toBe(false));
  expect(result.current.dropped).toBe(false);
  expect(result.current.activeSinceMs).toBeNull();
});

it('names the Worker that keeps its atlases, and none where it builds none', async () => {
  const { result } = renderAtlas();
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  expect(result.current.workerUrl).toBe('https://worker.example');
  const unsupported = renderAtlas({ sessionConfig: { ...baseConfig, debateAtlas: undefined } });
  expect(unsupported.result.current.workerUrl).toBe('');
});

it('times a press from when it started and gives the model and prompts the Worker sent builders', async () => {
  const nextBuild = { model: 'deep-model', prompts: { plan: 'Plan <Questions>', map: 'Map <Responses>' } };
  read.mockResolvedValue({ ...shown('atlas_k2_00000002'), canBuild: true, nextBuild });
  let finish: (value: ResultsBuildResult<ResultsBuildSummary>) => void = () => {};
  requestBuild.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.nextBuild).toEqual(nextBuild));
  expect(result.current.buildStartedAtMs).toBeNull();

  const before = Date.now();
  let pending: Promise<boolean> = Promise.resolve(true);
  act(() => {
    pending = result.current.startBuild();
  });
  expect(result.current.buildStartedAtMs).toBeGreaterThanOrEqual(before);
  await act(async () => {
    finish({ ok: true, status: 200, build: build('atlas_kz_0000000f') });
    await pending;
  });
  expect(result.current.buildStartedAtMs).toBeNull();
});

it("times someone else's running build from its start", async () => {
  read.mockResolvedValue({ ...shown('atlas_k2_00000002'), active: { startedAtMs: 1234 } });
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.activeSinceMs).toBe(1234));
  expect(result.current.buildStartedAtMs).toBe(1234);
});

describe('a risk matrix', () => {
  const renderRiskMatrix = (sessionConfig: Record<string, unknown>) =>
    renderHook(() =>
      useSessionResultsBuild({
        account: address(1),
        chainId: 1,
        enabled: true,
        kind: 'risk-matrix',
        provider: 'wallet',
        sessionConfig,
        sessionSlug: 'salon',
      }),
    );
  const riskBuild = (id: string) => ({ ...summary(id), areas: [{ name: 'Trust', subareas: ['Identity'] }], notes: [] });

  it('is read where the Worker builds risk matrices, whatever it says of atlases', async () => {
    read.mockResolvedValue({
      ok: true,
      status: 200,
      builds: [summary('risk_k2_00000002')],
      build: riskBuild('risk_k2_00000002'),
    });
    const { result } = renderRiskMatrix({ ...baseConfig, debateAtlas: undefined, riskMatrix: true });
    await waitFor(() => expect(result.current.build?.id).toBe('risk_k2_00000002'));
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ kind: 'risk-matrix', sessionSlug: 'salon' }));
    expect(result.current.canBuild).toBe(true);

    read.mockClear();
    const atlasOnly = renderRiskMatrix(baseConfig);
    expect(atlasOnly.result.current.supported).toBe(false);
    expect(atlasOnly.result.current.canBuild).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it('lists a new build without its areas and notes, and says why one failed in its own words', async () => {
    read.mockResolvedValue({ ok: true, status: 200, builds: [], build: null });
    requestBuild.mockResolvedValueOnce({ ok: true, status: 200, build: riskBuild('risk_kz_0000000f') });
    const { result } = renderRiskMatrix({ ...baseConfig, riskMatrix: true });
    await waitFor(() => expect(read).toHaveBeenCalled());
    await act(async () => {
      expect(await result.current.startBuild()).toBe(true);
    });
    expect(requestBuild).toHaveBeenCalledWith(expect.objectContaining({ kind: 'risk-matrix' }));
    expect(result.current.build?.id).toBe('risk_kz_0000000f');
    expect(result.current.builds).toEqual([summary('risk_kz_0000000f')]);

    requestBuild.mockResolvedValueOnce({ ok: false, status: 0 });
    await act(async () => {
      expect(await result.current.startBuild()).toBe(false);
    });
    expect(result.current.error).toBe('The risk matrix build failed.');
  });
});
