import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3186';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-rxc-order';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['civic', 'context-engine']) for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === 'https://worker.example' && url.pathname === '/agent/interview-catalog') {
        assert.deepEqual([...url.searchParams.keys()].sort(), ['sessionUrl', 'slug']);
        return route.fulfill({ json: { type: 'context-engine.interview-question-catalog', version: 1, sessionSlug: 'workshop', prefillPromptVersion: 'ce-interview-brief-v6' } });
      }
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === '/order-probe') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="padding:16px;margin:0;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/assets/css/contextEngine.scss');
        const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
        const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { default: Card } = await import('/src/components/SurveyTool/SessionVoicePrefillCard.tsx');
        const { normalizeInterviewQuestions, buildRealtimeInterviewInstructions } = await import('/src/components/SurveyTool/sessionInterview.ts');
        const { sortInterviewQuestionPoolNewestFirst, buildInterviewQuestionPriority } = await import('/src/components/SurveyTool/sessionInterviewQuestionOrder.ts');
        const questionPool = [
          { id: 'opening', type: 'freeform', prompt: 'Opening question', storageRef: { createdAt: '2026-10-28T10:00:00Z' } },
          { id: 'room-first', type: 'freeform', prompt: 'First breakout', storageRef: { createdAt: '2026-10-29T10:00:00Z' } },
          { id: 'room-newest', type: 'freeform', prompt: 'Newest breakout', storageRef: { createdAt: '2026-10-29T11:00:00Z' } },
        ];
        const existingResponseSlice = { answers: { opening: { value: 'Private synthetic answer' } } };
        const questions = normalizeInterviewQuestions(sortInterviewQuestionPoolNewestFirst(questionPool));
        const priority = buildInterviewQuestionPriority(questions, existingResponseSlice);
        window.__voiceBrief = buildRealtimeInterviewInstructions({ questions: questions.filter(q => priority.unansweredQuestionIds.includes(q.id)) });
        (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Card, { workerUrl: 'https://worker.example', sessionSlug: 'workshop', questionPool, existingResponseSlice }));
      </script></body></html>` });
      return route.continue();
    });
    await page.goto(`${base}/order-probe`);
    const copy = page.getByRole('button', { name: 'Copy memory augmentation prompt' });
    await copy.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Copy memory augmentation prompt"]').getAttribute('aria-disabled') === 'false');
    await copy.click();
    const prompt = await page.evaluate(() => navigator.clipboard.readText());
    assert(prompt.includes('Unanswered question IDs, newest first: ["room-newest","room-first"]'));
    assert(prompt.includes('Already answered IDs, only for changes I request: ["opening"]'));
    assert(!prompt.includes('Private synthetic answer'));
    const brief = await page.evaluate(() => window.__voiceBrief);
    assert(brief.indexOf('[room-newest]') < brief.indexOf('[room-first]'));
    assert(!brief.includes('[opening]'));
    await page.getByRole('button', { name: 'Prompt', exact: true }).click();
    await page.getByRole('heading', { name: 'Let your AI draft your answers' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(failures, []);
    await page.screenshot({ path: path.join(output, `interview-${theme}-${width}.png`) });
    console.log(`PASS Interview question order ${theme} ${width}`);
    await page.close();
  }
} finally { await browser.close(); }
