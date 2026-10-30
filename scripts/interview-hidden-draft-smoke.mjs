import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:4184';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-hidden-draft-smoke';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['civic', 'context-engine']) for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(20000);
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === '/hidden-draft-probe') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="padding:16px;margin:0;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/assets/css/contextEngine.scss');
        const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
        const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { default: Modal } = await import('/src/components/SurveyTool/SessionVoiceModeModal.tsx');
        const questions = ['q1', 'q2', 'q3', 'q4'].map(id => ({ id, type: 'binary', prompt: 'Question ' + id + ': should this be a priority?' }));
        const packet = { version: 1, sessionSlug: 'fixture', source: { platform: 'claude', modelId: 'fixture', verification: 'self_reported' }, responderContext: {}, responses: questions.map(q => ({ questionId: q.id, answer: 'Agree', evidence: 'PRIVATE-GUESS-EVIDENCE-' + q.id, additionalComments: 'PRIVATE-GUESS-COMMENT-' + q.id, confidence: 0.8 })) };
        (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Modal, { isOpen: true, mode: 'interview', loginComplete: true, account: '0x0000000000000000000000000000000000000001', onClose: () => {}, onSelectMode: () => {}, sessionSlug: 'fixture', workerUrl: 'https://worker.example.test', questionPool: questions, prefillPacket: packet, sessionConfig: { interviewMode: { hiddenDraftShare: 0.5, shareDraftChangesByDefault: true } } }));
      </script></body></html>` });
      return route.continue();
    });
    await page.goto(`${base}/hidden-draft-probe`);
    const hidden = page.getByRole('group', { name: 'Hidden AI guess' });
    await hidden.first().waitFor().catch(async error => { console.error(await page.locator('body').innerText(), failures); throw error; });
    assert.equal(await hidden.count(), 2);
    const card = page.getByTestId('ce-session-interview-draft').filter({ has: hidden }).first();
    await page.getByText('AI submission info', { exact: true }).click();
    const id = await card.getAttribute('data-ce-question-id');
    assert(!(await card.innerHTML()).includes('PRIVATE-GUESS'));
    assert.equal(await card.getByRole('radio', { name: 'Agree', exact: true }).isChecked(), false);
    const help = card.getByRole('button', { name: 'Why is the AI guess hidden?' });
    await help.focus();
    await page.getByRole('tooltip').waitFor();
    assert((await page.getByRole('tooltip').innerText()).includes('Give your own answer first'));
    const contrast = await hidden.first().evaluate(element => {
      const luminance = color => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722; };
      const css = getComputedStyle(element); const a = luminance(getComputedStyle(element.querySelector('strong')).color); const b = luminance(css.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    assert(contrast >= 4.5, `Hidden answer text contrast: ${contrast}`);
    await page.waitForFunction(() => [...document.querySelectorAll('.modal')].some(element => Number(getComputedStyle(element).opacity) === 1));
    await card.evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: path.join(output, `full-${theme}-${width}.png`) });
    await card.screenshot({ animations: 'disabled', path: path.join(output, `hidden-${theme}-${width}.png`) });
    await card.getByRole('radio', { name: 'Disagree', exact: true }).locator('..').click();
    const revealed = page.locator(`[data-testid="ce-session-interview-draft"][data-ce-question-id="${id}"]`);
    await revealed.getByText('Your AI guessed: Agree · 80% sure').waitFor();
    assert.equal(await revealed.getByRole('group', { name: 'Hidden AI guess' }).count(), 0);
    assert.equal(await revealed.getByRole('radio', { name: 'Disagree', exact: true }).isChecked(), true);
    await revealed.screenshot({ animations: 'disabled', path: path.join(output, `revealed-${theme}-${width}.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(failures, []);
    console.log(`PASS Hidden draft ${theme} ${width}: concealed, tooltip, contrast, reveal`);
    await page.close();
  }
} finally { await browser.close(); }
