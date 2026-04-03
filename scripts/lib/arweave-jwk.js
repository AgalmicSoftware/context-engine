'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Arweave = require('arweave');

const DEFAULT_ARWEAVE_CLIENT_OPTIONS = Object.freeze({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 20000,
  logging: false,
});

const DEFAULT_OUTPUT_DIR = '.keys';
const DEFAULT_OUTPUT_PREFIX = 'arweave-wallet';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const createArweaveClient = (options = {}) => Arweave.init({
  ...DEFAULT_ARWEAVE_CLIENT_OPTIONS,
  ...(options && typeof options === 'object' ? options : {}),
});

const parseArweaveJwkJson = (raw, { sourceLabel = 'input' } = {}) => {
  const text = toStr(raw).trim();
  if (!text) {
    throw new Error(`Missing Arweave JWK JSON from ${sourceLabel}.`);
  }

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid Arweave JWK JSON from ${sourceLabel}: ${err?.message || err}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid Arweave JWK JSON from ${sourceLabel}: expected a JSON object.`);
  }

  return parsed;
};

const resolveInputPath = ({ inputPath = '', cwd = process.cwd() } = {}) => {
  const raw = toStr(inputPath).trim();
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
};

const readArweaveJwkFromFile = ({ inputPath = '', cwd = process.cwd() } = {}) => {
  const absolutePath = resolveInputPath({ inputPath, cwd });
  if (!absolutePath) {
    throw new Error('Arweave JWK path is required.');
  }

  let raw = '';
  try {
    raw = fs.readFileSync(absolutePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed reading Arweave JWK path (${absolutePath}): ${err?.message || err}`);
  }

  return {
    jwk: parseArweaveJwkJson(raw, { sourceLabel: absolutePath }),
    source: `path:${absolutePath}`,
    inputPath: absolutePath,
  };
};

const readArweaveJwkFromEnv = ({ env = process.env, cwd = process.cwd() } = {}) => {
  const envPath = toStr(env?.ARWEAVE_JWK_PATH).trim();
  if (envPath) {
    return readArweaveJwkFromFile({ inputPath: envPath, cwd });
  }

  const inlineJson = toStr(env?.ARWEAVE_JWK_JSON).trim();
  if (inlineJson) {
    return {
      jwk: parseArweaveJwkJson(inlineJson, { sourceLabel: 'ARWEAVE_JWK_JSON' }),
      source: 'env:ARWEAVE_JWK_JSON',
      inputPath: '',
    };
  }

  const inlineLegacy = toStr(env?.ARWEAVE_JWK).trim();
  if (inlineLegacy) {
    return {
      jwk: parseArweaveJwkJson(inlineLegacy, { sourceLabel: 'ARWEAVE_JWK' }),
      source: 'env:ARWEAVE_JWK',
      inputPath: '',
    };
  }

  throw new Error('ARWEAVE_JWK_PATH (or ARWEAVE_JWK_JSON/ARWEAVE_JWK) is required.');
};

const loadArweaveJwk = ({ inputPath = '', env = process.env, cwd = process.cwd() } = {}) => {
  const explicitPath = toStr(inputPath).trim();
  if (explicitPath) {
    return readArweaveJwkFromFile({ inputPath: explicitPath, cwd });
  }
  return readArweaveJwkFromEnv({ env, cwd });
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
  return path.resolve(cwd, DEFAULT_OUTPUT_DIR, `${DEFAULT_OUTPUT_PREFIX}-${formatTimestampUtc(now)}.jwk.json`);
};

const writeArweaveJwkFile = ({
  jwk,
  outputPath = '',
  cwd = process.cwd(),
  force = false,
  now = new Date(),
} = {}) => {
  const absolutePath = resolveOutputPath({ outputPath, cwd, now });
  const parentDir = path.dirname(absolutePath);
  fs.mkdirSync(parentDir, { recursive: true, mode: 0o700 });
  const serialized = `${JSON.stringify(jwk, null, 2)}\n`;
  fs.writeFileSync(absolutePath, serialized, {
    encoding: 'utf8',
    mode: 0o600,
    flag: force ? 'w' : 'wx',
  });
  try {
    fs.chmodSync(absolutePath, 0o600);
  } catch (_) {
    // Best effort on platforms/filesystems that do not support chmod semantics.
  }
  return absolutePath;
};

const normalizeExpectedAddress = (value) => toStr(value).trim();

const deriveArweaveAddress = async (jwk, { client } = {}) => {
  const arweave = client || createArweaveClient();
  const address = await arweave.wallets.jwkToAddress(jwk);
  const owner = toStr(jwk?.n).trim();
  let ownerAddress = '';
  let ownerToAddressMatches = null;

  if (owner) {
    ownerAddress = await arweave.wallets.ownerToAddress(owner);
    ownerToAddressMatches = ownerAddress === address;
    if (!ownerToAddressMatches) {
      throw new Error('Derived address mismatch between jwkToAddress and ownerToAddress.');
    }
  }

  return {
    address,
    owner,
    ownerAddress,
    ownerToAddressMatches,
  };
};

const inspectArweaveJwk = async ({
  inputPath = '',
  env = process.env,
  cwd = process.cwd(),
  expectedAddress = '',
  client,
} = {}) => {
  const loaded = loadArweaveJwk({ inputPath, env, cwd });
  const derived = await deriveArweaveAddress(loaded.jwk, { client });
  const normalizedExpected = normalizeExpectedAddress(expectedAddress);
  const matchesExpected = normalizedExpected ? derived.address === normalizedExpected : null;

  return {
    source: loaded.source,
    inputPath: loaded.inputPath,
    address: derived.address,
    owner: derived.owner || null,
    ownerAddress: derived.ownerAddress || null,
    ownerToAddressMatches: derived.ownerToAddressMatches,
    expectedAddress: normalizedExpected || null,
    matchesExpected,
  };
};

const generateArweaveJwk = async ({
  outputPath = '',
  cwd = process.cwd(),
  force = false,
  now = new Date(),
  client,
} = {}) => {
  const arweave = client || createArweaveClient();
  const jwk = await arweave.wallets.generate();
  const derived = await deriveArweaveAddress(jwk, { client: arweave });
  const absolutePath = writeArweaveJwkFile({
    jwk,
    outputPath,
    cwd,
    force,
    now,
  });

  return {
    outputPath: absolutePath,
    address: derived.address,
    owner: derived.owner || null,
    ownerAddress: derived.ownerAddress || null,
    ownerToAddressMatches: derived.ownerToAddressMatches,
  };
};

module.exports = {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_PREFIX,
  createArweaveClient,
  deriveArweaveAddress,
  formatTimestampUtc,
  generateArweaveJwk,
  inspectArweaveJwk,
  loadArweaveJwk,
  parseArweaveJwkJson,
  readArweaveJwkFromEnv,
  readArweaveJwkFromFile,
  resolveInputPath,
  resolveOutputPath,
  writeArweaveJwkFile,
};
