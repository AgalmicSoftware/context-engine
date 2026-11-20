import {
  ANALYZE_LINK_NOTE_KEY,
  ANALYZE_LINK_NOTE_MS,
  buildAnalyzeLinkHref,
  countUnsentAnswers,
  hasUnsentAnswers,
  openAnalyzeLink,
  readAnalyzeLinkTarget,
  takeAnalyzeLinkArrival,
} from './userPageAnalyzeLink';

const ME = '0x00000000000000000000000000000000000000aa';
const HREF = `/u/${ME}?session=demo-one&analyze=1`;

const memoryStore = (entries: Record<string, string> = {}): Storage => {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
};

const fakeWindow = (href: string, { session = memoryStore(), local = memoryStore(), opens = true } = {}) => {
  const url = new URL(href, 'https://site.example.test/s/demo-one');
  const win = {
    location: { href: url.href, pathname: url.pathname, search: url.search, hash: url.hash, assign: jest.fn() },
    history: {
      state: { kept: true },
      replaceState: jest.fn((_state: unknown, _title: string, next: string) => {
        const moved = new URL(next, url.href);
        win.location.pathname = moved.pathname;
        win.location.search = moved.search;
      }),
    },
    localStorage: local,
    sessionStorage: session,
    open: jest.fn((_url?: string) => (opens ? {} : null)),
  };
  return win;
};
const asWindow = (win: ReturnType<typeof fakeWindow>) => win as unknown as Window;

const page = (aiAvailable: boolean | null, slug = 'demo-one') => ({
  props: { viewAddress: ME },
  state: { aiAvailable },
  getProfileSessionSlug: () => slug,
});

// A browser that denies storage throws when the page so much as reads window.sessionStorage.
const denyStorage = () => {
  const held = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
  return () => {
    if (held) Object.defineProperty(window, 'sessionStorage', held);
    else Reflect.deleteProperty(window, 'sessionStorage');
  };
};

describe('Analyze user, from the account dialog', () => {
  it('offers the link only where the page found AI it may use', () => {
    expect(buildAnalyzeLinkHref(page(true), true)).toBe(HREF);
    expect(buildAnalyzeLinkHref(page(true), false)).toBe('');
    expect(buildAnalyzeLinkHref(page(false), true)).toBe('');
    expect(buildAnalyzeLinkHref(page(null), true)).toBe('');
    expect(buildAnalyzeLinkHref(page(true, ''), true)).toBe(`/u/${ME}?analyze=1`);
  });

  it('reads whose page and which session a profile link opens', () => {
    expect(readAnalyzeLinkTarget({ pathname: `/base/u/${ME.toUpperCase()}`, search: '?session=demo-one' })).toEqual({
      account: ME,
      sessionSlug: 'demo-one',
      marked: false,
    });
    expect(readAnalyzeLinkTarget({ pathname: `/u/${ME}`, search: '?analyze=1' })).toEqual({
      account: ME,
      sessionSlug: '',
      marked: true,
    });
    expect(readAnalyzeLinkTarget({ pathname: '/s/demo-one', search: '?session=demo-one&analyze=1' })).toBeNull();
  });

  it('counts only my own unsent answers in this tab', () => {
    const draft = (answers: unknown) => JSON.stringify({ meta: {}, answers, baseline: { q1: { value: 'sent' } } });
    const key = (owner: string) => `dg:surveyDraft:demo-one:worker:${owner}:questions`;
    expect(hasUnsentAnswers(ME, memoryStore())).toBe(false);
    expect(hasUnsentAnswers(ME, memoryStore({ [key(ME)]: draft({}) }))).toBe(false);
    expect(hasUnsentAnswers(ME, memoryStore({ [key('0xbb')]: draft({ q1: { value: 'x' } }) }))).toBe(false);
    expect(hasUnsentAnswers(ME.toUpperCase(), memoryStore({ [key(ME)]: draft({ q1: { value: 'x' } }) }))).toBe(true);
    expect(hasUnsentAnswers(ME, memoryStore({ [key(ME)]: '{not json' }))).toBe(true);
  });

  it('counts the unsent answers Disconnect would discard, and none where storage cannot be read', () => {
    const draft = (answers: unknown) => JSON.stringify({ meta: {}, answers });
    const key = (owner: string, scope = 'questions') => `dg:surveyDraft:demo-one:worker:${owner}:${scope}`;
    const both = memoryStore({
      [key(ME)]: draft({ q1: { value: 'x' }, q2: { value: 'y' } }),
      [key(ME, 'survey-7')]: draft({ s1: { value: 'z' } }),
      [key('0xbb')]: draft({ q1: { value: 'x' } }),
    });
    expect(countUnsentAnswers(ME.toUpperCase(), both)).toBe(3);
    expect(countUnsentAnswers(ME, memoryStore())).toBe(0);
    expect(countUnsentAnswers('', both)).toBe(0);
    expect(countUnsentAnswers(ME, memoryStore({ [key(ME)]: '{not json' }))).toBe(0);
    // One entry that cannot be read leaves the rest counted.
    expect(
      countUnsentAnswers(ME, memoryStore({ [key(ME)]: '{not json', [key(ME, 'survey-7')]: draft({ s1: 1 }) })),
    ).toBe(1);
  });

  it('answers safely where the browser denies storage, rather than throwing', () => {
    const allow = denyStorage();
    try {
      expect(() => window.sessionStorage).toThrow();
      expect(countUnsentAnswers(ME)).toBe(0);
      expect(hasUnsentAnswers(ME)).toBe(true);
    } finally {
      allow();
    }
    expect(window.sessionStorage.length).toBeGreaterThanOrEqual(0);
  });

  it('opens my page in this tab, and in a new one where answers are unsent', () => {
    const plain = fakeWindow('/s/demo-one');
    expect(openAnalyzeLink(HREF, { now: 1000, win: asWindow(plain) })).toBe('same-tab');
    expect(plain.location.assign).toHaveBeenCalledWith(`https://site.example.test${HREF}`);
    expect(plain.open).not.toHaveBeenCalled();
    expect(JSON.parse(plain.localStorage.getItem(ANALYZE_LINK_NOTE_KEY) || '')).toEqual({
      account: ME,
      sessionSlug: 'demo-one',
      at: 1000,
    });

    const unsent = { [`dg:surveyDraft:demo-one:worker:${ME}:questions`]: '{"answers":{"q1":{"value":"x"}}}' };
    const busy = fakeWindow('/s/demo-one', { session: memoryStore(unsent) });
    expect(openAnalyzeLink(HREF, { win: asWindow(busy) })).toBe('new-tab');
    expect(busy.open).toHaveBeenCalledWith(`https://site.example.test${HREF}`);
    expect(busy.location.assign).not.toHaveBeenCalled();

    // A blocked new tab falls back to this one: unsent answers are kept per tab and come back.
    const blocked = fakeWindow('/s/demo-one', { session: memoryStore(unsent), opens: false });
    expect(openAnalyzeLink(HREF, { win: asWindow(blocked) })).toBe('same-tab');
    expect(blocked.location.assign).toHaveBeenCalled();

    const nowhere = fakeWindow('/s/demo-one');
    expect(openAnalyzeLink('/s/demo-one', { win: asWindow(nowhere) })).toBe('none');
    expect(nowhere.localStorage.getItem(ANALYZE_LINK_NOTE_KEY)).toBeNull();
  });

  describe('arrival', () => {
    const note = (over: Record<string, unknown> = {}) =>
      memoryStore({
        [ANALYZE_LINK_NOTE_KEY]: JSON.stringify({ account: ME, sessionSlug: 'demo-one', at: 1000, ...over }),
      });

    it('starts once: the marker comes off the address and the note is used up', () => {
      const win = fakeWindow(`${HREF}&worker=w1#answers`, { local: note() });
      expect(takeAnalyzeLinkArrival({ now: 5000, win: asWindow(win) })).toBe(1000 + ANALYZE_LINK_NOTE_MS);
      const rest = `/u/${ME}?session=demo-one&worker=w1#answers`;
      expect(win.history.replaceState).toHaveBeenCalledWith({ kept: true }, '', rest);
      expect(win.localStorage.getItem(ANALYZE_LINK_NOTE_KEY)).toBeNull();
      // A reload: no marker, no note.
      expect(takeAnalyzeLinkArrival({ now: 6000, win: asWindow(win) })).toBe(0);
    });

    it('starts nothing from a link alone, as a shared or copied link is', () => {
      const win = fakeWindow(HREF);
      expect(takeAnalyzeLinkArrival({ now: 5000, win: asWindow(win) })).toBe(0);
      expect(win.location.search).toBe('?session=demo-one');
    });

    it('leaves the note alone on a page without the marker', () => {
      const win = fakeWindow(`/u/${ME}?session=demo-one`, { local: note() });
      expect(takeAnalyzeLinkArrival({ now: 5000, win: asWindow(win) })).toBe(0);
      expect(win.localStorage.getItem(ANALYZE_LINK_NOTE_KEY)).not.toBeNull();
      expect(win.history.replaceState).not.toHaveBeenCalled();
    });

    it.each([
      ['an old note', { at: 1000 }, 1000 + ANALYZE_LINK_NOTE_MS + 1],
      ['a note from the future', { at: 9000 }, 5000],
      ['a note for another account', { account: '0xbb' }, 5000],
      ['a note for another session', { sessionSlug: 'demo-two' }, 5000],
      ['a note with no time', { at: 'soon' }, 5000],
    ])('starts nothing from %s, and uses it up', (_name, over, now) => {
      const win = fakeWindow(HREF, { local: note(over) });
      expect(takeAnalyzeLinkArrival({ now, win: asWindow(win) })).toBe(0);
      expect(win.localStorage.getItem(ANALYZE_LINK_NOTE_KEY)).toBeNull();
    });
  });
});
