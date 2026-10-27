import { safeString, nowIso, safeEnvJsonParse as safeJsonParse } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_SKILL_UPDATE_KV_KEY, shortAddress } from './runtimeCore.mjs';

export async function readAgentSkillUpdateFlag(env = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function') return {};
  const parsed = safeJsonParse(await kv.get(AGENT_SKILL_UPDATE_KV_KEY).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || parsed.updateAvailable !== true) return {};
  return {
    updateAvailable: true,
    latestVersion: safeString(parsed.latestVersion).slice(0, 40),
    note: safeString(parsed.note).slice(0, 200),
    updatedAt: safeString(parsed.updatedAt).slice(0, 64),
    updatedBy: safeString(parsed.updatedBy).slice(0, 64),
  };
}

export async function writeAgentSkillUpdateFlag({
  env = {},
  latestVersion = '',
  note = '',
  accountAddress = '',
  createdAt = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const record = {
    version: 1,
    updateAvailable: true,
    latestVersion: safeString(latestVersion).slice(0, 40),
    note: safeString(note).slice(0, 200),
    updatedBy: accountAddress ? shortAddress(accountAddress) : '',
    updatedAt: createdAt || nowIso(),
  };
  assertNoSecretShape(record, "Agent skill-update flag must not serialize secrets.");
  await kv.put(AGENT_SKILL_UPDATE_KV_KEY, JSON.stringify(record));
  return { ok: true, latestVersion: record.latestVersion };
}

export async function clearAgentSkillUpdateFlag(env = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.delete !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  await kv.delete(AGENT_SKILL_UPDATE_KV_KEY);
  return { ok: true };
}
