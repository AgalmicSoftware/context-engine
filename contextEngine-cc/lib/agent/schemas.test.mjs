// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_ENDPOINT_FAMILIES,
  buildAgentError,
  buildAgentOk,
  normalizeAgentDraftResponse,
  normalizeAgentGrant,
  normalizeAgentQuestion,
  normalizeAgentQuestionPayload,
  normalizeCeActivityEvent,
  redactAgentSensitiveFields,
  sortCeActivityEvents,
  summarizeAgentBridgeActivityEvent,
  summarizeAgentRequestActivityEvent,
  summarizeAgentRequestStatusCounts,
  summarizeCeActivityEventCounts,
  summarizePendingResponseActivityEvent,
  summarizePendingResponseForAgent,
  summarizeRequestForAgent,
} from './schemas.mjs';

test('agent endpoint families enumerate canonical route groups', () => {
  const families = AGENT_ENDPOINT_FAMILIES.map((entry) => entry.family);
  assert.deepEqual(families, ['identity', 'sessions', 'questions', 'inbox', 'responses', 'requests', 'connect-requests', 'grants', 'accounts']);
  assert.equal(
    AGENT_ENDPOINT_FAMILIES.some((entry) => entry.routes.includes('POST /api/agent/responses/submit-request')),
    true,
  );
  assert.equal(
    AGENT_ENDPOINT_FAMILIES.some((entry) => entry.routes.includes('POST /api/agent/responses/delegated-execute')),
    true,
  );
  assert.equal(
    AGENT_ENDPOINT_FAMILIES.some((entry) => entry.routes.includes('POST /api/agent/grants/revoke')),
    true,
  );
  assert.equal(
    AGENT_ENDPOINT_FAMILIES.some((entry) => entry.routes.includes('POST /api/agent/connect-requests')),
    true,
  );
  assert.equal(
    AGENT_ENDPOINT_FAMILIES.some((entry) => entry.routes.includes('POST /api/agent/accounts/create')),
    true,
  );
});

test('agent envelopes keep JSON-first ok and error shapes explicit', () => {
  assert.deepEqual(buildAgentOk({ value: 1 }), { ok: true, status: 'ok', value: 1 });
  assert.deepEqual(buildAgentError('nope', { code: 'bad_request' }), {
    ok: false,
    status: 'error',
    code: 'bad_request',
    error: 'nope',
  });
});

test('question payload normalizes a single legacy question into canonical array form', () => {
  const question = { id: 'q1', type: 'freeform', prompt: 'Prompt?' };
  const normalizedQuestion = {
    type: 'agent_question',
    version: 'agent-contract-v1',
    session: 'alpha',
    questionId: 'q1',
    id: 'q1',
    questionType: 'freeform',
    prompt: 'Prompt?',
    options: [],
    tags: [],
    associatedSurveyId: null,
    arweaveTxId: null,
  };
  assert.deepEqual(normalizeAgentQuestionPayload({ session: 'alpha', question }), {
    ok: true,
    status: 'ok',
    session: 'alpha',
    question: normalizedQuestion,
    questions: [normalizedQuestion],
    count: 1,
  });
});

test('pending response summaries omit answer text by default', () => {
  const summary = summarizePendingResponseForAgent({
    questionId: '0xabc',
    questionType: 'freeform',
    answer: 'sensitive local draft',
    respondent: '0xwallet',
    timestamp: '2026-05-06T00:00:00.000Z',
  }, { session: 'alpha' });

  assert.deepEqual(summary, {
    type: 'response_draft',
    session: 'alpha',
    questionId: '0xabc',
    questionType: 'freeform',
    respondent: '0xwallet',
    status: 'draft',
    submitted: false,
    timestamp: '2026-05-06T00:00:00.000Z',
    submittedAt: null,
    txHash: null,
  });
  assert.equal(Object.hasOwn(summary, 'answer'), false);
});

test('agent question shape is versioned and keeps canonical ids explicit', () => {
  assert.deepEqual(normalizeAgentQuestion({
    id: '0xabc',
    type: 'freeform',
    prompt: 'Explain?',
    options: ['a'],
    tags: ['tag'],
  }, { session: 'alpha' }), {
    type: 'agent_question',
    version: 'agent-contract-v1',
    session: 'alpha',
    questionId: '0xabc',
    id: '0xabc',
    questionType: 'freeform',
    prompt: 'Explain?',
    options: ['a'],
    tags: ['tag'],
    associatedSurveyId: null,
    arweaveTxId: null,
  });
});


test('agent question and submitted response shapes include storageRef compatibility when Arweave ids exist', () => {
  const question = normalizeAgentQuestion({
    id: '0xabc',
    type: 'freeform',
    prompt: 'Explain?',
    arweaveTxId: 'QuestionArweaveId123',
  }, { session: 'alpha' });
  assert.deepEqual(question.storageRef, {
    backend: 'arweave',
    id: 'QuestionArweaveId123',
    uri: 'ar://QuestionArweaveId123',
    resource: 'questions',
  });

  const response = summarizePendingResponseForAgent({
    questionId: '0xabc',
    submitted: true,
    arweaveTxId: 'ResponseArweaveId123',
    txHash: '0xtx',
  }, { session: 'alpha' });
  assert.equal(response.arweaveTxId, 'ResponseArweaveId123');
  assert.deepEqual(response.storageRef, {
    backend: 'arweave',
    id: 'ResponseArweaveId123',
    uri: 'ar://ResponseArweaveId123',
    resource: 'responses',
  });
});

test('agent shapes prefer storageRef and avoid fake arweaveTxId for Cloudflare payloads', () => {
  const question = normalizeAgentQuestion({
    id: '0xabc',
    type: 'freeform',
    prompt: 'Explain?',
    arweaveTxId: 'stale-arweave-id',
    storageRef: { backend: 'cloudflare', id: 'cf_questionopaque01', resource: 'questions' },
  }, { session: 'alpha' });

  assert.equal(question.arweaveTxId, null);
  assert.deepEqual(question.storageRef, {
    backend: 'cloudflare',
    id: 'cf_questionopaque01',
    uri: '/storage/read?id=cf_questionopaque01',
    resource: 'questions',
  });

  const response = summarizePendingResponseForAgent({
    questionId: '0xabc',
    submitted: true,
    arweaveTxId: 'stale-response-id',
    storageRef: { backend: 'cloudflare', id: 'cf_responseopaque01', resource: 'responses' },
  }, { session: 'alpha' });

  assert.equal(Object.hasOwn(response, 'arweaveTxId'), false);
  assert.deepEqual(response.storageRef, {
    backend: 'cloudflare',
    id: 'cf_responseopaque01',
    uri: '/storage/read?id=cf_responseopaque01',
    resource: 'responses',
  });
});

test('agent draft response shape withholds answer text unless requested', () => {
  const input = {
    questionId: '0xabc',
    questionType: 'freeform',
    answer: 'local answer',
    additional: 'local comment',
    respondent: '0xwallet',
    timestamp: '2026-05-06T00:00:00.000Z',
    source: 'agent-http',
  };

  const summary = normalizeAgentDraftResponse(input, { session: 'alpha' });
  assert.equal(Object.hasOwn(summary, 'answer'), false);
  assert.equal(summary.status, 'draft');
  assert.equal(summary.version, 'agent-contract-v1');

  const full = normalizeAgentDraftResponse(input, { session: 'alpha', includeAnswer: true });
  assert.equal(full.answer, 'local answer');
  assert.equal(full.additional, 'local comment');
});

test('agent grant shape never grants signing or worker-token authority', () => {
  assert.deepEqual(normalizeAgentGrant({
    grantId: 'agent_grant_test123',
    humanPrincipal: '0xABC',
    agentId: 'telegram:123',
    scope: 'agent:draft',
    allowedActions: ['agent.response.draft'],
    riskCeiling: 'medium',
    executionPolicy: 'scoped_delegated_execute',
    auditRequired: true,
    status: 'active',
    expiresAt: '2026-05-06T01:00:00.000Z',
  }), {
    type: 'agent_grant',
    version: 'agent-contract-v1',
    grantId: 'agent_grant_test123',
    humanPrincipal: '0xabc',
    agentId: 'telegram:123',
    subject: 'telegram:123',
    scope: 'agent:draft',
    action: '',
    allowedActions: ['agent.response.draft'],
    riskCeiling: 'medium',
    executionPolicy: 'scoped_delegated_execute',
    auditRequired: true,
    status: 'active',
    expiresAt: '2026-05-06T01:00:00.000Z',
    createdAt: null,
    revokedAt: null,
    updatedAt: null,
    signingAuthority: false,
    workerTokenAuthority: false,
    privateKeyAuthority: false,
    longLivedBearerAuthority: false,
  });
});

test('agent request summaries mark only pending approval as approval-required', () => {
  assert.deepEqual(summarizeRequestForAgent({
    requestId: 'agent_req_pending1',
    status: 'pending_approval',
    requiresApproval: true,
  }), {
    type: 'agent_request',
    requestId: 'agent_req_pending1',
    status: 'pending_approval',
    requiresApproval: true,
    terminal: false,
    approvalUrl: null,
    session: null,
    questionIds: [],
    requester: null,
    createdAt: null,
    updatedAt: null,
  });

  for (const status of ['expired', 'revoked', 'rejected', 'denied', 'submitted', 'failed']) {
    const summary = summarizeRequestForAgent({
      requestId: `agent_req_${status}1`,
      status,
      requiresApproval: true,
    });
    assert.equal(summary.requiresApproval, false);
    assert.equal(summary.terminal, true);
  }
});

test('agent request status counts summarize normalized request lists', () => {
  assert.deepEqual(summarizeAgentRequestStatusCounts([
    { status: 'pending_approval' },
    { status: 'approved' },
    { status: 'denied' },
    { status: 'expired' },
    { status: 'revoked' },
    { status: 'submitted' },
    { status: 'failed' },
    { status: 'failed' },
  ]), {
    pending_approval: 1,
    approved: 1,
    denied: 1,
    expired: 1,
    revoked: 1,
    submitted: 1,
    failed: 2,
  });
});

test('sensitive fields are redacted recursively', () => {
  assert.deepEqual(redactAgentSensitiveFields({
    nested: {
      workerToken: 'worker.jwt',
      ok: true,
      note: 'Bearer long-lived-token',
    },
    list: [{ privateKey: '0xabc' }, 'eyJhbGciOi.fake.sig'],
  }), {
    nested: {
      workerToken: '[redacted]',
      ok: true,
      note: '[redacted]',
    },
    list: [{ privateKey: '[redacted]' }, '[redacted]'],
  });
});

test('activity events normalize safe agent history without serializing secrets', () => {
  const requestEvent = summarizeAgentRequestActivityEvent({
    type: 'response_submit_request',
    requestId: 'agent_req_pending123',
    status: 'pending_approval',
    session: 'alpha',
    requester: '0xabc',
    agentId: 'telegram:agent-1',
    questionIds: [`0x${'11'.repeat(32)}`],
    grantId: 'agent_grant_alpha123',
    payload: {
      workerToken: 'must-redact',
      note: 'Bearer long-lived-token',
    },
    createdAt: '2026-05-07T00:00:00.000Z',
  }, { accountId: '0xabc' });

  assert.equal(requestEvent.accountId, '0xabc');
  assert.equal(requestEvent.actorType, 'telegram');
  assert.equal(requestEvent.actorId, 'telegram:agent-1');
  assert.equal(requestEvent.eventType, 'response_submit_request.pending_approval');
  assert.equal(requestEvent.requestId, 'agent_req_pending123');
  assert.equal(requestEvent.grantId, 'agent_grant_alpha123');
  assert.equal(requestEvent.safeSummary, 'Agent request pending approval for alpha (1 question).');
  assert.equal(JSON.stringify(requestEvent).includes('must-redact'), false);
  assert.equal(JSON.stringify(requestEvent).includes('long-lived-token'), false);

  const draftEvent = summarizePendingResponseActivityEvent({
    questionId: `0x${'22'.repeat(32)}`,
    respondent: '0xabc',
    source: 'contextengine-cc',
    timestamp: '2026-05-07T00:01:00.000Z',
  }, { accountId: '0xabc', session: 'alpha' });
  assert.equal(draftEvent.actorType, 'ce_cc');
  assert.equal(draftEvent.resourceRef, 'question:0x22222222...222222');
  assert.equal(draftEvent.safeSummary, 'Draft response saved for alpha.');

  const passkeyEvent = normalizeCeActivityEvent({
    accountId: '0xabc',
    actorType: 'human_passkey',
    actorId: 'passkey:local',
    eventType: 'passkey.sign_in',
    safeSummary: 'Passkey sign-in recorded.',
    createdAt: '2026-05-07T00:02:00.000Z',
  });
  assert.equal(passkeyEvent.actorType, 'human_passkey');
  assert.equal(passkeyEvent.eventType, 'passkey.sign_in');
});

test('bridge activity events and counts preserve safe summaries only', () => {
  const event = summarizeAgentBridgeActivityEvent({
    eventId: 'agent_event_alpha123',
    eventType: 'account_created',
    scope: {
      accountPrincipal: { principalKind: 'ce_wallet', principalId: '0xabc' },
      agentPrincipal: { principalKind: 'agent', principalId: 'context-engine-agent' },
      integrationPrincipal: { principalKind: 'telegram', principalId: 'telegram:555' },
      session: 'alpha',
      grantId: '',
    },
    actionRecordId: 'agent_account_abc123',
    summary: {
      accountId: 'agent_account_abc123',
      accountAddress: '0x1234567890123456789012345678901234567890',
      workerToken: 'must-redact',
      note: 'Bearer long-lived-token',
    },
    createdAt: '2026-05-07T00:03:00.000Z',
  }, { accountId: '0xabc' });

  assert.equal(event.eventId, 'agent_event_alpha123');
  assert.equal(event.actorType, 'telegram');
  assert.equal(event.resourceRef, 'agent_account_abc123');
  assert.equal(event.safeSummary, 'Agent activity account created for alpha.');
  assert.equal(JSON.stringify(event).includes('must-redact'), false);
  assert.equal(JSON.stringify(event).includes('long-lived-token'), false);

  const sorted = sortCeActivityEvents([
    normalizeCeActivityEvent({
      accountId: '0xabc',
      actorId: 'agent',
      eventType: 'older',
      createdAt: '2026-05-07T00:00:00.000Z',
      safeSummary: 'Older event.',
    }),
    event,
  ]);
  assert.equal(sorted[0].eventId, 'agent_event_alpha123');
  assert.deepEqual(summarizeCeActivityEventCounts(sorted), {
    account_created: 1,
    older: 1,
  });
});
