import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyOpenAI, proxyAnthropic, proxyOpenRouter, proxyCustomRPC } from './aiProviderExecution.js';
import { transcribe } from './transcribeExecution.js';
import { boundSessionAiRequest } from './aiRequestPolicy.js';
import { normalizeTranscribeRequestPayload } from './transcribeRequestNormalization.js';

const adapters = [
  ['openai', proxyOpenAI, 'gpt-4o-mini', 'gpt-5', 'openaiKey'],
  ['anthropic', proxyAnthropic, 'claude-sonnet-4-6', 'claude-opus-4-6', 'anthropicKey'],
  ['openrouter', proxyOpenRouter, 'openai/gpt-4o-mini', 'openai/gpt-5', 'openrouterKey'],
  ['custom', proxyCustomRPC, 'configured-model', 'other-model', 'customRpcKey'],
];
const configFor = (provider, model) => ({ ai: { mode: provider, models: { fast: model, thinking: 'configured-thinking-model' } } });
const invoke = async (adapter, payload = {}, config) => {
  const [provider, proxy, model, , secret] = adapter;
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return Response.json({ choices: [{ message: { content: 'answer' } }], content: [{ text: 'answer' }], output_text: 'answer' });
  };
  const response = await proxy({ payload: { model, messages: [{ role: 'user', content: 'Synthetic request' }], ...payload },
    config: config || configFor(provider, model), secrets: { [secret]: 'synthetic-session-key', customRpcUrl: 'https://rpc.example.test' },
    auth: { address: '0xabc', scopes: { ai: true, custom_rpc: true } },
    deps: { fetch, safeFetch: fetch, json: (body, status, headers) => Response.json(body, { status, headers }), log: () => {} },
  });
  return { response, calls };
};

for (const adapter of adapters) {
  const [provider, , model, otherModel] = adapter;
  test(`${provider}: session model swaps are refused before contacting a provider`, async () => {
    const { response, calls } = await invoke(adapter, { model: otherModel });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).reason, 'ai_model_not_allowed');
    assert.equal(calls.length, 0);
  });
  test(`${provider}: all token aliases, invalid bounds and thinking flags stay within the chat ceiling`, async () => {
    for (const name of ['max_tokens', 'max_completion_tokens', 'max_output_tokens', 'max_tokens_to_sample', 'maxTokens']) {
      for (const value of [64000, '64000', -1, 0, null, {}, 'unlimited']) {
        const { response, calls } = await invoke(adapter, { [name]: value, thinking: true });
        assert.equal(response.status, 200);
        assert.equal(calls[0].body.max_tokens, 2048, `${name}: ${JSON.stringify(value)}`);
        assert.equal(calls[0].body.max_completion_tokens, undefined);
      }
    }
    const { calls } = await invoke(adapter, { max_tokens: 100, max_completion_tokens: 500, max_output_tokens: 64000 });
    assert.equal(calls[0].body.max_tokens, 100);
  });
  test(`${provider}: participant tools are dropped and BYO requests keep their own settings`, async () => {
    const tools = [{ type: 'function', function: { name: 'expensive_tool' } }];
    const payload = { tools, functions: [{ name: 'other_tool' }], service_tier: 'priority', reasoning_effort: 'high', max_tokens: 64000 };
    const funded = await invoke(adapter, payload);
    assert.equal(funded.calls[0].body.tools, undefined);
    assert.equal(funded.calls[0].body.functions, undefined);
    if (provider === 'openai') assert.equal(funded.calls[0].body.service_tier, 'default');
    const byo = await invoke(adapter, { ...payload, apiKey: 'synthetic-byo-key', model: otherModel });
    assert.equal(byo.response.status, 200);
    const output = byo.calls[0].body;
    assert.equal(output.model, otherModel);
    assert.equal(output.max_tokens ?? output.max_output_tokens, 64000);
    if (provider !== 'anthropic') assert.deepEqual(output.tools, tools);
    if (provider === 'openai') {
      assert.equal(output.service_tier, 'priority');
      assert.equal(output.reasoning.effort, 'high');
    }
  });
  test(`${provider}: feature ceilings preserve generation, report, interview and photo requests`, async () => {
    for (const [taskType, requested, expected] of [
      ['generate', 32568, 16000], ['analysis', 7000, 7000], ['interview-map', 8000, 8000],
      ['summarize', 1200, 1200], ['interview-opening', 600, 600], ['rewrite', 64000, 16000], ['rank', 64000, 16000], ['summarize', 32568, 16000],
      ['compare', 16384, 16000], ['categorize', 16384, 16000], ['unknown-task', 64000, 2048],
    ]) {
      const { calls } = await invoke(adapter, { taskType, max_output_tokens: requested });
      assert.equal(calls[0].body.max_tokens, expected, taskType);
    }
    const configured = configFor(provider, model);
    configured.ai.models.analysis = { provider, model: otherModel };
    const result = await invoke(adapter, { taskType: 'analysis', model: otherModel }, configured);
    assert.equal(result.response.status, 200);
    assert.equal((await invoke(adapter, { taskType: 'rewrite', model: otherModel }, configured)).response.status, 403);
  });
}

test('Responses and reasoning limits converge aliases and cap saved task/global effort', async () => {
  for (const model of ['gpt-5', 'o3-mini']) {
    const config = configFor('openai', model);
    config.ai.reasoningEffort = 'medium';
    config.ai.taskReasoningEffort = { rewrite: 'low' };
    for (const field of ['max_tokens', 'max_completion_tokens', 'max_output_tokens', 'max_tokens_to_sample', 'maxTokens']) {
      const result = await invoke(adapters[0], { model, [field]: 64000, reasoning_effort: 'high', service_tier: 'priority' }, config);
      const body = result.calls[0].body;
      assert.equal(body.max_output_tokens ?? body.max_completion_tokens, 16000);
      assert.equal(body.reasoning?.effort ?? body.reasoning_effort, 'medium');
      assert.equal(body.service_tier, 'default');
    }
    const result = await invoke(adapters[0], { model, taskType: 'rewrite', reasoning_effort: 'xhigh', max_tokens: 2000, max_output_tokens: 20 }, config);
    assert.equal(result.calls[0].body.reasoning?.effort ?? result.calls[0].body.reasoning_effort, 'low');
    assert.equal(result.calls[0].body.max_output_tokens ?? result.calls[0].body.max_completion_tokens, 20);
  }
});

test('stored custom Functions remain usable but caller definitions cannot replace them', async () => {
  const config = configFor('custom', 'configured-model');
  const functions = [{ name: 'owner_function', parameters: { type: 'object' } }];
  config.ai.providers = { custom: { functions: JSON.stringify(functions) } };
  const { calls } = await invoke(adapters[3], { tools: [{ type: 'web_search' }], functions: [{ name: 'injected' }] }, config);
  assert.equal(calls[0].body.tools, undefined);
  assert.deepEqual(calls[0].body.functions, functions);
});

test('custom rpcKey and credential-free endpoints do not spend the stored key', async () => {
  const byo = await invoke(adapters[3], { model: 'other-model', rpcKey: 'synthetic-rpc-key', max_tokens: 64000 });
  assert.equal(byo.response.status, 200);
  assert.equal(byo.calls[0].headers.authorization, 'Bearer synthetic-rpc-key');
  assert.equal(byo.calls[0].body.max_tokens, 64000);
  let body;
  const result = await proxyCustomRPC({ payload: { model: 'public-model', rpcUrl: 'https://public.example.test', max_tokens: 5000 },
    secrets: {}, config: {}, auth: { scopes: { ai: true, custom_rpc: true } },
    deps: { log: () => {}, safeFetch: async (_, init) => {
      assert.equal(init.headers.authorization, undefined);
      body = JSON.parse(init.body);
      return Response.json({ completion: 'Synthetic output' });
    } },
  });
  assert.equal(result.status, 200);
  assert.equal(body.max_tokens, 5000);
});

test('transcription accepts only the configured session model and leaves BYO unchanged', async () => {
  for (const apiKey of ['', 'synthetic-byo-key']) {
    for (const model of ['whisper-1', 'gpt-transcribe']) {
      const formData = new FormData();
      formData.set('file', new File(['synthetic audio'], 'clip.wav'));
      formData.set('model', model);
      if (apiKey) formData.set('apiKey', apiKey);
      const calls = [];
      const result = await transcribe({ transcribeRequest: normalizeTranscribeRequestPayload({ formData }),
        config: { ai: { transcription: { provider: 'openai', model: 'whisper-1' } } },
        secrets: { openaiKey: 'synthetic-session-key' },
        deps: { json: (body, status) => Response.json(body, { status }), safeFetch: async (_, init) => {
          calls.push(init.body.get('model'));
          return Response.json({ text: 'Synthetic transcript' });
        } },
      });
      const allowed = apiKey || model === 'whisper-1';
      assert.equal(result.status, allowed ? 200 : 403);
      assert.deepEqual(calls, allowed ? [model] : []);
      if (!allowed) assert.equal((await result.json()).reason, 'ai_model_not_allowed');
    }
  }
});

for (const [provider, model] of [['openrouter', 'openai/gpt-5'], ['openrouter', 'deepseek/deepseek-r1'], ['custom', 'deepseek-r1'], ['custom', 'owner-reasoner']]) {
  test(`${provider}: the configured thinking model gets a reasoning budget regardless of its name (${model})`, async () => {
    const adapter = adapters.find(([name]) => name === provider);
    const config = configFor(provider, adapter[2]);
    config.ai.models.thinking = model;
    for (const [requested, expected] of [[64000, 16000], [700, 700]]) {
      const payload = { model, thinking: false, max_tokens: requested, reasoning_effort: 'high' };
      const bounded = boundSessionAiRequest({ provider, payload, config });
      assert.equal(bounded.payload.thinking, true, 'The saved model selection, not a caller flag, determines reasoning');
      assert.equal(bounded.payload.reasoning_effort, 'low');
      const { response, calls } = await invoke(adapter, payload, config);
      assert.equal(response.status, 200);
      assert.equal(calls[0].body.max_completion_tokens, expected);
      assert.equal(calls[0].body.max_tokens, undefined);
    }
    const photo = await invoke(adapter, { model, taskType: 'summarize', max_tokens: 1200 }, config);
    assert.equal(photo.calls[0].body.max_completion_tokens, 1200, 'A smaller caller bound still wins');
  });
}
