import os from 'node:os';
import path from 'node:path';

export const DEFAULT_APP_ORIGIN = 'https://contextengine.sh';
// Web origins the agent will sign in as. Session Workers trust these by default.
export const KNOWN_APP_ORIGINS = Object.freeze([
  'https://contextengine.sh',
  'https://www.contextengine.sh',
  'https://contextengine.xyz',
  'https://www.contextengine.xyz',
]);
const LOCAL_APP_ORIGINS = Object.freeze(['http://localhost:3000', 'http://127.0.0.1:3000']);

const SETTINGS = Object.freeze({
  CE_MCP_STATE_DIR: 'Directory holding this agent’s key and joined sessions.',
  CE_MCP_DISPLAY_NAME: 'Name shown beside this agent’s answers in session reports.',
  CE_MCP_MODEL_ID: 'Self-reported model identifier recorded with each answer.',
  CE_MCP_PLATFORM: 'Self-reported agent platform or harness recorded with each answer.',
  CE_MCP_APP_ORIGIN: 'An additional Context Engine web origin the agent may sign in as.',
  CE_MCP_RPC_URL: 'JSON-RPC endpoint for registry participation and SBT claims, overriding the public default.',
  CE_MCP_ALLOW_LOCAL_WORKERS: 'Set to 1 to allow http://localhost Workers and a local chain during development.',
});

const MAX_LABEL_LENGTH = 80;

const trim = (value) => String(value ?? '').trim();

export const normalizeLabel = (value, field) => {
  const text = trim(value).replace(/\s+/g, ' ');
  if (text.length > MAX_LABEL_LENGTH) throw new Error(`${field} must be ${MAX_LABEL_LENGTH} characters or fewer.`);
  return text;
};

export const normalizeHttpOrigin = (value, field) => {
  const text = trim(value);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${field} must be an http(s) origin.`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${field} must be an http(s) origin.`);
  }
  return parsed.origin;
};

const isLocalUrl = (url) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

const normalizeRpcUrl = (value, allowLocal) => {
  const text = trim(value);
  if (!text) return '';
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('CE_MCP_RPC_URL must be an https URL.');
  }
  // Claim passwords travel to the RPC in preflight calls, so require TLS.
  if (parsed.protocol !== 'https:' && !(allowLocal && parsed.protocol === 'http:' && isLocalUrl(parsed))) {
    throw new Error('CE_MCP_RPC_URL must be an https URL.');
  }
  return parsed.toString();
};

/** Reads and validates CE_MCP_* settings; unknown CE_MCP_* names stop startup. */
export const readConfig = (env = process.env) => {
  const unknown = Object.keys(env).filter((key) => key.startsWith('CE_MCP_') && !(key in SETTINGS));
  if (unknown.length) {
    throw new Error(`Unknown setting ${unknown.sort().join(', ')}. Known settings: ${Object.keys(SETTINGS).join(', ')}.`);
  }
  const stateDir = trim(env.CE_MCP_STATE_DIR) || path.join(os.homedir(), '.context-engine-mcp');
  if (!path.isAbsolute(stateDir)) throw new Error('CE_MCP_STATE_DIR must be an absolute path.');
  const allowLocal = trim(env.CE_MCP_ALLOW_LOCAL_WORKERS);
  if (allowLocal && !['0', '1'].includes(allowLocal)) throw new Error('CE_MCP_ALLOW_LOCAL_WORKERS must be 0 or 1.');
  const allowLocalWorkers = allowLocal === '1';
  const appOrigin = trim(env.CE_MCP_APP_ORIGIN)
    ? normalizeHttpOrigin(env.CE_MCP_APP_ORIGIN, 'CE_MCP_APP_ORIGIN')
    : DEFAULT_APP_ORIGIN;
  return {
    stateDir,
    profile: {
      displayName: normalizeLabel(env.CE_MCP_DISPLAY_NAME, 'CE_MCP_DISPLAY_NAME'),
      modelId: normalizeLabel(env.CE_MCP_MODEL_ID, 'CE_MCP_MODEL_ID'),
      platform: normalizeLabel(env.CE_MCP_PLATFORM, 'CE_MCP_PLATFORM'),
    },
    appOrigin,
    // The agent signs in only as these origins, whatever a link or Worker suggests.
    trustedAppOrigins: [...new Set([appOrigin, ...KNOWN_APP_ORIGINS, ...(allowLocalWorkers ? LOCAL_APP_ORIGINS : [])])],
    rpcUrl: normalizeRpcUrl(env.CE_MCP_RPC_URL, allowLocalWorkers),
    allowLocalWorkers,
  };
};
