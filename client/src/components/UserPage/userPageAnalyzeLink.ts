import { pageHeld } from '../../utilities/ui/leaveGuards';
import { withWorkerHintForSession } from '../../utilities/ui/currentWorkerHint';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';

// "Analyze me", in the account dialog, opens my own page in this session and starts Analyze there: the text
// analysis, and the picture card where the session has it. Analyze is paid for by the session, so only the press
// itself may start it: the press leaves a one-use note in this browser and the link carries a marker, and the
// page starts only where it finds both. A reload, a copied or shared link, or the Back button finds no note and
// starts nothing. The page opens inside the app, so what the app has loaded stays loaded.

export const ANALYZE_LINK_PARAM = 'analyze';
export const ANALYZE_LINK_NOTE_KEY = 'ce:analyzeLink';
export const ANALYZE_LINK_NOTE_MS = 120_000;
// Tells a profile page that is already on screen that the press has just put the marker on the address.
export const ANALYZE_LINK_EVENT = 'ce:analyze-link';

type AnalyzeLinkPage = {
  props: { viewAddress?: unknown };
  state: { aiAvailable?: unknown };
  getProfileSessionSlug: () => string;
};
type AnalyzeLinkTarget = { account: string; sessionSlug: string; marked: boolean };
type AnalyzeLinkLocation = { pathname: string; search: string };

/** The link the button opens, or '' where it is not offered: only where the page found AI it may use. */
export const buildAnalyzeLinkHref = (page: AnalyzeLinkPage, offered: boolean): string => {
  const address = String(page.props.viewAddress || '').trim();
  if (!offered || !address || page.state.aiAvailable !== true) return '';
  const sessionSlug = page.getProfileSessionSlug();
  const query = `?${sessionSlug ? `session=${encodeURIComponent(sessionSlug)}&` : ''}${ANALYZE_LINK_PARAM}=1`;
  return buildPublicRoute(withWorkerHintForSession(`/u/${address}${query}`, sessionSlug));
};

/** Whose page a profile link opens, in which session ('' for none), and whether it carries the marker. */
export const readAnalyzeLinkTarget = ({ pathname, search }: AnalyzeLinkLocation): AnalyzeLinkTarget | null => {
  const address = /\/u\/([^/?#]+)\/?$/.exec(pathname)?.[1];
  if (!address) return null;
  const params = new URLSearchParams(search);
  return {
    account: decodeURIComponent(address).trim().toLowerCase(),
    sessionSlug: String(params.get('session') || '').trim(),
    marked: params.get(ANALYZE_LINK_PARAM) === '1',
  };
};

// Answers typed for `account` in this tab and not yet sent. They are kept per tab and only edits are kept, so one
// stored answer is one unsent edit. An entry that cannot be read is skipped and reported; storage that cannot be
// read throws.
const readUnsentCount = (account: string, store: Storage, onUnreadable: () => void): number => {
  const owner = account.trim().toLowerCase();
  let count = 0;
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index) || '';
    if (!key.startsWith('dg:surveyDraft:') || key.split(':')[4] !== owner) continue;
    let answers: unknown;
    try {
      answers = (JSON.parse(store.getItem(key) || '{}') as { answers?: unknown })?.answers;
    } catch {
      onUnreadable();
      continue;
    }
    if (answers && typeof answers === 'object') count += Object.keys(answers).length;
  }
  return count;
};

/** Whether this tab holds unsent answers for `account`. Where any cannot be read the answer is yes: the page is
 * then left alone. */
export const hasUnsentAnswers = (account: string, store?: Storage): boolean => {
  let unreadable = false;
  try {
    // The tab's storage is read in here: a browser that denies storage throws on the read itself.
    return readUnsentCount(account, store ?? window.sessionStorage, () => (unreadable = true)) > 0 || unreadable;
  } catch {
    return true;
  }
};

/** How many unsent answers Disconnect would discard for `account` (see clearSurveyDraftsForAccount). Where storage
 * cannot be read, none: Disconnect cannot clear it either. */
export const countUnsentAnswers = (account: string, store?: Storage): number => {
  const owner = account.trim().toLowerCase();
  if (!owner || owner === 'anon') return 0;
  try {
    // As above: Disconnect must still sign out where the read of storage itself throws.
    return readUnsentCount(owner, store ?? window.sessionStorage, () => undefined);
  } catch {
    return 0;
  }
};

// A session's own page, whatever follows its name in the address.
const SESSION_PAGE = /\/session\/[^/?#]+/;

/**
 * The press: leaves the note, then opens my page inside the app, or only marks the address where my page in this
 * session is already open. Only a page that has this session loaded is swapped that way: the session's own page,
 * or a profile in it. From anywhere else the site navigates for real, which loads the session. Where this tab holds
 * unsent answers, a recording or an unsaved draft, the page is left alone and mine opens in a new tab; where the
 * browser refuses the tab, by a real navigation, which asks before anything is lost.
 */
export const openAnalyzeLink = (
  href: string,
  { now = Date.now(), win = window, held = pageHeld() }: { now?: number; win?: Window; held?: boolean } = {},
): 'in-app' | 'same-tab' | 'new-tab' | 'none' => {
  const url = new URL(href, win.location.href);
  const target = readAnalyzeLinkTarget(url);
  if (!target) return 'none';
  try {
    const note = { account: target.account, sessionSlug: target.sessionSlug, at: now };
    win.localStorage.setItem(ANALYZE_LINK_NOTE_KEY, JSON.stringify(note));
  } catch {
    // Without the note the page still opens; Analyze is then pressed there by hand.
  }
  const leave = (): 'same-tab' => {
    win.location.assign(url.href);
    return 'same-tab';
  };
  if (held || hasUnsentAnswers(target.account, win.sessionStorage)) return win.open(url.href) ? 'new-tab' : leave();
  if (url.origin !== win.location.origin) return leave();
  try {
    const here = readAnalyzeLinkTarget(win.location);
    const inSession = here ? here.sessionSlug === target.sessionSlug : SESSION_PAGE.test(win.location.pathname);
    if (!target.sessionSlug || !inSession) return leave();
    if (here?.account === target.account) {
      // Already on my page: the address keeps what it has (an open tab, say) and gains the marker.
      const params = new URLSearchParams(win.location.search);
      params.set(ANALYZE_LINK_PARAM, '1');
      win.history.replaceState(win.history.state, '', `${win.location.pathname}?${params}${win.location.hash}`);
    } else {
      win.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
      win.scrollTo(0, 0);
    }
  } catch {
    return leave();
  }
  win.dispatchEvent(new win.Event(ANALYZE_LINK_EVENT));
  return 'in-app';
};

/**
 * On arrival: the time until which Analyze may start by itself, or 0. The marker comes off the address and the
 * note is used up either way, so neither works twice.
 */
export const takeAnalyzeLinkArrival = ({
  now = Date.now(),
  win = window,
}: { now?: number; win?: Window } = {}): number => {
  const target = readAnalyzeLinkTarget(win.location);
  if (!target?.marked) return 0;
  const store = win.localStorage;
  let note: { account?: unknown; sessionSlug?: unknown; at?: unknown } | null = null;
  try {
    const params = new URLSearchParams(win.location.search);
    params.delete(ANALYZE_LINK_PARAM);
    const search = params.toString();
    const rest = `${search ? `?${search}` : ''}${win.location.hash || ''}`;
    win.history.replaceState(win.history.state, '', `${win.location.pathname}${rest}`);
    note = JSON.parse(store.getItem(ANALYZE_LINK_NOTE_KEY) || 'null');
    store.removeItem(ANALYZE_LINK_NOTE_KEY);
  } catch {
    return 0;
  }
  const at = Number(note?.at);
  const mine = note?.account === target.account && note?.sessionSlug === target.sessionSlug;
  return mine && now >= at && now - at <= ANALYZE_LINK_NOTE_MS ? at + ANALYZE_LINK_NOTE_MS : 0;
};
