#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import rpcDefaults from '../client/src/variables/rpcDefaults.js';
import {
  deployEvmContracts,
  predictDeploymentAddresses,
  readDeploymentPreflight,
} from './deploy-evm.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OP_SEPOLIA_CHAIN_ID = 11155420;
const DEFAULT_KEY_PATH = path.join(ROOT, '.keys', 'deployer-op-sepolia.key');
const DEFAULT_RPC_URL = String(rpcDefaults.getPublicRpcUrls(OP_SEPOLIA_CHAIN_ID)?.[0] || '').trim();

export { predictDeploymentAddresses, readDeploymentPreflight };

export const deployOpSepoliaContracts = ({
  env = process.env,
  deploy = deployEvmContracts,
} = {}) => deploy({
  env: {
    ...env,
    EVM_CHAIN_ID: String(OP_SEPOLIA_CHAIN_ID),
    EVM_RPC_URL: String(
      env.OP_SEPOLIA_RPC_URL || env.EVM_RPC_URL || env.RPC_URL || DEFAULT_RPC_URL
    ).trim(),
  },
  defaultKeyPath: DEFAULT_KEY_PATH,
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  deployOpSepoliaContracts().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
