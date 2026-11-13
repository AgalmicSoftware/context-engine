import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { loadOrCreateWallet } from './agentState.mjs';
import { readConfig } from './config.mjs';

// A host that keeps no files between runs passes the agent's key in
// CE_MCP_PRIVATE_KEY, so every run is the same participant.
const stateDirFor = async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'ce-env-key-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  return stateDir;
};

test('a key from the environment is the agent, in an empty state directory, and is never written to disk', async (t) => {
  const stateDir = await stateDirFor(t);
  const { privateKey, address } = ethers.Wallet.createRandom();
  const config = readConfig({ CE_MCP_STATE_DIR: stateDir, CE_MCP_PRIVATE_KEY: privateKey });
  const { wallet, created } = await loadOrCreateWallet(config.stateDir, { privateKey: config.privateKey });
  assert.equal(wallet.address, address);
  assert.equal(created, false);
  await assert.rejects(access(join(stateDir, 'agent-key.json')));
  const state = JSON.parse(await readFile(join(stateDir, 'state.json'), 'utf8'));
  assert.equal(state.address, address);
  assert.equal(state.keyCreatedWithState, undefined, 'a key from elsewhere may have answered elsewhere');
  // The next run, with the same key, is the same agent.
  assert.equal((await loadOrCreateWallet(stateDir, { privateKey })).wallet.address, address);
});

test('a key from the environment must match the state directory it is used with', async (t) => {
  const stateDir = await stateDirFor(t);
  const { wallet: onDisk } = await loadOrCreateWallet(stateDir);
  const other = ethers.Wallet.createRandom();
  await assert.rejects(loadOrCreateWallet(stateDir, { privateKey: other.privateKey }), new RegExp(`holds ${onDisk.address}`));
  assert.equal((await loadOrCreateWallet(stateDir, { privateKey: onDisk.privateKey })).wallet.address, onDisk.address);
});

test('a malformed key in the environment stops startup without quoting it', () => {
  const secret = `0x${'ab'.repeat(31)}zz`;
  assert.throws(() => readConfig({ CE_MCP_PRIVATE_KEY: secret }), (error) => {
    assert.match(error.message, /CE_MCP_PRIVATE_KEY must be 0x and 64 hexadecimal digits/);
    assert.ok(!error.message.includes(secret.slice(4)));
    return true;
  });
});

test('a key made with its state directory is marked so', async (t) => {
  const stateDir = await stateDirFor(t);
  await loadOrCreateWallet(stateDir);
  assert.equal(JSON.parse(await readFile(join(stateDir, 'state.json'), 'utf8')).keyCreatedWithState, true);
});
