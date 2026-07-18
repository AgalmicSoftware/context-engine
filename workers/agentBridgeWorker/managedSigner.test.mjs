import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { ACCOUNT_MODES, RISK_CEILINGS, TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';
import {
  ManagedDemoSignerDurableObject,
  createMemoryDurableObjectState,
} from './durableObjectSigner.mjs';
import {
  assertManagedDemoAccountMode,
  deriveManagedDemoAccount,
  recoverManagedDemoAccountFromKey,
} from './managedAccounts.mjs';

function makeSigner() {
  return new ManagedDemoSignerDurableObject(createMemoryDurableObjectState(), {
    AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
    DEMO_SIGNER_ROOT_SECRET: 'root-a',
  });
}

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
  const signer = makeSigner();
  const account = await signer.getOrCreateAccount({
    principal: { telegramUserId: '42' },
  });
  const revealed = await signer.exportDemoKey({
    account,
    principal: account.principal,
    reveal: true,
  });

  assert.equal(revealed.ok, true);
  assert.equal(new ethers.Wallet(revealed.reveal.privateKey).address, account.accountAddress);
});

test('Durable Object signer creates signed canonical demo envelopes after grant checks', async () => {
  const signer = makeSigner();
  const account = await signer.getOrCreateAccount({
    principal: { telegramUserId: '42' },
  });
  const signed = await signer.signCanonicalDemoEnvelope({
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
    canonicalPayload: {
      questionId: 'question-1',
      answerRef: 'answer-ref-1',
    },
  });

  assert.equal(signed.ok, true);
  assert.equal(signed.signedEnvelope.broadcast, false);
  assert.equal(signed.signedEnvelope.chainScope, 'testnet');
  assert.equal(signed.signedEnvelope.signerBoundary, 'durable_object_managed_demo_signer');
  assert.match(signed.signedEnvelope.signature, /^0x[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(signed.signedEnvelope, 'privateKey'), false);
  assert.equal(JSON.stringify(signed.events).includes(signed.signedEnvelope.signature), false);

  const denied = await signer.signCanonicalDemoEnvelope({
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
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'risk_ceiling_exceeded');
});

test('raw demo key export and recover are explicit private-only demo paths with redacted audit logs', async () => {
  const signer = makeSigner();
  const account = await signer.getOrCreateAccount({
    principal: { telegramUserId: '42' },
  });
  const hidden = await signer.exportDemoKey({
    account,
    principal: account.principal,
    reveal: false,
  });
  const revealed = await signer.exportDemoKey({
    account,
    principal: account.principal,
    reveal: true,
  });

  assert.equal(hidden.ok, true);
  assert.equal(hidden.reveal.privateKey, null);
  assert.match(revealed.reveal.privateKey, /^0x[0-9a-f]{64}$/);
  assert.equal(revealed.audit.privateKey, '[redacted]');
  assert.equal(JSON.stringify(revealed.events).includes(revealed.reveal.privateKey), false);

  const recovered = signer.recoverDemoKey({
    accountMode: ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO,
    privateKey: revealed.reveal.privateKey,
    account,
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.account.lifecycle, 'account_recovered');
  assert.equal(recovered.audit.privateKey, '[redacted]');
  assert.equal(JSON.stringify(recovered.events).includes(revealed.reveal.privateKey), false);
});

test('managed demo signer refuses account issuance without a root secret', async () => {
  const signer = new ManagedDemoSignerDurableObject(createMemoryDurableObjectState(), {
    AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
  });
  await assert.rejects(
    signer.getOrCreateAccount({ principal: { telegramUserId: '42' } }),
    /managed_demo_root_secret_missing/,
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
