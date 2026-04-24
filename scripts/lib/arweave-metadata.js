'use strict';

const fs = require('fs');
const path = require('path');
const Arweave = require('arweave');

const ARWEAVE_TX_ID_RE = /^[a-z0-9_-]{43}$/i;

const CANONICAL_ARWEAVE_HOSTS = new Set([
  'ar-io.dev',
  'arweave.net',
  'arweave.dev',
  'arweave.app',
  'ar.io',
  'ar-io.net',
  'irys.xyz',
  'gateway.irys.xyz',
]);

const normalizeHost = (rawHost) => {
  const host = String(rawHost || '').trim().toLowerCase();
  if (!host) return '';
  return host.startsWith('www.') ? host.slice(4) : host;
};

const isAllowedArweaveGatewayHost = (rawHost) => {
  const host = normalizeHost(rawHost);
  if (!host) return false;
  if (CANONICAL_ARWEAVE_HOSTS.has(host)) return true;
  return (
    host.endsWith('.ar-io.dev') ||
    host.endsWith('.arweave.net') ||
    host.endsWith('.arweave.dev') ||
    host.endsWith('.arweave.app') ||
    host.endsWith('.ar.io') ||
    host.endsWith('.ar-io.net') ||
    host.endsWith('.irys.xyz')
  );
};

const parseArweaveTxId = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (ARWEAVE_TX_ID_RE.test(raw)) return raw;
  if (/^ar:\/\//i.test(raw)) {
    const candidate = raw.slice(5).split(/[/?#]/)[0] || '';
    return ARWEAVE_TX_ID_RE.test(candidate) ? candidate : '';
  }
  try {
    const parsed = new URL(raw);
    if (!isAllowedArweaveGatewayHost(parsed.hostname)) return '';
    const candidate = String(parsed.pathname || '').split('/').filter(Boolean).slice(-1)[0] || '';
    return ARWEAVE_TX_ID_RE.test(candidate) ? candidate : '';
  } catch (_) {
    return '';
  }
};

const normalizeRequiredMetadataUri = (value) => {
  const txId = parseArweaveTxId(value);
  return txId ? `ar://${txId}` : '';
};

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const readArweaveJwk = ({ env = process.env, required = false } = {}) => {
  const jwkPathRaw = toStr(env.ARWEAVE_JWK_PATH).trim();
  let raw = '';
  if (jwkPathRaw) {
    const absPath = path.isAbsolute(jwkPathRaw) ? jwkPathRaw : path.resolve(process.cwd(), jwkPathRaw);
    try {
      raw = fs.readFileSync(absPath, 'utf8');
    } catch (err) {
      if (!required) return null;
      throw new Error(`Failed reading ARWEAVE_JWK_PATH (${absPath}): ${err?.message || err}`);
    }
  }
  if (!raw) {
    raw = toStr(env.ARWEAVE_JWK_JSON || env.ARWEAVE_JWK).trim();
  }
  if (!raw) {
    if (!required) return null;
    throw new Error('ARWEAVE_JWK_PATH (or ARWEAVE_JWK_JSON/ARWEAVE_JWK) is required for Arweave uploads.');
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('jwk not object');
    return parsed;
  } catch (err) {
    throw new Error(`Invalid ARWEAVE_JWK JSON: ${err?.message || err}`);
  }
};

const createArweaveClient = ({ env = process.env } = {}) => {
  const protocol = toStr(env.ARWEAVE_PROTOCOL).trim().toLowerCase() || 'https';
  const host = toStr(env.ARWEAVE_HOST).trim() || 'ar-io.dev';
  const portRaw = Number.parseInt(toStr(env.ARWEAVE_PORT).trim(), 10);
  const timeoutRaw = Number.parseInt(toStr(env.ARWEAVE_TIMEOUT_MS).trim(), 10);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : (protocol === 'http' ? 80 : 443);
  const timeout = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 30000;
  return Arweave.init({
    host,
    port,
    protocol,
    timeout,
    logging: false,
  });
};

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeUploadTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags
      .map((entry) => (Array.isArray(entry) ? [toStr(entry[0]).trim(), toStr(entry[1]).trim()] : ['', '']))
      .filter(([key, value]) => !!key && !!value);
  }
  if (!tags || typeof tags !== 'object') return [];
  return Object.entries(tags)
    .map(([key, value]) => [toStr(key).trim(), toStr(value).trim()])
    .filter(([key, value]) => !!key && !!value);
};

const uploadJsonToArweave = async ({ payload, tags = [], env = process.env } = {}) => {
  if (payload == null || (typeof payload !== 'object' && typeof payload !== 'string')) {
    throw new Error('uploadJsonToArweave requires payload (object|string).');
  }

  const jwk = readArweaveJwk({ env, required: true });
  const arweave = createArweaveClient({ env });
  const payloadText = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const tagPairs = normalizeUploadTags(tags);
  const attempts = 3;
  const retryDelayMs = 1200;

  let lastErr = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // Create a fresh transaction per attempt; IDs are signature-derived.
      // Reusing a failed tx can produce ambiguous retries.
      const tx = await arweave.createTransaction(
        { data: Buffer.from(payloadText, 'utf8') },
        jwk,
      );
      tx.addTag('Content-Type', 'application/json');
      for (const [key, value] of tagPairs) tx.addTag(key, value);
      await arweave.transactions.sign(tx, jwk);
      const post = await arweave.transactions.post(tx);
      const status = Number(post?.status || 0);
      if (status === 200 || status === 202) {
        return {
          txId: tx.id,
          uri: `ar://${tx.id}`,
          status,
        };
      }
      const reason = toStr(post?.statusText || '').trim() || `status=${status || 'unknown'}`;
      throw new Error(`Arweave post rejected: ${reason}`);
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts) break;
      // eslint-disable-next-line no-await-in-loop
      await sleep(retryDelayMs);
    }
  }

  throw new Error(
    `Arweave JSON upload failed after ${attempts} attempt(s): ${lastErr?.message || lastErr || 'unknown error'}`,
  );
};

module.exports = {
  createArweaveClient,
  readArweaveJwk,
  uploadJsonToArweave,
  parseArweaveTxId,
  normalizeRequiredMetadataUri,
  isAllowedArweaveGatewayHost,
};
