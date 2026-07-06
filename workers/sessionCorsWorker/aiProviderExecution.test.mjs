import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOM_RPC_URL_OVERRIDE_REQUIRES_REQUEST_KEY_ERROR,
  proxyAnthropic,
  proxyCustomRPC,
  proxyOpenAI,
  proxyOpenRouter,
} from './aiProviderExecution.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });
const createCustomRpcAuth = (scopes = { ai: true }) => ({
  address: '0xAbC',
  scopes,
});

test('proxyAnthropic preserves missing worker anthropicKey failure before upstream fetch', async () => {
  let fetchCalled = false;

  const result = await proxyAnthropic({
    payload: { prompt: 'ping' },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      fetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Server misconfigured: anthropicKey is missing.' },
    status: 401,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyAnthropic preserves request apiKey precedence, prompt body shaping, and success normalization', async () => {
  let fetchArgs = null;

  const result = await proxyAnthropic({
    payload: {
      apiKey: ' sk-request ',
      prompt: 'hello',
      max_tokens_to_sample: 321,
      temperature: 0.4,
    },
    secrets: { anthropicKey: ' sk-worker ' },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    deps: {
      json: createJsonStub(),
      fetch: async (...args) => {
        fetchArgs = args;
        return new Response(JSON.stringify({
          content: [{ text: 'pong' }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
    constants: {
      anthropicUrl: 'https://api.anthropic.example.test/v1/messages',
    },
  });

  assert.equal(fetchArgs?.[0], 'https://api.anthropic.example.test/v1/messages');
  assert.deepEqual(fetchArgs?.[1]?.headers, {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': 'sk-request',
  });
  assert.deepEqual(JSON.parse(fetchArgs?.[1]?.body), {
    model: 'claude-3-5-sonnet-20240620',
    temperature: 0.4,
    max_tokens: 321,
    messages: [{ role: 'user', content: 'hello' }],
  });
  assert.deepEqual(result, {
    body: {
      completion: 'pong',
      raw: {
        content: [{ text: 'pong' }],
      },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('proxyAnthropic preserves upstream error fallback to Anthropic error', async () => {
  const result = await proxyAnthropic({
    payload: {
      apiKey: 'sk-request',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      fetch: async () => new Response('{}', {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  });

  assert.deepEqual(result, {
    body: {
      error: 'Anthropic error',
      details: {},
    },
    status: 502,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyOpenAI preserves missing worker openaiKey failure before upstream fetch', async () => {
  let fetchCalled = false;

  const result = await proxyOpenAI({
    payload: { prompt: 'ping' },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      fetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Server misconfigured: openaiKey is missing.' },
    status: 401,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyOpenAI preserves request apiKey precedence and responses request shaping', async () => {
  let fetchArgs = null;

  const result = await proxyOpenAI({
    payload: {
      apiKey: ' sk-request ',
      model: 'gpt-5',
      messages: [{ role: 'user', content: 'hello' }],
      response_format: { type: 'json_schema' },
      tools: [{ type: 'function', function: { name: 'lookup' } }],
      functions: [{ name: 'ignored-when-tools-exist' }],
      reasoning_effort: 'high',
    },
    secrets: { openaiKey: ' sk-worker ' },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    deps: {
      json: createJsonStub(),
      fetch: async (...args) => {
        fetchArgs = args;
        return new Response(JSON.stringify({
          output: [{
            content: [
              { text: 'hello ' },
              { output_text: 'world' },
            ],
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
    constants: {
      openAiResponsesUrl: 'https://api.openai.example.test/v1/responses',
    },
  });

  assert.equal(fetchArgs?.[0], 'https://api.openai.example.test/v1/responses');
  assert.deepEqual(fetchArgs?.[1]?.headers, {
    'content-type': 'application/json',
    authorization: 'Bearer sk-request',
  });
  assert.deepEqual(JSON.parse(fetchArgs?.[1]?.body), {
    model: 'gpt-5',
    input: [{ role: 'user', content: 'hello' }],
    text: { format: { type: 'json_schema' } },
    tools: [{ type: 'function', function: { name: 'lookup' } }],
    reasoning: { effort: 'high' },
    max_output_tokens: 16000,
  });
  assert.deepEqual(result, {
    body: {
      completion: 'hello world',
      raw: {
        output: [{
          content: [
            { text: 'hello ' },
            { output_text: 'world' },
          ],
        }],
      },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('proxyOpenAI preserves chat-completions reasoning request shaping for non-responses models', async () => {
  let fetchArgs = null;

  const result = await proxyOpenAI({
    payload: {
      apiKey: 'sk-request',
      model: 'o3-mini',
      prompt: 'solve this',
      response_format: { type: 'json_object' },
      functions: [{ name: 'tool-a' }],
      reasoning_effort: 'medium',
      max_tokens: 222,
      temperature: 0.1,
    },
    secrets: { openaiKey: 'sk-worker' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      fetch: async (...args) => {
        fetchArgs = args;
        return new Response(JSON.stringify({
          choices: [{ message: { content: 'pong' } }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
    constants: {
      openAiChatUrl: 'https://api.openai.example.test/v1/chat/completions',
    },
  });

  assert.equal(fetchArgs?.[0], 'https://api.openai.example.test/v1/chat/completions');
  assert.deepEqual(JSON.parse(fetchArgs?.[1]?.body), {
    model: 'o3-mini',
    messages: [{ role: 'user', content: 'solve this' }],
    response_format: { type: 'json_object' },
    functions: [{ name: 'tool-a' }],
    reasoning_effort: 'medium',
    max_completion_tokens: 222,
  });
  assert.deepEqual(result, {
    body: {
      completion: 'pong',
      raw: {
        choices: [{ message: { content: 'pong' } }],
      },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyOpenAI preserves upstream error fallback to OpenAI error', async () => {
  const result = await proxyOpenAI({
    payload: {
      apiKey: 'sk-request',
      model: 'gpt-4o-mini',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      fetch: async () => new Response('{}', {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  });

  assert.deepEqual(result, {
    body: {
      error: 'OpenAI error',
      details: {},
    },
    status: 502,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyOpenRouter preserves missing worker openrouterKey failure before upstream fetch', async () => {
  let fetchCalled = false;

  const result = await proxyOpenRouter({
    payload: { prompt: 'ping' },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      fetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Server misconfigured: openrouterKey is missing.' },
    status: 401,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyOpenRouter preserves request apiKey precedence, header shaping, and success normalization', async () => {
  let fetchArgs = null;

  const result = await proxyOpenRouter({
    payload: {
      apiKey: ' sk-request ',
      model: 'openai/o3-mini',
      prompt: 'hello',
      response_format: { type: 'json_schema' },
      tools: [{ type: 'function', function: { name: 'lookup' } }],
      functions: [{ name: 'ignored-when-tools-exist' }],
      reasoning_effort: 'high',
      max_tokens: 88,
      appUrl: 'https://app.example.test',
      appName: 'Context Engine',
    },
    secrets: { openrouterKey: ' sk-worker ' },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    deps: {
      json: createJsonStub(),
      fetch: async (...args) => {
        fetchArgs = args;
        return new Response(JSON.stringify({
          choices: [{ message: { content: 'pong' } }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
    constants: {
      openRouterChatUrl: 'https://openrouter.example.test/api/v1/chat/completions',
    },
  });

  assert.equal(fetchArgs?.[0], 'https://openrouter.example.test/api/v1/chat/completions');
  assert.deepEqual(fetchArgs?.[1]?.headers, {
    'content-type': 'application/json',
    authorization: 'Bearer sk-request',
    'HTTP-Referer': 'https://app.example.test',
    'X-Title': 'Context Engine',
  });
  assert.deepEqual(JSON.parse(fetchArgs?.[1]?.body), {
    model: 'openai/o3-mini',
    messages: [{ role: 'user', content: 'hello' }],
    response_format: { type: 'json_schema' },
    tools: [{ type: 'function', function: { name: 'lookup' } }],
    reasoning_effort: 'high',
    max_completion_tokens: 88,
  });
  assert.deepEqual(result, {
    body: {
      completion: 'pong',
      raw: {
        choices: [{ message: { content: 'pong' } }],
      },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('proxyOpenRouter preserves upstream error fallback to OpenRouter error', async () => {
  const result = await proxyOpenRouter({
    payload: {
      apiKey: 'sk-request',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      fetch: async () => new Response('{}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  });

  assert.deepEqual(result, {
    body: {
      error: 'OpenRouter error',
      details: {},
    },
    status: 503,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC preserves override-without-request-key rejection before fetch', async () => {
  let fetchCalled = false;

  const result = await proxyCustomRPC({
    payload: {
      rpcUrl: 'https://rpc.attacker.example.test/v1/chat/completions',
      prompt: 'ping',
    },
    secrets: {
      customRpcUrl: 'https://rpc.safe.example.test/v1/chat/completions',
      customRpcKey: 'sk-worker',
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: createCustomRpcAuth(),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: CUSTOM_RPC_URL_OVERRIDE_REQUIRES_REQUEST_KEY_ERROR },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC rejects non-https localhost targets before outbound-block checks', async () => {
  let fetchCalled = false;
  let outboundCheckCalled = false;

  const result = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'http://localhost:8545',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: createCustomRpcAuth(),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => {
        outboundCheckCalled = true;
        return true;
      },
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.equal(outboundCheckCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Custom RPC must use HTTPS' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC rejects non-https private-network targets before outbound-block checks', async () => {
  let fetchCalled = false;
  let outboundCheckCalled = false;

  const result = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'http://10.0.0.1:8545',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: createCustomRpcAuth(),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => {
        outboundCheckCalled = true;
        return true;
      },
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.equal(outboundCheckCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Custom RPC must use HTTPS' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC rejects custom RPC URLs with userinfo before fetch', async () => {
  let fetchCalled = false;

  const result = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'https://user:[redacted-email]',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: createCustomRpcAuth(),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Custom RPC URL must not contain credentials' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC rejects missing auth or missing auth scopes before fetch', async () => {
  let fetchCalled = false;

  const missingAuthResult = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'https://rpc.example.test/v1/chat/completions',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  const missingScopesResult = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'https://rpc.example.test/v1/chat/completions',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: { address: '0xAbC' },
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(missingAuthResult, {
    body: { error: 'Custom RPC requires authentication' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
  assert.deepEqual(missingScopesResult, {
    body: { error: 'Custom RPC requires authentication' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC preserves blocked-target rejection before safeFetch', async () => {
  let fetchCalled = false;

  const result = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'https://127.0.0.1/v1/chat/completions',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: createCustomRpcAuth(),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => true,
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
      log: () => {},
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Custom RPC URL target is not allowed' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC preserves non-Response passthrough from safeFetch', async () => {
  const result = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'https://rpc.example.test/v1/chat/completions',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: createCustomRpcAuth(),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => false,
      log: () => {},
      safeFetch: async () => ({ error: 'Redirect to blocked target', status: 403 }),
    },
  });

  assert.deepEqual(result, {
    body: { error: 'Redirect to blocked target' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC preserves upstream error fallback to Custom RPC error', async () => {
  const result = await proxyCustomRPC({
    payload: {
      apiKey: 'sk-request',
      rpcUrl: 'https://rpc.example.test/v1/chat/completions',
      prompt: 'ping',
    },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    auth: createCustomRpcAuth(),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => false,
      log: () => {},
      safeFetch: async () => new Response('{}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  });

  assert.deepEqual(result, {
    body: {
      error: 'Custom RPC error',
      details: {},
    },
    status: 503,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('proxyCustomRPC allows authenticated requests without custom_rpc scope and preserves success normalization', async () => {
  let fetchArgs = null;
  const logCalls = [];

  const result = await proxyCustomRPC({
    payload: {
      apiKey: ' sk-request ',
      rpcUrl: 'https://rpc.example.test/eth',
      model: 'o3-mini',
      prompt: 'solve this',
      response_format: { type: 'json_schema' },
      tools: [{ type: 'function', function: { name: 'lookup' } }],
      functions: [{ name: 'ignored-when-tools-exist' }],
      reasoning_effort: 'low',
      max_tokens: 321,
      temperature: 0.3,
    },
    secrets: {
      customRpcUrl: 'https://rpc.secret.example.test/v1/chat/completions',
      customRpcKey: 'sk-worker',
    },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    auth: createCustomRpcAuth({ ai: true }),
    deps: {
      json: createJsonStub(),
      isBlockedOutboundUrl: () => false,
      log: (...args) => {
        logCalls.push(args);
      },
      safeFetch: async (...args) => {
        fetchArgs = args;
        return new Response(JSON.stringify({
          content: [{ text: 'pong' }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });

  assert.equal(fetchArgs?.[0], 'https://rpc.example.test/eth');
  assert.deepEqual(fetchArgs?.[1]?.headers, {
    'content-type': 'application/json',
    authorization: 'Bearer sk-request',
  });
  assert.deepEqual(JSON.parse(fetchArgs?.[1]?.body), {
    model: 'o3-mini',
    messages: [{ role: 'user', content: 'solve this' }],
    response_format: { type: 'json_schema' },
    tools: [{ type: 'function', function: { name: 'lookup' } }],
    reasoning_effort: 'low',
    max_completion_tokens: 321,
  });
  assert.deepEqual(result, {
    body: {
      completion: 'pong',
      raw: {
        content: [{ text: 'pong' }],
      },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
  assert.deepEqual(logCalls, [[
    '[ai] custom rpc request',
    {
      walletAddress: '0xabc',
      rpcDomain: 'rpc.example.test',
    },
  ]]);
});
