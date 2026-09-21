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
