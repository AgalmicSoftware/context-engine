// Rejected join authentication must consume its join intent.
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getWorkerSessionToken).mockImplementation(async () => 'token');
  jest.mocked(loadPublicWorkerGroups).mockResolvedValue([GROUP] as never);
  jest.mocked(loadWorkerGroupOverview).mockResolvedValue({ groups: [GROUP], memberships: [] } as never);
  jest.mocked(joinWorkerGroup).mockResolvedValue({ group: GROUP, memberCount: 1 } as never);
});

const mountLinked = async (pub: boolean, account = A, toggleLoginModal = jest.fn()) => {
  jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockResolvedValue({
    config: configFor(pub),
    sessionId: SESSION.sessionId,
    sessionSlug: SESSION.slug,
    workerOrigin: new URL(WORKER).origin,
    configRevision: 'v1',
  } as never);
  const view = render(
    <LinkedWorkerGroup
      reference={reference}
      account={account}
      provider={{}}
      networkChainId={null}
      toggleLoginModal={toggleLoginModal}
    />,
  );
  await waitFor(() => expect(fetchWorkerCanonicalSessionBootstrap).toHaveBeenCalled());
  return { view, toggleLoginModal };
};
const tick = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));

it('G3 double-click on "Sign in to join": one sign-in, one join', async () => {
  await mountLinked(true);
  const join = await screen.findByRole('button', { name: 'Sign in to join Community' });
  // Two separate discrete events, as a real double-click delivers them.
  await act(async () => {
    fireEvent.click(join);
  });
  await act(async () => {
    fireEvent.click(join);
  });
  await waitFor(() => expect(joinWorkerGroup).toHaveBeenCalledTimes(1));
  await tick(50);
  expect(getWorkerSessionToken).toHaveBeenCalledTimes(1);
  expect(joinWorkerGroup).toHaveBeenCalledTimes(1);
});

it('G4 public discovery, already a member: signing in from "Sign in to join" does not join again', async () => {
  jest.mocked(loadWorkerGroupOverview).mockResolvedValue({
    groups: [GROUP],
    memberships: [{ group: GROUP, member: { address: A } }],
  } as never);
  await mountLinked(true);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' })));
  expect(await screen.findByRole('button', { name: 'Leave Community' })).toBeInTheDocument();
  await tick(50);
  expect(joinWorkerGroup).not.toHaveBeenCalled();
});

it('G5 rejected sign-in, then the error notice Retry: is the earlier Join still executed?', async () => {
  jest.mocked(getWorkerSessionToken).mockRejectedValueOnce(new Error('Sign-in rejected'));
  await mountLinked(true);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' })));
  expect(await screen.findByText('Sign-in rejected')).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })));
  await tick(80);
  expect(joinWorkerGroup).not.toHaveBeenCalled();
});

it('G6 session panel: Join -> rejected sign-in -> account B -> back to A auto-signs in and joins without a click', async () => {
  // Auth on render for A is rejected, so A sees "Sign in to join".
  jest
    .mocked(getWorkerSessionToken)
    .mockRejectedValueOnce(new Error('Auth on render rejected')) // A, render
    .mockRejectedValueOnce(new Error('Sign-in rejected')) // A, Join click
    .mockResolvedValueOnce('token-b') // B, render
    .mockResolvedValueOnce('token-a'); // A again, render
  const props = {
    showCreate: false,
    provider: {},
    sessionConfig: configFor(true),
    sessionSlug: SESSION.slug,
    networkChainId: null,
  };
  const view = render(<WorkerSessionGroupsPanel {...props} account={A} />);
  await tick(100);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join Community' })));
  expect(await screen.findByText('Sign-in rejected')).toBeInTheDocument();
  view.rerender(<WorkerSessionGroupsPanel {...props} account={B} />);
  await tick(80);
  view.rerender(<WorkerSessionGroupsPanel {...props} account={A} />);
  await tick(120);
  expect(joinWorkerGroup).not.toHaveBeenCalled();
});
