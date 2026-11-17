// A name each person may give themselves in one session, shown to others in
// place of their address. One key per person in the session's coordinator; a
// person sets only their own, an admin may clear anyone's, and no one sets
// another's. Only this module and its routes read the store: names never
// reach AI prompts, exports or agent results.
import { looksSecret } from '../../shared/secretText.mjs';
import { SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { isWorkerCanonicalSessionConfig } from './workerCanonicalAuthority.js';

const PREFIX = 'session-name-v1:';
const PAGE = 1000;
const ADDRESS = /^0x[0-9a-f]{40}$/;
export const SESSION_NAME_LIMITS = Object.freeze({ chars: 32, setsPerDay: 10 });

const addressOf = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
export const isNameHolder = (value) => ADDRESS.test(addressOf(value));
export const sessionNameKey = (address) => PREFIX + addressOf(address);

// Words that would let a name pass for someone with a role, matched as whole words.
const ROLE_WORDS = [
  'admin', 'administrator', 'moderator', 'host', 'organiser', 'organizer', 'official', 'staff', 'system',
  'results admin', 'session agent', 'group agent', 'context engine', 'radicalxchange', 'rxc',
];
const DOMAIN = /(^|\s)(www\.|[\p{L}\p{N}-]+\.(com|org|net|io|ai|app|dev|xyz|co|me|gg|so|info|link|site|online)(\s|$))/iu;
const REFUSALS = Object.freeze({
  empty: 'Write a name first.',
  too_long: `A name can be at most ${SESSION_NAME_LIMITS.chars} characters.`,
  agent_mark: 'Agents are marked by the site; leave “(agent)” out of a name.',
  characters: 'Use letters, numbers, spaces and . - _ \' only.',
  mixed_scripts: 'Write each word in one alphabet.',
  address: 'That looks like an address; choose a name.',
  ens: 'That looks like an ENS name; choose a name.',
  url_or_email: 'That looks like a web address; choose a name.',
  secret: 'That looks like a key or password; choose a name.',
  role: 'Names can’t claim a role, such as admin or host.',
});
const refuse = (reason) => ({ ok: false, reason, error: REFUSALS[reason] });

// Letters drawn like Latin ones, read as those Latin letters when checking
// for an address or a role, each case by its own shape (capital Greek Η is an
// H, small η an n); a small letter not listed is read by its capital. NFKC has
// already folded fullwidth and styled letters, and a word mixing these
// alphabets is refused outright, so this only has to cover a whole word
// written in one of them: Greek, Cyrillic, Armenian, Cherokee, Lisu, Coptic,
// Canadian syllabics, Tifinagh, and Latin small capitals, IPA letters and
// letters with a stroke or hook (ø, đ, ħ), which carry no accent to drop.
const SHAPES = {
  a: 'АаΑαɑꓮᎪᗩᴀⲀⲁȺÆæ', b: 'ВвΒβꓐᏴᗷʙⲂⲃƀɓ', c: 'СсϹϲꓚᏟᑕᴄⲤⲥƈȼ', d: 'ԀԁꓓᎠᗪᴅđɗɖĐᕲ', e: 'ЕеΕεꓰᎬᴇⲈⲉᕮɇ', f: 'ꓝᖴꜰƒ',
  g: 'ɡꓖᏀɢցǥɠ', h: 'НнҺһΗꓧᎻᕼʜհⲎħɦɧĦᏂ', i: 'ІіΙιıɩƖǀꓲɪⲒⲓⵏɨƗᓰᎥ', j: 'ЈјȷꓙᎫᒍᴊɉʝ', k: 'КкΚκꓗᏦᴋⲔⲕƙꝁ', l: 'ӀӏꓡᏞᒪʟłƚŁ',
  m: 'МмΜꓟᎷᗰᴍⲘⲙɱᘻ', n: 'ΝηꓠᑎɴոⲚⲛɲɳŋŊᘉᏁ', o: 'ОоΟοօꓳᎾᗝᴏⲞⲟⵔøɵØᓍᎧ', p: 'РрΡρꓑᏢᑭᴘքⲢⲣᵽ', q: 'Ԛԛᑫ', r: 'ꓣᎡᖇʀɍ',
  s: 'ЅѕꓢᏚᔕꜱʂꞩꞨŞşᏕ', t: 'ТтΤτꓔᎢᴛⲦⲧŧƭʈŦᖶᏖ', u: 'μυսꓴᑌᴜʉ', v: 'νꓦᏙᐯᴠʋ', w: 'ԜԝꓪᏔᗯᴡᎳ', x: 'ХхΧχꓫ᙭Ⲭⲭⵝⵅ',
  y: 'УуΥγꓬᎩʏⲨⲩᎽɏƴ', z: 'ΖζꓜᏃᘔᴢⲌⲍƶȥ',
};
const LOOK_ALIKES = new Map(Object.entries(SHAPES).flatMap(([latin, shapes]) => [...shapes].map((shape) => [shape, latin])));
const skeleton = (name) => [...name.normalize('NFD').replace(/\p{M}/gu, '')]
  .map((char) => LOOK_ALIKES.get(char) || LOOK_ALIKES.get(char.toUpperCase()) || char.toLowerCase()).join('')
  // A zero in any script, then x: the start of an address.
  .replace(/\p{Nd}(?=x)/gu, '0');
const LOOK_ALIKE_SCRIPTS = ['Latin', 'Greek', 'Cyrillic', 'Armenian', 'Cherokee', 'Lisu', 'Coptic', 'Canadian_Aboriginal', 'Tifinagh'].map((script) => new RegExp(`\\p{Script=${script}}`, 'u'));
// A letter outside Latin (and outside the shared modifier letters, such as ʻ).
const NOT_LATIN = /(?![\p{Script=Latin}\p{Script=Common}])\p{L}/u;
const LATIN = /\p{Script=Latin}/u;
const mixesAlphabets = (name) => name.split(/[\s._'-]+/u).some((word) =>
  (LATIN.test(word) && NOT_LATIN.test(word)) || LOOK_ALIKE_SCRIPTS.filter((script) => script.test(word)).length > 1);

/**
 * The name to store for what a person typed: normalised (NFKC, trimmed, inner
 * spaces collapsed), '' to remove theirs, or the refusal and its reason.
 */
export const normalizeSessionName = (value) => {
  if (typeof value !== 'string') return refuse('empty');
  // NFKC folds fullwidth, styled and compatibility forms into plain ones.
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!name) return { ok: true, name: '' };
  if ([...name].length > SESSION_NAME_LIMITS.chars) return refuse('too_long');
  if (/\(\s*agent\s*\)/iu.test(name)) return refuse('agent_mark');
  // Characters drawn as nothing (joiners, variation selectors, fillers) could hide inside a word or be a whole name.
  if (!/^[\p{L}\p{M}\p{N} ._'-]+$/u.test(name) || /[\p{Default_Ignorable_Code_Point}\u{16FE4}]/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) {
    return refuse('characters');
  }
  if (mixesAlphabets(name)) return refuse('mixed_scripts');
  const seen = skeleton(name);
  if (/(^|[^\p{L}\p{N}])0x[0-9a-f]/u.test(seen) || /[0-9a-f]{16}/u.test(seen)) return refuse('address');
  if (/\.eth(\s|$)/u.test(seen)) return refuse('ens');
  if (DOMAIN.test(seen)) return refuse('url_or_email');
  if (looksSecret(name)) return refuse('secret');
  const words = ` ${seen.replace(/[._'-]+/gu, ' ').replace(/\s+/gu, ' ')} `;
  if (ROLE_WORDS.some((word) => words.includes(` ${word} `))) return refuse('role');
  return { ok: true, name };
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Every stored name, as `{ address, name, setAt }`, in one pass over the store. */
export const listSessionNames = async (storage) => {
  const rows = [];
  for (let startAfter = ''; ;) {
    const page = await storage.list({ prefix: PREFIX, startAfter, limit: PAGE });
    for (const [key, value] of page) rows.push({ address: key.slice(PREFIX.length), name: value?.name, setAt: value?.setAt });
    if (page.size < PAGE) return rows;
    startAfter = [...page.keys()].at(-1);
  }
};

/** Whether a backup's names are each a stored name as set would store it, at most one per person. */
export const isSessionNamesBackup = (rows) => Array.isArray(rows) &&
  rows.every((row) => !!row && typeof row === 'object' && Object.keys(row).every((key) => ['address', 'name', 'setAt'].includes(key)) &&
    isNameHolder(row.address) && row.address === addressOf(row.address) && typeof row.name === 'string' &&
    normalizeSessionName(row.name).name === row.name && !!row.name &&
    typeof row.setAt === 'string' && !Number.isNaN(Date.parse(row.setAt))) &&
  new Set(rows.map((row) => row.address)).size === rows.length;

/** Puts a backup's names back. A name already on the target is the person's own later choice and stays. */
export const restoreSessionNames = async (storage, rows, journal = async () => {}) => {
  let written = 0;
  let skipped = 0;
  for (const { address, name, setAt } of rows) {
    const key = sessionNameKey(address);
    if (await storage.get(key) != null) { skipped += 1; continue; }
    await journal(key);
    await storage.put(key, { name, setAt });
    written += 1;
  }
  return { written, skipped };
};

export const dispatchSessionNamesStore = async (coordinator, operation, payload = {}) => {
  const storage = coordinator.state.storage;
  if (operation === 'list') {
    return json({ ok: true, names: Object.fromEntries((await listSessionNames(storage)).map((row) => [row.address, row.name])) });
  }
  const address = addressOf(payload.address);
  if (!isNameHolder(address)) return json({ ok: false, error: 'Sign in with an address to change this.' }, 400);
  if (operation === 'read') {
    const stored = await storage.get(sessionNameKey(address));
    return json({ ok: true, name: stored?.name || null, setAt: stored?.setAt || null });
  }
  if (operation === 'set') {
    const normalized = normalizeSessionName(payload.name);
    if (!normalized.ok) return json({ ok: false, reason: normalized.reason }, 400);
    if (!normalized.name) {
      await storage.delete(sessionNameKey(address));
      return json({ ok: true, name: null, setAt: null });
    }
    const record = { name: normalized.name, setAt: new Date(Number.isFinite(payload.now) ? payload.now : Date.now()).toISOString() };
    await storage.put(sessionNameKey(address), record);
    return json({ ok: true, ...record });
  }
  if (operation === 'clear') {
    await storage.delete(sessionNameKey(address));
    return json({ ok: true, cleared: true });
  }
  return json({ ok: false, error: 'Not found.' }, 404);
};

export const callSessionNamesStore = (env, slug, operation, payload = {}) =>
  callSessionConfigCoordinator({ env, slug, path: `session-names/${operation}`, ...payload });

export const NAMES_PATH = '/names';
export const OWN_NAME_PATH = '/names/me';
export const SET_NAME_PATH = '/names/set';

const UNAVAILABLE = { error: 'Names couldn’t be reached just now. Try again shortly.', reason: 'names_unavailable' };
const NAMES_OFF = { error: 'Names are off in this session', reason: 'names_off' };

// Only a session its Worker runs has names, and its admins may turn them off.
export const sessionNamesOn = (config) => config?.namesEnabled !== false && isWorkerCanonicalSessionConfig(config);

/** POST /names/set: the signed-in person's own name, or '' to remove it. */
export const setOwnSessionName = async ({ env, slug, config, body, address, checkRateLimit, now = Date.now, store = callSessionNamesStore }) => {
  if (!sessionNamesOn(config)) return { status: 403, body: NAMES_OFF };
  if (!isNameHolder(address)) return { status: 401, body: { error: 'Sign in to set your name.', reason: 'names_sign_in_required' } };
  const normalized = normalizeSessionName(body?.name);
  if (!normalized.ok) return { status: 400, body: { error: normalized.error, reason: normalized.reason } };
  const allowed = await checkRateLimit({ env, slug, address: addressOf(address), limit: SESSION_NAME_LIMITS.setsPerDay, route: 'names-set' });
  if (allowed === null) return { status: 503, body: { error: SESSION_COORDINATOR_UNAVAILABLE, reason: 'rate_limit_unavailable' } };
  if (!allowed) return { status: 429, body: { error: 'You’ve changed your name 10 times today. Try again tomorrow.', reason: 'rate_limited' } };
  const saved = await store(env, slug, 'set', { address: addressOf(address), name: normalized.name, now: now() });
  if (!saved.ok) return { status: 503, body: UNAVAILABLE };
  return { status: 200, body: { name: saved.body.name, setAt: saved.body.setAt } };
};

/**
 * GET /names and GET /names/me. Names show to people signed in whom the
 * session's own rule admits, as a read of its questions would; anyone else
 * gets an empty map, never an error, and sees addresses as before.
 */
export const readSessionNames = async ({ env, slug, config, path, address, sessionGate, store = callSessionNamesStore }) => {
  if (path === OWN_NAME_PATH) {
    if (!isNameHolder(address)) return { status: 401, body: { error: 'Sign in to see your name.', reason: 'names_sign_in_required' } };
    const own = await store(env, slug, 'read', { address: addressOf(address) });
    return own.ok ? { status: 200, body: { name: own.body.name, setAt: own.body.setAt } } : { status: 503, body: UNAVAILABLE };
  }
  if (!sessionNamesOn(config) || !isNameHolder(address)) return { status: 200, body: { names: {} } };
  const admitted = await sessionGate();
  if (admitted.unavailable) return { status: 503, body: UNAVAILABLE };
  if (!admitted.ok) return { status: 200, body: { names: {} } };
  const listed = await store(env, slug, 'list');
  return listed.ok ? { status: 200, body: { names: listed.body.names } } : { status: 503, body: UNAVAILABLE };
};
