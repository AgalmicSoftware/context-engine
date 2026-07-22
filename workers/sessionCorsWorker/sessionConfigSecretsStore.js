import { getKvJson, putKvJson } from './responseKvHelpers.js';
import { normalizeWorkerConfigRecord } from './sessionConfigNormalization.js';
import {
  buildEncryptedSessionSecretsEnvelope,
  decryptSessionSecretsEnvelope,
  isEncryptedSessionSecretsEnvelope,
  unwrapSessionSecretsEnvelope,
} from '../shared/sessionSecretsEnvelope.mjs';
import {
  findForbiddenCloudflareDeploymentTokenPath,
  findForbiddenWorkerConfigSecretPath,
} from '../shared/workerSessionConfig.mjs';

const SESSION_KV_PREFIX = 'session';

const buildSessionConfigKvKey = (slug) => `${SESSION_KV_PREFIX}:${slug}:config`;
const buildSessionSecretsKvKey = (slug) => `${SESSION_KV_PREFIX}:${slug}:secrets`;

export const getSessionConfig = async (env, slug, deps) => {
  const getKvJsonFn = typeof deps?.getKvJson === 'function' ? deps.getKvJson : getKvJson;
  const normalizeConfig = typeof deps?.normalizeWorkerConfigRecord === 'function'
    ? deps.normalizeWorkerConfigRecord
    : normalizeWorkerConfigRecord;
  const raw = await getKvJsonFn(env, buildSessionConfigKvKey(slug));
  return normalizeConfig(raw, { slug });
};

export const getSessionSecrets = async (env, slug, deps) => {
  const getKvJsonFn = typeof deps?.getKvJson === 'function' ? deps.getKvJson : getKvJson;
  const raw = await getKvJsonFn(env, buildSessionSecretsKvKey(slug));
  if (isEncryptedSessionSecretsEnvelope(raw)) {
    return decryptSessionSecretsEnvelope(raw, { env, slug, ...deps });
  }
  return unwrapSessionSecretsEnvelope(raw);
};

export const putSessionConfig = async (env, slug, value, deps) => {
  const normalizeConfig = typeof deps?.normalizeWorkerConfigRecord === 'function'
    ? deps.normalizeWorkerConfigRecord
    : normalizeWorkerConfigRecord;
  const putKvJsonFn = typeof deps?.putKvJson === 'function' ? deps.putKvJson : putKvJson;
  const normalized = normalizeConfig(value, { slug });
  if (!normalized) throw new Error('Invalid session config.');
  if (findForbiddenCloudflareDeploymentTokenPath(normalized)) {
    throw new Error('Cloudflare deployment tokens are not allowed in session config.');
  }
  if (findForbiddenWorkerConfigSecretPath(normalized)) {
    throw new Error('Secret-like values are not allowed in public session config fields.');
  }
  await putKvJsonFn(env, buildSessionConfigKvKey(slug), normalized);
};

export const putSessionSecrets = async (env, slug, value, deps) => {
  const putKvJsonFn = typeof deps?.putKvJson === 'function' ? deps.putKvJson : putKvJson;
  const buildEnvelope = typeof deps?.buildEncryptedSessionSecretsEnvelope === 'function'
    ? deps.buildEncryptedSessionSecretsEnvelope
    : buildEncryptedSessionSecretsEnvelope;
  const envelope = await buildEnvelope(value, {
    env,
    slug,
    now: deps?.now,
    crypto: deps?.crypto,
    randomBytes: deps?.randomBytes,
    getRandomValues: deps?.getRandomValues,
    getSessionSecretsKek: deps?.getSessionSecretsKek,
  });
  await putKvJsonFn(env, buildSessionSecretsKvKey(slug), envelope);
};
