import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { ethers } from 'ethers';
import { createMcpServer, serveStdio, SUPPORTED_PROTOCOL_VERSIONS } from './mcpServer.mjs';

const tools = [
  {
    name: 'echo',
    description: 'Echo arguments.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
    annotations: { readOnlyHint: true },
    handler: async (args) => ({ echoed: args.text }),
  },
  {
    name: 'fail',
    description: 'Always fails.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      throw new Error('nope');
    },
  },
];

const server = () => createMcpServer({ serverInfo: { name: 'test', version: '1.0.0' }, instructions: 'Be kind.', tools });
const call = async (srv, message) => JSON.parse(await srv.handleLine(JSON.stringify(message)));

test('initialize negotiates a supported protocol version and falls back to the latest', async () => {
  const srv = server();
  const older = await call(srv, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
  assert.equal(older.result.protocolVersion, '2024-11-05');
  assert.deepEqual(older.result.capabilities, { tools: { listChanged: false } });
  assert.equal(older.result.instructions, 'Be kind.');
  const unknown = await call(srv, { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(unknown.result.protocolVersion, SUPPORTED_PROTOCOL_VERSIONS[0]);
});

test('tools/list exposes names, schemas and annotations without handlers', async () => {
  const reply = await call(server(), { jsonrpc: '2.0', id: 'a', method: 'tools/list' });
  assert.deepEqual(reply.result.tools.map((tool) => tool.name), ['echo', 'fail']);
  assert.equal(reply.result.tools[0].annotations.readOnlyHint, true);
  assert.equal('handler' in reply.result.tools[0], false);
});

test('tools/call returns text and structured content, and tool errors as isError results', async () => {
  const srv = server();
  await call(srv, { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  const ok = await call(srv, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { text: 'hi' } } });
  assert.deepEqual(ok.result.structuredContent, { echoed: 'hi' });
  assert.deepEqual(JSON.parse(ok.result.content[0].text), { echoed: 'hi' });
  const failed = await call(srv, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'fail' } });
  assert.equal(failed.result.isError, true);
  assert.equal(failed.result.content[0].text, 'nope');
});

test('older protocol versions get no structured content', async () => {
  const srv = server();
  await call(srv, { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  const ok = await call(srv, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { text: 'x' } } });
  assert.equal('structuredContent' in ok.result, false);
});

test('protocol errors use JSON-RPC codes and notifications get no reply', async () => {
  const srv = server();
  assert.equal((await call(srv, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'missing' } })).error.code, -32602);
  assert.equal(
    (await call(srv, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: [] } })).error.code,
    -32602,
  );
  assert.equal((await call(srv, { jsonrpc: '2.0', id: 1, method: 'resources/list' })).error.code, -32601);
  assert.equal(JSON.parse(await srv.handleLine('{not json')).error.code, -32700);
  assert.equal((await call(srv, { id: 1, method: 'ping' })).error.code, -32600);
  assert.equal(await srv.handleLine(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })), '');
  assert.deepEqual((await call(srv, { jsonrpc: '2.0', id: 9, method: 'ping' })).result, {});
});

test('batches are refused unless the 2025-03-26 protocol was negotiated', async () => {
  const srv = server();
  await call(srv, { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  const refused = JSON.parse(await srv.handleLine(JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'ping' }])));
  assert.equal(refused.error.code, -32600);
});

test('batches answer every request, skip notifications, and refuse a batched initialize', async () => {
  const srv = server();
  await call(srv, { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  const withInitialize = JSON.parse(await srv.handleLine(JSON.stringify([{ jsonrpc: '2.0', id: 7, method: 'initialize', params: {} }])));
  assert.equal(withInitialize[0].error.code, -32600);
  const replies = JSON.parse(
    await srv.handleLine(
      JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      ]),
    ),
  );
  assert.deepEqual(replies.map((reply) => reply.id), [1, 2]);
});

test('tool calls run one at a time', async () => {
  const order = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const srv = createMcpServer({
    serverInfo: { name: 't', version: '1' },
    tools: [
      { name: 'slow', description: '', inputSchema: { type: 'object' }, handler: async () => { order.push('slow:start'); await gate; order.push('slow:end'); return {}; } },
      { name: 'fast', description: '', inputSchema: { type: 'object' }, handler: async () => { order.push('fast'); return {}; } },
    ],
  });
  const first = srv.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'slow' } }));
  const second = srv.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'fast' } }));
  await new Promise((resolve) => setImmediate(resolve));
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['slow:start', 'slow:end', 'fast']);
});

test('serveStdio reads newline-delimited messages and writes one reply per request line', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const lines = [];
  output.setEncoding('utf8');
  output.on('data', (chunk) => lines.push(...chunk.split('\n').filter(Boolean)));
  const done = serveStdio(server(), { input, output });
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  input.end(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
  await done;
  assert.deepEqual(lines.map((line) => JSON.parse(line).id).sort(), [1, 2]);
});

test('a call cancelled while queued never runs, and a running one stops before the next starts', async () => {
  const events = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const srv = createMcpServer({
    serverInfo: { name: 't', version: '1' },
    tools: [
      {
        name: 'slow',
        description: '',
        inputSchema: { type: 'object' },
        handler: async (_args, { signal }) => {
          events.push('slow:start');
          await gate;
          events.push(`slow:stop aborted=${signal.aborted}`);
          if (signal.aborted) throw new Error('stopped');
          return {};
        },
      },
      { name: 'spend', description: '', inputSchema: { type: 'object' }, handler: async () => events.push('spend:ran') },
      { name: 'quick', description: '', inputSchema: { type: 'object' }, handler: async () => events.push('quick:ran') },
    ],
  });
  const slow = srv.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'slow' } }));
  const spend = srv.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'spend' } }));
  const quick = srv.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'quick' } }));
  await new Promise((resolve) => setImmediate(resolve));
  await srv.handleLine(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 2 } }));
  await srv.handleLine(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }));
  release();
  assert.equal(await slow, '');
  assert.equal(await spend, '');
  assert.equal(JSON.parse(await quick).result.isError, undefined);
  assert.deepEqual(events, ['slow:start', 'slow:stop aborted=true', 'quick:ran']);
});

test('a call past the time limit is signalled to stop and reported as possibly partial', async () => {
  const srv = createMcpServer({
    serverInfo: { name: 't', version: '1' },
    toolTimeoutMs: 20,
    tools: [
      {
        name: 'slow',
        description: '',
        inputSchema: { type: 'object' },
        handler: (_args, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('stopped')))),
      },
      { name: 'quick', description: '', inputSchema: { type: 'object' }, handler: async () => ({ ok: true }) },
    ],
  });
  const slow = JSON.parse(await srv.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'slow' } })));
  assert.equal(slow.result.isError, true);
  assert.match(slow.result.content[0].text, /time limit.*Check before retrying/);
  const quick = JSON.parse(await srv.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'quick' } })));
  assert.equal(quick.result.isError, undefined);
});

const failing = (errors, log) => createMcpServer({
  serverInfo: { name: 't', version: '1' }, log,
  tools: errors.map((error, index) => ({ name: `fail${index}`, description: '', inputSchema: { type: 'object' }, handler: async () => { throw error; } })),
});
const errorTexts = async (srv, count) => {
  const texts = [];
  for (let index = 0; index < count; index += 1) {
    texts.push((await call(srv, { jsonrpc: '2.0', id: index, method: 'tools/call', params: { name: `fail${index}` } })).result.content[0].text);
  }
  return texts;
};

test('error text for the client and the log drops RPC URLs and request data that escaped the chain boundary', async () => {
  const secret = 'https://rpc.example.invalid/v2/SYNTHETIC_RPC_SECRET_123';
  const errors = [
    ethers.logger.makeError('cannot estimate gas; transaction may fail or may require manual gas limit', ethers.errors.UNPREDICTABLE_GAS_LIMIT, {
      reason: 'execution reverted', transaction: { data: '0xfeedfacecafe' }, error: { url: secret, requestBody: '{"params":["0xfeedfacecafe"]}' },
    }),
    new Error(`Faucet check failed: request failed url=${secret} body=0xfeedfacecafe`),
    // A local hostname preserves synthetic userinfo through public text scrubbing.
    new Error('Could not reach https://agent:fixture-password@localhost:8545/v2/SYNTHETIC_RPC_SECRET_123?key=SYNTHETIC_RPC_SECRET_123'),
    new Error('x'.repeat(5000)),
  ];
  const logs = [];
  const texts = await errorTexts(failing(errors, (line) => logs.push(line)), errors.length);
  assert.deepEqual(texts, [
    'cannot estimate gas; transaction may fail or may require manual gas limit',
    'Faucet check failed: request failed',
    'Could not reach https://localhost:8545',
    'x'.repeat(1000),
  ]);
  assert.deepEqual(logs, texts.map((text, index) => `tool fail${index} failed: ${text}`));
});

test('deliberate error messages reach the client and the log unchanged', async () => {
  const messages = [
    'Join this session first with join_session.',
    'The RPC is on a different chain (10); expected 11155420.',
    'This session only allows sign-in from other web apps (https://app.example.org). Ask the session admin to allow https://contextengine.sh.',
    'Session link must be a full URL, such as https://contextengine.sh/session/<slug>?worker=<origin>.',
  ];
  const logs = [];
  assert.deepEqual(await errorTexts(failing(messages.map((message) => new Error(message)), (line) => logs.push(line)), messages.length), messages);
  assert.deepEqual(logs, messages.map((message, index) => `tool fail${index} failed: ${message}`));
});
