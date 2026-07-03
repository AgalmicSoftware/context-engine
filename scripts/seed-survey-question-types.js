#!/usr/bin/env node

/*
Seed a survey that includes question coverage for:
- binary
- rating
- multichoice (multi-select)
- multichoice (single-select)
- freeform

This is a UI-level routine (Playwright) intended for repeatable agent testing.

Outputs:
- artifacts/session-workflows/survey-question-types-<runTag>.json
- artifacts/screenshots/survey-question-types-<runTag>.png
*/

const fs = require('fs');
const path = require('path');
const {
  dedupeRpcUrls,
  normalizeRpcUrl,
  resolveRpcRewriteConfig,
} = require('./lib/rpc-rewrite-config');
const { resolveSeedPasskeyRawId } = require('./lib/e2e/passkey-env');
const {
  buildPasskeyDerivedWallet,
  toPasskeyEoaSeedRecord,
} = require('./lib/passkey-derived-wallet');
const {
  launchBrowserWithRetry,
  requirePlaywright,
  resolvePlaywrightBrowserType,
  resolvePlaywrightExecutablePath,
} = require('./lib/e2e/playwright');
const {
  ensureRealArweaveUploadsForManualFollowup,
} = require('./lib/e2e/arweave-mode');
const {
  installE2eArweaveMockRoutesIfEnabled,
} = require('./lib/e2e/arweave-mock-routes');
const locators = require('./lib/e2e/locators');

const ROOT = path.resolve(__dirname, '..');
const DEMO_SESSIONS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'demo', 'demo_sessions.json');

const DEFAULTS = Object.freeze({
  baseUrl: 'http://127.0.0.1:3000',
  sessionSlug: 'general',
  // Same fixture rawId used by scripts/ai-wallet.js.
  passkeyRawIdB64Url: 'AQIDBAUGBwgJCgsMDQ4PEA',
});

const log = (...args) => console.log('[seed-survey-question-types]', ...args);
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBool = (value) => /^(1|true|yes|y)$/i.test(String(value || '').trim());

const settleWithTimeout = async (fn, timeoutMs) => {
  if (typeof fn !== 'function') return null;
  const ms = Math.max(0, Number(timeoutMs) || 0);
  if (!ms) {
    return Promise.resolve()
      .then(fn)
      .catch(() => null);
  }
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve()
        .then(fn)
        .catch(() => null),
      new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
        // Ensure the timeout itself never keeps the Node process alive.
        if (timer && typeof timer.unref === 'function') timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const getCliArgValue = (name) => {
  const flag = `--${String(name || '').trim()}`;
  if (!flag || flag === '--') return '';
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return '';
  const value = process.argv[idx + 1];
  if (value == null || String(value).startsWith('--')) return '';
  return String(value).trim();
};

const normalizeWorkerUrl = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const pathPart = parsed.pathname.replace(/\/+$/, '');
    if (!pathPart || pathPart === '/') return parsed.origin;
    return `${parsed.origin}${pathPart}`;
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

const nowTag = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const waitForWalletDisplayAddress = async (page, expectedAddr, { timeoutMs = 240000, label = 'wallet-check' } = {}) => {
  const expected = String(expectedAddr || '').trim().toLowerCase();
  if (!expected) throw new Error(`${label}: expected wallet address is empty`);
  const display = locators.wallet.display(page);
  await display.waitFor({ state: 'visible', timeout: timeoutMs });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const got = String(await display.getAttribute('data-ce-wallet-address').catch(() => '')).trim().toLowerCase();
    if (got && got === expected) return true;
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(750);
  }

  const got = await display.getAttribute('data-ce-wallet-address').catch(() => null);
  throw new Error(`${label}: wallet display mismatch (expected ${expected}, got ${String(got || '')})`);
};

const readArweaveJwkJson = () => {
  const jwkPath = String(process.env.ARWEAVE_JWK_PATH || '').trim();
  const fromPath = jwkPath ? fs.readFileSync(jwkPath, 'utf8') : '';
  const raw = fromPath || String(process.env.ARWEAVE_JWK_JSON || process.env.ARWEAVE_JWK || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('jwk not object');
    return JSON.stringify(parsed);
  } catch (err) {
    throw new Error(`Invalid ARWEAVE_JWK JSON: ${err?.message || err}`);
  }
};

const readDemoSessionTemplate = () => {
  try {
    const raw = fs.readFileSync(DEMO_SESSIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const general = parsed && typeof parsed === 'object' ? parsed.general : null;
    return general && typeof general === 'object' ? general : null;
  } catch (_) {
    return null;
  }
};

async function main() {
  ensureRealArweaveUploadsForManualFollowup({
    env: process.env,
    contextLabel: 'seed-survey-question-types',
  });

  const baseUrl = String(getCliArgValue('base-url') || process.env.BASE_URL || DEFAULTS.baseUrl).replace(/\/+$/, '');
  const sessionSlug = String(getCliArgValue('session-slug') || process.env.SESSION_SLUG || DEFAULTS.sessionSlug).trim();
  const runTag = String(process.env.AI_RUN_TAG || process.env.RUN_TAG || '').trim() || nowTag();
  const workerUrlOverride = normalizeWorkerUrl(process.env.WORKER_URL || '');
  const demoTemplate = readDemoSessionTemplate();
  const arweaveJwkJson = readArweaveJwkJson();
  const outJson = path.join(ROOT, 'artifacts', 'session-workflows', `survey-question-types-${runTag}.json`);
  const outPng = path.join(ROOT, 'artifacts', 'screenshots', `survey-question-types-${runTag}.png`);
  const outErrorPng = outPng.replace(/\.png$/i, '-error.png');

  const passkeySelection = resolveSeedPasskeyRawId({
    env: process.env,
    defaultRawId: DEFAULTS.passkeyRawIdB64Url,
  });
  const rawIdB64Url = String(passkeySelection.rawId || '').trim() || DEFAULTS.passkeyRawIdB64Url;
  const wallet = buildPasskeyDerivedWallet(rawIdB64Url);
  const passkeyWalletSeed = toPasskeyEoaSeedRecord({
    credentialId: wallet.credentialId,
    address: wallet.address,
  });

  const playwright = requirePlaywright();
  const { browserName, browserType } = resolvePlaywrightBrowserType(playwright);
  const wsEndpoint = String(process.env.PLAYWRIGHT_WS_ENDPOINT || '').trim();
  const sharedBrowser = !!wsEndpoint && browserName === 'chromium';
  const executablePath = String(process.env.PLAYWRIGHT_EXECUTABLE_PATH || '').trim()
    || (browserName === 'chromium' ? resolvePlaywrightExecutablePath() : '');
  const launchAttempts = Math.max(1, Number.parseInt(String(process.env.PLAYWRIGHT_LAUNCH_ATTEMPTS || '3').trim(), 10) || 3);
  const launchTimeoutMs = Math.max(5000, Number.parseInt(String(process.env.PLAYWRIGHT_LAUNCH_TIMEOUT_MS || '60000').trim(), 10) || 60000);
  // Keep PATH-first ordering disabled by default for browser E2E unless E2E_PREFER_PATH_RPC=1.
  // Also skip rewrite-to-browser when RPC_URL points at a browser-hostile Base-hosted endpoint unless forced.
  const {
    chainId: rpcRewriteChainId,
    preferPathRpc,
    rpcUrlOverride,
    rpcRewriteTarget,
    rewriteTargets,
    browserUnsafeRpcTargets,
  } = resolveRpcRewriteConfig({ env: process.env });
  const rewriteMatchers = rpcRewriteTarget
    ? rewriteTargets.map((from) => ({ from, re: new RegExp(`^${escapeRegex(from)}(?:/|\\?|$)`, 'i') }))
    : [];
  if (rpcUrlOverride && !rpcRewriteTarget) {
    log('rpc rewrite disabled (browser-unsafe target); set FORCE_BROWSER_RPC_REWRITE=1 to override', {
      chainId: rpcRewriteChainId,
      target: rpcUrlOverride,
      unsafeTargets: browserUnsafeRpcTargets,
    });
  }
  if (!executablePath) {
    log('playwright executablePath unresolved; relying on Playwright default browser lookup');
  }
  log('playwright launch config', {
    browserName,
    executablePath: executablePath || null,
    hostPlatformOverride: String(process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE || '').trim() || null,
    launchAttempts,
    launchTimeoutMs,
  });
  log('starting', {
    runTag,
    baseUrl,
    wallet: wallet.address,
    passkeySource: passkeySelection.source,
    ignoredLegacyPasskeyEnv: !!passkeySelection.ignoredLegacy,
    sessionSlug: sessionSlug || null,
    arweaveLocalKeySeeded: !!arweaveJwkJson,
    rpcRewriteChainId,
    rpcRewriteEnabled: !!(rpcRewriteTarget && rewriteMatchers.length),
  });

  if (wsEndpoint && !sharedBrowser) {
    log('ignoring PLAYWRIGHT_WS_ENDPOINT for non-chromium browser', { browserName });
  }
  const browser = sharedBrowser
    ? await browserType.connect(wsEndpoint)
    : await launchBrowserWithRetry({ playwright, browserName, executablePath });

  const context = await browser.newContext({
    viewport: { width: 1500, height: 1100 },
    serviceWorkers: 'block',
  });
  if (rpcRewriteTarget && rewriteMatchers.length) {
    await context.route('**/*', async (route) => {
      const req = route.request();
      const reqUrl = String(req?.url?.() || '');
      const match = rewriteMatchers.find((m) => m.re.test(reqUrl));
      if (!match) {
        await route.continue();
        return;
      }
      const suffix = reqUrl.slice(match.from.length);
      const rewritten = `${rpcRewriteTarget}${suffix}`;
      await route.continue({ url: rewritten }).catch(async () => {
        await route.continue();
      });
    });
    log('rpc rewrite enabled', {
      to: rpcRewriteTarget,
      from: rewriteMatchers.map((m) => m.from),
    });
  }
  await installE2eArweaveMockRoutesIfEnabled({
    context,
    env: process.env,
    log,
  });

  // Seed a deterministic passkey wallet session + stub WebAuthn for headless runs.
  await context.addInitScript(({ passkeyWalletSeedRecord, resourceKeysSeed, rpcRewrite, sessionRegistrySeed, preferPathRpc: preferPathRpcSeed }) => {
    const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
    const applyRpcRewrite = (() => {
      const cfg = rpcRewrite && typeof rpcRewrite === 'object' ? rpcRewrite : null;
      const to = normalizeUrl(cfg?.to || '');
      const from = Array.isArray(cfg?.from)
        ? cfg.from.map((x) => normalizeUrl(x)).filter(Boolean)
        : [];
      if (!to || !from.length) return null;
      return (raw) => {
        const input = String(raw || '');
        for (const base of from) {
          if (input === base || input.startsWith(`${base}/`) || input.startsWith(`${base}?`)) {
            return `${to}${input.slice(base.length)}`;
          }
        }
        return input;
      };
    })();

    // Keep Pocket-first PATH RPC ordering disabled by default for E2E (public gateways are rate-limited / flaky).
    // Can be re-enabled by setting E2E_PREFER_PATH_RPC=1.
    try { globalThis.CE_PREFER_PATH_RPC = !!preferPathRpcSeed; } catch (_) {}

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
      if (!passkeyWalletSeedRecord?.credentialId || !passkeyWalletSeedRecord?.prfOutput || !passkeyWalletSeedRecord?.address) return;
      seededPrfOutput = toArrayBuffer(fromBase64Url(passkeyWalletSeedRecord.prfOutput));
      const now = new Date().toISOString();
      const rpId = String(passkeyWalletSeedRecord.rpId || 'localhost');
      const address = String(passkeyWalletSeedRecord.address);
      await writeWalletRecord({
        id: `derived-wallet:${rpId}:${address.toLowerCase()}`,
        rpId,
        credentialId: passkeyWalletSeedRecord.credentialId,
        evmAddress: address,
        keyMode: 'passkey-derived',
        derivationVersion: 'passkey-prf-hkdf-secp256k1-v1',
        prfSalt: passkeyWalletSeedRecord.prfSalt,
        createdAt: now,
        updatedAt: now,
      });
    })();

    // Match the shared E2E browser seed so cold-loading /session/<slug> does not
    // open the onboarding overlay over the create controls.
    try { localStorage.setItem('firstVisit', 'false'); } catch (_) {}
    try { sessionStorage.setItem('firstVisit', 'false'); } catch (_) {}
    try { sessionStorage.setItem('hasRedirectedToDemo', 'true'); } catch (_) {}

    // Optional: force local Arweave key for this run so CreateSurvey uploads do not depend on
    // session-sponsored worker secrets.
    if (resourceKeysSeed && typeof resourceKeysSeed === 'object') {
      try {
        const storageKey = 'ce:resourceKeys:v1';
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        const bySession = parsed && typeof parsed.bySession === 'object' && parsed.bySession
          ? parsed.bySession
          : {};
        const ensureEntry = (slug) => {
          const key = typeof slug === 'string' ? slug : '';
          const current = bySession[key] && typeof bySession[key] === 'object' ? bySession[key] : {};
          bySession[key] = {
            rpc: {
              useLocal: !!(current.rpc && current.rpc.useLocal),
              apiKey: String((current.rpc && current.rpc.apiKey) || ''),
            },
            arweave: {
              useLocal: !!resourceKeysSeed.useLocalArweave,
              jwk: String(resourceKeysSeed.arweaveJwk || ''),
            },
            faucet: {
              useLocal: !!(current.faucet && current.faucet.useLocal),
              privateKey: String((current.faucet && current.faucet.privateKey) || ''),
              rpcUrl: String((current.faucet && current.faucet.rpcUrl) || ''),
              amountEth: String((current.faucet && current.faucet.amountEth) || ''),
              balanceThresholdEth: String((current.faucet && current.faucet.balanceThresholdEth) || ''),
            },
          };
        };

        if (resourceKeysSeed.sessionSlug) ensureEntry(String(resourceKeysSeed.sessionSlug));
        if (Object.prototype.hasOwnProperty.call(resourceKeysSeed, 'generalSlug')) {
          ensureEntry(String(resourceKeysSeed.generalSlug));
        }

      localStorage.setItem(storageKey, JSON.stringify({ v: 1, bySession, byGroup: bySession }));
      } catch (_) {}
    }

    // Force the app to resolve the dedicated session CORS worker without relying on
    // on-chain registry cache hydration (which can be flaky under RPC rate limits).
    if (sessionRegistrySeed && typeof sessionRegistrySeed === 'object') {
      try {
        const slug = String(sessionRegistrySeed.slug || '').trim();
        const config = sessionRegistrySeed.config && typeof sessionRegistrySeed.config === 'object'
          ? sessionRegistrySeed.config
          : null;
        if (slug && config) {
          const cacheKey = 'dg:sessionRegistryCache:v1';
          const raw = localStorage.getItem(cacheKey);
          const parsed = raw ? JSON.parse(raw) : null;
          const cache = (parsed && typeof parsed === 'object') ? parsed : {};
          if (!cache.sessions && cache.groups) cache.sessions = cache.groups;
          if (!cache.groups && cache.sessions) cache.groups = cache.sessions;
          cache.sessions = (cache.sessions && typeof cache.sessions === 'object') ? cache.sessions : {};
          cache.groups = (cache.groups && typeof cache.groups === 'object') ? cache.groups : cache.sessions;
          cache.sessionsById = (cache.sessionsById && typeof cache.sessionsById === 'object') ? cache.sessionsById : {};
          cache.chains = (cache.chains && typeof cache.chains === 'object') ? cache.chains : {};
          cache.ts = Date.now();

          const prevCfg = cache.sessions[slug] && typeof cache.sessions[slug] === 'object'
            ? cache.sessions[slug]
            : null;
          const nextCfg = { ...(prevCfg || {}), ...config, slug };
          cache.sessions[slug] = nextCfg;
          cache.groups[slug] = nextCfg;
          localStorage.setItem(cacheKey, JSON.stringify(cache));
        }
      } catch (_) {}
    }

    // Ensure app-side RPC calls (fetch/XHR) are forced to the desired endpoint even when
    // they bypass Playwright network routing through internal request wrappers.
    if (applyRpcRewrite) {
      try {
        const origFetch = window.fetch ? window.fetch.bind(window) : null;
        if (origFetch) {
          window.fetch = (...args) => {
            try {
              if (args.length > 0) {
                const input = args[0];
                if (typeof input === 'string') {
                  args[0] = applyRpcRewrite(input);
                } else if (input && typeof input === 'object' && typeof input.url === 'string') {
                  const nextUrl = applyRpcRewrite(input.url);
                  if (nextUrl !== input.url) {
                    args[0] = new Request(nextUrl, input);
                  }
                }
              }
            } catch (_) {}
            return origFetch(...args);
          };
        }
      } catch (_) {}

      try {
        const proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
        const origOpen = proto && typeof proto.open === 'function' ? proto.open : null;
        if (origOpen) {
          proto.open = function openPatched(method, url, ...rest) {
            const rewritten = applyRpcRewrite(url);
            return origOpen.call(this, method, rewritten, ...rest);
          };
        }
      } catch (_) {}
    }

    const fakeRaw = fromBase64Url(passkeyWalletSeedRecord?.credentialId || '');
    const fakeCredential = {
      rawId: fakeRaw.buffer,
      getClientExtensionResults: () => ({
        prf: {
          enabled: true,
          results: { first: seededPrfOutput || new ArrayBuffer(32) },
        },
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
	    passkeyWalletSeedRecord: passkeyWalletSeed,
	    resourceKeysSeed: {
	      sessionSlug,
	      generalSlug: '',
	      useLocalArweave: !!arweaveJwkJson,
	      arweaveJwk: arweaveJwkJson,
	    },
	    rpcRewrite: {
	      to: rpcRewriteTarget,
	      from: rewriteMatchers.map((m) => m.from),
	    },
	    preferPathRpc,
	    sessionRegistrySeed: {
	      slug: sessionSlug,
	      config: workerUrlOverride
	        ? {
	          ...(demoTemplate && typeof demoTemplate === 'object' ? demoTemplate : {}),
	            slug: sessionSlug,
	            corsWorkerUrl: workerUrlOverride,
	          }
	        : null,
	    },
	  });

  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const logBrowserWarnings = toBool(process.env.E2E_LOG_BROWSER_WARNINGS);
  const consoleRepeatLimit = Math.max(1, Number.parseInt(String(process.env.E2E_CONSOLE_REPEAT_LIMIT || '3'), 10) || 3);
  const consoleCounts = new Map();
  const formatConsoleKey = (type, text) => `${type}:${String(text || '').trim().replace(/\s+/g, ' ')}`;
  const emitConsoleLine = (type, text) => {
    const key = formatConsoleKey(type, text);
    const next = (consoleCounts.get(key) || 0) + 1;
    consoleCounts.set(key, next);
    if (next <= consoleRepeatLimit) {
      log(`browser console ${type}:`, text);
      return;
    }
    if (next === consoleRepeatLimit + 1) {
      log(`browser console ${type}: (suppressed repeats)`, String(text || '').slice(0, 220));
    }
  };
  page.on('console', (msg) => {
    const type = String(msg?.type?.() || '').trim();
    const text = String(msg?.text?.() || '').trim();
    if (!text) return;
    if (type === 'error') emitConsoleLine(type, text);
    if (type === 'warning' && logBrowserWarnings) emitConsoleLine(type, text);
  });
  page.on('pageerror', (err) => {
    log('browser pageerror:', err?.message || String(err || 'unknown page error'));
  });
  page.on('response', async (resp) => {
    const url = String(resp?.url?.() || '');
    if (!/\/arweave\/upload(?:\?|$)/i.test(url)) return;
    const status = Number(resp?.status?.() || 0);
    if (status < 400) {
      log('arweave upload response', { status });
      return;
    }
    const snippet = await resp.text().catch(() => '');
    log('arweave upload response error', {
      status,
      body: String(snippet || '').slice(0, 500),
    });
  });

  const report = {
    createdAt: new Date().toISOString(),
    runTag,
    baseUrl,
    walletAddress: wallet.address,
    outputs: {
      json: path.relative(ROOT, outJson),
      screenshot: path.relative(ROOT, outPng),
    },
    survey: {
      title: `AI Test Survey Question Types (${runTag})`,
      questions: [
        { type: 'binary', prompt: `Do you agree with this statement? (test binary) [${runTag}]` },
        { type: 'rating', prompt: `How strongly do you agree? (0-10 rating test) [${runTag}]` },
        {
          type: 'multichoice',
          singleSelect: false,
          prompt: `Which items apply? (multi-select test) [${runTag}]`,
          options: ['Option A', 'Option B', 'Option C'],
        },
        {
          type: 'multichoice',
          singleSelect: true,
          prompt: `Choose one option. (single-select multichoice test) [${runTag}]`,
          options: ['Choice 1', 'Choice 2', 'Choice 3'],
        },
        { type: 'freeform', prompt: `Any additional notes? (freeform test) [${runTag}]` },
      ],
      result: null,
    },
  };

  try {
    const snapshotUiState = async () => {
      const createButton = locators.survey.createToggle(page);
      const pileCreateButton = locators.survey.createTogglePile(page);
      const manualModeBtn = locators.create.modeSwitch(page);
      const titleInput = locators.create.title(page);
      const addBinary = locators.create.addTypeButton(page, 'binary');
      const toggleSwitch = locators.create.surveyQuestionsToggle(page);
      const createSubmitBtn = locators.create.submit(page);

      const bodyText = await page.locator('body').innerText().catch(() => '');
      const bodyHead = String(bodyText || '').replace(/\s+/g, ' ').slice(0, 420);
      const pageTitle = await page.title().catch(() => '');
      const manualBtnText = await manualModeBtn.innerText().catch(() => '');
      const createSubmitText = await createSubmitBtn.innerText().catch(() => '');
      const domMeta = await page.evaluate(() => {
        const root = document.querySelector('#root');
        const body = document.body;
        return {
          bodyHtmlLength: body ? String(body.innerHTML || '').length : -1,
          rootExists: !!root,
          rootChildCount: root ? root.childElementCount : -1,
          rootHtmlLength: root ? String(root.innerHTML || '').length : -1,
          readyState: document.readyState || '',
        };
      }).catch(() => ({
        bodyHtmlLength: -1,
        rootExists: false,
        rootChildCount: -1,
        rootHtmlLength: -1,
        readyState: 'unknown',
      }));

      return {
        url: page.url(),
        title: pageTitle || null,
        createButtonVisible: await createButton.isVisible().catch(() => false),
        pileCreateButtonVisible: await pileCreateButton.isVisible().catch(() => false),
        manualModeButtonVisible: await manualModeBtn.isVisible().catch(() => false),
        manualModeButtonText: manualBtnText || null,
        titleInputVisible: await titleInput.isVisible().catch(() => false),
        addBinaryVisible: await addBinary.isVisible().catch(() => false),
        createSubmitVisible: await createSubmitBtn.isVisible().catch(() => false),
        createSubmitText: createSubmitText || null,
        toggleSwitchVisible: await toggleSwitch.isVisible().catch(() => false),
        bodyHead,
        domMeta,
      };
    };

    const ensureCreatePanelOpen = async () => {
      const createButton = locators.survey.createToggle(page);
      const pileCreateButton = locators.survey.createTogglePile(page);
      const titleInput = locators.create.title(page);
      const addBinary = locators.create.addTypeButton(page, 'binary');
      const modeSwitchBtn = locators.create.modeSwitch(page);
      const createSubmitBtn = locators.create.submit(page);
      const isCreateUiVisible = async () => {
        const checks = await Promise.all([
          titleInput.isVisible().catch(() => false),
          addBinary.isVisible().catch(() => false),
          modeSwitchBtn.isVisible().catch(() => false),
          createSubmitBtn.isVisible().catch(() => false),
        ]);
        return checks.some(Boolean);
      };
      const resolveCreateTrigger = async () => {
        if (await createButton.isVisible().catch(() => false)) return createButton;
        if (await pileCreateButton.isVisible().catch(() => false)) return pileCreateButton;
        return null;
      };
      const waitForCreateTrigger = async (timeoutMs, label) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          // eslint-disable-next-line no-await-in-loop
          const trigger = await resolveCreateTrigger();
          if (trigger) return trigger;
          // eslint-disable-next-line no-await-in-loop
          await page.waitForTimeout(500);
        }
        const uiSnapshot = await snapshotUiState();
        throw new Error(`No create trigger visible (${label}): ${JSON.stringify(uiSnapshot)}`);
      };
      const waitForCreateContainer = async (timeoutMs, label) => {
        const start = Date.now();
        let nextLogAt = start + 10000;
        while (Date.now() - start < timeoutMs) {
          if (await isCreateUiVisible()) return true;
          if (Date.now() >= nextLogAt) {
            const elapsed = Math.round((Date.now() - start) / 1000);
            log('waiting for create UI mount', { label, elapsedSeconds: elapsed });
            nextLogAt += 10000;
          }
          await page.waitForTimeout(500);
        }
        return false;
      };

      const initialTrigger = await waitForCreateTrigger(180000, 'initial');
      if (await isCreateUiVisible()) {
        log('create panel already open');
        return;
      }

      try {
        await initialTrigger.click({ timeout: 15000 });
      } catch (err) {
        log('create trigger click failed; retrying with force', {
          error: err?.message || String(err),
        });
        await initialTrigger.click({ force: true }).catch(() => {});
      }
      if (await waitForCreateContainer(30000, 'first-click')) {
        log('create panel opened');
        return;
      }

      // One extra click fallback for flaky first click targeting.
      log('create UI not mounted after first click; retrying click');
      const retryTrigger = await waitForCreateTrigger(15000, 'retry');
      await retryTrigger.click({ force: true, timeout: 15000 }).catch(() => {});
      if (await waitForCreateContainer(30000, 'retry-click')) {
        log('create panel opened (retry)');
        return;
      }

      const uiSnapshot = await snapshotUiState();
      throw new Error(`CreateSurvey UI did not mount after click retries: ${JSON.stringify(uiSnapshot)}`);
    };

    const ensureQuestionsWorkspaceReady = async () => {
      const createButton = locators.survey.createToggle(page);
      const pileCreateButton = locators.survey.createTogglePile(page);
      const waitForCreateButton = async (timeoutMs, label) => {
        const start = Date.now();
        let nextLogAt = start + 10000;
        while (Date.now() - start < timeoutMs) {
          const headerVisible = await createButton.isVisible().catch(() => false);
          const pileVisible = await pileCreateButton.isVisible().catch(() => false);
          if (headerVisible || pileVisible) return true;
          if (Date.now() >= nextLogAt) {
            const elapsed = Math.round((Date.now() - start) / 1000);
            log('waiting for create button', { label, elapsedSeconds: elapsed, url: page.url() });
            nextLogAt += 10000;
          }
          await page.waitForTimeout(500);
        }
        return false;
      };

      // Attempt 1: session route first (pile mode is usually more stable in this app).
      if (sessionSlug) {
        log('opening session route for authoring workspace', { sessionSlug });
        await page.goto(`${baseUrl}/session/${encodeURIComponent(sessionSlug)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
        if (await waitForCreateButton(45000, '/session/<slug>')) return;

        log('session route missing create trigger; trying view-all + session questions route');
        const viewAllButton = locators.survey.viewAll(page);
        if (await viewAllButton.isVisible().catch(() => false)) {
          await viewAllButton.click().catch(() => {});
        }
        if (await waitForCreateButton(30000, '/session/<slug> + view-all')) return;

        await page.goto(`${baseUrl}/session/${encodeURIComponent(sessionSlug)}/questions`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        if (await waitForCreateButton(25000, '/session/<slug>/questions')) return;
      }

      // Attempt 2: default /questions route as final fallback.
      log('session route paths missing create trigger; falling back to /questions');
      await page.goto(`${baseUrl}/questions`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
      log('questions page loaded');
      if (await waitForCreateButton(35000, '/questions')) return;

      const uiSnapshot = await snapshotUiState();
      throw new Error(`Questions workspace did not expose create button: ${JSON.stringify(uiSnapshot)}`);
    };

    const ensureManualToolVisible = async () => {
      const addBinary = locators.create.addTypeButton(page, 'binary');
      if (await addBinary.isVisible().catch(() => false)) return;

      const manualModeBtn = locators.create.modeSwitch(page);
      await manualModeBtn.waitFor({ state: 'visible', timeout: 45000 });
      const modeText = (await manualModeBtn.innerText().catch(() => '')).trim();
      log('mode switch button detected', { text: modeText || null });

      // In this UI, text "Manual" means we are currently showing auto tool and clicking switches to manual.
      if (/manual/i.test(modeText)) {
        log('switching create UI to Manual mode');
        await manualModeBtn.click();
      }

      await addBinary.waitFor({ state: 'visible', timeout: 45000 });
    };

    await ensureQuestionsWorkspaceReady();
    await waitForWalletDisplayAddress(page, wallet.address, {
      label: 'seed-survey-question-types',
    });

    // Open CreateSurvey panel via the header +/- button.
    await ensureCreatePanelOpen();
    await ensureManualToolVisible();
    const clearBtn = locators.create.clear(page);
    if (await clearBtn.isVisible().catch(() => false)) {
      log('clearing existing CreateSurvey form');
      await clearBtn.click().catch(() => {});
      await page.waitForTimeout(600);
    }

    const ensureSurveyCreateMode = async () => {
      const titleInput = locators.create.title(page);
      if (await titleInput.isVisible().catch(() => false)) {
        return { mode: 'survey', titleInput };
      }
      return { mode: 'questions', titleInput: null };
    };

    const createMode = await ensureSurveyCreateMode();
    if (createMode.mode === 'survey' && createMode.titleInput) {
      await createMode.titleInput.fill(report.survey.title);
      log('survey title filled');
    } else {
      log('create UI in standalone question mode (no survey title input)');
    }

    // Add question types (two multichoice questions: multi-select then single-select).
    log('adding question types');
    await locators.create.addTypeButton(page, 'binary').click();
    await locators.create.addTypeButton(page, 'rating').click();
    await locators.create.addTypeButton(page, 'multichoice').click();
    await locators.create.addTypeButton(page, 'multichoice').click();
    await locators.create.addTypeButton(page, 'freeform').click();

    const containers = locators.create.questionContainers(page);
    const count = await containers.count();
    if (count < report.survey.questions.length) {
      throw new Error(`Expected at least ${report.survey.questions.length} question containers, found ${count}.`);
    }

    for (let i = 0; i < report.survey.questions.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const c = containers.nth(i);
      const q = report.survey.questions[i];

      // eslint-disable-next-line no-await-in-loop
      await locators.create.questionPrompt(c).fill(q.prompt);

      if (q.type === 'multichoice') {
        // Add options.
        const existingOptionInputs = locators.create.questionOptionInputs(c);
        // eslint-disable-next-line no-await-in-loop
        const existingCount = await existingOptionInputs.count().catch(() => 0);
        const toAdd = Math.max(0, Number(q.options.length || 0) - Number(existingCount || 0));
        for (let j = 0; j < toAdd; j += 1) {
          // eslint-disable-next-line no-await-in-loop
          await locators.create.questionAddOption(c).click();
        }

        for (let j = 0; j < q.options.length; j += 1) {
          // eslint-disable-next-line no-await-in-loop
          await locators.create.questionOptionInputByIndex(c, j).fill(q.options[j]);
        }

        const singleToggle = locators.create.questionSingleSelect(c);
        const shouldSingle = !!q.singleSelect;
        // eslint-disable-next-line no-await-in-loop
        const isChecked = await singleToggle.isChecked().catch(() => false);
        if (shouldSingle !== isChecked) {
          // eslint-disable-next-line no-await-in-loop
          await singleToggle.click();
        }
      }
    }
    log('question prompts/options filled');

    // Submit.
    const submitLabel = createMode.mode === 'survey' ? 'Create Survey' : 'Create Questions';
    const submit = locators.create.submit(page);
    const createdHeading = locators.create.success(page);
    const errorMessage = page.locator('text=Error:').first();
    const submitAttemptsRaw = String(process.env.CREATE_SUBMIT_ATTEMPTS || '3').trim();
    const submitAttempts = Math.max(1, Number.parseInt(submitAttemptsRaw, 10) || 3);
    const isRetryableSubmitError = (msg) => {
      const text = String(msg || '').toLowerCase();
      return (
        text.includes('over rate limit')
        || text.includes('status: 429')
        || text.includes('request timed out')
        || text.includes('took too long to respond')
        || text.includes('network_error')
        || text.includes('could not detect network')
      );
    };
    let createError = '';
    let submitted = false;
    const clearSubmissionError = async () => {
      // After a submit error, CreateSurvey sets `submissionError` and clicking the submit button
      // only copies the error text. Toggle the mode switch twice to clear `submissionError`
      // without losing the populated questions.
      const toggle = locators.create.surveyQuestionsToggle(page);
      if (!(await toggle.count())) return;
      log('clearing submissionError via mode toggle');
      await toggle.click().catch(() => {});
      await page.waitForTimeout(450);
      await toggle.click().catch(() => {});
      await page.waitForTimeout(750);
    };
    for (let attempt = 1; attempt <= submitAttempts; attempt += 1) {
      log('submitting', { submitLabel, attempt, submitAttempts });
      if (await errorMessage.isVisible().catch(() => false)) {
        // Ensure the next click triggers createSurvey() instead of copy-to-clipboard.
        await clearSubmissionError();
      }
      await submit.scrollIntoViewIfNeeded();
      await submit.click();

      await Promise.race([
        createdHeading.waitFor({ timeout: 240000 }),
        errorMessage.waitFor({ timeout: 240000 }),
      ]);

      if (await createdHeading.isVisible().catch(() => false)) {
        submitted = true;
        break;
      }

      const errText = await errorMessage.innerText().catch(() => '');
      createError = String(errText || '').replace(/^error:\s*/i, '').trim() || 'unknown error';
      if (attempt < submitAttempts && isRetryableSubmitError(createError)) {
        const waitMs = 15000 * attempt;
        log('submit failed with retryable error; retrying', { attempt, waitMs, error: createError });
        await page.waitForTimeout(waitMs);
        continue;
      }
      throw new Error(`CreateSurvey failed: ${createError}`);
    }
    if (!submitted) {
      throw new Error(`CreateSurvey failed after retries: ${createError || 'unknown error'}`);
    }

    if (createMode.mode === 'survey') {
      // Extract created survey id from the "View Survey" link.
      const viewLink = page.getByRole('link', { name: /View Survey/i }).first();
      const href = (await viewLink.getAttribute('href')) || '';
      const match = href.match(/\/survey\/(0x[a-fA-F0-9]{64})/);
      const surveyId = match ? match[1] : '';
      if (!surveyId) console.warn('[E2E:WARN] Could not extract surveyId from URL:', href);
      report.survey.result = {
        mode: 'survey',
        surveyId,
        viewHref: href,
      };
    } else {
      const uploadedItems = locators.create.uploadedQuestionItems(page);
      await uploadedItems.first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
      const questionIds = await uploadedItems.evaluateAll((nodes) =>
        nodes
          .map((n) => (n.getAttribute('data-ce-question-id') || '').trim())
          .filter(Boolean)
      );
      report.survey.result = {
        mode: 'questions',
        questionIds,
      };
    }

    await page.screenshot({ path: outPng, fullPage: true });
    writeJson(outJson, report);
    const surveyId = String(report?.survey?.result?.surveyId || '').trim();
    const questionCount = Array.isArray(report?.survey?.result?.questionIds)
      ? report.survey.result.questionIds.length
      : 0;
    log('completed', {
      mode: report?.survey?.result?.mode || null,
      surveyId: surveyId || null,
      questionCount,
      outJson: path.relative(ROOT, outJson),
      outPng: path.relative(ROOT, outPng),
    });

    console.log(JSON.stringify({
      ok: true,
      outJson: path.relative(ROOT, outJson),
      outPng: path.relative(ROOT, outPng),
      mode: report?.survey?.result?.mode || null,
      surveyId: surveyId || null,
      questionCount,
    }, null, 2));
  } catch (err) {
    try {
      await page.screenshot({ path: outErrorPng, fullPage: true });
      report.outputs.errorScreenshot = path.relative(ROOT, outErrorPng);
      writeJson(outJson, report);
      log('error screenshot captured', { outErrorPng: path.relative(ROOT, outErrorPng) });
    } catch (_) {}
    throw err;
  } finally {
    const closeTimeoutMs = Math.max(
      1000,
      Number.parseInt(String(process.env.PLAYWRIGHT_CLOSE_TIMEOUT_MS || '15000'), 10) || 15000,
    );

    await settleWithTimeout(() => context.close(), closeTimeoutMs);
    // `browserType.connect(wsEndpoint)` returns a Browser without `.disconnect()`.
    // Calling `browser.close()` closes this client connection and keeps the server alive.
    await settleWithTimeout(() => browser.close(), closeTimeoutMs);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = {
  dedupeRpcUrls,
  normalizeRpcUrl,
  resolveRpcRewriteConfig,
};
