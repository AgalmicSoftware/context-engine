import { act, renderHook, waitFor } from '@testing-library/react';

import { DEBATE_ATLAS_ACTIVE_POLL_MS, DEBATE_ATLAS_KEPT_BUILDS, useSessionDebateAtlas } from './useSessionDebateAtlas';
import {
  readDebateAtlas,
  requestDebateAtlasBuild,
  type DebateAtlasBuildResult,
} from '../../domains/debateAtlas/debateAtlasWorkerClient';
import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';

jest.mock('../../domains/debateAtlas/debateAtlasWorkerClient', () => ({
  readDebateAtlas: jest.fn(),
  requestDebateAtlasBuild: jest.fn(),
}));
jest.mock('../../domains/worker/adminWorkerPorts', () => ({
  adminWorkerPorts: { adminAuth: { buildSignedAdminActionAuth: jest.fn(async () => ({ signed: true })) } },
}));
jest.mock('../../utilities/session/sessionWorkerAvailability', () => ({
  getUsableSessionWorkerUrl: () => 'https://worker.example',
}));

const read = jest.mocked(readDebateAtlas);
const requestBuild = jest.mocked(requestDebateAtlasBuild);
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
      useSessionDebateAtlas({ account, chainId: 1, enabled, provider: 'wallet', sessionConfig, sessionSlug }),
    { initialProps: { account: '', enabled: true, sessionConfig: baseConfig, sessionSlug: 'salon', ...props } },
  );

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue(shown('atlas_k2_00000002'));
});

afterEach(() => {
  jest.useRealTimers();
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
  const kept = Array.from({ length: DEBATE_ATLAS_KEPT_BUILDS }, (_, index) =>
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
  await waitFor(() => expect(result.current.builds).toHaveLength(DEBATE_ATLAS_KEPT_BUILDS));
  let built = false;
  await act(async () => {
    built = await result.current.buildAtlas();
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
  expect(result.current.builds).toHaveLength(DEBATE_ATLAS_KEPT_BUILDS);
  expect(result.current.builds[0].id).toBe('atlas_kz_0000000f');
  expect(result.current.builds.some((entry) => entry.id === kept.at(-1)?.id)).toBe(false);
  expect('branches' in result.current.builds[0]).toBe(false);
});

it('drops a build that finishes after the reader changed', async () => {
  let finish: (value: DebateAtlasBuildResult) => void = () => {};
  requestBuild.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const { result, rerender } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  let pending: Promise<boolean> = Promise.resolve(true);
  act(() => {
    pending = result.current.buildAtlas();
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
    built = await result.current.buildAtlas();
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
    await result.current.buildAtlas();
  });
  expect(result.current.activeSinceMs).toBe(7);
  expect(result.current.error).toBe('An atlas is already being built.');
  expect(read).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(DEBATE_ATLAS_ACTIVE_POLL_MS);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(1);
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
      jest.advanceTimersByTime(DEBATE_ATLAS_ACTIVE_POLL_MS);
      await Promise.resolve();
    });
    expect(read).toHaveBeenCalledTimes(expectedReads);
    expect(result.current.activeSinceMs).toBe(5);
  }
  await act(async () => {
    jest.advanceTimersByTime(DEBATE_ATLAS_ACTIVE_POLL_MS);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(4);
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
  await act(async () => {
    jest.advanceTimersByTime(DEBATE_ATLAS_ACTIVE_POLL_MS * 2);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(4);
});
