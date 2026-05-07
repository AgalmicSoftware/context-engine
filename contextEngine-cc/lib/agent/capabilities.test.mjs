// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_CAPABILITY_MODES,
  AGENT_CAPABILITY_MODE_METADATA,
  buildAgentCapabilities,
  evaluateAgentCapabilityRequest,
  hasAgentCapability,
  isRemoteAgentCapabilityMode,
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
  assert.equal(hasAgentCapability(capabilities, AGENT_CAPABILITY_MODES.CREATE_QUESTION_REQUEST), false);
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

test('capability metadata marks risky remote modes as approval-gated', () => {
  assert.equal(AGENT_CAPABILITY_MODE_METADATA[AGENT_CAPABILITY_MODES.SUBMIT_REQUEST].requiresApproval, true);
  assert.equal(AGENT_CAPABILITY_MODE_METADATA[AGENT_CAPABILITY_MODES.DECRYPT_REQUEST].requiresApproval, true);
  assert.equal(isRemoteAgentCapabilityMode(AGENT_CAPABILITY_MODES.SUBMIT_REQUEST), true);
  assert.equal(isRemoteAgentCapabilityMode(AGENT_CAPABILITY_MODES.TRUSTED_LOCAL_AUTO_SUBMIT), false);
});

test('capability decisions keep risky and local-only modes explicit', () => {
  const capabilities = buildAgentCapabilities({
    sessions: ['alpha'],
    workerTokenSummary: { ready: true },
    settings: { autoSubmitResponses: true },
    submitStatus: { ready: true },
  });

  assert.deepEqual(evaluateAgentCapabilityRequest({
    capabilities,
    mode: AGENT_CAPABILITY_MODES.SUBMIT_REQUEST,
  }), {
    ok: true,
    status: 'approval_required',
    reason: 'human_approval_required',
    mode: AGENT_CAPABILITY_MODES.SUBMIT_REQUEST,
    requiresApproval: true,
    risky: true,
    remoteAllowed: true,
  });
  assert.deepEqual(evaluateAgentCapabilityRequest({
    capabilities,
    mode: AGENT_CAPABILITY_MODES.TRUSTED_LOCAL_AUTO_SUBMIT,
  }), {
    ok: false,
    status: 'denied',
    reason: 'local_only_capability',
    mode: AGENT_CAPABILITY_MODES.TRUSTED_LOCAL_AUTO_SUBMIT,
  });
  assert.deepEqual(evaluateAgentCapabilityRequest({
    capabilities,
    mode: AGENT_CAPABILITY_MODES.CREATE_QUESTION_REQUEST,
  }), {
    ok: false,
    status: 'denied',
    reason: 'capability_disabled',
    mode: AGENT_CAPABILITY_MODES.CREATE_QUESTION_REQUEST,
  });
  assert.deepEqual(evaluateAgentCapabilityRequest({
    capabilities,
    mode: 'agent:sign',
  }), {
    ok: false,
    status: 'denied',
    reason: 'unknown_capability',
    mode: 'agent:sign',
  });
});
