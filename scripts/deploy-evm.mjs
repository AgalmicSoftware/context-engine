#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const toStr = (value) => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

export const resolveDeploymentTarget = ({
  env = process.env,
  defaultChainId = null,
  defaultRpcUrl = '',
} = {}) => {
  const rawChainId = toStr(env.EVM_CHAIN_ID).trim() || toStr(defaultChainId).trim();
  const chainId = Number(rawChainId);
  if (!rawChainId) {
    throw new Error('Missing EVM chain ID. Set EVM_CHAIN_ID.');
  }
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid EVM chain ID: ${rawChainId}`);
  }

  const rpcUrl = toStr(env.EVM_RPC_URL || env.RPC_URL).trim() || toStr(defaultRpcUrl).trim();
  if (!rpcUrl) {
    throw new Error('Missing EVM RPC URL. Set EVM_RPC_URL or RPC_URL.');
  }

  return { chainId, rpcUrl };
};

const readPrivateKey = ({ env = process.env, defaultKeyPath = '' } = {}) => {
  const inline = toStr(env.EVM_PRIVATE_KEY || env.PRIVATE_KEY).trim();
  if (inline) {
    return inline.startsWith('0x') ? inline : `0x${inline}`;
  }

  const configuredPath = toStr(env.EVM_PRIVATE_KEY_PATH || env.PRIVATE_KEY_PATH).trim() || defaultKeyPath;
  if (!configuredPath) {
    throw new Error('Missing private key. Set EVM_PRIVATE_KEY or EVM_PRIVATE_KEY_PATH.');
  }

  const keyPath = path.resolve(ROOT, configuredPath);
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Missing private key file: ${path.relative(ROOT, keyPath)}`);
  }
  const fileValue = toStr(fs.readFileSync(keyPath, 'utf8')).trim();
  if (!fileValue) {
    throw new Error(`Private key file is empty: ${path.relative(ROOT, keyPath)}`);
  }
  return fileValue.startsWith('0x') ? fileValue : `0x${fileValue}`;
};

export const readDeploymentPreflight = async ({ provider, walletAddress }) => {
  const [nonce, balanceWei] = await Promise.all([
    provider.getTransactionCount(walletAddress, 'pending'),
    provider.getBalance(walletAddress),
  ]);
  return { nonce, balanceWei };
};

export const predictDeploymentAddresses = ({ walletAddress, nonce }) => ({
  sessionRegistry: ethers.utils.getContractAddress({ from: walletAddress, nonce }),
  surveys: ethers.utils.getContractAddress({ from: walletAddress, nonce: nonce + 1 }),
  sbtFactory: ethers.utils.getContractAddress({ from: walletAddress, nonce: nonce + 2 }),
});

export const assertDeploymentChain = async ({ provider, expectedChainId }) => {
  const network = await provider.getNetwork();
  if (Number(network.chainId || 0) !== expectedChainId) {
    throw new Error(`Expected chain ${expectedChainId}, got ${network.chainId}`);
  }
  return network;
};

export const buildForgeDeploymentInvocation = ({
  rpcUrl,
  privateKey,
  inheritedEnv = process.env,
}) => ({
  command: 'forge',
  args: ['script', 'foundry/script/DeployAll.s.sol', '--tc', 'DeployAll', '--broadcast'],
  env: {
    ...inheritedEnv,
    PRIVATE_KEY: privateKey,
    ETH_RPC_URL: rpcUrl,
  },
});

const run = (command, args, childEnv = process.env) => {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: childEnv,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status || 1}`);
  }
};

export const deployEvmContracts = async ({
  env = process.env,
  defaultChainId = null,
  defaultRpcUrl = '',
  defaultKeyPath = '',
} = {}) => {
  const { chainId, rpcUrl } = resolveDeploymentTarget({ env, defaultChainId, defaultRpcUrl });
  const privateKey = readPrivateKey({ env, defaultKeyPath });
  const wallet = new ethers.Wallet(privateKey);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const network = await assertDeploymentChain({ provider, expectedChainId: chainId });
  const { nonce, balanceWei } = await readDeploymentPreflight({
    provider,
    walletAddress: wallet.address,
  });
  const predicted = predictDeploymentAddresses({ walletAddress: wallet.address, nonce });

  console.log(JSON.stringify({
    step: 'preflight',
    chainId: network.chainId,
    deployer: wallet.address,
    nonce,
    balanceWei: balanceWei.toString(),
    balanceEth: ethers.utils.formatEther(balanceWei),
    predicted,
  }, null, 2));

  const forgeInvocation = buildForgeDeploymentInvocation({ rpcUrl, privateKey });
  run(forgeInvocation.command, forgeInvocation.args, forgeInvocation.env);

  const postNonce = await provider.getTransactionCount(wallet.address, 'pending');
  if (postNonce < nonce + 3) {
    throw new Error(`Deployment broadcast completed, but nonce advanced to ${postNonce} instead of at least ${nonce + 3}`);
  }

  console.log(JSON.stringify({
    step: 'complete',
    chainId: network.chainId,
    deployer: wallet.address,
    addresses: predicted,
  }, null, 2));
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  deployEvmContracts().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
