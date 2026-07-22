import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { ACCOUNT_MODES, RISK_CEILINGS, TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';
import {
  assertManagedDemoAccountMode,
  buildDemoKeyExportRecord,
  deriveDemoPrivateKeyMaterial,
  deriveManagedDemoAccount,
  evaluateManagedAccountGrant,
  recoverManagedDemoAccountFromKey,
  summarizeDemoKeyExportForAudit,
} from './managedAccounts.mjs';

test('same Telegram principal and deployment recover the same managed demo account', async () => {
  const first = await deriveManagedDemoAccount({
    principal: { telegramUserId: '42' },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  const second = await deriveManagedDemoAccount({
    principal: { telegramUserId: '42' },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  const differentPrincipal = await deriveManagedDemoAccount({
    principal: { telegramUserId: '43' },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  const differentDeployment = await deriveManagedDemoAccount({
    principal: { telegramUserId: '42' },
    deploymentId: 'deploy-b',
    rootSecret: 'root-a',
  });

  assert.equal(first.accountId, second.accountId);
  assert.equal(first.accountAddress, second.accountAddress);
  assert.notEqual(first.accountId, differentPrincipal.accountId);
  assert.notEqual(first.accountId, differentDeployment.accountId);
  assert.equal(first.signerBoundary, 'deterministic_worker_managed_demo_signer');
  assert.equal(JSON.stringify(first).includes('root-a'), false);
});

test('managed accounts preserve transport-neutral principal identity', async () => {
  const service = await deriveManagedDemoAccount({
    principal: {
      principalId: 'cesvc_fixed',
      kind: 'service',
      adapter: 'invite',
      label: 'Indexer',
    },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  const other = await deriveManagedDemoAccount({
    principal: { principalId: 'cesvc_other', kind: 'service' },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });

  assert.equal(service.principal.principalId, 'cesvc_fixed');
  assert.equal(service.principal.kind, 'service');
  assert.equal(service.principal.adapter, 'invite');
  assert.equal(Object.hasOwn(service, 'telegramPrincipal'), false);
  assert.notEqual(service.accountAddress, other.accountAddress);
});

test('managed account issuance fails closed without a root secret', async () => {
  await assert.rejects(deriveManagedDemoAccount({
    principal: { principalId: 'cep_user', kind: 'user' },
    deploymentId: 'deploy-a',
  }), /managed_demo_root_secret_missing/);
});

test('managed demo account address is derived from the exportable demo key', async () => {
  const account = await deriveManagedDemoAccount({
    principal: { telegramUserId: '42' },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  const revealed = await buildDemoKeyExportRecord({
    account,
    principal: account.principal,
    deploymentId: account.workerDeploymentId,
    rootSecret: 'root-a',
    reveal: true,
  });

  assert.equal(revealed.ok, true);
  assert.equal(new ethers.Wallet(revealed.record.privateKey).address, account.accountAddress);
});

test('managed demo grant checks bound signing to the granted session, action, and risk', async () => {
  const account = await deriveManagedDemoAccount({
    principal: { telegramUserId: '42' },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  const allowed = evaluateManagedAccountGrant({
    account,
    grant: {
      status: 'active',
      sessions: ['alpha'],
      allowedActions: [TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE],
      riskCeiling: RISK_CEILINGS.SUBMIT,
    },
    sessionSlug: 'alpha',
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    requestedRisk: RISK_CEILINGS.SUBMIT,
  });

  const denied = evaluateManagedAccountGrant({
    account,
    grant: {
      status: 'active',
      sessions: ['alpha'],
      allowedActions: [TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE],
      riskCeiling: RISK_CEILINGS.DRAFT,
    },
    sessionSlug: 'alpha',
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    requestedRisk: RISK_CEILINGS.SUBMIT,
  });
  assert.equal(allowed.ok, true);
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'risk_ceiling_exceeded');
});

test('raw demo key export and recover are explicit private-only demo paths with redacted audit records', async () => {
  const account = await deriveManagedDemoAccount({
    principal: { telegramUserId: '42' },
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  const hidden = await buildDemoKeyExportRecord({
    account,
    principal: account.principal,
    deploymentId: account.workerDeploymentId,
    rootSecret: 'root-a',
    reveal: false,
  });
  const revealed = await buildDemoKeyExportRecord({
    account,
    principal: account.principal,
    deploymentId: account.workerDeploymentId,
    rootSecret: 'root-a',
    reveal: true,
  });

  assert.equal(hidden.ok, true);
  assert.equal(hidden.record.privateKey, null);
  assert.match(revealed.record.privateKey, /^0x[0-9a-f]{64}$/);
  assert.equal(summarizeDemoKeyExportForAudit(revealed.record).privateKey, '[redacted]');

  const recovered = recoverManagedDemoAccountFromKey({
    accountMode: ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO,
    privateKey: revealed.record.privateKey,
    account,
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.account.lifecycle, 'account_recovered');
  assert.equal(recovered.audit.privateKey, '[redacted]');
  assert.equal(JSON.stringify(recovered.audit).includes(revealed.record.privateKey), false);
  assert.equal(
    await deriveDemoPrivateKeyMaterial({
      principal: account.principal,
      deploymentId: account.workerDeploymentId,
      rootSecret: 'root-a',
    }),
    revealed.record.privateKey,
  );
});

test('managed demo signer rejects passkey, Porto, CE-CC local, linked wallet, and production modes', () => {
  for (const mode of [
    ACCOUNT_MODES.PASSKEY,
    ACCOUNT_MODES.PORTO,
    ACCOUNT_MODES.CE_CC_LOCAL,
    ACCOUNT_MODES.LINKED_EXTERNAL_WALLET,
    ACCOUNT_MODES.PRODUCTION,
  ]) {
    assert.deepEqual(assertManagedDemoAccountMode(mode, { action: 'export_demo_key' }), {
      ok: false,
      reason: 'remote_signing_forbidden_for_account_mode',
      action: 'export_demo_key',
      accountMode: mode,
    });
    assert.equal(recoverManagedDemoAccountFromKey({
      accountMode: mode,
      privateKey: `0x${'11'.repeat(32)}`,
    }).ok, false);
  }
});
