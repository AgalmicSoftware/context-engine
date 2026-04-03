#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');

const DEFAULT_OUTPUT_DIR = '.keys';
const DEFAULT_OUTPUT_PREFIX = 'evm-wallet';
const BOOLEAN_FLAGS = new Set(['address-only', 'force', 'help']);

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const printUsage = () => {
  console.log([
    'Usage:',
    '  npm run -s evm:key:generate -- --output .keys/faucet-op-sepolia.key',
    '  npm run -s evm:key:inspect -- --input .keys/deployer-op-sepolia.key',
    '  npm run -s evm:key:address -- --input .keys/deployer-op-sepolia.key',
    '',
    'Commands:',
    '  generate   Create a new EVM private key file and print the derived public address.',
    '  inspect    Inspect a private key file or env value and print JSON metadata.',
    '',
    'Flags:',
    '  --input <path>       Path to a file containing a private key',
    '  --output <path>      Output path for generate (default: .keys/evm-wallet-<timestamp>.key)',
    '  --rpc-url <url>      Optional JSON-RPC URL for chainId/balance lookup',
    '  --address-only       Print only the derived address',
    '  --force              Overwrite an existing output file during generate',
    '  --help               Show this help text',
    '',
    'Env fallbacks:',
    '  EVM_PRIVATE_KEY_PATH / PRIVATE_KEY_PATH',
    '  EVM_PRIVATE_KEY / PRIVATE_KEY',
    '  RPC_URL',
  ].join('\n'));
};

const parseArgs = (argv = process.argv.slice(2)) => {
  let command = '';
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = toStr(argv[index]).trim();
    if (!token) continue;

    if (!token.startsWith('--') && !command) {
      command = token;
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2).trim();
    if (!key) throw new Error('Encountered an empty flag.');

    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }

    const nextValue = argv[index + 1];
    if (typeof nextValue !== 'string' || !String(nextValue).trim() || String(nextValue).startsWith('--')) {
      throw new Error(`Flag --${key} requires a value.`);
    }
    flags[key] = String(nextValue).trim();
    index += 1;
  }
  return { command: command || 'inspect', flags };
};

const normalizePrivateKey = (value) => {
  const trimmed = toStr(value).trim();
  if (!trimmed) {
    throw new Error('Private key is empty.');
  }
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  throw new Error('Private key must be 32 bytes of hex (with or without 0x prefix).');
};

const resolveInputPath = ({ inputPath = '', cwd = process.cwd() } = {}) => {
  const raw = toStr(inputPath).trim();
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
};

const formatTimestampUtc = (date = new Date()) => {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const resolveOutputPath = ({
  outputPath = '',
  cwd = process.cwd(),
  now = new Date(),
} = {}) => {
  const raw = toStr(outputPath).trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
  }
  return path.resolve(cwd, DEFAULT_OUTPUT_DIR, `${DEFAULT_OUTPUT_PREFIX}-${formatTimestampUtc(now)}.key`);
};

const writePrivateKeyFile = ({
  privateKey,
  outputPath = '',
  cwd = process.cwd(),
  force = false,
  now = new Date(),
} = {}) => {
  const normalized = normalizePrivateKey(privateKey);
  const absolutePath = resolveOutputPath({ outputPath, cwd, now });
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(absolutePath, `${normalized}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: force ? 'w' : 'wx',
  });
  try {
    fs.chmodSync(absolutePath, 0o600);
  } catch (_) {
    // Best effort on filesystems without chmod semantics.
  }
  return absolutePath;
};

const readPrivateKey = ({ inputPath = '', env = process.env, cwd = process.cwd() } = {}) => {
  const explicitInput = toStr(inputPath).trim();
  const envPath = toStr(env.EVM_PRIVATE_KEY_PATH || env.PRIVATE_KEY_PATH).trim();
  const selectedPath = explicitInput || envPath;
  if (selectedPath) {
    const absolutePath = resolveInputPath({ inputPath: selectedPath, cwd });
    let raw = '';
    try {
      raw = fs.readFileSync(absolutePath, 'utf8');
    } catch (err) {
      throw new Error(`Failed reading private key file (${absolutePath}): ${err?.message || err}`);
    }
    return {
      source: `path:${absolutePath}`,
      inputPath: absolutePath,
      privateKey: normalizePrivateKey(raw),
    };
  }

  const inlineValue = toStr(env.EVM_PRIVATE_KEY || env.PRIVATE_KEY).trim();
  if (inlineValue) {
    return {
      source: env.EVM_PRIVATE_KEY ? 'env:EVM_PRIVATE_KEY' : 'env:PRIVATE_KEY',
      inputPath: '',
      privateKey: normalizePrivateKey(inlineValue),
    };
  }

  throw new Error('Provide --input, EVM_PRIVATE_KEY_PATH / PRIVATE_KEY_PATH, or EVM_PRIVATE_KEY / PRIVATE_KEY.');
};

const inspectPrivateKeyAddress = async ({
  inputPath = '',
  rpcUrl = '',
  env = process.env,
  cwd = process.cwd(),
} = {}) => {
  const loaded = readPrivateKey({ inputPath, env, cwd });
  const wallet = new ethers.Wallet(loaded.privateKey);
  const address = ethers.utils.getAddress(wallet.address);
  const selectedRpcUrl = toStr(rpcUrl || env.RPC_URL).trim();

  let chainId = null;
  let balanceWei = null;
  if (selectedRpcUrl) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(selectedRpcUrl);
      const [network, balance] = await Promise.all([
        provider.getNetwork(),
        provider.getBalance(address),
      ]);
      chainId = network?.chainId ?? null;
      balanceWei = balance?.toString?.() ?? null;
    } catch (_) {
      // Keep the address lookup usable even if RPC is unavailable.
    }
  }

  return {
    source: loaded.source,
    inputPath: loaded.inputPath || null,
    address,
    rpcUrl: selectedRpcUrl || null,
    chainId,
    balanceWei,
  };
};

const generatePrivateKeyAddress = async ({
  outputPath = '',
  cwd = process.cwd(),
  force = false,
  now = new Date(),
  rpcUrl = '',
  env = process.env,
} = {}) => {
  const wallet = ethers.Wallet.createRandom();
  const absolutePath = writePrivateKeyFile({
    privateKey: wallet.privateKey,
    outputPath,
    cwd,
    force,
    now,
  });

  const inspected = await inspectPrivateKeyAddress({
    inputPath: absolutePath,
    rpcUrl,
    env,
    cwd,
  });

  return {
    outputPath: absolutePath,
    address: inspected.address,
    rpcUrl: inspected.rpcUrl,
    chainId: inspected.chainId,
    balanceWei: inspected.balanceWei,
  };
};

async function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command === 'help') {
    printUsage();
    return;
  }

  if (command === 'generate') {
    const result = await generatePrivateKeyAddress({
      outputPath: flags.output || '',
      force: !!flags.force,
      rpcUrl: flags['rpc-url'] || '',
    });
    if (flags['address-only']) {
      console.log(result.address);
      return;
    }
    console.log(JSON.stringify({
      command,
      outputPath: result.outputPath,
      address: result.address,
      rpcUrl: result.rpcUrl,
      chainId: result.chainId,
      balanceWei: result.balanceWei,
    }, null, 2));
    return;
  }

  if (command !== 'inspect') {
    throw new Error(`Unknown command: ${command}`);
  }

  const result = await inspectPrivateKeyAddress({
    inputPath: flags.input || '',
    rpcUrl: flags['rpc-url'] || '',
  });

  if (flags['address-only']) {
    console.log(result.address);
    return;
  }

  console.log(JSON.stringify({
    command,
    source: result.source,
    inputPath: result.inputPath,
    address: result.address,
    rpcUrl: result.rpcUrl,
    chainId: result.chainId,
    balanceWei: result.balanceWei,
  }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_PREFIX,
  formatTimestampUtc,
  generatePrivateKeyAddress,
  inspectPrivateKeyAddress,
  normalizePrivateKey,
  parseArgs,
  readPrivateKey,
  resolveInputPath,
  resolveOutputPath,
  writePrivateKeyFile,
};
