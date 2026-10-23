import { safeString, lower, safeJsonParse } from './runtimePrimitives.mjs';

import { AGENT_BRIDGE_EVENT_TYPES } from './constants.mjs';

import { deriveManagedDemoAccount } from './managedAccounts.mjs';

import { normalizeLegacyManagedPrincipal } from './legacyCompatibility.mjs';

const RESPONSE_EXPORT_ALLOWLIST_KV_PREFIX = 'telegram:response-export-allowlist:v1:';

function normalizeAddress(value = '') {
  const address = lower(value);
  return /^0x[0-9a-f]{40}$/.test(address) ? address : '';
}

function normalizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128) || 'general';
}

function parseAddressList(value = '') {
  if (Array.isArray(value)) return value.map(normalizeAddress).filter(Boolean);
  const raw = safeString(value);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, null);
  if (Array.isArray(parsed)) return parsed.map(normalizeAddress).filter(Boolean);
  return raw.split(/[\s,;]+/).map(normalizeAddress).filter(Boolean);
}

function configuredResponseExportAdminAddresses(env = {}, session = {}) {
  return [...new Set([
    ...parseAddressList(env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES),
    ...parseAddressList(session.responseExportAllowedAddresses),
    ...parseAddressList(session.telegramResponseExportAllowedAddresses),
  ])];
}

function responseExportAllowlistKey(sessionSlug = '') {
  return `${RESPONSE_EXPORT_ALLOWLIST_KV_PREFIX}${normalizeSessionSlug(sessionSlug)}`;
}

async function readResponseExportManagedAllowlist(env = {}, sessionSlug = '') {
  const kv = env?.AGENT_ACTION_KV;
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);
  const empty = { version: 1, sessionSlug: normalizedSessionSlug, addresses: [] };
  if (!kv || typeof kv.get !== 'function') return empty;
  const parsed = safeJsonParse(await kv.get(responseExportAllowlistKey(normalizedSessionSlug)).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
  const source = Array.isArray(parsed.addresses)
    ? parsed.addresses.map((entry) => (typeof entry === 'string' ? { address: entry } : entry))
    : Object.entries(parsed.addresses || {}).map(([address, entry]) => ({
      ...(entry && typeof entry === 'object' ? entry : {}),
      address,
    }));
  const deduped = new Map();
  source.forEach((entry) => {
    const address = normalizeAddress(entry?.address);
    if (!address) return;
    deduped.set(address, {
      address,
      addedAt: safeString(entry?.addedAt),
      addedByAddress: normalizeAddress(entry?.addedByAddress),
      addedByTelegramUserId: safeString(entry?.addedByTelegramUserId),
    });
  });
  return {
    version: 1,
    sessionSlug: normalizedSessionSlug,
    addresses: [...deduped.values()].sort((left, right) => left.address.localeCompare(right.address)),
  };
}

async function listResponseExportAccess({ env = {}, session = {} } = {}) {
  const sessionSlug = normalizeSessionSlug(session.sessionSlug);
  const configuredAdmins = configuredResponseExportAdminAddresses(env, session);
  const managed = await readResponseExportManagedAllowlist(env, sessionSlug);
  const additionalExporters = managed.addresses;
  const allAllowedAddresses = configuredAdmins.length
    ? [...new Set([
      ...configuredAdmins,
      ...additionalExporters.map((entry) => entry.address),
    ])].sort((left, right) => left.localeCompare(right))
    : [];
  return {
    sessionSlug,
    configuredAdmins,
    additionalExporters,
    allAllowedAddresses,
  };
}

async function deriveResponseAccessAccount({
  env = {},
  normalized = {},
  createdAt = null,
} = {}) {
  return deriveManagedDemoAccount({
    principal: normalizeLegacyManagedPrincipal(normalized),
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
}

async function canExportResponsesForPrincipal({
  env = {},
  normalized = {},
  session = {},
  createdAt = null,
} = {}) {
  const account = await deriveResponseAccessAccount({ env, normalized, createdAt });
  const access = await listResponseExportAccess({ env, session });
  const allowed = access.allAllowedAddresses;
  const accountAddress = normalizeAddress(account.accountAddress);
  return {
    ok: !!accountAddress && allowed.includes(accountAddress),
    account,
    accountAddress,
    allowedCount: allowed.length,
    reason: allowed.length ? 'response_export_address_not_allowed' : 'response_export_allowlist_empty',
    rootAdmin: access.configuredAdmins.includes(accountAddress),
  };
}

async function canManageResponseExportAllowlist({
  env = {},
  normalized = {},
  session = {},
  createdAt = null,
} = {}) {
  const account = await deriveResponseAccessAccount({ env, normalized, createdAt });
  const access = await listResponseExportAccess({ env, session });
  const admins = access.allAllowedAddresses;
  const configuredAdmins = access.configuredAdmins;
  const accountAddress = normalizeAddress(account.accountAddress);
  return {
    ok: !!accountAddress && admins.includes(accountAddress),
    account,
    accountAddress,
    adminCount: admins.length,
    rootAdmin: configuredAdmins.includes(accountAddress),
    reason: admins.length ? 'response_export_admin_required' : 'response_export_admin_allowlist_empty',
  };
}

export {
  deriveResponseAccessAccount,
  canManageResponseExportAllowlist,
  canExportResponsesForPrincipal,
  listResponseExportAccess,
  configuredResponseExportAdminAddresses,
};
