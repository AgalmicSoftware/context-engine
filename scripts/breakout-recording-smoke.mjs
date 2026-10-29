import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const luminance = css => {
  const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map(value => {
    const channel = css.startsWith('color(srgb') ? Number(value) : Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const readable = async locator => {
  const colors = await locator.evaluate(element => ({ text: getComputedStyle(element).color, background: getComputedStyle(document.body).backgroundColor }));
  const a = luminance(colors.text); const b = luminance(colors.background);
  assert((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `Readable recording text: ${JSON.stringify(colors)}`);
};
const base = process.env.BASE_URL || 'http://127.0.0.1:3186';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-rxc-recording';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['civic', 'context-engine']) for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => console.error(error.message));
    await page.addInitScript(() => {
      const track = { label: 'Built-in microphone', stop() {} };
      const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async constraints => { window.__captureConstraints = constraints; return stream; } } });
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
        const sentinel = new EventTarget(); sentinel.released = false;
        sentinel.release = async () => { sentinel.released = true; window.__wakeHeld = false; sentinel.dispatchEvent(new Event('release')); };
        window.__wakeHeld = true; window.__wakeSentinel = sentinel; return sentinel;
      } } });
      window.MediaRecorder = class {
        static isTypeSupported() { return true; }
        state = 'inactive';
        start() { this.state = 'recording'; }
        pause() { this.state = 'paused'; }
        resume() { this.state = 'recording'; }
        stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(256)], { type: 'audio/webm' }) }); this.onstop?.(); }
      };
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === 'https://worker.example') return route.fulfill({ json: { text: 'Synthetic room transcript.', segments: [{ speaker: 'A', start: 0, end: 1, text: 'Synthetic room transcript.' }] } });
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === '/recording-probe') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="padding:16px;margin:0;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/assets/css/contextEngine.scss');
        const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
        const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { default: Panel } = await import('/src/components/SurveyTool/SessionListeningPanel.tsx');
        (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Panel, { sessionSlug: 'workshop', workerUrl: 'https://worker.example', panelMode: 'recordGroup', embeddedInModal: true }));
      </script></body></html>` });
      return route.continue();
    });
    await page.goto(`${base}/recording-probe`);
    const speaker = page.getByRole('checkbox', { name: 'Record speaker audio' });
    await speaker.waitFor();
    assert.equal(await speaker.isChecked(), false);
    await speaker.check();
    const labels = page.getByRole('checkbox', { name: 'Label speakers' });
    assert.equal(await labels.isChecked(), false);
    await labels.check();
    await readable(speaker.locator('..'));
    await page.getByTestId('ce-session-listening-panel').screenshot({ path: path.join(output, `setup-${theme}-${width}.png`) });
    await page.getByTestId('ce-session-listening-start').click();
    await page.getByRole('button', { name: 'Stop recording' }).waitFor();
    assert.equal(await page.evaluate(() => window.__captureConstraints.audio.echoCancellation), false);
    await page.waitForFunction(() => window.__wakeHeld === true);
    assert.equal(await speaker.isDisabled(), true);
    assert.equal(await labels.isDisabled(), true);
    await page.evaluate(() => window.__wakeSentinel.release());
    await page.getByText('Keep this screen on.').waitFor();
    await readable(page.getByText('Keep this screen on.'));
    await page.getByTestId('ce-session-listening-panel').screenshot({ path: path.join(output, `recording-${theme}-${width}.png`) });
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await speaker.waitFor({ state: 'visible' });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ce:listening-draft:workshop') || '{}').segments?.[0]?.speakerTurns?.[0]?.speaker === 'A');
    assert.equal(await page.evaluate(() => window.__wakeHeld), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    console.log(`PASS Breakout recording ${theme} ${width}`);
    await page.close();
  }
} finally { await browser.close(); }
