import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadOrCreateWallet, readAgentState, writeAgentState, updateAgentState } from './agentState.mjs';
import { readConfig } from './config.mjs';

const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'ce-mcp-state-'));

test('keeps every remembered session when state updates overlap', async (t) => {
  const dir = await tempDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      updateAgentState(dir, (state) => {
        state.sessions[`session-${i}`] = { slug: `session-${i}` };
      }),
    ),
  );
  assert.equal(Object.keys((await readAgentState(dir)).sessions).length, 12);
});

test('keeps updates made by separate server processes', async (t) => {
  const dir = await tempDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const moduleUrl = new URL('./agentState.mjs', import.meta.url).href;
  const program = `
    import { updateAgentState } from ${JSON.stringify(moduleUrl)};
    for (let i = 0; i < 12; i++) await updateAgentState(process.argv[1], state => {
      state.sessions[process.argv[2] + ':' + i] = { slug: process.argv[2] + ':' + i };
    });
  `;
  await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      promisify(execFile)(process.execPath, [
        '--input-type=module',
        '-e',
        program,
        dir,
        String(i),
      ]),
    ),
  );
  assert.equal(Object.keys((await readAgentState(dir)).sessions).length, 48);
});

test('a failed state mutation leaves saved state intact and releases the writer', async (t) => {
  const dir = await tempDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await updateAgentState(dir, (state) => {
    state.profile.displayName = 'original';
  });
  await assert.rejects(
    updateAgentState(dir, (state) => {
      state.profile.displayName = 'unsaved';
      throw new Error('mutation failed');
    }),
    /mutation failed/,
  );
  assert.equal((await readAgentState(dir)).profile.displayName, 'original');
  await updateAgentState(dir, (state) => {
    state.current = 'next';
  });
  assert.equal((await readAgentState(dir)).current, 'next');
});

test('a busy or abandoned writer fails without overwriting saved state', async (t) => {
  const dir = await tempDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await updateAgentState(dir, (state) => {
    state.current = 'saved';
  });
  await fs.mkdir(path.join(dir, 'state.lock'));
  await assert.rejects(
    updateAgentState(dir, (state) => {
      state.current = 'lost';
    }),
    /Agent state is busy\. Stop every server/,
  );
  assert.equal((await readAgentState(dir)).current, 'saved');
  await fs.rmdir(path.join(dir, 'state.lock'));
  await updateAgentState(dir, (state) => {
    state.current = 'recovered';
  });
  assert.equal((await readAgentState(dir)).current, 'recovered');
});

test('creates an owner-only key once and reloads the same address', async () => {
  const dir = path.join(await tempDir(), 'agent');
  const first = await loadOrCreateWallet(dir);
  assert.equal(first.created, true);
  const second = await loadOrCreateWallet(dir);
  assert.equal(second.created, false);
  assert.equal(second.wallet.address, first.wallet.address);
  if (process.platform !== 'win32') {
    assert.equal((await fs.stat(path.join(dir, 'agent-key.json'))).mode & 0o777, 0o600);
    assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
  }
});

test('refuses a key file other users can read', { skip: process.platform === 'win32' }, async () => {
  const dir = await tempDir();
  await loadOrCreateWallet(dir);
  await fs.chmod(path.join(dir, 'agent-key.json'), 0o644);
  await assert.rejects(loadOrCreateWallet(dir), /readable by other users/);
});

test('round-trips state and starts empty', async () => {
  const dir = await tempDir();
  assert.deepEqual(await readAgentState(dir), { version: 1, address: '', profile: {}, sessions: {}, current: '' });
  const state = { version: 1, address: '0xabc', profile: { displayName: 'bot' }, sessions: { k: { slug: 's' } }, current: 'k' };
  await writeAgentState(dir, state);
  assert.deepEqual(await readAgentState(dir), state);
});

test('binds the state file to the agent key', async () => {
  const dir = await tempDir();
  const { wallet } = await loadOrCreateWallet(dir);
  assert.equal((await readAgentState(dir)).address, wallet.address);
  await updateAgentState(dir, (state) => {
    state.current = 'kept';
  });
  assert.equal((await readAgentState(dir)).address, wallet.address);
});

test('refuses a new key when saved state outlived its key', async () => {
  const dir = await tempDir();
  const { wallet } = await loadOrCreateWallet(dir);
  await updateAgentState(dir, (state) => {
    state.sessions.k = { slug: 's', answers: { q1: { value: 'yes' } } };
  });
  await fs.rm(path.join(dir, 'agent-key.json'));
  await assert.rejects(loadOrCreateWallet(dir), new RegExp(`is missing, but state.json belongs to agent ${wallet.address}`));
  await assert.rejects(fs.access(path.join(dir, 'agent-key.json')), { code: 'ENOENT' });
  // Moving the state aside starts a new agent on purpose.
  await fs.rename(path.join(dir, 'state.json'), path.join(dir, 'state.old.json'));
  const fresh = await loadOrCreateWallet(dir);
  assert.equal(fresh.created, true);
  assert.notEqual(fresh.wallet.address, wallet.address);
});

test('refuses a new key beside unbound state that remembers sessions', async () => {
  const dir = await tempDir();
  await writeAgentState(dir, { version: 1, profile: {}, sessions: { k: { slug: 's' } }, current: 'k' });
  await assert.rejects(loadOrCreateWallet(dir), /is missing, but state.json belongs to an earlier agent/);
});

test('refuses state that belongs to another key', async () => {
  const [first, second] = [await tempDir(), await tempDir()];
  await loadOrCreateWallet(first);
  const other = await loadOrCreateWallet(second);
  await fs.copyFile(path.join(first, 'state.json'), path.join(second, 'state.json'));
  await assert.rejects(loadOrCreateWallet(second), new RegExp(`but agent-key.json holds ${other.wallet.address}`));
});

test('binds state saved before addresses were recorded to the existing key', async () => {
  const dir = await tempDir();
  const { wallet } = await loadOrCreateWallet(dir);
  await writeAgentState(dir, { version: 1, profile: {}, sessions: { k: { slug: 's' } }, current: 'k' });
  await loadOrCreateWallet(dir);
  const state = await readAgentState(dir);
  assert.equal(state.address, wallet.address);
  assert.deepEqual(state.sessions, { k: { slug: 's' } });
});

test('reads settings, rejecting unknown CE_MCP_* names and relative state paths', () => {
  const config = readConfig({ CE_MCP_STATE_DIR: '/tmp/agent', CE_MCP_DISPLAY_NAME: '  civic   bot ', CE_MCP_APP_ORIGIN: 'https://app.example/path' });
  assert.equal(config.stateDir, '/tmp/agent');
  assert.equal(config.profile.displayName, 'civic bot');
  assert.equal(config.appOrigin, 'https://app.example');
  assert.equal(config.allowLocalWorkers, false);
  assert.throws(() => readConfig({ CE_MCP_DISPLAYNAME: 'x' }), /Unknown setting CE_MCP_DISPLAYNAME/);
  assert.throws(() => readConfig({ CE_MCP_STATE_DIR: 'relative/dir' }), /absolute/);
  assert.throws(() => readConfig({ CE_MCP_DISPLAY_NAME: 'x'.repeat(81) }), /80 characters/);
  assert.throws(() => readConfig({ CE_MCP_RPC_URL: 'http://rpc.example' }), /https/);
  assert.equal(readConfig({ CE_MCP_RPC_URL: 'http://127.0.0.1:8545', CE_MCP_ALLOW_LOCAL_WORKERS: '1' }).rpcUrl, 'http://127.0.0.1:8545/');
  assert.deepEqual(readConfig({}).trustedAppOrigins.slice(0, 2), ['https://contextengine.sh', 'https://www.contextengine.sh']);
});

test('a damaged key file is reported without echoing any key material', { skip: process.platform === 'win32' }, async () => {
  const dir = await tempDir();
  const keyHex = 'ab'.repeat(32);
  for (const body of [`{"privateKey":" 0x${keyHex}"}`, `{"privateKey":"0x${keyHex.slice(0, 63)}"}`, `0x${keyHex}`]) {
    await fs.writeFile(path.join(dir, 'agent-key.json'), body, { mode: 0o600 });
    await assert.rejects(loadOrCreateWallet(dir), (error) => {
      assert.match(error.message, /not a valid agent key file/);
      assert.equal(error.message.includes(keyHex.slice(0, 16)), false);
      return true;
    });
  }
});

test('refuses a linked key file and a state directory other users can write', { skip: process.platform === 'win32' }, async () => {
  const dir = await tempDir();
  await fs.symlink(path.join(dir, 'elsewhere.json'), path.join(dir, 'agent-key.json'));
  await assert.rejects(loadOrCreateWallet(dir), /not a link|could not be read or created/);
  const shared = await tempDir();
  await fs.chmod(shared, 0o777);
  await assert.rejects(loadOrCreateWallet(shared), /writable by other users/);
});

test('accepts a state directory reached through a link the user owns', { skip: process.platform === 'win32' }, async () => {
  const target = await tempDir();
  const parent = await tempDir();
  const linked = path.join(parent, 'agent-link');
  await fs.symlink(target, linked);
  const { wallet } = await loadOrCreateWallet(linked);
  assert.equal((await loadOrCreateWallet(target)).wallet.address, wallet.address);
});
