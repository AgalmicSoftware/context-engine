import { act, renderHook, waitFor } from '@testing-library/react';

import { DEBATE_ATLAS_ACTIVE_POLL_MS, useSessionDebateAtlas } from './useSessionDebateAtlas';
import { readDebateAtlas, requestDebateAtlasBuild } from '../../domains/debateAtlas/debateAtlasWorkerClient';
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
const baseConfig = {
  slug: 'salon',
  sessionId: `0x${'a'.repeat(32)}`,
  adminAddress: address(1),
  resultsAdminAddresses: [address(2)],
  networkChainId: 84532,
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  debateAtlas: true,
};

const renderAtlas = ({ account = '', sessionConfig = baseConfig as Record<string, unknown>, enabled = true } = {}) =>
  renderHook(
    (props: { enabled: boolean }) =>
      useSessionDebateAtlas({
        account,
        chainId: 1,
        enabled: props.enabled,
        provider: 'wallet',
        sessionConfig,
        sessionSlug: 'salon',
      }),
    { initialProps: { enabled } },
  );

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue({
    ok: true,
    status: 200,
    builds: [summary('atlas_k2_00000002')],
    build: build('atlas_k2_00000002'),
  });
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
  rerender({ enabled: true });
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

it('a Results that hides atlases shows none and no error', async () => {
  read.mockResolvedValue({ ok: false, status: 403, error: 'Not visible.' });
  const { result } = renderAtlas();
  await waitFor(() => expect(read).toHaveBeenCalled());
  expect(result.current.error).toBe('');
  expect(result.current.build).toBeNull();
});

it('signs the build as the account and puts the new atlas first', async () => {
  requestBuild.mockImplementation(async ({ signAdminAction }) => {
    await signAdminAction({
      action: 'debate-atlas/build',
      body: { sessionSlug: 'salon' },
      chainId: 84532,
      workerUrl: 'https://worker.example',
    });
    return { ok: true, status: 200, build: build('atlas_k3_00000003') };
  });
  const { result } = renderAtlas({ account: address(2) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
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
  expect(result.current.build?.id).toBe('atlas_k3_00000003');
  expect(result.current.builds.map((entry) => entry.id)).toEqual(['atlas_k3_00000003', 'atlas_k2_00000002']);
  expect('branches' in result.current.builds[0]).toBe(false);
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

it("shows someone else's running build when a press is refused for it", async () => {
  requestBuild.mockResolvedValue({
    ok: false,
    status: 409,
    error: 'An atlas is already being built.',
    active: { startedAtMs: 7 },
  });
  const { result } = renderAtlas({ account: address(1) });
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockClear();
  await act(async () => {
    await result.current.buildAtlas();
  });
  expect(result.current.activeSinceMs).toBe(7);
  expect(result.current.error).toBe('An atlas is already being built.');
  expect(read).not.toHaveBeenCalled();
});

it("checks back while someone else's build runs", async () => {
  jest.useFakeTimers();
  read.mockResolvedValueOnce({ ok: true, status: 200, builds: [], build: null, active: { startedAtMs: 5 } });
  const { result } = renderAtlas();
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.activeSinceMs).toBe(5);
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(DEBATE_ATLAS_ACTIVE_POLL_MS);
    await Promise.resolve();
  });
  expect(read).toHaveBeenCalledTimes(2);
  expect(result.current.activeSinceMs).toBeNull();
  expect(result.current.build?.id).toBe('atlas_k2_00000002');
});

it('opens an older build by id', async () => {
  const { result } = renderAtlas();
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k2_00000002'));
  read.mockResolvedValue({
    ok: true,
    status: 200,
    builds: [summary('atlas_k2_00000002'), summary('atlas_k1_00000001')],
    build: build('atlas_k1_00000001'),
  });
  act(() => result.current.selectBuild('atlas_k1_00000001'));
  await waitFor(() => expect(result.current.build?.id).toBe('atlas_k1_00000001'));
  expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'atlas_k1_00000001' }));
});
