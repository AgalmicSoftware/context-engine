// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENCLAW_THREAD_ADAPTER_CONTRACT,
  OPENCLAW_THREAD_EVENT_STATES,
  buildOpenClawApprovalForward,
  buildOpenClawDraftForward,
  buildOpenClawThreadEventEnvelope,
  normalizeOpenClawThreadTarget,
  validateOpenClawAdapterEnvelope,
} from './openclawContracts.mjs';

test('OpenClaw adapter contract is optional and transport-only', () => {
  assert.equal(OPENCLAW_THREAD_ADAPTER_CONTRACT.dependency, 'optional');
  assert.equal(OPENCLAW_THREAD_ADAPTER_CONTRACT.transport, 'adapter');
  assert.equal(
    OPENCLAW_THREAD_ADAPTER_CONTRACT.constraints.includes('Direct HTTP must work without OpenClaw.'),
    true,
  );
});

test('OpenClaw thread event states cover delivery and request lifecycle', () => {
  assert.deepEqual(OPENCLAW_THREAD_EVENT_STATES, [
    'delivered',
    'drafted',
    'submit_requested',
    'approved',
    'submitted',
    'failed',
  ]);

  for (const event of OPENCLAW_THREAD_EVENT_STATES) {
    const envelope = buildOpenClawThreadEventEnvelope({ event, threadId: 'thread-1' });
    assert.equal(envelope.event, event);
    assert.equal(envelope.http.path, '/api/agent/inbox');
    assert.deepEqual(validateOpenClawAdapterEnvelope(envelope), { ok: true });
  }
});

test('OpenClaw submit-request event preserves approval handoff fields', () => {
  const envelope = buildOpenClawThreadEventEnvelope({
    event: 'submit_requested',
    threadId: 'thread-1',
    requestId: 'agent_req_abc12345',
    approvalUrl: 'http://localhost:7391/agent/requests/agent_req_abc12345',
    status: 'pending_approval',
    session: 'general',
    questionId: '0xabc',
    idempotencyKey: 'OpenClaw:Req.0001',
  });

  assert.equal(envelope.requestId, 'agent_req_abc12345');
  assert.equal(envelope.approvalUrl, 'http://localhost:7391/agent/requests/agent_req_abc12345');
  assert.equal(envelope.status, 'pending_approval');
  assert.equal(envelope.session, 'general');
  assert.equal(envelope.idempotencyKey, 'openclaw:req.0001');
  assert.equal(envelope.http.path, '/api/agent/requests/agent_req_abc12345');
  assert.deepEqual(validateOpenClawAdapterEnvelope(envelope), { ok: true });
});

test('OpenClaw thread events validate optional public session slugs', () => {
  assert.equal(buildOpenClawThreadEventEnvelope({
    event: 'delivered',
    session: ' general ',
  }).session, 'general');
  assert.equal(buildOpenClawThreadEventEnvelope({
    event: 'delivered',
  }).session, null);
  assert.throws(
    () => buildOpenClawThreadEventEnvelope({
      event: 'delivered',
      session: '../outside',
    }),
    /Invalid OpenClaw public session slug/,
  );
});

test('OpenClaw thread events reject invalid states and secret-shaped idempotency keys', () => {
  assert.throws(
    () => buildOpenClawThreadEventEnvelope({ event: 'scrape_dom' }),
    /Invalid OpenClaw thread event state/,
  );
  assert.throws(
    () => buildOpenClawThreadEventEnvelope({
      event: 'submit_requested',
      idempotencyKey: 'Bearer long-lived-token',
    }),
    /stable and non-secret/,
  );
});

test('OpenClaw approval forwarding envelope points back to canonical request status', () => {
  const envelope = buildOpenClawApprovalForward({
    threadId: 'thread-1',
    requestId: 'agent_req_abc12345',
    approvalUrl: 'http://localhost:7391/agent/requests/agent_req_abc12345',
  });

  assert.deepEqual(envelope, {
    adapter: 'OpenClawThreadAdapter',
    version: 'agent-contract-v1',
    event: 'approval_required',
    threadId: 'thread-1',
    requestId: 'agent_req_abc12345',
    approvalUrl: 'http://localhost:7391/agent/requests/agent_req_abc12345',
    message: 'Human approval is required before submission.',
    http: {
      method: 'GET',
      path: '/api/agent/requests/agent_req_abc12345',
    },
  });
  assert.deepEqual(validateOpenClawAdapterEnvelope(envelope), { ok: true });
});

test('OpenClaw draft forwarding envelope uses canonical draft listing', () => {
  const envelope = buildOpenClawDraftForward({
    threadId: 'thread-1',
    session: 'alpha',
    questionId: '0xabc',
    draft: { questionId: '0xabc' },
  });

  assert.equal(envelope.http.path, '/api/agent/responses/drafts?session=alpha');
  assert.equal(envelope.event, 'draft_saved');
  assert.deepEqual(validateOpenClawAdapterEnvelope(envelope), { ok: true });
});

test('OpenClaw draft forwarding requires explicit public session names', () => {
  const envelope = buildOpenClawDraftForward({
    session: ' general ',
    questionId: '0xabc',
    draft: { questionId: '0xabc' },
  });

  assert.equal(envelope.session, 'general');
  assert.equal(envelope.http.path, '/api/agent/responses/drafts?session=general');
  assert.throws(
    () => buildOpenClawDraftForward({ session: '', questionId: '0xabc' }),
    /use "general"/,
  );
  assert.throws(
    () => buildOpenClawDraftForward({ session: '../outside', questionId: '0xabc' }),
    /Invalid OpenClaw public session slug/,
  );
});

test('OpenClaw thread target normalization defaults to the adapter contract name', () => {
  assert.deepEqual(normalizeOpenClawThreadTarget({ enabled: true, threadId: 't-1' }), {
    enabled: true,
    threadId: 't-1',
    adapterName: 'OpenClawThreadAdapter',
  });
});

test('OpenClaw adapter envelope validator rejects non-agent routes and DOM hooks', () => {
  assert.deepEqual(validateOpenClawAdapterEnvelope({
    http: { method: 'GET', path: '/api/questions' },
  }), {
    ok: false,
    error: 'OpenClaw adapter envelopes must point to canonical /api/agent routes.',
  });
  assert.deepEqual(validateOpenClawAdapterEnvelope({
    http: { method: 'GET', path: '/api/agent/questions' },
    transportHint: 'document.querySelector(".question")',
  }), {
    ok: false,
    error: 'OpenClaw adapter envelopes must not depend on browser DOM scraping.',
  });
});
