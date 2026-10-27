import { ethers } from 'ethers';
import { ACCOUNT_MODES, AGENT_EVENT_TYPES, SESSION_AGENT_VERSION } from './constants.mjs';
import { normalizeAgentPrincipal } from './agentPrincipal.mjs';

import { assertNoSecretShape } from './redaction.mjs';
import { sha256Hex } from './runtimePrimitives.mjs';

export function normalizeDeploymentId(value = '') {
  const id = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{32}$/.test(id) || /^0x0+$/.test(id)) throw new Error('agent_session_identity_invalid');
  return id;
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
  lifecycle = AGENT_EVENT_TYPES.ACCOUNT_CREATED,
} = {}) {
  const secretCheck = assertManagedDemoRootSecret(rootSecret, { action: 'create_managed_demo_account' });
  if (!secretCheck.ok) throw new Error(secretCheck.reason);
  const normalizedPrincipal = normalizeAgentPrincipal(principal);
  if (!normalizedPrincipal.principalId) throw new Error('agent_principal_required');
  const normalizedDeploymentId = normalizeDeploymentId(deploymentId);
  const fingerprint = await sha256Hex(`secret:${rootSecret}|${normalizedPrincipal.principalId}|${normalizedDeploymentId}`);
  const privateKeyHex = await sha256Hex(`demo-private-key|${rootSecret}|${normalizedPrincipal.principalId}|${normalizedDeploymentId}`);
  const accountAddress = ethers.computeAddress(`0x${privateKeyHex}`);
  const account = {
    type: 'managed_demo_account',
    version: SESSION_AGENT_VERSION,
    accountMode: ACCOUNT_MODES.MANAGED_SESSION,
    accountId: `ce_demo_${fingerprint.slice(0, 24)}`,
    accountAddress,
    chainScope: 'testnet',
    principal: normalizedPrincipal,
    workerDeploymentId: normalizedDeploymentId,
    signerBoundary: 'deterministic_worker_managed_demo_signer',
    lifecycle: lifecycle === AGENT_EVENT_TYPES.ACCOUNT_RECOVERED ? 'account_recovered' : 'account_created',
    rawKeyMaterialExportable: false,
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

export async function deriveDemoPrivateKeyMaterial({
  principal = {},
  deploymentId = '',
  rootSecret = '',
} = {}) {
  const secretCheck = assertManagedDemoRootSecret(rootSecret, { action: 'derive_demo_private_key' });
  if (!secretCheck.ok) throw new Error(secretCheck.reason);
  const normalizedPrincipal = normalizeAgentPrincipal(principal);
  if (!normalizedPrincipal.principalId) throw new Error('agent_principal_required');
  const normalizedDeploymentId = normalizeDeploymentId(deploymentId);
  const privateKeyHex = await sha256Hex(`demo-private-key|${rootSecret}|${normalizedPrincipal.principalId}|${normalizedDeploymentId}`);
  return `0x${privateKeyHex}`;
}
