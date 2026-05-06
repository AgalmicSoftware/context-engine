import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_ENDPOINT_FAMILIES,
  buildAgentError,
  buildAgentOk,
  normalizeAgentQuestionPayload,
  redactAgentSensitiveFields,
  summarizePendingResponseForAgent,
} from './schemas.mjs';

test('agent endpoint families enumerate canonical route groups', () => {
  const families = AGENT_ENDPOINT_FAMILIES.map((entry) => entry.family);
  assert.deepEqual(families, ['identity', 'sessions', 'questions', 'inbox', 'responses', 'requests']);
  assert.equal(
    AGENT_ENDPOINT_FAMILIES.some((entry) => entry.routes.includes('POST /api/agent/responses/submit-request')),
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
  const question = { id: 'q1', prompt: 'Prompt?' };
  assert.deepEqual(normalizeAgentQuestionPayload({ session: 'alpha', question }), {
    ok: true,
    status: 'ok',
    session: 'alpha',
    question,
    questions: [question],
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

test('sensitive fields are redacted recursively', () => {
  assert.deepEqual(redactAgentSensitiveFields({
    nested: {
      workerToken: 'worker.jwt',
      ok: true,
    },
    list: [{ privateKey: '0xabc' }],
  }), {
    nested: {
      workerToken: '[redacted]',
      ok: true,
    },
    list: [{ privateKey: '[redacted]' }],
  });
});
