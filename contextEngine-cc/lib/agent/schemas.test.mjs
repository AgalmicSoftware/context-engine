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
  redactAgentSensitiveFields,
  summarizeAgentRequestStatusCounts,
  summarizePendingResponseForAgent,
  summarizeRequestForAgent,
} from './schemas.mjs';

test('agent endpoint families enumerate canonical route groups', () => {
  const families = AGENT_ENDPOINT_FAMILIES.map((entry) => entry.family);
  assert.deepEqual(families, ['identity', 'sessions', 'questions', 'inbox', 'responses', 'requests', 'connect-requests', 'grants']);
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
