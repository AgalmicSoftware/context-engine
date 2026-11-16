import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import PrivateSessionGate from './PrivateSessionGate';
import {
  readAutoJoinLink,
  readPendingAutoJoin,
  savePendingAutoJoin,
} from '../../domains/worker/workerGroupAutoJoinIntent';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  writeTokenCache,
} from '../../utilities/worker/workerAuthTokenCache';
import { readGroupReadHeader, saveGroupReadHeader } from '../../utilities/worker/workerGroupReadProof';

jest.mock('../../domains/worker/workerGroupSecrets', () => ({
  buildWorkerGroupReadHeader: jest.fn(async ({ groupId }: { groupId: string }) => `${groupId}:0x${'ab'.repeat(65)}`),
}));
const mockGetWorkerSessionToken = jest.fn();
jest.mock('../../utilities/worker/workerAuth', () => ({
  getWorkerSessionToken: (...args: unknown[]) => mockGetWorkerSessionToken(...args),
}));

const worker = 'https://salon.example.workers.dev';
const sessionId = `0x${'2a'.repeat(16)}`;
const props = {
  sessionSlug: 'salon',
  sessionId,
  workerUrl: worker,
  shell: 'invite_required' as const,
  sessionConfig: { slug: 'salon' },
  account: '',
};
const holdSignIn = (address: string) =>
  writeTokenCache(
    buildTokenCacheKey({ workerUrl: worker, slug: 'salon', sessionId, address }),
    buildTokenCacheEnvelope({
      token: 'worker-token',
      exp: Math.floor(Date.now() / 1000) + 3600,
      workerUrl: worker,
      sessionSlug: 'salon',
      sessionId,
      address,
    }),
  );
const proof = `rxc:0x${'ab'.repeat(65)}`;
const holdInvite = (token = 'gp:river-stone-lamp') =>
  savePendingAutoJoin({
    version: 1,
    sessionSlug: 'salon',
    groupId: 'rxc',
    workerOrigin: worker,
    sessionId,
    createdAt: Date.now(),
    token,
  });

beforeEach(() => {
  mockGetWorkerSessionToken.mockReset();
  clearAllTokenCaches();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/session/salon');
});

it('without an invite, names nothing and asks for the invite link or a sign-in', () => {
  const login = jest.fn();
  render(<PrivateSessionGate {...props} toggleLoginModal={login} />);
  expect(screen.getByRole('heading', { name: 'Private session' })).toBeInTheDocument();
  expect(screen.getByText('Open it from your invite link.')).toBeInTheDocument();
  expect(screen.getByLabelText('Invite link')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(login).toHaveBeenCalledWith(true);
  expect(screen.queryByText(/isn’t in a group/)).toBeNull();
});

it('signed in but in no group, says so and offers the invite field without a Log in button', () => {
  // The page was read with this sign-in, so reading again would change nothing.
  holdSignIn('0x00000000000000000000000000000000000000ab');
  const reread = jest.fn();
  render(<PrivateSessionGate {...props} account="0xabc" toggleLoginModal={jest.fn()} reread={reread} />);
  expect(screen.getByText('Your account isn’t in a group that can see it yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  expect(mockGetWorkerSessionToken).not.toHaveBeenCalled();
  expect(reread).not.toHaveBeenCalled();
});

it('on signing in here, signs in to the Worker and reads the session again once, as a member would be admitted', async () => {
  mockGetWorkerSessionToken.mockResolvedValue('worker-token');
  const reread = jest.fn();
  const { rerender } = render(<PrivateSessionGate {...props} reread={reread} />);
  expect(mockGetWorkerSessionToken).not.toHaveBeenCalled();
  rerender(<PrivateSessionGate {...props} account="0xabc" provider="passkey" reread={reread} />);
  expect(screen.getByText('Checking your account…')).toBeInTheDocument();
  await waitFor(() => expect(reread).toHaveBeenCalledTimes(1));
  expect(mockGetWorkerSessionToken).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionConfig: props.sessionConfig,
      sessionSlug: 'salon',
      workerUrl: worker,
      context: { account: '0xabc', providerLike: 'passkey' },
    }),
  );
  // Coming back to this page within the minute, it stops and says so.
  rerender(<PrivateSessionGate {...props} account="0xdef" reread={reread} />);
  await waitFor(() =>
    expect(screen.getByText('Your account isn’t in a group that can see it yet.')).toBeInTheDocument(),
  );
  expect(reread).toHaveBeenCalledTimes(1);
});

it('a declined Worker sign-in leaves the way in open', async () => {
  mockGetWorkerSessionToken.mockRejectedValue(new Error('cancelled'));
  const reread = jest.fn();
  render(<PrivateSessionGate {...props} account="0xabc" reread={reread} />);
  await waitFor(() => expect(screen.getByLabelText('Invite link')).toBeInTheDocument());
  expect(reread).not.toHaveBeenCalled();
});

it('turns the invite this tab holds into a kept read proof, then reads the session again', async () => {
  holdInvite();
  const reread = jest.fn();
  render(<PrivateSessionGate {...props} reread={reread} />);
  expect(screen.getByText('Opening your invite…')).toBeInTheDocument();
  await waitFor(() => expect(reread).toHaveBeenCalledTimes(1));
  expect(readGroupReadHeader(worker, 'salon')).toBe(proof);
  // The invite stays for the join at sign-in.
  expect(readPendingAutoJoin()?.token).toBe('gp:river-stone-lamp');
});

it('when the Worker refuses the proof sent, forgets the proof and the invite and says so plainly', () => {
  holdInvite();
  saveGroupReadHeader({ workerUrl: worker, sessionSlug: 'salon', sessionId, header: proof });
  const reread = jest.fn();
  render(<PrivateSessionGate {...props} shell="invite_invalid" account="0xabc" reread={reread} />);
  expect(screen.getByRole('alert')).toHaveTextContent('This invite no longer works. Ask the host for a new link.');
  expect(readGroupReadHeader(worker, 'salon')).toBe('');
  expect(readPendingAutoJoin()?.token).toBeUndefined();
  expect(reread).not.toHaveBeenCalled();
  expect(mockGetWorkerSessionToken).not.toHaveBeenCalled();
});

it('opens from a pasted link, keeping its secret out of the address', async () => {
  const reread = jest.fn();
  render(<PrivateSessionGate {...props} reread={reread} />);
  const field = screen.getByLabelText('Invite link');
  fireEvent.change(field, {
    target: { value: 'https://site.example/session/other?joinGroup=rxc#groupInvite=gp%3Ariver-stone-lamp' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByRole('alert')).toHaveTextContent('That invite link is for another session.');
  fireEvent.change(field, { target: { value: 'gp:river-stone-lamp' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Paste the whole invite link, including the part after #.');
  expect(screen.getByRole('alert')).not.toHaveTextContent('river');

  fireEvent.change(field, {
    target: { value: `${window.location.origin}/session/salon?joinGroup=rxc#groupInvite=gp%3Ariver-stone-lamp` },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  await waitFor(() => expect(reread).toHaveBeenCalledTimes(1));
  expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
    '/session/salon?joinGroup=rxc',
  );
  expect(readPendingAutoJoin()).toMatchObject({ groupId: 'rxc', token: 'gp:river-stone-lamp', sessionId });
  expect(readGroupReadHeader(worker, 'salon')).toBe(proof);
  // The group's invitation reads the new address as a link; it finds the secret, so signing in joins.
  const context = { sessionSlug: 'salon', sessionId, workerUrl: worker, chainId: 0 };
  expect(readAutoJoinLink('/session/salon?joinGroup=rxc', context)?.token).toBe('gp:river-stone-lamp');
});

it('reads the session again when a join completes, but not in a loop', () => {
  holdSignIn('0x00000000000000000000000000000000000000ab');
  const reread = jest.fn();
  render(<PrivateSessionGate {...props} account="0xabc" reread={reread} />);
  const joined = (sessionSlug: string) =>
    act(() => {
      dispatchWorkerGroupsChanged({ sessionSlug, sessionId });
    });
  joined('another');
  expect(reread).not.toHaveBeenCalled();
  joined('salon');
  expect(reread).toHaveBeenCalledTimes(1);
  joined('salon');
  expect(reread).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/You joined the group, but the session didn’t open/)).toBeInTheDocument();
});
