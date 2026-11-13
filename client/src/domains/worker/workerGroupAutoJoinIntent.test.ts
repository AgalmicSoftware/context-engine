import {
  AUTO_JOIN_MAX_AGE_MS,
  AUTO_JOIN_STORAGE_KEY,
  clearPendingAutoJoin,
  readAutoJoinLink,
  readGroupInviteFragment,
  readPendingAutoJoin,
  removeGroupInviteFromAddress,
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
  { workerOrigin: ['https://secret', 'worker.example'].join('@') },
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

it('reads a link’s invite from the fragment and keeps it with the invitation', () => {
  expect(readGroupInviteFragment('#claim=a&groupInvite=gp%3Ariver%20stone')).toBe('gp:river stone');
  expect(readGroupInviteFragment('#groupInvite=%E0%A4%A')).toBe('');
  expect(readGroupInviteFragment('#claim=a')).toBe('');
  const link = readAutoJoinLink(
    '/session/alpha?joinGroup=attendees&worker=https://worker.example#groupInvite=abcdef0123456789abcdef0123456789',
    null,
  );
  expect(link?.token).toBe('abcdef0123456789abcdef0123456789');
  savePendingAutoJoin(link!);
  expect(readPendingAutoJoin()?.token).toBe('abcdef0123456789abcdef0123456789');
  savePendingAutoJoin({ ...intent(), token: 'x'.repeat(2001) });
  expect(readPendingAutoJoin()).toBeNull();
});

it('takes only the invite out of the address', () => {
  window.history.replaceState({ keep: 1 }, '', '/session/alpha?view=q#claim=a&groupInvite=secret&prefill=b');
  removeGroupInviteFromAddress();
  expect(`${window.location.search}${window.location.hash}`).toBe('?view=q#claim=a&prefill=b');
  expect(window.history.state).toEqual({ keep: 1 });
});

it('keeps an invite taken out of the address for its group until the Worker is known', () => {
  window.history.replaceState(null, '', '/session/alpha?joinGroup=table-3#groupInvite=gp%3Ariver%20stone');
  // Before the session's Worker is known, the link isn't an invitation yet, but its invite leaves the address.
  expect(readAutoJoinLink(`${window.location.pathname}${window.location.search}`, null)).toBeNull();
  removeGroupInviteFromAddress();
  expect(window.location.hash).toBe('');
  const context = { sessionSlug: 'alpha', sessionId: `0x${'1'.repeat(32)}`, workerUrl: 'https://worker.example' };
  const path = `${window.location.pathname}${window.location.search}`;
  expect(readAutoJoinLink(path, context as never)?.token).toBe('gp:river stone');
  // Another group's link gets nothing from it.
  expect(readAutoJoinLink('/session/alpha?joinGroup=table-4', context as never)?.token).toBeUndefined();
  // Once an invitation holds it, the tab's storage keeps it and the page lets it go.
  savePendingAutoJoin(readAutoJoinLink(path, context as never)!);
  expect(readAutoJoinLink(path, context as never)?.token).toBeUndefined();
  expect(readPendingAutoJoin()?.token).toBe('gp:river stone');
});
