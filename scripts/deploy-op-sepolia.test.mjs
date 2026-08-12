import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';

import {
  deployOpSepoliaContracts,
  predictDeploymentAddresses,
  readDeploymentPreflight,
} from './deploy-op-sepolia.mjs';

test('deployOpSepoliaContracts pins the chain while honoring OP-specific RPC precedence', async () => {
  const calls = [];
  const result = await deployOpSepoliaContracts({
    env: {
      EVM_CHAIN_ID: '1',
      EVM_RPC_URL: 'https://generic.example/rpc',
      OP_SEPOLIA_RPC_URL: 'https://op.example/rpc',
    },
    deploy: async (options) => {
      calls.push(options);
      return 'ok';
    },
  });

  assert.equal(result, 'ok');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].env.EVM_CHAIN_ID, '11155420');
  assert.equal(calls[0].env.EVM_RPC_URL, 'https://op.example/rpc');
  assert.match(calls[0].defaultKeyPath, /\.keys\/deployer-op-sepolia\.key$/);
});

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
