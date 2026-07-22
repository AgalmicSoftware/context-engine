import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASELINE_GROWTH_APPROVAL_LABEL,
  evaluateBaselineGrowthApproval,
} from './resolve-baseline-growth-approval.mjs';

const owner = 'AgalmicSoftware';

const approvalInput = (overrides = {}) => ({
  eventName: 'pull_request',
  pullRequest: {
    user: { login: 'contributor' },
    labels: [{ name: BASELINE_GROWTH_APPROVAL_LABEL }],
    head: { sha: '1111111111111111111111111111111111111111' },
  },
  labelEvents: [{
    event: 'labeled',
    label: { name: BASELINE_GROWTH_APPROVAL_LABEL },
    actor: { login: owner },
    created_at: '2026-07-21T12:00:00Z',
  }],
  reviews: [{
    id: 1,
    state: 'APPROVED',
    user: { login: owner },
    commit_id: '1111111111111111111111111111111111111111',
    submitted_at: '2026-07-21T12:01:00Z',
  }],
  permissionsByLogin: {
    [owner]: 'admin',
  },
  codeOwners: [owner],
  ...overrides,
});

test('approves only a current maintainer label plus a distinct CODEOWNER approval', () => {
  assert.deepEqual(evaluateBaselineGrowthApproval(approvalInput()), {
    approved: true,
    reason: 'maintainer-label-and-codeowner-review',
    labelActor: owner,
    reviewer: owner,
  });
});

test('rejects direct pushes even when synthetic approval metadata is present', () => {
  const result = evaluateBaselineGrowthApproval(approvalInput({ eventName: 'push' }));

  assert.equal(result.approved, false);
  assert.equal(result.reason, 'pull-request-required');
});

test('rejects author-applied labels and labels that are no longer present', () => {
  const authorApplied = evaluateBaselineGrowthApproval(approvalInput({
    labelEvents: [{
      event: 'labeled',
      label: { name: BASELINE_GROWTH_APPROVAL_LABEL },
      actor: { login: 'contributor' },
    }],
    permissionsByLogin: { contributor: 'write', [owner]: 'admin' },
  }));
  const removed = evaluateBaselineGrowthApproval(approvalInput({
    pullRequest: { user: { login: 'contributor' }, labels: [] },
  }));

  assert.equal(authorApplied.approved, false);
  assert.equal(authorApplied.reason, 'label-actor-not-maintainer');
  assert.equal(removed.approved, false);
  assert.equal(removed.reason, 'approval-label-missing');
});

test('rejects missing, superseded, self, or non-CODEOWNER approvals', () => {
  const missing = evaluateBaselineGrowthApproval(approvalInput({ reviews: [] }));
  const stale = evaluateBaselineGrowthApproval(approvalInput({
    reviews: [
      { id: 1, state: 'APPROVED', user: { login: owner }, commit_id: '1111111111111111111111111111111111111111', submitted_at: '2026-07-21T12:00:00Z' },
      { id: 2, state: 'CHANGES_REQUESTED', user: { login: owner }, submitted_at: '2026-07-21T12:01:00Z' },
    ],
  }));
  const self = evaluateBaselineGrowthApproval(approvalInput({
    pullRequest: {
      user: { login: owner },
      labels: [{ name: BASELINE_GROWTH_APPROVAL_LABEL }],
    },
  }));
  const outsider = evaluateBaselineGrowthApproval(approvalInput({
    reviews: [{ id: 1, state: 'APPROVED', user: { login: 'reviewer' } }],
    permissionsByLogin: { [owner]: 'admin', reviewer: 'write' },
  }));

  assert.equal(missing.reason, 'codeowner-approval-missing');
  assert.equal(stale.reason, 'codeowner-approval-missing');
  assert.equal(self.reason, 'codeowner-approval-missing');
  assert.equal(outsider.reason, 'codeowner-approval-missing');
});

test('rejects approval for an earlier head commit', () => {
  const result = evaluateBaselineGrowthApproval(approvalInput({
    reviews: [{
      id: 1,
      state: 'APPROVED',
      user: { login: owner },
      commit_id: '2222222222222222222222222222222222222222',
    }],
  }));

  assert.equal(result.approved, false);
  assert.equal(result.reason, 'codeowner-approval-missing');
});
