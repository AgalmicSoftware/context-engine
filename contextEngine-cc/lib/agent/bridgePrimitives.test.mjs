// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_ACCOUNT_SIGNER_BOUNDARIES,
  AGENT_BRIDGE_EVENT_TYPES,
  evaluateAgentIdempotencyRecord,
  mergeAgentPreferenceProfiles,
  normalizeAgentActionRecord,
  normalizeAgentBridgeEvent,
  normalizeAgentCreatedAccountMetadata,
  normalizeAgentIdempotencyRecord,
  normalizeAgentPreferenceProfile,
  normalizeOpenClawPrincipal,
  normalizeTelegramPrincipal,
  summarizeAgentGrantForBridgeCache,
} from './bridgePrimitives.mjs';

const ACCOUNT_PRINCIPAL = {
  kind: 'ce_account',
  principalId: 'ce:0x1234',
};
const AGENT_PRINCIPAL = {
  kind: 'agent',
  principalId: 'telegram:agent-1',
};
const INTEGRATION_PRINCIPAL = {
  kind: 'telegram',
  principalId: 'telegram:555',
};

test('bridge principal summaries cover Telegram and OpenClaw without secrets', () => {
  assert.deepEqual(normalizeTelegramPrincipal({
    telegramUserId: '555',
    username: 'agent_helper',
    workerToken: 'must-not-leak',
  }), {
    type: 'agent_principal_summary',
    version: 'agent-bridge-worker-contract-v1',
    principalKind: 'telegram',
    principalId: 'telegram:555',
    displayName: null,
    handle: 'agent_helper',
  });

  assert.deepEqual(normalizeOpenClawPrincipal({
    threadId: 'thread-1',
    workspace: 'alpha-space',
    jwt: 'eyJhbGciOi.fake.sig',
  }), {
    type: 'agent_principal_summary',
    version: 'agent-bridge-worker-contract-v1',
    principalKind: 'openclaw',
    principalId: 'openclaw:thread-1',
    displayName: null,
    handle: 'alpha-space',
  });
});

test('action records use opaque IDs and carry no payload or secret material', () => {
  const record = normalizeAgentActionRecord({
    accountPrincipal: ACCOUNT_PRINCIPAL,
    agentPrincipal: AGENT_PRINCIPAL,
    integrationPrincipal: INTEGRATION_PRINCIPAL,
    session: 'alpha',
    grantId: 'agent_grant_alpha123',
    actionName: 'agent.response.delegated_execute',
    fingerprint: 'response|alpha|question-1',
    payload: {
      answer: 'full answer payload must not be embedded',
      privateKey: `0x${'11'.repeat(32)}`,
    },
  });

  assert.match(record.actionRecordId, /^agent_action_[a-z0-9]{7,32}$/);
  assert.equal(record.actionRecordId.includes('full answer'), false);
  assert.equal(record.actionRecordId.includes('private'), false);
  assert.equal(Object.hasOwn(record, 'payload'), false);
  assert.equal(record.scope.accountPrincipal.principalId, 'ce:0x1234');
  assert.equal(record.scope.integrationPrincipal.principalId, 'telegram:555');
  assert.equal(record.scope.session, 'alpha');
  assert.equal(record.scope.grantId, 'agent_grant_alpha123');
  assert.equal(record.scope.privateByDefault, true);
});

test('idempotency records conflict on the same scoped key with different fingerprints', () => {
  const base = normalizeAgentIdempotencyRecord({
    key: 'telegram:alpha:0001',
    fingerprint: 'fingerprint-a',
    accountPrincipal: ACCOUNT_PRINCIPAL,
    agentPrincipal: AGENT_PRINCIPAL,
    integrationPrincipal: INTEGRATION_PRINCIPAL,
    session: 'alpha',
    grantId: 'agent_grant_alpha123',
  });

  assert.equal(evaluateAgentIdempotencyRecord(base, {
    ...base,
    fingerprint: 'fingerprint-a',
  }).reason, 'idempotency_replay');

  const conflict = evaluateAgentIdempotencyRecord(base, {
    ...base,
    fingerprint: 'fingerprint-b',
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'idempotency_fingerprint_conflict');

  assert.equal(evaluateAgentIdempotencyRecord(base, {
    ...base,
    session: 'beta',
    fingerprint: 'fingerprint-b',
  }).reason, 'idempotency_scope_distinct');
});

test('bridge events contain safe summaries and refs only', () => {
  const event = normalizeAgentBridgeEvent({
    eventType: AGENT_BRIDGE_EVENT_TYPES.RESPONSE_SUGGESTED,
    accountPrincipal: ACCOUNT_PRINCIPAL,
    agentPrincipal: AGENT_PRINCIPAL,
    integrationPrincipal: INTEGRATION_PRINCIPAL,
    session: 'alpha',
    grantId: 'agent_grant_alpha123',
    actionRecordId: 'agent_action_abcdef1',
    summary: {
      promptRef: 'question:1',
      workerToken: 'must-redact',
      note: 'Bearer long-lived-token',
    },
    payload: {
      answer: 'not included',
    },
    payloadRef: {
      refId: 'payload-ref-1',
      uri: 'ce://payload/1',
    },
  });

  assert.equal(event.eventType, 'response_suggested');
  assert.equal(event.summary.workerToken, '[redacted]');
  assert.equal(event.summary.note, '[redacted]');
  assert.equal(Object.hasOwn(event, 'payload'), false);
  assert.equal(event.refs.payloadRef.refId, 'payload-ref-1');
  assert.equal(event.scope.scopeKey.includes('telegram:555'), true);
});

test('grant cache summaries never include CE-CC tokens, private keys, or signing authority', () => {
  const summary = summarizeAgentGrantForBridgeCache({
    grantId: 'agent_grant_alpha123',
    humanPrincipal: '0xABC',
    agentId: 'telegram:agent-1',
    sessions: ['alpha'],
    allowedActions: ['agent.response.delegated_execute'],
    riskCeiling: 'medium',
    executionPolicy: 'scoped_delegated_execute',
    auditRequired: true,
    workerToken: 'must-not-leak',
    jwt: 'eyJhbGciOi.fake.sig',
    privateKey: `0x${'11'.repeat(32)}`,
    signingAuthority: true,
  });

  assert.equal(summary.humanPrincipal, '0xabc');
  assert.equal(summary.signingAuthority, false);
  assert.equal(summary.workerTokenAuthority, false);
  assert.equal(summary.privateKeyAuthority, false);
  assert.equal(summary.longLivedBearerAuthority, false);
  assert.equal(Object.hasOwn(summary, 'workerToken'), false);
  assert.equal(Object.hasOwn(summary, 'jwt'), false);
  assert.equal(Object.hasOwn(summary, 'privateKey'), false);
});

test('preference profiles support by-value and by-ref inputs with additive conflict suggestions', () => {
  const byValue = normalizeAgentPreferenceProfile({
    profileId: 'profile-alpha',
    source: 'telegram',
    preferences: {
      tone: 'concise',
      format: 'bullets',
    },
  });
  assert.equal(byValue.mode, 'by_value');
  assert.deepEqual(byValue.sourceTags, ['telegram']);

  const byRef = normalizeAgentPreferenceProfile({
    source: 'openclaw',
    preferenceProfileRef: {
      refId: 'pref-bundle-1',
      uri: 'ce://preferences/bundle-1',
      contentHash: 'hash-1',
    },
  });
  assert.equal(byRef.mode, 'by_ref');
  assert.equal(byRef.refs[0].refId, 'pref-bundle-1');

  const merged = mergeAgentPreferenceProfiles([
    byValue,
    {
      source: 'openclaw',
      preferences: {
        tone: 'detailed',
        citations: 'include',
      },
    },
    byRef,
  ]);

  assert.equal(merged.mergePolicy, 'additive_conflicts_as_suggestions');
  assert.equal(merged.preferences.find((entry) => entry.key === 'tone').value, 'concise');
  assert.equal(merged.preferences.find((entry) => entry.key === 'citations').value, 'include');
  assert.equal(merged.suggestions.length, 1);
  assert.equal(merged.suggestions[0].key, 'tone');
  assert.equal(merged.suggestions[0].suggested, 'detailed');
  assert.equal(merged.refs[0].refId, 'pref-bundle-1');
});

test('agent-created account metadata is managed testnet/account-runtime metadata only', () => {
  const metadata = normalizeAgentCreatedAccountMetadata({
    accountAddress: '0xabc123',
    accountKind: 'managed_testnet_account_runtime',
    agentId: 'telegram:agent-1',
    integrationPrincipal: INTEGRATION_PRINCIPAL,
    session: 'alpha',
    signerBoundary: AGENT_ACCOUNT_SIGNER_BOUNDARIES.DURABLE_OBJECT_ISOLATED_SIGNER_PLANNED,
    privateKey: `0x${'11'.repeat(32)}`,
    seed: 'must-not-leak',
    jwt: 'eyJhbGciOi.fake.sig',
    signingAuthority: true,
  });

  assert.equal(metadata.accountKind, 'managed_testnet_account_runtime');
  assert.equal(metadata.session, 'alpha');
  assert.equal(metadata.signerBoundary, 'durable_object_isolated_signer_planned');
  assert.equal(metadata.signingAuthority, false);
  assert.equal(metadata.privateKeyAuthority, false);
  assert.equal(metadata.rawKeyMaterialExportable, false);
  assert.equal(Object.hasOwn(metadata, 'privateKey'), false);
  assert.equal(Object.hasOwn(metadata, 'seed'), false);
  assert.equal(Object.hasOwn(metadata, 'jwt'), false);
});
