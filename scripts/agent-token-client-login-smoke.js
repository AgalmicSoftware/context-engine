"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { normalizeBaseUrl } = require("./vite-navigation-smoke");

const SESSION_SLUG = "agent-token-client-smoke";
const BRIDGE_PATH = "/__agent-bridge";
const RAW_TOKEN_RE = /ceagt_[A-Za-z0-9_-]{16,}/;
const INVALID_FIXTURE_TOKEN = `ceagt_${"x".repeat(28)}`;
const VALID_FIXTURE_TOKEN = `ceagt_${"y".repeat(28)}`;
const SESSION_ID = `0x${"64".repeat(16)}`;
const WORKER_URL = "https://session-worker.example.test";
const BRIDGE_TOKEN = "agent-smoke-bridge-browser-token-fixture";
const WORKER_TOKEN = "agent-smoke-worker-envelope-jwt-fixture";
const REGISTRY_CACHE_KEY = "dg:sessionRegistryCache:v1";
const PRIMARY_SESSION_KEY = "ce:primarySessionSlug";
const PRIMARY_SESSION_EXPLICIT_KEY = "ce:primarySessionSlugExplicit";
const SELECTED_SESSION_SCOPE_KEY = "ce:selectedSessionScope";
const SELECTED_SESSION_SLUGS_KEY = "ce:selectedSessionSlugs";

const profile = {
  profileVersion: 1,
  preset: "custom",
  authority: { mode: "worker_canonical" },
  evm: { registryChainId: null },
  storage: {
    backend: "cloudflare",
    payloadAccessControl: { gate: "role_gate", encryption: "none" },
  },
  identity: { default: "passkey", enabled: ["passkey"] },
  authorization: { mechanisms: ["worker_roles"] },
  encryption: { mode: "none" },
  surfaces: {
    web: true,
    telegram: false,
    miniApp: false,
    agentHttp: true,
    mcp: false,
    ceCc: false,
  },
  results: {
    visibility: "participant_aggregate",
    exposure: {
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    },
  },
  export: { scope: "admin_raw" },
};

const aggregateRows = {
  ok: true,
  questionCount: 1,
  responseCount: 4,
  questions: [
    {
      questionId: "agent-smoke-q1",
      prompt: "Should the browser keep raw agent tokens out of storage?",
      total: 4,
      participants: 4,
      agreementScore: 0.5,
      differenceScore: 0.25,
      counts: [
        { label: "Agree", count: 2 },
        { label: "Disagree", count: 1 },
        { label: "Unsure", count: 1 },
      ],
    },
  ],
};

function buildRegistryCache(baseUrl) {
  const sessionConfig = {
    slug: SESSION_SLUG,
    sessionIdHex: SESSION_ID,
    sessionName: "Agent token client smoke",
    sessionInfo: "Fixture hosted agent session for close-out smoke coverage.",
    networkChainId: 11155420,
    contracts: {},
    blockLimits: {},
    defaultTags: ["agent-smoke", "agent"],
    agentBridgeUrl: `${baseUrl}${BRIDGE_PATH}`,
    corsWorkerUrl: WORKER_URL,
    sessionModeProfile: profile,
    storageProfile: {
      backend: "cloudflare",
      payloadAccessControl: { gate: "role_gate", encryption: "none" },
    },
    __registry: {
      sessionIdHex: SESSION_ID,
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
  const leaked = haystacks.some((value) =>
    RAW_TOKEN_RE.test(String(value || "")),
  );
  assert.equal(
    leaked,
    false,
    `${label}: raw ceagt_ token appeared in URL or browser storage`,
  );
  for (const credential of [BRIDGE_TOKEN, WORKER_TOKEN]) {
    assert.equal(
      haystacks.some((value) => String(value).includes(credential)),
      false,
      `${label}: exchanged credential appeared in URL or browser storage`,
    );
  }
}

function assertConsoleHasNoRawTokens(consoleMessages) {
  const leaked = consoleMessages.some((message) =>
    RAW_TOKEN_RE.test(String(message || "")),
  );
  assert.equal(
    leaked,
    false,
    "raw ceagt_ token appeared in browser console output",
  );
}

async function waitForAgentQuestions(page) {
  try {
    await page
      .getByTestId("ce-session-agent-questions")
      .waitFor({ timeout: 30000 });
  } catch (error) {
    const loginError = await page
      .getByTestId("ce-agent-token-login-error")
      .textContent()
      .catch(() => "");
    const bodyPreview = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    const suffix = [
      loginError ? `login error: ${loginError.trim()}` : "",
      bodyPreview
        ? `body: ${bodyPreview.replace(/\s+/g, " ").trim().slice(0, 240)}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");
    throw new Error(
      `Agent question pile did not render after client login${suffix ? ` (${suffix})` : ""}`,
      {
        cause: error,
      },
    );
  }
}

async function installAgentBridgeFixture(page) {
  let invalidAttemptSeen = false;
  let validAttemptSeen = false;
  let submissionSeen = false;
  const groupReads = new Set();

  await page.route(`${WORKER_URL}/groups/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
      return;
    }
    assert.equal(
      request.headers().authorization,
      `Bearer ${WORKER_TOKEN}`,
      "groups use the exchanged Worker credential",
    );
    assert.equal(
      url.searchParams.get("sessionId"),
      SESSION_ID,
      "group reads bind the canonical session identity",
    );
    groupReads.add(url.pathname);
    const payload = {
      ok: true,
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
    };
    if (url.pathname === "/groups/list") {
      payload.groups = [
        {
          groupId: "reviewers",
          sessionSlug: SESSION_SLUG,
          label: "Fixture reviewers",
          joinMode: "open",
          memberVisibility: "session",
          memberCount: 0,
        },
      ];
    } else if (url.pathname === "/groups/my-memberships") {
      payload.memberships = [];
    } else {
      throw new Error(`Unexpected Worker fixture route: ${url.pathname}`);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(payload),
    });
  });

  await page.route(`**${BRIDGE_PATH}/api/agent/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname.endsWith("/session-meta")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          sessionSlug: SESSION_SLUG,
          authorityMode: "worker_canonical",
          agentHttpEnabled: true,
          clientSubmitReady: true,
        }),
      });
      return;
    }

    if (pathname.endsWith("/client-login/exchange")) {
      let payload = {};
      try {
        payload = request.postDataJSON();
      } catch (_) {
        payload = {};
      }
      assert.equal(
        payload.sessionSlug,
        SESSION_SLUG,
        "exchange request used the expected session slug",
      );
      assert.ok(
        payload.token === INVALID_FIXTURE_TOKEN ||
          payload.token === VALID_FIXTURE_TOKEN,
        "exchange request did not contain the expected fixture token",
      );

      if (payload.token === INVALID_FIXTURE_TOKEN) {
        invalidAttemptSeen = true;
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, reason: "agent_token_not_found" }),
        });
        return;
      }

      validAttemptSeen = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: SESSION_SLUG,
          accountAddress: "0x3333333333333333333333333333333333333333",
          workerUrl: WORKER_URL,
          bridgeCredential: {
            kind: "agent_bridge_browser_token",
            token: BRIDGE_TOKEN,
            expiresAt: "2027-07-05T23:59:59.000Z",
          },
          workerCredential: {
            kind: "session_worker_jwt",
            token: WORKER_TOKEN,
            expiresAt: "2027-07-05T23:59:59.000Z",
          },
          expiresAt: "2027-07-05T23:59:59.000Z",
          capabilities: {
            readQuestions: true,
            readResults: true,
            submitAnswers: true,
            draftAnswers: false,
            voteQuestions: false,
            poseQuestions: false,
            admin: false,
            export: false,
            readGroups: true,
          },
          buckets: {
            categories: [
              {
                categoryId: "role",
                label: "Role",
                options: [
                  { optionId: "organizer", label: "Organizer" },
                  { optionId: "observer", label: "Observer" },
                ],
              },
            ],
            selections: {
              role: ["organizer"],
            },
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/questions")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          questions: [
            {
              questionId: "agent-smoke-q1",
              questionType: "binary",
              prompt:
                "Should the browser keep raw agent tokens out of storage?",
              tags: ["agent-smoke"],
              answerable: true,
            },
            {
              questionId: "agent-smoke-q2",
              questionType: "freeform",
              prompt: "What should the parity smoke watch?",
              tags: ["smoke"],
              answerable: true,
            },
          ],
          answerState: {
            answeredCount: 0,
            unansweredCount: 2,
            sort: "fixture",
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/results")) {
      const view = url.searchParams.get("view") || "";
      if (view === "polis" || view === "groups") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            reason: "anonymized_groups_admin_disabled",
          }),
        });
        return;
      }
      if (view === "consensus" || view === "difference") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(aggregateRows),
        });
        return;
      }
      if (view === "topic-map") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            available: true,
            counts: { statements: 2, edges: 1 },
          }),
        });
        return;
      }
    }

    if (pathname.endsWith("/preferences")) {
      assert.equal(
        request.headers().authorization,
        `Bearer ${BRIDGE_TOKEN}`,
        "submit uses the exchanged Bridge credential",
      );
      const payload = request.postDataJSON();
      assert.deepEqual(
        payload,
        {
          sessionSlug: SESSION_SLUG,
          preferences: [
            {
              questionId: "agent-smoke-q1",
              answer: { questionType: "binary", value: "agree", comments: "" },
            },
          ],
          submit: true,
          humanApproved: true,
        },
        "explicit web submission keeps its authorization assertion and typed answer",
      );
      submissionSeen = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, submittedCount: 1 }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, reason: "fixture_route_not_found" }),
    });
  });

  return () => ({
    invalidAttemptSeen,
    validAttemptSeen,
    submissionSeen,
    groupReads: [...groupReads],
  });
}

async function main() {
  const baseUrl = normalizeBaseUrl(
    process.env.BASE_URL || "http://127.0.0.1:3000",
  );
  const browser = await chromium.launch({ headless: true });
  const consoleMessages = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    // Fixture traffic is intercepted below; unrelated external requests are blocked.
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(baseUrl).origin
        ? route.continue()
        : route.abort(),
    );
    await context.addInitScript(
      ({
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
        window.localStorage.setItem(scopeKey, "list");
        window.localStorage.setItem(slugsKey, JSON.stringify([sessionSlug]));
      },
      {
        cacheKey: REGISTRY_CACHE_KEY,
        cache: buildRegistryCache(baseUrl),
        primaryKey: PRIMARY_SESSION_KEY,
        explicitKey: PRIMARY_SESSION_EXPLICIT_KEY,
        scopeKey: SELECTED_SESSION_SCOPE_KEY,
        slugsKey: SELECTED_SESSION_SLUGS_KEY,
        sessionSlug: SESSION_SLUG,
      },
    );

    const page = await context.newPage();
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });
    const fixtureState = await installAgentBridgeFixture(page);

    await page.goto(`${baseUrl}/session/${SESSION_SLUG}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByTestId("ce-page-session-root").waitFor({ timeout: 30000 });
    await page.getByTestId("ce-session-results-toggle").waitFor({ timeout: 30000 });
    assert.equal(await page.getByTestId("ce-session-agent-sign-in-notice").count(), 0,
      "Agent HTTP keeps the normal web session page before token login");
    await page.getByTestId("ce-account-login-button").click();
    await page
      .getByTestId("ce-agent-token-login-toggle")
      .waitFor({ timeout: 30000 });
    await page.getByTestId("ce-agent-token-login-toggle").click();

    const input = page.getByTestId("ce-agent-token-login-input");
    await input.fill(INVALID_FIXTURE_TOKEN);
    await page.getByTestId("ce-agent-token-login-submit").click();
    await page
      .getByTestId("ce-agent-token-login-error")
      .waitFor({ timeout: 30000 });
    assert.equal(
      await input.inputValue(),
      "",
      "raw token input is cleared after failed exchange",
    );
    assertNoRawTokens(await scanStorage(page), "failed exchange");

    await input.fill(VALID_FIXTURE_TOKEN);
    await page.getByTestId("ce-agent-token-login-submit").click();
    await waitForAgentQuestions(page);
    await page
      .getByText("Should the browser keep raw agent tokens out of storage?")
      .first()
      .waitFor({ timeout: 30000 });
    await page
      .getByTestId("ce-session-agent-buckets")
      .waitFor({ timeout: 30000 });
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-testid="ce-session-agent-bucket-select"]',
        ).length === 1 ||
        document.querySelectorAll(
          '[data-testid="ce-session-agent-buckets-reconnect"]',
        ).length === 1,
      null,
      { timeout: 30000 },
    );
    const bucketSelectCount = await page
      .getByTestId("ce-session-agent-bucket-select")
      .count();
    const bucketReconnectCount = await page
      .getByTestId("ce-session-agent-buckets-reconnect")
      .count();
    if (bucketSelectCount === 1) {
      const bucketOptionText = await page
        .getByTestId("ce-session-agent-bucket-select")
        .evaluate((select) =>
          Array.from(select.querySelectorAll("option"))
            .map((option) => option.textContent || "")
            .join(" "),
        );
      assert.match(
        bucketOptionText,
        /Organizer/,
        "bucket card options are rendered from the exchanged envelope",
      );
    } else {
      assert.equal(
        bucketReconnectCount,
        1,
        "restored envelopes without bucket payloads expose a reconnect affordance",
      );
    }
    await page
      .getByTestId("ce-session-agent-results")
      .waitFor({ timeout: 30000 });
    await page
      .getByTestId("ce-session-agent-report-approx")
      .waitFor({ timeout: 30000 });
    await page.getByTestId("ce-polis-report-root").waitFor({ timeout: 60000 });
    if (await input.count()) {
      assert.equal(
        await input.inputValue(),
        "",
        "raw token input is cleared after successful exchange",
      );
    }
    const loginModal = page.locator(".modal-login");
    if (await loginModal.count()) {
      await loginModal.getByRole("button", { name: "Close" }).click();
      await loginModal.waitFor({ state: "detached", timeout: 30000 });
    }

    await page
      .getByTestId("ce-session-worker-groups")
      .getByText("Fixture reviewers", { exact: true })
      .waitFor();
    await page.getByTestId("ce-session-agent-question-next").click();
    const draftInput = page.getByTestId(
      "ce-session-agent-question-freeform-textarea",
    );
    await draftInput.fill("Synthetic local answer draft");
    await page.getByTestId("ce-session-agent-question-prev").click();
    await page
      .getByTestId("ce-session-agent-questions")
      .getByText("Agree", { exact: true })
      .click();
    assert.equal(
      await page.getByRole("radio", { name: "Agree", exact: true }).isChecked(),
      true,
    );
    await page.getByTestId("ce-session-agent-question-submit").click();
    await page.getByText("Already submitted", { exact: true }).waitFor();
    await page.getByTestId("ce-session-agent-question-next").click();
    assert.equal(
      await draftInput.inputValue(),
      "Synthetic local answer draft",
      "question navigation and submit refresh preserve local drafts",
    );

    const snapshot = await scanStorage(page);
    assertNoRawTokens(snapshot, "successful exchange");
    assert.equal(
      snapshot.sessionStorage.some(([key]) =>
        String(key || "").startsWith("ce:agentClientLogin:"),
      ),
      false,
      "agent client credentials are not persisted to sessionStorage",
    );
    const envelopeEntries = await page.evaluate(() =>
      Object.entries(window.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__ || {}),
    );
    assert.equal(
      envelopeEntries.length,
      1,
      "one versioned page-memory envelope is available",
    );
    const envelope = envelopeEntries[0][1];
    assert.equal(envelope.v, 2, "page-memory envelope is versioned");
    assert.equal(
      envelope.sessionSlug,
      SESSION_SLUG,
      "page-memory envelope is session-scoped",
    );
    assert.equal(
      envelope.bridgeCredential?.kind,
      "agent_bridge_browser_token",
      "page-memory envelope keeps bridge credential shape",
    );
    assert.equal(
      envelope.bridgeCredential?.token,
      BRIDGE_TOKEN,
      "page-memory envelope stores the exchanged bridge token",
    );
    assert.equal(
      envelope.workerCredential?.kind,
      "session_worker_jwt",
      "page-memory envelope keeps worker credential shape",
    );
    assert.equal(
      envelope.workerCredential?.token,
      WORKER_TOKEN,
      "page-memory envelope stores the exchanged worker token",
    );
    assert.match(
      JSON.stringify(envelope.buckets || {}),
      /Organizer/,
      "page-memory envelope retains same-tab bucket payloads for rendered group cards",
    );

    await page.getByTestId("ce-session-agent-logout").click();
    await page.getByTestId("ce-session-results-toggle").waitFor({ timeout: 30000 });
    assert.equal(await page.getByTestId("ce-session-agent-questions").count(), 0,
      "agent logout restores the normal web session page");
    const logoutSnapshot = await scanStorage(page);
    assertNoRawTokens(logoutSnapshot, "logout");
    assert.equal(
      logoutSnapshot.sessionStorage.some(([key]) =>
        String(key || "").startsWith("ce:agentClientLogin:"),
      ),
      false,
      "logout leaves no stored envelope",
    );

    const state = fixtureState();
    assert.equal(
      state.invalidAttemptSeen,
      true,
      "401 exchange path was exercised",
    );
    assert.equal(
      state.validAttemptSeen,
      true,
      "successful exchange path was exercised",
    );
    assert.equal(
      state.submissionSeen,
      true,
      "explicit answer submission was exercised",
    );
    assert.deepEqual(
      state.groupReads.sort(),
      ["/groups/list", "/groups/my-memberships"],
      "both Worker group read paths were exercised",
    );
    assertConsoleHasNoRawTokens(consoleMessages);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          sessionSlug: SESSION_SLUG,
          checks: [
            "normal web session before agent login and after logout",
            "401 re-paste flow",
            "token input clearing",
            "hosted HTTP access with retired surfaces disabled",
            "question pile and preserved local drafts",
            "explicit answer submission",
            "authenticated Worker group reads",
            "bucket cards or reconnect affordance",
            "approximate Polis report",
            "no raw ceagt token in URL/storage/console",
            "versioned page-memory envelope with same-tab buckets",
            "logout envelope clearing",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
