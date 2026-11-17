import { buildSiweMessage as buildSharedSiweMessage, normalizeSessionIdHex } from '../../shared/auth/siweMessage.mjs';
import { describeTestEthOffer } from '../../shared/sessions/testEthOffer.mjs';
import { COORDINATOR_RETRY_DELAYS_MS, SESSION_COORDINATOR_UNAVAILABLE, isRetryableBusy } from '../../shared/sessionCoordinatorBusy.mjs';

// HTTP client for one Worker-hosted session, signing in exactly as the web
// client does for a passkey participant (client/src/utilities/worker/workerAuth.ts).
// Everything a Worker returns is untrusted: responses are size-capped, never
// followed through redirects, and read defensively.

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
// Stored records are small (the Worker caps a question at 128 KiB).
const MAX_RECORD_BYTES = 256 * 1024;
// The Worker stops filling a batch at 8 MB of text, so the last few items and
// the JSON around them can go a little past it.
const MAX_BATCH_RESPONSE_BYTES = 12 * 1024 * 1024;
const TOKEN_REFRESH_MARGIN_SECONDS = 60;
const SIGN_IN_VALIDITY_MS = 10 * 60 * 1000;
const MAX_LIST_PAGES = 100;
const DEFAULT_MAX_LIST_ITEMS = 10_000;
const LIST_DEADLINE_MS = 120_000;
const CONFIG_MAX_AGE_MS = 30_000;
// 401s that mean the token itself is stale or unknown; others (missing session
// secrets, a missing faucet key) are reported as they are.
const TOKEN_ERROR_RE = /token|expired|stale|sign[- ]?in|unauthori[sz]ed|authorization/i;
const MAX_ERROR_DETAIL = 300;

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const encoder = new TextEncoder();
// A stored record's text as read() gives it: JSON, a JSON string holding JSON, or null.
const parseRecordText = (raw) => {
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};
/** Reads text fields from untrusted JSON without ever calling into them. */
export const text = (value) => (typeof value === 'string' ? value.trim() : '');

export class WorkerRequestError extends Error {
  constructor(message, { status = 0, code = '', details = {} } = {}) {
    super(message);
    this.name = 'WorkerRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const explainFailure = (status, error, path) => {
  const detail = error.slice(0, MAX_ERROR_DETAIL);
  if (status === 401) return `Sign-in expired or was rejected (${detail || '401'}).`;
  if (status === 403 && /origin/i.test(detail)) {
    return `The Worker refused this sign-in origin (${detail}). Ask the session admin to allow it.`;
  }
  if (status === 403) return `Not allowed: ${detail || 'this session’s access rules deny the request'}.`;
  if (status === 404 && path.startsWith('/session-config')) return 'No hosted session with that name exists on this Worker.';
  if (status === 410) return 'This session has ended and no longer accepts answers.';
  // Agents read "nonce" as a blockchain limit; this one counts sign-ins. Any
  // other refusal of a sign-in (a busy coordinator, say) keeps its own words.
  if (status === 429 && path === '/auth/nonce' && /too many nonce/i.test(detail)) {
    return 'Too many sign-ins for this agent or its network in the last minute. Wait about a minute, then try again; anything that needed the sign-in was not sent.';
  }
  if (status === 429) return `Rate limited by the Worker (${detail || '429'}). Wait a minute and retry.`;
  // Sent after the client's own retries ran out. Usually nothing changed, but
  // the same answer follows a reply lost after the work was done.
  if (status === 503 && error === SESSION_COORDINATOR_UNAVAILABLE) {
    return 'The session is busy, so this request may not have gone through. Wait a few seconds, check whether it did, and try again.';
  }
  return detail || `Worker request failed (${status}).`;
};

export const readLimitedText = async (response, maxBytes = MAX_RESPONSE_BYTES) => {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new WorkerRequestError('The Worker response is too large.');
  if (!response.body?.getReader) {
    const body = await response.text();
    if (Buffer.byteLength(body) > maxBytes) throw new WorkerRequestError('The Worker response is too large.');
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new WorkerRequestError('The Worker response is too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
};

export { normalizeSessionIdHex };

/** Same rules as resolveWorkerCanonicalSessionIdHex: sessionId and sessionIdHex must agree. */
export const resolveSessionIdHex = (config) => {
  const present = (value) => value !== undefined && value !== null && value !== '';
  const sessionId = normalizeSessionIdHex(config?.sessionId);
  const sessionIdHex = normalizeSessionIdHex(config?.sessionIdHex);
  if (
    (!sessionId && !sessionIdHex) ||
    (present(config?.sessionId) && !sessionId) ||
    (present(config?.sessionIdHex) && !sessionIdHex) ||
    (sessionId && sessionIdHex && sessionId !== sessionIdHex)
  ) {
    return '';
  }
  return sessionId || sessionIdHex;
};

export const buildSiweMessage = ({ address, nonce, appOrigin, workerOrigin, sessionId, sessionSlug = '', issuedAt, expirationTime, chainId = 1 }) =>
  buildSharedSiweMessage({
    address, nonce, domain: new URL(appOrigin).host, uri: appOrigin,
    workerUrl: workerOrigin, sessionId, sessionSlug, issuedAt, expirationTime, chainId,
    statement: 'Sign in to Context Engine.',
  });

export const decodeTokenClaims = (token) => {
  try {
    const [payload] = text(token).split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return isRecord(claims) ? claims : {};
  } catch {
    return {};
  }
};

const normalizeOriginList = (value) =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]+/) : [])
    .map((entry) => {
      try {
        return new URL(text(entry)).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);

/**
 * Picks the sign-in origin from the agent's own trusted list: the first one
 * the session allows (any, when it lists none). A link or Worker can only
 * narrow the choice, never add an origin.
 */
export const resolveLoginOrigin = (config, trustedOrigins) => {
  const allowed = normalizeOriginList(config?.allowOrigins);
  const origin = allowed.length ? trustedOrigins.find((candidate) => allowed.includes(candidate)) : trustedOrigins[0];
  if (!origin) {
    throw new WorkerRequestError(
      `This session only allows sign-in from other web apps (${allowed.slice(0, 3).join(', ')}${allowed.length > 3 ? ', …' : ''}). ` +
        `Ask the session admin to allow ${trustedOrigins[0]}.`,
    );
  }
  return origin;
};

export const createWorkerClient = ({
  workerOrigin, slug, trustedOrigins, wallet, fetchImpl = globalThis.fetch, now = () => Date.now(), registryConfigLoader, sessionId: joinedSessionId = '',
}) => {
  // The session this client answers for: the one the agent joined, or else the first config it loads.
  let sessionId = joinedSessionId;
  let config = null;
  let configLoadedAt = 0;
  let loginOrigin = '';
  let token = '';
  let tokenExp = 0;
  let pendingLogin = null;
  let presence = null;
  let presenceLoadedAt = -Infinity;
  let features = null;
  let featuresLoadedAt = -Infinity;
  // A private session's read invite, sent with every request until the agent
  // is a member, and whether the last config was the shell given to someone
  // its rule doesn't admit.
  let groupReadInvite = '';
  let privateSession = '';

  // A busy answer the Worker marks safe to send again may follow work already
  // done, so only requests whose repeat does no harm wait and try again, as
  // the web client lists them: reads, a nonce, a group join (a no-op the second
  // time), and an upload the Worker replays by its request id. Others go once.
  const replaySafe = (path, method, body) => method === 'GET' ||
    ['/storage/read-batch', '/auth/nonce', '/groups/join'].includes(path) || (path === '/storage/upload' && !!body?.requestId);
  const waitBeforeRetry = (attempt, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Stopped before the Worker request was sent.'));
    const timer = setTimeout(resolve, COORDINATOR_RETRY_DELAYS_MS[attempt] * (0.5 + Math.random()));
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Stopped before the Worker request was sent.')); }, { once: true });
  });

  // `body` is sent as JSON; `form`, a FormData, as multipart.
  const request = async (path, { method = 'GET', headers = {}, body, form, auth = false, retried = false, busyRetries = 0, maxBytes = MAX_RESPONSE_BYTES, signal } = {}) => {
    const checkpoint = () => { if (signal?.aborted) throw new Error('Stopped before the Worker request was sent.'); };
    checkpoint();
    if (auth) await ensureToken();
    // Login and token refresh can await. Once sent, retain the response for reconciliation.
    checkpoint();
    let response;
    try {
      response = await fetchImpl(`${workerOrigin}${path}`, {
        method,
        redirect: 'error',
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(auth ? { Authorization: `Bearer ${token}`, 'X-Group-Slug': slug } : {}),
          ...(groupReadInvite ? { 'X-CE-Group-Invite': groupReadInvite } : {}),
          ...headers,
        },
        ...(form ? { body: form } : body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new WorkerRequestError(`Could not reach the Worker (${text(error?.cause?.code) || text(error?.name) || 'network error'}).`);
    }
    if (response.status >= 300 && response.status < 400) {
      throw new WorkerRequestError('The Worker answered with a redirect, which agents do not follow.', { status: response.status });
    }
    const raw = await readLimitedText(response, maxBytes);
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
    const error = isRecord(data) ? text(data.error) || text(data.message) : '';
    if (isRetryableBusy(response.status, data) && !form &&
        busyRetries < COORDINATOR_RETRY_DELAYS_MS.length && replaySafe(path, method, body)) {
      await waitBeforeRetry(busyRetries, signal);
      return request(path, { method, headers, body, form, auth, retried, busyRetries: busyRetries + 1, maxBytes, signal });
    }
    if (response.status === 401 && auth && !retried && (!error || TOKEN_ERROR_RE.test(error))) {
      token = '';
      // A sign-in ended by an admin's change: the config the agent holds may be out of date too.
      configLoadedAt = 0;
      return request(path, { method, headers, body, form, auth, retried: true, busyRetries, maxBytes, signal });
    }
    if (response.status === 401 && error && !TOKEN_ERROR_RE.test(error)) {
      throw new WorkerRequestError(error.slice(0, MAX_ERROR_DETAIL), { status: 401, code: error });
    }
    if (!response.ok) {
      throw new WorkerRequestError(explainFailure(response.status, error, path), {
        status: response.status,
        code: isRecord(data) ? text(data.code) || text(data.reason) || error : '',
        details: { balanceEth: text(data?.balanceEth), thresholdEth: text(data?.thresholdEth) },
      });
    }
    return data;
  };

  const loadConfig = async ({ renewed = false } = {}) => {
    // Signed in, the config is read as the agent: a private session shows its
    // members what it shows no one else.
    if (!registryConfigLoader && token) await ensureToken();
    const sentToken = !registryConfigLoader && !!token;
    const data = registryConfigLoader
      ? { config: await registryConfigLoader(), sessionSlug: slug }
      : await request(`/session-config?slug=${encodeURIComponent(slug)}`, {
          headers: { 'X-Session-Slug': slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
    // A private session that didn't count the sign-in, after an admin's change ended it: sign in again, once.
    if (sentToken && !renewed && text(data?.privateSession) && data?.signedIn === false) {
      token = '';
      await login();
      return loadConfig({ renewed: true });
    }
    const loaded = isRecord(data?.config) ? data.config : null;
    const id = resolveSessionIdHex(loaded);
    if (!loaded || (!registryConfigLoader && !id)) throw new WorkerRequestError('The Worker did not return a hosted session config.');
    if (sessionId && id !== sessionId) throw new WorkerRequestError('The session behind this link changed identity; join it again.');
    if (text(data.sessionSlug) && text(data.sessionSlug).toLowerCase() !== slug) {
      throw new WorkerRequestError('The Worker answered for a different session.');
    }
    // Public registry reads remain available even when this agent's sign-in origin is not admitted.
    if (registryConfigLoader) {
      try { loginOrigin = resolveLoginOrigin(loaded, trustedOrigins); } catch { loginOrigin = trustedOrigins[0]; }
    } else loginOrigin = resolveLoginOrigin(loaded, trustedOrigins);
    config = loaded;
    configLoadedAt = now();
    sessionId = id;
    privateSession = text(data.privateSession);
    return config;
  };

  /** Reloads the session config when it is older than `maxAgeMs`, so admin changes apply. */
  const refreshConfig = async ({ maxAgeMs = CONFIG_MAX_AGE_MS } = {}) => {
    if (!config || now() - configLoadedAt >= maxAgeMs) await loadConfig();
    return config;
  };

  const signIn = async () => {
    if (!config) await loadConfig();
    if (registryConfigLoader) loginOrigin = resolveLoginOrigin(config, trustedOrigins);
    const identity = registryConfigLoader ? {} : { sessionId };
    const address = wallet.address;
    const signInHeaders = { Origin: loginOrigin };
    const nonceData = await request('/auth/nonce', {
      method: 'POST',
      headers: signInHeaders,
      body: { address, sessionSlug: slug, ...identity },
    });
    const nonce = text(nonceData?.nonce);
    if (!/^[A-Za-z0-9]{8,200}$/.test(nonce)) throw new WorkerRequestError('The Worker did not issue a usable sign-in nonce.');
    const issued = new Date(now());
    const message = buildSiweMessage({
      address,
      nonce,
      appOrigin: loginOrigin,
      workerOrigin,
      sessionId: registryConfigLoader ? '' : sessionId,
      sessionSlug: slug,
      issuedAt: issued.toISOString(),
      expirationTime: new Date(issued.getTime() + SIGN_IN_VALIDITY_MS).toISOString(),
    });
    const signature = await wallet.signMessage(message);
    const loginData = await request('/auth/login', {
      method: 'POST',
      headers: signInHeaders,
      body: { address, message, signature, sessionSlug: slug, ...identity },
    });
    if (!text(loginData?.token)) throw new WorkerRequestError('The Worker did not issue a session token.');
    token = loginData.token;
    const exp = Number(loginData.exp);
    tokenExp = Number.isFinite(exp) && exp > 0 ? exp : Math.floor(now() / 1000) + 3 * 60 * 60;
    return decodeTokenClaims(token);
  };

  // Parallel calls share one sign-in rather than each asking for a nonce.
  const login = () => {
    if (!pendingLogin) pendingLogin = signIn().finally(() => {
      pendingLogin = null;
    });
    return pendingLogin;
  };

  const ensureToken = async () => {
    if (token && tokenExp - TOKEN_REFRESH_MARGIN_SECONDS > now() / 1000) return;
    await login();
  };

  /**
   * Lists a resource, following cursors (pages can be empty), up to
   * `maxItems` items and a time budget. `complete` is false when cut short.
   */
  const listAll = async (
    resource,
    { mine = false, maxItems = DEFAULT_MAX_LIST_ITEMS, maxPages = MAX_LIST_PAGES, deadlineMs = LIST_DEADLINE_MS, signal = null } = {},
  ) => {
    const items = [];
    const deadline = now() + deadlineMs;
    const seenCursors = new Set();
    let cursor = '';
    for (let page = 0; page < maxPages; page += 1) {
      const query = new URLSearchParams({ resource, limit: '100' });
      if (mine) query.set('mine', 'true');
      if (cursor) query.set('cursor', cursor);
      const data = await request(`/storage/list?${query}`, { auth: true });
      const pageItems = Array.isArray(data?.items) ? data.items.filter(isRecord) : [];
      const kept = pageItems.slice(0, Math.max(0, maxItems - items.length));
      items.push(...kept);
      if (kept.length < pageItems.length) return { items, complete: false };
      cursor = text(data?.cursor);
      if (!cursor || data?.listComplete === true) return { items, complete: true };
      if (seenCursors.has(cursor)) throw new WorkerRequestError('The Worker repeated a list cursor.');
      seenCursors.add(cursor);
      if (items.length >= maxItems || now() >= deadline || signal?.aborted) return { items, complete: false };
    }
    return { items, complete: false };
  };

  const read = async (id) => {
    const data = await request(`/storage/read?id=${encodeURIComponent(id)}`, { auth: true, maxBytes: MAX_RECORD_BYTES });
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return data;
  };

  // Up to 100 stored records in one request, on Workers that list
  // storage_read_batch_v1. Each id comes back in order as { id, status } and,
  // when status is 200, the record parsed as read() parses it. An item the
  // Worker won't send as text, one past the batch's size, or one larger than
  // a single read takes has no record here: read it on its own.
  const readBatch = async (ids, { signal } = {}) => {
    const data = await request('/storage/read-batch', {
      method: 'POST', auth: true, signal, body: { ids }, maxBytes: MAX_BATCH_RESPONSE_BYTES,
    });
    const items = new Map((Array.isArray(data?.items) ? data.items : []).filter(isRecord).map((item) => [text(item.id), item]));
    return ids.map((id) => {
      const item = items.get(id);
      const status = Number(item?.status) || 0;
      if (status !== 200 || typeof item.text !== 'string') return { id, status: status === 200 ? 0 : status };
      if (encoder.encode(item.text).length > MAX_RECORD_BYTES) return { id, status: 413 };
      return { id, status: 200, record: parseRecordText(item.text) };
    });
  };

  const upload = async ({ resource, data, tags = [], requestId = '', signal }) => {
    const result = await request('/storage/upload', {
      signal,
      method: 'POST',
      auth: true,
      body: { backend: 'cloudflare', resource, contentType: 'application/json', payloadEncrypted: false, tags, data, ...(requestId ? { requestId } : {}) },
    });
    return isRecord(result?.storageRef) ? result.storageRef : { id: text(result?.id) };
  };

  /** Stores a context file (multipart: the file, its resource, tags and access rule). */
  const uploadForm = async (form, { signal } = {}) => {
    const result = await request('/storage/upload', { signal, method: 'POST', auth: true, form });
    return isRecord(result?.storageRef) ? result.storageRef : { id: text(result?.id) };
  };

  const contextAction = (body, { signal } = {}) => request('/storage/context', { method: 'POST', auth: true, signal, body });

  // `secret` (a one-use code) or `proof` (a group password's signature) admits
  // the caller to a group that isn't open.
  const joinGroup = (groupId, { signal, secret, proof } = {}) => request('/groups/join', {
    method: 'POST', auth: true, signal, body: { sessionId, groupId, ...(secret ? { secret } : {}), ...(proof ? { proof } : {}) },
  });
  const leaveGroup = (groupId, { signal } = {}) => request('/groups/leave', { method: 'POST', auth: true, signal, body: { sessionId, groupId } });

  /** The groups this agent may see, with their member counts. */
  const listGroups = async () => {
    const data = await request(`/groups/list?sessionId=${encodeURIComponent(sessionId)}`, { auth: true });
    return Array.isArray(data?.groups) ? data.groups.filter(isRecord) : [];
  };

  /** This agent's memberships: { group, member, memberCount } each. */
  const listMyMemberships = async () => {
    const data = await request(`/groups/my-memberships?sessionId=${encodeURIComponent(sessionId)}`, { auth: true });
    return Array.isArray(data?.memberships) ? data.memberships.filter(isRecord) : [];
  };

  /** What the Worker says it supports, or null when it can't be read. */
  const readFeatures = async () => {
    if (now() - featuresLoadedAt >= CONFIG_MAX_AGE_MS) {
      features = await request('/capabilities')
        .then((data) => (Array.isArray(data?.features) ? data.features.map(text).filter(Boolean) : null))
        .catch(() => null);
      featuresLoadedAt = now();
    }
    return features;
  };

  const describeTestEth = async () => {
    await refreshConfig();
    if (now() - presenceLoadedAt >= CONFIG_MAX_AGE_MS) {
      presence = await request('/resource-presence', { headers: { 'X-Session-Slug': slug } })
        .then((data) => data?.resources || null).catch(() => null);
      presenceLoadedAt = now();
    }
    return {
      ...describeTestEthOffer({ config, resourcePresence: presence }),
      ...(token ? { tokenHasFaucetScope: decodeTokenClaims(token)?.scopes?.faucet === true } : {}),
    };
  };

  return {
    describeTestEth,
    loadConfig,
    refreshConfig,
    login,
    ensureToken,
    listAll,
    read,
    readBatch,
    upload,
    uploadForm,
    contextAction,
    joinGroup,
    leaveGroup,
    listGroups,
    listMyMemberships,
    readFeatures,
    request,
    setGroupReadInvite: (value) => {
      groupReadInvite = text(value);
    },
    get config() {
      return config;
    },
    /** 'invite_required' or 'invite_invalid' while the config is a private session's shell; '' otherwise. */
    get privateSession() {
      return privateSession;
    },
    get sessionId() {
      return sessionId;
    },
    get loginOrigin() {
      return loginOrigin;
    },
    get tokenClaims() {
      return token ? decodeTokenClaims(token) : {};
    },
  };
};
