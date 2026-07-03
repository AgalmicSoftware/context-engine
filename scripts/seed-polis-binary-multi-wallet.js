#!/usr/bin/env node
'use strict';

const path = require('path');
const { ethers } = require('ethers');

const {
  addStep,
  createBaseReport,
  parseArgs,
  relRoot,
  resolveArtifacts,
  resolveRunTag,
  toStr,
  writeJson,
} = require('./lib/common');
const { resolveChainDefaults } = require('./lib/network-defaults');
const {
  DEFAULT_PASSKEY_RAW_ID_B64URL,
  buildPasskeyDerivedWallet,
  toPasskeyEoaSeedRecord,
} = require('./lib/passkey-derived-wallet');

const DEFAULT_PASSKEY_A = DEFAULT_PASSKEY_RAW_ID_B64URL;
const DEFAULT_PASSKEY_B = 'EBESExQVFhcYGRobHB0eHw';
const DEFAULT_PASSKEY_C = 'ICEiIyQlJicoKSorLC0uLw';
const DEFAULT_PASSKEY_D = 'MDEyMzQ1Njc4OTo7PD0-Pw';
const DEFAULT_PASSKEY_E = 'QEFCQ0RFRkdISUpLTE1OTw';

let ensureWalletFunded;
let createNonceSender;
let sleep;
let launchBrowserWithRetry;
let requirePlaywright;
let resolvePlaywrightBrowserType;
let locators;

const loadE2eRuntime = () => {
  if (locators) return;

  ({
    ensureWalletFunded,
  } = require('./lib/e2e/wallets'));
  ({ createNonceSender, sleep } = require('./lib/e2e/tx'));
  ({
    launchBrowserWithRetry,
    requirePlaywright,
    resolvePlaywrightBrowserType,
  } = require('./lib/e2e/playwright'));
  locators = require('./lib/e2e/locators');
};

const log = (...args) => console.log('[seed-polis-binary-multi-wallet]', ...args);

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value == null ? '' : value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ensureManualMode = async (page) => {
  const addBinary = locators.create.addTypeButton(page, 'binary');
  if (await addBinary.isVisible().catch(() => false)) return;
  const modeSwitch = locators.create.modeSwitch(page);
  await modeSwitch.waitFor({ state: 'visible', timeout: 45000 });
  const text = String(await modeSwitch.innerText().catch(() => '')).trim();
  if (/manual/i.test(text)) {
    await modeSwitch.click();
  }
  await addBinary.waitFor({ state: 'visible', timeout: 45000 });
};

const ensureStandaloneQuestionsMode = async (page) => {
  const titleInput = locators.create.title(page);
  const toggle = locators.create.surveyQuestionsToggle(page);
  let inSurveyMode = await titleInput.isVisible().catch(() => false);
  if (!inSurveyMode) return;
  await toggle.click();
  await sleep(500);
  inSurveyMode = await titleInput.isVisible().catch(() => false);
  if (inSurveyMode) {
    await toggle.click();
    await sleep(700);
  }
};

const openCreatePanel = async ({ page, baseUrl, sessionSlug }) => {
  await page.goto(`${baseUrl}/session/${encodeURIComponent(sessionSlug)}/questions`, {
    waitUntil: 'domcontentloaded',
  });
  const createButton = locators.survey.createToggle(page);
  const createPileButton = locators.survey.createTogglePile(page);
  if (await createButton.isVisible().catch(() => false)) {
    await createButton.click();
  } else {
    await createPileButton.waitFor({ state: 'visible', timeout: 60000 });
    await createPileButton.click();
  }
  await locators.create.panel(page).waitFor({ state: 'visible', timeout: 60000 });
  await ensureManualMode(page);
  await ensureStandaloneQuestionsMode(page);
  const clearBtn = locators.create.clear(page);
  if (await clearBtn.isVisible().catch(() => false)) {
    await clearBtn.click().catch(() => {});
    await sleep(500);
  }
};

const createBinaryStandaloneQuestions = async ({ page, baseUrl, sessionSlug, prompts }) => {
  await openCreatePanel({ page, baseUrl, sessionSlug });
  const uploadedItems = locators.create.uploadedQuestionItems(page);
  const existingIds = await uploadedItems.evaluateAll((nodes) =>
    nodes
      .map((n) => (n.getAttribute('data-ce-question-id') || '').trim().toLowerCase())
      .filter((v) => /^0x[a-f0-9]{64}$/i.test(v)),
  );
  const existingSet = new Set(existingIds);

  for (let i = 0; i < prompts.length; i += 1) {
    await locators.create.addTypeButton(page, 'binary').click();
  }

  const containers = locators.create.questionContainers(page);
  const count = await containers.count();
  if (count < prompts.length) {
    throw new Error(`Expected at least ${prompts.length} question containers, found ${count}.`);
  }

  for (let i = 0; i < prompts.length; i += 1) {
    const container = containers.nth(i);
    await locators.create.questionPrompt(container).fill(prompts[i]);
  }

  const submit = locators.create.submit(page);
  await submit.waitFor({ state: 'visible', timeout: 60000 });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  await locators.create.success(page).waitFor({ state: 'visible', timeout: 240000 });

  const allIds = await uploadedItems.evaluateAll((nodes) =>
    nodes
      .map((n) => (n.getAttribute('data-ce-question-id') || '').trim().toLowerCase())
      .filter((v) => /^0x[a-f0-9]{64}$/i.test(v)),
  );
  const newIds = allIds.filter((id) => !existingSet.has(id));

  let selectedIds = newIds;
  if (selectedIds.length < prompts.length && allIds.length >= prompts.length) {
    // Fallback to tail selection when the panel includes pre-existing uploads.
    selectedIds = allIds.slice(-prompts.length);
  }
  if (selectedIds.length < prompts.length) {
    throw new Error(`Created questions but found only ${selectedIds.length} new IDs (expected ${prompts.length}).`);
  }

  return selectedIds.slice(0, prompts.length).map((questionId, idx) => ({
    questionId,
    prompt: prompts[idx],
    type: 'binary',
    options: ['Agree', 'Disagree'],
    singleSelect: true,
    tags: ['polis-binary'],
  }));
};

const seedRecentQuestionPayloads = async (page, rows, walletAddress) => {
  if (!page || !Array.isArray(rows) || rows.length === 0) return;
  const normalizedWallet = String(walletAddress || '').trim().toLowerCase();
  if (!normalizedWallet) return;
  const payloadRows = rows
    .map((row) => {
      const id = String(row?.questionId || '').trim().toLowerCase();
      if (!id) return null;
      return {
        id,
        type: String(row?.type || '').trim().toLowerCase(),
        prompt: row?.prompt == null ? '' : String(row.prompt),
        options: Array.isArray(row?.options) ? row.options : [],
        singleSelect: row?.singleSelect ?? null,
        tags: Array.isArray(row?.tags) ? row.tags : [],
        creator: normalizedWallet,
      };
    })
    .filter(Boolean);
  if (!payloadRows.length) return;
  await page.evaluate(({ storageKey, questionRows }) => {
    const now = Date.now();
    let next = {};
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        next = { ...parsed };
      }
    } catch (_) {}
    questionRows.forEach((row) => {
      next[row.id] = {
        ...row,
        id: row.id,
        savedAtMs: now,
      };
    });
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch (_) {}
  }, {
    storageKey: 'dg:recentQuestionPayloads',
    questionRows: payloadRows,
  });
};

const waitForSubmitted = async (page, timeoutMs = 120000) => {
  const submitBtn = locators.survey.submit(page);
  const submitted = locators.survey.submittedIndicator(page);
  const startFresh = locators.survey.startFresh(page);
  const existingResponseNotice = locators.survey.existingResponseNotice(page);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const submittedVisible = await submitted.isVisible().catch(() => false);
    if (submittedVisible) return true;
    const startFreshVisible = await startFresh.isVisible().catch(() => false);
    if (startFreshVisible) return true;
    const existingResponseVisible = await existingResponseNotice.isVisible().catch(() => false);
    if (existingResponseVisible) return true;
    const label = String(await submitBtn.innerText().catch(() => '')).trim().toLowerCase();
    if (label.includes('submitted')) return true;
    if (label.includes('failed')) return false;
    await sleep(1000);
  }
  return false;
};

const findBinaryLabel = async ({ scope, preferAgree }) => {
  const preferred = preferAgree ? ['Agree', 'Yes'] : ['Disagree', 'No'];
  const all = preferAgree
    ? ['Agree', 'Yes', 'Support', 'Disagree', 'No', 'Oppose']
    : ['Disagree', 'No', 'Oppose', 'Agree', 'Yes', 'Support'];

  for (const label of all) {
    const candidate = scope.locator('label', { hasText: label }).first();
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) continue;
    return { locator: candidate, label, preferred: preferred.includes(label) };
  }

  return null;
};

const clickBinaryChoice = async ({ page, questionId, preferAgree }) => {
  const qid = String(questionId || '').trim().toLowerCase();
  const scoped = qid
    ? page.locator(`[data-ce-question-id="${qid}"]`).first()
    : null;
  const scopes = [];
  if (scoped) scopes.push(scoped);
  scopes.push(page);

  for (const scope of scopes) {
    const radioPreference = preferAgree
      ? ['Agree', 'Disagree', 'Unsure']
      : ['Disagree', 'Agree', 'Unsure'];
    for (const value of radioPreference) {
      const radio = scope.locator(`input[type="radio"][value="${value}"]:not([disabled])`).first();
      const radioVisible = await radio.isVisible().catch(() => false);
      if (!radioVisible) continue;
      try {
        await radio.check({ force: true });
        return { locator: radio, label: value, preferred: value === (preferAgree ? 'Agree' : 'Disagree') };
      } catch (_) {
        // Fall through to label click fallback.
      }
    }

    const pick = await findBinaryLabel({ scope, preferAgree });
    if (!pick) continue;
    await pick.locator.click();
    return pick;
  }
  return null;
};

const submitBinaryResponse = async ({
  page,
  baseUrl,
  sessionSlug,
  questionId,
  preferAgree,
}) => {
  const urlWithSession = `${baseUrl}/question/${encodeURIComponent(questionId)}?session=${encodeURIComponent(sessionSlug)}`;
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    log('response attempt start', { questionId, attempt, preferAgree });
    await page.goto(urlWithSession, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(1000);
    const startFresh = locators.survey.startFresh(page);
    if (await startFresh.isVisible().catch(() => false)) {
      await startFresh.click().catch(() => {});
      await sleep(500);
    }

    const picked = await clickBinaryChoice({ page, questionId, preferAgree });
    if (!picked) {
      log('response attempt label-miss', { questionId, attempt, preferAgree });
      await sleep(900 * attempt);
      continue;
    }

    const submitBtn = locators.survey.submit(page);
    await submitBtn.waitFor({ state: 'visible', timeout: 60000 });
    const disabled = await submitBtn.isDisabled().catch(() => false);
    if (disabled) {
      log('response attempt submit-disabled', { questionId, attempt });
      await sleep(700 * attempt);
      continue;
    }
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();
    const submitted = await waitForSubmitted(page, 120000);
    if (submitted) {
      log('response submitted', { questionId, attempt, answerLabel: picked.label });
      return { ok: true, answerLabel: picked.label, preferredLabel: picked.preferred, attempt };
    }
    log('response attempt submit-timeout', { questionId, attempt, answerLabel: picked.label });
    await sleep(1000 * attempt);
  }

  return { ok: false, answerLabel: null, preferredLabel: false, attempt: attempts };
};

const createContextForWallet = async ({ browser, wallet }) => {
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1100 },
    serviceWorkers: 'block',
  });

  await context.addInitScript(({ passkeyWalletSeed }) => {
    let seededPrfOutput = null;
    const fromBase64Url = (value) => {
      const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const raw = atob(padded);
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
      return out;
    };
    const openWalletDb = () => new Promise((resolve, reject) => {
      const request = indexedDB.open('ce_passkey_wallet_db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('wallet_records')) db.createObjectStore('wallet_records');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const writeWalletRecord = async (record) => {
      const db = await openWalletDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('wallet_records', 'readwrite');
        tx.objectStore('wallet_records').put(record, 'active');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    };
    const toArrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    window.__CE_PASSKEY_WALLET_E2E_SEED_READY__ = (async () => {
      if (!passkeyWalletSeed?.credentialId || !passkeyWalletSeed?.prfOutput || !passkeyWalletSeed?.address) return;
      seededPrfOutput = toArrayBuffer(fromBase64Url(passkeyWalletSeed.prfOutput));
      const now = new Date().toISOString();
      const rpId = String(passkeyWalletSeed.rpId || 'localhost');
      const address = String(passkeyWalletSeed.address);
      await writeWalletRecord({
        id: `derived-wallet:${rpId}:${address.toLowerCase()}`,
        rpId,
        credentialId: passkeyWalletSeed.credentialId,
        evmAddress: address,
        keyMode: 'passkey-derived',
        derivationVersion: 'passkey-prf-hkdf-secp256k1-v1',
        prfSalt: passkeyWalletSeed.prfSalt,
        createdAt: now,
        updatedAt: now,
      });
    })();

    try {
      window.__CE_PASSKEY_WALLET_E2E_SEED_ADDRESS__ = passkeyWalletSeed?.address || '';
    } catch (_) {}

    const rawId = fromBase64Url(passkeyWalletSeed?.credentialId || '');
    const fakeCredential = {
      rawId: rawId.buffer,
      getClientExtensionResults: () => ({
        prf: { enabled: true, results: { first: seededPrfOutput } },
      }),
    };
    try {
      if (!window.PublicKeyCredential) {
        window.PublicKeyCredential = function PublicKeyCredential() {};
      }
    } catch (_) {}
    try {
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: {
          create: async () => fakeCredential,
          get: async () => fakeCredential,
        },
      });
    } catch (_) {
      try {
        // eslint-disable-next-line no-param-reassign
        navigator.credentials = {
          create: async () => fakeCredential,
          get: async () => fakeCredential,
        };
      } catch (_) {}
    }
  }, {
    passkeyWalletSeed: toPasskeyEoaSeedRecord({
      credentialId: wallet.rawIdB64Url,
      address: wallet.address,
    }),
  });

  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  return { context, page };
};

const buildPrompts = ({ runTag, count }) => {
  const topics = [
    'Should frontier model releases require external safety evaluations?',
    'Should high-risk model APIs require stricter identity verification?',
    'Should incident reports be mandatory within 72 hours?',
    'Should synthetic media provenance be mandatory at platform level?',
    'Should capability thresholds govern staged rollout access?',
    'Should audits include public red-team summaries?',
  ];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const topic = topics[i % topics.length];
    out.push(`${topic} [polis-binary ${i + 1} | ${runTag}]`);
  }
  return out;
};

const resolveSessionSlug = ({ args = {}, env = process.env } = {}) => {
  const sessionSlug = toStr(args['session-slug'] || env.SESSION_SLUG).trim();
  if (!sessionSlug) {
    throw new Error(
      'Missing session slug. Set --session-slug or SESSION_SLUG. ' +
      'This seed flow no longer defaults to a legacy fixture slug.'
    );
  }
  return sessionSlug;
};

async function main() {
  loadE2eRuntime();

  const args = parseArgs(process.argv);
  const runTag = resolveRunTag(args);
  const baseUrl = toStr(args['base-url'] || process.env.BASE_URL || 'http://127.0.0.1:3000').trim().replace(/\/+$/, '');
  const sessionSlug = resolveSessionSlug({ args, env: process.env });

  const questionCount = clamp(toInt(args['question-count'] || process.env.BINARY_QUESTION_COUNT, 4), 1, 12);
  const chain = resolveChainDefaults({ args });
  const artifacts = resolveArtifacts({ runTag, baseName: 'polis-binary-multi-wallet' });

  const report = createBaseReport({
    flowId: 'CE-E2E-POLIS-BINARY-MULTI-WALLET',
    runner: path.basename(__filename),
    runTag,
    chain: {
      mode: chain.chainMode,
      chainId: chain.chainId,
      rpcUrl: chain.rpcUrl,
    },
    inputs: {
      baseUrl,
      sessionSlug,
      questionCount,
    },
    outputs: {
      json: relRoot(artifacts.json),
      screenshot: relRoot(artifacts.png),
      errorScreenshot: relRoot(artifacts.errorPng),
    },
  });
  writeJson(artifacts.json, report);

  const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== Number(chain.chainId)) {
    throw new Error(`Chain mismatch: expected ${chain.chainId}, got ${network.chainId}`);
  }

  const passkeyA = toStr(args['passkey-a'] || process.env.PASSKEY_A || DEFAULT_PASSKEY_A).trim() || DEFAULT_PASSKEY_A;
  const passkeyB = toStr(args['passkey-b'] || process.env.PASSKEY_B || DEFAULT_PASSKEY_B).trim() || DEFAULT_PASSKEY_B;
  const passkeyC = toStr(args['passkey-c'] || process.env.PASSKEY_C || DEFAULT_PASSKEY_C).trim() || DEFAULT_PASSKEY_C;
  const passkeyD = toStr(args['passkey-d'] || process.env.PASSKEY_D || DEFAULT_PASSKEY_D).trim() || DEFAULT_PASSKEY_D;
  const passkeyE = toStr(args['passkey-e'] || process.env.PASSKEY_E || DEFAULT_PASSKEY_E).trim() || DEFAULT_PASSKEY_E;

  const walletA = buildPasskeyDerivedWallet(passkeyA, provider);
  const walletB = buildPasskeyDerivedWallet(passkeyB, provider);
  const walletC = buildPasskeyDerivedWallet(passkeyC, provider);
  const walletD = buildPasskeyDerivedWallet(passkeyD, provider);
  const walletE = buildPasskeyDerivedWallet(passkeyE, provider);
  const walletSet = [
    { key: 'A', info: walletA },
    { key: 'B', info: walletB },
    { key: 'C', info: walletC },
    { key: 'D', info: walletD },
    { key: 'E', info: walletE },
  ];

  report.wallets = walletSet.reduce((acc, entry) => {
    acc[entry.key] = { address: entry.info.address };
    return acc;
  }, {});
  writeJson(artifacts.json, report);

  const gasPrice = await provider.getGasPrice();
  const sendFromA = await createNonceSender({
    provider,
    address: walletA.address,
    txOverrides: { gasPrice },
    attempts: 5,
  });
  const minBalanceEth = toStr(args['min-balance-eth'] || process.env.MIN_BALANCE_ETH || '0.0002').trim() || '0.0002';
  const fundAmountEth = toStr(args['fund-amount-eth'] || process.env.FUND_AMOUNT_ETH || '0.001').trim() || '0.001';

  const fundResults = {};
  for (const target of [walletB, walletC, walletD, walletE]) {
    // eslint-disable-next-line no-await-in-loop
    const funded = await ensureWalletFunded({
      provider,
      funder: walletA.wallet,
      recipient: target.wallet,
      sendTx: sendFromA,
      minBalanceEth,
      fundAmountEth,
    });
    fundResults[target.address] = funded;
  }
  addStep(report, {
    phase: 'fund-wallets',
    minBalanceEth,
    fundAmountEth,
    fundResults,
  });
  writeJson(artifacts.json, report);

  const prompts = buildPrompts({ runTag, count: questionCount });
  const playwright = requirePlaywright();
  const { browserName } = resolvePlaywrightBrowserType(playwright);
  log('launching browser', { browserName, sessionSlug, questionCount });
  const browser = await launchBrowserWithRetry({ playwright, browserName });

  const runErrors = [];
  const responseRows = [];
  let createdQuestions = [];
  let screenshotCaptured = false;

  try {
    const creator = await createContextForWallet({ browser, wallet: walletA });
    try {
      createdQuestions = await createBinaryStandaloneQuestions({
        page: creator.page,
        baseUrl,
        sessionSlug,
        prompts,
      });
      addStep(report, {
        phase: 'created-binary-questions',
        sessionSlug,
        questionIds: createdQuestions.map((q) => q.questionId),
      });
      await creator.page.screenshot({ path: artifacts.png, fullPage: true }).catch(() => {});
      screenshotCaptured = true;
      writeJson(artifacts.json, report);
      await seedRecentQuestionPayloads(creator.page, createdQuestions, walletA.address);
    } finally {
      await creator.context.close().catch(() => {});
    }

    for (let walletIndex = 0; walletIndex < walletSet.length; walletIndex += 1) {
      const walletEntry = walletSet[walletIndex];
      const walletKey = walletEntry.key;
      const walletInfo = walletEntry.info;
      const walletPreferAgree = (walletIndex % 2) === 0;
      log('wallet response pass start', { wallet: walletKey, address: walletInfo.address });
      const scoped = await createContextForWallet({ browser, wallet: walletInfo });
      try {
        await scoped.page.goto(`${baseUrl}/session/${encodeURIComponent(sessionSlug)}/questions`, {
          waitUntil: 'domcontentloaded',
        }).catch(() => {});
        await seedRecentQuestionPayloads(scoped.page, createdQuestions, walletInfo.address);
        const walletFailures = [];

        for (let qIdx = 0; qIdx < createdQuestions.length; qIdx += 1) {
          const row = createdQuestions[qIdx];
          const preferAgree = walletPreferAgree;
          // eslint-disable-next-line no-await-in-loop
          const res = await submitBinaryResponse({
            page: scoped.page,
            baseUrl,
            sessionSlug,
            questionId: row.questionId,
            preferAgree,
          });
          if (!res.ok) {
            const failure = {
              wallet: walletKey,
              address: walletInfo.address,
              questionId: row.questionId,
              error: 'submit failed',
            };
            runErrors.push(failure);
            walletFailures.push({
              questionId: row.questionId,
              preferAgree,
              responseIndex: responseRows.length,
            });
            log('wallet response failed', { wallet: walletKey, questionId: row.questionId });
          }
          responseRows.push({
            wallet: walletKey,
            address: walletInfo.address,
            questionId: row.questionId,
            preferAgree,
            answerLabel: res.answerLabel,
            submitted: !!res.ok,
            attempt: res.attempt,
          });
        }
        // Retry failed questions once after the wallet has answered the rest.
        for (const failed of walletFailures) {
          // eslint-disable-next-line no-await-in-loop
          const retry = await submitBinaryResponse({
            page: scoped.page,
            baseUrl,
            sessionSlug,
            questionId: failed.questionId,
            preferAgree: failed.preferAgree,
          });
          if (!retry.ok) {
            log('wallet response final-fail', { wallet: walletKey, questionId: failed.questionId });
            continue;
          }
          const row = responseRows[failed.responseIndex] || null;
          if (row) {
            row.submitted = true;
            row.answerLabel = retry.answerLabel;
            row.attempt = retry.attempt;
          }
          const errIndex = runErrors.findIndex(
            (entry) => (
              entry &&
              entry.wallet === walletKey &&
              entry.questionId === failed.questionId &&
              entry.error === 'submit failed'
            ),
          );
          if (errIndex >= 0) runErrors.splice(errIndex, 1);
          log('wallet response recovered', {
            wallet: walletKey,
            questionId: failed.questionId,
            retryAttempt: retry.attempt,
          });
        }
        log('wallet response pass complete', { wallet: walletKey });
      } catch (err) {
        runErrors.push({
          wallet: walletKey,
          address: walletInfo.address,
          error: err?.message || String(err),
        });
        log('wallet response pass error', { wallet: walletKey, error: err?.message || String(err) });
      } finally {
        await scoped.context.close().catch(() => {});
      }
    }
  } catch (err) {
    runErrors.push({ error: err?.message || String(err) });
  } finally {
    await browser.close().catch(() => {});
  }

  report.outputs.createdQuestions = createdQuestions.map((q) => ({
    questionId: q.questionId,
    prompt: q.prompt,
    type: q.type,
  }));
  report.outputs.responses = responseRows;
  report.outputs.responseCount = responseRows.filter((r) => r.submitted).length;
  report.outputs.walletCount = walletSet.length;
  report.outputs.errorCount = runErrors.length;
  report.outputs.errors = runErrors;

  if (runErrors.length) {
    addStep(report, { phase: 'completed-with-errors', errors: runErrors });
  } else {
    addStep(report, { phase: 'completed', created: createdQuestions.length, responses: responseRows.length });
  }

  writeJson(artifacts.json, report);
  const summary = {
    ok: runErrors.length === 0,
    flowId: report.flowId,
    sessionSlug,
    wallets: walletSet.map((w) => ({ key: w.key, address: w.info.address })),
    questionIds: createdQuestions.map((q) => q.questionId),
    submittedResponses: responseRows.filter((r) => r.submitted).length,
    errors: runErrors,
    outJson: relRoot(artifacts.json),
    outPng: screenshotCaptured ? relRoot(artifacts.png) : null,
  };
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
  });
}

module.exports = {
  resolveSessionSlug,
};
