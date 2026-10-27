import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTools } from '../mcp/lib/tools.mjs';
import { stagePackage } from './mcp-release-artifacts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'ce-mcp-pack-'));
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
  env: { ...process.env, npm_config_cache: join(temporary, 'npm-cache') }, ...options,
});

try {
  run('npm', ['--prefix', 'mcp', 'run', 'build']);
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: join(root, 'mcp') }));
  const tarball = join(temporary, packed.filename);
  const entries = run('tar', ['-tzf', tarball]).trim().split('\n').sort();
  assert.deepEqual(entries, [
    'package/LICENSE', 'package/README.md', 'package/dist/THIRD_PARTY_LICENSES.txt',
    'package/dist/contextengine.mjs', 'package/package.json',
  ].sort());
  const manifest = JSON.parse(run('tar', ['-xOf', tarball, 'package/package.json']));
  assert.equal(manifest.name, '@agalmic/contextengine');
  assert.equal(manifest.publishConfig.access, 'public');
  assert.equal(manifest.bin.contextengine, 'dist/contextengine.mjs');
  for (const key of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.deepEqual(Object.keys(manifest[key] || {}), [], `${key} must be empty`);
  }
  const bundle = run('tar', ['-xOf', tarball, 'package/dist/contextengine.mjs']);
  assert.ok(bundle.startsWith('#!/usr/bin/env node\n'));
  const notices = run('tar', ['-xOf', tarball, 'package/dist/THIRD_PARTY_LICENSES.txt']);
  assert.match(notices, /ethers@5\.7\.2/);
  assert.match(notices, /Permission is hereby granted/);
  assert.match(notices, /ws@7\.5\.11/);
  assert.match(notices, /bn\.js@5\.2\.3/);
  assert.match(notices, /elliptic@6\.6\.1/);
  await writeFile(join(temporary, 'package.json'), '{"name":"pack-smoke","private":true}');
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: temporary });
  const installed = JSON.parse(await readFile(join(temporary, 'node_modules/@agalmic/contextengine/package.json'), 'utf8'));
  const messages = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'pack-smoke', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ];
  const stdout = run(join(temporary, 'node_modules/.bin/contextengine'), [], {
    cwd: temporary,
    env: { PATH: process.env.PATH, HOME: temporary, CE_MCP_STATE_DIR: join(temporary, 'state') },
    timeout: 20_000,
    input: messages.map((message) => JSON.stringify(message)).join('\n') + '\n',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const replies = stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(replies.length, 2);
  for (const reply of replies) assert.equal(reply.jsonrpc, '2.0');
  assert.equal(replies.find((reply) => reply.id === 1).result.serverInfo.version, installed.version);
  assert.deepEqual(
    replies.find((reply) => reply.id === 2).result.tools.map((tool) => tool.name).sort(),
    buildTools({}).map((tool) => tool.name).sort(),
  );
  console.log(`MCP pack smoke passed: ${manifest.name}@${manifest.version}, ${entries.length} files, no runtime dependencies.`);
  if (process.env.MCP_RELEASE_OUTPUT) {
    stagePackage({ root, tarball, output: process.env.MCP_RELEASE_OUTPUT });
    console.log('Retained the tested tarball and source receipt for release.');
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
