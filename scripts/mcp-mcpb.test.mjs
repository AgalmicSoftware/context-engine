import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleEntries, unzip, zip } from './mcp-mcpb.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

// A stand-in checkout: the tracked manifest and package file, with a server that answers like the built one.
const standIn = (server) => {
  const directory = mkdtempSync(join(tmpdir(), 'ce-mcpb-'));
  for (const path of ['mcp/mcpb/manifest.json', 'mcp/package.json', 'mcp/LICENSE']) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    cpSync(join(root, path), join(directory, path));
  }
  mkdirSync(join(directory, 'mcp/dist'));
  writeFileSync(join(directory, 'mcp/dist/contextengine.mjs'), server);
  writeFileSync(join(directory, 'mcp/dist/THIRD_PARTY_LICENSES.txt'), 'notices\n');
  return directory;
};

test('a packed bundle unpacks to the files it was given', () => {
  const entries = [['manifest.json', Buffer.from('{"a":1}\n')], ['server/a.mjs', Buffer.from('x'.repeat(5000))], ['empty', Buffer.alloc(0)]];
  const packed = zip(entries);
  assert.deepEqual([...unzip(packed)], entries);
  assert.deepEqual(zip(entries), packed);
  const directory = mkdtempSync(join(tmpdir(), 'ce-mcpb-zip-'));
  try {
    writeFileSync(join(directory, 'a.mcpb'), packed);
    // The system's own reader checks every stored checksum.
    execFileSync('unzip', ['-t', join(directory, 'a.mcpb')], { stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Claude Desktop can run the bundle with its own Node', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'mcp/mcpb/manifest.json'), 'utf8'));
  // Its built-in Node is used only for the command "node" with the script first; anything else needs a system Node.
  assert.equal(manifest.server.type, 'node');
  assert.equal(manifest.server.mcp_config.command, 'node');
  assert.deepEqual(manifest.server.mcp_config.args, [`\${__dirname}/${manifest.server.entry_point}`]);
  assert.equal(manifest.version, undefined, 'the version comes from mcp/package.json when packed');
  // Every Node the manifest admits must be one the server runs on.
  const { engines } = JSON.parse(readFileSync(join(root, 'mcp/package.json'), 'utf8'));
  assert.ok(engines.node.split('||').map((range) => range.trim()).includes(manifest.compatibility.runtimes.node));
});

test('the bundle holds the server where it finds its own version', () => {
  const directory = standIn(
    "import { readFileSync } from 'node:fs';\nprocess.stdout.write(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);\n",
  );
  try {
    const files = unzip(zip(bundleEntries(directory)));
    const { version } = JSON.parse(readFileSync(join(root, 'mcp/package.json'), 'utf8'));
    const manifest = JSON.parse(files.get('manifest.json'));
    assert.equal(manifest.version, version);
    assert.deepEqual([...files.keys()].sort(), ['LICENSE', 'THIRD_PARTY_LICENSES.txt', 'manifest.json', 'package.json', manifest.server.entry_point].sort());
    for (const [name, body] of files) {
      mkdirSync(dirname(join(directory, 'out', name)), { recursive: true });
      writeFileSync(join(directory, 'out', name), body);
    }
    const entry = join(directory, 'out', ...manifest.server.entry_point.split(posix.sep));
    assert.equal(execFileSync(process.execPath, [entry], { encoding: 'utf8', env: {} }), version);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
