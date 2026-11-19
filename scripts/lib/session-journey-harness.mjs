import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { ethers } from 'ethers';
import { createWorkerRuntime } from '../../workers/sessionCorsWorker/worker.js';
import { createSignedSiweBody, installSessionCoordinatorBinding } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { hashOneUseSecret } from '../../shared/workerGroupJoin.mjs';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';
import { buildQuestionRecord, buildResponseRecord } from '../../mcp/lib/records.mjs';
import passkeyWallets from './passkey-derived-wallet.js';
import { auditPanelContrast } from '../civic-theme-overlay-smoke.mjs';

// Browser journeys drive the built client against the real Session Worker code, run in this process. The
// browser's requests to the session's Worker origin are answered by that code; nothing leaves the machine.
// The browser's CORS preflights are answered by Playwright, not the Worker; Worker tests cover OPTIONS.

export const WORKER_ORIGIN = 'https://journey-worker.example.test';
export const SESSION_ID = '0x00112233445566778899aabbccddeeff';
export const THEMES = ['civic', 'context-engine', 'classic-95'];
// Phone sizes people bring: a small and a current iPhone, and a common Android width.
export const PHONES = {
  small: { width: 375, height: 667 },
  iphone: { width: 390, height: 844 },
  android: { width: 412, height: 915 },
};

// Cloudflare's own limits, so a read path that only works without them fails here first.
const KV_LIST_PAGE_MAX = 1000;
const KV_BULK_GET_MAX = 100;
export const KV_OPERATIONS_PER_REQUEST = 1000;

// `network.kvDelayMs` makes each operation take time, as real storage does; only then can a request's
// operations overlap, and the most that overlapped is recorded on the request. So are its stored
// payload reads: the most one bulk get asked for, and how many were read one key at a time.
const createLimitedKv = (requestScope, network) => {
  const values = new Map();
  const metadata = new Map();
  const count = async () => {
    const request = requestScope.getStore();
    if (!request) return;
    request.kvOperations += 1;
    if (request.kvOperations > KV_OPERATIONS_PER_REQUEST) {
      throw new Error(`Too many KV operations in one Worker request (over ${KV_OPERATIONS_PER_REQUEST})`);
    }
    if (!network.kvDelayMs) return;
    request.kvInFlight = (request.kvInFlight || 0) + 1;
    request.kvAtOnce = Math.max(request.kvAtOnce || 0, request.kvInFlight);
    await new Promise((resolve) => setTimeout(resolve, network.kvDelayMs));
    request.kvInFlight -= 1;
  };
  const read = (key, typeOrOptions) => {
    const value = values.has(key) ? values.get(key) : null;
    const type = typeof typeOrOptions === 'string' ? typeOrOptions : typeOrOptions?.type;
    return value != null && type === 'json' ? JSON.parse(value) : value;
  };
  return {
    values,
    async get(key, typeOrOptions) {
      await count();
      const request = requestScope.getStore();
      const isPayload = (name) => String(name).startsWith('ce-storage-payload:');
      if (!Array.isArray(key)) {
        if (request && isPayload(key)) request.kvPayloadSingles += 1;
        return read(key, typeOrOptions);
      }
      if (key.length < 1 || key.length > KV_BULK_GET_MAX) {
        throw new Error(`KV bulk get takes 1 to ${KV_BULK_GET_MAX} keys, got ${key.length}`);
      }
      if (request) request.kvBulkPayloads = Math.max(request.kvBulkPayloads, key.filter(isPayload).length);
      return new Map(key.map((name) => [name, read(name, typeOrOptions)]));
    },
    async put(key, value, options) {
      await count();
      values.set(key, value);
      if (options?.metadata) metadata.set(key, structuredClone(options.metadata));
      else metadata.delete(key);
    },
    async delete(key) {
      await count();
      metadata.delete(key);
      values.delete(key);
    },
    async list({ prefix = '', limit = KV_LIST_PAGE_MAX, cursor = '' } = {}) {
      await count();
      const names = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = names.slice(start, start + Math.min(limit, KV_LIST_PAGE_MAX));
      const done = start + page.length >= names.length;
      return {
        keys: page.map((name) => (metadata.has(name) ? { name, metadata: structuredClone(metadata.get(name)) } : { name })),
        list_complete: done,
        cursor: done ? '' : String(start + page.length),
      };
    },
  };
};

const publicProfile = () => ({
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
  identity: { default: 'passkey', enabled: ['passkey'] },
  authorization: { mechanisms: ['worker_roles'] },
  encryption: { mode: 'none' },
  surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
  // Signed-in members see everyone's answers; visitors see none.
  results: { visibility: 'session_member_full', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
  export: { scope: 'all_session' },
});

// A new session as the site creates it: listed, unencrypted, with answers readable by signed-in members only.
const buildSessionConfig = ({ slug, baseUrl, admin }) => ({
  slug,
  sessionId: SESSION_ID,
  configRevision: 'journey-v1',
  sessionName: 'Journey session',
  sessionInfo: 'A synthetic session for browser journeys.',
  adminAddress: admin,
  corsWorkerUrl: WORKER_ORIGIN,
  allowOrigins: [baseUrl],
  workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'] },
  sessionModeProfile: publicProfile(),
  storageProfile: {
    type: 'session_storage_profile',
    version: 'session-storage-profile-v1',
    backend: 'cloudflare',
    sessionOwned: true,
    resources: { docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active', generatedArtifacts: 'active' },
    payloadAccessControl: {
      gate: 'none',
      encryption: 'none',
      mode: 'public_read',
      enforcement: 'session_worker_public_read',
      litRequired: false,
      label: 'Public-read Cloudflare payloads',
    },
  },
  workerGroupsBootstrap: { version: 2, state: 'fresh_empty', bootstrapId: 'b0'.repeat(32) },
  groupCreationPolicy: 'participants',
  HIGHLIGHTED_QUESTION_IDS: [],
  BLOCKED_QUESTION_IDS: [],
});

export const passkeyFixture = (name) => {
  const credentialId = Buffer.from(`journey-${name}`).toString('base64url');
  const { wallet } = passkeyWallets.buildPasskeyDerivedWallet(credentialId);
  return { wallet, seed: passkeyWallets.toPasskeyEoaSeedRecord({ credentialId, address: wallet.address }) };
};

export const createJourneySession = ({ baseUrl, slug }) => {
  const appOrigin = new URL(baseUrl).origin;
  const admin = passkeyFixture('admin');
  const requestScope = new AsyncLocalStorage();
  const network = { kvDelayMs: 0 };
  const config = buildSessionConfig({ slug, baseUrl: appOrigin, admin: admin.wallet.address });
  const groupKv = createLimitedKv(requestScope, network);
  groupKv.values.set(`session:${slug}:config`, JSON.stringify(config));
  const env = installSessionCoordinatorBinding({
    GROUP_KV: groupKv,
    CE_STORAGE_INDEX_KV: createLimitedKv(requestScope, network),
    TOKEN_HMAC_SECRET: 'synthetic-journey-token-key',
    DEFAULT_SESSION_SLUG: slug,
  });
  // What went wrong out of the journey's sight: in the Worker's own code, or in the bridge between the
  // browser and it. A journey ends by checking this is empty.
  const faults = [];
  const refuseOutside = (what) => async (url) => {
    faults.push(`${what}: ${url}`);
    throw new Error(`A journey must not call ${what}`);
  };
  const worker = createWorkerRuntime(env, { fetch: refuseOutside('an external service'), rpcFetch: refuseOutside('an external RPC') });
  // Every Worker request, from the browser or from this process, with its KV operation count.
  const requests = [];
  const workerFetch = async (url, init = {}) => {
    const request = init instanceof Request ? init : new Request(url, init);
    const record = { method: request.method, path: new URL(request.url).pathname, kvOperations: 0, kvAtOnce: 0, kvBulkPayloads: 0, kvPayloadSingles: 0, status: 0 };
    requests.push(record);
    const response = await requestScope.run(record, () => worker.fetch(request, env, { waitUntil: () => {} }));
    record.status = response.status;
    return response;
  };
  // One signed-in client per person: the Worker limits how often an address may sign in.
  const clients = new Map();
  const clientFor = (wallet) => {
    if (!clients.has(wallet.address)) {
      clients.set(wallet.address, createWorkerClient({ workerOrigin: WORKER_ORIGIN, slug, trustedOrigins: [appOrigin], wallet, fetchImpl: workerFetch }));
    }
    return clients.get(wallet.address);
  };
  const adminClient = clientFor(admin.wallet);
  const seedQuestion = async (question) => {
    const built = buildQuestionRecord({
      ...question,
      creator: admin.wallet.address,
      session: { sessionSlug: slug, sessionId: SESSION_ID, sessionName: config.sessionName },
    });
    assert.equal(built.ok, true, JSON.stringify(built));
    await adminClient.upload({
      resource: 'questions',
      data: built.record,
      tags: [
        { name: 'CE-SessionId', value: SESSION_ID },
        { name: 'CE-SessionSlug', value: slug },
        { name: 'CE-Resource', value: 'questions' },
        { name: 'CE-ResourceId', value: built.id },
      ],
    });
    return built;
  };
  // An admin action signed as the session page signs it.
  const adminAction = async (action, body = {}) => {
    const signedBody = await createSignedSiweBody({
      worker, env, wallet: admin.wallet, sessionSlug: slug, sessionId: SESSION_ID, adminAction: action, audience: appOrigin, body,
    });
    const response = await workerFetch(`${WORKER_ORIGIN}/admin/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: appOrigin }, body: JSON.stringify(signedBody),
    });
    const value = await response.json();
    assert.equal(response.status, 200, `${action}: ${JSON.stringify(value)}`);
    return value;
  };
  // A group people join with a one-use code, as a host hands out invite links.
  const createCodeGroup = async ({ groupId, label, description = '', codes }) => {
    await adminAction('groups/create', { group: { groupId, label, description, joinMode: 'one_use', listed: true } });
    await adminAction('groups/invites/add', { groupId, hashes: await Promise.all(codes.map(hashOneUseSecret)) });
    return groupId;
  };
  // The groups the Worker lists a person in, read as that person.
  const groupsOf = async (wallet) =>
    (await clientFor(wallet).request(`/groups/my-memberships?sessionId=${SESSION_ID}`, { auth: true })).memberships.map((entry) => entry.group.groupId);
  return {
    appOrigin, slug, clientFor, seedQuestion, workerFetch, requests, faults, createCodeGroup, groupsOf, network,
    sessionUrl: `${appOrigin}/session/${slug}?worker=${encodeURIComponent(WORKER_ORIGIN)}`,
  };
};

// One browser context for one person. `onWorkerRequest` may return a Response to stand in for the Worker
// (an outage, a lost reply) or a number of milliseconds to wait first (a slow network).
export const openPersonContext = async (browser, session, { fixture, viewport, onWorkerRequest, contextOptions = {} } = {}) => {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', ...contextOptions });
  context.setDefaultTimeout(30000);
  await context.addInitScript(
    ({ seed, appOrigin }) => {
      if (location.origin !== appOrigin) return;
      localStorage.setItem('ce_onboarding_complete', 'true');
      if (!seed) return;
      const bytes = (value) => {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
      };
      // No browser engine here can make a passkey unattended, so the device's answers are supplied. Like a
      // device, it makes one passkey for the site and refuses a second, signs in only once that passkey
      // exists, and hands over the key material when signing in, not when creating.
      const credential = (extensions) => ({ rawId: bytes(seed.credentialId).buffer, getClientExtensionResults: () => extensions });
      const made = () => localStorage.getItem('ce-journey-passkey-made') === '1';
      // WebKit off Apple's platforms ships without the passkey interface the site looks for first.
      if (typeof window.PublicKeyCredential === 'undefined') window.PublicKeyCredential = class PublicKeyCredential {};
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: {
          create: async () => {
            if (made()) throw new DOMException('This device already has a passkey for this site.', 'InvalidStateError');
            localStorage.setItem('ce-journey-passkey-made', '1');
            return credential({ prf: { enabled: true } });
          },
          get: async () => {
            if (!made()) throw new DOMException('No passkey on this device for this site.', 'NotAllowedError');
            return credential({ prf: { results: { first: bytes(seed.prfOutput).buffer } } });
          },
        },
      });
    },
    { seed: fixture?.seed || null, appOrigin: session.appOrigin },
  );
  const browserRequests = [];
  const answer = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === session.appOrigin) return route.continue();
    if (url.origin !== WORKER_ORIGIN) return route.abort();
    const record = { method: request.method(), path: url.pathname, search: url.search, startedAt: performance.now(), status: 0, planned: false };
    browserRequests.push(record);
    const override = await onWorkerRequest?.({ request, url, record });
    if (typeof override === 'number') await new Promise((resolve) => setTimeout(resolve, override));
    record.planned = override instanceof Response;
    const response = record.planned
      ? override
      : await session.workerFetch(request.url(), {
          method: request.method(),
          headers: request.headers(),
          body: request.postDataBuffer() || undefined,
        });
    record.status = response.status;
    record.endedAt = performance.now();
    if (!record.planned && request.headers().origin && response.headers.get('access-control-allow-origin') !== request.headers().origin) {
      session.faults.push(`The Worker's reply to ${request.method()} ${url.pathname} does not allow the page's origin`);
    }
    // A page that reloads abandons its requests; fulfilling one of those is refused, and is no fault.
    return route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    }).catch(() => {});
  };
  // Playwright does not wait for this handler, so a throw in it would end the process with no context.
  await context.route('**/*', (route) => answer(route).catch((error) => {
    session.faults.push(`The bridge failed on ${route.request().method()} ${route.request().url()}: ${error.message}`);
    return route.abort().catch(() => {});
  }));
  return { context, browserRequests };
};

// After a load the page is still moving: fonts arrive, the session title fades out, the card grows into its
// room. A click on a control that is covered or moving is retried by Playwright, and its retries scroll the
// control to the middle of the screen, which a person's tap never does. So wait until the page is still. The
// wait itself never fails a run: a page that stays busy is clicked as before.
export const settled = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((animation) => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity),
      null,
      { polling: 250, timeout: 20000 },
    )
    .catch(() => console.log('  the page was still animating 20s after a load; went on'));
};

// A returning person's theme choice. A first visit resets any stored choice, so it is set on a loaded page
// and applied by the reload, as the theme picker leaves it.
export const chooseTheme = async (page, theme) => {
  await page.evaluate((id) => localStorage.setItem('ce:theme', id), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-ce-theme')), theme, 'The page wears the chosen theme');
};

export const outage = (session, message = 'Synthetic storage outage (503)') => new Response(JSON.stringify({ error: message }), {
  status: 503,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': session.appOrigin },
});

// At a journey's end: nothing failed out of its sight, and no request the journey did not plan to fail
// came back as a server error.
export const assertNoHiddenFaults = (session, browserRequests, label) => {
  assert.deepEqual(session.faults, [], `${label}: faults in the Worker or the bridge`);
  const failed = browserRequests.filter(({ planned, status }) => !planned && status >= 500).map(({ method, path, status }) => `${method} ${path} ${status}`);
  assert.deepEqual(failed, [], `${label}: the Worker answered with a server error`);
};

export const openLoginDialog = async (page) => {
  await page.getByTestId('ce-account-login-button').click();
  await page.getByTestId('ce-passkey-wallet-create').waitFor();
  return page.getByRole('dialog');
};

// Presses Create in the log-in dialog, opening it first if need be, and waits to be signed in as `wallet`.
export const createPasskey = async (page, wallet) => {
  const create = page.getByTestId('ce-passkey-wallet-create');
  if (!(await create.isVisible())) await openLoginDialog(page);
  await create.click();
  const display = page.getByTestId('ce-wallet-display');
  await display.waitFor().catch(() => assert.fail('Create passkey did not sign the person in'));
  assert.equal((await display.getAttribute('data-ce-wallet-address')).toLowerCase(), wallet.address.toLowerCase());
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
};

// The most of `records` (requests with a start and an end) that were under way at one moment.
export const maxAtOnce = (records) => {
  const edges = records.flatMap(({ startedAt, endedAt }) => [[startedAt, 1], [endedAt, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let most = 0;
  for (const [, change] of edges) { now += change; most = Math.max(most, now); }
  return most;
};

// What a person can reach: the control's box lies inside the visible screen, and nothing else is drawn over
// its centre.
export const assertReachable = async (locator, label) => {
  await locator.scrollIntoViewIfNeeded();
  const problem = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const view = window.visualViewport || { width: innerWidth, height: innerHeight };
    if (!box.width || !box.height) return 'has no size';
    if (box.left < -2 || box.right > view.width + 2) return `runs off the side (${Math.round(box.left)} to ${Math.round(box.right)} of ${Math.round(view.width)})`;
    if (box.top < -2 || box.bottom > view.height + 2) return `runs off the screen (${Math.round(box.top)} to ${Math.round(box.bottom)} of ${Math.round(view.height)})`;
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (top && top !== element && !element.contains(top) && !top.contains(element)) {
      return `is covered by <${top.tagName.toLowerCase()} class="${typeof top.className === 'string' ? top.className.slice(0, 60) : ''}">`;
    }
    return '';
  });
  assert.equal(problem, '', `${label} ${problem}`);
};

export const assertNoSidewaysScroll = async (page, label) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 1, `${label}: the page scrolls sideways by ${overflow}px`);
};

// Rendered contrast of every visible text, field value and placeholder under `locator`, measured in the
// page so translucent layers and inherited colours count. Below 3:1 a person cannot read it, and the check
// fails. Between 3:1 and the 4.5:1 the theme contract holds its listed pairs to, it is returned as a note.
const UNREADABLE_BELOW = 3;
export const assertReadableText = async (locator, label) => {
  await locator.waitFor({ state: 'visible' });
  const unreadable = (result) => result.failures.filter(({ ratio }) => !(ratio >= UNREADABLE_BELOW));
  // A card or dialog fades in; judge it once two looks in a row agree.
  let result = await locator.evaluate(auditPanelContrast, 0);
  const deadline = Date.now() + 3000;
  for (let settled = false; !settled && Date.now() < deadline;) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const again = await locator.evaluate(auditPanelContrast, 0);
    settled = again.checked > 0 && JSON.stringify(again) === JSON.stringify(result);
    result = again;
  }
  assert.ok(result.checked > 0, `${label}: nothing to read`);
  assert.deepEqual(unreadable(result), [], `${label}: unreadable text (below ${UNREADABLE_BELOW}:1)`);
  return result.failures.map(({ text: words, ratio }) => `${label}: "${words}" is ${ratio.toFixed(1)}:1`);
};

export { buildResponseRecord, ethers };
