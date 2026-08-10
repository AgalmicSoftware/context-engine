import rpcDefaults from '../../shared/rpcDefaults.cjs';
import { ethers } from 'ethers';
import {
  buildLitChipotlePolicy,
  buildLitChipotleWrappedPlaintext,
  fingerprintLitChipotlePolicy,
  normalizeChipotleCekHex,
  normalizeChipotleSbtAddresses,
  normalizeLitChipotleMetadataVersion,
} from '../../client/src/utilities/crypto/litChipotlePolicy.js';

const DEFAULT_LIT_API_BASE = 'https://api.chipotle.litprotocol.com';
const CHIPOTLE_API_PREFIX = '/core/v1';
const DEFAULT_PAGE_NUMBER = 0;
const DEFAULT_PAGE_SIZE = 100;
const { getPathRpcUrl, getPublicRpcUrls } = rpcDefaults;
const ethersUtils = ethers?.utils || ethers;

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const toChainId = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeChipotleRpcCandidateList = (value = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(value) ? value : [value]).forEach((entry) => {
    const trimmed = toTrimmedString(entry);
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  });
  return out;
};

const normalizeValidChipotlePkpId = (value = '') => {
  const trimmed = toTrimmedString(value);
  if (!trimmed || trimmed === '0') return '';
  return trimmed;
};

const normalizeChipotleMembershipValue = (value = '') => (
  toTrimmedString(value).toLowerCase()
);

export const normalizeLitChipotleApiBase = (value) => {
  const trimmed = toTrimmedString(value || DEFAULT_LIT_API_BASE).replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_LIT_API_BASE;
  return trimmed.replace(/\/core\/v1$/i, '');
};

const buildChipotleUrl = (apiBase, path) => {
  const normalizedBase = normalizeLitChipotleApiBase(apiBase);
  const normalizedPath = `/${toTrimmedString(path).replace(/^\/+/, '')}`;
  return `${normalizedBase}${CHIPOTLE_API_PREFIX}${normalizedPath}`;
};

const parseJsonIfPossible = (value) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return { message: trimmed };
  }
};

const extractChipotleErrorMessage = (status, body, fallback) => {
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (isObj(body)) {
    const nestedError = toTrimmedString(body.error || body.message || body.detail);
    if (nestedError) return nestedError;
  }
  return `${fallback} (${Number(status || 0) || 500})`;
};

export const fetchChipotleJson = async ({
  apiBase = DEFAULT_LIT_API_BASE,
  apiKey = '',
  path = '',
  method = 'GET',
  body,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch unavailable for Chipotle request.');
  }

  const normalizedApiKey = toTrimmedString(apiKey);
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (normalizedApiKey) {
    headers['X-Api-Key'] = normalizedApiKey;
    headers.Authorization = `Bearer ${normalizedApiKey}`;
  }

  let response;
  try {
    response = await fetchImpl(buildChipotleUrl(apiBase, path), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error(toTrimmedString(error?.message || error) || 'Chipotle request failed.');
  }

  const text = await response.text().catch(() => '');
  const parsed = parseJsonIfPossible(text);
  if (!response.ok) {
    throw new Error(extractChipotleErrorMessage(response.status, parsed, 'Chipotle request failed'));
  }
  if (isObj(parsed) && toTrimmedString(parsed.error || '').trim()) {
    throw new Error(extractChipotleErrorMessage(response.status, parsed, 'Chipotle request failed'));
  }
  return parsed;
};

export const resolveLitChipotleRuntime = ({
  env = {},
  config = {},
  secrets = {},
  body = {},
} = {}) => {
  const litCredentials = isObj(config?.litCredentials) ? config.litCredentials : {};
  const requestBody = isObj(body) ? body : {};
  const envApiKey = toTrimmedString(env?.LIT_USAGE_API_KEY || env?.LIT_ACCOUNT_API_KEY);
  const requestApiKey = toTrimmedString(requestBody.litUsageApiKey || requestBody.apiKey);
  const secretApiKey = toTrimmedString(secrets?.litUsageApiKey);
  const litUsageApiKey = requestApiKey || secretApiKey || envApiKey;
  let apiKeySource = 'missing';
  if (requestApiKey) apiKeySource = 'request';
  else if (secretApiKey) apiKeySource = 'session-secret';
  else if (envApiKey) apiKeySource = 'worker-env';

  return {
    litApiBase: normalizeLitChipotleApiBase(
      requestBody.litApiBase ||
      litCredentials.litApiBase ||
      env?.LIT_API_BASE ||
      DEFAULT_LIT_API_BASE
    ),
    litUsageApiKey,
    apiKeySource,
    litGroupId: toTrimmedString(requestBody.litGroupId || litCredentials.litGroupId),
    litPkpId: toTrimmedString(requestBody.litPkpId || litCredentials.litPkpId),
    litActionCid: toTrimmedString(requestBody.litActionCid || litCredentials.litActionCid),
    customRpcUrl: toTrimmedString(requestBody.customRpcUrl || secrets?.customRpcUrl),
    customRpcKey: toTrimmedString(requestBody.customRpcKey || secrets?.customRpcKey),
  };
};

export const resolveLitChipotleProvisioningRuntime = ({
  env = {},
  config = {},
  secrets = {},
  body = {},
} = {}) => {
  const litCredentials = isObj(config?.litCredentials) ? config.litCredentials : {};
  const requestBody = isObj(body) ? body : {};
  const secretManagementApiKey = toTrimmedString(secrets?.litAccountApiKey);
  const envManagementApiKey = toTrimmedString(env?.LIT_ACCOUNT_API_KEY || env?.LIT_USAGE_API_KEY);
  const litManagementApiKey = secretManagementApiKey || envManagementApiKey;
  const litGroupId = toTrimmedString(requestBody.litGroupId || requestBody.groupId || litCredentials.litGroupId);
  const litGroupName = toTrimmedString(requestBody.litGroupName || requestBody.groupName);
  const resolvedGroupSelector = litGroupId || litGroupName;
  let apiKeySource = 'missing';
  if (secretManagementApiKey) apiKeySource = 'session-secret';
  else if (envManagementApiKey) apiKeySource = 'worker-env';

  return {
    litApiBase: normalizeLitChipotleApiBase(
      requestBody.litApiBase ||
      litCredentials.litApiBase ||
      env?.LIT_API_BASE ||
      DEFAULT_LIT_API_BASE
    ),
    litManagementApiKey,
    apiKeySource,
    litGroupId: resolvedGroupSelector,
    litPkpId: toTrimmedString(requestBody.litPkpId || requestBody.pkpId || litCredentials.litPkpId),
    litActionCid: toTrimmedString(requestBody.litActionCid || litCredentials.litActionCid),
  };
};

const ensureChipotleApiKey = (runtime = {}) => {
  if (!toTrimmedString(runtime?.litUsageApiKey)) {
    throw new Error('Lit API key not configured.');
  }
};

const ensureChipotleManagementApiKey = (runtime = {}) => {
  if (!toTrimmedString(runtime?.litManagementApiKey)) {
    throw new Error('Lit account API key not configured.');
  }
};

const buildPagedPath = (path, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const trimmed = toTrimmedString(value);
    if (!trimmed) return;
    query.set(key, trimmed);
  });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
};

const listGroupWallets = async ({ runtime, fetchImpl } = {}) => {
  if (!toTrimmedString(runtime?.litGroupId)) return [];
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litUsageApiKey,
    path: buildPagedPath('/list_wallets_in_group', {
      group_id: runtime.litGroupId,
      page_number: DEFAULT_PAGE_NUMBER,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    fetchImpl,
  });
  return Array.isArray(response) ? response : [];
};

const listActions = async ({ runtime, fetchImpl, groupId } = {}) => {
  const rawGroupId = groupId === null
    ? ''
    : groupId === undefined
      ? runtime?.litGroupId
      : groupId;
  const resolvedGroupId = toTrimmedString(rawGroupId);
  if (groupId !== undefined && groupId !== null && !resolvedGroupId && groupId !== '') return [];
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litUsageApiKey || runtime.litManagementApiKey,
    path: buildPagedPath('/list_actions', {
      ...(resolvedGroupId ? { group_id: resolvedGroupId } : {}),
      page_number: DEFAULT_PAGE_NUMBER,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    fetchImpl,
  });
  return Array.isArray(response) ? response : [];
};

const listGroupActions = async ({ runtime, fetchImpl } = {}) => {
  if (!toTrimmedString(runtime?.litGroupId)) return [];
  return listActions({ runtime, fetchImpl, groupId: runtime.litGroupId });
};

const listGroups = async ({ runtime, fetchImpl } = {}) => {
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: buildPagedPath('/list_groups', {
      page_number: DEFAULT_PAGE_NUMBER,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    fetchImpl,
  });
  return Array.isArray(response) ? response : [];
};

const listWallets = async ({ runtime, fetchImpl } = {}) => {
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: buildPagedPath('/list_wallets', {
      page_number: DEFAULT_PAGE_NUMBER,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    fetchImpl,
  });
  return Array.isArray(response) ? response : [];
};

const resolveActionCidMembership = async ({ runtime, actions = [], fetchImpl } = {}) => {
  const configuredCid = toTrimmedString(runtime?.litActionCid);
  if (!configuredCid) return null;
  if (!Array.isArray(actions)) return null;
  const configuredCidLower = configuredCid.toLowerCase();
  const configuredActionId = ethersUtils.keccak256(
    ethersUtils.toUtf8Bytes(configuredCid)
  ).toLowerCase();
  return actions.some((action) => {
    const actionId = normalizeChipotleMembershipValue(action?.id);
    const actionCid = normalizeChipotleMembershipValue(
      action?.action_ipfs_cid || action?.ipfs_cid || action?.cid
    );
    return actionId === configuredActionId || actionId === configuredCidLower || actionCid === configuredCidLower;
  });
};

const createStatusWarning = (step, error) => ({
  step: toTrimmedString(step),
  message: toTrimmedString(error?.message || error) || 'Unknown Chipotle status error.',
});

export const readLitChipotleStatus = async ({
  runtime = {},
  fetchImpl = globalThis.fetch,
} = {}) => {
  ensureChipotleApiKey(runtime);

  const warnings = [];

  const balance = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litUsageApiKey,
    path: '/billing/balance',
    fetchImpl,
  }).catch((error) => {
    warnings.push(createStatusWarning('billing.balance', error));
    return null;
  });

  const clientConfig = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    path: '/get_lit_action_client_config',
    fetchImpl,
  }).catch((error) => {
    warnings.push(createStatusWarning('client.config', error));
    return null;
  });

  const wallets = await listGroupWallets({ runtime, fetchImpl }).catch((error) => {
    warnings.push(createStatusWarning('group.wallets', error));
    return null;
  });
  const actions = await listGroupActions({ runtime, fetchImpl }).catch((error) => {
    warnings.push(createStatusWarning('group.actions', error));
    return null;
  });
  const groupHasConfiguredPkp = runtime.litPkpId && Array.isArray(wallets)
    ? wallets.some((wallet) => {
      const configuredPkp = normalizeChipotleMembershipValue(runtime.litPkpId);
      return [
        normalizeChipotleMembershipValue(normalizeValidChipotlePkpId(wallet?.id)),
        normalizeChipotleMembershipValue(wallet?.wallet_address),
      ].includes(configuredPkp);
    })
    : null;
  const groupHasConfiguredAction = await resolveActionCidMembership({
    runtime,
    actions,
    fetchImpl,
  }).catch((error) => {
    warnings.push(createStatusWarning('group.action-membership', error));
    return null;
  });

  return {
    ok: true,
    apiBase: runtime.litApiBase,
    apiKeySource: runtime.apiKeySource,
    litGroupId: runtime.litGroupId,
    litPkpId: runtime.litPkpId,
    litActionCid: runtime.litActionCid,
    balance,
    clientConfig,
    warnings,
    groupSummary: {
      walletCount: Array.isArray(wallets) ? wallets.length : null,
      actionCount: Array.isArray(actions) ? actions.length : null,
      hasConfiguredPkp: groupHasConfiguredPkp,
      hasConfiguredAction: groupHasConfiguredAction,
    },
    ready: (
      !!toTrimmedString(runtime.litUsageApiKey) &&
      (groupHasConfiguredPkp !== false) &&
      (groupHasConfiguredAction !== false)
    ),
  };
};

const deriveLitActionCid = async ({ runtime = {}, actionCode = '', fetchImpl = globalThis.fetch } = {}) => {
  const normalizedCode = toTrimmedString(actionCode);
  if (!normalizedCode) throw new Error('Lit Action code is required.');
  return toTrimmedString(await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    path: '/get_lit_action_ipfs_id',
    method: 'POST',
    body: normalizedCode,
    fetchImpl,
  }));
};

const normalizeSessionScopedNameSegment = (value, fallback = 'session') => {
  const normalized = toTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

const normalizeGateMode = (value) => (
  toTrimmedString(value).toLowerCase() === 'all' ? 'all' : 'any'
);

const isPrivateHostname = (hostname = '') => {
  const normalized = toTrimmedString(hostname).toLowerCase();
  if (!normalized) return true;
  if (
    normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  ) {
    return true;
  }
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  if (/^169\.254\./.test(normalized)) return true;
  return false;
};

const validateChipotleRpcUrl = (value = '') => {
  const raw = toTrimmedString(value);
  if (!raw) throw new Error('Lit Chipotle RPC URL is required.');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Lit Chipotle RPC URL is invalid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Lit Chipotle RPC URL must be http(s).');
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('Lit Chipotle RPC URL must be public.');
  }
  return parsed.toString();
};

const resolveConfigMappedChipotleRpcUrls = ({
  config = {},
  chainId = 0,
} = {}) => {
  const normalizedChainId = toChainId(chainId);
  if (!normalizedChainId) return [];
  const map = isObj(config?.rpcUrlsByChainId) ? config.rpcUrlsByChainId : {};
  const mapped = normalizeChipotleRpcCandidateList(
    map[normalizedChainId] || map[String(normalizedChainId)] || []
  );
  const direct = (
    toChainId(config?.registryChainId) === normalizedChainId
      ? normalizeChipotleRpcCandidateList(config?.rpcUrl)
      : []
  );
  return normalizeChipotleRpcCandidateList([...mapped, ...direct]);
};

const resolveDefaultChipotleRpcUrls = (chainId = 0) => {
  const normalizedChainId = toChainId(chainId);
  if (!normalizedChainId) return [];
  const publicUrls = getPublicRpcUrls(normalizedChainId);
  return normalizeChipotleRpcCandidateList([
    getPathRpcUrl(normalizedChainId),
    ...(Array.isArray(publicUrls) ? publicUrls : []),
  ]);
};

const resolveSessionChipotleRpcUrl = ({
  request = {},
  config = {},
  secrets = {},
  chainId = 0,
  op = '',
} = {}) => {
  const requestBody = isObj(request) ? request : {};
  const normalizedChainId = toChainId(chainId);
  const requestRpcUrl = toTrimmedString(requestBody.rpcUrl || requestBody.customRpcUrl);
  const candidates = normalizeChipotleRpcCandidateList([
    secrets?.customRpcUrl,
    ...resolveConfigMappedChipotleRpcUrls({ config, chainId: normalizedChainId }),
    ...resolveDefaultChipotleRpcUrls(normalizedChainId),
  ]);
  const approvedUrls = [];
  const seen = new Set();
  for (const candidate of candidates) {
    try {
      const normalized = validateChipotleRpcUrl(candidate);
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      approvedUrls.push(normalized);
    } catch {
      // Ignore invalid candidates and keep walking the fallback chain.
    }
  }

  if (requestRpcUrl) {
    const normalizedRequestRpcUrl = validateChipotleRpcUrl(requestRpcUrl);
    const approved = approvedUrls.some((candidate) => (
      candidate.toLowerCase() === normalizedRequestRpcUrl.toLowerCase()
    ));
    if (!approved) {
      throw new Error('Lit Chipotle request RPC URL is not approved for this gate chain.');
    }
    return op === 'encrypt' ? '' : normalizedRequestRpcUrl;
  }

  if (op === 'encrypt') return '';

  if (approvedUrls.length) return approvedUrls[0];

  if (normalizedChainId) {
    throw new Error(
      `Lit Chipotle RPC URL is required or chain ${normalizedChainId} must have a known default RPC.`
    );
  }
  throw new Error('Lit Chipotle RPC URL is required.');
};

const buildSessionBootstrapMetadata = ({
  request = {},
  sessionSlug = '',
} = {}) => {
  const requestBody = isObj(request) ? request : {};
  const slugSegment = normalizeSessionScopedNameSegment(
    requestBody.sessionSlug || requestBody.slug || sessionSlug,
    'session',
  );
  const sessionName = toTrimmedString(requestBody.sessionName) || slugSegment;
  const accountName = toTrimmedString(requestBody.accountName) || `ce-session-${slugSegment}`;
  const groupName = toTrimmedString(requestBody.groupName) || `${accountName}-default`;
  const usageKeyName = toTrimmedString(requestBody.usageKeyName) || `${groupName}-runtime`;
  return {
    sessionName,
    accountName,
    accountDescription: (
      toTrimmedString(requestBody.accountDescription) ||
      `Context Engine Lit account for session ${sessionName}`
    ),
    groupName,
    groupDescription: (
      toTrimmedString(requestBody.groupDescription) ||
      `Default Lit group for session ${sessionName}`
    ),
    usageKeyName,
    usageKeyDescription: (
      toTrimmedString(requestBody.usageKeyDescription) ||
      `Scoped runtime key for session ${sessionName}`
    ),
  };
};

const createLitChipotleAccount = async ({
  apiBase = DEFAULT_LIT_API_BASE,
  request = {},
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
} = {}) => {
  const metadata = buildSessionBootstrapMetadata({ request, sessionSlug });
  const requestBody = isObj(request) ? request : {};
  const response = await fetchChipotleJson({
    apiBase,
    path: '/new_account',
    method: 'POST',
    body: {
      account_name: metadata.accountName,
      account_description: metadata.accountDescription,
      ...(toTrimmedString(requestBody.accountEmail) ? { email: toTrimmedString(requestBody.accountEmail) } : {}),
    },
    fetchImpl,
  });
  return {
    accountApiKey: toTrimmedString(response?.api_key),
    accountWalletAddress: toTrimmedString(response?.wallet_address),
    metadata,
  };
};

const createLitChipotleGroup = async ({
  runtime = {},
  request = {},
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
} = {}) => {
  const metadata = buildSessionBootstrapMetadata({ request, sessionSlug });
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: '/add_group',
    method: 'POST',
    body: {
      group_name: metadata.groupName,
      group_description: metadata.groupDescription,
      pkp_ids_permitted: [],
      cid_hashes_permitted: [],
    },
    fetchImpl,
  });
  return {
    groupId: toTrimmedString(response?.group_id),
    metadata,
  };
};

const createLitChipotleWallet = async ({
  runtime = {},
  fetchImpl = globalThis.fetch,
} = {}) => {
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: '/create_wallet',
    fetchImpl,
  });
  const walletAddress = toTrimmedString(response?.wallet_address);
  const wallets = await listWallets({ runtime, fetchImpl }).catch(() => []);
  const matchedWallet = wallets.find((entry) => {
    const entryWalletAddress = toTrimmedString(entry?.wallet_address).toLowerCase();
    return !!walletAddress && entryWalletAddress === walletAddress.toLowerCase();
  });
  return {
    walletAddress,
    litPkpId: normalizeValidChipotlePkpId(matchedWallet?.id) || walletAddress,
  };
};

const createLitChipotleUsageKey = async ({
  runtime = {},
  groupId = '',
  request = {},
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
} = {}) => {
  const metadata = buildSessionBootstrapMetadata({ request, sessionSlug });
  const numericGroupId = Number(groupId || 0);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw new Error('Lit group ID not configured.');
  }
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: '/add_usage_api_key',
    method: 'POST',
    body: {
      name: metadata.usageKeyName,
      description: metadata.usageKeyDescription,
      can_create_groups: false,
      can_delete_groups: false,
      can_create_pkps: false,
      manage_ipfs_ids_in_groups: [],
      add_pkp_to_groups: [],
      remove_pkp_from_groups: [],
      execute_in_groups: [numericGroupId],
    },
    fetchImpl,
  });
  return {
    usageApiKey: toTrimmedString(response?.usage_api_key),
    metadata,
  };
};

const readChipotleBillingBalance = async ({
  apiBase = DEFAULT_LIT_API_BASE,
  apiKey = '',
  fetchImpl = globalThis.fetch,
} = {}) => fetchChipotleJson({
  apiBase,
  apiKey,
  path: '/billing/balance',
  fetchImpl,
}).catch(() => null);

const resolveProvisioningGroupId = async ({ runtime = {}, fetchImpl = globalThis.fetch } = {}) => {
  const rawGroupId = toTrimmedString(runtime?.litGroupId);
  if (!rawGroupId) throw new Error('Lit group ID not configured.');
  if (/^\d+$/.test(rawGroupId)) return rawGroupId;
  const groups = await listGroups({ runtime, fetchImpl });
  const match = groups.find((group) => {
    const candidateId = toTrimmedString(group?.id);
    const candidateName = toTrimmedString(group?.name);
    return candidateId === rawGroupId || candidateName === rawGroupId;
  });
  const resolvedId = toTrimmedString(match?.id);
  if (!resolvedId) throw new Error(`Lit group not found: ${rawGroupId}`);
  return resolvedId;
};

const ensureActionMetadata = async ({ runtime = {}, litActionCid = '', actionName = '', actionDescription = '', fetchImpl = globalThis.fetch } = {}) => {
  const actions = await listActions({ runtime, fetchImpl, groupId: null });
  const hasAction = await resolveActionCidMembership({
    runtime: { ...runtime, litActionCid },
    actions,
    fetchImpl,
  });
  if (hasAction) {
    return { created: false };
  }
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: '/add_action',
    method: 'POST',
    body: {
      action_ipfs_cid: litActionCid,
      name: toTrimmedString(actionName) || 'Context Engine Lit Action',
      description: toTrimmedString(actionDescription) || 'Provisioned by Context Engine',
    },
    fetchImpl,
  });
  return {
    created: true,
    response,
  };
};

const ensureActionInGroup = async ({ runtime = {}, groupId = '', litActionCid = '', fetchImpl = globalThis.fetch } = {}) => {
  const actions = await listActions({
    runtime: { ...runtime, litGroupId: groupId },
    fetchImpl,
    groupId,
  });
  const hasAction = await resolveActionCidMembership({
    runtime: { ...runtime, litActionCid },
    actions,
    fetchImpl,
  });
  if (hasAction) {
    return { added: false };
  }
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: '/add_action_to_group',
    method: 'POST',
    body: {
      group_id: Number(groupId),
      action_ipfs_cid: litActionCid,
    },
    fetchImpl,
  });
  return {
    added: true,
    response,
  };
};

const ensurePkpInGroup = async ({ runtime = {}, groupId = '', fetchImpl = globalThis.fetch } = {}) => {
  const wallets = await listGroupWallets({
    runtime: {
      ...runtime,
      litGroupId: groupId,
      litUsageApiKey: runtime.litManagementApiKey,
    },
    fetchImpl,
  });
  const configuredPkp = normalizeChipotleMembershipValue(runtime?.litPkpId);
  const hasPkp = wallets.some((wallet) => (
    !!configuredPkp &&
    [
      normalizeChipotleMembershipValue(normalizeValidChipotlePkpId(wallet?.id)),
      normalizeChipotleMembershipValue(wallet?.wallet_address),
    ].includes(configuredPkp)
  ));
  if (hasPkp) {
    return { added: false };
  }
  const response = await fetchChipotleJson({
    apiBase: runtime.litApiBase,
    apiKey: runtime.litManagementApiKey,
    path: '/add_pkp_to_group',
    method: 'POST',
    body: {
      group_id: Number(groupId),
      pkp_id: toTrimmedString(runtime?.litPkpId),
    },
    fetchImpl,
  });
  return {
    added: true,
    response,
  };
};

export const provisionLitChipotleAction = async ({
  runtime = {},
  request = {},
  fetchImpl = globalThis.fetch,
} = {}) => {
  ensureChipotleManagementApiKey(runtime);
  if (!toTrimmedString(runtime?.litPkpId)) {
    throw new Error('Lit PKP ID not configured.');
  }

  const actionRequest = isObj(request) ? request : {};
  const actionCode = toTrimmedString(actionRequest.actionCode || actionRequest.code);
  if (!actionCode) {
    throw new Error('Lit Action code is required.');
  }

  const resolvedGroupId = await resolveProvisioningGroupId({ runtime, fetchImpl });
  const litActionCid = await deriveLitActionCid({ runtime, actionCode, fetchImpl });
  const metadata = await ensureActionMetadata({
    runtime,
    litActionCid,
    actionName: actionRequest.actionName || actionRequest.name,
    actionDescription: actionRequest.actionDescription || actionRequest.description,
    fetchImpl,
  });
  const groupAction = await ensureActionInGroup({
    runtime,
    groupId: resolvedGroupId,
    litActionCid,
    fetchImpl,
  });
  const groupPkp = await ensurePkpInGroup({
    runtime,
    groupId: resolvedGroupId,
    fetchImpl,
  });

  return {
    ok: true,
    apiBase: runtime.litApiBase,
    apiKeySource: runtime.apiKeySource,
    litActionCid,
    litGroupId: resolvedGroupId,
    litPkpId: toTrimmedString(runtime.litPkpId),
    steps: {
      derivedCid: true,
      registeredAction: metadata.created,
      addedActionToGroup: groupAction.added,
      addedPkpToGroup: groupPkp.added,
    },
  };
};

export const bootstrapLitChipotleSession = async ({
  env = {},
  config = {},
  secrets = {},
  request = {},
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
} = {}) => {
  const litCredentials = isObj(config?.litCredentials) ? config.litCredentials : {};
  const secretAccountApiKey = toTrimmedString(secrets?.litAccountApiKey);
  const requestBody = isObj(request) ? request : {};
  const requestAccountApiKey = toTrimmedString(requestBody.litAccountApiKey);
  const envAccountApiKey = toTrimmedString(env?.LIT_ACCOUNT_API_KEY);
  const existingAccountApiKey = secretAccountApiKey || requestAccountApiKey || envAccountApiKey;
  const existingAccountApiKeySource = secretAccountApiKey
    ? 'session-secret'
    : requestAccountApiKey
      ? 'admin-request'
      : envAccountApiKey
      ? 'worker-env'
      : 'missing';
  const existingUsageApiKey = toTrimmedString(secrets?.litUsageApiKey);
  const existingGroupId = toTrimmedString(litCredentials?.litGroupId);
  const existingPkpId = toTrimmedString(litCredentials?.litPkpId);
  const existingActionCid = toTrimmedString(litCredentials?.litActionCid);
  const litApiBase = normalizeLitChipotleApiBase(
    requestBody.litApiBase ||
    litCredentials.litApiBase ||
    env?.LIT_API_BASE ||
    DEFAULT_LIT_API_BASE
  );

  if (
    existingAccountApiKey &&
    existingUsageApiKey &&
    existingGroupId &&
    existingPkpId &&
    existingActionCid
  ) {
    return {
      ok: true,
      bootstrapMode: envAccountApiKey && !secretAccountApiKey ? 'existing-account' : 'session-account',
      alreadyBootstrapped: true,
      apiBase: litApiBase,
      litActionCid: existingActionCid,
      litGroupId: existingGroupId,
      litPkpId: existingPkpId,
      litCredentials: {
        litApiBase,
        litActionCid: existingActionCid,
        litGroupId: existingGroupId,
        litPkpId: existingPkpId,
      },
      secretOutputs: {
        litAccountApiKey: existingAccountApiKey,
        litUsageApiKey: existingUsageApiKey,
      },
      steps: {
        createdAccount: false,
        createdGroup: false,
        createdWallet: false,
        derivedCid: false,
        registeredAction: false,
        addedActionToGroup: false,
        addedPkpToGroup: false,
        createdUsageKey: false,
      },
    };
  }

  const actionCode = toTrimmedString(requestBody.actionCode || requestBody.code);
  if (!actionCode && !existingActionCid) {
    throw new Error('Lit Action code is required.');
  }

  if (existingAccountApiKey) {
    const runtime = {
      litApiBase,
      litManagementApiKey: existingAccountApiKey,
      apiKeySource: existingAccountApiKeySource,
    };

    let groupId = existingGroupId;
    let createdGroup = false;
    if (!groupId) {
      const group = await createLitChipotleGroup({
        runtime,
        request: requestBody,
        sessionSlug,
        fetchImpl,
      });
      groupId = toTrimmedString(group.groupId);
      if (!groupId) {
        throw new Error('Lit session bootstrap did not return a group ID.');
      }
      createdGroup = true;
    }

    let litPkpId = existingPkpId;
    let createdWallet = false;
    if (!litPkpId) {
      const wallet = await createLitChipotleWallet({
        runtime,
        fetchImpl,
      });
      litPkpId = toTrimmedString(wallet.litPkpId);
      if (!litPkpId) {
        throw new Error('Lit session bootstrap did not return a PKP ID.');
      }
      createdWallet = true;
    }

    const runtimeWithGroup = {
      ...runtime,
      litGroupId: groupId,
      litPkpId,
    };
    const litActionCid = existingActionCid || await deriveLitActionCid({
      runtime: runtimeWithGroup,
      actionCode,
      fetchImpl,
    });
    const metadata = await ensureActionMetadata({
      runtime: runtimeWithGroup,
      litActionCid,
      actionName: requestBody.actionName || requestBody.name,
      actionDescription: requestBody.actionDescription || requestBody.description,
      fetchImpl,
    });
    const groupAction = await ensureActionInGroup({
      runtime: runtimeWithGroup,
      groupId,
      litActionCid,
      fetchImpl,
    });
    const groupPkp = await ensurePkpInGroup({
      runtime: runtimeWithGroup,
      groupId,
      fetchImpl,
    });

    let usageApiKey = existingUsageApiKey;
    let createdUsageKey = false;
    if (!usageApiKey || createdGroup) {
      const usageKey = await createLitChipotleUsageKey({
        runtime: runtimeWithGroup,
        groupId,
        request: requestBody,
        sessionSlug,
        fetchImpl,
      });
      usageApiKey = toTrimmedString(usageKey.usageApiKey);
      if (!usageApiKey) {
        throw new Error('Lit session bootstrap did not return a usage API key.');
      }
      createdUsageKey = true;
    }
    const billingBalance = await readChipotleBillingBalance({
      apiBase: litApiBase,
      apiKey: existingAccountApiKey,
      fetchImpl,
    });

    return {
      ok: true,
      bootstrapMode: 'existing-account',
      alreadyBootstrapped: false,
      apiBase: litApiBase,
      litActionCid,
      litGroupId: groupId,
      litPkpId,
      billingBalance,
      litCredentials: {
        litApiBase,
        litActionCid,
        litGroupId: groupId,
        litPkpId,
      },
      secretOutputs: {
        ...(secretAccountApiKey || requestAccountApiKey
          ? { litAccountApiKey: existingAccountApiKey }
          : {}),
        ...(usageApiKey ? { litUsageApiKey: usageApiKey } : {}),
      },
      steps: {
        createdAccount: false,
        createdGroup,
        createdWallet,
        derivedCid: !existingActionCid,
        registeredAction: metadata.created,
        addedActionToGroup: groupAction.added,
        addedPkpToGroup: groupPkp.added,
        createdUsageKey,
      },
    };
  }

  const account = await createLitChipotleAccount({
    apiBase: litApiBase,
    request: requestBody,
    sessionSlug,
    fetchImpl,
  });
  if (!account.accountApiKey) {
    throw new Error('Lit account bootstrap did not return an account API key.');
  }

  const runtime = {
    litApiBase,
    litManagementApiKey: account.accountApiKey,
    apiKeySource: 'bootstrap-account',
  };
  const group = await createLitChipotleGroup({
    runtime,
    request: requestBody,
    sessionSlug,
    fetchImpl,
  });
  const groupId = toTrimmedString(group.groupId);
  if (!groupId) {
    throw new Error('Lit session bootstrap did not return a group ID.');
  }

  const wallet = await createLitChipotleWallet({
    runtime,
    fetchImpl,
  });
  const litPkpId = toTrimmedString(wallet.litPkpId);
  if (!litPkpId) {
    throw new Error('Lit session bootstrap did not return a PKP ID.');
  }

  const runtimeWithGroup = {
    ...runtime,
    litGroupId: groupId,
    litPkpId,
  };
  const litActionCid = await deriveLitActionCid({
    runtime: runtimeWithGroup,
    actionCode,
    fetchImpl,
  });
  const metadata = await ensureActionMetadata({
    runtime: runtimeWithGroup,
    litActionCid,
    actionName: requestBody.actionName || requestBody.name,
    actionDescription: requestBody.actionDescription || requestBody.description,
    fetchImpl,
  });
  const groupAction = await ensureActionInGroup({
    runtime: runtimeWithGroup,
    groupId,
    litActionCid,
    fetchImpl,
  });
  const groupPkp = await ensurePkpInGroup({
    runtime: runtimeWithGroup,
    groupId,
    fetchImpl,
  });
  const usageKey = await createLitChipotleUsageKey({
    runtime: runtimeWithGroup,
    groupId,
    request: requestBody,
    sessionSlug,
    fetchImpl,
  });
  const billingBalance = await readChipotleBillingBalance({
    apiBase: litApiBase,
    apiKey: account.accountApiKey,
    fetchImpl,
  });

  return {
    ok: true,
    bootstrapMode: 'session-account',
    alreadyBootstrapped: false,
    apiBase: litApiBase,
    litActionCid,
    litGroupId: groupId,
    litPkpId,
    accountWalletAddress: account.accountWalletAddress,
    billingBalance,
    litCredentials: {
      litApiBase,
      litActionCid,
      litGroupId: groupId,
      litPkpId,
    },
    secretOutputs: {
      litAccountApiKey: account.accountApiKey,
      litUsageApiKey: toTrimmedString(usageKey.usageApiKey),
    },
    steps: {
      createdAccount: true,
      createdGroup: true,
      createdWallet: true,
      derivedCid: true,
      registeredAction: metadata.created,
      addedActionToGroup: groupAction.added,
      addedPkpToGroup: groupPkp.added,
      createdUsageKey: true,
    },
  };
};

export const executeLitChipotleAction = async ({
  runtime = {},
  request = {},
  fetchImpl = globalThis.fetch,
} = {}) => {
  ensureChipotleApiKey(runtime);
  const actionRequest = isObj(request) ? request : {};
  const code = toTrimmedString(actionRequest.code);
  const ipfsId = toTrimmedString(
    actionRequest.ipfsId ||
    actionRequest.ipfs_id ||
    runtime.litActionCid
  );
  if (!code && !ipfsId) {
    throw new Error('Lit Action CID or inline code is required.');
  }

  const payload = {};
  if (code) payload.code = code;
  if (!code && ipfsId) payload.ipfs_id = ipfsId;
  if (Object.prototype.hasOwnProperty.call(actionRequest, 'jsParams')) {
    payload.js_params = actionRequest.jsParams;
  } else if (Object.prototype.hasOwnProperty.call(actionRequest, 'js_params')) {
    payload.js_params = actionRequest.js_params;
  }

  let response;
  try {
    response = await fetchChipotleJson({
      apiBase: runtime.litApiBase,
      apiKey: runtime.litUsageApiKey,
      path: '/lit_action',
      method: 'POST',
      body: payload,
      fetchImpl,
    });
  } catch (error) {
    const message = toTrimmedString(error?.message || error);
    if (/not found/i.test(message)) {
      throw new Error('Lit Chipotle action was not found or is not permitted for this session usage key. Re-run Lit Chipotle provisioning for this session worker.');
    }
    throw error;
  }

  return {
    ok: true,
    apiBase: runtime.litApiBase,
    apiKeySource: runtime.apiKeySource,
    request: payload,
    response,
  };
};

export const executeSessionLitChipotleAction = async ({
  env = {},
  config = {},
  secrets = {},
  request = {},
  requesterAddress = '',
  fetchImpl = globalThis.fetch,
} = {}) => {
  const litCredentials = isObj(config?.litCredentials) ? config.litCredentials : {};
  const requestBody = isObj(request) ? request : {};
  const runtime = resolveLitChipotleRuntime({
    env,
    config,
    secrets,
    body: {},
  });
  ensureChipotleApiKey(runtime);

  const litPkpId = toTrimmedString(litCredentials?.litPkpId || runtime.litPkpId);
  if (!litPkpId) {
    throw new Error('Lit PKP ID not configured.');
  }

  const litActionCid = toTrimmedString(litCredentials?.litActionCid || runtime.litActionCid);
  if (!litActionCid) {
    throw new Error('Lit Action CID not configured.');
  }

  const actionCode = toTrimmedString(requestBody.actionCode || requestBody.code);
  if (!actionCode) {
    throw new Error('Lit Action code is required.');
  }
  const derivedActionCid = await deriveLitActionCid({ runtime, actionCode, fetchImpl });
  if (derivedActionCid !== litActionCid) {
    throw new Error('Lit Action code does not match the configured Lit Action CID.');
  }

  const op = toTrimmedString(requestBody.op).toLowerCase();
  if (!['check', 'encrypt', 'decrypt'].includes(op)) {
    throw new Error('Lit Chipotle op must be check, encrypt, or decrypt.');
  }

  const sbtAddresses = normalizeChipotleSbtAddresses(requestBody.sbtAddresses);
  if (!sbtAddresses.length) {
    throw new Error('Lit Chipotle requires at least one SBT address.');
  }

  const gateMode = normalizeGateMode(requestBody.gateMode);
  const gateChainId = toChainId(
    requestBody.chainId ||
    requestBody.gateChainId ||
    config?.networkChainId ||
    config?.registryChainId
  );
  if (!gateChainId) {
    throw new Error('Lit Chipotle requires a gate chain ID.');
  }
  const policy = buildLitChipotlePolicy({
    chainId: gateChainId,
    gateMode,
    sbtAddresses,
    litActionCid,
    litPkpId,
  });
  const expectedPolicyFingerprint = fingerprintLitChipotlePolicy(policy);
  const rpcUrl = resolveSessionChipotleRpcUrl({
    request: requestBody,
    config,
    secrets,
    chainId: gateChainId,
    op,
  });
  const normalizedRequesterAddress = toTrimmedString(requesterAddress);
  if (!normalizedRequesterAddress) {
    throw new Error('Requester address unavailable for Lit Chipotle action.');
  }

  // Regression guard: RPC is an authorization oracle for check/decrypt.
  // Keep it worker-approved and out of stored Chipotle metadata.
  const jsParams = {
    op,
    pkpId: litPkpId,
    litActionCid,
    requesterAddress: normalizedRequesterAddress,
    sbtAddresses,
    gateMode,
    expectedChainId: gateChainId,
    expectedPolicyFingerprint,
    policy,
  };
  if (rpcUrl) {
    jsParams.rpcUrl = rpcUrl;
  }
  if (op === 'encrypt') {
    const cekHex = normalizeChipotleCekHex(requestBody.message);
    const wrappedPlaintext = buildLitChipotleWrappedPlaintext({
      cekHex,
      policy,
    });
    jsParams.message = JSON.stringify(wrappedPlaintext);
    if (!cekHex) {
      throw new Error('Lit Chipotle encrypt requires a message.');
    }
  }
  if (op === 'decrypt') {
    const metadataVersion = normalizeLitChipotleMetadataVersion(requestBody.chipotle || {});
    if (metadataVersion && metadataVersion !== 2) {
      throw new Error('Lit Chipotle legacy wrapped keys are not supported.');
    }
    jsParams.ciphertext = toTrimmedString(requestBody.ciphertext);
    if (!jsParams.ciphertext) {
      throw new Error('Lit Chipotle decrypt requires ciphertext.');
    }
  }

  const actionRuntime = {
    ...runtime,
    litActionCid,
    litPkpId,
  };
  try {
    return await executeLitChipotleAction({
      runtime: actionRuntime,
      request: {
        // Verify submitted source first, then execute the provisioned action CID
        // that the session usage key/group is permitted to run.
        ipfsId: litActionCid,
        jsParams,
      },
      fetchImpl,
    });
  } catch (error) {
    const message = toTrimmedString(error?.message || error).toLowerCase();
    if (!message.includes('no cached code found') && !message.includes('cache miss for ipfs id')) {
      throw error;
    }
    return executeLitChipotleAction({
      runtime: actionRuntime,
      request: {
        code: actionCode,
        jsParams,
      },
      fetchImpl,
    });
  }
};
