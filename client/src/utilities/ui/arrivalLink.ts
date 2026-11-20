/** @file arrivalLink.ts: the link a person arrived with, put back together for copying into another browser. */
import { readInviteForLink } from '../../domains/worker/workerGroupAutoJoinIntent';

// The app takes two parts out of the address as it starts: a group's invite (`#groupInvite=`) and an AI's drafted
// answers (`#prefill=`, `#prefillz=`). A person told to open the page in another browser needs both back, or the
// copied link joins no group and carries no drafts.
const DRAFT_KEYS = ['prefill', 'prefillz'];
const INVITE_KEY = 'groupInvite';
const segments = (hash: string) => hash.replace(/^#/, '').split('&').filter(Boolean);
const keyOf = (segment: string) => segment.split('=', 1)[0];

// The drafts part of the address this page loaded with, in memory only and only for that page's path.
let arrivalDrafts: { pathname: string; parts: string[] } | null = null;

const noteDrafts = () => {
  const parts = segments(window.location.hash).filter((segment) => DRAFT_KEYS.includes(keyOf(segment)));
  if (parts.length) arrivalDrafts = { pathname: window.location.pathname, parts };
  return parts.length > 0;
};

/**
 * Notes the drafts part of the address before the app clears it, and again when a later link brings new drafts.
 * Called once as the app starts, after a sign-in code has been taken out of the address, so that never comes back.
 */
export const rememberArrivalDrafts = () => {
  if (!noteDrafts()) arrivalDrafts = null;
  window.removeEventListener('hashchange', noteDrafts);
  window.addEventListener('hashchange', noteDrafts);
};

/**
 * This page's address with the invite and drafts it arrived with put back. Nothing else is added: no sign-in, key
 * or anything the link did not itself carry. Without either, it is the address as it stands.
 */
export const buildCopyPageLink = (): string => {
  const { href, origin, pathname, search, hash } = window.location;
  const parts = segments(hash);
  const missing = (key: string) => !parts.some((segment) => keyOf(segment) === key);
  const added: string[] = [];
  const invite = readInviteForLink(`${pathname}${search}`);
  if (invite && missing(INVITE_KEY)) added.push(`${INVITE_KEY}=${encodeURIComponent(invite)}`);
  if (arrivalDrafts?.pathname === pathname) {
    added.push(...arrivalDrafts.parts.filter((segment) => missing(keyOf(segment))));
  }
  return added.length ? `${origin}${pathname}${search}#${[...parts, ...added].join('&')}` : href;
};
