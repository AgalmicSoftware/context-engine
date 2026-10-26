import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ethers } from 'ethers';
import worker from '../workers/sessionCorsWorker/worker.js';
import { installSessionCoordinatorBinding } from '../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerClient } from '../mcp/lib/workerClient.mjs';
import { buildQuestionRecord } from '../mcp/lib/records.mjs';
import { buildPasskeyDerivedWallet, toPasskeyEoaSeedRecord } from './lib/passkey-derived-wallet.js';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname), 'This smoke requires a local client');
const workerOrigin = 'https://setup-smoke.example.test';
const outputDir = process.env.OUTPUT_DIR || 'artifacts/session-setup-smoke';
await mkdir(outputDir, { recursive: true });
const passkeyFixture = (name) => {
  const credentialId = Buffer.from(`setup-smoke-${name}`).toString('base64url');
  const { wallet } = buildPasskeyDerivedWallet(credentialId);
  return { wallet, seed: toPasskeyEoaSeedRecord({ credentialId, address: wallet.address }) };
};
const adminFixture = passkeyFixture('admin');
const admin = adminFixture.wallet;
const kv = () => {
  const values = new Map();
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => values.set(key, value),
    delete: async (key) => values.delete(key),
    list: async ({ prefix = '' } = {}) => ({
      keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  };
};
const env = installSessionCoordinatorBinding({
  GROUP_KV: kv(),
  CE_STORAGE_INDEX_KV: kv(),
  BOOTSTRAP_ADMIN_ADDRESS: admin.address,
  LOGIN_TRUSTED_ORIGINS: baseUrl,
  ADMIN_TRUSTED_ORIGINS: baseUrl,
  TOKEN_HMAC_SECRET: 'synthetic-session-setup-token-key',
  CE_STORAGE_ENVELOPE_KEK: 'synthetic-session-setup-envelope-key',
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error('Session setup smoke must not call an external service');
};
const browser = await chromium.launch({
  headless: true,
  args: [`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${new URL(baseUrl).hostname}`],
});
const calls = [];
const fixtureContext = async ({ seed }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
  });
  context.setDefaultTimeout(30000);
  await context.addInitScript(
    ({ seed, appOrigin }) => {
      if (location.origin !== appOrigin) return;
      localStorage.setItem('ce_onboarding_complete', 'true');
      const bytes = (value) => {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), (char) => char.charCodeAt(0));
      };
      const credential = {
        rawId: bytes(seed.credentialId).buffer,
        getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: bytes(seed.prfOutput).buffer } } }),
      };
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { create: async () => credential, get: async () => credential },
      });
    },
    { seed, appOrigin: new URL(baseUrl).origin },
  );
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin !== workerOrigin) return route.abort();
    const response = await worker.fetch(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.postDataBuffer() || undefined,
      }),
      env,
      { waitUntil: () => {} },
    );
    calls.push({
      path: url.pathname + url.search,
      method: request.method(),
      status: response.status,
      ...(response.ok ? {} : { error: await response.clone().text() }),
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  return context;
};
const login = async (page, wallet) => {
  await page.getByTestId('ce-account-login-button').click();
  await page.getByTestId('ce-passkey-wallet-create').click();
  const display = page.getByTestId('ce-wallet-display');
  await display.waitFor();
  assert.equal((await display.getAttribute('data-ce-wallet-address')).toLowerCase(), wallet.address.toLowerCase());
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
};
let page;
try {
  const adminContext = await fixtureContext(adminFixture);
  page = await adminContext.newPage();
  await page.goto(`${baseUrl}/new`, { waitUntil: 'domcontentloaded' });
  await login(page, admin);
  await page.getByTestId('ce-new-preset-fast_cheap_cloudflare').click();
  await page.getByTestId('ce-wizard-session-name').fill('Setup smoke session');
  await page.getByTestId('ce-wizard-session-info').fill('Synthetic publication and participant fixture.');
  await page.getByTestId('ce-wizard-customize').click();
  const key = page.getByTestId('ce-wizard-secret-openai-key');
  if (!(await key.isVisible())) await page.getByTestId('ce-wizard-worker-panel-toggle').click();
  await key.fill('synthetic-ai-key-not-a-credential');
  await page
    .locator('label')
    .filter({ hasText: 'Allowed origins (comma or newline)' })
    .locator('..')
    .locator('textarea')
    .fill(baseUrl);
  await page.getByTestId('ce-wizard-worker-url').fill(workerOrigin);
  await page.getByTestId('ce-wizard-cloudflare-native-verify').click();
  await page
    .getByText(/Session Worker verified/i)
    .first()
    .waitFor({ timeout: 30000 });
  console.log('Session Worker attachment verified through signed real Worker requests.');
  await page.locator('#session-wizard-section-publish').getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByTestId('ce-wizard-publish').click();
  await page.getByText('Session Created', { exact: true }).waitFor({ timeout: 30000 });
  console.log('Wizard publication completed.');
  const sessionLink = await page.locator('a[href*="/session/"][href*="worker="]').first().getAttribute('href');
  assert(sessionLink, 'Publication returns a portable session link');
  const sessionUrl = new URL(sessionLink, baseUrl);
  const slug = decodeURIComponent(sessionUrl.pathname.split('/').at(-1));
  const workerFetch = (url, init = {}) => worker.fetch(new Request(url, init), env, { waitUntil: () => {} });
  const adminClient = createWorkerClient({
    workerOrigin,
    slug,
    trustedOrigins: [baseUrl],
    wallet: admin,
    fetchImpl: workerFetch,
  });
  const config = await adminClient.loadConfig();
  assert.equal(config.sessionName, 'Setup smoke session');
  assert.equal(config.sessionModeProfile.authority.mode, 'worker_canonical');
  assert.equal(config.sessionModeProfile.encryption.mode, 'worker_envelope');
  assert.equal(config.sessionModeProfile.surfaces.agentHttp, false);
  assert.ok(config.configRevision, 'The published configuration has a readback revision');
  const question = buildQuestionRecord({
    type: 'binary',
    prompt: 'Community decisions should be easier to understand.',
    creator: admin.address,
    session: {
      sessionSlug: slug,
      sessionId: adminClient.sessionId,
      sessionName: config.sessionName,
    },
  });
  assert.equal(question.ok, true);
  await adminClient.upload({
    resource: 'questions',
    data: question.record,
    tags: [
      { name: 'CE-SessionId', value: adminClient.sessionId },
      { name: 'CE-SessionSlug', value: slug },
      { name: 'CE-Resource', value: 'questions' },
      { name: 'CE-ResourceId', value: question.id },
    ],
  });
  const participantFixture = passkeyFixture('participant');
  const participant = participantFixture.wallet;
  const participantContext = await fixtureContext(participantFixture);
  page = await participantContext.newPage();
  await page.goto(sessionUrl.href, { waitUntil: 'domcontentloaded' });
  await login(page, participant);
  await page.getByText(question.record.prompt, { exact: true }).first().waitFor();
  const answer = 'Agree';
  await page.getByTestId('ce-pile-active-question').getByText(answer, { exact: true }).click();
  assert.equal(await page.getByRole('radio', { name: answer, exact: true }).isChecked(), true);
  await page.getByTestId('ce-survey-submit').click();
  await page.getByTestId('ce-survey-submitted-indicator').first().waitFor();
  console.log('Fresh participant submitted an answer through the browser.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('radio', { name: answer, exact: true }).waitFor();
  assert.equal(await page.getByRole('radio', { name: answer, exact: true }).isChecked(), true);
  console.log('The participant answer survived reload.');
  await page.getByTestId('ce-session-results-toggle').click();
  await page.getByRole('button', { name: /Raw Results/i }).click();
  await page.getByRole('heading', { name: 'Question Results', exact: true }).first().waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page
    .getByTestId('ce-polis-all-questions')
    .getByText(/^Agree: 1\s*\/\s*Unsure: 0\s*\/\s*Disagree: 0\s*\/\s*Responses: 1$/)
    .waitFor();
  const makeClient = (wallet) =>
    createWorkerClient({
      workerOrigin,
      slug,
      trustedOrigins: [baseUrl],
      wallet,
      fetchImpl: workerFetch,
    });
  const participantClient = makeClient(participant);
  const saved = await participantClient.listAll('responses', { mine: true });
  assert.equal(saved.complete, true);
  assert.equal(saved.items.length, 1, 'One browser submission produces one stored response');
  const responseId = saved.items[0].storageRef.id;
  const responseRecord = await participantClient.read(responseId);
  assert.equal(responseRecord.questionID, question.id);
  assert.equal(responseRecord.answer.value, answer);
  assert.equal(responseRecord.responder.toLowerCase(), participant.address.toLowerCase());
  assert.deepEqual(
    await adminClient.read(responseId),
    responseRecord,
    'The session admin may read the submitted response',
  );
  const stranger = makeClient(ethers.Wallet.createRandom());
  assert.equal(
    (await stranger.listAll('responses')).items.length,
    0,
    'Another participant cannot discover this private response',
  );
  await assert.rejects(stranger.read(responseId), (error) => error.status === 403);
  const anonymous = await workerFetch(`${workerOrigin}/storage/read?id=${encodeURIComponent(responseId)}`, {
    headers: { 'X-Group-Slug': slug },
  });
  assert.equal(anonymous.status, 403, 'Anonymous access to the private response is denied');
  assert.equal(
    [...env.CE_STORAGE_INDEX_KV.values.values()].some((value) => String(value).includes(question.record.prompt)),
    false,
    'The stored encrypted payloads do not contain the question plaintext',
  );
  await page.screenshot({
    path: `${outputDir}/participant-results.png`,
    fullPage: true,
    timeout: 10000,
  });
  await writeFile(
    `${outputDir}/result.json`,
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        configRevision: config.configRevision,
        checks: [
          'signed Worker verification',
          'wizard publication and config readback',
          'fresh-context answer submission',
          'reload persistence',
          'participant Results UI',
          'author and admin readback',
          'other-participant and anonymous denial',
          'encrypted storage',
        ],
        calls,
      },
      null,
      2,
    ),
  );
  console.log(
    'Session publication smoke passed: fresh participant, saved answer, Results, encrypted storage, and read permissions.',
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({
        path: `${outputDir}/failure.png`,
        fullPage: true,
        timeout: 5000,
      })
      .catch(() => {});
    console.error((await page.locator('body').innerText()).slice(-14000));
  }
  console.error(JSON.stringify(calls));
  throw error;
} finally {
  await browser.close();
  globalThis.fetch = originalFetch;
}
