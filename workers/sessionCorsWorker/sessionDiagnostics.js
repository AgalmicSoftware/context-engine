import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const STORE_PREFIX = 'upload-receipt-store-v1:';
const CURSOR_PREFIX = 'upload-receipt-cursor-v1:';
const SWEEP_KEY = 'upload-receipt-store-sweep-v1';
const REGISTERED_KEY = 'upload-receipt-indexed-until-v1';
const PAGE_SIZE = 25;
const SWEEP_SIZE = 100;
const HASH = /^[a-f0-9]{64}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unavailable = () => Object.assign(new Error('Session diagnostics are unavailable; retry.'), { status: 503 });
const invalidCursor = () => Object.assign(new Error('Invalid diagnostics cursor; refresh diagnostics.'), { status: 400 });
const opaqueCursor = async (env, owner) => {
  if (!env.TOKEN_HMAC_SECRET) throw unavailable();
  const encoder = new TextEncoder();
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const root = await crypto.subtle.importKey('raw', encoder.encode(env.TOKEN_HMAC_SECRET), algorithm, false, ['sign']);
  const derived = await crypto.subtle.sign('HMAC', root, encoder.encode('ce-diagnostics-cursor-v1'));
  const key = await crypto.subtle.importKey('raw', derived, algorithm, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(owner)));
  return [...mac].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const indexStub = async (env, slug) => {
  const binding = env?.CE_SESSION_COORDINATOR;
  const name = await sha256Hex(`upload-receipt-index:${resolveCoordinatorSessionSlugStorageKey(slug)}`);
  return binding?.get(binding.idFromName(name));
};

const scheduleSweep = async (storage, at) => {
  const current = await storage.getAlarm?.();
  if ((!current || current > at) && storage.setAlarm) await storage.setAlarm(at);
};

// Best-effort registration runs once a day before reserve, never during settle.
// Eight days cover the seven-day receipt lifetime plus the renewal interval.
// Counts stay in each participant's coordinator; uploads do not share a counter.
export const registerUploadReceiptStore = async (coordinator, identity) => {
  if (!identity) return; // Direct coordinator unit fixtures have no namespace binding.
  if (!HASH.test(identity.owner || '') || !resolveCoordinatorSessionSlugStorageKey(identity.slug)) throw unavailable();
  const now = coordinator.now();
  const storage = coordinator.state.storage;
  if (Number(await storage.get(REGISTERED_KEY)) > now) return;
  const stub = await indexStub(coordinator.env, identity.slug);
  if (!stub) throw unavailable();
  const response = await stub.fetch('https://session-coordinator.internal/upload-receipts/index/register', {
    method: 'POST', body: JSON.stringify({ owner: identity.owner }),
  });
  if (!response.ok) throw unavailable();
  await storage.put(REGISTERED_KEY, now + DAY_MS);
};

export const dispatchUploadReceiptIndex = async (coordinator, path, payload) => {
  const storage = coordinator.state.storage;
  const now = coordinator.now();
  if (path.endsWith('/register')) {
    if (!HASH.test(payload?.owner || '')) return json({ error: 'Invalid receipt store.' }, 400);
    await storage.transaction(async transaction => {
      await transaction.put(`${STORE_PREFIX}${payload.owner}`, { expiresAtMs: now + 8 * DAY_MS });
      if (!await transaction.get(SWEEP_KEY)) await transaction.put(SWEEP_KEY, { cursor: '' });
    });
    await scheduleSweep(storage, now + DAY_MS);
    return json({ ok: true });
  }
  if (path.endsWith('/list')) {
    const cursor = payload?.cursor || '';
    if (cursor && !HASH.test(cursor)) return json({ error: 'Invalid diagnostics cursor.' }, 400);
    const continuation = cursor ? await storage.get(`${CURSOR_PREFIX}${cursor}`) : null;
    if (cursor && (!continuation || continuation.expiresAtMs <= now)) return json({ error: 'Invalid diagnostics cursor.' }, 400);
    const entries = await storage.list({ prefix: STORE_PREFIX, ...(continuation ? { startAfter: `${STORE_PREFIX}${continuation.owner}` } : {}), limit: PAGE_SIZE + 1 });
    const page = [...entries].slice(0, PAGE_SIZE);
    let next = null;
    if (entries.size > PAGE_SIZE) {
      // Keep receipt-store names unchanged for replay compatibility. Only this
      // private, expiring map can resolve an admin-visible token to its owner.
      const owner = page.at(-1)[0].slice(STORE_PREFIX.length);
      next = await opaqueCursor(coordinator.env, owner);
      await storage.transaction(async transaction => {
        await transaction.put(`${CURSOR_PREFIX}${next}`, { owner, expiresAtMs: now + DAY_MS });
        if (!await transaction.get(SWEEP_KEY)) await transaction.put(SWEEP_KEY, { cursor: '' });
      });
      await scheduleSweep(storage, now + DAY_MS);
    }
    return json({ ok: true,
      owners: page.filter(([, value]) => value.expiresAtMs > now).map(([key]) => key.slice(STORE_PREFIX.length)),
      cursor: next,
    });
  }
  return json({ error: 'Not found.' }, 404);
};

export const sweepUploadReceiptIndex = async (coordinator) => {
  const storage = coordinator.state.storage;
  const now = coordinator.now();
  const delay = await storage.transaction(async transaction => {
    const sweep = await transaction.get(SWEEP_KEY);
    if (!sweep) return null;
    // Renewal and expiry share a transaction so cleanup cannot erase a store
    // that registered again after the sweep read its old expiry.
    const entries = await transaction.list({ prefix: STORE_PREFIX, ...(sweep.cursor ? { startAfter: sweep.cursor } : {}), limit: SWEEP_SIZE });
    for (const [key, value] of entries) if (value.expiresAtMs <= now) await transaction.delete(key);
    const cursors = await transaction.list({ prefix: CURSOR_PREFIX, ...(sweep.tokenCursor ? { startAfter: sweep.tokenCursor } : {}), limit: SWEEP_SIZE });
    for (const [key, value] of cursors) if (value.expiresAtMs <= now) await transaction.delete(key);
    if (entries.size === SWEEP_SIZE || cursors.size === SWEEP_SIZE) {
      await transaction.put(SWEEP_KEY, { cursor: [...entries.keys()].at(-1) || sweep.cursor,
        tokenCursor: [...cursors.keys()].at(-1) || sweep.tokenCursor });
      return 1000;
    }
    if ((await transaction.list({ prefix: STORE_PREFIX, limit: 1 })).size ||
        (await transaction.list({ prefix: CURSOR_PREFIX, limit: 1 })).size) {
      await transaction.put(SWEEP_KEY, { cursor: '' });
      return DAY_MS;
    }
    await transaction.delete(SWEEP_KEY);
    return 0;
  });
  if (delay === null) return false;
  if (delay) await storage.setAlarm?.(now + delay);
  return true;
};

export const readSessionDiagnosticsAuthority = async ({ env, slug }) => {
  const result = await callSessionConfigCoordinator({ env, slug, path: 'diagnostics' });
  if (!result.ok) throw unavailable();
  return result.body;
};

export const readUploadReceiptDiagnostics = async ({ env, slug, cursor = '' }) => {
  if (cursor && !HASH.test(cursor)) throw invalidCursor();
  const totals = { pendingLeases: 0, oldestPendingAgeMs: null, settledCount: 0, cursor: null, complete: false };
  let page;
  let response;
  try {
    const stub = await indexStub(env, slug);
    response = await stub.fetch('https://session-coordinator.internal/upload-receipts/index/list', {
      method: 'POST', body: JSON.stringify({ cursor }),
    });
    page = await response.json();
  } catch { return totals; }
  if (response.status === 400) throw invalidCursor();
  if (!response.ok || !Array.isArray(page.owners)) return totals;
  totals.cursor = page.cursor;
  totals.complete = !page.cursor;
  for (const owner of page.owners) {
    try {
      if (!HASH.test(owner)) throw unavailable();
      const ownerStub = env.CE_SESSION_COORDINATOR.get(env.CE_SESSION_COORDINATOR.idFromName(owner));
      const reply = await ownerStub.fetch('https://session-coordinator.internal/upload-receipts/diagnostics', { method: 'POST', body: '{}' });
      const counts = await reply.json();
      if (!reply.ok) throw unavailable();
      totals.pendingLeases += counts.pendingLeases;
      totals.settledCount += counts.settledCount;
      if (counts.oldestPendingAgeMs !== null) totals.oldestPendingAgeMs = Math.max(totals.oldestPendingAgeMs ?? 0, counts.oldestPendingAgeMs);
    } catch {
      // An unavailable page must be refreshed, not appended as a complete total.
      totals.complete = false;
      totals.cursor = null;
    }
  }
  return totals;
};
