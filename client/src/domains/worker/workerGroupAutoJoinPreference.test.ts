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
};
beforeEach(() => localStorage.clear());

it('persists only the matching Worker, session and group until explicitly cleared', () => {
  expect(rememberWorkerGroupAutoJoinCancellation(scope)).toBe(true);
  expect(isWorkerGroupAutoJoinCancelled(scope)).toBe(true);
  for (const other of [
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

it('honours cancellations saved per account until an explicit Join clears them', () => {
  const legacyKey = (groupId: string, account: string) =>
    `ce:worker-group-auto-join-cancelled:v1:${JSON.stringify(['https://worker.example', 'alpha', groupId, account])}`;
  const saved = JSON.stringify({ cancelled: true, sessionId: '0x1234' });
  localStorage.setItem(legacyKey('group', ''), saved);
  localStorage.setItem(legacyKey('group', '0xabc'), saved);
  localStorage.setItem(legacyKey('group-2', '0xabc'), saved);
  expect(isWorkerGroupAutoJoinCancelled(scope)).toBe(true);
  clearWorkerGroupAutoJoinCancellation(scope);
  expect(isWorkerGroupAutoJoinCancelled(scope)).toBe(false);
  expect(isWorkerGroupAutoJoinCancelled({ ...scope, groupId: 'group-2' })).toBe(true);
});

it('ignores a malformed legacy entry while honouring another browser cancellation', () => {
  const legacyKey = (account: string) =>
    `ce:worker-group-auto-join-cancelled:v1:${JSON.stringify(['https://worker.example', 'alpha', 'group', account])}`;
  localStorage.setItem(legacyKey('0xaaa'), '{invalid');
  localStorage.setItem(legacyKey('0xbbb'), JSON.stringify({ cancelled: true, sessionId: '0x1234' }));

  expect(isWorkerGroupAutoJoinCancelled(scope)).toBe(true);
  clearWorkerGroupAutoJoinCancellation(scope);
  expect(isWorkerGroupAutoJoinCancelled(scope)).toBe(false);
});
