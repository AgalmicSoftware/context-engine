import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:4185';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const browser = await chromium.launch({ headless: true });
try {
  for (const inline of [true, false]) for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => console.error('page error', error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('console', message.text()); });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname !== '/filter-probe') return route.continue();
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="context-engine"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/assets/css/contextEngine.scss');
        const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
        const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { QuestionFilter } = await import('/src/components/SurveyTool/QuestionFilter.tsx');
        const { serializeFilterState } = await import('/src/utilities/survey/filterStateUtils.ts');
        const { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } = await import('/src/utilities/session/sessionModeProfile.ts');
        const workerGroupFilter = { sessionId: '0x' + '1'.repeat(64), sessionSlug: 'filter-fixture', workerUrl: 'https://worker.example.test', creatorInclude: [], creatorExclude: [], responderExclude: [], responderInclude: [{ groupId: 'workshop', label: 'Workshop' }] };
        window.savedFilter = serializeFilterState({ workerGroupFilter, topQuestions: { count: 1, by: 'responses' } });
        (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(QuestionFilter, {
          resultsMode: ${inline}, filterModalOpen: true, enableLocalStorage: false, toggleFilterModal: () => {},
          sessionSlug: 'filter-fixture', sessionConfig: { slug: 'filter-fixture', sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) },
          questions: [{ id: 'q1', type: 'binary', prompt: 'Fixture question' }], questionResponses: {}, isQuestionCacheReady: true, isSBTCacheReady: true,
          onFilterStateChange: state => { window.appliedFilter = state; }
        }));
      </script></body></html>` });
    });
    await page.goto(`${base}/filter-probe`);
    await page.getByRole('img', { name: 'Load a saved filter' }).click();
    const token = await page.evaluate(() => window.savedFilter);
    const input = page.getByPlaceholder('Load filter from URL/string...');
    for (const state of ['empty', 'active', 'cleared']) {
      if (state === 'cleared') {
        await page.getByRole('img', { name: 'Clear current filters' }).click();
        if (!(await input.isVisible())) await page.getByRole('img', { name: 'Load a saved filter' }).click();
      }
      await input.fill(state === 'empty' ? token : `https://example.test/session/filter-fixture?filter=${token}`);
      await page.getByRole('button', { name: 'Load', exact: true }).click();
      await page.getByRole('button', { name: 'Remove filter: Top 1 by # responses' }).waitFor();
      await page.getByRole('button', { name: 'Remove filter: Responder include: Workshop' }).waitFor();
      const applied = await page.evaluate(() => window.appliedFilter);
      assert.deepEqual(applied.topQuestions, { count: 1, by: 'responses' });
      assert.deepEqual(applied.workerGroupFilter.responderInclude, [{ groupId: 'workshop', label: 'Workshop' }]);
    }
    console.log(`PASS saved-filter loader inline=${inline} width=${width}: empty, active, cleared; token and URL`);
    await page.close();
  }
} finally { await browser.close(); }
