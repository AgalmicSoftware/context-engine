import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LinkedWorkerGroup from './LinkedWorkerGroup';
import WorkerSessionGroupsPanel from './WorkerSessionGroupsPanel';
import { fetchWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerDiscovery';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import {
  joinWorkerGroup,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';

jest.mock('../../utilities/session/sessionWorkerDiscovery', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../utilities/session/sessionWorkerDiscovery'),
  fetchWorkerCanonicalSessionBootstrap: jest.fn(),
}));
jest.mock('../../utilities/worker/workerAuth', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../utilities/worker/workerAuth'),
  buildSignedAdminActionAuth: jest.fn(),
  getWorkerSessionToken: jest.fn(async () => 'token'),
}));
jest.mock('../../domains/worker/workerGroupPorts', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../domains/worker/workerGroupPorts'),
  loadPublicWorkerGroups: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
  joinWorkerGroup: jest.fn(),
}));
jest.mock('./WorkerParticipantGroupCreatePanel', () => () => null);

const SESSION = { slug: 'linked-session', sessionId: `0x${'44'.repeat(16)}` };
const WORKER = 'https://linked-worker.example/';
const reference = { sessionSlug: SESSION.slug, sessionId: SESSION.sessionId, workerUrl: WORKER, groupId: 'community' };
const GROUP = {
  groupId: 'community',
  sessionSlug: SESSION.slug,
  label: 'Community',
  joinMode: 'open',
  memberVisibility: 'session',
};
const A = '0x00000000000000000000000000000000000000bb';
const B = '0x00000000000000000000000000000000000000cc';

const profileFor = (publicDiscovery: boolean) => {
  const p = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  if (publicDiscovery) {
    p.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    p.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
    p.encryption = { mode: 'none' };
    p.results.visibility = 'public_full_if_storage_public';
    p.export.scope = 'all_session';
  }
  return p;
};
const configFor = (pub: boolean) => ({
  slug: SESSION.slug,
  sessionIdHex: SESSION.sessionId,
  corsWorkerUrl: WORKER,
  sessionModeProfile: profileFor(pub),
});

type Deferred = { promise: Promise<string>; resolve: (v: string) => void; reject: (e: Error) => void };
const deferred = (): Deferred => {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const tick = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const joinTokens = () =>
  jest.mocked(joinWorkerGroup).mock.calls.map(([args]) => (args as { credentialToken?: string }).credentialToken);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getWorkerSessionToken).mockImplementation(async () => 'token');
  jest.mocked(loadPublicWorkerGroups).mockResolvedValue([GROUP] as never);
  jest.mocked(loadWorkerGroupOverview).mockResolvedValue({ groups: [GROUP], memberships: [] } as never);
  jest.mocked(joinWorkerGroup).mockResolvedValue({ group: GROUP, memberCount: 1 } as never);
});

const panelProps = (overrides: Partial<React.ComponentProps<typeof WorkerSessionGroupsPanel>> = {}) => ({
  showCreate: false,
  provider: {},
  sessionConfig: configFor(true),
  sessionSlug: SESSION.slug,
  networkChainId: null,
  ...overrides,
});

it('joins exactly once after a rejected sign-in and a fresh Join click', async () => {
  jest
    .mocked(getWorkerSessionToken)
    .mockRejectedValueOnce(new Error('Auth on render rejected'))
    .mockRejectedValueOnce(new Error('Sign-in rejected'))
    .mockResolvedValueOnce('token-a');
  render(<WorkerSessionGroupsPanel {...panelProps()} account={A} />);
  await tick(100);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' })));
  expect(await screen.findByText('Sign-in rejected')).toBeInTheDocument();
  await tick(60);
  expect(joinWorkerGroup).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' })));
  await waitFor(() => expect(joinWorkerGroup).toHaveBeenCalledTimes(1));
  await tick(80);
  expect(joinTokens()).toEqual(['token-a']);
});

it('allows a fresh Join after a rejected linked-group sign-in', async () => {
  jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockResolvedValue({
    config: configFor(false),
    sessionId: SESSION.sessionId,
    sessionSlug: SESSION.slug,
    workerOrigin: new URL(WORKER).origin,
    configRevision: 'v1',
  } as never);
  jest
    .mocked(getWorkerSessionToken)
    .mockRejectedValueOnce(new Error('Sign-in rejected'))
    .mockResolvedValueOnce('token-a');
  render(
    <LinkedWorkerGroup
      reference={reference}
      account={A}
      provider={{}}
      networkChainId={null}
      toggleLoginModal={jest.fn()}
    />,
  );
  await waitFor(() => expect(fetchWorkerCanonicalSessionBootstrap).toHaveBeenCalled());
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Join' })));
  expect(await screen.findByText('Sign-in rejected')).toBeInTheDocument();
  expect(joinWorkerGroup).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Join' })));
  await waitFor(() => expect(joinWorkerGroup).toHaveBeenCalledTimes(1));
  await tick(80);
  expect(joinTokens()).toEqual(['token-a']);
});

it('cancels the pending Join when switching accounts before a rejected sign-in', async () => {
  const joinSignIn = deferred();
  jest
    .mocked(getWorkerSessionToken)
    .mockRejectedValueOnce(new Error('Auth on render rejected')) // A, render
    .mockImplementationOnce(() => joinSignIn.promise) // A, Join click (wallet prompt open)
    .mockResolvedValueOnce('token-b') // B, render
    .mockResolvedValueOnce('token-a'); // A again, render
  const view = render(<WorkerSessionGroupsPanel {...panelProps()} account={A} />);
  await tick(100);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' })));
  view.rerender(<WorkerSessionGroupsPanel {...panelProps()} account={B} />);
  await tick(80);
  await act(async () => {
    joinSignIn.reject(new Error('Sign-in rejected'));
  });
  await tick(40);
  view.rerender(<WorkerSessionGroupsPanel {...panelProps()} account={A} />);
  await tick(150);
  expect(joinWorkerGroup).not.toHaveBeenCalled();
});

it('cancels the pending Join when a superseded same-target sign-in is rejected', async () => {
  const joinSignIn = deferred();
  const autoSignIn = deferred();
  jest
    .mocked(getWorkerSessionToken)
    .mockRejectedValueOnce(new Error('Auth on render rejected')) // render
    .mockImplementationOnce(() => joinSignIn.promise) // Join click
    .mockImplementationOnce(() => autoSignIn.promise); // effect re-run after the config refresh
  const view = render(<WorkerSessionGroupsPanel {...panelProps()} account={A} />);
  await tick(100);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' })));
  view.rerender(<WorkerSessionGroupsPanel {...panelProps({ sessionConfig: configFor(true) })} account={A} />);
  await tick(60);
  await act(async () => {
    joinSignIn.reject(new Error('Sign-in rejected'));
  });
  await tick(40);
  await act(async () => {
    autoSignIn.resolve('token-a');
  });
  await tick(150);
  expect(joinWorkerGroup).not.toHaveBeenCalled();
});

it.each([true, false])('joins once after a same-content config refresh (shared prompt: %s)', async (sharedPrompt) => {
  const joinSignIn = deferred();
  const refreshedSignIn = sharedPrompt ? joinSignIn : deferred();
  jest
    .mocked(getWorkerSessionToken)
    .mockRejectedValueOnce(new Error('Auth on render rejected'))
    .mockImplementationOnce(() => joinSignIn.promise)
    // workerAuth normally de-duplicates same-target calls onto the open wallet prompt.
    .mockImplementationOnce(() => refreshedSignIn.promise);
  const sessionConfig = configFor(true);
  const props = panelProps({ sessionConfig });
  const view = render(<WorkerSessionGroupsPanel {...props} account={A} />);
  await screen.findByText('Auth on render rejected');
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' }));
  await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(2));
  view.rerender(<WorkerSessionGroupsPanel {...props} sessionConfig={{ ...sessionConfig }} account={A} />);
  await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(3));
  await act(async () => joinSignIn.resolve('token-a'));
  if (!sharedPrompt) {
    expect(joinWorkerGroup).not.toHaveBeenCalled();
    await act(async () => refreshedSignIn.resolve('token-a'));
  }
  await waitFor(() => expect(joinTokens()).toEqual(['token-a']));
  expect(await screen.findByRole('button', { name: 'Leave Community' })).toBeInTheDocument();
});

it('keeps the explicit Join when the parent rerenders with a fresh config object', async () => {
  const joinSignIn = deferred();
  jest
    .mocked(getWorkerSessionToken)
    .mockRejectedValueOnce(new Error('Auth on render rejected'))
    .mockImplementation(() => joinSignIn.promise);
  const sessionConfig = configFor(true);
  const props = panelProps({ sessionConfig });
  const Parent = () => <WorkerSessionGroupsPanel {...props} sessionConfig={{ ...sessionConfig }} account={A} />;
  const view = render(<Parent />);
  await screen.findByText('Auth on render rejected');
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' }));
  await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(2));
  view.rerender(<Parent />);
  await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(3));
  await act(async () => joinSignIn.resolve('token-a'));
  await waitFor(() => expect(joinTokens()).toEqual(['token-a']));
  expect(await screen.findByRole('button', { name: 'Leave Community' })).toBeInTheDocument();
});
