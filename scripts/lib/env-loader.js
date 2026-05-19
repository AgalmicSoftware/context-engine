'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeSessionWorkerEnv } = require('./session-worker-env');

const ROOT = path.resolve(__dirname, '..', '..');
const LOADER_FLAG = '__CE_E2E_ENV_LOADER_INITIALIZED__';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const toBool = (value) => /^(1|true|yes|y|on)$/i.test(toStr(value).trim());

const stripComment = (rawValue) => {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < rawValue.length; i += 1) {
    const ch = rawValue[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '\'' && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '#' && !inSingle && !inDouble) {
      const prev = i > 0 ? rawValue[i - 1] : '';
      if (!prev || /\s/.test(prev)) {
        return rawValue.slice(0, i).trim();
      }
    }
  }
  return rawValue.trim();
};

const parseValue = (valueRaw) => {
  const value = stripComment(toStr(valueRaw));
  if (!value) return '';

  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    const inner = value.slice(1, -1);
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (value.startsWith('\'') && value.endsWith('\'') && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
};

const parseEnvLine = (line) => {
  const raw = toStr(line).trim();
  if (!raw || raw.startsWith('#')) return null;

  const normalized = raw.startsWith('export ') ? raw.slice(7).trim() : raw;
  const eqIdx = normalized.indexOf('=');
  if (eqIdx <= 0) return null;

  const key = normalized.slice(0, eqIdx).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const valueRaw = normalized.slice(eqIdx + 1);
  return { key, value: parseValue(valueRaw) };
};

const loadEnvFile = (absPath) => {
  let content = '';
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch (_) {
    return { loaded: false, path: absPath, count: 0 };
  }

  let count = 0;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, parsed.key)) continue;
    process.env[parsed.key] = parsed.value;
    count += 1;
  }
  return { loaded: true, path: absPath, count };
};

const resolveEnvCandidates = () => {
  const override = toStr(process.env.E2E_ENV_FILE || process.env.CE_E2E_ENV_FILE).trim();
  if (override) {
    return [path.isAbsolute(override) ? override : path.join(ROOT, override)];
  }
  return [
    path.join(ROOT, '.env.e2e.local'),
    path.join(ROOT, '.env.e2e'),
  ];
};

if (!global[LOADER_FLAG]) {
  global[LOADER_FLAG] = true;
  const candidates = resolveEnvCandidates();
  const debug = toBool(process.env.E2E_ENV_DEBUG || process.env.CE_E2E_ENV_DEBUG);
  let loadedAny = false;

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const result = loadEnvFile(candidate);
    if (result.loaded) {
      loadedAny = true;
      if (debug) {
        console.log(`[e2e-env] loaded ${result.count} variable(s) from ${path.relative(ROOT, result.path)}`);
      }
    }
  }

  if (!loadedAny && debug) {
    const listed = candidates.map((p) => path.relative(ROOT, p)).join(', ');
    console.log(`[e2e-env] no env file loaded (checked: ${listed})`);
  }

  const sessionWorkerEnv = sanitizeSessionWorkerEnv(process.env);

  // Non-fatal prereq warnings (do not edit `.env.e2e.local` automatically).
  const warn = (msg) => {
    try {
      process.stderr.write(`[e2e-env] WARNING: ${msg}\n`);
    } catch (_) {}
  };
  const has = (key) => !!toStr(process.env[key]).trim();
  const targetScript = toStr(process.argv?.[1]).trim();
  const relTarget = targetScript ? path.relative(ROOT, targetScript) : '';

  if (!has('RPC_URL')) {
    warn('RPC_URL is not set. Public RPCs are often rate-limited; set RPC_URL in `.env.e2e.local`/`.env.e2e` for more reliable on-chain runs.');
  }

  if (sessionWorkerEnv.ignored.some((entry) => entry.key === 'WORKER_URL')) {
    warn('WORKER_URL appears to point at the agent bridge worker, so normal session-worker E2E is ignoring it. Set SESSION_WORKER_URL for sessionCorsWorker, or E2E_ALLOW_WORKER_URL_AGENT_BRIDGE=1 to force legacy WORKER_URL usage.');
  }

  if (!has('SESSION_WORKER_URL') && !has('WORKER_URL')) {
    warn('SESSION_WORKER_URL / WORKER_URL is not set. Runners will try on-chain `corsWorkerUrl` and then the client default worker URL, but setting SESSION_WORKER_URL is more deterministic.');
  }

  if (!has('ARWEAVE_JWK_PATH') && !has('ARWEAVE_JWK_JSON') && !has('ARWEAVE_JWK')) {
    warn('ARWEAVE_JWK_PATH is not set. Doc upload/decrypt flows require an Arweave JWK (ARWEAVE_JWK_PATH or ARWEAVE_JWK_JSON).');
  }

  if (/^scripts\/test-session-setup/i.test(relTarget) && !has('CLOUDFLARE_API_TOKEN')) {
    warn('CLOUDFLARE_API_TOKEN is not set. Cloudflare API token is required for deploy-helper worker deploy flows in session-setup runners.');
  }
}
