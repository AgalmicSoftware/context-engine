import { ethers } from 'ethers';
import { LIT_AUTHORIZATION_VERSION as VERSION } from '../../shared/litChipotleAction.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { buildEncryptedSessionSecretsEnvelope, decryptSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import { readCommittedSessionSecrets, commitSessionSecrets, repairPendingSessionSecretsProjection } from './sessionSecretsAuthority.js';
import { resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';

const SIGNER_RECORD = 'session-lit-authorization-signer-v1';
const SETUP_RECORD = 'session-lit-authorization-pending-v1';
const PROVISIONING_RECORD = 'session-lit-provisioning-v1';
const PROVISIONING_LEASE_MS = 5 * 60_000;
const PROVISIONING_FIELDS = new Set(['litApiBase', 'litAccountApiKey', 'accountSecretOutput', 'accountWalletAddress', 'litGroupId', 'litPkpId', 'litActionCid', 'litUsageApiKey', 'registeredAction', 'addedActionToGroup', 'addedPkpToGroup']);
export const hasPendingLitAuthorizationSetup = async (storage) => (await storage.get(SETUP_RECORD)) != null;
const CONFIG_RECORD = 'session-config-authority';
const PRIVATE_KEY = 'litAuthorizationPrivateKey';
const SECRET_KEYS = [PRIVATE_KEY, 'litAccountApiKey', 'litUsageApiKey'];
export const ADMIN_SESSION_SECRET_KEYS = Object.freeze([
  'openaiKey', 'anthropicKey', 'openrouterKey', 'customRpcUrl', 'customRpcKey',
  'arweaveJwk', 'faucetPrivateKey', 'litAccountApiKey', 'litUsageApiKey',
]);
const COORDINATION_ERROR = 'Lit authorization signer coordination failed; retry.';
const PENDING_ERROR = 'Lit setup projection is pending; retry before using the new authority.';
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
});
const fail = (status = 409) => { throw Object.assign(new Error(COORDINATION_ERROR), { status }); };
const walletFor = (key) => {
  if (typeof key !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(key)) fail();
  try { return new ethers.Wallet(key); } catch { return fail(); }
};

const authorityConfig = (authority, baseConfig, slug) => {
  if (authority != null && (!isRecord(authority) || authority.slug !== slug || !isRecord(authority.config))) fail();
  const config = authority?.config || baseConfig;
  if (!isRecord(config)) fail(400);
  return config;
};

const assertConfiguredSigner = (config, wallet, hasExistingKey) => {
  if (config?.litCredentials != null && !isRecord(config.litCredentials)) fail();
  const credentials = config?.litCredentials || {};
  const signer = credentials.litAuthorizationSigner;
  const version = credentials.litAuthorizationVersion;
  if (signer == null && version == null) return;
  if (!hasExistingKey || version !== VERSION || typeof signer !== 'string' ||
    signer.toLowerCase() !== wallet.address.toLowerCase()) fail();
};

const readSignerSecrets = async (record, env, slug) => {
  if (!isRecord(record) || record.version !== 1 || record.slug !== slug) fail();
  const secrets = await decryptSessionSecretsEnvelope(record.envelope, { env, slug });
  if (!isRecord(secrets) || Object.keys(secrets).some((key) => !SECRET_KEYS.includes(key)) ||
    Object.values(secrets).some((value) => typeof value !== 'string')) fail();
  walletFor(secrets[PRIVATE_KEY]);
  return secrets;
};

export const executeLitAuthorizationSignerEnsure = async (coordinator, payload) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  if (!slug || !isRecord(payload?.baseConfig)) return json({ error: COORDINATION_ERROR }, 400);
  try {
    const proposed = walletFor(payload.proposedPrivateKey);
    await coordinator.assertSessionAuthority(payload);
    await coordinator.repairPendingSessionConfigProjection();
    const privateKey = await coordinator.state.storage.transaction(async (transaction) => {
      const record = await transaction.get(SIGNER_RECORD);
      const config = authorityConfig(await transaction.get(CONFIG_RECORD), payload.baseConfig, slug);
      const secrets = record != null
        ? await readSignerSecrets(record, coordinator.env, slug)
        : await readCommittedSessionSecrets(coordinator, transaction, slug);
      const hasExistingKey = hasOwn(secrets, PRIVATE_KEY);
      const chosen = hasExistingKey ? walletFor(secrets[PRIVATE_KEY]) : proposed;
      assertConfiguredSigner(config, chosen, hasExistingKey);
      if (record == null) {
        // Reserve once in durable storage before remote provisioning. No KV
        // write here: a delayed contender must not overwrite newer usage keys.
        const envelope = await buildEncryptedSessionSecretsEnvelope({ [PRIVATE_KEY]: chosen.privateKey }, { env: coordinator.env, slug });
        await transaction.put(SIGNER_RECORD, { version: 1, slug, envelope });
      }
      return chosen.privateKey;
    });
    return json({ ok: true, privateKey });
  } catch (error) {
    return json({ error: COORDINATION_ERROR }, error?.status || 503);
  }
};

export const repairPendingLitAuthorizationSetup = async (coordinator) => {
  const pending = await coordinator.state.storage.get(SETUP_RECORD);
  if (pending == null) return;
  const authority = await coordinator.state.storage.get(CONFIG_RECORD);
  const slug = resolveCoordinatorSessionSlugStorageKey(pending.slug);
  if (!slug || pending.version !== 1 || !Number.isSafeInteger(pending.revision) ||
    authority?.slug !== slug || authority?.revision !== pending.revision) fail();
  await decryptSessionSecretsEnvelope(pending.envelope, { env: coordinator.env, slug });
  // Keep the encrypted journal until both projections finish. A restart or
  // later config mutation repairs the same pair before accepting another one.
  await repairPendingSessionSecretsProjection(coordinator);
  await coordinator.projectSessionConfigAuthority(authority);
  await coordinator.state.storage.transaction(async (transaction) => {
    const current = await transaction.get(SETUP_RECORD);
    if (current?.revision === pending.revision) await transaction.delete(SETUP_RECORD);
  });
};

const readProvisioning = async (record, env, slug) => {
  if (!isRecord(record) || record.version !== 1 || record.slug !== slug) fail();
  const checkpoint = await decryptSessionSecretsEnvelope(record.envelope, { env, slug });
  if (!isRecord(checkpoint) || Object.keys(checkpoint).some(key => !PROVISIONING_FIELDS.has(key)) ||
    Object.values(checkpoint).some(value => typeof value !== 'string' && typeof value !== 'boolean')) fail();
  return checkpoint;
};

export const executeLitProvisioning = async (coordinator, payload, operation) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  if (!slug) return json({ error: COORDINATION_ERROR }, 400);
  try {
    if (operation !== 'release') {
      await coordinator.assertSessionAuthority(payload, { requireRevision: operation !== 'checkpoint' });
      await coordinator.repairPendingSessionConfigProjection();
    }
    const result = await coordinator.state.storage.transaction(async transaction => {
      const record = await transaction.get(PROVISIONING_RECORD);
      const now = coordinator.now();
      if (operation === 'begin') {
        if (record?.leaseUntilMs > now) fail();
        const saved = record ? await readProvisioning(record, coordinator.env, slug) : {};
        // A changed choice starts a new attempt; an empty setup has no remote
        // resources to resume. Never discard an active attempt's checkpoint.
        const hasResources = ['litAccountApiKey', 'accountWalletAddress', 'litGroupId', 'litPkpId', 'litActionCid', 'litUsageApiKey']
          .some(key => typeof saved[key] === 'string' && saved[key].trim());
        const checkpoint = record?.freshAuthority === (payload.freshAuthority === true) && hasResources ? saved : {};
        const attemptId = crypto.randomUUID();
        const envelope = await buildEncryptedSessionSecretsEnvelope(checkpoint, { env: coordinator.env, slug });
        await transaction.put(PROVISIONING_RECORD, { version: 1, slug, attemptId, freshAuthority: payload.freshAuthority === true,
          leaseUntilMs: now + PROVISIONING_LEASE_MS, envelope });
        return { attemptId, checkpoint };
      }
      // A delayed failure must not release a newer attempt's lease.
      if (operation === 'release') {
        if (record?.slug === slug && record.attemptId === payload.attemptId)
          await transaction.put(PROVISIONING_RECORD, { ...record, leaseUntilMs: 0 });
        return {};
      }
      if (operation !== 'checkpoint' || !record || !payload.attemptId || record.attemptId !== payload.attemptId) fail();
      const previous = await readProvisioning(record, coordinator.env, slug);
      const checkpoint = payload.checkpoint;
      if (!isRecord(checkpoint) || Object.keys(checkpoint).some(key => !PROVISIONING_FIELDS.has(key)) ||
        Object.values(checkpoint).some(value => typeof value !== 'string' && typeof value !== 'boolean')) fail(400);
      // Already-created resources are immutable within an attempt. Wallet
      // lookup alone can refine its returned address to the provider's PKP id.
      for (const [key, value] of Object.entries(previous)) {
        if (key !== 'litPkpId' && hasOwn(checkpoint, key) && checkpoint[key] !== value) fail();
      }
      const envelope = await buildEncryptedSessionSecretsEnvelope({ ...previous, ...checkpoint }, { env: coordinator.env, slug });
      await transaction.put(PROVISIONING_RECORD, { ...record, leaseUntilMs: now + PROVISIONING_LEASE_MS, envelope });
      return {};
    });
    return json({ ok: true, ...result });
  } catch (error) { return json({ error: 'Lit provisioning is pending or in progress; retry.' }, error?.status || 503); }
};

export const executeLitAuthorizationFinalize = async (coordinator, payload) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  const outputs = payload?.secretOutputs;
  if (!slug || !isRecord(payload?.baseConfig) || !isRecord(payload?.litCredentials) ||
    !isRecord(outputs) || Object.keys(outputs).some((key) => !SECRET_KEYS.includes(key)) ||
    Object.values(outputs).some((value) => typeof value !== 'string')) {
    return json({ error: COORDINATION_ERROR }, 400);
  }
  try {
    await coordinator.assertSessionAuthority(payload);
    await coordinator.repairPendingSessionConfigProjection();
    await coordinator.state.storage.transaction(async (transaction) => {
      const provisioning = await transaction.get(PROVISIONING_RECORD);
      if (!payload.attemptId || provisioning?.attemptId !== payload.attemptId) fail();
      const checkpoint = await readProvisioning(provisioning, coordinator.env, slug);
      if (['litGroupId', 'litPkpId', 'litActionCid', 'litUsageApiKey'].some(key => typeof checkpoint[key] !== 'string' || !checkpoint[key].trim()) ||
        ['registeredAction', 'addedActionToGroup', 'addedPkpToGroup'].some(key => checkpoint[key] !== true)) fail();
      for (const key of ['litApiBase', 'litGroupId', 'litPkpId', 'litActionCid']) {
        if (hasOwn(checkpoint, key) && checkpoint[key] !== payload.litCredentials[key]) fail();
      }
      if (hasOwn(checkpoint, 'litUsageApiKey') && checkpoint.litUsageApiKey !== outputs.litUsageApiKey) fail();
      if (hasOwn(checkpoint, 'accountSecretOutput') && checkpoint.accountSecretOutput !== outputs.litAccountApiKey) fail();
      const record = await transaction.get(SIGNER_RECORD);
      const signerSecrets = await readSignerSecrets(record, coordinator.env, slug);
      const wallet = walletFor(signerSecrets[PRIVATE_KEY]);
      if (walletFor(outputs[PRIVATE_KEY]).privateKey !== wallet.privateKey) fail();
      assertConfiguredSigner({ litCredentials: payload.litCredentials }, wallet, true);
      if (payload.litCredentials.litAuthorizationVersion !== VERSION) fail();
      const existing = await transaction.get(CONFIG_RECORD);
      const config = authorityConfig(existing, payload.baseConfig, slug);
      assertConfiguredSigner(config, wallet, true);
      const mutation = coordinator.applySessionConfigMutation({
        existingConfig: config, slug,
        mutation: { kind: 'merge-lit-credentials', litCredentials: payload.litCredentials },
      });
      if (!mutation?.ok) fail(mutation?.status || 400);
      const secrets = { ...(await readCommittedSessionSecrets(coordinator, transaction, slug)), ...signerSecrets };
      for (const [key, value] of Object.entries(outputs)) {
        if (value.trim()) secrets[key] = value.trim();
        else delete secrets[key];
      }
      secrets[PRIVATE_KEY] = wallet.privateKey;
      for (const key of SECRET_KEYS) if (secrets[key] === '') delete secrets[key];
      const envelope = await commitSessionSecrets(coordinator, transaction, slug, secrets);
      const litSecrets = Object.fromEntries(SECRET_KEYS.filter((key) => hasOwn(secrets, key)).map((key) => [key, secrets[key]]));
      const signerEnvelope = await buildEncryptedSessionSecretsEnvelope(litSecrets, { env: coordinator.env, slug });
      const revision = Number(existing?.revision || 0) + 1;
      // Commit the selected signer, usage keys and public Lit descriptor as one
      // authority update; concurrent completions cannot mix their credentials.
      await transaction.put(SIGNER_RECORD, { version: 1, slug, envelope: signerEnvelope });
      await transaction.put(CONFIG_RECORD, {
        ...existing, schemaVersion: 1, slug, revision, config: mutation.config, projectionPending: true,
        projectionPendingSinceMs: coordinator.now(),
      });
      await transaction.put(SETUP_RECORD, { version: 1, slug, revision, envelope });
      await transaction.delete(PROVISIONING_RECORD);
    });
  } catch (error) {
    return json({ error: error?.status ? COORDINATION_ERROR : PENDING_ERROR }, error?.status || 503);
  }
  try {
    await repairPendingLitAuthorizationSetup(coordinator);
    return json({ ok: true });
  } catch {
    return json({ error: PENDING_ERROR }, 503);
  }
};

export const executeSessionSecretsAfterLitRepair = async (coordinator, payload) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  const patch = payload?.incomingSecrets;
  if (!slug || !isRecord(patch) || Object.keys(patch).some((key) => !ADMIN_SESSION_SECRET_KEYS.includes(key)) ||
    Object.values(patch).some((value) => typeof value !== 'string')) {
    return json({ error: 'Invalid session secrets update.' }, 400);
  }
  try {
    // A successful edit must follow pending setup repair. Otherwise replaying
    // that older full-secret journal could silently undo the accepted edit.
    await coordinator.assertSessionAuthority(payload);
    await coordinator.repairPendingSessionConfigProjection();
    await coordinator.state.storage.transaction(async (transaction) => {
      const existing = await readCommittedSessionSecrets(coordinator, transaction, slug);
      const record = await transaction.get(SIGNER_RECORD);
      const litSecrets = record == null ? null : await readSignerSecrets(record, coordinator.env, slug);
      const nextSecrets = { ...existing, ...litSecrets };
      for (const [key, value] of Object.entries(patch)) {
        if (value.trim()) nextSecrets[key] = value.trim();
        else delete nextSecrets[key];
      }
      await commitSessionSecrets(coordinator, transaction, slug, nextSecrets);
      if (record && Object.keys(patch).some((key) => SECRET_KEYS.includes(key))) {
        const nextLitSecrets = Object.fromEntries(SECRET_KEYS.filter((key) => hasOwn(nextSecrets, key)).map((key) => [key, nextSecrets[key]]));
        const envelope = await buildEncryptedSessionSecretsEnvelope(nextLitSecrets, { env: coordinator.env, slug });
        await transaction.put(SIGNER_RECORD, { version: 1, slug, envelope });
      }
    });
    await repairPendingSessionSecretsProjection(coordinator);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.status === 409 ? error.message : 'Session secrets update is pending; retry after setup repair.' }, error.status || 503);
  }
};

const callCoordinator = async ({ env, slug, path, ...payload }) => {
  const normalizedSlug = resolveCoordinatorSessionSlugStorageKey(slug);
  const binding = env?.CE_SESSION_COORDINATOR;
  if (!normalizedSlug || !binding?.idFromName || !binding?.get) {
    return { ok: false, status: 503, body: { error: 'Lit authorization signer coordination is unavailable.' } };
  }
  try {
    const name = await sha256Hex(`session-config:${normalizedSlug}`);
    const response = await binding.get(binding.idFromName(name)).fetch(
      `https://session-coordinator.internal/session-config/lit-authorization/${path}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: normalizedSlug, ...payload }) },
    );
    const body = await response.json();
    return { ok: response.ok && body?.ok === true, status: response.status, body };
  } catch {
    return { ok: false, status: 503, body: { error: COORDINATION_ERROR } };
  }
};

export const ensureSessionLitAuthorizationSigner = async (args) => {
  const result = await callCoordinator({ ...args, path: 'ensure' });
  if (!result.ok) throw Object.assign(new Error(result.body?.error || COORDINATION_ERROR), { status: result.status });
  return walletFor(result.body.privateKey).privateKey;
};

export const finalizeSessionLitAuthorization = async (args) => {
  const result = await callCoordinator({ ...args, path: 'finalize' });
  return { ok: result.ok, status: result.status, body: result.ok ? { ok: true } : { error: result.body?.error || COORDINATION_ERROR } };
};

export const updateSessionSecretsAfterLitRepair = async (args) => {
  const result = await callCoordinator({ ...args, path: 'update-secrets' });
  return { ok: result.ok, status: result.status, body: result.ok ? { ok: true } : { error: 'Session secrets update failed; retry after setup repair.' } };
};

const provisionCall = async (args, operation) => {
  const result = await callCoordinator({ ...args, path: `provisioning/${operation}` });
  if (!result.ok) throw Object.assign(new Error('Lit provisioning is pending or in progress; retry.'), { status: result.status });
  return result.body;
};
export const beginSessionLitProvisioning = args => provisionCall(args, 'begin');
export const checkpointSessionLitProvisioning = args => provisionCall(args, 'checkpoint');
export const releaseSessionLitProvisioning = args => provisionCall(args, 'release');
