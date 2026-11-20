// An account this browser is signed in to without holding its key: the account an AI agent set up, opened from
// the agent's one-time link or through a passkey attached to it. The Session Worker gave the browser a sign-in
// for one session; nothing here can sign as the account. This module is what the rest of the page asks: who
// that account is, a wallet provider that says its address and refuses to sign, and how its sign-in is renewed.
// It keeps no secret: the sign-in itself lives where every sign-in does (workerAuthTokenCache).
export const AGENT_LINK_PROVIDER = 'agent_link';

export type AgentLinkAccount = {
  address: string;
  workerUrl: string;
  sessionSlug: string;
  sessionId: string;
  // How the sign-in was made: from the agent's link, or through the passkey attached to the account.
  via: 'agent_link' | 'passkey_link';
  // The attached passkey's own address, when the sign-in came through it.
  passkey: string;
  agentAccess: 'active' | 'cancelled';
};

// Addresses and the session only, kept for this tab so a reload knows who it was signed in as.
const STORAGE_KEY = 'ce:agentLinkAccount:v1';
const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const lower = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

let held: AgentLinkAccount | null = null;
const listeners = new Set<() => void>();

const normalize = (value: unknown): AgentLinkAccount | null => {
  const entry = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const address = lower(entry.address);
  const passkey = lower(entry.passkey);
  const workerUrl = String(entry.workerUrl || '').trim();
  const sessionSlug = lower(entry.sessionSlug);
  const sessionId = lower(entry.sessionId);
  if (!ADDRESS_RE.test(address) || !workerUrl || !sessionSlug || !sessionId) return null;
  return {
    address,
    workerUrl,
    sessionSlug,
    sessionId,
    via: entry.via === 'passkey_link' && ADDRESS_RE.test(passkey) ? 'passkey_link' : 'agent_link',
    passkey: ADDRESS_RE.test(passkey) ? passkey : '',
    agentAccess: entry.agentAccess === 'cancelled' ? 'cancelled' : 'active',
  };
};

const tabStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** The account this tab is signed in to without its key, or null. */
export const readAgentLinkAccount = (): AgentLinkAccount | null => {
  if (held) return held;
  try {
    held = normalize(JSON.parse(tabStorage()?.getItem(STORAGE_KEY) || 'null'));
  } catch {
    held = null;
  }
  return held;
};

export const holdAgentLinkAccount = (account: unknown): AgentLinkAccount | null => {
  held = normalize(account);
  try {
    if (held) tabStorage()?.setItem(STORAGE_KEY, JSON.stringify(held));
    else tabStorage()?.removeItem(STORAGE_KEY);
  } catch {
    /* The page still holds it until a reload. */
  }
  listeners.forEach((listener) => listener());
  return held;
};

export const forgetAgentLinkAccount = (): void => {
  holdAgentLinkAccount(null);
};

export const subscribeAgentLinkAccount = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isAgentLinkProvider = (providerLike: unknown): boolean =>
  typeof providerLike === 'string' && providerLike.trim().toLowerCase() === AGENT_LINK_PROVIDER;

/** Said by anything that would need the account's key. */
export class AgentLinkNoKeyError extends Error {
  constructor() {
    super(
      'This account’s key isn’t in this browser: you are signed in to the account your AI agent set up. This step needs the key, so it can’t be done here.',
    );
    this.name = 'AgentLinkNoKeyError';
  }
}

/**
 * A wallet provider for the account: it answers who the account is, so the page's ordinary paths find an
 * address, and refuses everything that would sign or send, since no key is here.
 */
export const agentLinkProvider = {
  isAgentLink: true,
  request: async ({ method }: { method?: string; params?: unknown } = {}): Promise<unknown> => {
    const account = readAgentLinkAccount();
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return account ? [account.address] : [];
    if (method === 'eth_chainId') return '0x1';
    if (method === 'net_version') return '1';
    throw new AgentLinkNoKeyError();
  },
};

// The sign-in is renewed through the attached passkey, by whoever can sign in as it. Set by the module that can.
type Renewer = (
  account: AgentLinkAccount,
  options: { prompt: boolean },
) => Promise<{ token: string; exp: number } | null>;
let renewer: Renewer | null = null;
export const setAgentLinkRenewer = (next: Renewer | null): void => {
  renewer = next;
};
/** A new sign-in for the held account in this session, or null when there is no way to make one here. */
export const renewAgentLinkSignIn = async ({
  address,
  workerUrl,
  sessionSlug,
  prompt,
}: {
  address: string;
  workerUrl: string;
  sessionSlug: string;
  prompt: boolean;
}): Promise<{ token: string; exp: number } | null> => {
  const account = readAgentLinkAccount();
  if (!account || !renewer || account.address !== lower(address) || account.sessionSlug !== lower(sessionSlug))
    return null;
  if (account.workerUrl.replace(/\/+$/, '') !== String(workerUrl || '').replace(/\/+$/, '')) return null;
  // Only an attached passkey can make a new one; a sign-in from the link alone ends when it ends.
  if (account.via !== 'passkey_link' || !account.passkey) return null;
  return renewer(account, { prompt });
};

// A passkey's own sign-in told the page that the passkey is attached to an account an AI agent set up. Whoever
// shows that account hears of it here, with the passkey's sign-in (page memory only) to open the account with.
export type LinkedAgentAccountHint = {
  workerUrl: string;
  sessionSlug: string;
  sessionId: string;
  passkey: string;
  account: string;
  passkeyToken: string;
};
let hint: LinkedAgentAccountHint | null = null;
export const noteLinkedAgentAccount = (value: {
  workerUrl: unknown;
  sessionSlug: unknown;
  sessionId: unknown;
  passkey: unknown;
  linked: unknown;
  token: unknown;
}): void => {
  const account = lower((value.linked as { address?: unknown } | null)?.address);
  const passkey = lower(value.passkey);
  const passkeyToken = typeof value.token === 'string' ? value.token : '';
  if (!ADDRESS_RE.test(account) || !ADDRESS_RE.test(passkey) || !passkeyToken) return;
  hint = {
    workerUrl: String(value.workerUrl || '').trim(),
    sessionSlug: lower(value.sessionSlug),
    sessionId: lower(value.sessionId),
    passkey,
    account,
    passkeyToken,
  };
  listeners.forEach((listener) => listener());
};
/** The hint for this session, taken once. */
export const takeLinkedAgentAccountHint = (sessionSlug: string, passkey: unknown): LinkedAgentAccountHint | null => {
  if (!hint || hint.sessionSlug !== lower(sessionSlug) || hint.passkey !== lower(passkey)) return null;
  const taken = hint;
  hint = null;
  return taken;
};
