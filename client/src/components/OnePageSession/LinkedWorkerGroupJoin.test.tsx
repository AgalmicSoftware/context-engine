import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LinkedWorkerGroup from './LinkedWorkerGroup';
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
const ACCOUNT = '0x00000000000000000000000000000000000000bb';

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

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadPublicWorkerGroups).mockResolvedValue([GROUP] as never);
  jest.mocked(loadWorkerGroupOverview).mockResolvedValue({ groups: [GROUP], memberships: [] } as never);
  jest.mocked(joinWorkerGroup).mockResolvedValue({ group: GROUP, memberCount: 1 } as never);
});

const mount = async (publicDiscovery: boolean) => {
  jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockResolvedValue({
    config: {
      slug: SESSION.slug,
      sessionIdHex: SESSION.sessionId,
      corsWorkerUrl: WORKER,
      sessionModeProfile: profileFor(publicDiscovery),
    },
    sessionId: SESSION.sessionId,
    sessionSlug: SESSION.slug,
    workerOrigin: new URL(WORKER).origin,
    configRevision: 'v1',
  } as never);
  const view = render(
    <LinkedWorkerGroup reference={reference} account={ACCOUNT} provider={{}} networkChainId={null} />,
  );
  await waitFor(() => expect(fetchWorkerCanonicalSessionBootstrap).toHaveBeenCalled());
  return view;
};

it.each([false, true])('linked group (public discovery: %s): first Join signs in and joins', async (pub) => {
  await mount(pub);
  const firstJoin = await screen.findByRole('button', { name: pub ? 'Sign in to join Community' : 'Join' });
  expect(getWorkerSessionToken).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(firstJoin);
  });
  await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(joinWorkerGroup).toHaveBeenCalledTimes(1));
  expect(getWorkerSessionToken).toHaveBeenCalledTimes(1);
});

it('an existing member gets a Leave control once membership is known', async () => {
  jest.mocked(loadWorkerGroupOverview).mockResolvedValue({
    groups: [GROUP],
    memberships: [{ group: GROUP, member: { address: ACCOUNT } }],
  } as never);
  await mount(false);
  expect(await screen.findByText('Join to sign in and view this linked group.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Leave Community' })).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  });
  expect(await screen.findByRole('button', { name: 'Leave Community' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Join Community' })).toBeNull();
  expect(joinWorkerGroup).not.toHaveBeenCalled();
});

it('an account switch after sign-in does not sign the new account in by itself', async () => {
  const view = await mount(false);
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Join' }));
  });
  await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(1));
  view.rerender(
    <LinkedWorkerGroup
      reference={reference}
      account="0x00000000000000000000000000000000000000cc"
      provider={{}}
      networkChainId={null}
    />,
  );
  await new Promise((r) => setTimeout(r, 30));
  expect(getWorkerSessionToken).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Join to sign in and view this linked group.')).toBeInTheDocument();
});

it('does not join after a rejected sign-in', async () => {
  jest.mocked(getWorkerSessionToken).mockRejectedValueOnce(new Error('Sign-in rejected'));
  await mount(false);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Join' })));
  expect(await screen.findByText('Sign-in rejected')).toBeInTheDocument();
  expect(joinWorkerGroup).not.toHaveBeenCalled();
});

it('does not carry a pending Join across an account change', async () => {
  let release: (token: string) => void = () => {};
  jest.mocked(getWorkerSessionToken).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const view = await mount(false);
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Join' })));
  await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(1));
  view.rerender(
    <LinkedWorkerGroup
      reference={reference}
      account="0x00000000000000000000000000000000000000cc"
      provider={{}}
      networkChainId={null}
    />,
  );
  await act(async () => {
    release('old-account-token');
  });
  expect(await screen.findByText('Join to sign in and view this linked group.')).toBeInTheDocument();
  expect(joinWorkerGroup).not.toHaveBeenCalled();
  expect(getWorkerSessionToken).toHaveBeenCalledTimes(1);
});
