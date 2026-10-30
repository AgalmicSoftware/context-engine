import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { SessionWriteCoordinator, executeCoordinatedSessionConfigMutation } from './sessionWriteCoordinator.js';
import { ensureSessionLitAuthorizationSigner, finalizeSessionLitAuthorization, updateSessionSecretsAfterLitRepair } from './sessionLitAuthorizationCoordinator.js';
import { getSessionConfig, getSessionSecrets, putSessionSecrets } from './sessionConfigSecretsStore.js';
import { decryptSessionSecretsEnvelope, isEncryptedSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import worker from './worker.js';
import * as provisioning from './sessionLitAuthorizationCoordinator.js';
import { bootstrapLitChipotleSession } from './chipotleClient.js';
import { readCurrentSessionConfig } from './sessionConfigAuthority.js';

const KEY_A = `0x${'11'.repeat(32)}`;
const KEY_B = `0x${'22'.repeat(32)}`;
const SIGNER_A = new ethers.Wallet(KEY_A).address;
const baseConfig = { slug: 'fixture', adminAddress: `0x${'aa'.repeat(20)}` };
const SIGNER_RECORD = 'session-lit-authorization-signer-v1';
const SETUP_RECORD = 'session-lit-authorization-pending-v1';
const CONFIG_RECORD = 'session-config-authority';

const createFixture = () => {
  const kv = new Map([['session:fixture:config', JSON.stringify(baseConfig)]]);
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
  let now = Date.now();
  let coordinator = new SessionWriteCoordinator(state, env, { now: () => now });
  const identities = [];
  env.CE_SESSION_COORDINATOR = {
    idFromName: (name) => { identities.push(name); return name; },
    get: () => ({ fetch: (url, init) => coordinator.fetch(new Request(url, init)) }),
  };
  const expected = async (slug = 'fixture') => {
    const snapshot = await readCurrentSessionConfig({ env, slug });
    return { actor: baseConfig.adminAddress, revision: snapshot.revision, authzEpoch: snapshot.config?.authzEpoch ?? 0 };
  };
  return {
    env, kv, store, state, identities, expected,
    restart: () => { coordinator = new SessionWriteCoordinator(state, env, { now: () => now }); },
    advance: (ms) => { now += ms; },
    failConfig: (value) => { failConfigPut = value; },
    failSecrets: (value) => { failSecretsPut = value; },
    onConfigPut: (callback) => { beforeConfigPut = callback; },
    updateSecrets: async (incomingSecrets) => updateSessionSecretsAfterLitRepair({ env, slug: 'fixture', incomingSecrets, expectedAuthority: env.CE_SESSION_COORDINATOR ? await expected() : null }),
    ensure: async (proposedPrivateKey = KEY_A, config = baseConfig, slug = 'fixture') => {
      if (!store.has(CONFIG_RECORD)) kv.set(`session:${slug === 'general' ? '' : slug}:config`, JSON.stringify(config));
      return ensureSessionLitAuthorizationSigner({ env, slug, proposedPrivateKey, baseConfig: config, expectedAuthority: env.CE_SESSION_COORDINATOR ? await expected(slug) : null });
    },
    finalize: async (label, extra = {}) => {
      let attempt;
      try { attempt = await provisioning.beginSessionLitProvisioning({ env, slug: 'fixture', baseConfig, expectedAuthority: await expected() }); }
      catch (error) { return { ok: false, status: error.status }; }
      const payload = {
      env, slug: 'fixture', baseConfig, expectedAuthority: await expected(), attemptId: attempt.attemptId,
      litCredentials: {
        litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A,
        litPkpId: `pkp-${label}`, litGroupId: `group-${label}`, litActionCid: `cid-${label}`,
      },
      secretOutputs: { litAuthorizationPrivateKey: KEY_A, litUsageApiKey: `usage-${label}` },
      ...extra,
      };
      await provisioning.checkpointSessionLitProvisioning({ env, slug: 'fixture', expectedAuthority: await expected(), attemptId: attempt.attemptId, checkpoint: {
        litGroupId: payload.litCredentials.litGroupId || 'invalid', litPkpId: payload.litCredentials.litPkpId || 'invalid', litActionCid: payload.litCredentials.litActionCid || 'invalid',
        litUsageApiKey: payload.secretOutputs.litUsageApiKey, registeredAction: true, addedActionToGroup: true, addedPkpToGroup: true,
        ...(Object.hasOwn(payload.secretOutputs, 'litAccountApiKey') ? { accountSecretOutput: payload.secretOutputs.litAccountApiKey } : {}),
      } });
      const result = await finalizeSessionLitAuthorization(payload);
      await provisioning.releaseSessionLitProvisioning({ env, slug: 'fixture', attemptId: attempt.attemptId });
      return result;
    },
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
  const expectedAuthority = await fixture.expected();
  const request = (proposedPrivateKey) => new Request('https://session-coordinator.internal/session-config/lit-authorization/ensure', {
    method: 'POST', body: JSON.stringify({ slug: 'fixture', baseConfig, proposedPrivateKey, expectedAuthority }),
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
  assert.equal(await fixture.ensure(KEY_B, conflicting), KEY_A, 'a stale caller cannot replace durable config');
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
  assert.ok(fixture.identities.every((id) => id === fixture.identities[0]));
  delete fixture.env.CE_SESSION_COORDINATOR;
  await assert.rejects(fixture.ensure(), /coordination is unavailable/);
  const unavailable = createFixture();
  delete unavailable.env.CE_STORAGE_ENVELOPE_KEK;
  await assert.rejects(unavailable.ensure(), /coordination failed/);
  assert.equal(unavailable.store.has(SIGNER_RECORD), false);
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
  // Each request awaits current authority before finalizing; either can win.
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
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
    env: fixture.env, slug: 'fixture', existingConfig: baseConfig, expectedAuthority: await fixture.expected(),
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
  for (const bad of [{ secretOutputs: { litAuthorizationPrivateKey: KEY_B, litUsageApiKey: 'bad' } },
    { litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A, apiKey: 'forbidden' } }]) {
    const fixture = createFixture();
    await fixture.ensure();
    assert.equal((await fixture.finalize('active')).ok, true);
    const previous = fixture.kv.get('session:fixture:secrets');
    assert.equal((await fixture.finalize('bad', bad)).ok, false);
    assert.equal(fixture.kv.get('session:fixture:secrets'), previous);
    assert.equal((await getSessionConfig(fixture.env, 'fixture')).litCredentials.litPkpId, 'pkp-active');
  }
});

test('admin secret edits fail before writing while Lit repair is blocked, then survive later repair and restart', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-old' });
  await fixture.ensure();
  fixture.failConfig(true);
  assert.equal((await fixture.finalize('pending')).status, 503);
  await assert.rejects(fixture.updateSecrets({ openaiKey: 'synthetic-new' }), (error) => error.status === 503);
  const authority = fixture.store.get(CONFIG_RECORD);
  assert.equal((await updateSessionSecretsAfterLitRepair({ env: fixture.env, slug: 'fixture',
    expectedAuthority: { actor: baseConfig.adminAddress, revision: authority.revision, authzEpoch: authority.config.authzEpoch ?? 0 },
    incomingSecrets: { openaiKey: 'synthetic-new' },
  })).status, 503);
  assert.equal((await getSessionSecrets(fixture.env, 'fixture')).openaiKey, 'synthetic-old');
  fixture.failConfig(false);
  fixture.restart();
  assert.equal((await fixture.updateSecrets({ openaiKey: 'synthetic-new' })).ok, true);
  fixture.restart();
  assert.equal((await executeCoordinatedSessionConfigMutation({
    env: fixture.env, slug: 'fixture', existingConfig: baseConfig, expectedAuthority: await fixture.expected(),
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

for (const replacement of ['synthetic-new-key', '']) test(`secret patches preserve committed replacements and removals over stale KV (${replacement ? 'replace' : 'clear'})`, async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-old-key', customRpcKey: 'synthetic-provisioned' });
  const stale = fixture.kv.get('session:fixture:secrets');
  assert.equal((await fixture.updateSecrets({ openaiKey: replacement })).ok, true);
  fixture.restart();
  const realGet = fixture.env.GROUP_KV.get;
  fixture.env.GROUP_KV.get = (key) => key.endsWith(':secrets') ? stale : realGet(key);
  assert.equal((await fixture.updateSecrets({ anthropicKey: 'synthetic-other-key' })).ok, true);
  fixture.env.GROUP_KV.get = realGet;
  assert.deepEqual(await getSessionSecrets(fixture.env, 'fixture'), {
    ...(replacement ? { openaiKey: replacement } : {}), customRpcKey: 'synthetic-provisioned', anthropicKey: 'synthetic-other-key',
  });
});

test('a committed secret patch survives failed projection, restart and an unrelated retry', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-old-key' });
  fixture.failSecrets(true);
  assert.equal((await fixture.updateSecrets({ openaiKey: 'synthetic-new-key' })).status, 503);
  fixture.restart();
  fixture.failSecrets(false);
  assert.equal((await fixture.updateSecrets({ anthropicKey: 'synthetic-other-key' })).ok, true);
  assert.deepEqual(await getSessionSecrets(fixture.env, 'fixture'), { openaiKey: 'synthetic-new-key', anthropicKey: 'synthetic-other-key' });
});

test('Lit setup patches the committed full document and later edits retain its keys', async () => {
  const fixture = createFixture();
  await putSessionSecrets(fixture.env, 'fixture', { openaiKey: 'synthetic-old-key' });
  const stale = fixture.kv.get('session:fixture:secrets');
  assert.equal((await fixture.updateSecrets({ openaiKey: 'synthetic-new-key' })).ok, true);
  const realGet = fixture.env.GROUP_KV.get;
  fixture.env.GROUP_KV.get = (key) => key.endsWith(':secrets') ? stale : realGet(key);
  await fixture.ensure();
  assert.equal((await fixture.finalize('fresh')).ok, true);
  fixture.restart();
  assert.equal((await fixture.updateSecrets({ anthropicKey: 'synthetic-other-key' })).ok, true);
  fixture.env.GROUP_KV.get = realGet;
  assert.deepEqual(await getSessionSecrets(fixture.env, 'fixture'), {
    openaiKey: 'synthetic-new-key', anthropicKey: 'synthetic-other-key', litAuthorizationPrivateKey: KEY_A, litUsageApiKey: 'usage-fresh',
  });
});

const PROVISIONING_RECORD = 'session-lit-provisioning-v1';
const setupResourcePaths = ['/new_account', '/add_group', '/create_wallet', '/get_lit_action_ipfs_id', '/add_action', '/add_action_to_group', '/add_pkp_to_group', '/add_usage_api_key'];
const litRemoteFixture = () => {
  const calls = new Map();
  return { calls, fetch: async (url) => {
    const path = new URL(url).pathname.replace('/core/v1', '');
    calls.set(path, (calls.get(path) || 0) + 1);
    const values = { '/new_account': { api_key: 'recoverable-account-key', wallet_address: 'account-address' },
      '/add_group': { group_id: '7' }, '/create_wallet': { wallet_address: 'wallet-address' },
      '/get_lit_action_ipfs_id': 'action-cid', '/list_actions': [], '/list_wallets': [], '/list_wallets_in_group': [],
      '/add_usage_api_key': { usage_api_key: 'fixture-usage-key' }, '/billing/balance': { balance_cents: 0 },
    };
    return Response.json(values[path] ?? { success: true });
  } };
};
const beginProvisioning = async (f) => provisioning.beginSessionLitProvisioning({ env: f.env, slug: 'fixture', baseConfig, expectedAuthority: await f.expected(), freshAuthority: false });
for (const step of ['litAccountApiKey', 'litGroupId', 'litPkpId', 'litActionCid', 'registeredAction', 'addedActionToGroup', 'addedPkpToGroup', 'litUsageApiKey']) {
  test(`a crash after ${step} resumes the encrypted checkpoint without recreating resources`, async () => {
    const f = createFixture();
    const remote = litRemoteFixture();
    await f.ensure();
    const first = await beginProvisioning(f);
    let interrupted = false;
    const run = async (reservation, interrupt) => bootstrapLitChipotleSession({
      config: baseConfig, secrets: { litAuthorizationPrivateKey: KEY_A }, sessionSlug: 'fixture',
      provisioning: reservation.checkpoint, fetchImpl: remote.fetch,
      checkpointProvisioning: async (checkpoint) => {
        await provisioning.checkpointSessionLitProvisioning({ env: f.env, slug: 'fixture', expectedAuthority: await f.expected(), attemptId: reservation.attemptId, checkpoint });
        if (interrupt && checkpoint[step] && !interrupted) { interrupted = true; throw new Error('simulated process crash'); }
      },
    });
    await assert.rejects(run(first, true), /simulated process crash/);
    assert.equal(remote.calls.get('/new_account'), 1);
    const record = f.store.get(PROVISIONING_RECORD);
    assert.ok(isEncryptedSessionSecretsEnvelope(record.envelope));
    const recovered = await decryptSessionSecretsEnvelope(record.envelope, { env: f.env, slug: 'fixture' });
    assert.equal(recovered.litAccountApiKey, 'recoverable-account-key');
    assert.equal((await getSessionSecrets(f.env, 'fixture'))?.litAccountApiKey, undefined);
    assert.equal((await getSessionConfig(f.env, 'fixture')).litCredentials, undefined);
    assert.ok(!JSON.stringify([...f.store]).includes('recoverable-account-key'));
    f.restart();
    await assert.rejects(beginProvisioning(f), error => error.status === 409);
    f.advance(6 * 60_000);
    const contenders = await Promise.allSettled([beginProvisioning(f), beginProvisioning(f)]);
    assert.equal(contenders.filter(result => result.status === 'fulfilled').length, 1);
    const resumed = contenders.find(result => result.status === 'fulfilled').value;
    await assert.rejects(provisioning.checkpointSessionLitProvisioning({ env: f.env, slug: 'fixture', expectedAuthority: await f.expected(), attemptId: first.attemptId, checkpoint: {} }), error => error.status === 409);
    const result = await run(resumed, false);
    const finalized = await finalizeSessionLitAuthorization({ env: f.env, slug: 'fixture', baseConfig, expectedAuthority: await f.expected(), attemptId: resumed.attemptId, litCredentials: result.litCredentials, secretOutputs: result.secretOutputs });
    assert.equal(finalized.ok, true);
    assert.equal(f.store.has(PROVISIONING_RECORD), false);
    assert.equal((await getSessionSecrets(f.env, 'fixture')).litAccountApiKey, 'recoverable-account-key');
    for (const path of setupResourcePaths) assert.equal(remote.calls.get(path), 1, path);
    assert.ok(!JSON.stringify(finalized).includes('recoverable-account-key'));
  });
}
test('a handled setup failure releases its attempt while retaining the checkpoint', async () => {
  const f = createFixture();
  const first = await beginProvisioning(f);
  await provisioning.checkpointSessionLitProvisioning({ env: f.env, slug: 'fixture', expectedAuthority: await f.expected(), attemptId: first.attemptId, checkpoint: { litAccountApiKey: 'recoverable-key' } });
  await provisioning.releaseSessionLitProvisioning({ env: f.env, slug: 'fixture', attemptId: first.attemptId });
  const second = await beginProvisioning(f);
  assert.equal(second.checkpoint.litAccountApiKey, 'recoverable-key');
  assert.notEqual(first.attemptId, second.attemptId);
});

test('unfinished provisioning cannot become active or be consumed by finalization', async () => {
  const f = createFixture();
  await f.ensure();
  const attempt = await beginProvisioning(f);
  const result = await finalizeSessionLitAuthorization({ env: f.env, slug: 'fixture', baseConfig, expectedAuthority: await f.expected(), attemptId: attempt.attemptId,
    litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: SIGNER_A, litPkpId: 'wallet', litGroupId: '7', litActionCid: 'action' },
    secretOutputs: { litAuthorizationPrivateKey: KEY_A, litAccountApiKey: 'account', litUsageApiKey: 'usage' },
  });
  assert.equal(result.status, 409);
  assert.equal(f.store.has(PROVISIONING_RECORD), true);
  assert.equal((await getSessionConfig(f.env, 'fixture')).litCredentials, undefined);
  assert.equal((await getSessionSecrets(f.env, 'fixture'))?.litUsageApiKey, undefined);
});

for (const freshAuthority of [false, true]) test(`a failed resource-free bootstrap can restart with freshAuthority=${freshAuthority}`, async () => {
  const f = createFixture();
  await f.ensure();
  const first = await beginProvisioning(f);
  await assert.rejects(bootstrapLitChipotleSession({
    config: baseConfig, secrets: { litAuthorizationPrivateKey: KEY_A }, sessionSlug: 'fixture',
    provisioning: first.checkpoint,
    checkpointProvisioning: async checkpoint => provisioning.checkpointSessionLitProvisioning({
      env: f.env, slug: 'fixture', expectedAuthority: await f.expected(), attemptId: first.attemptId, checkpoint,
    }),
    fetchImpl: async () => { throw new Error('synthetic bootstrap failure'); },
  }), /synthetic bootstrap failure/);
  await provisioning.releaseSessionLitProvisioning({ env: f.env, slug: 'fixture', attemptId: first.attemptId });
  const next = await provisioning.beginSessionLitProvisioning({ env: f.env, slug: 'fixture', baseConfig,
    expectedAuthority: await f.expected(), freshAuthority });
  assert.deepEqual(next.checkpoint, {});
  const result = await bootstrapLitChipotleSession({
    config: baseConfig, secrets: { litAuthorizationPrivateKey: KEY_A }, sessionSlug: 'fixture', request: { freshAuthority },
    provisioning: next.checkpoint, fetchImpl: litRemoteFixture().fetch,
    checkpointProvisioning: async checkpoint => provisioning.checkpointSessionLitProvisioning({
      env: f.env, slug: 'fixture', expectedAuthority: await f.expected(), attemptId: next.attemptId, checkpoint,
    }),
  });
  assert.equal((await finalizeSessionLitAuthorization({ env: f.env, slug: 'fixture', baseConfig,
    expectedAuthority: await f.expected(), attemptId: next.attemptId, litCredentials: result.litCredentials,
    secretOutputs: result.secretOutputs })).ok, true);
});

test('a fresh-authority choice discards a released checkpoint for the previous choice', async () => {
  const f = createFixture();
  const first = await beginProvisioning(f);
  await provisioning.checkpointSessionLitProvisioning({ env: f.env, slug: 'fixture', expectedAuthority: await f.expected(),
    attemptId: first.attemptId, checkpoint: { litGroupId: 'previous-group' } });
  await assert.rejects(provisioning.beginSessionLitProvisioning({ env: f.env, slug: 'fixture', baseConfig,
    expectedAuthority: await f.expected(), freshAuthority: true }), error => error.status === 409);
  await provisioning.releaseSessionLitProvisioning({ env: f.env, slug: 'fixture', attemptId: first.attemptId });
  const next = await provisioning.beginSessionLitProvisioning({ env: f.env, slug: 'fixture', baseConfig,
    expectedAuthority: await f.expected(), freshAuthority: true });
  assert.deepEqual(next.checkpoint, {});
  assert.notEqual(next.attemptId, first.attemptId);
});

test('checkpoint persistence is fenced by its attempt and authority epoch rather than its starting config revision', async () => {
  const f = createFixture();
  const expectedAuthority = await f.expected();
  const attempt = await beginProvisioning(f);
  const current = f.store.get(CONFIG_RECORD);
  f.store.set(CONFIG_RECORD, { ...current, revision: current.revision + 1, config: { ...current.config, sessionName: 'Updated title' } });
  await provisioning.checkpointSessionLitProvisioning({ env: f.env, slug: 'fixture', expectedAuthority,
    attemptId: attempt.attemptId, checkpoint: { litGroupId: 'new-group' } });
  const saved = await decryptSessionSecretsEnvelope(f.store.get(PROVISIONING_RECORD).envelope, { env: f.env, slug: 'fixture' });
  assert.equal(saved.litGroupId, 'new-group');
  assert.equal(f.store.get(CONFIG_RECORD).config.sessionName, 'Updated title');
  f.store.get(CONFIG_RECORD).config.authzEpoch = expectedAuthority.authzEpoch + 1;
  await assert.rejects(provisioning.checkpointSessionLitProvisioning({ env: f.env, slug: 'fixture', expectedAuthority,
    attemptId: attempt.attemptId, checkpoint: {} }), error => error.status === 409);
});

test('resuming setup accepts equivalent normalized API base spellings', async () => {
  const result = await bootstrapLitChipotleSession({
    config: baseConfig, secrets: { litAuthorizationPrivateKey: KEY_A }, sessionSlug: 'fixture',
    request: { litApiBase: 'https://api.chipotle.litprotocol.com/core/v1/' },
    provisioning: { litApiBase: 'https://api.chipotle.litprotocol.com', litAccountApiKey: 'recoverable-account-key' },
    fetchImpl: litRemoteFixture().fetch,
  });
  assert.equal(result.litCredentials.litApiBase, 'https://api.chipotle.litprotocol.com');
});
