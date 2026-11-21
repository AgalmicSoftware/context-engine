// The session setting `sessionLinkReading`: how the Worker reads the links an
// admin saved in the session's own context (`sessionContext.links`) as
// context sources, in the background (workers/sessionCorsWorker/sessionLinkReading.js).
// Every key is optional; a key left out keeps its default.
import { SESSION_CONTEXT_LIMITS } from './sessionContext.mjs';
import { CONTEXT_SOURCE_LIMITS } from './sessionContextSources.mjs';

export const SESSION_LINK_READING_SETTINGS = Object.freeze({
  // How many of the saved links are read, in their order; 0 reads none.
  links: Object.freeze({ default: SESSION_CONTEXT_LIMITS.links, min: 0, max: SESSION_CONTEXT_LIMITS.links }),
  // Each page's fetch, redirects and body together. The reads run after the
  // reply, which Cloudflare lets run for 30 seconds, so at most 20.
  fetchSeconds: Object.freeze({ default: 10, min: 3, max: 20 }),
  // A page's text kept, up to the snapshot cap every context link has.
  pageChars: Object.freeze({ default: CONTEXT_SOURCE_LIMITS.snapshotChars, min: 1000, max: CONTEXT_SOURCE_LIMITS.snapshotChars }),
  // A link that could not be read is not tried again sooner.
  retryMinutes: Object.freeze({ default: 60, min: 10, max: 1440 }),
});

const KEYS = Object.keys(SESSION_LINK_READING_SETTINGS);
const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const inBounds = (key, value) => Number.isInteger(value) &&
  value >= SESSION_LINK_READING_SETTINGS[key].min && value <= SESSION_LINK_READING_SETTINGS[key].max;

/** A saved setting as set-config keeps it, or why it is refused. */
export const validateSessionLinkReading = (value) => {
  if (!record(value)) return { ok: false, error: 'sessionLinkReading must be an object.' };
  const unknown = Object.keys(value).find((key) => key !== 'on' && !KEYS.includes(key));
  if (unknown) return { ok: false, error: `sessionLinkReading has no setting ${unknown}.` };
  if ('on' in value && typeof value.on !== 'boolean') return { ok: false, error: 'sessionLinkReading.on must be true or false.' };
  const wrong = KEYS.find((key) => key in value && !inBounds(key, value[key]));
  if (wrong) {
    const { min, max } = SESSION_LINK_READING_SETTINGS[wrong];
    return { ok: false, error: `sessionLinkReading.${wrong} must be a whole number from ${min} to ${max}.` };
  }
  return { ok: true, value: Object.fromEntries(['on', ...KEYS].filter((key) => key in value).map((key) => [key, value[key]])) };
};

/** The settings a read uses: the session's own where valid, else the defaults. On unless turned off. */
export const resolveSessionLinkReading = (config) => {
  const saved = record(config?.sessionLinkReading) ? config.sessionLinkReading : {};
  return {
    on: saved.on !== false,
    ...Object.fromEntries(KEYS.map((key) => [key, inBounds(key, saved[key]) ? saved[key] : SESSION_LINK_READING_SETTINGS[key].default])),
  };
};

// What the session coordinator keeps for one session: each saved link it has
// tried, when, and whether that read stored a source. A link read once is
// never read again while it stays saved, so a source an admin removes stays
// removed; a link taken out of the context is forgotten. A session reset
// under the same link starts afresh.
const linksOf = (state, sessionId) => (record(state) && state.sessionId === sessionId && record(state.links) ? state.links : {});

/** Claims the links due a read now: never tried, or failed (or left unfinished) at least `retryMs` ago. */
export const claimSessionLinkReads = ({ state, sessionId, urls, retryMs, nowMs }) => {
  const kept = linksOf(state, sessionId);
  const links = Object.fromEntries(urls.filter((url) => record(kept[url])).map((url) => [url, kept[url]]));
  const due = urls.filter((url) => !links[url] || (links[url].ok !== true && nowMs - Number(links[url].at || 0) >= retryMs));
  for (const url of due) links[url] = { at: nowMs, ok: false, pending: true };
  return { state: { sessionId, links }, due };
};

/** Records how a claimed read ended; a link forgotten meanwhile stays forgotten. */
export const settleSessionLinkRead = ({ state, sessionId, url, ok, error, nowMs }) => {
  const links = linksOf(state, sessionId);
  if (!record(links[url])) return state;
  const entry = { at: nowMs, ok: ok === true, ...(ok !== true && error ? { error: String(error).slice(0, 300) } : {}) };
  return { sessionId, links: { ...links, [url]: entry } };
};
