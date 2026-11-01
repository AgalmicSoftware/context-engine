import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4185';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-recording-recovery';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
// The recorder shows no chunk rows unless an export or device storage fails, so chunk states come from the store.
const snapshot = page => page.evaluate(async () => {
  const { listRecordingChunks } = await import('/src/utilities/audio/recordingChunkStore.ts');
  return (await listRecordingChunks(JSON.stringify(['https://worker.example', 'recovery', ''])))
    .filter(record => record.segment.index >= 0).sort((a, b) => a.segment.index - b.segment.index)
    .map(record => ({ id: record.segment.id, status: record.segment.status, size: record.audio?.size, text: record.segment.text }));
});
// Polled from here: waitForFunction takes the promise an async predicate returns as true at once.
const until = async (page, label, check) => {
  for (const started = Date.now(); Date.now() - started < 30000; await new Promise(resolve => setTimeout(resolve, 200)))
    if (check(await snapshot(page))) return;
  assert.fail(`${label}: ${JSON.stringify(await snapshot(page))}`);
};
const chunkIs = (page, index, status) => until(page, `Chunk ${index + 1} ${status}`, chunks => chunks[index]?.status === status);
try {
  for (const theme of ['civic', 'context-engine']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 900 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const track = new EventTarget(); track.label = 'Synthetic microphone'; track.stop = () => {};
      const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
      window.__track = track;
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => stream } });
      window.MediaRecorder = class {
        static isTypeSupported() { return true; }
        state = 'inactive'; mimeType = 'audio/webm';
        constructor() { window.__recorder = this; }
        start(timeslice) { window.__timeslice = timeslice; this.state = 'recording'; }
        pause() { this.state = 'paused'; }
        resume() { this.state = 'recording'; }
        requestData() { this.ondataavailable?.({ data: new Blob([new Uint8Array(256).fill(55)], { type: this.mimeType }) }); }
        stop() { this.state = 'inactive'; this.requestData(); this.onstop?.(); }
      };
    });
    let failure = 'twice', attempts = 0;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === 'https://worker.example') {
        attempts++;
        if (failure === 'always' || (failure === 'twice' && attempts <= 2)) return route.fulfill({ status: failure === 'always' ? 400 : 503, json: { error: 'Synthetic upload interruption' } });
        return route.fulfill({ json: { text: 'Recovered room transcript.' } });
      }
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === '/recovery-probe') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="padding:16px;margin:0;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/assets/css/contextEngine.scss');
        const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
        const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { default: Panel } = await import('/src/components/SurveyTool/SessionListeningPanel.tsx');
        function Probe() {
          const [open, setOpen] = React.useState(true);
          const [account, setAccount] = React.useState('');
          window.__signIn = () => setAccount('0x1111111111111111111111111111111111111111');
          return open ? React.createElement(Panel, { sessionSlug: 'recovery', workerUrl: 'https://worker.example', context: { account }, onClose: () => setOpen(false) })
            : React.createElement('button', { onClick: () => setOpen(true) }, 'Reopen recording');
        }
        (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Probe));
      </script></body></html>` });
      return route.continue();
    });
    await page.goto(`${base}/recovery-probe`);
    await page.getByTestId('ce-session-listening-start').click();
    await page.getByRole('button', { name: 'Stop recording' }).waitFor();
    assert.equal(await page.evaluate(() => window.__timeslice), 1000);
    await page.evaluate(() => window.__recorder.requestData());
    await until(page, 'Partial capture saved', chunks => chunks[0]?.size === 256);
    assert.equal(attempts, 0, 'Partial capture is saved without uploading a dependent fragment');
    await page.evaluate(() => window.__signIn());
    assert.equal(await page.getByRole('button', { name: 'Stop recording' }).isVisible(), true, 'Sign-in leaves capture running');
    await page.reload();
    await chunkIs(page, 0, 'complete');
    assert.equal(attempts, 3, 'Reloaded raw audio retries twice before succeeding');
    assert.deepEqual((await snapshot(page)).map(record => [record.status, record.size, record.text]), [['complete', undefined, 'Recovered room transcript.']]);
    assert.equal(await page.evaluate(() => window.__recorder), undefined, 'Recovery does not acquire the microphone');

    failure = 'always'; attempts = 0;
    const gap = page.getByRole('status').filter({ hasText: "Some audio couldn't be transcribed." });
    await page.getByTestId('ce-session-listening-start').click();
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await chunkIs(page, 1, 'failed');
    await gap.waitFor();
    assert.equal(attempts, 1);
    await page.getByRole('button', { name: 'Close and keep the audio' }).click();
    await page.getByRole('button', { name: 'Reopen recording' }).click();
    await gap.waitFor();
    assert.equal((await snapshot(page))[1].status, 'failed');
    assert.equal(attempts, 1, 'Reopening preserves a permanent failure until explicitly retried');
    // The fake audio can't be decoded, so the MP3 export fails and offers the original file instead.
    await page.getByRole('button', { name: 'Download audio' }).click();
    await page.getByRole('alert').filter({ hasText: 'Some audio could not be decoded.' }).waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download chunk 2' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'recording-chunk-2.webm');
    const file = path.join(output, `${theme}-${download.suggestedFilename()}`);
    await download.saveAs(file);
    assert.deepEqual(await fs.readFile(file), Buffer.alloc(256, 55), 'Download contains the retained audio bytes');
    assert.equal((await snapshot(page))[1].size, 256, 'Download keeps the recovery copy');
    await assertReadable(page.getByTestId('ce-recording-chunks'));
    await page.getByTestId('ce-recording-chunks').screenshot({ path: path.join(output, `${theme}-failed.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    failure = 'never';
    await page.getByRole('button', { name: 'Retry transcription' }).click();
    await chunkIs(page, 1, 'complete');
    assert.equal((await snapshot(page))[1].size, undefined, 'The transcript replaces the audio');

    await page.evaluate(() => {
      window.__originalIdbPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'chunks') throw new DOMException('Synthetic full storage', 'QuotaExceededError');
        return window.__originalIdbPut.apply(this, args);
      };
    });
    await page.getByTestId('ce-session-listening-start').click();
    await page.getByRole('button', { name: 'Stop recording' }).waitFor();
    await page.evaluate(() => window.__recorder.requestData());
    const unsaved = page.getByRole('alert').filter({ hasText: "This recording can't be recovered after a reload" });
    await unsaved.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Stop recording' }).isVisible(), true);
    assert.equal(await page.getByRole('button', { name: 'Download chunk 3' }).isVisible(), true, 'Audio only memory holds stays downloadable during capture');
    await page.getByRole('button', { name: 'Stop recording' }).click();
    // Once transcribed, the page keeps only the transcript, so the audio is no longer offered.
    await page.getByRole('button', { name: 'Download chunk 3' }).waitFor({ state: 'detached', timeout: 30000 });
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__originalIdbPut; });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await chunkIs(page, 2, 'complete');
    await unsaved.waitFor({ state: 'detached' });

    await page.context().setOffline(true);
    await page.getByTestId('ce-session-listening-start').click();
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await page.getByRole('alert').filter({ hasText: 'Offline' }).waitFor();
    await page.context().setOffline(false);
    await chunkIs(page, 3, 'complete');

    await page.getByTestId('ce-session-listening-start').click();
    await page.getByRole('button', { name: 'Stop recording' }).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByText(/Recording page is hidden/).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      window.__track.dispatchEvent(new Event('ended'));
    });
    await page.getByRole('alert').filter({ hasText: 'Microphone access ended' }).waitFor();
    await page.getByText(/The page was hidden .*recording may have paused/).waitFor();
    await page.getByRole('button', { name: 'Dismiss hidden-page notice' }).click();
    assert.equal(await page.getByText(/The page was hidden/).count(), 0);
    await chunkIs(page, 4, 'complete');
    assert.deepEqual(errors, []);
    console.log(`PASS ${theme}: native IndexedDB partial recovery, ordered automatic retries, exact audio download, manual retry, raw deletion after transcript, quota/offline/microphone/visibility recovery`);
    await page.close();
  }
} finally { await browser.close(); }
