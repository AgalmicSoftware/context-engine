import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3186';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-rxc-results';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['civic', 'context-engine']) for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    const failures = [];
    page.on('pageerror', error => { failures.push(error.message); console.error(error.message); });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === '/results-probe') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:8px;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/test-smoke/participationResultsSmokeEntry.tsx');
      </script></body></html>` });
      return route.continue();
    });
    await page.goto(`${base}/results-probe`);
    await page.getByTestId('ce-polis-report-root').waitFor({ timeout: 60000 });
    await page.getByText('Consensus and Difference', { exact: true }).waitFor();
    await page.getByRole('heading', { name: /Participants Graph/ }).waitFor();
    await page.getByTestId('ce-polis-analyze-clusters').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-ce-analysis-state="ready"]').length > 0);
    assert.equal(await page.getByRole('button', { name: /compass/i }).count(), 0);
    await page.getByText('Consensus and Difference', { exact: true }).evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(output, `consensus-${theme}-${width}.png`) });
    await page.getByRole('heading', { name: /Participants Graph/ }).evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(output, `participants-${theme}-${width}.png`) });
    await page.getByTestId('ce-polis-cluster-analysis').first().evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(output, `explanations-${theme}-${width}.png`) });
    assert.deepEqual(failures, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    console.log(`PASS Worker-mode Report, graph and mocked explanations ${theme} ${width}`);
    await page.close();
  }
} finally { await browser.close(); }
