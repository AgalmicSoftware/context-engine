import {
  AUTO_JOIN_MAX_AGE_MS,
  AUTO_JOIN_STORAGE_KEY,
  clearPendingAutoJoin,
  holdGroupInviteForLink,
  readAutoJoinLink,
  readGroupInviteFragment,
  readPendingAutoJoin,
  removeGroupInviteFromAddress,
  savePendingAutoJoin,
} from './workerGroupAutoJoinIntent';
import { followPastedPrivateInvite } from './privateSessionAccess';

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

it('keeps a held invite across a reload in this tab, until an invitation holds it or a day passes', () => {
  window.history.replaceState(null, '', '/session/alpha?joinGroup=table-3#groupInvite=gp%3Ariver%20stone');
  removeGroupInviteFromAddress();
  const path = `${window.location.pathname}${window.location.search}`;
  expect(path).not.toContain('river');
  const context = { sessionSlug: 'alpha', sessionId: `0x${'1'.repeat(32)}`, workerUrl: 'https://worker.example' };
  // A reload starts a fresh page: the module's memory is gone, the tab's storage is not.
  const reload = () => {
    let fresh: typeof import('./workerGroupAutoJoinIntent') | undefined;
    jest.isolateModules(() => {
      fresh = jest.requireActual('./workerGroupAutoJoinIntent');
    });
    return fresh!;
  };
  const afterReload = reload();
  expect(afterReload.readAutoJoinLink(path, null)).toBeNull();
  const invitation = afterReload.readAutoJoinLink(path, context as never)!;
  expect(invitation.token).toBe('gp:river stone');
  afterReload.savePendingAutoJoin(invitation);
  expect(reload().readAutoJoinLink(path, context as never)?.token).toBeUndefined();

  const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  window.history.replaceState(null, '', '/session/alpha?joinGroup=table-3#groupInvite=gp%3Aold');
  removeGroupInviteFromAddress();
  clock.mockReturnValue(1_000_000 + AUTO_JOIN_MAX_AGE_MS);
  try {
    expect(reload().readAutoJoinLink(path, context as never)?.token).toBeUndefined();
  } finally {
    jest.restoreAllMocks();
  }
});

it('lets go of the held invite once the group’s invitation drops it, so a refused one is not sent again', () => {
  const reloadedIntent = () => {
    let fresh: typeof import('./workerGroupAutoJoinIntent') | undefined;
    jest.isolateModules(() => {
      fresh = jest.requireActual('./workerGroupAutoJoinIntent');
    });
    return fresh!;
  };
  const session = { sessionSlug: 'alpha', sessionId: `0x${'1'.repeat(32)}`, workerUrl: 'https://worker.example' };
  const path = '/session/alpha?joinGroup=table-3';
  // A pasted invite is refused: the tab keeps the invitation without its secret.
  followPastedPrivateInvite({ path, groupId: 'table-3', token: 'gp:refused' }, session);
  const { token: _refused, ...withoutToken } = readPendingAutoJoin()!;
  savePendingAutoJoin(withoutToken);
  expect(reloadedIntent().readAutoJoinLink(path, session as never)?.token).toBeUndefined();

  // A save that never had the invite, such as pinning a bare invitation for the group, leaves it held.
  savePendingAutoJoin(withoutToken);
  holdGroupInviteForLink(path, 'cd:claimed');
  savePendingAutoJoin({ ...withoutToken, sessionId: session.sessionId });
  expect(reloadedIntent().readAutoJoinLink(path, session as never)?.token).toBe('cd:claimed');

  // A finished or cancelled invitation lets go of it too.
  window.history.replaceState(null, '', `${path}#groupInvite=gp%3Aused`);
  removeGroupInviteFromAddress();
  clearPendingAutoJoin(readAutoJoinLink(path, session as never)!);
  expect(reloadedIntent().readAutoJoinLink(path, session as never)?.token).toBeUndefined();
});
