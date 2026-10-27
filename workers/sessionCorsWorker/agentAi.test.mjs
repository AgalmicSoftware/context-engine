import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentEnvironment } from './agent/authority.mjs';
import { createAgentServices } from './agent/services.mjs';
import { boundedAgentFetch } from './agent/transport.mjs';
import { runBoundedPoster } from './agent/posterBudget.mjs';

function fixture({ secrets = { openaiKey: 'fixture-session-key' }, fetchImpl = async () => Response.json({ output_text: 'Fixture result' }), rate = true } = {}) {
  const config = { sessionId: '0x11111111111111111111111111111111', authzEpoch: 1,
    sessionModeProfile: { surfaces: { agentHttp: true } }, ai: { models: { analysis: 'gpt-5.6-terra' } }, agentHttp: {} };
  const env = { AGENT_POSTER_API_KEY: 'fixture-poster-key', E2E_OPENAI_KEY: 'must-not-use', TOKEN_HMAC_SECRET: 'fixture-hmac' };
  const agentEnv = createAgentEnvironment({ env, config, revision: 1, slug: 'fixture', origin: 'https://session.example' });
  agentEnv.AGENT_CONTEXT.address = '0x1111111111111111111111111111111111111111';
  const services = createAgentServices({ env, agentEnv, deps: {
    readCurrentSessionConfig: async () => ({ config, revision: 1 }), computeScopesForLogin: async () => ({ ai: true }),
    checkRateLimit: async () => rate, getSessionSecrets: async () => secrets, fetch: fetchImpl,
  } });
  agentEnv.AGENT_SERVICES = services;
  return { services, config, agentEnv };
}
test('text AI uses the saved key and configured model with bounded output and standard service tier', async () => {
  let request;
  const f = fixture({ fetchImpl: async (url, init) => { request = { url, headers: init.headers, body: JSON.parse(init.body) }; return Response.json({ output_text: 'Fixture result' }); } });
  await f.services.ai({ prompt: 'Fixture prompt', apiKey: 'caller-key', model: 'foreign-model', max_output_tokens: 999999, service_tier: 'fast' });
  assert.equal(request.body.model, 'gpt-5.6-terra'); assert.equal(request.body.max_output_tokens, 7000); assert.equal(request.body.service_tier, 'default');
  assert.equal(new Headers(request.headers).get('authorization'), 'Bearer fixture-session-key');
  assert.ok(!JSON.stringify(request).includes('caller-key')); assert.ok(!JSON.stringify(request).includes('fixture-poster-key'));
});
test('missing session text key and rate limits cannot use the optional poster or E2E key', async () => {
  let calls = 0;
  for (const options of [{ secrets: {} }, { rate: false }]) {
    const f = fixture({ ...options, fetchImpl: async () => { calls++; throw new Error('Must not call'); } });
    await assert.rejects(f.services.ai({ prompt: 'Fixture', apiKey: 'caller-key' }), error => ['agent_ai_request_failed', 'agent_ai_rate_limited'].includes(error.reason));
  }
  assert.equal(calls, 0);
});
test('text AI limits concurrent calls per session and frees the slot on completion', async () => {
  const releases = []; const f = fixture({ fetchImpl: () => new Promise(resolve => releases.push(() => resolve(Response.json({ output_text: 'done' })))) });
  const a = f.services.ai({ prompt: 'A' }), b = f.services.ai({ prompt: 'B' });
  while (releases.length < 2) await new Promise(resolve => setTimeout(resolve, 1));
  await assert.rejects(f.services.ai({ prompt: 'C' }), error => error.reason === 'agent_ai_busy');
  releases.splice(0).forEach(release => release()); await Promise.all([a, b]);
});
test('poster calls use the coordinated budget and duplicate in-flight runs share one generation', async () => {
  let calls = 0; const f = fixture({ rate: false, fetchImpl: async () => { calls++; } });
  f.config.agentHttp.wrapped = { posterEnabled: true, posterRenderer: 'openai' };
  await assert.rejects(f.services.posterFetch('https://api.openai.com/v1/images/edits', {}), error => error.reason === 'agent_poster_rate_limited');
  let release; const work = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const context = { sessionId: 'poster-fixture', auth: { delegation: { principal: { principalId: 'fixture-principal' } } } };
  const a = runBoundedPoster(context, 'run-one', work), b = runBoundedPoster(context, 'run-one', work);
  await assert.rejects(runBoundedPoster(context, 'run-two', work), error => error.reason === 'agent_poster_busy');
  release('done'); assert.deepEqual(await Promise.all([a, b]), ['done', 'done']); assert.equal(calls, 1);
});
test('provider transport bounds response bytes and deadline without leaking provider diagnostics', async () => {
  await assert.rejects(boundedAgentFetch(async () => new Response('too large'), { maxBytes: 2 })('https://provider.example'), error => error.reason === 'agent_provider_response_too_large');
  const waiting = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('private provider key'))));
  await assert.rejects(boundedAgentFetch(waiting, { timeoutMs: 10 })('https://provider.example'), error => error.reason === 'agent_provider_timeout' && !error.message.includes('private'));
});


test('provider body deadlines settle even when a custom stream ignores abort', async () => {
  const response = new Response(new ReadableStream({ start() {} }));
  await assert.rejects(boundedAgentFetch(async () => response, { timeoutMs: 10 })('https://provider.example'),
    error => error.reason === 'agent_provider_timeout');
});
