import { safeString } from './runtimePrimitives.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';

export function resolveRegistryRpcUrls(env = {}) {
  return [...new Set([env.DEFAULT_RPC_URL, env.ADDITIONAL_RPC_URL].flatMap(value => safeString(value).split(/[\s,]+/)))]
    .filter(url => /^https:\/\/[^/\s]+(?:\/.*)?$/i.test(url));
}
export function resolveSessionRegistryAddress(env = {}) {
  const address = safeString(env.SESSION_REGISTRY_ADDRESS);
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? address : '';
}
export async function listCurrentAgentSession({ env = {} } = {}) {
  const policy = await loadSessionPolicy(env);
  return { ok: true, sessions: policy.linkedSessions, count: policy.linkedSessions.length };
}
