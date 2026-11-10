import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../agentTestFixture.mjs';
import { loadAgentCredentialHash, readAgentCredentialSlot, revokeAgentCredentialHash } from './agentCredentials.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('cleanup of an older credential cannot revoke a credential issued while cleanup is paused', async () => {
  const f = fixture();
  const first = await f.credential();
  const storage = f.agentEnv.AGENT_ACTION_KV;
  const paused = deferred(), resume = deferred();
  const deleted = [];
  let pauseNextDelete = true;
  f.agentEnv.AGENT_ACTION_KV = { ...storage, delete: async key => {
    deleted.push(key);
    if (pauseNextDelete) {
      pauseNextDelete = false;
      paused.resolve();
      await resume.promise;
    }
    return storage.delete(key);
  } };
  const cleanup = revokeAgentCredentialHash({ env: f.agentEnv, tokenHash: first.tokenHash });
  await paused.promise;
  const second = await f.credential();
  resume.resolve();
  assert.equal((await cleanup).ok, true);
  assert.equal((await loadAgentCredentialHash({ env: f.agentEnv, tokenHash: second.tokenHash })).ok, true);
  assert.equal((await loadAgentCredentialHash({ env: f.agentEnv, tokenHash: first.tokenHash })).ok, false);
  assert.ok(deleted.every(key => key !== first.record.slotKey), 'cleanup never deletes the shared credential slot');
});

test('revocation invalidates the current record while a stale slot permits the next issuance', async () => {
  const f = fixture();
  const issued = await f.credential();
  const before = await f.agentEnv.AGENT_ACTION_KV.get(issued.record.slotKey);
  assert.equal((await revokeAgentCredentialHash({ env: f.agentEnv, tokenHash: issued.tokenHash })).ok, true);
  assert.equal(await f.agentEnv.AGENT_ACTION_KV.get(issued.record.slotKey), before);
  const slot = await readAgentCredentialSlot({ env: f.agentEnv, principal: issued.record.principal, sessionSlug: 'fixture' });
  assert.equal((await loadAgentCredentialHash({ env: f.agentEnv, tokenHash: slot.tokenHash })).ok, false);
  const next = await f.credential();
  assert.equal((await loadAgentCredentialHash({ env: f.agentEnv, tokenHash: next.tokenHash })).ok, true);
});

test('a failed credential-record deletion is reported instead of claiming revocation', async () => {
  const f = fixture();
  const issued = await f.credential();
  const storage = f.agentEnv.AGENT_ACTION_KV;
  f.agentEnv.AGENT_ACTION_KV = { ...storage, delete: async key => {
    if (key.endsWith(issued.tokenHash)) throw new Error('KV deletion failed');
    return storage.delete(key);
  } };
  assert.deepEqual(await revokeAgentCredentialHash({ env: f.agentEnv, tokenHash: issued.tokenHash }),
    { ok: false, reason: 'agent_token_storage_unavailable' });
  assert.equal((await loadAgentCredentialHash({ env: f.agentEnv, tokenHash: issued.tokenHash })).ok, true);
});
