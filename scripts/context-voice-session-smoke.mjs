// Synthetic microphone input and intercepted transcription; no audio leaves the browser.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const sessions = require('../client/src/variables/demo/demo_sessions.json');
const voiceSlugs = ['demo-sh', 'rxc-test', 'rxc-ra-test'];
for (const slug of voiceSlugs) {
  const config = sessions[slug];
  sessions[slug] = {
    ...config,
    sessionModeProfile: sessions['demo-sh'].sessionModeProfile,
    configRevision: 'synthetic-voice-v1',
    ai: {
      ...config.ai,
      models: {
        ...config.ai?.models,
        transcription: { provider: 'openai', model: `synthetic-${slug}-transcription` },
      },
    },
  };
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
try {
  const context = await browser.newContext({ viewport: { width: 705, height: 853 } });
  context.setDefaultTimeout(30000);
  await context.addInitScript(() => {
    localStorage.setItem('ce_onboarding_complete', 'true');
    localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
    localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
    localStorage.setItem('ce:selectedSessionScope', 'active');
  });
  // Keep all model fixtures inside this browser; no deployed session is changed.
  const moduleLines = Object.entries(sessions)
    .filter(([key]) => /^[A-Za-z_$][\w$]*$/.test(key))
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`);
  moduleLines.push(`export default ${JSON.stringify(sessions)};`);
  await context.route('**/src/variables/demo/demo_sessions.json?import*', route => route.fulfill({
    contentType: 'application/javascript', body: moduleLines.join('\n'),
  }));
  for (const slug of voiceSlugs) {
    await context.route(`${new URL(sessions[slug].corsWorkerUrl).origin}/session-config?*`, route => route.fulfill({
      json: { ok: true, sessionSlug: slug, config: sessions[slug] },
    }));
  }
  const requests = [];
  let transcriptionReady;
  await context.route('**/transcribe', async route => {
    const request = route.request();
    const headers = await request.allHeaders();
    const form = await new Response(request.postDataBuffer(), {
      headers: { 'Content-Type': headers['content-type'] },
    }).formData();
    requests.push({ url: request.url(), slug: headers['x-session-slug'] || headers['x-group-slug'], model: form.get('model') });
    await new Promise(resolve => transcriptionReady(resolve));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: `Synthetic transcript ${requests.length}.` }) });
  });
  const page = await context.newPage();
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3000');
  await page.getByRole('tab', { name: 'Tools', exact: true }).click();
  await page.getByText('Context', { exact: true }).click();
  const selector = page.getByTestId('ce-tool-explorer-active-session');
  const inherited = await selector.inputValue();
  const textarea = page.getByTestId('ce-context-text-input');
  await textarea.fill('Existing context draft.');

  const record = async (slug) => {
    console.log(`Checking Context voice Worker: ${slug}`);
    const count = requests.length;
    const transcription = new Promise(resolve => { transcriptionReady = resolve; });
    await page.getByRole('button', { name: 'Start recording', exact: true }).click().catch(async error => {
      console.error('Voice start failure:', (await page.locator('body').innerText()).slice(0, 5000));
      throw error;
    });
    await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
    const rewrite = page.getByRole('button', { name: 'AI rewrite', exact: true });
    assert.equal(await rewrite.isDisabled(), true);
    // RecordRTC rejects clips shorter than the hook's 500ms minimum.
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
    const releaseTranscription = await transcription;
    try {
      assert.equal(await rewrite.isDisabled(), true);
      assert.ok(!(await textarea.inputValue()).includes('Waiting for AI'));
    } finally {
      releaseTranscription();
    }
    await page.waitForFunction(expected => {
      const input = document.querySelector('[data-testid="ce-context-text-input"]');
      return input?.value.includes(expected);
    }, `Synthetic transcript ${count + 1}.`).catch(async error => {
      console.error('Voice smoke failure:', requests, await textarea.inputValue());
      throw error;
    });
    assert.equal(requests.length, count + 1);
    assert.deepEqual(requests.at(-1), {
      url: `${sessions[slug].corsWorkerUrl.replace(/\/+$/, '')}/transcribe`, slug,
      model: sessions[slug].ai.models.transcription.model,
    });
    assert.ok((await textarea.inputValue()).startsWith('Existing context draft.'));
    assert.equal(await rewrite.isDisabled(), false);
    assert.equal(await page.getByText('Worker URL is not configured.', { exact: true }).count(), 0);
  };

  for (const slug of ['rxc-test', 'rxc-ra-test']) {
    await selector.selectOption(slug);
    await record(slug);
  }
  const inheritValue = await selector.getByRole('option', { name: /^Use global default/ }).getAttribute('value');
  await selector.selectOption(inheritValue);
  assert.equal(await selector.inputValue(), inherited);
  await record(inherited);
  console.log('Context voice session smoke passed: configured models on both RxC Workers and inherited default, draft preserved.');
} finally {
  await browser.close();
}
