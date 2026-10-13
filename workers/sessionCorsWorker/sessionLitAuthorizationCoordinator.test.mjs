import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { SessionWriteCoordinator, executeCoordinatedSessionConfigMutation } from './sessionWriteCoordinator.js';
import { ensureSessionLitAuthorizationSigner, finalizeSessionLitAuthorization, updateSessionSecretsAfterLitRepair } from './sessionLitAuthorizationCoordinator.js';
import { getSessionConfig, getSessionSecrets, putSessionSecrets } from './sessionConfigSecretsStore.js';
import { decryptSessionSecretsEnvelope, isEncryptedSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import worker from './worker.js';

const KEY_A = `0x${'11'.repeat(32)}`;
const KEY_B = `0x${'22'.repeat(32)}`;
const SIGNER_A = new ethers.Wallet(KEY_A).address;
const baseConfig = { slug: 'fixture', adminAddress: `0x${'aa'.repeat(20)}` };
const SIGNER_RECORD = 'session-lit-authorization-signer-v1';
const SETUP_RECORD = 'session-lit-authorization-pending-v1';
const CONFIG_RECORD = 'session-config-authority';

const createFixture = () => {
  const kv = new Map();
  const store = new Map();
  let tail = Promise.resolve();
  let failConfigPut = false;
  let failSecretsPut = false;
  let beforeConfigPut = async () => {};
  const env = {
    CE_STORAGE_ENVELOPE_KEK: 'synthetic-coordinator-fixture-kek',
    GROUP_KV: {
      get: async (key) => kv.get(key) ?? null,
      put: async (key, value) => {
        if (key.endsWith(':config')) await beforeConfigPut();
        if (failConfigPut && key.endsWith(':config')) throw new Error('synthetic storage failure');
        if (failSecretsPut && key.endsWith(':secrets')) throw new Error('synthetic storage failure');
        kv.set(key, value);
      },
    },
  };
  const state = { storage: {
    get: async (key) => structuredClone(store.get(key)),
    transaction: (callback) => {
      const run = tail.then(async () => {
        const staged = new Map([...store].map(([key, value]) => [key, structuredClone(value)]));
        const result = await callback({
          get: async (key) => staged.get(key),
          put: async (key, value) => staged.set(key, structuredClone(value)),
          delete: async (key) => staged.delete(key),
        });
        store.clear();
        for (const [key, value] of staged) store.set(key, value);
        return result;
      });
      tail = run.catch(() => undefined);
      return run;
    },
  } };
  let coordinator = new SessionWriteCoordinator(state, env);
  const identities = [];
  env.CE_SESSION_COORDINATOR = {
    idFromName: (name) => { identities.push(name); return name; },
    get: () => ({ fetch: (url, init) => coordinator.fetch(new Request(url, init)) }),
  };
  return {
    env, kv, store, state, identities,
    restart: () => { coordinator = new SessionWriteCoordinator(state, env); },
    failConfig: (value) => { failConfigPut = value; },
    failSecrets: (value) => { failSecretsPut = value; },
    onConfigPut: (callback) => { beforeConfigPut = callback; },
    updateSecrets: (incomingSecrets) => updateSessionSecretsAfterLitRepair({ env, slug: 'fixture', incomingSecrets }),
    ensure: (proposedPrivateKey = KEY_A, config = baseConfig, slug = 'fixture') =>
      ensureSessionLitAuthorizationSigner({ env, slug, proposedPrivateKey, baseConfig: config }),
    finalize: (label, extra = {}) => finalizeSessionLitAuthorization({
      env, slug: 'fixture', baseConfig,
      litCredentials: {
        litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A,
        litPkpId: `pkp-${label}`, litGroupId: `group-${label}`, litActionCid: `cid-${label}`,
      },
      secretOutputs: { litAuthorizationPrivateKey: KEY_A, litUsageApiKey: `usage-${label}` },
      ...extra,
    }),
  };
};

const assertDurableSignerWinner = async (fixture, keys) => {
  const winner = keys[0];
  // Hashing and request parsing happen before serialization, so either caller can arrive first.
  assert.ok([KEY_A, KEY_B].includes(winner));
  assert.deepEqual(keys, [winner, winner]);
  const persisted = fixture.store.get(SIGNER_RECORD);
  assert.equal(persisted.version, 1);
  assert.equal(persisted.slug, 'fixture');
  assert.ok(isEncryptedSessionSecretsEnvelope(persisted.envelope));
  const secrets = await decryptSessionSecretsEnvelope(persisted.envelope, { env: fixture.env, slug: 'fixture' });
  assert.equal(secrets.litAuthorizationPrivateKey, winner);
  for (const key of [KEY_A, KEY_B]) assert.ok(!JSON.stringify([...fixture.store]).includes(key));
  return winner;
};

test('concurrent signer creation chooses one encrypted durable winner without a stale KV write', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { litAccountApiKey: 'synthetic-account' });
  const before = fixture.kv.get('session:fixture:secrets');
  const keys = await Promise.all([fixture.ensure(KEY_A), fixture.ensure(KEY_B)]);
  const winner = await assertDurableSignerWinner(fixture, keys);
  assert.equal(fixture.kv.get('session:fixture:secrets'), before);
  const persisted = structuredClone(fixture.store.get(SIGNER_RECORD));
  const loser = winner === KEY_A ? KEY_B : KEY_A;
  fixture.restart();
  assert.equal(await fixture.ensure(loser), winner, 'remote provisioning failure/restart does not rotate the winner');
  assert.deepEqual(fixture.store.get(SIGNER_RECORD), persisted);
  assert.equal(fixture.kv.get('session:fixture:secrets'), before);
});

test('durable transaction chooses one winner even across independent coordinator instances', async () => {
  const fixture = createFixture();
  const request = (proposedPrivateKey) => new Request('https://session-coordinator.internal/session-config/lit-authorization/ensure', {
    method: 'POST', body: JSON.stringify({ slug: 'fixture', baseConfig, proposedPrivateKey }),
  });
  const responses = await Promise.all([KEY_A, KEY_B].map((key) =>
    new SessionWriteCoordinator(fixture.state, fixture.env).fetch(request(key))));
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  await assertDurableSignerWinner(fixture, await Promise.all(responses.map((response) => response.json().then((body) => body.privateKey))));
  assert.equal(fixture.kv.has('session:fixture:secrets'), false);
});

test('existing active signer seeds authority and conflicting or malformed state fails closed', async () => {
  const fixture = createFixture();
  const active = { ...baseConfig, litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A } };
  await putSessionSecrets(fixture.env, 'fixture', { litAuthorizationPrivateKey: KEY_A });
  assert.equal(await fixture.ensure(KEY_B, active), KEY_A);
  const conflicting = { ...active, litCredentials: { ...active.litCredentials, litAuthorizationSigner: new ethers.Wallet(KEY_B).address } };
  await assert.rejects(fixture.ensure(KEY_B, conflicting), /coordination failed/);
  const prior = structuredClone(fixture.store.get(SIGNER_RECORD));
  fixture.store.set(SIGNER_RECORD, { ...prior, slug: 'another-session' });
  await assert.rejects(fixture.ensure(), /coordination failed/);
  assert.equal(fixture.store.get(SIGNER_RECORD).slug, 'another-session');
  fixture.store.set(SIGNER_RECORD, { ...prior, envelope: { malformed: true } });
  await assert.rejects(fixture.ensure(), /coordination failed/);
  for (const malformed of [false, 0, '', []]) {
    fixture.store.set(SIGNER_RECORD, malformed);
    await assert.rejects(fixture.ensure(), /coordination failed/);
    assert.deepEqual(fixture.store.get(SIGNER_RECORD), malformed);
  }
});

test('missing or malformed active secrets cannot silently replace the active signer', async () => {
  const active = { ...baseConfig, litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A } };
  for (const existingSecrets of [null, { litAuthorizationPrivateKey: '' }, { litAuthorizationPrivateKey: 'malformed' }]) {
    const fixture = createFixture();
    if (existingSecrets) await putSessionSecrets(fixture.env, 'fixture', existingSecrets);
    await assert.rejects(fixture.ensure(KEY_B, active), /coordination failed/);
    assert.equal(fixture.store.has(SIGNER_RECORD), false);
  }
});

test('signer creation honors durable config authority over a stale caller config', async () => {
  const fixture = createFixture();
  fixture.store.set(CONFIG_RECORD, { slug: 'fixture', revision: 1, config: {
    ...baseConfig, litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A },
  } });
  await assert.rejects(fixture.ensure(KEY_B), /coordination failed/);
  assert.equal(fixture.store.has(SIGNER_RECORD), false);
});

test('default slug aliases share one authority and missing storage bindings fail closed', async () => {
  const fixture = createFixture();
  assert.equal(await fixture.ensure(KEY_A, {}, ''), KEY_A);
  assert.equal(await fixture.ensure(KEY_B, {}, 'general'), KEY_A);
  assert.equal(fixture.identities[0], fixture.identities[1]);
  delete fixture.env.CE_SESSION_COORDINATOR;
  await assert.rejects(fixture.ensure(), /coordination is unavailable/);
  const unavailable = createFixture();
  delete unavailable.env.CE_STORAGE_ENVELOPE_KEK;
  await assert.rejects(unavailable.ensure(), /coordination failed/);
  assert.equal(unavailable.store.size, 0);
});

test('coordinator signer operation is not reachable through the public Worker ingress', async () => {
  const fixture = createFixture();
  let coordinatorCalls = 0;
  fixture.env.CE_SESSION_COORDINATOR.get = () => { coordinatorCalls += 1; throw new Error('unexpected public forwarding'); };
  const response = await worker.fetch(new Request('https://worker.example.test/session-config/lit-authorization/ensure', {
    method: 'POST', body: JSON.stringify({ slug: 'fixture', baseConfig, proposedPrivateKey: KEY_A }),
  }), fixture.env, {});
  assert.notEqual(response.status, 200);
  assert.ok(!(await response.text()).includes(KEY_A));
  assert.equal(coordinatorCalls, 0);
});

test('concurrent successful finalizations leave matching Lit config and secrets and preserve unrelated secrets', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-unrelated-secret' });
  await fixture.ensure();
  const results = await Promise.all([fixture.finalize('first'), fixture.finalize('second')]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  const config = await getSessionConfig(fixture.env, 'fixture');
  const secrets = await getSessionSecrets(fixture.env, 'fixture');
  const winner = ['first', 'second'].find((label) => config.litCredentials.litPkpId === `pkp-${label}`);
  assert.ok(winner, 'the committed credentials must belong to one completed attempt');
  assert.deepEqual(config.litCredentials, {
    litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A,
    litPkpId: `pkp-${winner}`, litGroupId: `group-${winner}`, litActionCid: `cid-${winner}`,
  });
  assert.equal(secrets.litUsageApiKey, `usage-${winner}`);
  assert.equal(config.litCredentials.litAuthorizationSigner, new ethers.Wallet(secrets.litAuthorizationPrivateKey).address);
  assert.equal(secrets.openaiKey, 'synthetic-unrelated-secret');
  assert.deepEqual(fixture.store.get(CONFIG_RECORD).config.litCredentials, config.litCredentials);
  const persisted = fixture.store.get(SIGNER_RECORD);
  assert.ok(isEncryptedSessionSecretsEnvelope(persisted.envelope));
  const durableSecrets = await decryptSessionSecretsEnvelope(persisted.envelope, { env: fixture.env, slug: 'fixture' });
  assert.equal(durableSecrets.litAuthorizationPrivateKey, secrets.litAuthorizationPrivateKey);
  assert.equal(durableSecrets.litUsageApiKey, secrets.litUsageApiKey);
  assert.equal(fixture.store.has(SETUP_RECORD), false);
  assert.ok(!JSON.stringify([...fixture.store]).includes(KEY_A));
  for (const label of ['first', 'second']) assert.ok(!JSON.stringify([...fixture.store]).includes(`usage-${label}`));
  assert.ok(!JSON.stringify(results).includes(KEY_A));
});

test('partial finalization persists encrypted retry state and repairs the pair before later config changes', async () => {
  const fixture = createFixture();
  await fixture.ensure();
  fixture.failConfig(true);
  const failed = await fixture.finalize('pending');
  assert.equal(failed.status, 503);
  assert.equal(failed.ok, false);
  assert.match(failed.body.error, /pending/);
  assert.ok(isEncryptedSessionSecretsEnvelope(fixture.store.get(SETUP_RECORD).envelope));
  assert.ok(!JSON.stringify([...fixture.store]).includes('usage-pending'));
  fixture.restart();
  fixture.failConfig(false);
  const mutation = await executeCoordinatedSessionConfigMutation({
    env: fixture.env, slug: 'fixture', existingConfig: baseConfig,
    mutation: { kind: 'set-config', incomingConfig: { name: 'After repair' } },
  });
  assert.equal(mutation.ok, true);
  const config = await getSessionConfig(fixture.env, 'fixture');
  assert.equal(config.litCredentials.litPkpId, 'pkp-pending');
  assert.equal(config.name, 'After repair');
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litUsageApiKey, 'usage-pending');
  assert.equal(fixture.store.has(SETUP_RECORD), false);
});

test('a failed first projection retains the winner and retry repairs both Lit records after restart', async () => {
  const fixture = createFixture();
  await fixture.ensure();
  assert.equal((await fixture.finalize('active')).ok, true);
  const previousSecrets = fixture.kv.get('session:fixture:secrets');
  const previousConfig = fixture.kv.get('session:fixture:config');
  fixture.failSecrets(true);
  const failed = await fixture.finalize('pending');
  assert.equal(failed.status, 503);
  assert.equal(fixture.kv.get('session:fixture:secrets'), previousSecrets);
  assert.equal(fixture.kv.get('session:fixture:config'), previousConfig);
  fixture.restart();
  fixture.failSecrets(false);
  assert.equal(await fixture.ensure(KEY_B), KEY_A);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litUsageApiKey, 'usage-pending');
  assert.equal((await getSessionConfig(fixture.env, 'fixture')).litCredentials.litPkpId, 'pkp-pending');
  assert.equal(fixture.store.has(SETUP_RECORD), false);
});

test('finalization retains latest durable Lit secrets when the KV read is stale', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-preserved-secret' });
  const staleSecrets = fixture.kv.get('session:fixture:secrets');
  await fixture.ensure();
  assert.equal((await fixture.finalize('first', { secretOutputs: {
    litAuthorizationPrivateKey: KEY_A, litAccountApiKey: 'account-first', litUsageApiKey: 'usage-first',
  } })).ok, true);
  const realGet = fixture.env.GROUP_KV.get;
  fixture.env.GROUP_KV.get = (key) => key.endsWith(':secrets') ? staleSecrets : realGet(key);
  assert.equal((await fixture.finalize('second')).ok, true);
  fixture.env.GROUP_KV.get = realGet;
  const secrets = await getSessionSecrets(fixture.env, 'fixture');
  assert.equal(secrets.litAccountApiKey, 'account-first');
  assert.equal(secrets.litUsageApiKey, 'usage-second');
  assert.equal(secrets.openaiKey, 'synthetic-preserved-secret');
});

test('explicit Lit secret removal stays removed across later finalization and stale KV reads', async () => {
  const fixture = createFixture();
  await fixture.ensure();
  assert.equal((await fixture.finalize('first', { secretOutputs: {
    litAuthorizationPrivateKey: KEY_A, litAccountApiKey: 'account-first', litUsageApiKey: 'usage-first',
  } })).ok, true);
  const staleSecrets = fixture.kv.get('session:fixture:secrets');
  assert.equal((await fixture.finalize('env', { secretOutputs: {
    litAuthorizationPrivateKey: KEY_A, litAccountApiKey: '', litUsageApiKey: 'usage-env',
  } })).ok, true);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litAccountApiKey, undefined);
  const realGet = fixture.env.GROUP_KV.get;
  fixture.env.GROUP_KV.get = (key) => key.endsWith(':secrets') ? staleSecrets : realGet(key);
  assert.equal((await fixture.finalize('later')).ok, true);
  fixture.env.GROUP_KV.get = realGet;
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litAccountApiKey, undefined);
});

test('finalization rejects a different signer or secret-like public config without overwriting active state', async () => {
  const fixture = createFixture();
  await fixture.ensure();
  assert.equal((await fixture.finalize('active')).ok, true);
  const previous = fixture.kv.get('session:fixture:secrets');
  assert.equal((await fixture.finalize('bad', { secretOutputs: { litAuthorizationPrivateKey: KEY_B, litUsageApiKey: 'bad' } })).ok, false);
  assert.equal((await fixture.finalize('bad', { litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A, apiKey: 'forbidden' } })).ok, false);
  assert.equal(fixture.kv.get('session:fixture:secrets'), previous);
  assert.equal((await getSessionConfig(fixture.env, 'fixture')).litCredentials.litPkpId, 'pkp-active');
});

test('admin secret edits fail before writing while Lit repair is blocked, then survive later repair and restart', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-old' });
  await fixture.ensure();
  fixture.failConfig(true);
  assert.equal((await fixture.finalize('pending')).status, 503);
  assert.equal((await fixture.updateSecrets({ openaiKey: 'synthetic-new' })).status, 503);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).openaiKey, 'synthetic-old');
  fixture.failConfig(false);
  fixture.restart();
  assert.equal((await fixture.updateSecrets({ openaiKey: 'synthetic-new' })).ok, true);
  fixture.restart();
  assert.equal((await executeCoordinatedSessionConfigMutation({
    env: fixture.env, slug: 'fixture', existingConfig: baseConfig,
    mutation: { kind: 'set-config', incomingConfig: { name: 'After repair' } },
  })).ok, true);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).openaiKey, 'synthetic-new');
  assert.equal((await getSessionConfig(fixture.env, 'fixture')).litCredentials.litPkpId, 'pkp-pending');
});

test('admin secret update waits for an in-flight Lit finalization and merges the resulting latest secrets', async () => {
  const fixture = createFixture();
  await fixture.ensure();
  let releaseProjection;
  let signalProjection;
  const projectionReached = new Promise((resolve) => { signalProjection = resolve; });
  const projectionReleased = new Promise((resolve) => { releaseProjection = resolve; });
  fixture.onConfigPut(async () => { signalProjection(); await projectionReleased; });
  const finalizing = fixture.finalize('first');
  await projectionReached;
  let updateFinished = false;
  const updating = fixture.updateSecrets({ openaiKey: 'synthetic-new' }).then((result) => { updateFinished = true; return result; });
  await new Promise(setImmediate);
  assert.equal(updateFinished, false);
  releaseProjection();
  assert.equal((await finalizing).ok, true);
  assert.equal((await updating).ok, true);
  const secrets = await getSessionSecrets(fixture.env, 'fixture');
  assert.equal(secrets.litUsageApiKey, 'usage-first');
  assert.equal(secrets.openaiKey, 'synthetic-new');
});

test('coordinated admin Lit key set and clear update the encrypted authority and reject signer edits', async () => {
  const fixture = createFixture();
  await fixture.ensure();
  assert.equal((await fixture.finalize('first')).ok, true);
  assert.equal((await fixture.updateSecrets({ litAccountApiKey: 'manual-account' })).ok, true);
  assert.equal((await fixture.finalize('second')).ok, true);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litAccountApiKey, 'manual-account');
  assert.equal((await fixture.updateSecrets({ litAccountApiKey: '' })).ok, true);
  assert.equal((await fixture.finalize('third')).ok, true);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litAccountApiKey, undefined);
  assert.equal((await fixture.updateSecrets({ litAuthorizationPrivateKey: KEY_B })).status, 400);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litAuthorizationPrivateKey, KEY_A);
  delete fixture.env.CE_SESSION_COORDINATOR;
  assert.equal((await fixture.updateSecrets({ openaiKey: 'blocked' })).status, 503);
});

test('unrelated admin secret edits preserve canonical Lit fields and removals over stale KV', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-old' });
  let staleSecrets = fixture.kv.get('session:fixture:secrets');
  await fixture.ensure();
  assert.equal((await fixture.finalize('active', { secretOutputs: {
    litAuthorizationPrivateKey: KEY_A, litAccountApiKey: 'account-active', litUsageApiKey: 'usage-active',
  } })).ok, true);
  const realGet = fixture.env.GROUP_KV.get;
  fixture.env.GROUP_KV.get = (key) => key.endsWith(':secrets') ? staleSecrets : realGet(key);
  assert.equal((await fixture.updateSecrets({ openaiKey: 'synthetic-new' })).ok, true);
  fixture.env.GROUP_KV.get = realGet;
  const secrets = await getSessionSecrets(fixture.env, 'fixture');
  assert.equal(secrets.litAuthorizationPrivateKey, KEY_A);
  assert.equal(secrets.litUsageApiKey, 'usage-active');
  assert.equal(secrets.litAccountApiKey, 'account-active');
  staleSecrets = fixture.kv.get('session:fixture:secrets');
  assert.equal((await fixture.updateSecrets({ litAccountApiKey: '' })).ok, true);
  fixture.env.GROUP_KV.get = (key) => key.endsWith(':secrets') ? staleSecrets : realGet(key);
  assert.equal((await fixture.updateSecrets({ openaiKey: 'synthetic-newer' })).ok, true);
  fixture.env.GROUP_KV.get = realGet;
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).litAccountApiKey, undefined);
});
