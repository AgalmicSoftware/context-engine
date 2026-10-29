import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { createWorkerRuntime } from './worker.js';
import { putSessionSecrets } from './sessionConfigSecretsStore.js';
import { buildSiweMessage, installSessionCoordinatorBinding, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { buildQuestionRecord } from '../../mcp/lib/records.mjs';
import { resolveInterviewStarter, dispatchInterviewStarterRequest as boundary } from './interviewStarter.js';

const dispatchInterviewStarterRequest = (args) => boundary({
  ...args, deps: { ...args.deps, readCurrentSessionConfig: args.deps?.readCurrentSessionConfig || (async ({ env, slug }) => ({
    config: await args.deps?.getSessionConfig?.(env, slug), revision: 1,
  })) },
});
import {
  normalizeInterviewSettings,
  validInterviewSettings,
  hasInterviewQuestionGrowth,
} from '../../shared/interviewSettings.mjs';

const fixture = () => {
  const records = new Map();
  let count = 10;
  let calls = 0;
  const env = {
    GROUP_KV: { get: async (key) => records.get(key), put: async (key, value) => records.set(key, value) },
  };
  const deps = {
    loadPublicInterviewQuestions: async () =>
      ({ questions: Array.from({ length: count }, (_, id) => ({ id: String(id), prompt: `AI topic ${id}` })), incomplete: false }),
    getSessionSecrets: async () => ({ openaiKey: 'worker-only-fixture' }),
    proxyOpenAI: async ({ payload, secrets }) => {
      calls++;
      assert.equal(secrets.openaiKey, 'worker-only-fixture');
      assert.equal(payload.model, 'gpt-5.6-terra');
      assert.equal(payload.service_tier, 'default');
      assert.match(payload.messages[0].content, /Session topic/);
      return Response.json({ completion: `What is your uncommon view on AI? ${calls}` });
    },
  };
  const args = { env, slug: 'demo', config: { sessionInfo: 'Session topic' }, deps };
  return {
    args,
    records,
    setCount: (value) => {
      count = value;
    },
    calls: () => calls,
  };
};

for (const [provider, model, secret] of [
  ['openai', 'gpt-4o-mini', 'openaiKey'], ['anthropic', 'claude-sonnet-4-6', 'anthropicKey'],
  ['openrouter', 'openai/gpt-4o-mini', 'openrouterKey'], ['custom', 'owner-model', 'customRpcKey'],
]) test(`opening generation honors the saved ${provider} model and its 600-token limit`, async () => {
  const f = fixture();
  f.args.config.ai = { mode: provider, models: { fast: model } };
  delete f.args.deps.proxyOpenAI;
  f.args.deps.getSessionSecrets = async () => ({ [secret]: 'synthetic-key', customRpcUrl: 'https://rpc.example.test' });
  let body;
  const fetch = async (_, init) => {
    if (provider === 'custom') assert.equal(init.outboundUrlPolicy, 'strict-https-no-credentials');
    body = JSON.parse(init.body);
    return Response.json({ choices: [{ message: { content: 'What matters to you?' } }], content: [{ text: 'What matters to you?' }] });
  };
  Object.assign(f.args.deps, { fetch, safeFetch: fetch, log: () => {} });
  const result = await resolveInterviewStarter(f.args);
  assert.equal(result.openingPrompt, 'What matters to you?');
  assert.equal(body.model, model);
  assert.equal(body.max_tokens, 600);
});

test('defaults are stable and settings reject invalid values', () => {
  assert.equal(normalizeInterviewSettings().openingMode, 'auto');
  assert.equal(normalizeInterviewSettings().autoRegenerate, false);
  assert.equal(normalizeInterviewSettings().followNewQuestions, false);
  assert.equal(normalizeInterviewSettings().questionGrowthPercent, 20);
  assert.equal(normalizeInterviewSettings().allowManualRefresh, true);
  assert.equal(normalizeInterviewSettings().shareDraftChangesByDefault, false);
  assert.equal(normalizeInterviewSettings({ shareDraftChangesByDefault: true }).shareDraftChangesByDefault, true);
  assert.equal(normalizeInterviewSettings({ shareDraftChangesByDefault: 'true' }).shareDraftChangesByDefault, false);
  assert.equal(normalizeInterviewSettings().researchDetail, 'minimal');
  assert.equal(normalizeInterviewSettings({ researchDetail: 'full' }).researchDetail, 'full');
  assert.equal(normalizeInterviewSettings({ researchDetail: 'FULL' }).researchDetail, 'minimal');
  assert.equal(normalizeInterviewSettings().hiddenDraftShare, 0);
  assert.equal(normalizeInterviewSettings({ hiddenDraftShare: 0.2 }).hiddenDraftShare, 0.2);
  assert.equal(normalizeInterviewSettings({ hiddenDraftShare: 0.9 }).hiddenDraftShare, 0.5);
  assert.equal(normalizeInterviewSettings({ hiddenDraftShare: '0.2' }).hiddenDraftShare, 0);
  assert.equal(normalizeInterviewSettings().showFidelityScore, false);
  assert.equal(normalizeInterviewSettings({ showFidelityScore: true }).showFidelityScore, true);
  assert.equal(normalizeInterviewSettings().suggestGroups, false);
  assert.equal(normalizeInterviewSettings({ suggestGroups: true }).suggestGroups, true);
  assert.equal(normalizeInterviewSettings().showFidelityResults, false);
  assert.equal(normalizeInterviewSettings({ showFidelityResults: true }).showFidelityResults, true);
  assert.equal(normalizeInterviewSettings({ showFidelityResults: 'true' }).showFidelityResults, false);
  // The smallest group shown in "How well AIs predicted people": 1 turns it off.
  for (const [fidelityMinimumPeople, expected] of [
    [undefined, 5],
    [1, 1],
    [10, 10],
    [50, 50],
    [0, 1],
    [51, 50],
    [2.5, 5],
    ['3', 5],
    [Number.NaN, 5],
    [null, 5],
  ])
    assert.equal(normalizeInterviewSettings({ fidelityMinimumPeople }).fidelityMinimumPeople, expected);
  for (const fidelityMinimumPeople of [undefined, 1, 5, 50])
    assert.equal(validInterviewSettings({ fidelityMinimumPeople }), true);
  assert.equal(normalizeInterviewSettings().steeringPrompt, '');
  assert.equal(normalizeInterviewSettings({ steeringPrompt: '  Guide the interview.  ' }).steeringPrompt, 'Guide the interview.');
  assert.equal(
    normalizeInterviewSettings({ steeringPrompt: ` ${'x'.repeat(3100)} ` }).steeringPrompt.length,
    3000,
  );
  for (const value of [
    { openingMode: 'invalid' },
    { openingMode: 'owner', openingPrompt: ' ' },
    { followNewQuestions: 'true' },
    { shareDraftChangesByDefault: 'true' },
    { shareDraftChangesByDefault: 1 },
    { researchDetail: 'everything' },
    { hiddenDraftShare: 0.6 },
    { hiddenDraftShare: -0.1 },
    { hiddenDraftShare: '0.2' },
    { showFidelityScore: 'true' },
    { suggestGroups: 'true' },
    { showFidelityResults: 'true' },
    { showFidelityResults: 1 },
    { fidelityMinimumPeople: 0 },
    { fidelityMinimumPeople: 51 },
    { fidelityMinimumPeople: 2.5 },
    { fidelityMinimumPeople: '5' },
    { fidelityMinimumPeople: null },
    { questionGrowthPercent: 0 },
    { steeringPrompt: 42 },
    { steeringPrompt: 'x'.repeat(3001) },
  ])
    assert.equal(validInterviewSettings(value), false);
  assert.equal(hasInterviewQuestionGrowth(42, 50, 20), false);
  assert.equal(hasInterviewQuestionGrowth(42, 51, 20), true);
});
test('waits for questions then generates once without an admin step', async () => {
  const f = fixture();
  f.setCount(0);
  assert.equal((await resolveInterviewStarter(f.args)).source, 'waiting-for-questions');
  assert.equal(f.calls(), 0);
  f.setCount(10);
  const first = await resolveInterviewStarter(f.args);
  f.setCount(20);
  assert.deepEqual(await resolveInterviewStarter(f.args), first);
  assert.equal(f.calls(), 1);
  assert.equal(f.records.has('session:demo:config'), false);
});
test('owner opening bypasses AI and is not overwritten', async () => {
  const f = fixture();
  f.args.config.interviewMode = {
    openingMode: 'owner',
    openingPrompt: 'What is your expertise in AI?',
    steeringPrompt: 'Ask for a concrete example.',
  };
  const result = await resolveInterviewStarter(f.args);
  assert.equal(result.openingPrompt, 'What is your expertise in AI?');
  assert.equal(result.steeringPrompt, 'Ask for a concrete example.');
  assert.equal(f.calls(), 0);
});
test('regeneration accumulates additions from the last successful generation', async () => {
  const f = fixture();
  f.args.config.interviewMode = { autoRegenerate: true };
  const initial = await resolveInterviewStarter(f.args);
  f.setCount(11);
  assert.deepEqual(await resolveInterviewStarter(f.args), initial);
  f.setCount(12);
  assert.notDeepEqual(await resolveInterviewStarter(f.args), initial);
  assert.equal(f.calls(), 2);
  f.setCount(13);
  await resolveInterviewStarter(f.args);
  assert.equal(f.calls(), 2);
});
test('manual refresh works when enabled and rejects disabled refresh', async () => {
  const f = fixture();
  await resolveInterviewStarter(f.args);
  await resolveInterviewStarter({ ...f.args, refresh: true });
  assert.equal(f.calls(), 2);
  f.args.config.interviewMode = { allowManualRefresh: false };
  await assert.rejects(resolveInterviewStarter({ ...f.args, refresh: true }), /disabled/);
});
test('failed regeneration retains a successful cache and reports the failure', async () => {
  const f = fixture();
  f.args.config.interviewMode = { autoRegenerate: true };
  const first = await resolveInterviewStarter(f.args);
  f.setCount(20);
  f.args.deps.proxyOpenAI = async () => Response.json({}, { status: 500 });
  const value = await resolveInterviewStarter(f.args);
  assert.equal(value.openingPrompt, first.openingPrompt);
  assert.match(value.warning, /Could not generate/);
  await assert.rejects(resolveInterviewStarter({ ...f.args, refresh: true }), /Could not generate/);
});
test('concurrent first starts share generation', async () => {
  const f = fixture();
  const results = await Promise.all([resolveInterviewStarter(f.args), resolveInterviewStarter(f.args)]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(f.calls(), 1);
});
test('starter route preserves CORS and rate limits; public callers cannot force refresh', async () => {
  const f = fixture();
  await resolveInterviewStarter(f.args);
  const deps = {
    ...f.args.deps,
    evaluateAnonymousRouteAccess: async () => ({ ok: true }),
    resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
    getSessionConfig: async () => f.args.config,
    getCorsContext: async () => ({
      ok: true,
      headers: new Headers({ 'access-control-allow-origin': 'https://app.example' }),
    }),
    checkRateLimit: async () => true,
    resolveAnonymousRateIdentity: () => 'fixture',
    json: (value, status, headers) => Response.json(value, { status, headers }),
  };
  const args = {
    ...f.args,
    request: new Request('https://worker.example/interview/starter?slug=demo&refresh=true', { method: 'POST' }),
    deps,
    constants: {},
  };
  const result = await dispatchInterviewStarterRequest(args);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('access-control-allow-origin'), 'https://app.example');
  assert.equal(f.calls(), 1);
  deps.checkRateLimit = async () => false;
  assert.equal((await dispatchInterviewStarterRequest(args)).status, 429);
  deps.checkRateLimit = async () => true;
  deps.evaluateAnonymousRouteAccess = async () => ({ ok: false, status: 403 });
  assert.equal((await dispatchInterviewStarterRequest(args)).status, 403);
  assert.equal(f.calls(), 1);
  f.args.config.sessionEndsAt = '2000-01-01T00:00:00Z';
  assert.equal((await dispatchInterviewStarterRequest(args)).status, 410);
  assert.equal(f.calls(), 1);
});

test('starter route resolves anonymous IP daily budgets before generation', async () => {
  const cases = [
    {
      name: 'explicit zero disables anonymous limiter while wallet limit stays positive',
      limits: { perWalletPerDay: 12, perAnonymousIpPerDay: 0 },
      expectedLimit: 0,
    },
    {
      name: 'malformed anonymous limit keeps legacy wallet fallback',
      limits: { perWalletPerDay: 12, perAnonymousIpPerDay: null },
      expectedLimit: 12,
    },
  ];

  for (const entry of cases) {
    const f = fixture();
    f.args.config.limits = entry.limits;
    let capturedRateLimit = null;
    const deps = {
      ...f.args.deps,
      evaluateAnonymousRouteAccess: async () => ({ ok: true }),
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
      getSessionConfig: async () => f.args.config,
      getCorsContext: async () => ({ ok: true, headers: new Headers() }),
      checkRateLimit: async (value) => {
        capturedRateLimit = value;
        return false;
      },
      resolveAnonymousRateIdentity: () => 'anon:starter',
      json: (value, status, headers) => Response.json(value, { status, headers }),
    };
    const response = await dispatchInterviewStarterRequest({
      ...f.args,
      request: new Request('https://worker.example/interview/starter?slug=demo', { method: 'POST' }),
      deps,
      constants: {},
    });

    assert.equal(response.status, 429, entry.name);
    assert.equal(f.calls(), 0, entry.name);
    assert.deepEqual(capturedRateLimit, {
      env: f.args.env,
      slug: 'demo',
      address: 'anon:starter',
      limit: entry.expectedLimit,
      route: 'interview-starter',
    }, entry.name);
  }
});

const origin = 'https://client.example.test';
const BLOCKED = 'https://127.0.0.1/v1/chat/completions';

const runtimeFixture = async (mode) => {
  const values = new Map();
  const kv = { get: async k => values.get(k) ?? null, put: async (k, v) => values.set(k, v), delete: async k => values.delete(k),
    list: async ({ prefix = '' } = {}) => ({ keys: [...values.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  const wallet = new Wallet(`0x${'1'.repeat(64)}`);
  const sessionId = `0x${'a'.repeat(32)}`;
  const config = { slug: 'fixture', sessionId, adminAddress: wallet.address, allowOrigins: [origin], sessionInfo: 'Topic',
    scopes: { ai: true, arweave: true }, ai: { mode: 'custom', models: { fast: 'owner-model', thinking: 'owner-model' } },
    workerAuthority: { version: 1, participantScopes: ['ai', 'storage'], anonymousScopes: ['ai'] },
    sessionModeProfile: {
      profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
      identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'none' }, surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
      export: { scope: 'all_session' },
    },
    storageProfile: { type: 'session_storage_profile', version: 'session-storage-profile-v1', backend: 'cloudflare', sessionOwned: true,
      resources: { docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active' },
      payloadAccessControl: { gate: 'none', encryption: 'none', mode: 'public_read', enforcement: 'session_worker_public_read', litRequired: false } },
  };
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv,
    TOKEN_HMAC_SECRET: 'synthetic-secret', CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), LOGIN_TRUSTED_ORIGINS: origin });
  await kv.put('session:fixture:config', JSON.stringify(config));
  await putSessionSecrets(env, 'fixture', { customRpcUrl: mode === 'blocked' ? BLOCKED : 'https://provider.example.test/v1/chat/completions', customRpcKey: 'synthetic-session-key' });
  const runtimeCalls = [];
  const worker = createWorkerRuntime(env, { fetch: async (url, init) => {
    runtimeCalls.push({ url: String(url), init });
    if (mode === 'redirect') return new Response(null, { status: 302, headers: { location: BLOCKED } });
    return Response.json({ choices: [{ message: { content: 'What matters to you?' } }] });
  },
    rpcFetch: async () => assert.fail('no chain') });
  const nonceRes = await worker.fetch(makeJsonRequest('/auth/nonce', { address: wallet.address, sessionSlug: 'fixture', sessionId }, { headers: { Origin: origin } }), env);
  const nonce = await nonceRes.json();
  const message = buildSiweMessage({ domain: new URL(origin).host, uri: origin, address: wallet.address, nonce: nonce.nonce, sessionSlug: 'fixture', sessionId });
  const loginRes = await worker.fetch(makeJsonRequest('/auth/login', { address: wallet.address, sessionSlug: 'fixture', sessionId, message, signature: await wallet.signMessage(message) }, { headers: { Origin: origin } }), env);
  const { token } = await loginRes.json();
  assert.ok(token);
  const req = (path, body, auth) => worker.fetch(new Request(`https://worker.example${path}`, { method: 'POST',
    headers: { Origin: origin, 'X-Session-Slug': 'fixture', 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body) }), env);
  // Seed one public question so the starter generates.
  const session = { sessionSlug: 'fixture', sessionId, sessionName: 'Fixture' };
  const q = buildQuestionRecord({ creator: wallet.address, type: 'binary', prompt: 'A synthetic question?', session });
  const up = await req('/storage/upload', { backend: 'cloudflare', resource: 'questions', data: q.record, contentType: 'application/json',
    tags: [{ name: 'CE-SessionId', value: sessionId }, { name: 'CE-SessionSlug', value: 'fixture' }, { name: 'CE-Resource', value: 'questions' }, { name: 'CE-ResourceId', value: q.id }] }, true);
  assert.equal(up.status, 200, await up.text());
  return { req, runtimeCalls };
};


for (const mode of ['blocked', 'redirect', 'allowed']) test(`interview openings use the AI outbound protections (${mode})`, async () => {
  const f = await runtimeFixture(mode);
  const globalCalls = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    globalCalls.push(args);
    return Response.json({ choices: [{ message: { content: 'Unsafe fallback' } }] });
  };
  try {
    const ai = await f.req('/ai', { provider: 'custom', model: 'owner-model', prompt: 'Test' }, true);
    assert.equal(ai.status, mode === 'allowed' ? 200 : 403);
    f.runtimeCalls.length = 0;
    const starter = await f.req('/interview/starter', {}, false);
    assert.equal(starter.status, mode === 'allowed' ? 200 : 503);
    assert.equal(globalCalls.length, 0, 'Opening generation must never fall through to unguarded global fetch');
    assert.equal(f.runtimeCalls.length, mode === 'blocked' ? 0 : 1);
    for (const { url, init } of f.runtimeCalls) {
      assert.equal(url, 'https://provider.example.test/v1/chat/completions');
      assert.equal(init.redirect, 'manual');
      assert.ok(init.signal instanceof AbortSignal, 'Custom opening calls carry the timeout signal');
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer synthetic-session-key');
    }
  } finally { globalThis.fetch = savedFetch; }
});

for (const [provider, key] of [['openai', 'openaiKey'], ['anthropic', 'anthropicKey'], ['openrouter', 'openrouterKey'], ['custom', 'customRpcKey']]) {
  test(`opening refusal names the missing ${key}`, async () => {
    const f = fixture();
    f.args.config.ai = { mode: provider, models: { fast: 'owner-fast-model' } };
    delete f.args.deps.proxyOpenAI;
    f.args.deps.getSessionSecrets = async () => ({ customRpcUrl: 'https://provider.example.test',
      ...(provider === 'openai' ? { anthropicKey: 'other-provider-key' } : { openaiKey: 'other-provider-key' }) });
    f.args.deps.fetch = async () => assert.fail('A missing key must not fall back to a different provider');
    f.args.deps.safeFetch = f.args.deps.fetch;
    await assert.rejects(resolveInterviewStarter(f.args), new RegExp(key));
  });
}
