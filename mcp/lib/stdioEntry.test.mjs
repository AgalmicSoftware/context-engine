import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/context-engine-mcp.mjs', import.meta.url));

// Speaks MCP to the real executable the way an MCP host does.
const runSession = (env, messages) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN], { env: { PATH: process.env.PATH, HOME: os.tmpdir(), ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr, replies: stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line)) }));
    child.stdin.end(messages.map((message) => JSON.stringify(message)).join('\n') + '\n');
  });

test('the executable answers MCP over stdio and keeps one agent identity per state directory', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-mcp-entry-'));
  const env = { CE_MCP_STATE_DIR: stateDir, CE_MCP_DISPLAY_NAME: 'entry-bot' };
  const first = await runSession(env, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'whoami', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'set_profile', arguments: { modelId: 'model-x' } } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_questions', arguments: {} } },
  ]);
  assert.equal(first.code, 0);
  const byId = Object.fromEntries(first.replies.map((reply) => [reply.id, reply]));
  assert.equal(byId[1].result.serverInfo.name, 'context-engine');
  assert.match(byId[1].result.instructions, /Never claim to be human/);
  assert.deepEqual(
    byId[2].result.tools.map((tool) => tool.name).sort(),
    ['add_statement', 'answer', 'claim_sbt', 'get_results', 'get_session', 'join_group', 'join_session', 'list_questions', 'request_test_eth', 'set_profile', 'whoami'],
  );
  const whoami = byId[3].result.structuredContent;
  assert.deepEqual(byId[2].result.tools.find((tool) => tool.name === 'request_test_eth').annotations, {
    readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true,
  });
  for (const name of ['answer', 'add_statement']) {
    assert.deepEqual(byId[2].result.tools.find((tool) => tool.name === name).annotations, {
      readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true,
    });
  }
  assert.match(whoami.address, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(whoami.profile.displayName, 'entry-bot');
  assert.equal(byId[4].result.structuredContent.profile.modelId, 'model-x');
  assert.equal(byId[5].result.isError, true);
  assert.match(byId[5].result.content[0].text, /join_session/);
  assert.match(first.stderr, /created agent address/);
  // The private key never appears in protocol output or logs.
  const { privateKey } = JSON.parse(await fs.readFile(path.join(stateDir, 'agent-key.json'), 'utf8'));
  assert.equal(`${JSON.stringify(first.replies)}${first.stderr}`.includes(privateKey.slice(2)), false);

  const second = await runSession(env, [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } }]);
  assert.equal(second.replies[0].result.structuredContent.address, whoami.address);
  assert.equal(second.replies[0].result.structuredContent.profile.modelId, 'model-x');
});

test('the executable refuses unknown settings', async () => {
  const result = await runSession({ CE_MCP_STATE_DIR: os.tmpdir(), CE_MCP_TYPO: '1' }, []);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown setting CE_MCP_TYPO/);
});
