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
    '<p id="ce-agent-note">For AI agents.</p><div id="root"></div><script type="module" id="entry"></script><img id="picture" />';
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
    expect(html).toContain('id="ce-agent-note"');
  });
});
