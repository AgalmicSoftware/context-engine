export const AGENT_PRINCIPAL_KINDS = Object.freeze({
  USER: 'user',
  SERVICE: 'service',
});

function safeString(value) {
  return String(value || '').trim();
}

function randomSecret(byteLength = 18) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

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

export function createOpaqueAgentPrincipalId(kind = AGENT_PRINCIPAL_KINDS.USER) {
  const prefix = kind === AGENT_PRINCIPAL_KINDS.SERVICE ? 'cesvc' : 'cep';
  return `${prefix}_${randomSecret()}`;
}
