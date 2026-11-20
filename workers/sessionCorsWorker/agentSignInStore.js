// What the session's coordinator keeps for signing a person in to their agent's account: unused one-time codes,
// by the SHA-256 of each and never the code, and for an account with a passkey attached, which passkey and
// whether the agent may still use the account. Every change runs in one transaction, so a code is used once
// and the two halves of an attachment are always written together. All of it is new keys beside the session's
// config: an older Worker never reads them, and nothing else the session stores is touched.
import { AGENT_ACCESS } from '../../shared/agentSignIn.mjs';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const codeKey = (hash) => `agent-signin-code:v1:${hash}`;
const liveKey = (account) => `agent-signin-live:v1:${account}`;
const accountKey = (account) => `agent-link:v1:account:${account}`;
const passkeyKey = (passkey) => `agent-link:v1:passkey:${passkey}`;
// Codes nobody used are cleared a few at a time when a new one is made.
const SWEEP_LIMIT = 25;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const addressOf = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  return ADDRESS_RE.test(text) ? text : '';
};
const refused = (reason, status = 409) => ({ ok: false, reason, status });
const linkOf = (record) => (record && addressOf(record.passkey)
  ? {
      passkey: record.passkey,
      linkedAt: record.linkedAt || null,
      agentAccess: record.agentAccess === AGENT_ACCESS.CANCELLED ? AGENT_ACCESS.CANCELLED : AGENT_ACCESS.ACTIVE,
    }
  : null);

const operations = {
  // What is kept about one address: the passkey attached to it, and the account it is a passkey for.
  state: async (txn, { address }) => {
    const [asAccount, asPasskey] = await Promise.all([txn.get(accountKey(address)), txn.get(passkeyKey(address))]);
    return { ok: true, asAccount: linkOf(asAccount), asPasskey: addressOf(asPasskey?.account) ? { account: asPasskey.account } : null };
  },

  // A new code for the account; its earlier unused one stops working.
  'code-create': async (txn, { address: account, codeHash, origin, expiresAt, now }) => {
    if (!HASH_RE.test(codeHash) || !origin || !Number.isFinite(expiresAt) || expiresAt <= now) return refused('invalid_code_request', 400);
    if (linkOf(await txn.get(accountKey(account)))?.agentAccess === AGENT_ACCESS.CANCELLED) return refused('agent_access_cancelled', 403);
    const earlier = await txn.get(liveKey(account));
    if (HASH_RE.test(earlier || '')) await txn.delete(codeKey(earlier));
    const stale = await txn.list({ prefix: codeKey(''), limit: SWEEP_LIMIT });
    for (const [key, value] of stale) if (!(Number(value?.expiresAt) > now)) await txn.delete(key);
    await txn.put(codeKey(codeHash), { account, origin, expiresAt });
    await txn.put(liveKey(account), codeHash);
    return { ok: true, expiresAt };
  },

  // A code shown is a code spent, whatever came of it: it is deleted before anything about it is judged.
  'code-redeem': async (txn, { codeHash, origin, now }) => {
    if (!HASH_RE.test(codeHash)) return refused('sign_in_code_invalid', 401);
    const record = await txn.get(codeKey(codeHash));
    if (!record) return refused('sign_in_code_invalid', 401);
    await txn.delete(codeKey(codeHash));
    const account = addressOf(record.account);
    if (account && (await txn.get(liveKey(account))) === codeHash) await txn.delete(liveKey(account));
    if (!account || !(Number(record.expiresAt) > now) || !origin || record.origin !== origin) return refused('sign_in_code_invalid', 401);
    const link = linkOf(await txn.get(accountKey(account)));
    if (link?.agentAccess === AGENT_ACCESS.CANCELLED) return refused('sign_in_code_invalid', 401);
    return { ok: true, account, link };
  },

  // One passkey for an account, one account for a passkey, and no chains of either.
  attach: async (txn, { address: account, passkey, now }) => {
    const passkeyAddress = addressOf(passkey);
    if (!passkeyAddress || passkeyAddress === account) return refused('invalid_passkey', 400);
    const existing = linkOf(await txn.get(accountKey(account)));
    if (existing) return existing.passkey === passkeyAddress ? { ok: true, link: existing } : refused('account_has_passkey');
    const [taken, passkeyIsAccount, accountIsPasskey] = await Promise.all([
      txn.get(passkeyKey(passkeyAddress)), txn.get(accountKey(passkeyAddress)), txn.get(passkeyKey(account)),
    ]);
    if (taken || passkeyIsAccount || accountIsPasskey) return refused('passkey_in_use');
    const record = { passkey: passkeyAddress, linkedAt: new Date(now).toISOString(), agentAccess: AGENT_ACCESS.ACTIVE };
    await txn.put(accountKey(account), record);
    await txn.put(passkeyKey(passkeyAddress), { account });
    return { ok: true, link: linkOf(record) };
  },

  // Only the attached passkey ends, or restores, the agent's use of the account.
  access: async (txn, { address: account, passkey, agentAccess, now }) => {
    if (![AGENT_ACCESS.ACTIVE, AGENT_ACCESS.CANCELLED].includes(agentAccess)) return refused('invalid_agent_access', 400);
    const record = await txn.get(accountKey(account));
    const link = linkOf(record);
    if (!link || link.passkey !== addressOf(passkey)) return refused('passkey_not_attached', 403);
    await txn.put(accountKey(account), { ...record, agentAccess, changedAt: new Date(now).toISOString() });
    if (agentAccess === AGENT_ACCESS.CANCELLED) {
      const live = await txn.get(liveKey(account));
      if (HASH_RE.test(live || '')) await txn.delete(codeKey(live));
      await txn.delete(liveKey(account));
    }
    return { ok: true, link: { ...link, agentAccess } };
  },

  // The passkey comes off only while the agent can still use the account, so no account is left with no way in.
  detach: async (txn, { address: account, passkey }) => {
    const link = linkOf(await txn.get(accountKey(account)));
    if (!link) return { ok: true, detached: false };
    if (passkey !== undefined && link.passkey !== addressOf(passkey)) return refused('passkey_not_attached', 403);
    if (link.agentAccess === AGENT_ACCESS.CANCELLED) return refused('agent_access_cancelled_first');
    await txn.delete(accountKey(account));
    await txn.delete(passkeyKey(link.passkey));
    return { ok: true, detached: true };
  },
};

export const dispatchAgentSignInStore = async (coordinator, operation, payload = {}) => {
  const run = Object.hasOwn(operations, operation) ? operations[operation] : null;
  if (!run) return json({ ok: false, error: 'Not found.' }, 404);
  const address = addressOf(payload.address);
  if (operation !== 'code-redeem' && !address) return json({ ok: false, reason: 'invalid_address' }, 400);
  const now = Number.isFinite(payload.now) ? payload.now : Date.now();
  const result = await coordinator.state.storage.transaction((txn) => run(txn, { ...payload, address, now }));
  const { status, ...body } = result;
  return json(body, result.ok ? 200 : status || 409);
};

/** One store operation for a session; `{ ok: false, reason }` when it refuses, and unavailable when it can't answer. */
export const callAgentSignInStore = async (env, slug, operation, payload = {}) => {
  try {
    const result = await callSessionConfigCoordinator({ env, slug, path: `agent-sign-in/${operation}`, ...payload });
    const body = result?.body;
    if (body && typeof body === 'object' && typeof body.ok === 'boolean') return { ...body, status: result.status };
    return { ok: false, reason: 'agent_sign_in_unavailable', status: 503, unavailable: true };
  } catch {
    return { ok: false, reason: 'agent_sign_in_unavailable', status: 503, unavailable: true };
  }
};
