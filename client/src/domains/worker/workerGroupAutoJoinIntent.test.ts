import {
  AUTO_JOIN_MAX_AGE_MS,
  AUTO_JOIN_STORAGE_KEY,
  clearPendingAutoJoin,
  readAutoJoinLink,
  readPendingAutoJoin,
  savePendingAutoJoin,
} from './workerGroupAutoJoinIntent';

beforeEach(() => sessionStorage.clear());
const intent = () => ({
  version: 1 as const,
  sessionSlug: 'alpha',
  groupId: 'attendees',
  workerOrigin: 'https://worker.example',
  createdAt: Date.now(),
});

it('persists only a validated invitation and expires it after one day', () => {
  savePendingAutoJoin(intent());
  expect(readPendingAutoJoin()?.sessionSlug).toBe('alpha');
  savePendingAutoJoin({ ...intent(), createdAt: Date.now() - AUTO_JOIN_MAX_AGE_MS });
  expect(readPendingAutoJoin()).toBeNull();
  expect(sessionStorage.getItem(AUTO_JOIN_STORAGE_KEY)).toBeNull();
});

it.each([
  { groupId: '' },
  { workerOrigin: 'https://[redacted-email]' },
  { version: 2 },
  { sessionId: 'bad' },
  { createdAt: Date.now() + 100000 },
])('rejects malformed stored invitations: %j', (override) => {
  sessionStorage.setItem(AUTO_JOIN_STORAGE_KEY, JSON.stringify({ ...intent(), ...override }));
  expect(readPendingAutoJoin()).toBeNull();
});

it('does not clear a newer invitation when an older request completes', () => {
  const first = intent();
  const next = { ...first, groupId: 'new-group' };
  savePendingAutoJoin(next);
  clearPendingAutoJoin(first);
  expect(readPendingAutoJoin()?.groupId).toBe('new-group');
});

it('captures a fresh browser link before bootstrap but rejects ambiguous workers and non-session paths', () => {
  expect(
    readAutoJoinLink('/session/alpha?joinGroup=attendees&worker=https%3A%2F%2Fworker.example', null),
  ).toMatchObject({ sessionSlug: 'alpha', groupId: 'attendees', workerOrigin: 'https://worker.example' });
  for (const path of [
    '/about?joinGroup=attendees&worker=https://worker.example',
    '/session/alpha?joinGroup=attendees&worker=https://worker.example&worker=https://other.example',
    '/session/alpha/nested?joinGroup=attendees&worker=https://worker.example',
    '/session/alpha?joinGroup=attendees',
  ])
    expect(readAutoJoinLink(path, null)).toBeNull();
});
