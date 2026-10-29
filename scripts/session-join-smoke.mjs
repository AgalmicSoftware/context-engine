import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

async function main() {
  const base = process.env.BASE_URL || 'http://127.0.0.1:3186';
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
  const output = process.env.OUTPUT_DIR || '/tmp/ce-rxc-join';
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of ['civic', 'context-engine']) {
      for (const width of [375, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
        page.on('pageerror', error => console.error(error.message));
        page.on('response', response => { if (response.status() >= 400) console.error(response.status(), response.url()); });
        await page.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin === 'https://worker.example' && url.pathname === '/agent/interview-catalog') {
            return route.fulfill({ json: { type: 'context-engine.interview-question-catalog', version: 1, sessionSlug: 'workshop', prefillPromptVersion: 'ce-interview-brief-v6' } });
          }
          if (url.origin !== new URL(base).origin) return route.abort();
          if (url.pathname === '/join-probe') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="padding:16px;margin:0;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
            import RefreshRuntime from '/@react-refresh';
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
            window.__vite_plugin_react_preamble_installed__ = true;
            await import('/src/assets/css/contextEngine.scss');
            const ReactModule = await import('/node_modules/.vite/deps/react.js');
            const React = ReactModule.default || ReactModule;
            const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
            const createRoot = ReactDOM.createRoot || ReactDOM.default.createRoot;
            const { default: Join } = await import('/src/components/Sessions/SessionJoinPanel.tsx');
            createRoot(document.getElementById('probe')).render(React.createElement(Join, { sessionUrl: '${base}/session/workshop?worker=https%3A%2F%2Fworker.example' }));
          </script></body></html>` });
          return route.continue();
        });
        await page.goto(`${base}/join-probe`);
        await page.getByRole('button', { name: 'Join', exact: true }).click();
        await page.getByRole('button', { name: 'Copy AI prompt' }).waitFor();
        await page.waitForFunction(() => !document.querySelector('[aria-label="Copy AI prompt"]').disabled);
        const voice = `${base}/session/workshop?worker=https%3A%2F%2Fworker.example&mode=voice`;
        assert.equal(await page.getByRole('link', { name: 'Open voice interview' }).getAttribute('href'), voice);
        await page.getByRole('button', { name: 'Copy voice link' }).click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), voice);
        await page.getByRole('button', { name: 'Copy AI prompt' }).click();
        assert.match(await page.evaluate(() => navigator.clipboard.readText()), /review-only Context Engine interview prefill/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.getByTestId('ce-session-join').screenshot({ path: path.join(output, `join-${theme}-${width}.png`) });
        console.log(`PASS Join panel ${theme} ${width}`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
