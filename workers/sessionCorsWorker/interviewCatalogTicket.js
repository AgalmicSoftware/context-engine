import { validateAuthTokenRecord } from './authTokenClaims.js';
import { readAuthorizationEpoch } from './authorizationScopeFreshness.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { base64UrlEncode, signHmac, timingSafeEqual } from './tokenSigning.js';

// A catalog ticket lets one person's own AI read a session's interview catalog as that person.
// It carries only who it is for, the sign-in it came from and its expiry. The session, its ID
// and its access version are signed in, not carried, so another session, a rotated session or
// any access edit ends it. Signing out of the page doesn't: the Worker can't tell, so a ticket
// already handed out runs until it expires.
export const INTERVIEW_CATALOG_TICKET_TTL_SECONDS = 60 * 60;
const TICKET_VERSION = 'ic1';
const TICKET_KEY_LABEL = 'interview-catalog-ticket-v1';
const TICKET_PATTERN = /^ic1\.(0x[0-9a-f]{40})\.([A-Za-z0-9_-]{8,64})\.([1-9][0-9]{0,11})\.([A-Za-z0-9_-]{43})$/;
// Reading the catalog is a storage read, which either scope allows.
const READ_SCOPES = ['storage', 'arweave'];
const REFUSED = Object.freeze({
  ok: false,
  status: 401,
  reason: 'catalog_ticket_invalid',
  error: 'This private catalog link has expired or no longer works. Copy the prompt again from the session page.',
});
const UNAVAILABLE = Object.freeze({
  ok: false,
  status: 503,
  reason: 'catalog_ticket_unavailable',
  error: 'Could not check this catalog link. Retry shortly.',
});

const trim = (value) => String(value == null ? '' : value).trim();

const nowSeconds = (deps) => Math.floor((typeof deps?.now === 'function' ? deps.now() : Date.now()) / 1000);

// Its own key, so a ticket never verifies as a sign-in and a sign-in never as a ticket.
const signTicket = async ({ env, config, slug, sub, parent, exp, deps }) => {
  const key = base64UrlEncode(await signHmac(TICKET_KEY_LABEL, env?.TOKEN_HMAC_SECRET, deps), deps);
  const fields = [
    TICKET_VERSION,
    trim(slug).toLowerCase(),
    resolveCanonicalWorkerSessionIdHex(config) || '',
    readAuthorizationEpoch(config),
    sub,
    parent,
    exp,
  ];
  return base64UrlEncode(await signHmac(fields.join('\n'), key, deps), deps);
};

/** A ticket for one signed-in person, lasting an hour at most and never past their sign-in. */
export const issueInterviewCatalogTicket = async ({ env, config, slug, sub, parent, parentExp, deps } = {}) => {
  const address = trim(sub).toLowerCase();
  const signIn = trim(parent);
  const now = nowSeconds(deps);
  const exp = Math.min(now + INTERVIEW_CATALOG_TICKET_TTL_SECONDS, Math.floor(Number(parentExp) || 0));
  if (!/^0x[0-9a-f]{40}$/.test(address) || !/^[A-Za-z0-9_-]{8,64}$/.test(signIn)) {
    throw new Error('Catalog tickets need a signed-in person.');
  }
  if (exp <= now || readAuthorizationEpoch(config) === null) throw new Error('Catalog tickets need a current sign-in.');
  const mac = await signTicket({ env, config, slug, sub: address, parent: signIn, exp, deps });
  return { ticket: [TICKET_VERSION, address, signIn, exp, mac].join('.'), expiresAt: exp };
};

/** Who a ticket lets the catalog read as, checked against the session as it is now. */
export const verifyInterviewCatalogTicket = async ({ env, ticket, config, slug, deps } = {}) => {
  const match = trim(ticket).match(TICKET_PATTERN);
  if (!match || readAuthorizationEpoch(config) === null) return REFUSED;
  const [, sub, parent, expText, mac] = match;
  const exp = Number(expText);
  if (nowSeconds(deps) >= exp) return REFUSED;
  let expected;
  try {
    expected = await signTicket({ env, config, slug, sub, parent, exp, deps });
  } catch {
    return UNAVAILABLE;
  }
  if (!timingSafeEqual(expected, mac)) return REFUSED;
  let record;
  try {
    // A revoked sign-in ends its tickets.
    record = await (deps?.validateAuthTokenRecord || validateAuthTokenRecord)({
      env,
      payload: { sub, jti: parent },
      slug,
    });
  } catch {
    return UNAVAILABLE;
  }
  if (!record?.ok) return REFUSED;
  // As a signed-in read does, ask whether the person may still read the session now.
  let scopes = null;
  try {
    scopes = await deps?.computeScopesForLogin?.({ env, slug, address: sub, config, requestedScopes: READ_SCOPES });
  } catch {
    // A gate that turns them away, or can't tell, throws; a signed-in read is refused then too.
  }
  if (scopes?.storage !== true && scopes?.arweave !== true) return REFUSED;
  return {
    ok: true,
    reader: { address: sub, scopes: { storage: scopes.storage === true, arweave: scopes.arweave === true } },
  };
};
