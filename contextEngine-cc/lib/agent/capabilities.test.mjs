import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_CAPABILITY_MODES,
  buildAgentCapabilities,
  hasAgentCapability,
} from './capabilities.mjs';

test('agent capabilities allow read draft and submit-request but not remote auto-submit', () => {
  const capabilities = buildAgentCapabilities({
    wallet: '0xabc',
    sessions: ['alpha'],
    workerTokenSummary: { ready: true },
    settings: { autoSubmitResponses: true },
    submitStatus: { ready: true },
  });

  assert.equal(capabilities.wallet, '0xabc');
  assert.equal(hasAgentCapability(capabilities, AGENT_CAPABILITY_MODES.READ), true);
  assert.equal(hasAgentCapability(capabilities, AGENT_CAPABILITY_MODES.DRAFT), true);
  assert.equal(hasAgentCapability(capabilities, AGENT_CAPABILITY_MODES.SUBMIT_REQUEST), true);
  assert.equal(capabilities.submission.remoteAutoSubmit, false);
  assert.equal(capabilities.submission.submitRequestsRequireApproval, true);
  assert.equal(capabilities.submission.trustedLocalAutoSubmit, true);
});

test('trusted local auto-submit is false without worker readiness', () => {
  const capabilities = buildAgentCapabilities({
    sessions: ['alpha', 'beta'],
    workerTokenSummary: { ready: false },
    settings: { autoSubmitResponses: true },
    submitStatus: { ready: true },
  });

  assert.equal(capabilities.submission.trustedLocalAutoSubmit, false);
  assert.equal(capabilities.submission.selectedSessionCount, 2);
});
