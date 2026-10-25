import { ethers } from 'ethers';
import { LIT_AUTHORIZATION_VERSION as VERSION } from '../../shared/litChipotleAction.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { buildEncryptedSessionSecretsEnvelope, decryptSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import { getSessionSecrets, putSessionSecrets } from './sessionConfigSecretsStore.js';
import { putKvJson } from './responseKvHelpers.js';
import { normalizeWorkerSessionSlug, resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';

const SIGNER_RECORD = 'session-lit-authorization-signer-v1';
const SETUP_RECORD = 'session-lit-authorization-pending-v1';
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
        : (await getSessionSecrets(coordinator.env, normalizeWorkerSessionSlug(slug))) || {};
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
  await putKvJson(coordinator.env, `session:${normalizeWorkerSessionSlug(slug)}:secrets`, pending.envelope);
  await coordinator.projectSessionConfigAuthority(authority);
  await coordinator.state.storage.transaction(async (transaction) => {
    const current = await transaction.get(SETUP_RECORD);
    if (current?.revision === pending.revision) await transaction.delete(SETUP_RECORD);
  });
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
      const secrets = { ...((await getSessionSecrets(coordinator.env, normalizeWorkerSessionSlug(slug))) || {}), ...signerSecrets };
      for (const [key, value] of Object.entries(outputs)) {
        if (value.trim()) secrets[key] = value.trim();
        else delete secrets[key];
      }
      secrets[PRIVATE_KEY] = wallet.privateKey;
      for (const key of SECRET_KEYS) if (secrets[key] === '') delete secrets[key];
      const envelope = await buildEncryptedSessionSecretsEnvelope(secrets, { env: coordinator.env, slug });
      // Empty values in the encrypted authority remember explicit removals;
      // an eventually consistent KV read must not resurrect an old account key.
      const litSecrets = Object.fromEntries(SECRET_KEYS.map((key) => [key, secrets[key] ?? '']));
      const signerEnvelope = await buildEncryptedSessionSecretsEnvelope(litSecrets, { env: coordinator.env, slug });
      const revision = Number(existing?.revision || 0) + 1;
      // Commit the selected signer, usage keys and public Lit descriptor as one
      // authority update; concurrent completions cannot mix their credentials.
      await transaction.put(SIGNER_RECORD, { version: 1, slug, envelope: signerEnvelope });
      await transaction.put(CONFIG_RECORD, {
        ...existing, schemaVersion: 1, slug, revision, config: mutation.config, projectionPending: true,
      });
      await transaction.put(SETUP_RECORD, { version: 1, slug, revision, envelope });
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
    const existing = (await getSessionSecrets(coordinator.env, normalizeWorkerSessionSlug(slug))) || {};
    const litPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => SECRET_KEYS.includes(key)));
    const record = await coordinator.state.storage.get(SIGNER_RECORD);
    const litSecrets = record == null ? null : await readSignerSecrets(record, coordinator.env, slug);
    const envelope = litSecrets && Object.keys(litPatch).length
      ? await buildEncryptedSessionSecretsEnvelope({ ...litSecrets, ...litPatch }, { env: coordinator.env, slug }) : null;
    // Even an unrelated edit must overlay canonical Lit values and deletions;
    // a stale KV snapshot may predate the active signer and usage credential.
    const nextSecrets = { ...existing, ...litSecrets, ...patch };
    for (const key of SECRET_KEYS) if (litSecrets?.[key] === '' && !hasOwn(patch, key)) delete nextSecrets[key];
    await putSessionSecrets(coordinator.env, normalizeWorkerSessionSlug(slug), nextSecrets);
    if (envelope) {
      await coordinator.state.storage.transaction(async (transaction) => {
        await transaction.put(SIGNER_RECORD, { version: 1, slug, envelope });
      });
    }
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
