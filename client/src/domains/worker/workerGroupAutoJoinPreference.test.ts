import {
  clearWorkerGroupAutoJoinCancellation,
  isWorkerGroupAutoJoinCancelled,
  rememberWorkerGroupAutoJoinCancellation,
} from './workerGroupAutoJoinPreference';

const scope = {
  workerUrl: 'https://worker.example',
  sessionSlug: 'alpha',
  sessionId: '0x1234',
  groupId: 'group',
  account: '0xABC',
};
beforeEach(() => localStorage.clear());

it('persists only the matching account, session and group until explicitly cleared', () => {
  expect(rememberWorkerGroupAutoJoinCancellation(scope)).toBe(true);
  expect(isWorkerGroupAutoJoinCancelled({ ...scope, account: '0xabc' })).toBe(true);
  for (const other of [
    { account: '0xdef' },
    { workerUrl: 'https://other.example' },
    { sessionSlug: 'beta' },
    { sessionId: '0x5678' },
    { groupId: 'another-group' },
  ])
    expect(isWorkerGroupAutoJoinCancelled({ ...scope, ...other })).toBe(false);
  clearWorkerGroupAutoJoinCancellation(scope);
  expect(isWorkerGroupAutoJoinCancelled(scope)).toBe(false);
});

it('reports unavailable storage so the notice can explain that cancellation lasts only this visit', () => {
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  expect(rememberWorkerGroupAutoJoinCancellation(scope)).toBe(false);
  set.mockRestore();
});

it('an explicit signed-in Join also clears the earlier signed-out choice, without clearing another account', () => {
  rememberWorkerGroupAutoJoinCancellation({ ...scope, account: '' });
  rememberWorkerGroupAutoJoinCancellation({ ...scope, account: '0xother' });
  clearWorkerGroupAutoJoinCancellation(scope);
  expect(isWorkerGroupAutoJoinCancelled({ ...scope, account: '' })).toBe(false);
  expect(isWorkerGroupAutoJoinCancelled({ ...scope, account: '0xother' })).toBe(true);
});
