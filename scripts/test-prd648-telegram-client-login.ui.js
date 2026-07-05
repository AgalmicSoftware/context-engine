'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

const SESSION_SLUG = 'prd648-telegram-client-smoke';
const BRIDGE_PATH = '/__prd648-agent-bridge';
const RAW_TOKEN_RE = /ceagt_[A-Za-z0-9_-]{16,}/;
const INVALID_FIXTURE_TOKEN = `ceagt_${'x'.repeat(28)}`;
const VALID_FIXTURE_TOKEN = `ceagt_${'y'.repeat(28)}`;
const WORKER_TOKEN = 'prd648-worker-envelope-jwt-fixture';
const ENVELOPE_PREFIX = 'ce:agentClientLogin:v1';
const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
const PRIMARY_SESSION_KEY = 'ce:primarySessionSlug';
const PRIMARY_SESSION_EXPLICIT_KEY = 'ce:primarySessionSlugExplicit';
const SELECTED_SESSION_SCOPE_KEY = 'ce:selectedSessionScope';
const SELECTED_SESSION_SLUGS_KEY = 'ce:selectedSessionSlugs';

const profile = {
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: { backend: 'cloudflare' },
  identity: { default: 'telegram', enabled: ['telegram', 'agent_grant'] },
  authorization: { mechanisms: ['worker_roles', 'telegram_account_role', 'agent_grant'] },
  encryption: { mode: 'none' },
  surfaces: {
    web: true,
    telegram: true,
    miniApp: true,
    agentHttp: true,
    mcp: false,
    ceCc: false,
  },
  results: {
    visibility: 'participant_aggregate',
    exposure: {
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    },
  },
  export: { scope: 'selected_surfaces', surfaceFilter: ['web', 'telegram', 'miniApp'] },
};

const aggregateRows = {
  ok: true,
  questionCount: 1,
  responseCount: 4,
  questions: [{
    questionId: 'prd648-q1',
    prompt: 'Should the browser keep raw agent tokens out of storage?',
    total: 4,
    participants: 4,
    agreementScore: 0.5,
    differenceScore: 0.25,
    counts: [
      { label: 'Agree', count: 2 },
      { label: 'Disagree', count: 1 },
      { label: 'Unsure', count: 1 },
    ],
  }],
};

function buildRegistryCache(baseUrl) {
  const sessionConfig = {
    slug: SESSION_SLUG,
    sessionName: 'PRD 648 Telegram client smoke',
    sessionInfo: 'Fixture Telegram-first session for PRD 648 close-out smoke coverage.',
    networkChainId: 11155420,
    contracts: {},
    blockLimits: {},
    defaultTags: ['prd648', 'telegram'],
    agentBridgeUrl: `${baseUrl}${BRIDGE_PATH}`,
    sessionModeProfile: profile,
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessMode: 'worker_private',
    },
    __registry: {
      sessionIdHex: `0x${'64'.repeat(32)}`,
    },
  };
  return {
    updatedAt: Date.now(),
    sessions: { [SESSION_SLUG]: sessionConfig },
    groups: { [SESSION_SLUG]: sessionConfig },
    sessionsById: {},
  };
}

async function scanStorage(page) {
  return page.evaluate(() => {
    const entries = (storage) => {
      const out = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        out.push([key, storage.getItem(key)]);
      }
      return out;
    };
    return {
      href: window.location.href,
      localStorage: entries(window.localStorage),
      sessionStorage: entries(window.sessionStorage),
    };
  });
}

function assertNoRawTokens(snapshot, label) {
  const haystacks = [
    snapshot.href,
    ...snapshot.localStorage.flat(),
    ...snapshot.sessionStorage.flat(),
  ].filter(Boolean);
  const leaked = haystacks.some((value) => RAW_TOKEN_RE.test(String(value || '')));
  assert.equal(leaked, false, `${label}: raw ceagt_ token appeared in URL or browser storage`);
}

function assertConsoleHasNoRawTokens(consoleMessages) {
  const leaked = consoleMessages.some((message) => RAW_TOKEN_RE.test(String(message || '')));
  assert.equal(leaked, false, 'raw ceagt_ token appeared in browser console output');
}

async function installAgentBridgeFixture(page) {
  let invalidAttemptSeen = false;
  let validAttemptSeen = false;

  await page.route(`**${BRIDGE_PATH}/api/agent/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname.endsWith('/session-meta')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          sessionSlug: SESSION_SLUG,
          telegramOnly: true,
          telegramBridgeEnabled: true,
          clientSubmitReady: true,
        }),
      });
      return;
    }

    if (pathname.endsWith('/client-login/exchange')) {
      let payload = {};
      try {
        payload = request.postDataJSON();
      } catch (_) {
        payload = {};
      }
      assert.equal(payload.sessionSlug, SESSION_SLUG, 'exchange request used the expected session slug');
      assert.ok(
        payload.token === INVALID_FIXTURE_TOKEN || payload.token === VALID_FIXTURE_TOKEN,
        'exchange request did not contain the expected fixture token'
      );

      if (payload.token === INVALID_FIXTURE_TOKEN) {
        invalidAttemptSeen = true;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, reason: 'agent_token_not_found' }),
        });
        return;
      }

      validAttemptSeen = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          sessionSlug: SESSION_SLUG,
          accountAddress: '0x3333333333333333333333333333333333333333',
          tokenType: 'session_worker_jwt',
          workerUrl: 'https://session-worker.example.test',
          workerToken: WORKER_TOKEN,
          expiresAt: '2027-07-05T23:59:59.000Z',
          capabilities: {
            readQuestions: true,
            readResults: true,
            submitAnswers: true,
            draftAnswers: false,
            voteQuestions: false,
            poseQuestions: false,
            admin: false,
            export: false,
          },
          buckets: {
            categories: [{
              categoryId: 'role',
              label: 'Role',
              options: [
                { optionId: 'organizer', label: 'Organizer' },
                { optionId: 'observer', label: 'Observer' },
              ],
            }],
            selections: {
              role: ['organizer'],
            },
          },
        }),
      });
      return;
    }

    if (pathname.endsWith('/questions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          questions: [
            {
              questionId: 'prd648-q1',
              questionType: 'binary',
              prompt: 'Should the browser keep raw agent tokens out of storage?',
              tags: ['prd648'],
              answerable: true,
            },
            {
              questionId: 'prd648-q2',
              questionType: 'freeform',
              prompt: 'What should the parity smoke watch?',
              tags: ['smoke'],
              answerable: true,
            },
          ],
          answerState: {
            answeredCount: 0,
            unansweredCount: 2,
            sort: 'fixture',
          },
        }),
      });
      return;
    }

    if (pathname.endsWith('/results')) {
      const view = url.searchParams.get('view') || '';
      if (view === 'polis' || view === 'groups') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, reason: 'anonymized_groups_admin_disabled' }),
        });
        return;
      }
      if (view === 'consensus' || view === 'difference') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(aggregateRows),
        });
        return;
      }
      if (view === 'topic-map') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            available: true,
            counts: { statements: 2, edges: 1 },
          }),
        });
        return;
      }
    }

    if (pathname.endsWith('/preferences')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, submittedCount: 1 }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, reason: 'fixture_route_not_found' }),
    });
  });

  return () => ({ invalidAttemptSeen, validAttemptSeen });
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const browser = await chromium.launch({ headless: true });
  const consoleMessages = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({
      cacheKey,
      cache,
      primaryKey,
      explicitKey,
      scopeKey,
      slugsKey,
      sessionSlug,
    }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(cacheKey, JSON.stringify(cache));
      window.localStorage.setItem(primaryKey, sessionSlug);
      window.localStorage.setItem(explicitKey, JSON.stringify(true));
      window.localStorage.setItem(scopeKey, 'active');
      window.localStorage.setItem(slugsKey, JSON.stringify([sessionSlug]));
    }, {
      cacheKey: REGISTRY_CACHE_KEY,
      cache: buildRegistryCache(baseUrl),
      primaryKey: PRIMARY_SESSION_KEY,
      explicitKey: PRIMARY_SESSION_EXPLICIT_KEY,
      scopeKey: SELECTED_SESSION_SCOPE_KEY,
      slugsKey: SELECTED_SESSION_SLUGS_KEY,
      sessionSlug: SESSION_SLUG,
    });

    const page = await context.newPage();
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });
    const fixtureState = await installAgentBridgeFixture(page);

    await page.goto(`${baseUrl}/session/${SESSION_SLUG}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ce-session-telegram-only-notice').waitFor({ timeout: 30000 });
    await page.getByTestId('ce-session-telegram-login-open').click();
    await page.getByTestId('ce-agent-token-login-toggle').waitFor({ timeout: 30000 });
    await page.getByTestId('ce-agent-token-login-toggle').click();

    const input = page.getByTestId('ce-agent-token-login-input');
    await input.fill(INVALID_FIXTURE_TOKEN);
    await page.getByTestId('ce-agent-token-login-submit').click();
    await page.getByTestId('ce-agent-token-login-error').waitFor({ timeout: 30000 });
    assert.equal(await input.inputValue(), '', 'raw token input is cleared after failed exchange');
    assertNoRawTokens(await scanStorage(page), 'failed exchange');

    await input.fill(VALID_FIXTURE_TOKEN);
    await page.getByTestId('ce-agent-token-login-submit').click();
    await page.getByTestId('ce-session-telegram-questions').waitFor({ timeout: 30000 });
    await page.getByText('Should the browser keep raw agent tokens out of storage?').first().waitFor({ timeout: 30000 });
    await page.getByTestId('ce-session-telegram-buckets').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => (
      document.querySelectorAll('[data-testid="ce-session-telegram-bucket-select"]').length === 1 ||
      document.querySelectorAll('[data-testid="ce-session-telegram-buckets-reconnect"]').length === 1
    ), null, { timeout: 30000 });
    const bucketSelectCount = await page.getByTestId('ce-session-telegram-bucket-select').count();
    const bucketReconnectCount = await page.getByTestId('ce-session-telegram-buckets-reconnect').count();
    if (bucketSelectCount === 1) {
      const bucketOptionText = await page.getByTestId('ce-session-telegram-bucket-select').evaluate((select) => (
        Array.from(select.querySelectorAll('option')).map((option) => option.textContent || '').join(' ')
      ));
      assert.match(bucketOptionText, /Organizer/, 'bucket card options are rendered from the exchanged envelope');
    } else {
      assert.equal(bucketReconnectCount, 1, 'restored envelopes without bucket payloads expose a reconnect affordance');
    }
    await page.getByTestId('ce-session-telegram-results').waitFor({ timeout: 30000 });
    await page.getByTestId('ce-session-telegram-report-approx').waitFor({ timeout: 30000 });
    await page.getByTestId('ce-polis-report-root').waitFor({ timeout: 60000 });
    if (await input.count()) {
      assert.equal(await input.inputValue(), '', 'raw token input is cleared after successful exchange');
    }

    const snapshot = await scanStorage(page);
    assertNoRawTokens(snapshot, 'successful exchange');
    const envelopeEntries = snapshot.sessionStorage
      .filter(([key]) => String(key || '').startsWith(ENVELOPE_PREFIX));
    assert.equal(envelopeEntries.length, 1, 'one versioned sessionStorage envelope is persisted');
    const envelope = JSON.parse(envelopeEntries[0][1]);
    assert.equal(envelope.v, 1, 'persisted envelope is versioned');
    assert.equal(envelope.sessionSlug, SESSION_SLUG, 'persisted envelope is session-scoped');
    assert.equal(envelope.credential?.kind, 'session_worker_jwt', 'persisted credential is the exchanged worker envelope');
    assert.equal(envelope.credential?.token, WORKER_TOKEN, 'persisted credential stores only the exchanged worker token');
    assert.equal(envelope.buckets, null, 'persisted envelope drops bucket payloads');

    await page.getByTestId('ce-session-telegram-logout').click();
    await page.getByTestId('ce-session-telegram-only-notice').waitFor({ timeout: 30000 });
    const logoutSnapshot = await scanStorage(page);
    assertNoRawTokens(logoutSnapshot, 'logout');
    assert.equal(
      logoutSnapshot.sessionStorage.some(([key]) => String(key || '').startsWith(ENVELOPE_PREFIX)),
      false,
      'logout clears the stored envelope'
    );

    const state = fixtureState();
    assert.equal(state.invalidAttemptSeen, true, '401 exchange path was exercised');
    assert.equal(state.validAttemptSeen, true, 'successful exchange path was exercised');
    assertConsoleHasNoRawTokens(consoleMessages);

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      sessionSlug: SESSION_SLUG,
      checks: [
        '401 re-paste flow',
        'token input clearing',
        'question pile',
        'bucket cards or reconnect affordance',
        'approximate Polis report',
        'no raw ceagt token in URL/storage/console',
        'versioned sessionStorage envelope',
        'logout envelope clearing',
      ],
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
