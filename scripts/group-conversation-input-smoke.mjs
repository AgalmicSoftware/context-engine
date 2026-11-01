// Synthetic browser coverage: no microphone access, paid requests, or live session writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';
const require = createRequire(import.meta.url);
const { E2E_TESTIDS: ids } = require('../client/src/utilities/e2eTestIds.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:7391';
const output = process.env.OUTPUT_DIR || '/tmp/ce-group-input';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
await fs.mkdir(output, { recursive: true });
// The task's Vite server may use a private cache directory rather than node_modules/.vite.
const [panelSource, entrySource] = await Promise.all([
  fetch(`${base}/src/components/SurveyTool/SessionListeningPanel.tsx`).then((response) => response.text()),
  fetch(`${base}/src/index.tsx`).then((response) => response.text()),
]);
const reactUrl = panelSource.match(/from "([^"]*\/deps\/react\.js[^\"]*)"/)?.[1];
const reactDomUrl = entrySource.match(/from "([^"]*\/deps\/react-dom_client\.js[^\"]*)"/)?.[1];
assert(reactUrl && reactDomUrl, 'Vite must serve optimized React dependencies');
const { Mp3Encoder } = await import('../client/node_modules/@breezystack/lamejs/dist/lamejs.js');
const tone = (hz, sampleRate = 44100) => {
  const pcm = new Int16Array(Math.round(sampleRate * 0.6));
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin((i * 2 * Math.PI * hz) / sampleRate) * 12000;
  return pcm;
};
const encoder = new Mp3Encoder(1, 44100, 128);
const firstAudio = Buffer.concat([Buffer.from(encoder.encodeBuffer(tone(440))), Buffer.from(encoder.flush())]);
const secondPcm = tone(880, 16000);
const wavHeader = Buffer.alloc(44);
wavHeader.write('RIFF');
wavHeader.writeUInt32LE(36 + secondPcm.byteLength, 4);
wavHeader.write('WAVEfmt ', 8);
wavHeader.writeUInt32LE(16, 16);
wavHeader.writeUInt16LE(1, 20);
wavHeader.writeUInt16LE(1, 22);
wavHeader.writeUInt32LE(16000, 24);
wavHeader.writeUInt32LE(32000, 28);
wavHeader.writeUInt16LE(2, 32);
wavHeader.writeUInt16LE(16, 34);
wavHeader.write('data', 36);
wavHeader.writeUInt32LE(secondPcm.byteLength, 40);
const secondAudio = Buffer.concat([wavHeader, Buffer.from(secondPcm.buffer)]);
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['civic', 'context-engine'])
    for (const width of [375, 1280]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        acceptDownloads: true,
      });
      const errors = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
        console.error(error.message);
      });
      await page.addInitScript(() => {
        window.__microphoneRequests = 0;
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: async () => {
              window.__microphoneRequests++;
              throw new Error('No microphone requested in this test.');
            },
          },
        });
      });
      let fail = true,
        requests = 0;
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === 'https://worker.example') {
          requests++;
          return fail
            ? route.fulfill({
                status: 403,
                json: {
                  error: 'Anonymous access denied: transcribe is not enabled in workerAuthority.anonymousScopes.',
                },
              })
            : route.fulfill({ json: { text: 'Recovered audio.' } });
        }
        if (url.origin !== new URL(base).origin) return route.abort();
        if (url.pathname === '/src/components/SurveyTool/sessionListeningQuestions.ts')
          return route.fulfill({
            contentType: 'application/javascript',
            body: `
          export const LISTENING_QUESTION_COUNT = 5;
          export async function generateQuestionsFromListeningTranscript() {
            return { surveyTitle: '', statements: [
              { id: 'draft-a', type: 'freeform', prompt: 'What should the group try first?', tags: [] },
              { id: 'draft-b', type: 'multichoice', prompt: 'Which option should be tested?', options: ['Pilot', 'Workshop'], tags: [] }
            ], raw: { questions: [] } };
          }`,
          });
        if (url.pathname === '/input-probe')
          return route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="padding:16px;margin:0;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/assets/css/contextEngine.scss');
        const ReactModule = await import(${JSON.stringify(reactUrl)}); const React = ReactModule.default || ReactModule;
        const ReactDOM = await import(${JSON.stringify(reactDomUrl)});
        const { default: Modal } = await import('/src/components/SurveyTool/SessionVoiceModeModal.tsx');
        function Probe() { const [open, setOpen] = React.useState(true); return React.createElement(React.Fragment, null,
          React.createElement('button', { onClick: () => setOpen(true) }, 'Reopen recording'),
          React.createElement(Modal, { isOpen: open, mode: 'recordGroup', onClose: () => setOpen(false), onSelectMode: () => {}, sessionSlug: 'input-smoke', workerUrl: 'https://worker.example' })); }
        (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Probe));
      </script></body></html>`,
          });
        return route.continue();
      });
      await page.goto(`${base}/input-probe`);
      const panel = page.getByTestId(ids.SESSION_LISTENING_PANEL);
      await panel.waitFor();
      const recorderHelp = page.getByRole('button', { name: 'About Group Conversation', exact: true });
      await recorderHelp.focus();
      await page.getByRole('tooltip').getByText('Record, upload audio, or add a transcript.', { exact: true }).waitFor();
      assert.equal(await panel.getByText('Record, upload audio, or add a transcript.', { exact: true }).count(), 0);
      await assertReadable(page.getByRole('tooltip'));
      await page.getByRole('checkbox', { name: 'Label speakers', exact: true }).uncheck();
      assert.equal((await page.getByTestId(ids.SESSION_RECORDING_ADD_INPUT).innerText()).trim(), '+');
      await page.getByTestId(ids.SESSION_RECORDING_ADD_INPUT).click();
      await page.getByRole('button', { name: /Upload audio/ }).waitFor();
      await assertReadable(panel);
      await panel.screenshot({
        path: path.join(output, `choices-${theme}-${width}.png`),
      });
      await page.getByTestId(ids.SESSION_RECORDING_AUDIO_FILE).setInputFiles({
        name: 'conversation.mp3',
        mimeType: 'audio/mpeg',
        buffer: firstAudio,
      });
      await page.getByRole('button', { name: 'Retry transcription', exact: true }).waitFor();
      assert.equal(await page.getByTestId('ce-recording-chunks').count(), 0);
      assert.equal(requests, 1);
      assert(!(await panel.innerText()).includes('workerAuthority'));
      await page.getByText(/This attempt was blocked/).waitFor();
      fail = false;
      await page.getByRole('button', { name: 'Retry transcription', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector('[data-testid="ce-session-listening-transcript"]')?.value === 'Recovered audio.',
      );
      await page
        .getByTestId(ids.SESSION_RECORDING_AUDIO_FILE)
        .setInputFiles({ name: 'second.wav', mimeType: 'audio/wav', buffer: secondAudio });
      await page.waitForFunction(async () => {
        const db = await new Promise((resolve) => {
          const r = indexedDB.open('ce-recording-chunks');
          r.onsuccess = () => resolve(r.result);
        });
        const records = await new Promise((resolve) => {
          const r = db.transaction('chunks').objectStore('chunks').getAll();
          r.onsuccess = () => resolve(r.result);
        });
        db.close();
        return records.filter((r) => r.audio && r.segment.status === 'complete').length === 2;
      });
      await page.getByTestId(ids.SESSION_RECORDING_TRANSCRIPT_FILE).setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('File text.'),
      });
      await page.getByText('Transcript added.', { exact: true }).waitFor();
      await page.getByTestId(ids.SESSION_RECORDING_ADD_INPUT).click();
      await page.getByRole('button', { name: 'Paste transcript', exact: true }).click();
      await page.getByLabel('Written transcript').fill('Pasted text.');
      await page.getByRole('button', { name: 'Add transcript', exact: true }).click();
      await page.getByText('Transcript added.', { exact: true }).waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="ce-session-listening-transcript"]')?.value ===
          'Recovered audio. File text. Pasted text.',
      );
      assert.equal(requests, 3, 'Text import makes no transcription call');
      assert.equal(await page.evaluate(() => window.__microphoneRequests), 0);
      await page.reload();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="ce-session-listening-transcript"]')?.value ===
          'Recovered audio. File text. Pasted text.',
      );
      assert.equal(requests, 3, 'Reload restores text without another upload');
      assert.equal(await page.getByTestId('ce-recording-chunks').count(), 0);
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download audio', exact: true }).click();
      const file = await downloaded;
      assert.equal(file.suggestedFilename(), 'conversation.mp3');
      const outputAudio = await fs.readFile(await file.path());
      const decoded = await page.evaluate(async (base64) => {
        const ctx = new AudioContext();
        try {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const result = await ctx.decodeAudioData(bytes.buffer);
          const pcm = result.getChannelData(0);
          const frequency = (start, end) => {
            let crossings = 0;
            for (let i = Math.round(start * result.sampleRate); i < Math.round(end * result.sampleRate); i++)
              if (pcm[i] < 0 && pcm[i + 1] >= 0) crossings++;
            return crossings / (end - start);
          };
          return { duration: result.duration, first: frequency(0.15, 0.4), second: frequency(0.85, 1.1) };
        } finally {
          await ctx.close();
        }
      }, outputAudio.toString('base64'));
      assert(decoded.duration > 1.2 && decoded.duration < 1.5, JSON.stringify(decoded));
      assert(Math.abs(decoded.first - 440) < 15 && Math.abs(decoded.second - 880) < 15, JSON.stringify(decoded));
      assert.equal(await page.getByTestId('ce-recording-chunks').count(), 0);

      assert.equal(await page.evaluate(() => window.__microphoneRequests), 0);
      assert.equal(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true, 'No horizontal overflow');
      await assertReadable(panel);
      await panel.screenshot({
        path: path.join(output, `imported-${theme}-${width}.png`),
      });

      await page.getByTestId(ids.SESSION_RECORDING_ADD_INPUT).click();
      await page.getByRole('button', { name: 'Paste transcript', exact: true }).click();
      await page
        .getByLabel('Written transcript')
        .fill('The group compared a pilot project and a workshop and discussed which option should be tested next.');
      await page.getByRole('button', { name: 'Add transcript', exact: true }).click();
      await page.getByTestId(ids.SESSION_LISTENING_GENERATE).click();
      const drafts = page.getByTestId(ids.SESSION_LISTENING_SUGGESTIONS);
      await drafts.getByText('Freeform', { exact: true }).waitFor();
      await drafts.getByText('Multichoice', { exact: true }).waitFor();
      assert.equal(await page.getByTestId(ids.SESSION_LISTENING_GENERATE).count(), 0);
      await page.getByRole('button', { name: 'Submit questions', exact: true }).waitFor();
      const remove = drafts.getByRole('button', { name: 'Remove question' }).first();
      const rect = await remove.boundingBox();
      assert(rect.width >= 44 && rect.height >= 44);
      await assertReadable(panel);
      await remove.scrollIntoViewIfNeeded();
      await remove.hover();
      await assertReadable(panel);
      await remove.focus();
      await assertReadable(panel);
      await page.screenshot({ path: path.join(output, 'drafts-' + theme + '-' + width + '.png') });
      await remove.click();
      assert.equal(await drafts.getByTestId(ids.CREATE_QUESTION).count(), 1);
      await drafts.getByRole('button', { name: 'Remove question' }).click();
      await page.getByTestId(ids.SESSION_LISTENING_GENERATE).waitFor();
      assert.deepEqual(errors, []);
      console.log(
        `${theme} ${width}px: mixed-format combined MP3/reload, retry, text import, typed drafts/remove/submit, no paid calls passed`,
      );
      await page.close();
    }
} finally {
  await browser.close();
}
