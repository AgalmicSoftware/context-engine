// The Session Agent answering on Cloudflare Workers AI. Every test stubs the AI
// binding and refuses the network, so nothing here can reach a real model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { createWorkerRuntime } from './worker.js';
import { putSessionSecrets } from './sessionConfigSecretsStore.js';
import { proxyWorkersAi } from './aiProviderExecution.js';
import { isModelAllowed } from './aiRequestNormalization.js';
import { inferAiProviderFromModel } from '../../shared/aiModelFamily.mjs';
import { DEFAULT_WORKERS_AI_MODEL } from '../../shared/workersAiModels.mjs';
import { SESSION_AGENT_LIMITS } from '../../shared/sessionAgent.mjs';
import { buildSiweMessage, installSessionCoordinatorBinding, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';

const GLM = '@cf/zai-org/glm-5.3';
const REPLY_TOKENS = SESSION_AGENT_LIMITS.answerTokens;
const AGENT_ON_CLOUDFLARE = Object.freeze({
  mode: 'openai',
  models: { fast: 'gpt-4o-mini', thinking: 'gpt-5', 'session-agent': { model: GLM, provider: 'workers-ai' } },
  reasoningEffort: 'low',
});
const ASK = Object.freeze({ taskType: 'session-agent', messages: [{ role: 'user', content: 'What do people want?' }] });

// A stub of env.AI: records each call, replies with `reply` or throws it.
const stubAi = (reply = { response: 'Synthetic open-model answer' }) => {
  const calls = [];
  return { calls, run: async (model, inputs) => { calls.push({ model, inputs }); if (reply instanceof Error) throw reply; return reply; } };
};
const noNetwork = (t) => t.mock.method(globalThis, 'fetch', async (url) => assert.fail(`No network in this test: ${url}`));
const readBody = async (response) => ({ status: response.status, body: await response.json() });
const proxy = (args) => proxyWorkersAi({ config: { ai: AGENT_ON_CLOUDFLARE }, baseHeaders: {}, ...args }).then(readBody);

test('the model id lives in one list, and @cf/ names imply Workers AI', () => {
  assert.equal(DEFAULT_WORKERS_AI_MODEL, GLM);
  assert.equal(inferAiProviderFromModel(GLM), 'workers-ai');
  assert.equal(inferAiProviderFromModel('openai/gpt-4o-mini'), 'openrouter');
  assert.equal(isModelAllowed(GLM, 'workers-ai'), true);
  // Models off the list, such as ones Cloudflare is retiring, are refused.
  assert.equal(isModelAllowed('@cf/zai-org/glm-5.3-flash', 'workers-ai'), false);
});

test('only the Session Agent may use it, and every call sets the Session Agent’s reply limit', async (t) => {
  noNetwork(t);
  const ai = stubAi();
  const refused = await proxy({ env: { AI: ai }, payload: { ...ASK, taskType: 'summarize' } });
  assert.deepEqual([refused.status, refused.body.reason], [403, 'workers_ai_task_not_allowed']);
  assert.equal(ai.calls.length, 0);
  assert.deepEqual(await proxy({ env: { AI: ai }, payload: { ...ASK, max_tokens: 99_999, apiKey: 'synthetic-byo-key' } }),
    { status: 200, body: { completion: 'Synthetic open-model answer' } });
  // GLM 5.3 thinks at `max` unless told, so every call asks for `low`.
  assert.deepEqual(ai.calls[0], { model: GLM, inputs: { messages: ASK.messages, max_completion_tokens: REPLY_TOKENS, reasoning_effort: 'low' } });
  // No limit asked: the ceiling is still sent, never the model's own default;
  // and a session set to think harder doesn't change it.
  const harder = { ...AGENT_ON_CLOUDFLARE, reasoningEffort: 'high' };
  await proxyWorkersAi({ env: { AI: ai }, config: { ai: harder }, baseHeaders: {}, payload: { ...ASK, reasoning_effort: 'medium' } });
  assert.deepEqual([ai.calls[1].inputs.max_completion_tokens, ai.calls[1].inputs.reasoning_effort], [REPLY_TOKENS, 'low']);
});

test('a model the session didn’t set, or one off the list, is refused', async (t) => {
  noNetwork(t);
  const ai = stubAi();
  const other = await proxy({ env: { AI: ai }, payload: { ...ASK, model: '@cf/google/gemma-4-26b-a4b-it' } });
  assert.deepEqual([other.status, other.body.reason], [403, 'ai_model_not_allowed']);
  const offList = await proxyWorkersAi({
    env: { AI: ai }, baseHeaders: {}, payload: ASK,
    config: { ai: { models: { 'session-agent': { model: '@cf/zai-org/glm-5.3-flash', provider: 'workers-ai' } } } },
  }).then(readBody);
  assert.equal(offList.status, 403);
  assert.equal(ai.calls.length, 0);
});

test('Cloudflare’s errors become the busy and couldn’t-answer replies, without its text', async (t) => {
  noNetwork(t);
  const busy = await proxy({ env: { AI: stubAi(new Error('AiError: 3040: Capacity temporarily exceeded, please try again.')) }, payload: ASK });
  assert.deepEqual(busy, { status: 429, body: { error: 'Cloudflare’s AI is busy. Try again shortly.', reason: 'workers_ai_busy' } });
  assert.equal((await proxy({ env: { AI: stubAi(new Error('AiError: 3036: Account limited')) }, payload: ASK })).status, 429);
  const failed = await proxy({ env: { AI: stubAi(new Error('AiError: 5007: No such model secret-detail')) }, payload: ASK });
  assert.deepEqual(failed, { status: 502, body: { error: 'Cloudflare’s AI couldn’t answer. Try again.', reason: 'workers_ai_failed' } });
  const unbound = await proxy({ env: {}, payload: ASK });
  assert.deepEqual([unbound.status, unbound.body.reason], [503, 'workers_ai_unbound']);
});

test('replies are read in each shape the models use, never the thinking, and an empty one fails', async (t) => {
  noNetwork(t);
  for (const [reply, completion] of [
    [{ response: 'plain' }, 'plain'],
    [{ choices: [{ message: { content: 'chat', reasoning_content: 'Thinking about Synthetic Member A' } }] }, 'chat'],
    [{ response: '<think>Synthetic Member A said so.</think>\n\ninline' }, 'inline'],
    [{ response: 'Synthetic Member A said so.</think>\n\nclosing tag only' }, 'closing tag only'],
    [{ response: '<think>A</think>Answer first.<think>Synthetic Member B said' }, 'Answer first.'],
    [{ response: '', choices: [{ message: { content: 'chat after an empty response' } }] }, 'chat after an empty response'],
    [{ choices: [{ message: { content: [{ type: 'reasoning', text: 'Synthetic Member A' }, { type: 'text', text: 'parts' }] } }] }, 'parts'],
    [{ output: [
      { type: 'thinking', content: [{ type: 'output_text', text: 'Synthetic Member A. ' }] },
      { type: 'message', content: [{ type: 'output_text', text: 'message only' }] },
    ] }, 'message only'],
    [{ output: [
      { type: 'reasoning', content: [{ type: 'reasoning_text', text: 'Thinking about Synthetic Member A. ' }] },
      { type: 'message', content: [{ type: 'output_text', text: 'responses' }] },
    ] }, 'responses'],
  ]) assert.equal((await proxy({ env: { AI: stubAi(reply) }, payload: ASK })).body.completion, completion);
  // A reply cut off while thinking has no answer, and the thinking is never shown instead.
  for (const reply of [
    { response: '  ' },
    { choices: [{ message: { content: '', reasoning_content: 'Synthetic Member A said' } }] },
    { choices: [{ message: { content: '<think>Synthetic Member A said' } }] },
    { output: [{ type: 'reasoning', content: [{ type: 'reasoning_text', text: 'Synthetic Member A said' }] }] },
  ]) {
    const empty = await proxy({ env: { AI: stubAi(reply) }, payload: ASK });
    assert.deepEqual([empty.status, empty.body.reason], [422, 'ai_empty']);
  }
});

// Through the whole Worker, with OpenAI the only host fetch may reach.
const origin = 'https://client.example.test';
const workerFixture = async ({ ai = stubAi(), limits, bound = true, keys = true, aiConfig = AGENT_ON_CLOUDFLARE } = {}) => {
  const values = new Map();
  const kv = { get: async (key) => values.get(key) ?? null, put: async (key, value) => values.set(key, value),
    delete: async (key) => values.delete(key), list: async ({ prefix = '' } = {}) => ({
      keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true,
    }) };
  const wallet = new Wallet(`0x${'2'.repeat(64)}`);
  const config = { slug: 'fixture', sessionId: `0x${'b'.repeat(32)}`, adminAddress: wallet.address, allowOrigins: [origin],
    scopes: { ai: true }, ai: aiConfig, ...(limits ? { limits } : {}),
    sessionAgent: { audiences: [{ who: { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] }, answers: 'general' }] },
    workerAuthority: { version: 1, participantScopes: ['ai'], anonymousScopes: ['ai'] },
    sessionModeProfile: {
      profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
      identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'none' }, surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
      export: { scope: 'all_session' },
    },
  };
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv, ...(bound ? { AI: ai } : {}),
    TOKEN_HMAC_SECRET: 'synthetic-workers-ai-secret', CE_STORAGE_ENVELOPE_KEK: 'c'.repeat(64), LOGIN_TRUSTED_ORIGINS: origin });
  await kv.put('session:fixture:config', JSON.stringify(config));
  if (keys) await putSessionSecrets(env, 'fixture', { openaiKey: 'synthetic-session-key' });
  const outbound = [];
  const worker = createWorkerRuntime(env, { fetch: async (url, init) => {
    assert.equal(new URL(url).origin, 'https://api.openai.com');
    outbound.push({ url: String(url), body: JSON.parse(init.body) });
    return Response.json({ output_text: 'Synthetic OpenAI output', choices: [{ message: { content: 'Synthetic OpenAI output' } }] });
  }, rpcFetch: async () => assert.fail('No chain access is needed') });
  const nonce = await (await worker.fetch(makeJsonRequest('/auth/nonce', { address: wallet.address, sessionSlug: 'fixture', sessionId: config.sessionId }, { headers: { Origin: origin } }), env)).json();
  const message = buildSiweMessage({ domain: new URL(origin).host, uri: origin, address: wallet.address, nonce: nonce.nonce, sessionSlug: 'fixture', sessionId: config.sessionId });
  const login = await worker.fetch(makeJsonRequest('/auth/login', { address: wallet.address, sessionSlug: 'fixture', sessionId: config.sessionId, message, signature: await wallet.signMessage(message) }, { headers: { Origin: origin } }), env);
  const { token } = await login.json();
  assert.ok(token);
  const request = (path, payload, authenticated = true) => worker.fetch(new Request(`https://worker.example${path}`, {
    method: 'POST',
    headers: { Origin: origin, 'X-Session-Slug': 'fixture', 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  }), env);
  const capabilities = async () => (await worker.fetch(new Request('https://worker.example/capabilities', { headers: { Origin: origin } }), env)).json();
  return { request, capabilities, ai, outbound };
};

test('the Session Agent answers on Workers AI while every other AI task stays on the session’s provider', async (t) => {
  noNetwork(t);
  const f = await workerFixture();
  const asked = await f.request('/session-agent/ask', { question: 'What do people want?' });
  assert.equal(asked.status, 200, await asked.clone().text());
  assert.equal((await asked.json()).answer, 'Synthetic open-model answer');
  assert.deepEqual(f.ai.calls.map(({ model, inputs }) => [model, inputs.max_completion_tokens]), [[GLM, REPLY_TOKENS]]);
  assert.equal(f.outbound.length, 0);
  // A summary, signed in or not, goes to OpenAI as before.
  for (const authenticated of [true, false]) {
    const summary = await f.request('/ai', { action: 'ai', taskType: 'summarize', prompt: 'Sum up' }, authenticated);
    assert.equal(summary.status, 200, await summary.clone().text());
  }
  assert.equal(f.outbound.length, 2);
  assert.equal(f.ai.calls.length, 1);
  // A page can't send other work to Cloudflare by naming it.
  for (const authenticated of [true, false]) {
    const named = await f.request('/ai', { action: 'ai', provider: 'workers-ai', model: GLM, taskType: 'session-agent', prompt: 'x' }, authenticated);
    assert.equal(named.status, 400, await named.clone().text());
  }
  assert.equal(f.ai.calls.length, 1);
});

test('a session with no stored AI keys can still answer the Session Agent on Workers AI', async (t) => {
  noNetwork(t);
  const f = await workerFixture({ keys: false });
  const asked = await f.request('/session-agent/ask', { question: 'What do people want?' });
  assert.equal(asked.status, 200, await asked.clone().text());
  assert.equal(f.ai.calls.length, 1);
  // A Session Agent on the session's own provider still needs its key.
  const { 'session-agent': _cloudflare, ...models } = AGENT_ON_CLOUDFLARE.models;
  const keyed = await workerFixture({ keys: false, aiConfig: { ...AGENT_ON_CLOUDFLARE, models } });
  const refused = await keyed.request('/session-agent/ask', { question: 'What do people want?' });
  assert.deepEqual([refused.status, (await refused.json()).error], [503, 'The session’s AI isn’t set up.']);
  assert.deepEqual([keyed.ai.calls.length, keyed.outbound.length], [0, 0]);
});

test('Session Agent questions on Workers AI count toward each person’s AI calls a day', async (t) => {
  noNetwork(t);
  const f = await workerFixture({ limits: { aiPerWalletPerDay: 2 } });
  for (let index = 0; index < 2; index += 1) {
    assert.equal((await f.request('/session-agent/ask', { question: `Question ${index}?` })).status, 200);
  }
  assert.equal((await f.request('/session-agent/ask', { question: 'Question 2?' })).status, 429);
  assert.equal(f.ai.calls.length, 2);
});

test('a Worker says it can use Cloudflare’s models only when it has the binding', async (t) => {
  noNetwork(t);
  assert.equal((await (await workerFixture()).capabilities()).features.includes('workers_ai_v1'), true);
  const unbound = await workerFixture({ bound: false });
  assert.equal((await unbound.capabilities()).features.includes('workers_ai_v1'), false);
  // Without it, the Session Agent says it couldn't answer, and nothing else is tried.
  assert.equal((await unbound.request('/session-agent/ask', { question: 'What do people want?' })).status, 502);
  assert.equal(unbound.outbound.length, 0);
});
