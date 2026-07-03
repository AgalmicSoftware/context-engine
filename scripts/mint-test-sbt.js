#!/usr/bin/env node

const { ethers } = require('ethers');
const { nowHumanTag } = require('./lib/common');
const { normalizeRequiredMetadataUri } = require('./lib/arweave-metadata');
const { resolveChainDefaults } = require('./lib/network-defaults');
const { derivePrivateKeyFromPasskeyRawId } = require('./lib/porto-wallet-derivation.js');

const DEFAULT_PASSKEY_RAW_ID_B64URL = 'AQIDBAUGBwgJCgsMDQ4PEA';
const DEFAULT_GROUP_PASSWORD = 'browserUse';
const DEFAULT_SESSION_BASE_URL = 'http://127.0.0.1:3000/session';
const DEFAULT_GAS_PRICE_WEI = '2000000'; // 0.002 gwei
const DEFAULT_GAS_LIMIT_MULTIPLIER_BPS = 12000; // 120%

const factoryAbi = [
  'function sbtCount() view returns (uint256)',
  'function createSBT(string name,string symbol,uint256 limitedNumber,address adminAddress,uint256 mintingEndTime,bool hasPasswordMint,uint8 burnAuth,bytes32[] hashedPasswords,string tokenURI,bytes32 groupPasswordHash)',
  'event SBTCreated(address indexed sbtAddress)',
];

const sbtAbi = [
  'function getSBTMetadata() view returns (string name_, string symbol_, uint256 maxTokens_, uint256 mintedTokens_, address admin_, uint256 mintingEndTime_, bool hasPasswordMint_, uint8 burnAuth_, string tokenURI_)',
  'function groupPasswordHash() view returns (bytes32)',
];

const toBool = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBigNumber = (value, fallback) => {
  try {
    return ethers.BigNumber.from(String(value));
  } catch (_) {
    return ethers.BigNumber.from(String(fallback));
  }
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

const computeGroupPasswordHash = (password) => {
  const pwHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password || ''));
  const salt = ethers.utils.solidityKeccak256(['string'], ['sbt-group-password-v2']);
  const seed = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [pwHash, salt]);
  const tmpSk = ethers.utils.keccak256(ethers.utils.arrayify(seed));
  const tmpWallet = new ethers.Wallet(tmpSk);
  return ethers.utils.solidityKeccak256(['address'], [tmpWallet.address]);
};

const parseCreatedAddress = (receipt) => {
  const iface = new ethers.utils.Interface(factoryAbi);
  for (const log of receipt.logs || []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'SBTCreated' && parsed.args?.sbtAddress) {
        return parsed.args.sbtAddress;
      }
    } catch (_) {}
  }
  return null;
};

async function main() {
  const chain = resolveChainDefaults({ env: process.env });
  const rpcUrl = chain.rpcUrl;
  const expectedChainId = chain.chainId;
  const rawIdB64Url = process.env.PASSKEY_RAW_ID_B64URL || DEFAULT_PASSKEY_RAW_ID_B64URL;
  const privateKey = process.env.AI_TEST_PRIVATE_KEY || derivePrivateKeyFromPasskeyRawId(rawIdB64Url);

  const factoryAddress = chain.sbtFactory;
  const groupPassword = normalizeGroupPasswordInput(process.env.GROUP_PASSWORD || DEFAULT_GROUP_PASSWORD);
  const rawMetadataUri = String(process.env.SBT_METADATA_URI || process.env.E2E_SBT_METADATA_URI || '').trim();
  const tokenURI = normalizeRequiredMetadataUri(rawMetadataUri);
  if (!tokenURI) {
    throw new Error(
      'Missing required Arweave metadata URI for tokenURI. ' +
      'Set SBT_METADATA_URI (or E2E_SBT_METADATA_URI) to an ar:// URI, Arweave gateway URL, or txId.'
    );
  }
  const sessionBaseUrl = process.env.SESSION_BASE_URL || DEFAULT_SESSION_BASE_URL;
  const dryRun = toBool(process.env.DRY_RUN);
  const jsonOnly = toBool(process.env.JSON_ONLY);

  const limitedNumber = Math.max(0, toInt(process.env.LIMITED_NUMBER, 0));
  const mintingEndTime = Math.max(0, toInt(process.env.MINTING_END_TIME, 0));
  const burnAuth = Math.max(0, Math.min(3, toInt(process.env.BURN_AUTH, 0)));
  const hasPasswordMint = toBool(process.env.HAS_PASSWORD_MINT);
  const gasPrice = toBigNumber(process.env.GAS_PRICE_WEI, DEFAULT_GAS_PRICE_WEI);
  const gasLimitMultiplierBps = Math.max(10000, toInt(process.env.GAS_LIMIT_MULTIPLIER_BPS, DEFAULT_GAS_LIMIT_MULTIPLIER_BPS));

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const factory = new ethers.Contract(factoryAddress, factoryAbi, wallet);

  const network = await provider.getNetwork();
  if (Number(network.chainId) !== Number(expectedChainId)) {
    throw new Error(`Chain mismatch: expected ${expectedChainId}, got ${network.chainId}`);
  }

  const [beforeCount, balanceWei] = await Promise.all([
    factory.sbtCount(),
    provider.getBalance(wallet.address),
  ]);

  const name = process.env.SBT_NAME || `BrowserUse Test SBT ${nowHumanTag()}`;
  const symbol = process.env.SBT_SYMBOL || `BUSBT${String(beforeCount.toNumber() + 1).padStart(2, '0')}`;
  const groupPasswordHash = computeGroupPasswordHash(groupPassword);
  const encodedGroupPassword = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(groupPassword));

  const createArgs = [
    name,
    symbol,
    limitedNumber,
    wallet.address,
    mintingEndTime,
    hasPasswordMint,
    burnAuth,
    [],
    tokenURI,
    groupPasswordHash,
  ];

  const estimatedGas = await factory.estimateGas.createSBT(...createArgs);
  const gasLimit = estimatedGas.mul(gasLimitMultiplierBps).div(10000);
  const maxCostWei = gasLimit.mul(gasPrice);

  const intro = {
    wallet: wallet.address,
    chainId: network.chainId,
    balanceWei: balanceWei.toString(),
    factory: factoryAddress,
    beforeSbtCount: beforeCount.toString(),
    name,
    symbol,
    metadataUri: tokenURI,
    groupPassword,
    groupPasswordHash,
    estimatedGas: estimatedGas.toString(),
    gasLimit: gasLimit.toString(),
    gasPrice: gasPrice.toString(),
    maxCostWei: maxCostWei.toString(),
    dryRun,
  };
  if (!jsonOnly) {
    console.log(JSON.stringify(intro, null, 2));
  }

  if (balanceWei.lt(maxCostWei)) {
    const warning = `Insufficient funds for live tx: need at least ${maxCostWei.toString()} wei, have ${balanceWei.toString()} wei`;
    if (dryRun) {
      if (jsonOnly) {
        console.log(JSON.stringify({ dryRun: true, intro, warning }, null, 2));
      } else {
        console.warn(warning);
      }
      return;
    }
    throw new Error(warning);
  }

  if (dryRun) {
    if (jsonOnly) {
      console.log(JSON.stringify({ dryRun: true, intro }, null, 2));
    }
    return;
  }

  const tx = await factory.createSBT(...createArgs, {
    gasLimit,
    gasPrice,
  });
  if (!jsonOnly) {
    console.log(`txHash: ${tx.hash}`);
  }

  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error(`createSBT reverted (tx: ${tx.hash})`);
  }

  const sbtAddress = parseCreatedAddress(receipt);
  if (!sbtAddress) {
    throw new Error(`createSBT mined but SBTCreated event was not found (tx: ${tx.hash})`);
  }

  const sbt = new ethers.Contract(sbtAddress, sbtAbi, provider);
  const [meta, onchainGroupHash, afterCount] = await Promise.all([
    sbt.getSBTMetadata(),
    sbt.groupPasswordHash(),
    factory.sbtCount(),
  ]);

  const oneClickUrl = `${sessionBaseUrl}?auto=1&sbt=${encodeURIComponent(sbtAddress)}&gp=${encodeURIComponent(encodedGroupPassword)}`;

  const out = {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    sbtAddress,
    afterSbtCount: afterCount.toString(),
    metadata: {
      name: meta.name_,
      symbol: meta.symbol_,
      maxTokens: meta.maxTokens_.toString(),
      mintedTokens: meta.mintedTokens_.toString(),
      admin: meta.admin_,
      mintingEndTime: meta.mintingEndTime_.toString(),
      hasPasswordMint: meta.hasPasswordMint_,
      burnAuth: Number(meta.burnAuth_),
      tokenURI: meta.tokenURI_,
    },
    onchainGroupPasswordHash: onchainGroupHash,
    oneClickLocalUrl: oneClickUrl,
  };
  if (jsonOnly) {
    console.log(JSON.stringify({ dryRun: false, intro, result: out }, null, 2));
  } else {
    console.log(JSON.stringify(out, null, 2));
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
