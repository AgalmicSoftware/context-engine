// Reads public session config/presence; AI and audio requests are intercepted.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const sessions = require('../client/src/variables/demo/demo_sessions.json');
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, mode] of [[773, 'live'], [390, 'live'], [773, 'absent'], [773, 'unavailable']]) {
    const context = await browser.newContext({ viewport: { width, height: 853 } });
    context.setDefaultTimeout(30000);
    await context.addInitScript(() => {
      localStorage.setItem('ce_onboarding_complete', 'true');
      localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      localStorage.setItem('ce:primarySessionSlug', 'rxc-ra-test');
      localStorage.setItem('ce:selectedSessionScope', 'active');
    });
    if (mode !== 'live') await context.route('**/resource-presence', route => route.fulfill({
      status: mode === 'unavailable' ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify({ resources: { ai: false, arweave: false, rpc: false, txGas: false } }),
    }));
    const requests = [];
    for (const endpoint of ['ai', 'transcribe']) await context.route(`**/${endpoint}`, async route => {
      const request = route.request();
      const headers = await request.allHeaders();
      requests.push({ endpoint, url: request.url(), slug: headers['x-session-slug'] || headers['x-group-slug'], body: request.postData() });
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ completion: 'Synthetic AI response.', text: 'Synthetic transcript.' }) });
    });
    const page = await context.newPage();
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^LOG IN$/i }).click();
    await page.getByRole('button', { name: 'Toggle pre-login settings' }).click();
    const card = page.getByTestId('ce-settings-resource-ai');
    const label = mode === 'live' ? 'Sponsored' : mode === 'absent' ? 'Not sponsored' : 'Check unavailable';
    await card.getByText(label, { exact: true }).waitFor();
    assert.match(await card.innerText(), /Reverse Alignment/);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    if (mode === 'live') {
      const selector = page.getByTestId('ce-prelogin-session-select');
      for (const slug of ['rxc-test', 'rxc-ra-test']) {
        await selector.selectOption(slug);
        await card.getByText('Sponsored', { exact: true }).waitFor();
        const workerOrigin = sessions[slug].corsWorkerUrl.replace(/\/+$/, '');
        const result = await page.evaluate(async ({ slug, workerOrigin }) => {
          const { getVerifiedWorkerCanonicalSessionBootstrap } = await import('/src/utilities/session/sessionWorkerConfigCache.ts');
          const { callAI, transcribeAudio } = await import('/src/utilities/ai/aiClient.ts');
          const config = getVerifiedWorkerCanonicalSessionBootstrap({ slug, workerOrigin });
          if (!config) throw new Error(`Missing verified config for ${slug}`);
          const options = { sessionSlug: slug, sessionConfig: config, preferLocal: false, anonymousOnly: true };
          const outputs = [];
          for (const taskType of ['rewrite', 'summarize', 'generate']) outputs.push(await callAI('Synthetic test input.', { ...options, taskType }));
          outputs.push(await callAI('Synthetic thinking input.', { ...options, thinking: true }));
          outputs.push(await transcribeAudio(new File(['synthetic'], 'sample.webm', { type: 'audio/webm' }), options));
          return { outputs, models: config.ai.models };
        }, { slug, workerOrigin });
        assert.deepEqual(result.outputs, Array(4).fill('Synthetic AI response.').concat('Synthetic transcript.'));
        const recent = requests.slice(-5);
        assert.equal(recent.length, 5);
        recent.forEach((request, index) => {
          const endpoint = index === 4 ? 'transcribe' : 'ai';
          assert.equal(request.url, `${workerOrigin}/${endpoint}`);
          assert.equal(request.slug, slug);
          if (endpoint === 'ai') {
            const expected = result.models[index === 3 ? 'thinking' : 'fast'];
            assert.equal(JSON.parse(request.body).model, expected.model);
            assert.equal(JSON.parse(request.body).provider, expected.provider);
          } else assert(request.body.includes(result.models.transcription.model));
        });
      }
      await card.screenshot({ animations: 'disabled', path: `/tmp/settings-ai-sponsorship-${width}.png` });
    } else if (mode === 'unavailable') {
      assert.equal(await card.getByText('Not sponsored', { exact: true }).count(), 0);
    }
    console.log(`PASS Settings sponsorship: ${width}px ${mode}; ${requests.length} intercepted AI/audio calls`);
    await context.close();
  }
} finally {
  await browser.close();
}
