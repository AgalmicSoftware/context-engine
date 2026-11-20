// Signing a person in to the account their AI agent set up, shared by the Session Worker, the MCP and the site.
//
// An agent that takes part as itself holds its account's key; the person it works for has never signed in. The
// agent proves it holds the key and asks the session's Worker for a one-time code; the person opens the session
// link with the code after `#`, and the page exchanges it for a sign-in as that account, without the key. The
// person may then attach a passkey: the Worker records that this passkey may sign in as the account, in this
// session. The passkey's own sign-in is unchanged; it is then exchanged for the account's. Once a passkey is
// attached, the person may end the agent's access to the account, and allow it again.

/** What a Session Worker lists when it has these routes and the setting below. */
export const AGENT_SIGN_IN_FEATURE = 'agent_sign_in_link_v1';

/**
 * The session setting for the Session Worker's functions for AI agents. Absent or true, they are on, as in every
 * session from before the setting. False, the Worker answers nothing on its Agent HTTP API (`/api/agent/*`, with
 * the keys made there), refuses sign-ins, requests and answers that come from the Context Engine MCP, and makes
 * and takes no sign-in codes. It is a switch on what the Worker does for agents; an agent that uses the website
 * as a person does is a visitor like any other.
 */
export const AGENT_PARTICIPATION_FIELD = 'agentParticipationEnabled';
export const agentParticipationOn = (config) => config?.[AGENT_PARTICIPATION_FIELD] !== false;

/**
 * The session setting that lets a person sign in from a link their agent makes, and attach a passkey to the
 * agent's account. It is off unless a session's admin turns it on: only `true` is on, and then only where
 * agents are. Off or absent, the Worker makes and takes no sign-in codes and attaches no passkey; one already
 * attached keeps working, and so does ending or restoring the agent's access.
 */
export const AGENT_SIGN_IN_LINKS_FIELD = 'agentSignInLinksEnabled';
export const agentSignInLinksOn = (config) => config?.[AGENT_SIGN_IN_LINKS_FIELD] === true && agentParticipationOn(config);

// Sent by an agent's client with every request. A web page can't send it to a Worker: the Worker's CORS answer
// doesn't allow the header, so a browser never makes the request.
export const AGENT_CLIENT_HEADER = 'X-CE-Agent-Client';

export const AGENT_SIGN_IN_PATHS = Object.freeze({
  create: '/auth/agent-link/create',
  exchange: '/auth/agent-link/exchange',
  attach: '/auth/agent-link/attach',
  passkeySignIn: '/auth/agent-link/passkey-signin',
  access: '/auth/agent-link/access',
  detach: '/auth/agent-link/detach',
  state: '/auth/agent-link/state',
});

// A code lasts thirty minutes and works once.
export const AGENT_SIGN_IN_CODE_TTL_SECONDS = 30 * 60;
const CODE_PREFIX = 'cesi_';
const CODE_RE = /^cesi_[A-Za-z0-9_-]{43}$/;
export const isAgentSignInCode = (value) => typeof value === 'string' && CODE_RE.test(value);
/** A sign-in code anywhere in a text: what must never be stored, posted or sent on. */
export const AGENT_SIGN_IN_CODE_IN_TEXT = /cesi_[A-Za-z0-9_-]{43}/;
/** A code from 32 random bytes, as unpadded base64url. */
export const formatAgentSignInCode = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${CODE_PREFIX}${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
};
// The part of a session link, after `#`, that carries the code.
export const AGENT_SIGN_IN_FRAGMENT_KEY = 'agentSignIn';

// How a sign-in was made, when not by the account's own key.
export const AGENT_SIGN_IN_VIA = Object.freeze({ LINK: 'agent_link', PASSKEY: 'passkey_link' });
export const AGENT_ACCESS = Object.freeze({ ACTIVE: 'active', CANCELLED: 'cancelled' });

// What the account's key signs to ask for a code. A sign-in message says something else, so neither stands in
// for the other.
export const AGENT_SIGN_IN_LINK_STATEMENT = 'Make a one-time link that signs my person in to this Context Engine account.';

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const lower = (value) => String(value ?? '').trim().toLowerCase();
const ATTACH_PREFIX = 'Attach this passkey to the Context Engine account ';
const ATTACH_SUFFIX = ', which my AI agent set up.';
/** What a passkey signs to be attached to `account`: it names the account, so it attaches to no other. */
export const agentPasskeyAttachStatement = (account) => `${ATTACH_PREFIX}${lower(account)}${ATTACH_SUFFIX}`;
/** The account an attach statement names, or '' when the text isn't one. */
export const readAgentPasskeyAttachStatement = (statement) => {
  const text = typeof statement === 'string' ? statement : '';
  if (!text.startsWith(ATTACH_PREFIX) || !text.endsWith(ATTACH_SUFFIX)) return '';
  const account = text.slice(ATTACH_PREFIX.length, text.length - ATTACH_SUFFIX.length);
  return ADDRESS_RE.test(account) ? account : '';
};

/** The session link that signs a person in: the ordinary link, with the code after `#` where no server sees it. */
export const buildAgentSignInLink = ({ appOrigin, slug, workerOrigin, code }) =>
  `${appOrigin}/session/${encodeURIComponent(slug)}?worker=${encodeURIComponent(workerOrigin)}#${AGENT_SIGN_IN_FRAGMENT_KEY}=${code}`;
