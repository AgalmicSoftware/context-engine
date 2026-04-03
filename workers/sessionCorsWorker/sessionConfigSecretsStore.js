import { getKvJson, putKvJson } from './responseKvHelpers.js';
import { normalizeWorkerConfigRecord } from './sessionConfigNormalization.js';

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
  return getKvJsonFn(env, buildSessionSecretsKvKey(slug));
};

export const putSessionConfig = async (env, slug, value, deps) => {
  const normalizeConfig = typeof deps?.normalizeWorkerConfigRecord === 'function'
    ? deps.normalizeWorkerConfigRecord
    : normalizeWorkerConfigRecord;
  const putKvJsonFn = typeof deps?.putKvJson === 'function' ? deps.putKvJson : putKvJson;
  const normalized = normalizeConfig(value, { slug });
  if (!normalized) throw new Error('Invalid session config.');
  await putKvJsonFn(env, buildSessionConfigKvKey(slug), normalized);
};

export const putSessionSecrets = async (env, slug, value, deps) => {
  const putKvJsonFn = typeof deps?.putKvJson === 'function' ? deps.putKvJson : putKvJson;
  await putKvJsonFn(env, buildSessionSecretsKvKey(slug), value);
};
