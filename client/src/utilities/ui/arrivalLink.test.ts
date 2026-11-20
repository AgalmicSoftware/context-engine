import fs from 'node:fs';
import path from 'node:path';

import { removeAgentSignInCodeFromAddress } from '../session/agentSignIn';
import {
  clearPendingAutoJoin,
  holdGroupInviteForLink,
  removeGroupInviteFromAddress,
  savePendingAutoJoin,
  type WorkerGroupAutoJoinIntent,
} from '../../domains/worker/workerGroupAutoJoinIntent';
import { buildCopyPageLink, rememberArrivalDrafts } from './arrivalLink';

const go = (path: string) => window.history.replaceState({}, '', path);
const TOKEN = 'pass word/+&=#';
// Arriving by a link that carries the invite: the app takes it out of the address as it starts.
const arrive = (path: string) => {
  go(`${path}#groupInvite=${encodeURIComponent(TOKEN)}`);
  removeGroupInviteFromAddress();
};
const intent = (extra: Partial<WorkerGroupAutoJoinIntent> = {}): WorkerGroupAutoJoinIntent => ({
  version: 1,
  sessionSlug: 'alpha',
  groupId: 'attendees',
  workerOrigin: 'https://worker.example',
  createdAt: Date.now(),
  ...extra,
});

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  // An arrival with another group's invite replaces any an earlier test left in memory.
  arrive('/session/unused?joinGroup=nobody');
  go('/');
  rememberArrivalDrafts();
  // Lets go of any invite an earlier test left held in memory.
  clearPendingAutoJoin(intent());
  clearPendingAutoJoin(intent({ sessionSlug: 'beta' }));
});

it('is the address as it stands where the link carried no invite and no drafts', () => {
  go('/session/alpha?mode=interview#results');
  expect(buildCopyPageLink()).toBe(window.location.href);
  go('/session/alpha?joinGroup=attendees');
  expect(buildCopyPageLink()).toBe(window.location.href);
});

it('puts back the invite the app took out of the address', () => {
  go(`/session/alpha?joinGroup=attendees&mode=interview#groupInvite=${encodeURIComponent(TOKEN)}`);
  removeGroupInviteFromAddress();
  expect(window.location.hash).toBe('');
  const link = buildCopyPageLink();
  expect(link).toBe(
    `${window.location.origin}/session/alpha?joinGroup=attendees&mode=interview#groupInvite=${encodeURIComponent(TOKEN)}`,
  );
  expect(link).toContain('?joinGroup=attendees');
});

// The tab can hold an invite the link never carried: a code typed into the join box, a pasted invite, a
// recording's claim. Those are not the person's link, so they stay out of it.
it('leaves out an invite the tab holds that the address never carried', () => {
  go('/session/alpha?joinGroup=attendees');
  holdGroupInviteForLink('/session/alpha?joinGroup=attendees', TOKEN);
  expect(buildCopyPageLink()).toBe(window.location.href);
  savePendingAutoJoin(intent({ token: TOKEN }));
  expect(buildCopyPageLink()).toBe(window.location.href);
});

it('gives an invite only to the link for its own session and group', () => {
  arrive('/session/alpha?joinGroup=attendees');
  for (const path of ['/session/beta?joinGroup=attendees', '/session/alpha?joinGroup=others', '/session/alpha']) {
    go(path);
    expect(buildCopyPageLink()).toBe(window.location.href);
  }
});

it('puts back the drafts a review link carried, on that page only', () => {
  go('/session/alpha?mode=interview#prefill=abc-123_DEF&view=results');
  rememberArrivalDrafts();
  go('/session/alpha?mode=interview#view=results');
  expect(buildCopyPageLink()).toBe(
    `${window.location.origin}/session/alpha?mode=interview#view=results&prefill=abc-123_DEF`,
  );
  // Still in the address: nothing is added twice.
  go('/session/alpha?mode=interview#prefill=abc-123_DEF');
  expect(buildCopyPageLink()).toBe(window.location.href);
  go('/session/beta');
  expect(buildCopyPageLink()).toBe(window.location.href);
  go(`/session/alpha?joinGroup=attendees#prefillz=packed&groupInvite=${encodeURIComponent(TOKEN)}`);
  rememberArrivalDrafts();
  removeGroupInviteFromAddress();
  go('/session/alpha?joinGroup=attendees');
  expect(buildCopyPageLink()).toBe(`${window.location.href}#groupInvite=${encodeURIComponent(TOKEN)}&prefillz=packed`);
});

it('adds nothing else the tab holds: no sign-in, key or other stored value', () => {
  arrive('/session/alpha?joinGroup=attendees');
  for (const store of [sessionStorage, localStorage]) {
    store.setItem('ce:agent-sign-in-code', 'SECRET-code');
    store.setItem('ce:worker-auth-ticket', 'SECRET-ticket');
    store.setItem('ce:session-key', 'SECRET-key');
  }
  const link = buildCopyPageLink();
  expect(link).toBe(`${window.location.href}#groupInvite=${encodeURIComponent(TOKEN)}`);
  expect(link).not.toMatch(/SECRET/);
});

// A sign-in code from a person's AI agent is taken out of the address first and never used; whatever key it came
// under, the copied link must not bring it back.
it('never brings back a sign-in code, and takes up drafts that arrive later', () => {
  const code = `cesi_${'a'.repeat(43)}`;
  go(`/session/alpha#prefill=${code}`);
  removeAgentSignInCodeFromAddress();
  rememberArrivalDrafts();
  expect(buildCopyPageLink()).toBe(window.location.href);
  expect(buildCopyPageLink()).not.toContain(code);
  const entry = fs.readFileSync(path.resolve(__dirname, '../../index.tsx'), 'utf8');
  expect(entry.indexOf('\nremoveAgentSignInCodeFromAddress();')).toBeGreaterThan(0);
  expect(entry.indexOf('\nrememberArrivalDrafts();')).toBeGreaterThan(
    entry.indexOf('\nremoveAgentSignInCodeFromAddress();'),
  );
  // A second review link opened in the same tab replaces the first one's drafts.
  go('/session/alpha#prefill=first');
  rememberArrivalDrafts();
  go('/session/alpha#prefill=second');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  go('/session/alpha');
  expect(buildCopyPageLink()).toBe(`${window.location.href}#prefill=second`);
});
