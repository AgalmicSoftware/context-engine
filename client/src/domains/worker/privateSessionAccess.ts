import { parseGroupInviteToken } from '@ce-shared/workerGroupJoin.mjs';
import { readWorkerGroupAutoJoinId } from './workerGroupAutoJoin';
import {
  holdGroupInviteForLink,
  readGroupInviteFragment,
  readPendingAutoJoin,
  savePendingAutoJoin,
} from './workerGroupAutoJoinIntent';
import {
  forgetGroupReadHeader,
  readGroupReadHeader,
  saveGroupReadHeader,
} from '../../utilities/worker/workerGroupReadProof';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';

// A private session's Worker answers a visitor it can't admit with a shell config that says so. The page then
// turns the invite this tab holds into a read proof, or says plainly that the invite it sent no longer works.

type Session = { sessionSlug: string; sessionId: string; workerUrl: string };
export type PrivateInvite = { groupId: string; token: string };

const sameOrigin = (a: string, b: string) => {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
};

/** The group password this tab holds for the session, from its invite link; null without one. */
export const readHeldPrivateInvite = ({ sessionSlug, workerUrl }: Omit<Session, 'sessionId'>): PrivateInvite | null => {
  const intent = readPendingAutoJoin();
  if (!intent?.token || intent.sessionSlug !== sessionSlug || !sameOrigin(intent.workerOrigin, workerUrl)) return null;
  return parseGroupInviteToken(intent.token)?.kind === 'password'
    ? { groupId: intent.groupId, token: intent.token }
    : null;
};

/**
 * The Worker sent the shell although this browser sent a proof, so the proof no longer works (a changed password,
 * a group taken off the session). Forgets it, and the tab's copy of its invite, so nothing tries it again.
 */
export const forgetRefusedPrivateInvite = ({ sessionSlug, workerUrl }: Omit<Session, 'sessionId'>): boolean => {
  if (!readGroupReadHeader(workerUrl, sessionSlug)) return false;
  forgetGroupReadHeader(workerUrl, sessionSlug);
  const intent = readPendingAutoJoin();
  if (intent?.token && intent.sessionSlug === sessionSlug && sameOrigin(intent.workerOrigin, workerUrl)) {
    const { token: _refused, ...withoutToken } = intent;
    savePendingAutoJoin(withoutToken);
  }
  return true;
};

const buildProof = async ({ sessionId, groupId, token }: { sessionId: string } & PrivateInvite) => {
  const { buildWorkerGroupReadHeader } = await import('./workerGroupSecrets');
  return buildWorkerGroupReadHeader({ token, sessionId, groupId });
};

/** Makes and keeps the session's read proof from a held group password, and returns it. About a second on a phone. */
export const keepPrivateSessionProof = async ({
  sessionSlug,
  sessionId,
  workerUrl,
  groupId,
  token,
}: Session & PrivateInvite): Promise<string> => {
  const header = await buildProof({ sessionId, groupId, token });
  if (!header) throw new Error('That invite can’t open this session. Ask the host for an invite link.');
  saveGroupReadHeader({ workerUrl, sessionSlug, sessionId, header });
  return header;
};

/**
 * The Worker refused the proof this browser sent. A newer link the tab holds (a changed password, another group) may
 * still open the session, so its proof replaces the refused one; the same proof again means the held invite is the
 * refused one, and both are forgotten. Returns the new proof, or '' once the invite is forgotten.
 */
export const replaceRefusedPrivateProof = async (session: Session): Promise<string> => {
  const refused = readGroupReadHeader(session.workerUrl, session.sessionSlug);
  const held = readHeldPrivateInvite(session);
  const header = refused && held ? await buildProof({ sessionId: session.sessionId, ...held }).catch(() => null) : null;
  if (header && header !== refused) {
    saveGroupReadHeader({ ...session, header });
    return header;
  }
  forgetRefusedPrivateInvite(session);
  return '';
};

export type PastedInvite = { path: string; groupId: string; token: string };

/**
 * A pasted invite link for this session: its group and its secret. Throws a plain message for anything else, never
 * repeating what was pasted.
 */
export const readPastedPrivateInvite = (text: string, sessionSlug: string): PastedInvite => {
  let url: URL;
  try {
    url = new URL(text.trim(), window.location.origin);
  } catch {
    throw new Error('Paste the whole invite link.');
  }
  const token = readGroupInviteFragment(url.hash);
  const groupId = readWorkerGroupAutoJoinId(url.search);
  if (!groupId || !token) throw new Error('Paste the whole invite link, including the part after #.');
  if (url.pathname.replace(/\/$/, '') !== buildPublicRoute(`/session/${encodeURIComponent(sessionSlug)}`))
    throw new Error('That invite link is for another session.');
  if (parseGroupInviteToken(token)?.kind !== 'password')
    throw new Error('That invite can’t open this session. Ask the host for an invite link.');
  return { path: `${url.pathname}${url.search}`, groupId, token };
};

/**
 * Hands a pasted invite to the page as its own link would: the tab keeps it for the join at sign-in, and the address
 * gains the link's group, never its secret. Saved before the address changes, so the group's invitation, which reads
 * the new address, finds the secret and doesn't replace it with a bare link.
 */
export const followPastedPrivateInvite = (
  { path, groupId, token }: PastedInvite,
  { sessionSlug, sessionId, workerUrl }: Session,
) => {
  savePendingAutoJoin({
    version: 1,
    sessionSlug,
    groupId,
    workerOrigin: new URL(workerUrl).origin,
    sessionId,
    createdAt: Date.now(),
    token,
  });
  holdGroupInviteForLink(path, token);
  window.history.replaceState(window.history.state, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
