import { normalizeSessionIdHex } from '../../shared/auth/siweMessage.mjs';
import { normalizeWorkerOrigin } from './sessionLinks.mjs';
import { readLimitedText, text, WorkerRequestError } from './workerClient.mjs';

// The sessions a site lists in /known-sessions.json, so a normal session link
// (one without worker=) reaches its Session Worker, as it does in the browser.
// The list is as trusted as the link: read only over https (or from a local
// site in development), with a timeout and a size cap, through at most two
// redirects to the same path on another public https site, and kept a minute.

const LIST_PATH = '/known-sessions.json';
const TIMEOUT_MS = 10_000;
const MAX_LIST_BYTES = 512 * 1024;
const MAX_AGE_MS = 60_000;
const MAX_REDIRECTS = 2;
const MAX_NAME_LENGTH = 120;

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

class Unreadable extends Error {}

export const createKnownSessions = ({ fetchImpl = globalThis.fetch, now = () => Date.now(), allowLocalWorkers = false } = {}) => {
  const cache = new Map(); // site -> { at, list: Promise<object | null> }
  const siteOf = (origin) => normalizeWorkerOrigin(origin, { allowLocalWorkers });

  // The site's list, or null when it has none: a 404, or the app page a site
  // serves for every path it doesn't have.
  const fetchList = async (site) => {
    let url = `${site}${LIST_PATH}`;
    for (let hop = 0; ; hop += 1) {
      let response;
      try {
        response = await fetchImpl(url, { redirect: 'manual', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (error) {
        throw new Unreadable(error?.name === 'TimeoutError' ? 'the site took too long to answer' : 'the site could not be reached');
      }
      if (response.status >= 300 && response.status < 400) {
        if (hop >= MAX_REDIRECTS) throw new Unreadable('the site redirected too many times');
        let next;
        try {
          next = new URL(text(response.headers.get('location')), url);
          if (next.pathname !== LIST_PATH || next.search || next.username || next.password) throw new Error();
          url = `${siteOf(next.origin)}${LIST_PATH}`;
        } catch {
          throw new Unreadable('the site redirected somewhere other than a public https copy of the list');
        }
        continue;
      }
      if (response.status === 404) return null;
      if (!response.ok) throw new Unreadable(`the site answered ${response.status}`);
      if (!text(response.headers.get('content-type')).toLowerCase().includes('json')) return null;
      let body;
      try {
        body = await readLimitedText(response, MAX_LIST_BYTES);
      } catch (error) {
        if (error instanceof WorkerRequestError) throw new Unreadable('the list is too large');
        throw new Unreadable(error?.name === 'TimeoutError' ? 'the site took too long to answer' : 'the list could not be read');
      }
      let list;
      try {
        list = JSON.parse(body);
      } catch {
        throw new Unreadable('the list is not valid JSON');
      }
      if (!isRecord(list)) throw new Unreadable('the list is not a set of sessions');
      return list;
    }
  };

  const readList = (site) => {
    const cached = cache.get(site);
    if (cached && now() - cached.at < MAX_AGE_MS) return cached.list;
    const list = fetchList(site);
    cache.set(site, { at: now(), list });
    // A failed read is tried again next time.
    list.catch(() => {
      if (cache.get(site)?.list === list) cache.delete(site);
    });
    return list;
  };

  /**
   * Looks a slug up in the list of the link's site: { status: 'listed',
   * workerOrigin, sessionId, name? }, { status: 'unlisted' } (no list, or not
   * on it), or { status: 'unreadable', listUrl, reason }.
   */
  const lookup = async (appOrigin, slug) => {
    let site;
    try {
      site = siteOf(appOrigin);
    } catch {
      return { status: 'unlisted' };
    }
    const listUrl = `${site}${LIST_PATH}`;
    let list;
    try {
      list = await readList(site);
    } catch (error) {
      return { status: 'unreadable', listUrl, reason: error instanceof Unreadable ? error.message : 'the list could not be read' };
    }
    if (!list || !Object.hasOwn(list, slug)) return { status: 'unlisted' };
    const entry = list[slug];
    let workerOrigin = '';
    try {
      workerOrigin = normalizeWorkerOrigin(text(entry?.worker), { allowLocalWorkers });
    } catch {
      // reported below
    }
    const sessionId = normalizeSessionIdHex(text(entry?.sessionId));
    if (!isRecord(entry) || !workerOrigin || !sessionId) {
      return { status: 'unreadable', listUrl, reason: `its entry for "${slug}" has no usable Worker or session ID` };
    }
    const name = text(entry.name).slice(0, MAX_NAME_LENGTH);
    return { status: 'listed', workerOrigin, sessionId, ...(name ? { name } : {}) };
  };

  return { lookup };
};
