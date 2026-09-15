import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInterviewStarter, dispatchInterviewStarterRequest } from './interviewStarter.js';
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
      Array.from({ length: count }, (_, id) => ({ id: String(id), prompt: `AI topic ${id}` })),
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
test('defaults are stable and settings reject invalid values', () => {
  assert.equal(normalizeInterviewSettings().openingMode, 'auto');
  assert.equal(normalizeInterviewSettings().autoRegenerate, false);
  assert.equal(normalizeInterviewSettings().followNewQuestions, false);
  assert.equal(normalizeInterviewSettings().questionGrowthPercent, 20);
  assert.equal(normalizeInterviewSettings().allowManualRefresh, true);
  for (const value of [
    { openingMode: 'invalid' },
    { openingMode: 'owner', openingPrompt: ' ' },
    { followNewQuestions: 'true' },
    { questionGrowthPercent: 0 },
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
  f.args.config.interviewMode = { openingMode: 'owner', openingPrompt: 'What is your expertise in AI?' };
  assert.equal((await resolveInterviewStarter(f.args)).openingPrompt, 'What is your expertise in AI?');
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
