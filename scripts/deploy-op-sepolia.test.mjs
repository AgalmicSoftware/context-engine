import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';

import {
  predictDeploymentAddresses,
  readDeploymentPreflight,
} from './deploy-op-sepolia.mjs';

test('readDeploymentPreflight uses the pending nonce for address prediction', async () => {
  const calls = [];
  const provider = {
    async getTransactionCount(address, blockTag) {
      calls.push(['getTransactionCount', address, blockTag]);
      return 17;
    },
    async getBalance(address) {
      calls.push(['getBalance', address]);
      return { toString: () => '123' };
    },
  };

  const result = await readDeploymentPreflight({
    provider,
    walletAddress: '0x1111111111111111111111111111111111111111',
  });

  assert.equal(result.nonce, 17);
  assert.equal(result.balanceWei.toString(), '123');
  assert.deepEqual(calls[0], [
    'getTransactionCount',
    '0x1111111111111111111111111111111111111111',
    'pending',
  ]);
});

test('predictDeploymentAddresses deterministically expands the deployment nonce window', () => {
  const predicted = predictDeploymentAddresses({
    walletAddress: '0x1111111111111111111111111111111111111111',
    nonce: 17,
  });

  assert.deepEqual(predicted, {
    sessionRegistry: ethers.utils.getContractAddress({ from: '0x1111111111111111111111111111111111111111', nonce: 17 }),
    surveys: ethers.utils.getContractAddress({ from: '0x1111111111111111111111111111111111111111', nonce: 18 }),
    sbtFactory: ethers.utils.getContractAddress({ from: '0x1111111111111111111111111111111111111111', nonce: 19 }),
  });
});
