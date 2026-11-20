// What the session page does with an agent's account: enter it from a link or through its passkey, attach a
// passkey to it, end or restore the agent's access, and leave it. The Worker's side is in agentSignIn.ts; the
// account the tab holds without a key is in agentLinkAccount.ts.
import store from '../../store';
import { changeAccount } from '../../actions/accountActions.js';
import { updateLoginInfo } from '../../actions/sessionStateActions.js';
import * as passkeyWallet from '../../wallet/passkeyWallet';
import { buildSiweMessage } from '../worker/workerAuth.js';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  heldSessionToken,
  writeTokenCache,
} from '../worker/workerAuthTokenCache.js';
import {
  AGENT_LINK_PROVIDER,
  ATTACHED_PASSKEYS_KEY,
  forgetAgentLinkAccount,
  holdAgentLinkAccount,
  isAgentLinkProvider,
  noteBrowserAttachedAPasskey,
  readAgentLinkAccount,
  setAgentLinkRenewer,
  type AgentLinkAccount,
} from './agentLinkAccount';
import {
  AgentSignInError,
  agentLinkAccountOf,
  attachPasskeyToAgentAccount,
  detachAgentPasskey,
  isSignInNonce,
  setAgentAccess,
  signInThroughAttachedPasskey,
  type AgentSignInReply,
} from './agentSignIn';
import { logoutClientAuth } from './clientAuthLogout';

type SessionTarget = { workerUrl: string; sessionSlug: string; sessionId: string };
const targetOf = (account: AgentLinkAccount): SessionTarget => ({
  workerUrl: account.workerUrl,
  sessionSlug: account.sessionSlug,
  sessionId: account.sessionId,
});
const lower = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

// Which passkeys this browser has attached to an agent's account, by session: no secret, only "look again here".
const KNOWN_KEY = ATTACHED_PASSKEYS_KEY;
const knownKey = (target: SessionTarget, passkey: string): string =>
  `${target.workerUrl.replace(/\/+$/, '')}|${target.sessionSlug}|${lower(passkey)}`;
const readKnown = (): string[] => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KNOWN_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === 'string').slice(-50) : [];
  } catch {
    return [];
  }
};
const writeKnown = (entries: string[]): void => {
  try {
    window.localStorage.setItem(KNOWN_KEY, JSON.stringify(entries.slice(-50)));
  } catch {
    /* Storage can be disabled; the Worker's own sign-in reply still says so. */
  }
};
export const rememberAttachedPasskey = (target: SessionTarget, passkey: string): void => {
  writeKnown([...readKnown().filter((entry) => entry !== knownKey(target, passkey)), knownKey(target, passkey)]);
  noteBrowserAttachedAPasskey();
};
export const forgetAttachedPasskey = (target: SessionTarget, passkey: string): void =>
  writeKnown(readKnown().filter((entry) => entry !== knownKey(target, passkey)));
export const isAttachedPasskeyKnown = (target: SessionTarget, passkey: unknown): boolean =>
  readKnown().includes(knownKey(target, lower(passkey)));

const liveProfile = (): { account: string; provider: unknown } => {
  const profile = (store.getState()?.profile || {}) as { account?: unknown; provider?: unknown };
  return { account: lower(profile.account), provider: profile.provider };
};
/** The account the tab is signed in as at this moment, '' when signed out. */
export const liveAccount = (): string => liveProfile().account;

// The tab holds one account at a time. Once it is anyone but the held agent's account (a wallet connected, a
// passkey signed in), the held one is forgotten, so it can't come back later as "this sign-in has ended".
if (typeof store?.subscribe === 'function') {
  store.subscribe(() => {
    const account = readAgentLinkAccount();
    if (!account) return;
    const live = liveProfile();
    if (live.account && (live.account !== account.address || !isAgentLinkProvider(live.provider))) {
      forgetAgentLinkAccount();
    }
  });
}

// An account a tab is using, and what kind: the person's own, signed in now; an agent's, held without its key;
// or a passkey account this browser has saved and would sign back in by itself, though it has not yet.
export type AccountInUse = { address: string; kind: 'own' | 'agent' | 'saved' };

/** The account the tab is signed in as at this moment, or null. */
export const whoIsHereNow = (): AccountInUse | null => {
  const live = liveProfile();
  return live.account ? { address: live.account, kind: isAgentLinkProvider(live.provider) ? 'agent' : 'own' } : null;
};

/**
 * Who a link's sign-in would replace, asked at the moment it is about to: whoever is signed in now, an agent's
 * account this tab still holds a sign-in for, or a passkey account this browser would sign back in by itself.
 * Null when nobody. An agent's account whose sign-in has ended is nobody: its person came for a new link.
 */
export const whoALinkWouldReplace = async (): Promise<AccountInUse | null> => {
  const account = readAgentLinkAccount();
  const heldLive = account && heldSessionToken(account.workerUrl, account.sessionSlug) ? account.address : '';
  const live = liveProfile();
  const endedAgentAccount =
    !!account && !heldLive && live.account === account.address && isAgentLinkProvider(live.provider);
  if (live.account && !endedAgentAccount) return whoIsHereNow();
  if (heldLive) return { address: heldLive, kind: 'agent' };
  const saved = lower(await passkeyWallet.restorePasskeyWalletSession({ requireSigner: false }).catch(() => null));
  return saved ? { address: saved, kind: 'saved' } : null;
};

/**
 * Makes the agent's account the tab's account, with the sign-in the Worker gave. The account changes first:
 * that ends every sign-in the tab held, and the new one is kept only after.
 */
export const enterAgentLinkAccount = (target: SessionTarget, reply: AgentSignInReply): AgentLinkAccount | null => {
  const account = holdAgentLinkAccount(agentLinkAccountOf(target, reply));
  if (!account) return null;
  changeAccount({ account: account.address, provider: AGENT_LINK_PROVIDER })(store.dispatch);
  updateLoginInfo({ loginInProgress: false, loginComplete: true, provider: AGENT_LINK_PROVIDER })(store.dispatch);
  writeTokenCache(
    buildTokenCacheKey({
      workerUrl: target.workerUrl,
      slug: target.sessionSlug,
      sessionId: target.sessionId,
      address: account.address,
    }),
    buildTokenCacheEnvelope({
      token: reply.token,
      exp: reply.exp,
      workerUrl: target.workerUrl,
      sessionId: target.sessionId,
      sessionSlug: target.sessionSlug,
      address: account.address,
    }),
  );
  if (account.via === 'passkey_link' && account.passkey) rememberAttachedPasskey(target, account.passkey);
  return account;
};

/** After a reload: the tab was signed in to an agent's account and still holds that sign-in. */
export const resumeAgentLinkAccount = (target: SessionTarget): AgentLinkAccount | null => {
  const account = readAgentLinkAccount();
  if (!account || account.sessionSlug !== target.sessionSlug || account.sessionId !== target.sessionId) return null;
  if (account.workerUrl.replace(/\/+$/, '') !== target.workerUrl.replace(/\/+$/, '')) return null;
  if (lower(store.getState().profile?.account)) return null;
  changeAccount({ account: account.address, provider: AGENT_LINK_PROVIDER })(store.dispatch);
  updateLoginInfo({ loginInProgress: false, loginComplete: true, provider: AGENT_LINK_PROVIDER })(store.dispatch);
  // The sign-in a reload kept is this tab's own; without one, the account is shown as needing a new link.
  return account;
};

const postJson = async (url: string, body: unknown): Promise<Record<string, unknown>> => {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = ((await response.json().catch(() => ({}))) || {}) as Record<string, unknown>;
  if (!response.ok) {
    throw new AgentSignInError(
      typeof data.reason === 'string' ? data.reason : `http_${response.status}`,
      typeof data.error === 'string' && data.error ? data.error : 'Sign-in failed.',
      response.status,
    );
  }
  return data;
};

/**
 * The passkey's own ordinary sign-in to the session, made here because the tab's account is another one. With
 * `prompt` false it is made only if the passkey is already unlocked, so the page never raises a passkey prompt
 * by itself.
 */
const signInAsPasskey = async (
  target: SessionTarget,
  passkey: string,
  { prompt }: { prompt: boolean },
): Promise<string> => {
  const client = passkeyWallet.getPasskeyWalletClient();
  if (lower(client.getAddress()) !== lower(passkey) || !client.isUnlocked()) {
    if (!prompt) return '';
    await passkeyWallet.unlockPasskeyWallet({ expectedAddress: passkey } as Parameters<
      typeof passkeyWallet.unlockPasskeyWallet
    >[0]);
  }
  const base = target.workerUrl.replace(/\/+$/, '');
  const identity = { address: passkey, sessionSlug: target.sessionSlug, sessionId: target.sessionId };
  const nonce = await postJson(`${base}/auth/nonce`, identity);
  if (!isSignInNonce(nonce.nonce)) throw new AgentSignInError('unreadable', 'The session’s answer could not be read.');
  const message = buildSiweMessage({
    address: passkey,
    nonce: nonce.nonce,
    workerUrl: target.workerUrl,
    sessionId: target.sessionId,
    sessionSlug: target.sessionSlug,
    expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  const signature = await client.signMessage(message, passkey);
  const signedIn = await postJson(`${base}/auth/login`, { ...identity, message, signature });
  return typeof signedIn.token === 'string' ? signedIn.token : '';
};

/** Opens the agent's account through its attached passkey, with the passkey's own sign-in where one is given. */
export const enterThroughAttachedPasskey = async (
  target: SessionTarget,
  passkey: string,
  { prompt, passkeyToken = '' }: { prompt: boolean; passkeyToken?: string },
): Promise<AgentLinkAccount | null> => {
  const token = passkeyToken || (await signInAsPasskey(target, passkey, { prompt }));
  if (!token) return null;
  try {
    return enterAgentLinkAccount(target, await signInThroughAttachedPasskey(target, token));
  } catch (error) {
    // The passkey is no longer attached here: stop looking.
    if (error instanceof AgentSignInError && error.reason === 'passkey_not_attached')
      forgetAttachedPasskey(target, passkey);
    throw error;
  }
};

// A lapsed sign-in for the held account is made again through its passkey, when the tab holds the passkey.
setAgentLinkRenewer(async (account, { prompt }) => {
  const target = targetOf(account);
  const token = await signInAsPasskey(target, account.passkey, { prompt }).catch(() => '');
  if (!token) return null;
  const reply = await signInThroughAttachedPasskey(target, token).catch(() => null);
  if (!reply || reply.address !== account.address) return null;
  holdAgentLinkAccount(agentLinkAccountOf(target, reply));
  return { token: reply.token, exp: reply.exp };
});

/**
 * Makes a new passkey for the account the tab is signed in to from an agent's link, and attaches it. The passkey
 * signs that it is being attached to this account, and nothing else. A passkey the person already uses is not
 * offered: the Worker refuses one that has an account of its own here, and the site has no words for that yet.
 */
export const attachPasskeyHere = async (): Promise<AgentLinkAccount | null> => {
  const account = readAgentLinkAccount();
  if (!account) throw new AgentSignInError('not_signed_in', 'Open the session from your agent’s link first.');
  const target = targetOf(account);
  const token = heldSessionToken(target.workerUrl, target.sessionSlug);
  if (!token) throw new AgentSignInError('sign_in_ended', 'This sign-in has ended. Ask your agent for a new link.');
  const passkeyAddress = lower(await passkeyWallet.createPasskeyWallet());
  const client = passkeyWallet.getPasskeyWalletClient();
  let reply: AgentSignInReply;
  try {
    reply = await attachPasskeyToAgentAccount({
      target,
      account: account.address,
      token,
      passkeyAddress,
      sign: (message) => client.signMessage(message, passkeyAddress),
      newPasskey: true,
    });
  } catch (error) {
    // A passkey made for this and then refused is attached to nothing: it is not left as this browser's saved
    // sign-in, where a reload would open its empty account in place of this one.
    await passkeyWallet.logoutPasskeyWallet().catch(() => undefined);
    throw error;
  }
  return enterAgentLinkAccount(target, reply);
};

/** Ends the agent's access to the account, or allows it again. */
export const changeAgentAccess = async (agentAccess: 'active' | 'cancelled'): Promise<AgentLinkAccount | null> => {
  const account = readAgentLinkAccount();
  if (!account) throw new AgentSignInError('not_signed_in', 'Sign in with your passkey first.');
  const target = targetOf(account);
  const token = heldSessionToken(target.workerUrl, target.sessionSlug);
  if (!token) throw new AgentSignInError('sign_in_ended', 'Sign in with your passkey again to change this.');
  const now = await setAgentAccess(target, token, agentAccess);
  const kept = holdAgentLinkAccount({ ...account, agentAccess: now });
  // The Worker's word, not the request's: an answer that leaves it as it was is not reported as done.
  if (now !== agentAccess) throw new AgentSignInError('unchanged', 'The session did not make that change. Try again.');
  return kept;
};

/** Takes the passkey off the account and signs the tab out of it: the account is the agent's alone again. */
export const removeAttachedPasskey = async (): Promise<void> => {
  const account = readAgentLinkAccount();
  if (!account) return;
  const target = targetOf(account);
  const token = heldSessionToken(target.workerUrl, target.sessionSlug);
  if (!token) throw new AgentSignInError('sign_in_ended', 'Sign in with your passkey again to change this.');
  await detachAgentPasskey(target, token);
  if (account.passkey) forgetAttachedPasskey(target, account.passkey);
  await leaveAgentLinkAccount();
};

/** Signs the tab out of the agent's account. */
export const leaveAgentLinkAccount = async (): Promise<void> => {
  forgetAgentLinkAccount();
  await logoutClientAuth();
};
