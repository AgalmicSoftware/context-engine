import { CONTEXT_ROLE, CONTEXT_TAGS as TAGS, contextRoleOf, contextTagValue } from '../../shared/sessionContextSources.mjs';
import { normalizeSessionContext } from '../../shared/sessionContext.mjs';
import { resolveSessionLinkReading } from '../../shared/sessionLinkReading.mjs';
import { resolveSessionLifecycle } from '../shared/sessionLifecycle.mjs';
import { addContextLink } from './contextSourceRoute.js';
import { forEveryone } from './contextSourceLoader.js';
import { callSessionConfigCoordinator, executeCoordinatedContextSourceOperation } from './sessionConfigAuthority.js';
import {
  listContextSourceRows, resolveSessionAdminAddresses, sessionStoresPlainContext, storeSessionLinkSource,
} from './storageRouteExecution.js';

const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const canonicalUrl = (value) => { try { return new URL(trim(value)).toString(); } catch { return ''; } };
const coordinate = (deps, args) => (deps?.executeCoordinatedContextSourceOperation || executeCoordinatedContextSourceOperation)(args);
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// The links read: only those an admin saved in the session's own context,
// in their order, each once. Nothing else (no address in a question, an
// answer, a file or a link someone added) is ever read from here.
const savedLinks = (config, count) => {
  const seen = new Map();
  for (const { label, url } of normalizeSessionContext(config?.sessionContext).links) {
    const address = canonicalUrl(url);
    if (address.startsWith('https://') && !seen.has(address)) seen.set(address, trim(label));
  }
  return [...seen].slice(0, count).map(([url, label]) => ({ url, label }));
};

// An admin's link with the same address, open to everyone the session
// admits, is already read: a hand-added copy is never fetched again.
const heldByAdmins = (rows, config) => new Set(rows
  .filter((row) => contextRoleOf(row.tags) === CONTEXT_ROLE && contextTagValue(row.tags, TAGS.kind) === 'link' &&
    row.uploadAuthority === 'admin' && forEveryone(row, config))
  .map((row) => contextTagValue(row.tags, TAGS.url)));

const currentConfig = async (env, slug) => {
  const current = await callSessionConfigCoordinator({ env, slug, path: 'current' });
  return current?.ok && current.body?.config && typeof current.body.config === 'object' ? current.body.config : null;
};

const run = async ({ env, config, slug, deps, afterSave }) => {
  const session = config || await currentConfig(env, slug);
  const settings = resolveSessionLinkReading(session);
  if (!session || !settings.on || !settings.links || !sessionStoresPlainContext(session)) return { read: [] };
  if (resolveSessionLifecycle(session, { now: deps?.now }).ended) return { read: [] };
  // Stored as the session's first admin, so it is the admins' item: first in the
  // reading order, removed only by an admin, and open to everyone the session admits.
  const admin = [...resolveSessionAdminAddresses(session)][0];
  const links = savedLinks(session, settings.links);
  // A save with no links left still tells the coordinator, which forgets the ones taken out.
  if (!admin || (!links.length && !afterSave)) return { read: [] };
  const sessionId = trim(session.sessionId || session.sessionIdHex);
  const claimed = await coordinate(deps, {
    env, slug, operation: 'claim-links', sessionId, urls: links.map((link) => link.url), retryMs: settings.retryMinutes * 60_000,
  });
  const due = new Set(claimed?.ok && Array.isArray(claimed.body?.due) ? claimed.body.due : []);
  if (!due.size) return { read: [] };
  const held = heldByAdmins(await listContextSourceRows({ env, slug }), session);
  const settle = (url, ok, error) => coordinate(deps, { env, slug, operation: 'settle-link', sessionId, url, ok, error });
  const now = () => new Date(deps?.now?.() || Date.now()).toISOString();
  // Side by side, so all finish within the time Cloudflare gives work after the reply.
  const read = await Promise.all(links.filter((link) => due.has(link.url)).map(async ({ url, label }) => {
    if (held.has(url)) {
      await settle(url, true);
      return { url, ok: true, held: true };
    }
    let ok = false;
    let error = '';
    try {
      // The add-link path itself: its link policy, secret check, size cut, upload and card.
      const response = await addContextLink({
        body: { url, title: label }, env, config: session, slug, json: reply, now,
        deps: { ...deps, fetchTimeoutMs: settings.fetchSeconds * 1000 },
        store: (payload) => storeSessionLinkSource({ env, config: session, slug, admin, payload, deps }),
        snapshotChars: settings.pageChars,
      });
      ok = response.status === 200;
      if (!ok) error = trim((await response.json().catch(() => ({})))?.error) || `status ${response.status}`;
    } catch (failure) {
      error = trim(failure?.message) || 'read failed';
    }
    await settle(url, ok, error);
    return { url, ok, ...(error ? { error } : {}) };
  }));
  return { read };
};

/**
 * Reads the session's saved links that aren't context sources yet, in the
 * background: after a save that may change them (`afterSave`), and when the
 * Session Agent is asked. It never delays the reply and never fails it. With
 * no config, the current one is read. Returns the work, for tests.
 */
export const readSessionLinks = ({ env, config = null, slug, deps = {}, afterSave = false }) => {
  const work = run({ env, config, slug, deps, afterSave }).catch((error) => {
    deps?.log?.warn?.('[session-links] read failed', { slug, error: error?.message || String(error || '') });
    return { read: [] };
  });
  if (typeof deps?.waitUntil === 'function') deps.waitUntil(work);
  return work;
};
