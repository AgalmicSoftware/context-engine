import React from 'react';
import { render } from '@testing-library/react';
import WorkerGroupAutoJoinHost from './WorkerGroupAutoJoinHost';
import { readPendingAutoJoin, savePendingAutoJoin } from '../../domains/worker/workerGroupAutoJoinIntent';

// Keep the optional UI suspended to exercise early capture independently of
// network/chunk timing.
jest.mock('./WorkerGroupAutoJoin', () => ({
  __esModule: true,
  default: () => {
    throw new Promise(() => {});
  },
}));
const props = {
  sessionConfig: null,
  sessionSlug: '',
  account: '',
  provider: null,
  loginComplete: false,
  toggleLoginModal: () => {},
};
beforeEach(() => sessionStorage.clear());

it('saves the discovery link before the UI chunk finishes loading', () => {
  window.history.replaceState({}, '', '/session/alpha?joinGroup=attendees&worker=https://worker.example');
  const { rerender } = render(<WorkerGroupAutoJoinHost {...props} />);
  expect(readPendingAutoJoin()).toMatchObject({
    sessionSlug: 'alpha',
    groupId: 'attendees',
    workerOrigin: 'https://worker.example',
  });
  window.history.replaceState({}, '', '/about');
  rerender(<WorkerGroupAutoJoinHost {...props} />);
  expect(readPendingAutoJoin()?.groupId).toBe('attendees');
});

it('does not erase the pinned identity or renew a pending invitation on refresh', () => {
  window.history.replaceState({}, '', '/session/alpha?joinGroup=attendees&worker=https://worker.example');
  const pending = {
    version: 1 as const,
    sessionSlug: 'alpha',
    groupId: 'attendees',
    workerOrigin: 'https://worker.example',
    sessionId: '0x11111111111111111111111111111111',
    createdAt: Date.now() - 10000,
  };
  savePendingAutoJoin(pending);
  render(<WorkerGroupAutoJoinHost {...props} />);
  expect(readPendingAutoJoin()).toEqual(pending);
});

it('keeps a link’s invite in this tab and takes it out of the address before anything else runs', () => {
  window.history.replaceState(
    { keep: true },
    '',
    '/session/alpha?joinGroup=attendees&worker=https://worker.example#prefill=x&groupInvite=gp%3Ariver-stone-lamp',
  );
  render(<WorkerGroupAutoJoinHost {...props} />);
  expect(readPendingAutoJoin()?.token).toBe('gp:river-stone-lamp');
  expect(window.location.hash).toBe('#prefill=x');
  expect(window.location.search).toBe('?joinGroup=attendees&worker=https://worker.example');
  expect(window.history.state).toEqual({ keep: true });
});

it('drops an invite from the address even without a group to join', () => {
  window.history.replaceState({}, '', '/session/alpha#groupInvite=abcdef0123456789abcdef0123456789');
  render(<WorkerGroupAutoJoinHost {...props} />);
  expect(window.location.hash).toBe('');
  expect(readPendingAutoJoin()).toBeNull();
});
