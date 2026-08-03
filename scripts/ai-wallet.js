#!/usr/bin/env node

const { ethers } = require('ethers');
const { loadClientDefaults } = require('./lib/network-defaults.js');
const {
  buildWalletFromPasskeyRawId,
} = require('./lib/porto-wallet-derivation.js');
const { getPublicRpcUrls } = require('../client/src/variables/rpcDefaults.js');
const {
  buildPasskeyDerivedWallet,
  toPasskeyEoaSeedRecord,
} = require('./lib/passkey-derived-wallet');
const {
  createGroupPasswordDerivation,
} = require('../client/src/utilities/crypto/groupPasswordDerivation.cjs');

const DEFAULT_CHAIN_ID = Number(loadClientDefaults()?.defaultChainId || 0);
const DEFAULT_RPC_URL = getPublicRpcUrls(DEFAULT_CHAIN_ID)[0] || '';
const DEFAULT_PASSKEY_RAW_ID_B64URL = 'AQIDBAUGBwgJCgsMDQ4PEA';

const toBool = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
};

const normalizeGroupPasswordInput = (raw) => {
  const trimmed = String(raw || '').trim();
  const compact = trimmed.replace(/\s+/g, '');
  if (!compact) return '';
  if (ethers.utils.isHexString(compact)) {
    try {
      return ethers.utils.toUtf8String(compact);
    } catch (_) {
      return compact;
    }
  }
  return compact;
};

const { computeGroupPasswordHash } = createGroupPasswordDerivation(ethers);

const deriveWalletFromPasskeyRawId = (rawIdB64Url) => {
  const { rawIdBytes, privateKey, wallet } = buildWalletFromPasskeyRawId(rawIdB64Url);
  return { rawIdBytes, privateKey, wallet };
};

async function main() {
  const rawIdB64Url = process.env.PASSKEY_RAW_ID_B64URL || DEFAULT_PASSKEY_RAW_ID_B64URL;
  const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;
  const groupPassword = normalizeGroupPasswordInput(process.env.GROUP_PASSWORD || '');
  const showPrivateKey = toBool(process.env.SHOW_PRIVATE_KEY || 'false');

  const { rawIdBytes, privateKey, wallet } = buildPasskeyDerivedWallet(rawIdB64Url);

  let balanceWei = null;
  let chainId = null;
  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const [network, balance] = await Promise.all([
      provider.getNetwork(),
      provider.getBalance(wallet.address),
    ]);
    chainId = network.chainId;
    balanceWei = balance.toString();
  } catch (_) {
    // Keep output usable even if RPC is unavailable.
  }

  const result = {
    passkeyRawIdB64Url: rawIdB64Url,
    rawIdBytesHex: ethers.utils.hexlify(rawIdBytes),
    walletKeyMode: 'passkey-derived',
    address: wallet.address,
    rpcUrl,
    chainId,
    balanceWei,
  };

  if (showPrivateKey) {
    result.privateKey = privateKey;
    result.passkeyEoaDevSeed = {
      ...toPasskeyEoaSeedRecord({
        credentialId: rawIdB64Url,
        address: wallet.address,
      }),
      privateKey,
    };
  }

  if (groupPassword) {
    result.groupPasswordHash = computeGroupPasswordHash({ password: groupPassword, sbtAddress: '' });
    result.groupPasswordDerivation = 'sbt-group-password-v3';
    result.groupPasswordScope = 'zero-address';
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
