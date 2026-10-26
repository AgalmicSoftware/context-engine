import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const startedAt = performance.now();
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
const fixtureContext = async ({ seed }, { failResponseUploadAt = 0, loseResponseUploadAt = 0, unavailableSubmit = false, responseUploads = [] } = {}) => {
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
    const upload = url.pathname === '/storage/upload' && request.method() === 'POST'
      ? request.postDataJSON()
      : null;
    const responseUpload = upload?.resource === 'responses'
      ? { questionId: (typeof upload.data === 'string' ? JSON.parse(upload.data) : upload.data).questionID }
      : null;
    if (responseUpload) responseUploads.push(responseUpload);
    const failUpload = responseUpload && responseUploads.length === failResponseUploadAt;
    let response = failUpload ? new Response(JSON.stringify({ error: 'Synthetic storage outage (503)' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': baseUrl },
    }) : await worker.fetch(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.postDataBuffer() || undefined,
      }),
      env,
      { waitUntil: () => {} },
    );
    if (!failUpload && request.headers().origin) {
      assert.equal(response.headers.get('access-control-allow-origin'), request.headers().origin,
        `Worker CORS header missing for ${request.method()} ${url.pathname}`);
    }
    if (unavailableSubmit && url.pathname === '/capabilities') {
      const capabilities = await response.json();
      capabilities.session.unavailable = [{ operation: 'submit', reason: 'storage_missing' }];
      response = new Response(JSON.stringify(capabilities), { status: 200, headers: response.headers });
    }
    if (loseResponseUploadAt && responseUpload) {
      const stored = await response.clone().json();
      Object.assign(responseUpload, { requestId: upload.requestId, storedId: stored.id, replayed: stored.replayed === true });
      if (responseUploads.length === loseResponseUploadAt) {
        assert.equal(response.status, 200, 'The lost reply follows a successful Worker upload');
        response = new Response(JSON.stringify({ error: 'Synthetic lost upload reply (503)' }), {
          status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': baseUrl },
        });
      }
    }
    if (responseUpload) responseUpload.status = response.status;
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
const showQuestion = async (page, question, count) => {
  const card = page.getByTestId('ce-pile-active-question');
  await card.waitFor();
  const previous = page.getByRole('button', { name: 'Previous Question', exact: true });
  for (let index = 0; index < count && await previous.isEnabled(); index += 1) await previous.click();
  for (let index = 0; index < count; index += 1) {
    if (await card.getByText(question.record.prompt, { exact: true }).isVisible()) return card;
    if (index + 1 < count) await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  }
  assert.fail(`Question was not shown: ${question.record.prompt}`);
};
const showQuestionList = async (page) => {
  await page.locator('[data-testid="ce-survey-view-all"]:visible, [data-testid="ce-session-questions-full-header"]:visible').first().waitFor();
  const viewAll = page.getByTestId('ce-survey-view-all');
  if (await viewAll.isVisible()) await viewAll.click();
  await page.getByTestId('ce-session-questions-full-header').waitFor();
};
const questionCard = (page, question) => page.locator('[class*="fullQuestionCard"]')
  .filter({ has: page.getByText(question.record.prompt, { exact: true }) });
const waitForSavedBookmarks = (page, slug, questionIds) => page.waitForFunction(
  ({ slug, questionIds }) => new Promise((resolve, reject) => {
    const open = indexedDB.open('ce_cache_v1');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction('ce_cache_entries_v1').objectStore('ce_cache_entries_v1').get(`dg:bookmarksCache:${slug}`);
      read.onerror = () => { db.close(); reject(read.error); };
      read.onsuccess = () => {
        db.close();
        resolve(questionIds.every((id) => read.result?.questions?.includes(id.toLowerCase())));
      };
    };
  }),
  { slug, questionIds },
);
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
  const seedQuestion = async (prompt) => {
    const question = buildQuestionRecord({
      type: 'binary', prompt, creator: admin.address,
      session: { sessionSlug: slug, sessionId: adminClient.sessionId, sessionName: config.sessionName },
    });
    assert.equal(question.ok, true);
    await adminClient.upload({
      resource: 'questions', data: question.record,
      tags: [
        { name: 'CE-SessionId', value: adminClient.sessionId },
        { name: 'CE-SessionSlug', value: slug },
        { name: 'CE-Resource', value: 'questions' },
        { name: 'CE-ResourceId', value: question.id },
      ],
    });
    return question;
  };
  const question = await seedQuestion('Community decisions should be easier to understand.');
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

  const secondQuestion = await seedQuestion('Community proposals should include their expected costs.');
  const retryFixture = passkeyFixture('partial-submit-participant');
  const responseUploads = [];
  const retryContext = await fixtureContext(retryFixture, { failResponseUploadAt: 2, responseUploads });
  page = await retryContext.newPage();
  await page.goto(sessionUrl.href, { waitUntil: 'domcontentloaded' });
  await login(page, retryFixture.wallet);
  const questions = [question, secondQuestion];
  for (const entry of questions) {
    const card = await showQuestion(page, entry, questions.length);
    await card.getByText(answer, { exact: true }).click();
  }
  for (const entry of questions) {
    const card = await showQuestion(page, entry, questions.length);
    assert.equal(await card.getByRole('radio', { name: answer, exact: true }).isChecked(), true);
  }
  await page.getByTestId('ce-survey-submit').click();
  const partialError = page.getByText(/Some answers didn't save \(/);
  await partialError.waitFor();
  assert.equal(responseUploads.length, 2, 'The first submit attempts both answers once');
  assert.deepEqual(responseUploads.map(({ status }) => status), [200, 503]);
  const unsaved = questions.find((entry) => entry.id === responseUploads[1].questionId);
  assert.ok(unsaved, 'The failed upload names one of the answered questions');
  assert.ok((await partialError.innerText()).includes(unsaved.record.prompt), 'The error names the unsaved question');
  assert.equal(await page.getByTestId('ce-survey-submit').isVisible(), true, 'Partial success keeps Submit visible');
  const retryClient = makeClient(retryFixture.wallet);
  const partialSaved = await retryClient.listAll('responses', { mine: true });
  assert.equal(partialSaved.items.length, 1, 'The answer stored before the outage remains saved');
  await page.getByTestId('ce-survey-submit').click();
  await partialError.waitFor({ state: 'hidden' });
  await page.getByTestId('ce-survey-submitted-indicator').first().waitFor();
  assert.deepEqual(responseUploads.slice(2), [{ questionId: unsaved.id, status: 200 }], 'Retry uploads only the unsaved answer');
  const retrySaved = await retryClient.listAll('responses', { mine: true });
  assert.equal(retrySaved.complete, true);
  assert.equal(retrySaved.items.length, 2, 'The completed retry stores exactly two answers');
  const retryRecords = await Promise.all(retrySaved.items.map((entry) => retryClient.read(entry.storageRef.id)));
  assert.deepEqual(retryRecords.map((entry) => entry.questionID).sort(), questions.map((entry) => entry.id).sort());
  assert.ok(retryRecords.every((entry) => entry.answer.value === answer));
  console.log('Partial submission kept the first answer and retried only the unsaved answer.');

  for (const prompt of [
    'Residents should have time to review local proposals.',
    'Meeting notes should be available in plain language.',
    'Public feedback should receive a clear response.',
    'Community projects should report their progress.',
  ]) questions.push(await seedQuestion(prompt));
  const tabA = page;
  const tabB = await retryContext.newPage();
  await Promise.all([tabA.reload({ waitUntil: 'domcontentloaded' }), tabB.goto(sessionUrl.href, { waitUntil: 'domcontentloaded' })]);
  for (const tab of [tabA, tabB]) {
    await tab.getByRole('group', { name: /^Question \d+ of 6$/ }).waitFor();
    assert.equal(await tab.evaluate(() => typeof navigator.locks?.request), 'function');
    await showQuestionList(tab);
  }
  const bookmarked = [];
  for (let pair = 0; pair < questions.length; pair += 2) {
    const cards = [questionCard(tabA, questions[pair]), questionCard(tabB, questions[pair + 1])];
    await Promise.all(cards.map((card) => card.getByRole('button', { name: 'Bookmark question', exact: true }).click()));
    bookmarked.push(questions[pair], questions[pair + 1]);
    await waitForSavedBookmarks(tabA, slug, bookmarked.map((entry) => entry.id));
    await Promise.all([tabA.reload({ waitUntil: 'domcontentloaded' }), tabB.reload({ waitUntil: 'domcontentloaded' })]);
    for (const tab of [tabA, tabB]) {
      page = tab;
      await showQuestionList(tab);
      for (const entry of bookmarked) {
        const card = questionCard(tab, entry);
        const bookmark = card.getByRole('button', { name: 'Remove bookmark', exact: true });
        await bookmark.waitFor();
        assert.equal(await bookmark.getAttribute('aria-pressed'), 'true', 'Both reloaded tabs retain every bookmark');
      }
    }
  }
  console.log('Two tabs retained all six concurrent bookmarks across three reloads.');
  await page.screenshot({ path: `${outputDir}/participant-bookmarks.png`, fullPage: true, timeout: 10000 });

  const lostReplyFixture = passkeyFixture('lost-reply-participant');
  const lostReplyUploads = [];
  const lostReplyContext = await fixtureContext(lostReplyFixture, { loseResponseUploadAt: 2, responseUploads: lostReplyUploads });
  page = await lostReplyContext.newPage();
  await page.goto(sessionUrl.href, { waitUntil: 'domcontentloaded' });
  await login(page, lostReplyFixture.wallet);
  for (const entry of questions.slice(0, 2)) {
    const card = await showQuestion(page, entry, questions.length);
    await card.getByText(answer, { exact: true }).click();
  }
  await page.getByTestId('ce-survey-submit').click();
  const lostReplyError = page.getByText(/Some answers didn't save \(/);
  await lostReplyError.waitFor();
  assert.deepEqual(lostReplyUploads.map(({ status }) => status), [200, 503]);
  const lostReplyClient = makeClient(lostReplyFixture.wallet);
  assert.equal((await lostReplyClient.listAll('responses', { mine: true })).items.length, 2, 'Both answers were stored before the reply was lost');
  await page.getByTestId('ce-survey-submit').click();
  await lostReplyError.waitFor({ state: 'hidden' });
  await page.getByTestId('ce-survey-submitted-indicator').first().waitFor();
  assert.equal(lostReplyUploads.length, 3, 'Only the answer with a lost reply is retried');
  assert.equal(lostReplyUploads[2].requestId, lostReplyUploads[1].requestId);
  assert.equal(lostReplyUploads[2].storedId, lostReplyUploads[1].storedId);
  assert.equal(lostReplyUploads[2].replayed, true, 'The Worker replays its settled receipt');
  const restoredReplies = await lostReplyClient.listAll('responses', { mine: true });
  assert.equal(restoredReplies.items.length, 2, 'A lost reply retry creates no duplicate record');
  const savedReplies = await Promise.all(restoredReplies.items.map((entry) => lostReplyClient.read(entry.storageRef.id)));
  assert.deepEqual(savedReplies.map((entry) => entry.questionID).sort(), questions.slice(0, 2).map((entry) => entry.id).sort());
  await page.screenshot({ path: `${outputDir}/participant-lost-reply.png`, fullPage: true, timeout: 10000 });
  console.log('A lost upload reply replayed the original reference without another stored answer.');
  const unavailableFixture = passkeyFixture('readiness-participant');
  const unavailableUploads = [];
  const unavailableContext = await fixtureContext(unavailableFixture, { unavailableSubmit: true, responseUploads: unavailableUploads });
  page = await unavailableContext.newPage();
  await page.goto(sessionUrl.href, { waitUntil: 'domcontentloaded' });
  await login(page, unavailableFixture.wallet);
  const unavailableCard = await showQuestion(page, question, questions.length);
  await unavailableCard.getByText(answer, { exact: true }).click();
  await page.getByTestId('ce-survey-submit').click();
  await page.getByText(/The session Worker is missing its storage index/).first().waitFor();
  assert.equal(unavailableUploads.length, 0, 'Explicit readiness refusal blocks before any answer upload');
  const retainedCard = await showQuestion(page, question, questions.length);
  assert.equal(await retainedCard.getByRole('radio', { name: answer, exact: true }).isChecked(), true, 'A readiness refusal retains the draft');
  page = await adminContext.newPage();
  const adminUrl = new URL('/admin', baseUrl);
  adminUrl.searchParams.set('sessionId', adminClient.sessionId);
  adminUrl.searchParams.set('sessionSlug', slug);
  adminUrl.searchParams.set('worker', workerOrigin);
  await page.goto(adminUrl.href, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ce-admin-session-backup').waitFor();
  const downloaded = page.waitForEvent('download', { timeout: 120000 });
  await page.getByTestId('ce-admin-backup-download').click();
  const backupPath = `${outputDir}/session-backup.jsonl`;
  await (await downloaded).saveAs(backupPath);
  const backupPages = (await readFile(backupPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(backupPages.at(-1).manifest.complete, true);
  assert.ok(backupPages.flatMap((entry) => entry.entries).some((entry) => entry.kind === 'payload'));
  await page.getByTestId('ce-admin-backup-file').setInputFiles(backupPath);
  await page.getByRole('status').filter({ hasText: 'Ready to restore' }).waitFor();
  await page.getByTestId('ce-admin-backup-restore').click();
  await page.getByRole('status').filter({ hasText: 'Restore complete.' }).waitFor({ timeout: 120000 });
  await page.getByTestId('ce-admin-session-backup').screenshot({ path: `${outputDir}/admin-backup-restore.png`, timeout: 10000 });
  const originalTheme = await page.evaluate(() => document.documentElement.getAttribute('data-ce-theme'));
  for (const theme of ['context-engine', 'classic-95', 'civic']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-ce-theme', value), theme);
    await page.getByTestId('ce-admin-session-backup').screenshot({ path: `${outputDir}/admin-backup-${theme}.png` });
  }
  await page.evaluate((value) => value ? document.documentElement.setAttribute('data-ce-theme', value) : document.documentElement.removeAttribute('data-ce-theme'), originalTheme);
  console.log('Admin downloaded a complete JSONL backup and restored it idempotently through signed requests.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('ce-admin-recovery-key-show').click();
  await page.getByRole('heading', { name: 'Save your recovery key' }).waitFor();
  assert.equal(await page.getByLabel('Recovery key', { exact: true }).getAttribute('type'), 'password');
  await page.waitForFunction(() => { const dialog = document.querySelector('[role=dialog]'); return dialog && getComputedStyle(dialog).opacity === '1'; });
  await page.getByRole('dialog').locator('.modal-content').screenshot({ path: `${outputDir}/recovery-key-masked.png` });
  for (const theme of ['context-engine', 'classic-95', 'civic']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-ce-theme', value), theme);
    await page.getByRole('dialog').locator('.modal-content').screenshot({ path: `${outputDir}/recovery-key-${theme}.png` });
  }
  await page.evaluate((value) => value ? document.documentElement.setAttribute('data-ce-theme', value) : document.documentElement.removeAttribute('data-ce-theme'), originalTheme);
  const keyDownload = page.waitForEvent('download');
  await page.getByTestId('ce-recovery-key-download').click();
  const keyPath = `${outputDir}/synthetic-recovery-key.txt`;
  await (await keyDownload).saveAs(keyPath);
  const keyFile = await readFile(keyPath, 'utf8');
  assert.ok(keyFile.includes(env.CE_STORAGE_ENVELOPE_KEK));
  assert.ok(keyFile.includes(slug) && keyFile.includes(workerOrigin) && keyFile.includes('Fingerprint:'));
  const persisted = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
  assert.ok(!persisted.includes(env.CE_STORAGE_ENVELOPE_KEK), 'The exported recovery key is not persisted in browser storage');
  await page.getByTestId('ce-recovery-key-saved').click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  console.log('Admin confirmed recovery-key export and downloaded a private copy without browser persistence.');

  const elapsedMs = Math.round(performance.now() - startedAt);
  await writeFile(
    `${outputDir}/result.json`,
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        configRevision: config.configRevision,
        elapsedMs,
        checks: [
          'signed Worker verification',
          'wizard publication and config readback',
          'fresh-context answer submission',
          'reload persistence',
          'participant Results UI',
          'author and admin readback',
          'other-participant and anonymous denial',
          'encrypted storage',
          'partial submission and unsaved-only retry',
          'lost upload reply replays the original reference with no duplicate',
          'three concurrent two-tab bookmark pairs survive reload',
          'explicit submit readiness refusal retains the draft without uploading',
          'admin JSONL download and idempotent signed restore',
          'confirmed masked recovery-key download without browser persistence',
          'backup and recovery-key screenshots in all three themes',
        ],
        responseUploads,
        lostReplyUploads,
        calls,
      },
      null,
      2,
    ),
  );
  console.log(
    `Session publication smoke passed in ${elapsedMs}ms: publication, saved answers, partial retry, lost reply, Results, permissions, two-tab bookmarks, backup/restore, and recovery-key custody.`,
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
