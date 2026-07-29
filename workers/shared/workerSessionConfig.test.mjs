import test from 'node:test';
import assert from 'node:assert/strict';

import { selectDeployWorkerSessionConfigFields } from './workerSessionConfig.mjs';

const workerProfile = ({
  onChainSbt = false,
  lit = false,
} = {}) => ({
  authority: { mode: 'worker_canonical' },
  authorization: {
    mechanisms: ['worker_roles', ...(onChainSbt ? ['sbt_onchain'] : [])],
  },
  encryption: { mode: lit ? 'lit' : 'none' },
});

test('deploy config selection strips chain and SBT fields from pure Worker sessions', () => {
  const selected = selectDeployWorkerSessionConfigFields({
    sessionModeProfile: workerProfile(),
    sessionEndsAt: '2099-01-02T03:04:00.000Z',
    defaultGroupTags: 'facilitators',
    defaultSbtTags: 'token-holders',
    networkChainId: 11155420,
    contracts: {
      surveys: { address: '0x1' },
      sbtFactory: { address: '0x2' },
      sessionRegistry: { address: '0x3' },
    },
  });

  assert.equal(selected.sessionEndsAt, '2099-01-02T03:04:00.000Z');
  assert.equal(selected.defaultGroupTags, 'facilitators');
  assert.equal(Object.hasOwn(selected, 'defaultSbtTags'), false);
  assert.equal(Object.hasOwn(selected, 'networkChainId'), false);
  assert.equal(Object.hasOwn(selected, 'contracts'), false);
});

test('deploy config selection keeps only Group Factory for Worker plus on-chain SBT', () => {
  const selected = selectDeployWorkerSessionConfigFields({
    sessionModeProfile: workerProfile({ onChainSbt: true }),
    defaultSbtTags: 'token-holders',
    networkChainId: 11155420,
    contracts: {
      surveys: { address: '0x1' },
      sbtFactory: { address: '0x2' },
      sessionRegistry: { address: '0x3' },
    },
  });

  assert.equal(selected.defaultSbtTags, 'token-holders');
  assert.equal(selected.networkChainId, 11155420);
  assert.deepEqual(selected.contracts, {
    sbtFactory: { address: '0x2' },
  });
});

test('deploy config selection preserves decentralized contracts', () => {
  const contracts = {
    surveys: { address: '0x1' },
    sbtFactory: { address: '0x2' },
    sessionRegistry: { address: '0x3' },
  };
  const selected = selectDeployWorkerSessionConfigFields({
    sessionModeProfile: {
      authority: { mode: 'evm_registry_canonical' },
    },
    networkChainId: 11155420,
    contracts,
  });

  assert.equal(selected.networkChainId, 11155420);
  assert.deepEqual(selected.contracts, contracts);
});
