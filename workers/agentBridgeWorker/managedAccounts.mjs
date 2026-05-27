import { ethers } from 'ethers';
import {
  ACCOUNT_MODES,
  AGENT_BRIDGE_EVENT_TYPES,
  AGENT_BRIDGE_WORKER_VERSION,
  RISK_CEILINGS,
} from './constants.mjs';
import { normalizeTelegramPrincipal } from './telegramUpdates.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape, redactSecrets } from './redaction.mjs';

const FORBIDDEN_REMOTE_SIGNING_MODES = new Set([
  ACCOUNT_MODES.PASSKEY,
  ACCOUNT_MODES.PORTO,
  ACCOUNT_MODES.CE_CC_LOCAL,
  ACCOUNT_MODES.LINKED_EXTERNAL_WALLET,
  ACCOUNT_MODES.PRODUCTION,
]);

const textEncoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(String(input || '')));
  return bytesToHex(new Uint8Array(digest));
}

export function normalizeDeploymentId(value = '') {
  return String(value || '').trim() || 'local-demo';
}

export function assertManagedDemoAccountMode(mode = ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO, {
  action = 'managed_demo_account',
} = {}) {
  const normalized = String(mode || ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO).trim();
  if (normalized !== ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO) {
    const reason = FORBIDDEN_REMOTE_SIGNING_MODES.has(normalized)
      ? 'remote_signing_forbidden_for_account_mode'
      : 'managed_telegram_demo_account_required';
    return { ok: false, reason, action, accountMode: normalized };
  }
  return { ok: true, reason: 'managed_demo_account_allowed', action, accountMode: normalized };
}

export function assertManagedDemoRootSecret(rootSecret = '', {
  action = 'managed_demo_signing',
} = {}) {
  if (!String(rootSecret || '').trim()) {
    return { ok: false, reason: 'managed_demo_root_secret_missing', action };
  }
  return { ok: true, reason: 'managed_demo_root_secret_present', action };
}

export async function deriveManagedDemoAccount({
  principal = {},
  deploymentId = '',
  rootSecret = '',
  createdAt = null,
  lifecycle = AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
} = {}) {
  const telegramPrincipal = normalizeTelegramPrincipal(principal);
  const normalizedDeploymentId = normalizeDeploymentId(deploymentId);
  const secretScope = rootSecret ? `secret:${rootSecret}` : 'secret:metadata-only-demo';
  const fingerprint = await sha256Hex(`${secretScope}|${telegramPrincipal.principalId}|${normalizedDeploymentId}`);
  const privateKeyHex = await sha256Hex(`demo-private-key|${rootSecret}|${telegramPrincipal.principalId}|${normalizedDeploymentId}`);
  const accountAddress = ethers.utils.computeAddress(`0x${privateKeyHex}`);
  const account = {
    type: 'managed_telegram_demo_account',
    version: AGENT_BRIDGE_WORKER_VERSION,
    accountMode: ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO,
    accountId: `ce_tg_demo_${fingerprint.slice(0, 24)}`,
    accountAddress,
    chainScope: 'testnet',
    telegramPrincipal,
    workerDeploymentId: normalizedDeploymentId,
    signerBoundary: 'durable_object_managed_demo_signer',
    lifecycle: lifecycle === AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_RECOVERED ? 'account_recovered' : 'account_created',
    rawKeyMaterialExportable: true,
    privateKeyAuthority: false,
    signingAuthority: false,
    workerTokenAuthority: false,
    longLivedBearerAuthority: false,
    productionAuthority: false,
    createdAt,
  };
  assertNoSecretShape(account, 'Managed account metadata must not serialize key material.');
  return account;
}

export function evaluateManagedAccountGrant({
  account = {},
  grant = {},
  sessionSlug = '',
  action = '',
  requestedRisk = RISK_CEILINGS.READ,
} = {}) {
  const modeCheck = assertManagedDemoAccountMode(account.accountMode || account.mode, { action });
  if (!modeCheck.ok) return modeCheck;
  if (account.chainScope && account.chainScope !== 'testnet') {
    return { ok: false, reason: 'managed_demo_testnet_only', action };
  }
  if (grant.status && grant.status !== 'active') {
    return { ok: false, reason: 'grant_not_active', action };
  }
  const sessions = Array.isArray(grant.sessions) ? grant.sessions : [];
  if (sessionSlug && sessions.length && !sessions.includes(sessionSlug)) {
    return { ok: false, reason: 'session_not_granted', action };
  }
  const allowedActions = Array.isArray(grant.allowedActions) ? grant.allowedActions : [];
  if (action && allowedActions.length && !allowedActions.includes(action)) {
    return { ok: false, reason: 'action_not_granted', action };
  }
  const ceiling = String(grant.riskCeiling || RISK_CEILINGS.READ).trim();
  const requestedRank = {
    [RISK_CEILINGS.READ]: 0,
    [RISK_CEILINGS.DRAFT]: 1,
    [RISK_CEILINGS.SUBMIT]: 2,
    [RISK_CEILINGS.SPONSORED]: 3,
    [RISK_CEILINGS.ACCOUNT]: 4,
    [RISK_CEILINGS.ADMIN]: 5,
  }[requestedRisk] ?? 0;
  const ceilingRank = {
    [RISK_CEILINGS.READ]: 0,
    [RISK_CEILINGS.DRAFT]: 1,
    [RISK_CEILINGS.SUBMIT]: 2,
    [RISK_CEILINGS.SPONSORED]: 3,
    [RISK_CEILINGS.ACCOUNT]: 4,
    [RISK_CEILINGS.ADMIN]: 5,
  }[ceiling] ?? 0;
  if (requestedRank > ceilingRank) {
    return { ok: false, reason: 'risk_ceiling_exceeded', action, requestedRisk, riskCeiling: ceiling };
  }
  return { ok: true, reason: 'managed_demo_grant_allowed', action };
}

export async function deriveDemoPrivateKeyMaterial({
  principal = {},
  deploymentId = '',
  rootSecret = '',
} = {}) {
  const secretCheck = assertManagedDemoRootSecret(rootSecret, { action: 'derive_demo_private_key' });
  if (!secretCheck.ok) throw new Error(secretCheck.reason);
  const telegramPrincipal = normalizeTelegramPrincipal(principal);
  const normalizedDeploymentId = normalizeDeploymentId(deploymentId);
  const privateKeyHex = await sha256Hex(`demo-private-key|${rootSecret}|${telegramPrincipal.principalId}|${normalizedDeploymentId}`);
  return `0x${privateKeyHex}`;
}

export async function buildDemoKeyExportRecord({
  account = {},
  principal = {},
  deploymentId = '',
  rootSecret = '',
  reveal = false,
  createdAt = null,
} = {}) {
  const modeCheck = assertManagedDemoAccountMode(account.accountMode || account.mode, { action: 'export_demo_key' });
  if (!modeCheck.ok) return modeCheck;
  if (account.chainScope && account.chainScope !== 'testnet') {
    return { ok: false, reason: 'managed_demo_testnet_only', action: 'export_demo_key' };
  }
  if (reveal === true) {
    const secretCheck = assertManagedDemoRootSecret(rootSecret, { action: 'export_demo_key' });
    if (!secretCheck.ok) return secretCheck;
  }
  const privateKey = reveal
    ? await deriveDemoPrivateKeyMaterial({ principal, deploymentId, rootSecret })
    : null;
  return {
    ok: true,
    record: {
      type: 'managed_demo_key_export',
      version: AGENT_BRIDGE_WORKER_VERSION,
      actionId: buildOpaqueActionId(`export_demo_key|${account.accountId}|${createdAt || ''}`),
      accountId: account.accountId,
      accountMode: ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO,
      chainScope: 'testnet',
      privateOnly: true,
      delivery: 'mini_app_one_time_reveal',
      demoOnly: true,
      privateKey,
      createdAt,
    },
  };
}

export function summarizeDemoKeyExportForAudit(record = {}) {
  return {
    type: 'managed_demo_key_export_audit',
    actionId: record.actionId || null,
    accountId: record.accountId || null,
    accountMode: record.accountMode || null,
    chainScope: record.chainScope || null,
    privateOnly: record.privateOnly === true,
    demoOnly: record.demoOnly === true,
    privateKey: '[redacted]',
    createdAt: record.createdAt || null,
  };
}

export function recoverManagedDemoAccountFromKey({
  accountMode = ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO,
  privateKey = '',
  account = {},
  createdAt = null,
} = {}) {
  const modeCheck = assertManagedDemoAccountMode(accountMode, { action: 'recover_demo_key' });
  if (!modeCheck.ok) return modeCheck;
  if (!/^0x[0-9a-f]{64}$/i.test(String(privateKey || '').trim())) {
    return { ok: false, reason: 'invalid_demo_private_key', action: 'recover_demo_key' };
  }
  return {
    ok: true,
    account: {
      ...redactSecrets(account),
      lifecycle: 'account_recovered',
      recoveredAt: createdAt,
    },
    audit: {
      type: 'managed_demo_key_recover_audit',
      actionId: buildOpaqueActionId(`recover_demo_key|${account.accountId || ''}|${createdAt || ''}`),
      accountId: account.accountId || null,
      accountMode: ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO,
      chainScope: 'testnet',
      privateKey: '[redacted]',
      createdAt,
    },
  };
}
