import rpcDefaults from '../../variables/rpcDefaults.js';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import {
  buildCloudflareTokenTemplatePermissions,
  CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION,
} from '../Sessions/cloudflareTokenTemplate.js';

export const DEFAULT_AGENT_BRIDGE_WORKER_NAME = 'ce-agent-bridge-worker';
export const DEFAULT_AGENT_BRIDGE_CHAIN_ID = Number(DEFAULT_CHAIN_ID || 0) || 11155420;
export const DEFAULT_AGENT_BRIDGE_RPC_URL = rpcDefaults.getPathRpcUrl(DEFAULT_AGENT_BRIDGE_CHAIN_ID);

export const AGENT_BRIDGE_SECRET_NAMES = Object.freeze([
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'DEMO_SIGNER_ROOT_SECRET',
]);

export const AGENT_BRIDGE_REQUIRED_VAR_NAMES = Object.freeze([
  'TELEGRAM_BOT_USERNAME',
  'AGENT_BRIDGE_PUBLIC_URL',
  'CE_SESSION_WORKER_BASE_URL',
  'DEFAULT_CHAIN_ID',
  'DEFAULT_RPC_URL',
]);

type UnknownRecord = Record<string, unknown>;
type Permission = { key?: unknown; type?: unknown };
type CryptoLike = {
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
};

const toStr = (value: unknown): string => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeHttpsBaseUrl = (value: unknown): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch (_) {
    return '';
  }
};

const readNested = (source: unknown, path: string[]): unknown => {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isObj(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
};

export const normalizeAgentBridgeWorkerName = (value: unknown = ''): string => {
  const normalized = toStr(value || DEFAULT_AGENT_BRIDGE_WORKER_NAME)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return normalized || DEFAULT_AGENT_BRIDGE_WORKER_NAME;
};

export const normalizeWorkersSubdomain = (value: unknown = ''): string => (
  toStr(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
);

export const deriveWorkersDevPublicUrl = ({
  workerName = DEFAULT_AGENT_BRIDGE_WORKER_NAME,
  workersSubdomain = '',
}: {
  workerName?: unknown;
  workersSubdomain?: unknown;
} = {}): string => {
  const normalizedName = normalizeAgentBridgeWorkerName(workerName);
  const normalizedSubdomain = normalizeWorkersSubdomain(workersSubdomain) || '<workers-subdomain>';
  return `https://${normalizedName}.${normalizedSubdomain}.workers.dev`;
};

export const generateHighEntropySecret = ({
  byteLength = 32,
  cryptoImpl,
}: {
  byteLength?: number;
  cryptoImpl?: CryptoLike | null;
} = {}): string => {
  const length = Math.max(32, Math.floor(Number(byteLength || 0) || 32));
  const runtimeCrypto = cryptoImpl || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
  if (!runtimeCrypto || typeof runtimeCrypto.getRandomValues !== 'function') {
    throw new Error('Secure random secret generation requires crypto.getRandomValues.');
  }
  const bytes = new Uint8Array(length);
  runtimeCrypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const buildGeneratedAgentBridgeSecrets = (options: {
  cryptoImpl?: CryptoLike | null;
} = {}): Record<'TELEGRAM_WEBHOOK_SECRET' | 'DEMO_SIGNER_ROOT_SECRET', string> => ({
  TELEGRAM_WEBHOOK_SECRET: generateHighEntropySecret(options),
  DEMO_SIGNER_ROOT_SECRET: generateHighEntropySecret(options),
});

export const redactSecretPresence = (value: unknown): '[set]' | '[missing]' => (
  toStr(value).trim() ? '[set]' : '[missing]'
);

export const normalizeCloudflareAccounts = (input: unknown): Array<{ id: string; name: string }> => {
  const rawAccounts = Array.isArray(input)
    ? input
    : (Array.isArray((input as { result?: unknown })?.result) ? (input as { result: unknown[] }).result : []);
  return rawAccounts
    .map((entry) => {
      const account = isObj(entry) ? entry : {};
      return {
        id: toStr(account.id).trim(),
        name: toStr(account.name).trim(),
      };
    })
    .filter((entry) => !!entry.id);
};

export const deriveSingleCloudflareAccount = (input: unknown): {
  ok: boolean;
  accountId: string;
  accountName: string;
  blocker: string;
  accountCount: number;
} => {
  const accounts = normalizeCloudflareAccounts(input);
  if (accounts.length === 1) {
    return {
      ok: true,
      accountId: accounts[0].id,
      accountName: accounts[0].name,
      blocker: '',
      accountCount: 1,
    };
  }
  if (accounts.length > 1) {
    return {
      ok: false,
      accountId: '',
      accountName: '',
      accountCount: accounts.length,
      blocker: 'Cloudflare token can see multiple accounts. Account selection is not implemented yet; create a token scoped to one account before running setup.',
    };
  }
  return {
    ok: false,
    accountId: '',
    accountName: '',
    accountCount: 0,
    blocker: 'No Cloudflare account was visible to this token.',
  };
};

export const validateAgentBridgeTokenScopes = ({
  permissions = [],
  includeWorkersDevSubdomainSetup = false,
  includeDocStorage = false,
}: {
  permissions?: Permission[];
  includeWorkersDevSubdomainSetup?: boolean;
  includeDocStorage?: boolean;
} = {}) => {
  const required = buildCloudflareTokenTemplatePermissions({ includeDocStorage });
  const normalized = new Set((Array.isArray(permissions) ? permissions : [])
    .map((permission) => `${toStr(permission.key).trim()}:${toStr(permission.type).trim()}`));
  const missing = required.filter((permission) => !normalized.has(`${permission.key}:${permission.type}`));
  const optionalMissing = includeWorkersDevSubdomainSetup && !normalized.has(`${CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION.key}:${CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION.type}`)
    ? [CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION]
    : [];
  return {
    ok: missing.length === 0 && optionalMissing.length === 0,
    missing,
    optionalMissing,
    accountSettingsEditRequired: includeWorkersDevSubdomainSetup === true,
  };
};

export const resolveSessionWorkerBaseUrl = (sessionConfig: unknown): string => {
  const directCandidates = [
    readNested(sessionConfig, ['corsWorkerUrl']),
    readNested(sessionConfig, ['corsWorkerURL']),
    readNested(sessionConfig, ['workerUrl']),
    readNested(sessionConfig, ['workerURL']),
    readNested(sessionConfig, ['sessionWorkerUrl']),
    readNested(sessionConfig, ['worker', 'corsWorkerUrl']),
    readNested(sessionConfig, ['workerConfig', 'corsWorkerUrl']),
    readNested(sessionConfig, ['__workerConfigReplica', 'corsWorkerUrl']),
    readNested(sessionConfig, ['__workerConfigReplica', 'config', 'corsWorkerUrl']),
  ];
  for (const candidate of directCandidates) {
    const normalized = normalizeHttpsBaseUrl(candidate);
    if (normalized) return normalized;
  }
  return '';
};

export const resolveSessionDefaultChainId = (sessionConfig: unknown): number => {
  const candidates = [
    readNested(sessionConfig, ['networkChainId']),
    readNested(sessionConfig, ['chainId']),
    readNested(sessionConfig, ['__registry', 'chainId']),
    readNested(sessionConfig, ['__registry', 'registryChainId']),
  ];
  for (const candidate of candidates) {
    const parsed = Number(candidate || 0);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return DEFAULT_AGENT_BRIDGE_CHAIN_ID;
};

export const resolveSessionDefaultRpcUrl = (sessionConfig: unknown): string => {
  const chainId = resolveSessionDefaultChainId(sessionConfig);
  const pathRpc = rpcDefaults.getPathRpcUrl(chainId);
  if (pathRpc) return pathRpc;
  const candidates = [
    readNested(sessionConfig, ['rpc', 'providers', 'path', 'rpcUrl']),
    readNested(sessionConfig, ['rpcEndpoint']),
    readNested(sessionConfig, ['rpcUrl']),
  ];
  for (const candidate of candidates) {
    const raw = toStr(candidate).trim();
    if (raw) return raw;
  }
  return DEFAULT_AGENT_BRIDGE_RPC_URL;
};

export const resolveTelegramOnlySessionFlag = (sessionConfig: unknown): boolean => (
  readNested(sessionConfig, ['telegramOnly']) === true ||
  readNested(sessionConfig, ['telegram_only']) === true ||
  toStr(readNested(sessionConfig, ['sessionMode'])).trim().toLowerCase() === 'telegram_only' ||
  toStr(readNested(sessionConfig, ['telegramMode'])).trim().toLowerCase() === 'telegram_only' ||
  readNested(sessionConfig, ['telegram', 'only']) === true ||
  toStr(readNested(sessionConfig, ['telegram', 'mode'])).trim().toLowerCase() === 'telegram_only'
);

export const resolveSessionDisplayName = (sessionConfig: unknown, fallbackSlug = ''): string => (
  toStr(
    readNested(sessionConfig, ['sessionName']) ||
    readNested(sessionConfig, ['name']) ||
    fallbackSlug ||
    'General'
  ).trim()
);

export const normalizeAdditionalRpcUrl = (value: unknown, defaultRpcUrl = ''): string => {
  const normalized = normalizeHttpsBaseUrl(value);
  if (!normalized) return '';
  return normalized === normalizeHttpsBaseUrl(defaultRpcUrl) ? '' : normalized;
};

export const buildAgentBridgeTokenTemplateUrl = ({
  sessionSlug = '',
  includeWorkersDevSubdomainSetup = false,
  includeDocStorage = false,
  now = new Date(),
}: {
  sessionSlug?: unknown;
  includeWorkersDevSubdomainSetup?: boolean;
  includeDocStorage?: boolean;
  now?: Date;
} = {}): string => {
  const params = new URLSearchParams();
  const slug = toStr(sessionSlug).trim() || 'general';
  const datePart = now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  params.set('permissionGroupKeys', JSON.stringify(buildCloudflareTokenTemplatePermissions({
    includeWorkersDevSubdomainSetup,
    includeDocStorage,
  })));
  params.set('accountId', '*');
  params.set('zoneId', 'all');
  params.set('name', `contextEngine-agentBridgeWorker-${slug}-${datePart}`);
  return `https://dash.cloudflare.com/profile/api-tokens?${params.toString()}`;
};

export const buildTelegramDemoSetupPlan = ({
  sessionSlug = '',
  sessionWorkerBaseUrl = '',
  telegramBotToken = '',
  telegramBotUsername = '',
  cloudflareApiToken = '',
  workerName = DEFAULT_AGENT_BRIDGE_WORKER_NAME,
  workersSubdomain = '',
  defaultChainId = DEFAULT_AGENT_BRIDGE_CHAIN_ID,
  defaultRpcUrl = DEFAULT_AGENT_BRIDGE_RPC_URL,
  additionalRpcUrl = '',
  generatedSecrets = {},
  sessionConfig = {},
}: {
  sessionSlug?: unknown;
  sessionWorkerBaseUrl?: unknown;
  telegramBotToken?: unknown;
  telegramBotUsername?: unknown;
  cloudflareApiToken?: unknown;
  workerName?: unknown;
  workersSubdomain?: unknown;
  defaultChainId?: unknown;
  defaultRpcUrl?: unknown;
  additionalRpcUrl?: unknown;
  generatedSecrets?: UnknownRecord;
  sessionConfig?: unknown;
} = {}) => {
  const normalizedWorkerName = normalizeAgentBridgeWorkerName(workerName);
  const normalizedSubdomain = normalizeWorkersSubdomain(workersSubdomain);
  const publicUrl = deriveWorkersDevPublicUrl({
    workerName: normalizedWorkerName,
    workersSubdomain: normalizedSubdomain,
  });
  const rpcUrl = toStr(defaultRpcUrl).trim() || DEFAULT_AGENT_BRIDGE_RPC_URL;
  const extraRpcUrl = normalizeAdditionalRpcUrl(additionalRpcUrl, rpcUrl);
  const vars: UnknownRecord = {
    TELEGRAM_BOT_USERNAME: toStr(telegramBotUsername).trim(),
    AGENT_BRIDGE_PUBLIC_URL: publicUrl,
    CE_SESSION_WORKER_BASE_URL: normalizeHttpsBaseUrl(sessionWorkerBaseUrl),
    DEFAULT_CHAIN_ID: String(Number(defaultChainId || 0) || DEFAULT_AGENT_BRIDGE_CHAIN_ID),
    DEFAULT_RPC_URL: rpcUrl,
    TELEGRAM_BRIDGE_ENABLED: 'true',
    BROADCAST_ENABLED: 'false',
    AGENT_AI_PROVIDER: 'ce_session_policy',
  };
  const slug = toStr(sessionSlug).trim() || 'general';
  const telegramOnly = resolveTelegramOnlySessionFlag(sessionConfig);
  vars.AGENT_BRIDGE_SESSION_POLICY_JSON = JSON.stringify({
    type: 'agent_bridge_session_policy',
    defaultSessionSlug: slug,
    riskCeiling: 'submit',
    allowQuestionGeneration: false,
    allowGenerateQuestion: false,
    sessions: [{
      sessionSlug: slug,
      sessionName: resolveSessionDisplayName(sessionConfig, slug),
      default: true,
      telegramOnly,
      sessionMode: telegramOnly ? 'telegram_only' : 'standard',
      telegramBridgeEnabled: telegramOnly,
      managedAccountSubmitAllowed: telegramOnly,
      sponsoredAiAllowed: telegramOnly,
      sponsoredRpcAllowed: telegramOnly,
      sponsoredFaucetAllowed: telegramOnly,
      docLibraryEnabled: false,
      sessionWorkerUrl: normalizeHttpsBaseUrl(sessionWorkerBaseUrl),
      chainId: String(Number(defaultChainId || 0) || DEFAULT_AGENT_BRIDGE_CHAIN_ID),
      storageProfile: isObj(readNested(sessionConfig, ['storageProfile']))
        ? readNested(sessionConfig, ['storageProfile'])
        : null,
    }],
  });
  if (extraRpcUrl) vars.ADDITIONAL_RPC_URL = extraRpcUrl;
  return {
    sessionSlug: slug,
    workerName: normalizedWorkerName,
    accountId: '<derived-from-cloudflare-token>',
    accountLookup: {
      method: 'GET',
      path: '/accounts?per_page=2',
      blocker: 'If the token can see multiple accounts, setup blocks because account selection is not implemented yet.',
    },
    publicUrl,
    webhookUrl: `${publicUrl}/telegram/webhook`,
    vars,
    secrets: {
      TELEGRAM_BOT_TOKEN: redactSecretPresence(telegramBotToken),
      TELEGRAM_WEBHOOK_SECRET: redactSecretPresence(generatedSecrets.TELEGRAM_WEBHOOK_SECRET),
      DEMO_SIGNER_ROOT_SECRET: redactSecretPresence(generatedSecrets.DEMO_SIGNER_ROOT_SECRET),
    },
    resources: {
      kv: 'AGENT_ACTION_KV for opaque action IDs and webhook replay cache',
      r2: 'AGENT_DOCS_R2 for demo artifacts/docs only when doc storage is explicitly enabled',
      d1: 'AGENT_DOCS_D1 for event, audit, and index records only when doc storage is explicitly enabled',
      durableObject: 'MANAGED_DEMO_SIGNER for managed demo signer/runtime',
    },
    cloudflareToken: redactSecretPresence(cloudflareApiToken),
  };
};

export const validateTelegramDemoSetup = (plan: ReturnType<typeof buildTelegramDemoSetupPlan>) => {
  const missing: string[] = [];
  if (plan.cloudflareToken !== '[set]') missing.push('CLOUDFLARE_API_TOKEN');
  for (const name of AGENT_BRIDGE_REQUIRED_VAR_NAMES) {
    if (!toStr(plan.vars?.[name]).trim()) missing.push(name);
  }
  for (const [name, state] of Object.entries(plan.secrets || {})) {
    if (state !== '[set]') missing.push(name);
  }
  if (toStr(plan.publicUrl).includes('<workers-subdomain>')) {
    missing.push('CLOUDFLARE_WORKERS_SUBDOMAIN');
  }
  const policy = isObj(plan.vars?.AGENT_BRIDGE_SESSION_POLICY_JSON)
    ? plan.vars?.AGENT_BRIDGE_SESSION_POLICY_JSON
    : (() => {
      try {
        return JSON.parse(toStr(plan.vars?.AGENT_BRIDGE_SESSION_POLICY_JSON));
      } catch (_) {
        return null;
      }
    })();
  const policySessions = Array.isArray(policy?.sessions) ? policy.sessions : [];
  if (!policySessions.some((session) => session?.telegramOnly === true && session?.telegramBridgeEnabled === true)) {
    missing.push('telegramOnly session flag');
  }
  return {
    ok: missing.length === 0,
    missing,
  };
};

export const buildTelegramDemoSetupAuditEvent = ({
  event = 'telegram-demo-setup-plan',
  plan,
}: {
  event?: string;
  plan: ReturnType<typeof buildTelegramDemoSetupPlan>;
}) => ({
  event,
  workerName: plan.workerName,
  publicUrl: plan.publicUrl,
  webhookUrl: plan.webhookUrl,
  accountId: plan.accountId,
  vars: plan.vars,
  secrets: plan.secrets,
  cloudflareToken: plan.cloudflareToken,
});
