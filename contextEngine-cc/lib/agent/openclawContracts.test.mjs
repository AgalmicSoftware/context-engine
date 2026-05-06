import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENCLAW_THREAD_ADAPTER_CONTRACT,
  buildOpenClawApprovalForward,
  buildOpenClawDraftForward,
  normalizeOpenClawThreadTarget,
} from './openclawContracts.mjs';

test('OpenClaw adapter contract is optional and transport-only', () => {
  assert.equal(OPENCLAW_THREAD_ADAPTER_CONTRACT.dependency, 'optional');
  assert.equal(OPENCLAW_THREAD_ADAPTER_CONTRACT.transport, 'adapter');
  assert.equal(
    OPENCLAW_THREAD_ADAPTER_CONTRACT.constraints.includes('Direct HTTP must work without OpenClaw.'),
    true,
  );
});

test('OpenClaw approval forwarding envelope points back to canonical request status', () => {
  assert.deepEqual(buildOpenClawApprovalForward({
    threadId: 'thread-1',
    requestId: 'agent_req_abc12345',
    approvalUrl: 'http://localhost:7391/agent/requests/agent_req_abc12345',
  }), {
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
});

test('OpenClaw thread target normalization defaults to the adapter contract name', () => {
  assert.deepEqual(normalizeOpenClawThreadTarget({ enabled: true, threadId: 't-1' }), {
    enabled: true,
    threadId: 't-1',
    adapterName: 'OpenClawThreadAdapter',
  });
});
