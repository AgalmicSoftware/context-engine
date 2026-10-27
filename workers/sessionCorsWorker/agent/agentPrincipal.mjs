import { safeString } from './runtimePrimitives.mjs';

export const AGENT_PRINCIPAL_KINDS = Object.freeze({
  USER: 'user',
  SERVICE: 'service',
});

export function normalizeAgentPrincipal(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const user = source.user && typeof source.user === 'object' && !Array.isArray(source.user)
    ? source.user
    : {};
  const telegramUserId = safeString(
    source.telegramUserId ||
    user.telegramUserId ||
    (source.principalKind === 'telegram' ? source.id : '')
  );
  const explicitId = safeString(source.principalId || source.id);
  const principalId = (explicitId || (telegramUserId ? `telegram:${telegramUserId}` : '')).slice(0, 160);
  const kind = safeString(source.kind || source.principalKind) === AGENT_PRINCIPAL_KINDS.SERVICE
    ? AGENT_PRINCIPAL_KINDS.SERVICE
    : AGENT_PRINCIPAL_KINDS.USER;
  const adapter = safeString(
    typeof source.adapter === 'string' ? source.adapter : source.adapter?.transport
  ).toLowerCase().slice(0, 48) || (telegramUserId ? 'telegram' : '');
  const adapterUserId = safeString(source.adapterUserId || telegramUserId).slice(0, 160);
  const label = safeString(source.label || source.username || user.username).slice(0, 120);
  return {
    principalId,
    kind,
    ...(adapter ? { adapter } : {}),
    ...(adapterUserId ? { adapterUserId } : {}),
    ...(label ? { label } : {}),
  };
}

export function isPreviewPrincipal(input = {}) {
  const principal = normalizeAgentPrincipal(input);
  return principal.principalId === 'telegram:preview-user' ||
    (principal.adapter === 'telegram' && principal.adapterUserId === 'preview-user');
}

export function createOpaqueAgentPrincipalId(kind = AGENT_PRINCIPAL_KINDS.USER) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const random = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${kind === AGENT_PRINCIPAL_KINDS.SERVICE ? 'cesvc' : 'cep'}_${random}`;
}
