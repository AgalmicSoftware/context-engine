import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  assertDeploymentChain,
  buildForgeDeploymentInvocation,
  resolveDeploymentTarget,
} from './deploy-evm.mjs';

test('resolveDeploymentTarget accepts an explicit arbitrary EVM chain', () => {
  assert.deepEqual(
    resolveDeploymentTarget({
      env: {
        EVM_CHAIN_ID: '421614',
        EVM_RPC_URL: 'https://arbitrum-sepolia.example/rpc',
      },
    }),
    {
      chainId: 421614,
      rpcUrl: 'https://arbitrum-sepolia.example/rpc',
    },
  );
});

test('resolveDeploymentTarget requires an explicit chain and RPC URL', () => {
  assert.throws(
    () => resolveDeploymentTarget({ env: {} }),
    /Missing EVM chain ID\. Set EVM_CHAIN_ID\./,
  );
  assert.throws(
    () => resolveDeploymentTarget({ env: { EVM_CHAIN_ID: '421614' } }),
    /Missing EVM RPC URL\. Set EVM_RPC_URL or RPC_URL\./,
  );
});

test('assertDeploymentChain rejects an RPC endpoint on a different chain', async () => {
  await assert.rejects(
    assertDeploymentChain({
      provider: {
        async getNetwork() {
          return { chainId: 11155420 };
        },
      },
      expectedChainId: 421614,
    }),
    /Expected chain 421614, got 11155420/,
  );
});

test('deployment status output does not include the RPC URL', () => {
  const source = fs.readFileSync(new URL('./deploy-evm.mjs', import.meta.url), 'utf8');
  const statusBlocks = [...source.matchAll(/console\.log\(JSON\.stringify\(\{([\s\S]*?)\}, null, 2\)\);/g)]
    .map((match) => match[1]);

  assert.equal(statusBlocks.length, 2);
  statusBlocks.forEach((block) => assert.doesNotMatch(block, /rpcUrl/));
  assert.doesNotMatch(source, /args\.join/);
});

test('Forge receives the RPC URL only through its inherited child environment', () => {
  const rpcUrl = 'https://rpc.example.test/project-token-fixture';
  const privateKey = 'private-key-fixture';
  const inheritedEnv = { PATH: '/fixture/bin', KEEP_ME: 'yes' };
  const invocation = buildForgeDeploymentInvocation({ rpcUrl, privateKey, inheritedEnv });

  assert.equal(invocation.command, 'forge');
  assert.deepEqual(invocation.args, [
    'script',
    'foundry/script/DeployAll.s.sol',
    '--tc',
    'DeployAll',
    '--broadcast',
  ]);
  assert.equal(invocation.args.includes('--rpc-url'), false);
  assert.equal(invocation.args.some((value) => value.includes(rpcUrl)), false);
  assert.deepEqual(invocation.env, {
    PATH: '/fixture/bin',
    KEEP_ME: 'yes',
    PRIVATE_KEY: privateKey,
    ETH_RPC_URL: rpcUrl,
  });
});
