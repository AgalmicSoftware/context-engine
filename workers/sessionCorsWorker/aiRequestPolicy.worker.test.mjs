import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { createWorkerRuntime } from './worker.js';
import { putSessionSecrets } from './sessionConfigSecretsStore.js';
import { buildSiweMessage, installSessionCoordinatorBinding, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';

const origin = 'https://client.example.test';
const fixture = async () => {
  const values = new Map();
  const kv = { get: async key => values.get(key) ?? null, put: async (key, value) => values.set(key, value),
    delete: async key => values.delete(key), list: async ({ prefix = '' } = {}) => ({
      keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true,
    }) };
  const wallet = new Wallet(`0x${'1'.repeat(64)}`);
  const config = { slug: 'fixture', sessionId: `0x${'a'.repeat(32)}`, adminAddress: wallet.address, allowOrigins: [origin],
    scopes: { ai: true, transcribe: true }, ai: { mode: 'openai', models: { fast: 'gpt-4o-mini', thinking: 'gpt-5' }, reasoningEffort: 'low' },
    workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe'], anonymousScopes: ['ai', 'transcribe'] },
    sessionModeProfile: {
      profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
      identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'none' }, surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
      export: { scope: 'all_session' },
    },
  };
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv,
    TOKEN_HMAC_SECRET: 'synthetic-request-policy-secret', CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), LOGIN_TRUSTED_ORIGINS: origin });
  await kv.put('session:fixture:config', JSON.stringify(config));
  await putSessionSecrets(env, 'fixture', { openaiKey: 'synthetic-session-key' });
  const calls = [];
  const worker = createWorkerRuntime(env, { fetch: async (url, init) => {
    assert.equal(new URL(url).origin, 'https://api.openai.com');
    calls.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body, headers: init.headers });
    return Response.json({ choices: [{ message: { content: 'Synthetic output' } }], output_text: 'Synthetic output', text: 'Synthetic transcript' });
  }, rpcFetch: async () => assert.fail('No chain or live provider access is needed') });
  const nonceResponse = await worker.fetch(makeJsonRequest('/auth/nonce', { address: wallet.address, sessionSlug: 'fixture', sessionId: config.sessionId }, { headers: { Origin: origin } }), env);
  const nonce = await nonceResponse.json();
  assert.equal(nonceResponse.status, 200, nonce.error);
  const message = buildSiweMessage({ domain: new URL(origin).host, uri: origin, address: wallet.address, nonce: nonce.nonce, sessionSlug: 'fixture', sessionId: config.sessionId });
  const login = { address: wallet.address, sessionSlug: 'fixture', sessionId: config.sessionId, message, signature: await wallet.signMessage(message) };
  const response = await worker.fetch(makeJsonRequest('/auth/login', login, { headers: { Origin: origin } }), env);
  const body = await response.json();
  assert.equal(response.status, 200, body.error);
  const request = (path, payload, authenticated = false) => worker.fetch(new Request(`https://worker.example${path}`, {
    method: 'POST', headers: { Origin: origin, 'X-Session-Slug': 'fixture',
      ...(authenticated ? { Authorization: `Bearer ${body.token}` } : {}),
      ...(payload instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    }, body: payload instanceof FormData ? payload : JSON.stringify(payload),
  }), env);
  return { request, calls };
};

for (const authenticated of [false, true]) test(`real ${authenticated ? 'authenticated' : 'anonymous'} routes apply the saved model and request limits`, async () => {
  const f = await fixture();
  for (const path of authenticated ? ['/ai', '/'] : ['/ai']) {
    const refused = await f.request(path, { action: 'ai', provider: 'openai', model: 'gpt-6-astra', max_output_tokens: 64000 }, authenticated);
    assert.equal(refused.status, 403, await refused.clone().text());
    assert.equal((await refused.json()).reason, 'ai_model_not_allowed');
    assert.equal(f.calls.length, 0);
  }
  const paid = await f.request('/ai', { provider: 'openai', model: 'gpt-4o-mini', prompt: 'Fixture',
    max_tokens: 64000, max_output_tokens: 64000, service_tier: 'priority', tools: [{ type: 'web_search' }],
    config: { ai: { models: { fast: 'gpt-6-astra' } } }, internal: true, sponsored: false,
  }, authenticated);
  assert.equal(paid.status, 200, await paid.text());
  assert.equal(f.calls[0].body.max_tokens, 2048);
  assert.equal(f.calls[0].body.service_tier, 'default');
  assert.equal(f.calls[0].body.tools, undefined);
  const defaultModel = await f.request('/ai', { prompt: 'Bridge cluster summary', modelType: 'thinking', taskType: 'summarize' }, authenticated);
  assert.equal(defaultModel.status, 200, await defaultModel.text());
  assert.equal(f.calls[1].body.model, 'gpt-5');
  assert.equal(f.calls[1].body.max_output_tokens, 16000);
  const byo = await f.request('/ai', { provider: 'openai', model: 'gpt-6-astra', apiKey: 'synthetic-byo-key',
    max_output_tokens: 64000, service_tier: 'priority', tools: [{ type: 'web_search' }], reasoning_effort: 'high',
  }, authenticated);
  assert.equal(byo.status, 200, await byo.text());
  assert.equal(f.calls[2].body.max_output_tokens, 64000);
  assert.equal(f.calls[2].body.service_tier, 'priority');
  assert.deepEqual(f.calls[2].body.tools, [{ type: 'web_search' }]);
  assert.equal(f.calls[2].headers.authorization, 'Bearer synthetic-byo-key');
});

for (const authenticated of [false, true]) test(`real ${authenticated ? 'authenticated' : 'anonymous'} transcription rejects a session model swap`, async () => {
  const f = await fixture();
  for (const [model, status] of [['gpt-transcribe', 403], ['whisper-1', 200]]) {
    const data = new FormData();
    data.set('file', new File(['synthetic audio'], 'clip.wav', { type: 'audio/wav' }));
    data.set('model', model);
    const response = await f.request('/transcribe', data, authenticated);
    assert.equal(response.status, status, await response.clone().text());
    if (status === 403) {
      assert.equal((await response.json()).reason, 'ai_model_not_allowed');
      assert.equal(f.calls.length, 0);
    } else assert.equal(f.calls[0].body.get('model'), model);
  }
});
