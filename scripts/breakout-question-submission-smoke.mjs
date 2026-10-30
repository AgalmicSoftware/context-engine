import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { Wallet } from 'ethers';
import { createWorkerRuntime } from '../workers/sessionCorsWorker/worker.js';
import { putSessionSecrets } from '../workers/sessionCorsWorker/sessionConfigSecretsStore.js';
import { installSessionCoordinatorBinding } from '../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerClient } from '../mcp/lib/workerClient.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4185';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-breakout-submit';
await fs.mkdir(output, { recursive: true });
const workerOrigin = 'https://recording-worker.example.test';
const slug = 'recording-fixture';
const participant = new Wallet(`0x${'1'.repeat(64)}`);
const admin = new Wallet(`0x${'2'.repeat(64)}`);
const transcript = 'The breakout discussed shared spaces, predictable funding, and accessibility. Everyone asked for a public decision log and a practical trial before expansion.';
const instruction = 'Ask about a practical trial and the public decision log.';
const questionPrompt = 'The community should trial shared spaces before expanding them.';
const values = new Map();
const kv = { get: async key => values.get(key) ?? null, put: async (key, value) => values.set(key, value),
  delete: async key => values.delete(key), list: async ({ prefix = '' } = {}) => ({ keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
const config = { slug, sessionId: `0x${'a'.repeat(32)}`, sessionIdHex: `0x${'a'.repeat(32)}`, sessionName: 'Recorded breakout fixture',
  adminAddress: admin.address, allowOrigins: [base], corsWorkerUrl: workerOrigin, authzEpoch: 1,
  scopes: { ai: true, transcribe: true, storage: true }, questionsGenPrompt: instruction,
  ai: { mode: 'openai', models: { fast: 'gpt-4o-mini', thinking: 'gpt-5', transcription: { provider: 'openai', model: 'whisper-1' } } },
  workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage'], anonymousScopes: ['ai', 'transcribe'] },
  sessionModeProfile: { profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
    storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
    identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] }, encryption: { mode: 'none' },
    surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
    results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } }, export: { scope: 'all_session' } },
};
config.storageProfile = { ...config.sessionModeProfile.storage };
const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv, DEFAULT_SESSION_SLUG: slug,
  TOKEN_HMAC_SECRET: 'synthetic-breakout-token-secret', CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), LOGIN_TRUSTED_ORIGINS: base });
await kv.put(`session:${slug}:config`, JSON.stringify(config));
await putSessionSecrets(env, slug, { openaiKey: 'synthetic-breakout-key' });
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => assert.fail('No external service calls are allowed');
const providerCalls = [];
const worker = createWorkerRuntime(env, { rpcFetch: async () => assert.fail('No RPC calls are allowed'), fetch: async (url, init) => {
  assert.equal(new URL(url).origin, 'https://api.openai.com');
  providerCalls.push(new URL(url).pathname);
  if (new URL(url).pathname.endsWith('/audio/transcriptions')) return Response.json({ text: transcript, segments: [{ speaker: 'A', start: 0, end: 2, text: transcript }] });
  const body = JSON.parse(init.body);
  assert(JSON.stringify(body).includes(instruction), 'Generation uses the saved session questionsGenPrompt');
  assert(JSON.stringify(body).includes(transcript), 'Generation includes the complete recorded transcript');
  return Response.json({ output_text: JSON.stringify({ surveyTitle: 'Breakout questions', questions: [{ prompt: questionPrompt, questionType: 'binary', tags: ['trial'] }] }) });
} });
let login;
const workerFetch = async (url, init = {}) => {
  const response = await worker.fetch(new Request(url, init), env, { waitUntil: () => {} });
  if (new URL(url).pathname === '/auth/login') login = await response.clone().json();
  return response;
};
const client = createWorkerClient({ workerOrigin, slug, trustedOrigins: [base], wallet: participant, fetchImpl: workerFetch });
await client.login();
assert.equal(client.tokenClaims.scopes.storage, true);
assert.notEqual(client.tokenClaims.scopes.admin, true, 'The recorder is a participant with authoring permission');
const browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${new URL(base).hostname}`] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  const uploads = [];
  await page.addInitScript(() => {
    const track = { stop() {} }; const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => stream } });
    window.MediaRecorder = class {
      static isTypeSupported() { return true; }
      state = 'inactive'; mimeType = 'audio/webm';
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(256)], { type: this.mimeType }) }); this.onstop?.(); }
    };
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === workerOrigin) {
      const response = await workerFetch(request.url(), { method: request.method(), headers: request.headers(), body: request.postDataBuffer() || undefined });
      if (url.pathname === '/storage/upload') uploads.push({ status: response.status, body: request.postDataJSON(), reply: await response.clone().json() });
      if (!response.ok) console.log('Fixture response', url.pathname, response.status, await response.clone().text());
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    }
    if (url.origin !== new URL(base).origin) return route.abort();
    if (url.pathname === '/breakout-submit-probe') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-ce-theme="civic"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:12px"><main id="probe"></main><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      await import('/src/assets/css/contextEngine.scss');
      const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
      const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
      const config = ${JSON.stringify(config)}, address = ${JSON.stringify(participant.address)};
      const { default: store } = await import('/src/store.ts');
      const { changeAccount } = await import('/src/actions/accountActions.ts');
      store.dispatch(changeAccount({ account: address, provider: 'passkey_eoa', loginComplete: true }));
      const { buildTokenCacheEnvelope, buildTokenCacheKey, writeTokenCache } = await import('/src/utilities/worker/workerAuthTokenCache.ts');
      const scope = { workerUrl: config.corsWorkerUrl, sessionId: config.sessionId, sessionSlug: config.slug, address };
      writeTokenCache(buildTokenCacheKey({ ...scope, slug: config.slug }), buildTokenCacheEnvelope({ ...scope, token: ${JSON.stringify(login.token)}, exp: ${Number(login.exp)} }));
      const { default: Panel } = await import('/src/components/SurveyTool/SessionListeningPanel.tsx');
      (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Panel, { sessionSlug: config.slug, sessionConfig: config, workerUrl: config.corsWorkerUrl, context: { account: address }, account: address, loginComplete: true, provider: 'passkey_eoa', panelMode: 'recordGroup' }));
    </script></body></html>` });
    return route.continue();
  });
  await page.goto(`${base}/breakout-submit-probe`);
  await page.getByTestId('ce-session-listening-start').click();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.getByTestId('ce-session-listening-suggestions').waitFor({ timeout: 30000 });
  assert.equal(uploads.length, 0, 'Generated questions remain reviewable before explicit submission');
  await page.getByTestId('ce-session-listening-suggestions').screenshot({ path: `${output}/generated-questions.png` });
  await page.getByTestId('ce-create-submit').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="ce-create-submit"]'), { timeout: 30000 });
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].status, 200, JSON.stringify(uploads[0].reply));
  const payload = typeof uploads[0].body.data === 'string' ? JSON.parse(uploads[0].body.data) : uploads[0].body.data;
  assert.equal(payload.prompt, questionPrompt);
  assert.equal(payload.creator.toLowerCase(), participant.address.toLowerCase());
  assert.equal(uploads[0].body.resource, 'questions');
  assert.deepEqual(errors, []);
  await fs.writeFile(`${output}/result.json`, JSON.stringify({ providerCalls, uploadStatus: uploads[0].status, prompt: payload.prompt, participant: true }, null, 2));
  console.log('PASS recording -> session questionsGenPrompt -> review -> participant question submission through the real Worker with mocked services');
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) await fs.writeFile(`${output}/failure.txt`, await page.locator('body').innerText().catch(() => 'Page unavailable'));
  throw error;
} finally { await browser.close(); globalThis.fetch = originalFetch; }
