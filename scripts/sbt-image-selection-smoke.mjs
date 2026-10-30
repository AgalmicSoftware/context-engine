import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:4185';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-sbt-image-selection-smoke';
await fs.mkdir(output, { recursive: true });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0wAAAABJRU5ErkJggg==';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 1280]) for (const outcome of ['success', 'failure']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (/\/utilities\/ui\/imageFetchClient\.(?:ts|js)$/.test(url.pathname)) {
        return route.fulfill({ contentType: 'application/javascript', body: `
          export function fetchImageFromURL(url, { signal } = {}) {
            return new Promise((resolve, reject) => { window.pendingImage = { url, signal, resolve, reject }; });
          }
        ` });
      }
      if (url.pathname !== '/image-probe') return route.continue();
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="context-engine"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/assets/css/contextEngine.scss');
        const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
        const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { default: CreateSBTGroup } = await import('/src/components/SBTs/CreateSBTGroup.tsx');
        (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(CreateSBTGroup, {
          ref: form => { window.sbtForm = form; }, sessionSlug: 'image-fixture',
          network: { id: 11155420, name: 'OP Sepolia' }, defaultExpanded: true,
          deferredDeploy: true, toggleLoginModal: () => {}
        }));
      </script></body></html>` });
    });
    await page.goto(`${base}/image-probe`);
    await page.getByRole('button', { name: 'URL', exact: true }).click();
    await page.getByTestId('ce-sbt-create-image-url-input').fill('https://image.example.test/old.png');
    await page.waitForFunction(() => Boolean(window.pendingImage));
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Upload image', exact: true }).click(),
    ]);
    await chooser.setFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(expected => JSON.parse(sessionStorage.getItem(window.sbtForm.getScopedFormCacheKey()) || '{}')._imageDataUrl === expected, `data:image/png;base64,${png}`);
    assert.equal(await page.evaluate(() => window.pendingImage.signal.aborted), true);
    const preview = page.getByAltText('SBT artwork preview', { exact: true });
    const originalPreview = await preview.getAttribute('src');
    await page.evaluate(outcome => {
      if (outcome === 'success') window.pendingImage.resolve(new File(['remote'], 'remote.png', { type: 'image/png' }));
      else window.pendingImage.reject(new Error('Late fixture failure'));
    }, outcome);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.sbtForm.state.sbtImageFile.name), 'local.png');
    assert.equal(await preview.getAttribute('src'), originalPreview);
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem(window.sbtForm.getScopedFormCacheKey()))._imageDataUrl), `data:image/png;base64,${png}`);
    assert.equal(await page.evaluate(() => window.sbtForm.state.imageLoadError), false);
    await page.screenshot({ path: `${output}/${width}-${outcome}.png`, fullPage: true });
    console.log(`PASS SBT image selection width=${width} late=${outcome}: local file, preview, and saved bytes retained`);
    await page.close();
  }
} finally { await browser.close(); }
