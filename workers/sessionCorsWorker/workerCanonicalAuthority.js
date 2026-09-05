import { isWorkerGroupMember as isWorkerGroupMemberBoundary } from './workerGroups.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const trim = (value) => toStr(value).trim();
const lower = (value) => trim(value).toLowerCase();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const ALLOWED_WORKER_SCOPE_KEYS = new Set([
  'ai',
  'transcribe',
  'storage',
  'groups',
  'arweave',
  'faucet',
  'fetch',
  'lit',
]);

const normalizeScopeList = (value) => (
  Array.isArray(value)
    ? [...new Set(value.map(lower).filter((scope) => ALLOWED_WORKER_SCOPE_KEYS.has(scope)))]
    : []
);

const listAddresses = (value) => {
  if (Array.isArray(value)) return value.flatMap(listAddresses);
  if (isObj(value)) return listAddresses(value.addresses || value.members || []);
  const address = lower(value);
  return /^0x[0-9a-f]{40}$/.test(address) ? [address] : [];
};

const resolveRoleAddressSet = ({ config, role }) => {
  const normalizedRole = lower(role || 'admin') || 'admin';
  const addresses = new Set();
  if (normalizedRole === 'admin') {
    listAddresses(config?.adminAddress).forEach((address) => addresses.add(address));
    listAddresses(config?.adminAddresses).forEach((address) => addresses.add(address));
    listAddresses(config?.admin?.addresses).forEach((address) => addresses.add(address));
  }
  [config?.workerRoles, config?.roles, config?.authorization?.roles]
    .filter(isObj)
    .forEach((roles) => listAddresses(roles[normalizedRole]).forEach((address) => addresses.add(address)));
  return addresses;
};

const resolveAuthorityPolicy = (config) => {
  const policy = isObj(config?.workerAuthority) ? config.workerAuthority : null;
  if (!policy || Number(policy.version) !== 1) return null;
  return policy;
};

const resolveLoginConditions = (policy) => {
  const gate = isObj(policy?.loginGate) ? policy.loginGate : {};
  return {
    match: lower(gate.match) === 'all' ? 'all' : 'any',
    conditions: Array.isArray(gate.conditions) ? gate.conditions.filter(isObj) : [],
  };
};

const evaluateLoginCondition = async ({ condition, address, config, env, slug, deps }) => {
  const kind = lower(condition?.kind);
  if (kind === 'worker_role') {
    const role = lower(condition?.role || 'admin') || 'admin';
    return resolveRoleAddressSet({ config, role }).has(lower(address));
  }
  if (kind === 'worker_group') {
    const groupId = trim(condition?.groupId);
    if (!groupId) return false;
    const checkMembership = typeof deps?.isWorkerGroupMember === 'function'
      ? deps.isWorkerGroupMember
      : isWorkerGroupMemberBoundary;
    const result = await checkMembership({
      env,
      slug,
      sessionId: resolveCanonicalWorkerSessionIdHex(config),
      groupId,
      requesterAddress: address,
      authScopes: {},
    });
    return result?.ok === true;
  }
  return false;
};

const passesLoginGate = async ({ address, config, env, slug, policy, deps }) => {
  const gate = resolveLoginConditions(policy);
  if (!gate.conditions.length) return true;
  const results = [];
  for (const condition of gate.conditions) {
    // Deliberately sequential: membership reads can share an eventually-consistent
    // worker store, and preserving config order keeps diagnostics deterministic.
    results.push(await evaluateLoginCondition({ condition, address, config, env, slug, deps }));
  }
  return gate.match === 'all' ? results.every(Boolean) : results.some(Boolean);
};

export const isWorkerCanonicalSessionConfig = (config) => (
  lower(config?.sessionModeProfile?.authority?.mode) === 'worker_canonical'
);

export const resolveWorkerCanonicalLoginScopes = async ({
  address,
  config,
  env,
  slug,
  deps,
} = {}) => {
  if (!isWorkerCanonicalSessionConfig(config)) {
    throw new Error('Access denied: worker-canonical authority profile missing.');
  }
  const policy = resolveAuthorityPolicy(config);
  if (!policy) {
    throw new Error('Access denied: worker-canonical authority policy missing.');
  }

  const normalizedAddress = lower(address);
  const isAdmin = resolveRoleAddressSet({ config, role: 'admin' }).has(normalizedAddress);
  if (!isAdmin && !await passesLoginGate({ address, config, env, slug, policy, deps })) {
    throw new Error('Access denied: worker-canonical login gate failed.');
  }

  // Regression guard: an empty policy must never become grant-all. The client
  // writes the participant contract explicitly, while config.scopes may only narrow it.
  const configuredScopes = normalizeScopeList(policy.participantScopes);
  const scopes = configuredScopes.reduce((acc, scope) => {
    acc[scope] = config?.scopes?.[scope] !== false;
    return acc;
  }, {});
  if (isAdmin) scopes.admin = true;
  return scopes;
};

export const evaluateWorkerCanonicalAnonymousAccess = ({ config, route } = {}) => {
  const scope = lower(route) === 'transcribe' ? 'transcribe' : 'ai';
  const policy = isWorkerCanonicalSessionConfig(config) ? resolveAuthorityPolicy(config) : null;
  const gate = resolveLoginConditions(policy);
  const allowed = !!policy && gate.conditions.length === 0 && normalizeScopeList(policy.anonymousScopes).includes(scope);
  return allowed
    ? { ok: true, reason: 'worker-canonical-open', scope }
    : { ok: false, reason: 'worker-canonical-anonymous-scope-denied', scope };
};
