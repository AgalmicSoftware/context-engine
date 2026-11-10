import { buildEncryptedSessionSecretsEnvelope, decryptSessionSecretsEnvelope, isEncryptedSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import { normalizeWorkerSessionSlug } from './sessionSlugResolution.js';
import { putKvJson } from './responseKvHelpers.js';

export const SESSION_SECRETS_AUTHORITY_KEY = 'session-secrets-authority-v1';
const fail = () => { throw new Error('Invalid session secrets authority.'); };

export const readSessionSecretsAuthority = async (coordinator, storage, slug) => {
  const record = await storage.get(SESSION_SECRETS_AUTHORITY_KEY);
  if (record != null) {
    if (record.version !== 1 || record.slug !== slug || !Number.isSafeInteger(record.revision) || record.revision < 1) fail();
    await decryptSessionSecretsEnvelope(record.envelope, { env: coordinator.env, slug });
    return record;
  }
  // Only provisioning may seed authority from KV. Once adopted, even an empty
  // committed document is authoritative over every later projection read.
  const raw = await coordinator.env.GROUP_KV.get(`session:${normalizeWorkerSessionSlug(slug)}:secrets`);
  if (raw == null) return null;
  const envelope = JSON.parse(raw);
  if (!isEncryptedSessionSecretsEnvelope(envelope)) fail();
  await decryptSessionSecretsEnvelope(envelope, { env: coordinator.env, slug });
  const adopted = { version: 1, slug, revision: 1, envelope, projectionPending: false };
  await storage.put(SESSION_SECRETS_AUTHORITY_KEY, adopted);
  return adopted;
};

export const readCommittedSessionSecrets = async (coordinator, storage, slug) => {
  const record = await readSessionSecretsAuthority(coordinator, storage, slug);
  return record ? decryptSessionSecretsEnvelope(record.envelope, { env: coordinator.env, slug }) : {};
};

export const commitSessionSecrets = async (coordinator, storage, slug, secrets) => {
  const previous = await storage.get(SESSION_SECRETS_AUTHORITY_KEY);
  const envelope = await buildEncryptedSessionSecretsEnvelope(secrets, { env: coordinator.env, slug });
  await storage.put(SESSION_SECRETS_AUTHORITY_KEY, {
    version: 1, slug, revision: (previous?.revision || 0) + 1, envelope, projectionPending: true,
  });
  return envelope;
};

export const repairPendingSessionSecretsProjection = async (coordinator) => {
  const record = await coordinator.state.storage.get(SESSION_SECRETS_AUTHORITY_KEY);
  if (!record?.projectionPending) return;
  await decryptSessionSecretsEnvelope(record.envelope, { env: coordinator.env, slug: record.slug });
  await putKvJson(coordinator.env, `session:${normalizeWorkerSessionSlug(record.slug)}:secrets`, record.envelope);
  await coordinator.state.storage.transaction(async (transaction) => {
    const current = await transaction.get(SESSION_SECRETS_AUTHORITY_KEY);
    if (current?.revision === record.revision) {
      await transaction.put(SESSION_SECRETS_AUTHORITY_KEY, { ...current, projectionPending: false });
    }
  });
};
