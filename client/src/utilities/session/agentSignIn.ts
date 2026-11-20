// Signing in from a link an AI agent made, and what follows (shared/agentSignIn.mjs says how the whole works).
//
// The link is the ordinary session link with a one-time code after `#`. The code is taken out of the address
// before the router or any request sees it, kept in page memory only, sent once, in the body of one request to
// the Worker the link names, and then forgotten. It is never stored, logged or put in an address.
import {
  AGENT_SIGN_IN_FEATURE,
  AGENT_SIGN_IN_FRAGMENT_KEY,
  AGENT_SIGN_IN_PATHS,
  agentPasskeyAttachStatement,
  isAgentSignInCode,
} from '@ce-shared/agentSignIn.mjs';

import { readWorkerCapabilities } from '../worker/workerCapabilities';
import type { AgentLinkAccount } from './agentLinkAccount';

type SessionTarget = { workerUrl: string; sessionSlug: string; sessionId: string };
export type AgentSignInReply = {
  token: string;
  exp: number;
  address: string;
  via: 'agent_link' | 'passkey_link';
  passkey: string;
  agentAccess: 'active' | 'cancelled';
};
export type AgentSignInState = {
  via: string;
  attachedPasskey: { address: string; agentAccess: 'active' | 'cancelled' } | null;
  linkedAgentAccount: { address: string } | null;
  agentParticipation: boolean;
};

// The code a link carried, with the session it was for. Page memory only.
let heldCode: { code: string; sessionSlug: string; workerOrigin: string } | null = null;

const segmentsOf = (hash: string): string[] => hash.replace(/^#/, '').split('&');
const originOf = (value: string): string => {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
};

/**
 * Takes a sign-in code out of the address at once, leaving the rest as it was. The app calls it before the router
 * starts and before anything is fetched, so no request, history entry or copied link ever has the code.
 */
export const removeAgentSignInCodeFromAddress = (): void => {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  const prefix = `${AGENT_SIGN_IN_FRAGMENT_KEY}=`;
  const parts = segmentsOf(hash);
  const carried = parts.filter((part) => part.startsWith(prefix));
  if (!carried.length) return;
  const rest = parts.filter((part) => part && !part.startsWith(prefix));
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${search}${rest.length ? `#${rest.join('&')}` : ''}`,
  );
  const code = carried.length === 1 ? carried[0].slice(prefix.length) : '';
  const [, sessionSlug = ''] = pathname.match(/\/session\/([^/]+)\/?$/) || [];
  const workers = new URLSearchParams(search).getAll('worker');
  const workerOrigin = workers.length === 1 ? originOf(workers[0]) : '';
  // Only a well-formed code, for one session on one named Worker, is kept at all.
  heldCode =
    isAgentSignInCode(code) && sessionSlug && workerOrigin
      ? { code, sessionSlug: decodeURIComponent(sessionSlug).toLowerCase(), workerOrigin }
      : null;
};

/** Whether a link's code is waiting for this session; it says nothing of the code. */
export const hasAgentSignInCodeFor = ({
  workerUrl,
  sessionSlug,
}: Pick<SessionTarget, 'workerUrl' | 'sessionSlug'>): boolean =>
  !!heldCode && heldCode.sessionSlug === sessionSlug.toLowerCase() && heldCode.workerOrigin === originOf(workerUrl);

/** Forgets a link's code without using it. */
export const dropAgentSignInCode = (): void => {
  heldCode = null;
};

export class AgentSignInError extends Error {
  reason: string;
  status: number;
  constructor(reason: string, message: string, status = 0) {
    super(message);
    this.name = 'AgentSignInError';
    this.reason = reason;
    this.status = status;
  }
}

const post = async (
  target: SessionTarget,
  path: string,
  body: Record<string, unknown>,
  token = '',
): Promise<Record<string, unknown>> => {
  let response: Response;
  try {
    response = await fetch(`${target.workerUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      // No cookies, no referrer: the body is all the Worker is sent.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, 'X-Group-Slug': target.sessionSlug } : {}),
      },
      body: JSON.stringify({ sessionSlug: target.sessionSlug, sessionId: target.sessionId, ...body }),
    });
  } catch {
    throw new AgentSignInError('network', 'The session could not be reached. Check your connection and try again.');
  }
  const data = ((await response.json().catch(() => ({}))) || {}) as Record<string, unknown>;
  if (!response.ok) {
    const reason = typeof data.reason === 'string' ? data.reason : `http_${response.status}`;
    const message = typeof data.error === 'string' && data.error ? data.error : 'This could not be done.';
    throw new AgentSignInError(reason, message, response.status);
  }
  return data;
};

const replyOf = (data: Record<string, unknown>): AgentSignInReply => {
  const token = typeof data.token === 'string' ? data.token : '';
  const address = typeof data.address === 'string' ? data.address.toLowerCase() : '';
  const exp = Number(data.exp);
  if (!token || !/^0x[0-9a-f]{40}$/.test(address) || !Number.isFinite(exp)) {
    throw new AgentSignInError('unreadable', 'The session’s answer could not be read.');
  }
  return {
    token,
    exp,
    address,
    via: data.via === 'passkey_link' ? 'passkey_link' : 'agent_link',
    passkey: typeof data.passkey === 'string' ? data.passkey.toLowerCase() : '',
    agentAccess: data.agentAccess === 'cancelled' ? 'cancelled' : 'active',
  };
};

/** Whether the session's Worker signs people in from an agent's link. False when it can't be asked. */
export const workerHasAgentSignIn = async ({
  workerUrl,
  sessionSlug,
}: Pick<SessionTarget, 'workerUrl' | 'sessionSlug'>): Promise<boolean> => {
  try {
    return (await readWorkerCapabilities(workerUrl, sessionSlug)).features.includes(AGENT_SIGN_IN_FEATURE);
  } catch {
    return false;
  }
};

/**
 * Swaps the link's code for a sign-in as the agent's account. The code is forgotten before the request is sent:
 * it works once, so there is nothing to try again with.
 */
export const exchangeHeldAgentSignInCode = async (target: SessionTarget): Promise<AgentSignInReply> => {
  if (!hasAgentSignInCodeFor(target)) throw new AgentSignInError('no_code', 'This link carries no sign-in.');
  const code = heldCode?.code || '';
  heldCode = null;
  return replyOf(await post(target, AGENT_SIGN_IN_PATHS.exchange, { code }));
};

/** The message a passkey signs to be attached to `account`: an ordinary sign-in message that says so. */
export const buildPasskeyAttachMessage = ({
  account,
  passkeyAddress,
  nonce,
  target,
  appOrigin,
  now = new Date(),
}: {
  account: string;
  passkeyAddress: string;
  nonce: string;
  target: SessionTarget;
  appOrigin: string;
  now?: Date;
}): string =>
  [
    `${new URL(appOrigin).host} wants you to sign in with your Ethereum account:`,
    passkeyAddress,
    '',
    agentPasskeyAttachStatement(account),
    '',
    `URI: ${appOrigin}`,
    'Version: 1',
    'Chain ID: 1',
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${new Date(now.getTime() + 5 * 60 * 1000).toISOString()}`,
    'Resources:',
    `- ${originOf(target.workerUrl)}`,
    `- urn:context-engine:session:id:${target.sessionId}`,
  ].join('\n');

/**
 * Attaches a passkey to the account this tab is signed in to from an agent's link. `sign` is the passkey's own
 * signing, asked once, for a message that names the account: its consent, which the Worker checks.
 */
export const attachPasskeyToAgentAccount = async ({
  target,
  account,
  token,
  passkeyAddress,
  sign,
  appOrigin = typeof window === 'undefined' ? '' : window.location.origin,
}: {
  target: SessionTarget;
  account: string;
  token: string;
  passkeyAddress: string;
  sign: (message: string) => Promise<string>;
  appOrigin?: string;
}): Promise<AgentSignInReply> => {
  const nonce = await post(target, '/auth/nonce', { address: passkeyAddress });
  if (typeof nonce.nonce !== 'string' || !nonce.nonce)
    throw new AgentSignInError('unreadable', 'The session’s answer could not be read.');
  const message = buildPasskeyAttachMessage({ account, passkeyAddress, nonce: nonce.nonce, target, appOrigin });
  const signature = await sign(message);
  return replyOf(
    await post(target, AGENT_SIGN_IN_PATHS.attach, { passkey: { address: passkeyAddress, message, signature } }, token),
  );
};

/** Swaps the attached passkey's own sign-in for one as the agent's account. */
export const signInThroughAttachedPasskey = async (
  target: SessionTarget,
  passkeyToken: string,
): Promise<AgentSignInReply> => replyOf(await post(target, AGENT_SIGN_IN_PATHS.passkeySignIn, {}, passkeyToken));

/** Ends the agent's access to the account, or allows it again. Only a sign-in through the passkey may. */
export const setAgentAccess = async (
  target: SessionTarget,
  token: string,
  agentAccess: 'active' | 'cancelled',
): Promise<'active' | 'cancelled'> =>
  (await post(target, AGENT_SIGN_IN_PATHS.access, { agentAccess }, token)).agentAccess === 'cancelled'
    ? 'cancelled'
    : 'active';

/** Takes the passkey off the account. */
export const detachAgentPasskey = async (target: SessionTarget, token: string): Promise<void> => {
  await post(target, AGENT_SIGN_IN_PATHS.detach, {}, token);
};

/** What the Worker keeps about the signed-in account: a passkey attached to it, or the agent's account it is a passkey for. */
export const readAgentSignInState = async (target: SessionTarget, token: string): Promise<AgentSignInState> => {
  const data = await post(target, AGENT_SIGN_IN_PATHS.state, {}, token);
  const attached = (
    data.attachedPasskey && typeof data.attachedPasskey === 'object' ? data.attachedPasskey : null
  ) as Record<string, unknown> | null;
  const linked = (
    data.linkedAgentAccount && typeof data.linkedAgentAccount === 'object' ? data.linkedAgentAccount : null
  ) as Record<string, unknown> | null;
  return {
    via: typeof data.via === 'string' ? data.via : '',
    attachedPasskey:
      attached && typeof attached.address === 'string'
        ? {
            address: attached.address.toLowerCase(),
            agentAccess: attached.agentAccess === 'cancelled' ? 'cancelled' : 'active',
          }
        : null,
    linkedAgentAccount: linked && typeof linked.address === 'string' ? { address: linked.address.toLowerCase() } : null,
    agentParticipation: data.agentParticipation !== false,
  };
};

/** The held account as a sign-in reply describes it. */
export const agentLinkAccountOf = (target: SessionTarget, reply: AgentSignInReply): AgentLinkAccount => ({
  address: reply.address,
  workerUrl: target.workerUrl,
  sessionSlug: target.sessionSlug,
  sessionId: target.sessionId,
  via: reply.via,
  passkey: reply.passkey,
  agentAccess: reply.agentAccess,
});

export const __test__agentSignIn = {
  held: (): { sessionSlug: string; workerOrigin: string } | null =>
    heldCode ? { sessionSlug: heldCode.sessionSlug, workerOrigin: heldCode.workerOrigin } : null,
};
