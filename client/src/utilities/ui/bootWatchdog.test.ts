import fs from 'node:fs';
import path from 'node:path';

// The page's shell has an empty root and nothing else to see, so an app whose first script is blocked, gone, or
// fails before drawing left a blank page. public/boot-watchdog.js is a separate small script that says so.
const clientRoot = path.resolve(__dirname, '..', '..', '..');
const source = fs.readFileSync(path.join(clientRoot, 'public', 'boot-watchdog.js'), 'utf8');
const WAIT_MS = 12000;
const LONG_WAIT_MS = 45000;

const boot = () => {
  document.body.innerHTML =
    '<p id="ce-agent-note">For AI agents.</p>' +
    '<div id="ce-boot-loading"><span>Loading…</span><progress max="1" value="0"></progress><span id="ce-boot-loading-note"></span></div>' +
    '<div id="root"></div><script type="module" id="entry"></script><img id="picture" />';
  // The script runs as the browser would run it: once, against this document.
  new Function(source)();
  window.dispatchEvent(new Event('load'));
};
const notice = () => document.getElementById('ce-boot-notice');
const draw = async () => {
  document.getElementById('root')!.append(document.createElement('main'));
  // Mutation observers report in a microtask.
  await Promise.resolve();
};

describe('the blank-page message', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows a message and a Reload button when nothing was drawn some seconds after the page loaded', () => {
    boot();
    jest.advanceTimersByTime(WAIT_MS - 1);
    expect(notice()).toBeNull();
    jest.advanceTimersByTime(1);
    expect(notice()?.getAttribute('role')).toBe('alert');
    expect(notice()?.textContent).toContain('This page did not load.');
    expect(notice()?.querySelector('button')?.textContent).toBe('Reload');
    // Outside the app's root, which the app may still fill.
    expect(document.getElementById('root')!.childElementCount).toBe(0);
    // The note for AI agents, which the app would have removed, is not left beside it for people.
    expect(document.getElementById('ce-agent-note')).toBeNull();
  });

  it('waits much longer once the app has started, so a slow connection is not told the page failed', () => {
    boot();
    // The app's first script ran: it removes the note. The rest of the app is still arriving.
    document.getElementById('ce-agent-note')!.remove();
    jest.advanceTimersByTime(LONG_WAIT_MS - 1);
    expect(notice()).toBeNull();
    jest.advanceTimersByTime(1);
    expect(notice()).not.toBeNull();
  });

  it('reports a page whose load never finishes, after the long wait', () => {
    document.body.innerHTML = '<p id="ce-agent-note">For AI agents.</p><div id="root"></div>';
    // Still loading, and no load event ever comes: a part of the page never arrived.
    const state = jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    try {
      new Function(source)();
      jest.advanceTimersByTime(LONG_WAIT_MS - 1);
      expect(notice()).toBeNull();
      jest.advanceTimersByTime(1);
      expect(notice()).not.toBeNull();
    } finally {
      state.mockRestore();
    }
  });

  it('reloads even when the request for a fresh page never answers', () => {
    const fetched = jest.fn((_url: string, _init: RequestInit) => new Promise<Response>(() => undefined));
    (window as unknown as { fetch: unknown }).fetch = fetched;
    boot();
    jest.advanceTimersByTime(WAIT_MS);
    const timers = jest.getTimerCount();
    notice()!.querySelector('button')!.click();
    // A three-second fallback is waiting to reload.
    expect(jest.getTimerCount()).toBe(timers + 1);
  });

  it('never shows over an app that drew, and goes when the app draws late', async () => {
    boot();
    await draw();
    jest.advanceTimersByTime(WAIT_MS * 2);
    expect(notice()).toBeNull();

    document.body.innerHTML = '';
    boot();
    jest.advanceTimersByTime(WAIT_MS);
    expect(notice()).not.toBeNull();
    await draw();
    expect(notice()).toBeNull();
  });

  it('still reports a root that holds only what the app puts there before drawing, and goes when it draws', async () => {
    boot();
    document.getElementById('ce-agent-note')!.remove();
    // The app's first script ran and put its empty toast host and loading line in the root; the main part of the
    // app never arrived. That was a white page with no message.
    const root = document.getElementById('root')!;
    for (const tag of ['div', 'p']) {
      const part = document.createElement(tag);
      part.setAttribute('data-ce-boot-ignore', '');
      root.append(part);
    }
    await Promise.resolve();
    jest.advanceTimersByTime(LONG_WAIT_MS);
    expect(notice()).not.toBeNull();
    await draw();
    expect(notice()).toBeNull();
  });

  it('marks the toast host, which the app puts in its root before drawing, and shows nothing else there', () => {
    const read = (file: string) => fs.readFileSync(path.join(clientRoot, 'src', 'components', file), 'utf8');
    expect(read('Shared/CEToaster.tsx')).toMatch(/data-testid="ce-toast-host" data-ce-boot-ignore=""/);
    // The loading line is the page shell's, outside the root, so the app adds none of its own.
    const app = read('App.tsx');
    expect(app).toContain('<Suspense fallback={null}>');
    expect(app).not.toContain('data-ce-boot-ignore');
  });

  it('never reloads the page by itself: a slow load that is still arriving is not thrown away', () => {
    const fetched = jest.fn((_url: string, _init: RequestInit) => new Promise<Response>(() => undefined));
    (window as unknown as { fetch: unknown }).fetch = fetched;
    boot();
    jest.advanceTimersByTime(LONG_WAIT_MS * 2);
    expect(notice()).not.toBeNull();
    expect(fetched).not.toHaveBeenCalled();
  });

  it('fills the loading bar by the size of the files that have arrived, and says when the load is slow', () => {
    boot();
    const entry = document.getElementById('entry') as HTMLScriptElement;
    entry.src = 'http://localhost/assets/index-1.js';
    entry.setAttribute('data-ce-bytes', '100');
    const link = document.createElement('link');
    link.href = 'http://localhost/assets/AppShell-1.js';
    link.setAttribute('data-ce-bytes', '300');
    document.head.append(link);
    const entries = [
      { name: entry.src, responseEnd: 10 },
      { name: link.href, responseEnd: 0 },
    ];
    (performance as unknown as { getEntriesByType: unknown }).getEntriesByType = () => entries;
    try {
      const bar = document.querySelector('#ce-boot-loading progress') as HTMLProgressElement;
      jest.advanceTimersByTime(300);
      expect([bar.value, bar.max]).toEqual([100, 400]);
      entries[1].responseEnd = 20;
      jest.advanceTimersByTime(300);
      expect(bar.value).toBe(400);
      expect(document.getElementById('ce-boot-loading-note')!.textContent).toBe('');
      jest.advanceTimersByTime(15000);
      expect(document.getElementById('ce-boot-loading-note')!.textContent).toMatch(/taking longer than usual/);
    } finally {
      link.remove();
      delete (performance as unknown as { getEntriesByType?: unknown }).getEntriesByType;
    }
  });

  it("takes the shell's own blocked-files sentence away as soon as it runs, since it reports failures itself", () => {
    document.body.innerHTML =
      '<div id="ce-boot-loading"><p id="ce-boot-blocked">This page is not loading.</p></div><div id="root"></div>';
    new Function(source)();
    expect(document.getElementById('ce-boot-blocked')).toBeNull();
    expect(document.getElementById('ce-boot-loading')).not.toBeNull();
  });

  it('takes the loading line away once the app draws', async () => {
    boot();
    expect(document.getElementById('ce-boot-loading')).not.toBeNull();
    await draw();
    expect(document.getElementById('ce-boot-loading')).toBeNull();
  });

  it("reports the app's first script failing to load at once, and no other failed file", () => {
    boot();
    document.getElementById('picture')!.dispatchEvent(new Event('error'));
    expect(notice()).toBeNull();
    document.getElementById('entry')!.dispatchEvent(new Event('error'));
    expect(notice()).not.toBeNull();
    // Once only.
    document.getElementById('entry')!.dispatchEvent(new Event('error'));
    expect(document.querySelectorAll('#ce-boot-notice')).toHaveLength(1);
  });

  it('asks for the page afresh before reloading, so a copy kept from before a release is not what returns', async () => {
    const fetched = jest.fn(async (_url: string, _init: RequestInit) => new Response(''));
    (window as unknown as { fetch: unknown }).fetch = fetched;
    boot();
    jest.advanceTimersByTime(WAIT_MS);
    // jsdom cannot reload; the request is what can be seen here.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    notice()!.querySelector('button')!.click();
    expect(fetched).toHaveBeenCalledWith(window.location.href, { cache: 'reload', credentials: 'same-origin' });
  });

  it('is loaded by the page shell as its own file, before the app', () => {
    const html = fs.readFileSync(path.join(clientRoot, 'index.html'), 'utf8');
    const at = html.indexOf('<script src="__PUBLIC_URL__/boot-watchdog.js"></script>');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(html.indexOf('/src/viteEntry.ts'));
    // The content policy allows no inline script, and the app's bundle may be what failed.
    expect(source).not.toMatch(/import |require\(/);
    expect(html).toContain('<noscript>');
    // The loading line is in the shell itself, before the root, and hidden where no script will ever remove it.
    expect(html).toContain('<div id="ce-boot-loading" role="status" style="visibility: hidden">');
    // Its style is in the shell too, not the stylesheet: a filter that replaces the site's files leaves only
    // this HTML, and the line and its last sentence must still come up by themselves.
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    expect(style).toMatch(/#ce-boot-loading \{[^}]*animation: ce-boot-show 0s linear 1s forwards;/);
    expect(style).toMatch(/#ce-boot-blocked \{[^}]*animation: ce-boot-show 0s linear 20s forwards;/);
    expect(style).toMatch(/@keyframes ce-boot-show \{\s*to \{\s*visibility: visible;/);
    // The sentence is written by the style, so a script-less AI reader of the page's text is not told it failed.
    expect(html).toContain('<p id="ce-boot-blocked" style="visibility: hidden"></p>');
    expect(style).toMatch(/#ce-boot-blocked::after \{\s*content: "This page is not loading\. A security tool/);
    expect(html.split('</head>')[1]).not.toContain('This page is not loading');
    const sheet = fs.readFileSync(path.join(clientRoot, 'src', 'assets', 'css', 'contextEngine.scss'), 'utf8');
    expect(sheet).not.toContain('ce-boot-');
    expect(html.indexOf('id="ce-boot-loading"')).toBeLessThan(html.indexOf('<div id="root">'));
    expect(html).toContain('<noscript><style>#ce-boot-loading { display: none; }</style></noscript>');
    expect(html).toContain('id="ce-agent-note"');
  });
});
