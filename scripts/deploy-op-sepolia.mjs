#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import rpcDefaults from '../client/src/variables/rpcDefaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CHAIN_ID = 11155420;
const DEFAULT_KEY_PATH = path.join(ROOT, '.keys', 'deployer-op-sepolia.key');
const DEFAULT_RPC_URL = String(rpcDefaults.getPublicRpcUrls(DEFAULT_CHAIN_ID)?.[0] || '').trim();

const toStr = (value) => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

const readPrivateKey = () => {
  const inline = toStr(
    process.env.EVM_PRIVATE_KEY ||
    process.env.PRIVATE_KEY
  ).trim();
  if (inline) {
    return inline.startsWith('0x') ? inline : `0x${inline}`;
  }

  const keyPath = path.resolve(
    ROOT,
    toStr(process.env.EVM_PRIVATE_KEY_PATH || process.env.PRIVATE_KEY_PATH).trim() || DEFAULT_KEY_PATH
  );
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Missing private key file: ${path.relative(ROOT, keyPath)}`);
  }
  const fileValue = toStr(fs.readFileSync(keyPath, 'utf8')).trim();
  if (!fileValue) {
    throw new Error(`Private key file is empty: ${path.relative(ROOT, keyPath)}`);
  }
  return fileValue.startsWith('0x') ? fileValue : `0x${fileValue}`;
};

const resolveRpcUrl = () => {
  const explicit = toStr(
    process.env.OP_SEPOLIA_RPC_URL ||
    process.env.RPC_URL
  ).trim();
  return explicit || DEFAULT_RPC_URL;
};

export const readDeploymentPreflight = async ({ provider, walletAddress }) => {
  const [nonce, balanceWei] = await Promise.all([
    provider.getTransactionCount(walletAddress, 'pending'),
    provider.getBalance(walletAddress),
  ]);
  return {
    nonce,
    balanceWei,
  };
};

export const predictDeploymentAddresses = ({ walletAddress, nonce }) => ({
  sessionRegistry: ethers.utils.getContractAddress({ from: walletAddress, nonce }),
  surveys: ethers.utils.getContractAddress({ from: walletAddress, nonce: nonce + 1 }),
  sbtFactory: ethers.utils.getContractAddress({ from: walletAddress, nonce: nonce + 2 }),
});

const run = (command, args, extraEnv = {}) => {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status || 1}`);
  }
};

const main = async () => {
  const privateKey = readPrivateKey();
  const rpcUrl = resolveRpcUrl();
  if (!rpcUrl) {
    throw new Error('Missing OP Sepolia RPC URL. Set OP_SEPOLIA_RPC_URL or RPC_URL.');
  }

  const wallet = new ethers.Wallet(privateKey);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId || 0) !== DEFAULT_CHAIN_ID) {
    throw new Error(`Expected chain ${DEFAULT_CHAIN_ID}, got ${network.chainId}`);
  }

  const { nonce, balanceWei } = await readDeploymentPreflight({
    provider,
    walletAddress: wallet.address,
  });
  const predicted = predictDeploymentAddresses({
    walletAddress: wallet.address,
    nonce,
  });

  console.log(JSON.stringify({
    step: 'preflight',
    chainId: network.chainId,
    rpcUrl,
    deployer: wallet.address,
    nonce,
    balanceWei: balanceWei.toString(),
    balanceEth: ethers.utils.formatEther(balanceWei),
    predicted,
  }, null, 2));

  run('forge', ['script', 'foundry/script/DeployAll.s.sol', '--tc', 'DeployAll', '--rpc-url', rpcUrl, '--broadcast'], {
    PRIVATE_KEY: privateKey,
  });

  const postNonce = await provider.getTransactionCount(wallet.address, 'pending');
  if (postNonce < nonce + 3) {
    throw new Error(`Deployment broadcast completed, but nonce advanced to ${postNonce} instead of at least ${nonce + 3}`);
  }

  console.log(JSON.stringify({
    step: 'complete',
    chainId: network.chainId,
    rpcUrl,
    deployer: wallet.address,
    addresses: predicted,
  }, null, 2));
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
