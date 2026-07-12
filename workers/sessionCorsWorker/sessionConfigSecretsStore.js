import { getKvJson, putKvJson } from './responseKvHelpers.js';
import { normalizeWorkerConfigRecord } from './sessionConfigNormalization.js';
import {
  buildSessionSecretsEnvelope,
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
  const buildEnvelope = typeof deps?.buildSessionSecretsEnvelope === 'function'
    ? deps.buildSessionSecretsEnvelope
    : buildSessionSecretsEnvelope;
  await putKvJsonFn(env, buildSessionSecretsKvKey(slug), buildEnvelope(value, {
    now: deps?.now,
  }));
};
