import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOCK_OPENCLAW_FORWARDING_EVENTS,
  buildMockOpenClawForwardingEnvelope,
} from './openclawForwarding.mjs';

test('mock OpenClaw forwarding covers safe lifecycle event envelopes only', () => {
  assert.deepEqual(MOCK_OPENCLAW_FORWARDING_EVENTS, [
    'delivered_question',
    'draft_created',
    'submit_request_created',
    'approval_required',
    'failed',
    'final_status',
  ]);

  for (const event of MOCK_OPENCLAW_FORWARDING_EVENTS) {
    const envelope = buildMockOpenClawForwardingEnvelope({
      event,
      sessionSlug: 'alpha',
      question: { questionId: 'q-1', prompt: 'Public prompt?' },
      draftRef: 'draft_ref_1',
      requestId: 'agent_req_abc12345',
      status: event === 'final_status' ? 'submitted' : '',
    });
    assert.equal(envelope.transport, 'mock_contract_only');
    assert.equal(envelope.realHttpTransportImplemented, false);
    assert.equal(envelope.publicSummary.event, event);
    assert.equal(envelope.publicSummary.sessionSlug, 'alpha');
    assert.equal(envelope.canonicalApiRequest.path.startsWith('/api/agent/'), true);
  }
});

test('mock OpenClaw forwarding hides gated prompt text and secret-shaped refs', () => {
  const envelope = buildMockOpenClawForwardingEnvelope({
    event: 'delivered_question',
    sessionSlug: 'alpha',
    question: {
      questionId: 'q-private',
      prompt: 'Private prompt must not travel to OpenClaw',
      visibility: 'sbt_gated',
    },
    draftRef: 'draft_ref_safe',
    requestId: 'agent_req_safe123',
  });

  assert.equal(envelope.publicSummary.question.locked, true);
  assert.equal(envelope.publicSummary.question.questionText, null);
  assert.equal(envelope.refs.draftRef, 'draft_ref_safe');
  assert.equal(JSON.stringify(envelope).includes('Private prompt must not travel'), false);
  assert.equal(JSON.stringify(envelope).includes('Bearer'), false);
  assert.throws(
    () => buildMockOpenClawForwardingEnvelope({ event: 'real_http_post' }),
    /Unsupported mock OpenClaw forwarding event/,
  );
});
