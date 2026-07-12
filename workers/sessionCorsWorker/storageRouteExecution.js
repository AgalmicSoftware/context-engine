import {
  STORAGE_BACKENDS,
  attachStorageRefCompatibilityFields,
  assertNoCloudflarePrivateMaterial,
  isArweaveStorageBackend,
  isSafeCloudflareStorageRefId,
  normalizeStorageBackend,
  normalizeStorageRef,
} from './storageRefNormalization.js';
import {
  PAYLOAD_ACCESS_GATES,
  PAYLOAD_ENCRYPTION_MODES,
  deriveLegacyPayloadAccessMode,
  normalizeLegacyPayloadAccessMode,
  normalizePayloadAccessControl,
} from './payloadAccessControl.js';
import {
  decryptPayloadWithStorageEnvelope,
  encryptPayloadWithStorageEnvelope,
  toUint8Array,
  writeStorageEnvelopeKeyReleaseAudit,
} from './storageEnvelopeEncryption.js';
import {
  isWorkerGroupMember,
} from './workerGroups.js';
import {
  rejectBytesOverLimit,
  rejectContentLengthOverLimit,
  resolveMaxUploadBytes,
} from './uploadSizeLimits.js';

const encoder = new TextEncoder();
const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const trim = (value) => toStr(value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isJsonContentType = (contentType) => {
  const mediaType = trim(contentType).split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json' || mediaType.endsWith('+json');
};

const getStorageR2Binding = (env = {}) => env.CE_STORAGE_R2 || env.STORAGE_R2 || env.R2_BUCKET || null;
const getStorageIndexBinding = (env = {}) => env.CE_STORAGE_INDEX_KV || env.STORAGE_INDEX_KV || env.STORAGE_KV || null;
const DEFAULT_RESOURCE_GATES = Object.freeze({
  docsContext: 'docUploads',
  questions: 'questionResponses',
  surveys: 'surveyResponses',
  responses: 'questionResponses',
  generatedArtifacts: 'surveyResponses',
  media: 'docUploads',
  images: 'docUploads',
});

const safeSlugPart = (value) => trim(value || 'general').toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
const bytesToBase64url = (bytes) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};
const buildCloudflareStorageId = ({ randomBytes, getRandomValues: getRandomValuesDep } = {}) => {
  const bytes = new Uint8Array(32);
  const suppliedBytes = typeof randomBytes === 'function' ? randomBytes(32) : null;
  const getRandomValues = typeof getRandomValuesDep === 'function'
    ? getRandomValuesDep
    : getRandomValuesDep === null
      ? null
    : globalThis?.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (suppliedBytes && suppliedBytes.length >= 32) {
    bytes.set(new Uint8Array(suppliedBytes).slice(0, 32));
  } else if (typeof getRandomValues === 'function') {
    getRandomValues(bytes);
  } else {
    throw new Error('Secure randomness is required for Cloudflare storage references.');
  }
  // Contract pointer fields are bytes32. Keeping Cloudflare refs to the same
  // 32-byte base64url shape lets existing bytes32 helpers round-trip the id
  // without exposing any bucket/key/account details.
  bytes[0] &= 0xf7;
  return bytesToBase64url(bytes);
};
const buildObjectKey = ({ slug, id }) => `sessions/${safeSlugPart(slug)}/storage/${id}`;
const buildIndexKey = ({ slug, resource, id }) => `ce-storage:${safeSlugPart(slug)}:${trim(resource) || 'docsContext'}:${id}`;
const buildIndexPrefix = ({ slug, resource }) => `ce-storage:${safeSlugPart(slug)}:${trim(resource) || 'docsContext'}:`;
const buildSessionIndexPrefix = ({ slug }) => `ce-storage:${safeSlugPart(slug)}:`;
const buildPayloadKey = ({ slug, id }) => `ce-storage-payload:${safeSlugPart(slug)}:${id}`;
const safeGroupId = (value) => trim(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
const normalizeGroupIdList = (value) => {
  let raw = value;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { raw = JSON.parse(raw); } catch { raw = value; }
  }
  const source = Array.isArray(raw) ? raw : [raw];
  return Array.from(new Set(source.map(safeGroupId).filter(Boolean)));
};
const readKvPayloadEnvelope = async ({ index, slug, id }) => {
  if (!index || typeof index.get !== 'function') return null;
  try {
    const envelope = JSON.parse(await index.get(buildPayloadKey({ slug, id })) || 'null');
    return envelope && isObj(envelope?.metadata) ? envelope : null;
  } catch {
    return null;
  }
};
const base64urlToBytes = (value) => {
  const text = trim(value);
  if (!text) return new Uint8Array();
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const normalizeTagsForMetadata = (tagsInput) => {
  let tags = tagsInput;
  if (typeof tagsInput === 'string' && tagsInput.trim()) {
    try { tags = JSON.parse(tagsInput); } catch { tags = []; }
  }
  return (Array.isArray(tags) ? tags : [])
    .filter((tag) => tag && typeof tag === 'object')
    .map((tag) => ({ name: trim(tag.name), value: trim(tag.value) }))
    .filter((tag) => tag.name && tag.value !== '');
};

const normalizeAccessConditionDocument = (conditionsInput) => {
  let raw = conditionsInput;
  if (typeof raw === 'string' && raw.trim()) {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  if (!isObj(raw)) return null;
  const match = trim(raw.match).toLowerCase() === 'all' ? 'all' : 'any';
  const conditions = (Array.isArray(raw.conditions) ? raw.conditions : [])
    .filter(isObj)
    .map((condition) => ({ ...condition, kind: trim(condition.kind).toLowerCase() }))
    .filter((condition) => condition.kind);
  return { match, conditions };
};

const normalizeUploadPolicy = (policyInput) => {
  let raw = policyInput;
  if (typeof raw === 'string' && raw.trim()) {
    try { raw = JSON.parse(raw); } catch { raw = { mode: raw }; }
  }
  if (!isObj(raw)) return null;
  const mode = trim(raw.mode || raw.kind || raw.type).toLowerCase();
  if (!mode) return null;
  return {
    mode,
    groupIds: normalizeGroupIdList(raw.groupIds || raw.groups || raw.groupId),
    sbtAddresses: [
      ...(Array.isArray(raw.sbtAddresses) ? raw.sbtAddresses : []),
      ...(Array.isArray(raw.contracts) ? raw.contracts : []),
      raw.sbtAddress,
      raw.contract,
      raw.address,
    ].map(trim).filter(Boolean),
    chainId: Number(raw.chainId || raw.networkChainId || 0) || null,
    anyOrAll: normalizeGateMode(raw.anyOrAll || raw.match || raw.gateMode),
  };
};

const readJsonPayload = async (request, { maxUploadBytes } = {}) => {
  let raw = null;
  try {
    raw = await (typeof request?.clone === 'function' ? request.clone() : request).json();
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  if (!isObj(raw)) return { ok: false, error: 'Invalid JSON.' };
  const data = Object.prototype.hasOwnProperty.call(raw, 'data') ? raw.data : '';
  const contentType = trim(raw.contentType) || (typeof data === 'string' ? 'text/plain' : 'application/json');
  const serialized = isJsonContentType(contentType) && typeof data !== 'string'
    ? JSON.stringify(data)
    : toStr(data);
  const bytes = encoder.encode(serialized);
  const tooLarge = rejectBytesOverLimit({ bytes, maxUploadBytes });
  if (tooLarge) return tooLarge;
  return {
    ok: true,
    payload: {
      bytes,
      contentType,
      backend: raw.backend || raw.storageBackend || raw.storage,
      resource: trim(raw.resource) || 'docsContext',
      gate: raw.gate || raw.gateResource || raw.resourceGate,
      tags: normalizeTagsForMetadata(raw.tags),
      accessConditions: normalizeAccessConditionDocument(raw.accessConditions || raw.conditions),
      groupIds: normalizeGroupIdList(raw.groupIds || raw.groups || raw.groupId || raw.workerGroupId),
      uploadPolicy: normalizeUploadPolicy(raw.uploadPolicy || raw.documentUploadPolicy || raw.policy),
      payloadEncrypted: raw.payloadEncrypted === true || raw.encrypted === true,
      requestId: trim(raw.requestId),
    },
  };
};

const readMultipartPayload = async (request, { maxUploadBytes } = {}) => {
  let form;
  try {
    form = await (typeof request?.clone === 'function' ? request.clone() : request).formData();
  } catch {
    return { ok: false, error: 'Expected multipart/form-data.' };
  }
  const fileOrBlob = form.get('file') || form.get('data');
  if (!fileOrBlob || typeof fileOrBlob.arrayBuffer !== 'function') {
    return { ok: false, error: 'Missing "file" or "data" field.' };
  }
  const buf = await fileOrBlob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const tooLarge = rejectBytesOverLimit({ bytes, maxUploadBytes });
  if (tooLarge) return tooLarge;
  return {
    ok: true,
    payload: {
      bytes,
      contentType: trim(form.get('contentType')) || fileOrBlob.type || 'application/octet-stream',
      backend: form.get('backend') || form.get('storageBackend') || form.get('storage'),
      resource: trim(form.get('resource')) || 'docsContext',
      gate: form.get('gate') || form.get('gateResource') || form.get('resourceGate'),
      tags: normalizeTagsForMetadata(form.get('tags')),
      accessConditions: normalizeAccessConditionDocument(form.get('accessConditions') || form.get('conditions')),
      groupIds: normalizeGroupIdList(form.getAll?.('groupIds') || form.get('groupIds') || form.get('groupId') || form.get('workerGroupId')),
      uploadPolicy: normalizeUploadPolicy(form.get('uploadPolicy') || form.get('documentUploadPolicy') || form.get('policy')),
      payloadEncrypted: trim(form.get('payloadEncrypted') || form.get('encrypted')).toLowerCase() === 'true',
      requestId: trim(form.get('requestId')),
    },
  };
};

export const readStorageUploadRequestPayload = async (request, options = {}) => {
  const contentType = request?.headers?.get?.('content-type') || '';
  const maxUploadBytes = resolveMaxUploadBytes(options);
  const contentLengthRejection = rejectContentLengthOverLimit({ request, maxUploadBytes });
  if (contentLengthRejection) return contentLengthRejection;
  if (contentType.includes('multipart/form-data')) return readMultipartPayload(request, { maxUploadBytes });
  if (contentType.includes('application/json')) return readJsonPayload(request, { maxUploadBytes });
  return { ok: false, error: 'Unsupported Content-Type.' };
};

const readConfiguredStorageBackendCandidate = (config = {}) => {
  const storageProfile = isObj(config?.storageProfile) ? config.storageProfile : {};
  const docLibrary = isObj(config?.docLibrary) ? config.docLibrary : {};
  return (
    storageProfile.backend ||
    config?.storageBackend ||
    docLibrary.provider ||
    docLibrary.backend ||
    docLibrary.storageBackend
  );
};

const resolveConfiguredStorageBackend = ({ config, requestedBackend, payloadEncrypted } = {}) => {
  const configured = normalizeStorageBackend(readConfiguredStorageBackendCandidate(config));
  if (configured === STORAGE_BACKENDS.CLOUDFLARE || configured === STORAGE_BACKENDS.LIT_ARWEAVE) return configured;
  if (payloadEncrypted) return STORAGE_BACKENDS.LIT_ARWEAVE;
  return normalizeStorageBackend(requestedBackend, configured);
};

const resolvePayloadAccessControl = (config = {}) => {
  const profile = isObj(config?.storageProfile) ? config.storageProfile : {};
  const cloudflare = isObj(profile.cloudflare) ? profile.cloudflare : {};
  const payloadAccessControl = isObj(profile.payloadAccessControl) ? profile.payloadAccessControl : {};
  const legacyMode = normalizeLegacyPayloadAccessMode(
    payloadAccessControl.mode ||
    cloudflare.payloadAccessMode ||
    profile.payloadAccessMode ||
    profile.accessControlMode
  );
  const accessControl = (
    Object.prototype.hasOwnProperty.call(payloadAccessControl, 'gate') ||
    Object.prototype.hasOwnProperty.call(payloadAccessControl, 'encryption')
  )
    ? normalizePayloadAccessControl(payloadAccessControl, legacyMode)
    : normalizePayloadAccessControl(legacyMode);
  const resourceGates = isObj(payloadAccessControl.resources) ? payloadAccessControl.resources : {};
  const conditions = normalizeAccessConditionDocument(
    payloadAccessControl.accessConditions ||
    payloadAccessControl.conditions ||
    cloudflare.accessConditions ||
    profile.accessConditions
  );
  return {
    ...accessControl,
    mode: deriveLegacyPayloadAccessMode(accessControl),
    conditions,
    groupIds: normalizeGroupIdList(payloadAccessControl.groupIds || payloadAccessControl.groups || payloadAccessControl.groupId),
    resources: { ...DEFAULT_RESOURCE_GATES, ...resourceGates },
  };
};

const resolveStorageResourceGateKey = ({ config, resource }) => {
  const access = resolvePayloadAccessControl(config);
  return trim(access.resources?.[trim(resource) || 'docsContext']) || 'default';
};

const normalizeGateMode = (mode) => (
  mode === 1 || trim(mode).toLowerCase() === '1' || trim(mode).toLowerCase() === 'all'
    ? 'all'
    : 'any'
);

const normalizeDirectGate = (gate) => {
  if (!isObj(gate)) return null;
  const sbtAddresses = Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses.filter(Boolean) : [];
  return {
    sbtAddresses,
    chainId: Number(gate.chainId || 0) || null,
    mode: normalizeGateMode(gate.mode),
  };
};

const readStorageGate = async ({ config, slug, resource, deps }) => {
  const resourceKey = resolveStorageResourceGateKey({ config, resource });
  const directGate = normalizeDirectGate(config?.__registry?.gatesByResource?.[resourceKey]);
  if (directGate) return { ok: true, gate: directGate, resourceKey, source: 'config' };

  if (typeof deps?.readResourceGateOnChain !== 'function') {
    return { ok: false, status: 403, error: 'Cloudflare worker SBT gate is unavailable.' };
  }

  const registryAddress = trim(config?.registryAddress || config?.contracts?.sessionRegistry?.address);
  const registryRpcUrls = typeof deps?.resolveRegistryRpcUrls === 'function'
    ? deps.resolveRegistryRpcUrls(config)
    : [];
  const registrySlug = typeof deps?.toRegistrySessionSlug === 'function'
    ? deps.toRegistrySessionSlug(slug)
    : slug;
  const result = await deps.readResourceGateOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    resourceKey,
  });
  if (!result?.ok) {
    return {
      ok: false,
      status: 403,
      error: result?.error || 'Cloudflare worker SBT gate lookup failed.',
      details: result?.errors || [],
    };
  }
  return { ok: true, gate: normalizeDirectGate(result.gate), resourceKey, source: 'onchain' };
};

const normalizeAddress = (value) => trim(value).toLowerCase();

const listRoleAddresses = (value) => {
  if (Array.isArray(value)) return value.map(normalizeAddress).filter(Boolean);
  if (isObj(value)) {
    if (Array.isArray(value.addresses)) return value.addresses.map(normalizeAddress).filter(Boolean);
    if (Array.isArray(value.members)) return value.members.map(normalizeAddress).filter(Boolean);
  }
  const address = normalizeAddress(value);
  return address ? [address] : [];
};

const resolveRoleAddressSet = ({ config = {}, role }) => {
  const normalizedRole = trim(role || 'admin').toLowerCase();
  const addresses = new Set();
  if (normalizedRole === 'admin') {
    listRoleAddresses(config.adminAddress).forEach((address) => addresses.add(address));
    listRoleAddresses(config.adminAddresses).forEach((address) => addresses.add(address));
    listRoleAddresses(config.admin?.addresses).forEach((address) => addresses.add(address));
  }
  const roleMaps = [config.workerRoles, config.roles, config.authorization?.roles].filter(isObj);
  roleMaps.forEach((roles) => {
    listRoleAddresses(roles[normalizedRole]).forEach((address) => addresses.add(address));
  });
  return addresses;
};

const listDelimitedAddresses = (value) => {
  if (typeof value === 'string') {
    return value.split(/[\s,;]+/).map(normalizeAddress).filter(Boolean);
  }
  return listRoleAddresses(value);
};

const resolveEnvelopeExportAddressSet = (config = {}) => {
  const addresses = new Set(resolveRoleAddressSet({ config, role: 'admin' }));
  listDelimitedAddresses(config.responseExportAllowedAddresses).forEach((address) => addresses.add(address));
  listDelimitedAddresses(config.telegramResponseExportAllowedAddresses).forEach((address) => addresses.add(address));
  listDelimitedAddresses(config.export?.allowedAddresses).forEach((address) => addresses.add(address));
  listDelimitedAddresses(config.export?.adminAddresses).forEach((address) => addresses.add(address));
  return addresses;
};

const isEnvelopeExportAuthorized = ({ config, requesterAddress, authScopes }) => {
  const scopes = isObj(authScopes) ? authScopes : {};
  if (
    scopes.admin === true ||
    scopes.responseExport === true ||
    scopes.response_export === true ||
    scopes.encryptedEnvelopeExport === true
  ) {
    return true;
  }
  const address = normalizeAddress(requesterAddress);
  if (!address) return false;
  return resolveEnvelopeExportAddressSet(config).has(address);
};

const evaluateWorkerRoleCondition = ({ condition, config, requesterAddress }) => {
  const role = trim(condition.role || condition.name || 'admin').toLowerCase();
  const address = normalizeAddress(requesterAddress);
  if (!address) return { ok: false, reason: 'missing_principal' };
  const roleAddresses = resolveRoleAddressSet({ config, role });
  if (roleAddresses.has(address)) {
    return { ok: true, matchedCondition: { kind: 'worker_role', role } };
  }
  return { ok: false, reason: 'worker_role_denied', condition: { kind: 'worker_role', role } };
};

const evaluateAgentGrantScopeCondition = ({ condition, authScopes }) => {
  const scope = trim(condition.scope || condition.value);
  if (!scope) return { ok: false, reason: 'missing_agent_grant_scope' };
  const scopes = isObj(authScopes) ? authScopes : {};
  const scopeLists = [
    scopes.agent_grant,
    scopes.agentGrant,
    scopes.delegationScopes,
  ].filter(Array.isArray);
  const ok = scopes[scope] === true || scopeLists.some((items) => items.map(trim).includes(scope));
  return ok
    ? { ok: true, matchedCondition: { kind: 'agent_grant_scope', scope } }
    : { ok: false, reason: 'agent_grant_scope_denied', condition: { kind: 'agent_grant_scope', scope } };
};

const evaluateSbtOnchainCondition = async ({ condition, config, requesterAddress, deps }) => {
  const address = normalizeAddress(requesterAddress);
  if (!address) return { ok: false, reason: 'missing_principal' };
  const sbtAddresses = [
    ...(Array.isArray(condition.sbtAddresses) ? condition.sbtAddresses : []),
    condition.contract,
    condition.address,
  ].map(trim).filter(Boolean);
  if (!sbtAddresses.length) return { ok: false, reason: 'missing_sbt_condition_contract' };
  const chainId = Number(condition.chainId || condition.networkChainId || config?.registryChainId || 0) || null;
  const rpcUrls = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate(config, chainId)
    : [];
  if (!rpcUrls.length || typeof deps?.checkSbtGate !== 'function') {
    return { ok: false, reason: 'missing_sbt_rpc' };
  }
  const mode = normalizeGateMode(condition.anyOrAll || condition.mode || condition.match);
  for (const rpcUrl of rpcUrls) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await deps.checkSbtGate({
      sbtAddresses,
      address,
      rpcUrl,
      mode,
      chainId,
    });
    if (ok) {
      return {
        ok: true,
        matchedCondition: {
          kind: 'sbt_onchain',
          chainId,
          anyOrAll: mode,
        },
      };
    }
  }
  return { ok: false, reason: 'sbt_onchain_denied', condition: { kind: 'sbt_onchain', chainId, anyOrAll: mode } };
};

const checkWorkerGroupMembership = async ({ env, slug, groupId, requesterAddress, authScopes, deps }) => {
  const check = typeof deps?.isWorkerGroupMember === 'function' ? deps.isWorkerGroupMember : isWorkerGroupMember;
  return check({ env, slug, groupId, requesterAddress, authScopes, deps });
};

const evaluateWorkerGroupCondition = async ({ condition, env, slug, requesterAddress, authScopes, deps }) => {
  const groupIds = normalizeGroupIdList(condition.groupIds || condition.groups || condition.groupId);
  if (!groupIds.length) return { ok: false, reason: 'missing_worker_group', condition: { kind: 'worker_group' } };
  let firstFailure = null;
  for (const groupId of groupIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await checkWorkerGroupMembership({ env, slug, groupId, requesterAddress, authScopes, deps });
    if (result?.ok) {
      return {
        ok: true,
        matchedCondition: {
          kind: 'worker_group',
          groupId,
          principal: result.principal,
        },
      };
    }
    if (!firstFailure) firstFailure = result;
  }
  return {
    ok: false,
    reason: firstFailure?.reason || 'worker_group_membership_denied',
    condition: { kind: 'worker_group', groupIds },
  };
};

const evaluateAccessCondition = async ({ condition, env, slug, config, requesterAddress, authScopes, deps }) => {
  const kind = trim(condition?.kind).toLowerCase();
  if (kind === 'worker_role') return evaluateWorkerRoleCondition({ condition, config, requesterAddress });
  if (kind === 'agent_grant_scope') return evaluateAgentGrantScopeCondition({ condition, authScopes });
  if (kind === 'sbt_onchain') return evaluateSbtOnchainCondition({ condition, config, requesterAddress, deps });
  if (kind === 'worker_group') {
    return evaluateWorkerGroupCondition({ condition, env, slug, requesterAddress, authScopes, deps });
  }
  return { ok: false, reason: 'unknown_condition_kind', condition: { kind: kind || 'unknown' } };
};

const resolvePayloadAccessConditions = ({ metadata, access }) => {
  const payloadConditions = normalizeAccessConditionDocument(
    metadata?.accessConditions ||
    metadata?.envelope?.accessConditions
  );
  if (payloadConditions?.conditions?.length) {
    return { document: payloadConditions, source: 'payload' };
  }
  if (access.conditions?.conditions?.length) {
    return { document: access.conditions, source: 'session' };
  }
  return { document: null, source: 'gate_fallback' };
};

const evaluateAccessConditionDocument = async ({
  document,
  source,
  env,
  slug,
  config,
  requesterAddress,
  authScopes,
  deps,
}) => {
  const conditions = Array.isArray(document?.conditions) ? document.conditions : [];
  if (!conditions.length) return { ok: false, reason: 'empty_conditions' };
  const match = document.match === 'all' ? 'all' : 'any';
  const matched = [];
  let firstFailure = null;
  for (const condition of conditions) {
    // eslint-disable-next-line no-await-in-loop
    const result = await evaluateAccessCondition({
      condition,
      env,
      slug,
      config,
      requesterAddress,
      authScopes,
      deps,
    });
    if (result.ok) {
      matched.push(result.matchedCondition || { kind: trim(condition.kind).toLowerCase() });
      if (match === 'any') {
        return { ok: true, conditionMatched: { source, match, condition: matched[0] } };
      }
    } else if (!firstFailure) {
      firstFailure = result;
      if (match === 'all') break;
    }
  }
  if (match === 'all' && matched.length === conditions.length) {
    return { ok: true, conditionMatched: { source, match, conditions: matched } };
  }
  return {
    ok: false,
    reason: firstFailure?.reason || 'conditions_denied',
    condition: firstFailure?.condition,
  };
};

const resolveGroupGateIds = ({ metadata, access }) => normalizeGroupIdList([
  ...normalizeGroupIdList(metadata?.groupIds),
  ...normalizeGroupIdList(metadata?.groupId),
  ...normalizeGroupIdList(metadata?.groupAllowlist),
  ...normalizeGroupIdList(metadata?.payloadAccessControl?.groupIds),
  ...normalizeGroupIdList(metadata?.payloadAccessControl?.groupId),
  ...normalizeGroupIdList(access.groupIds),
]);

const authorizeWorkerGroupAccess = async ({ env, slug, groupIds, requesterAddress, authScopes, baseHeaders, deps }) => {
  if (!groupIds.length) {
    return {
      ok: false,
      response: responseJson(deps, { error: 'Access denied: missing worker group.' }, 403, baseHeaders),
    };
  }
  let firstFailure = null;
  for (const groupId of groupIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await checkWorkerGroupMembership({ env, slug, groupId, requesterAddress, authScopes, deps });
    if (result?.ok) {
      return {
        ok: true,
        conditionMatched: {
          source: 'gate_fallback',
          kind: 'worker_group',
          groupId,
          principal: result.principal,
        },
      };
    }
    if (!firstFailure) firstFailure = result;
  }
  return {
    ok: false,
    response: responseJson(deps, {
      error: 'Access denied: worker group gate failed.',
      reason: firstFailure?.reason || 'worker_group_membership_denied',
    }, 403, baseHeaders),
  };
};

const resolveBareRoleGateCondition = (config = {}) => {
  const profile = isObj(config?.storageProfile) ? config.storageProfile : {};
  const cloudflare = isObj(profile.cloudflare) ? profile.cloudflare : {};
  const payloadAccessControl = isObj(profile.payloadAccessControl) ? profile.payloadAccessControl : {};
  return {
    kind: 'worker_role',
    role: trim(
      payloadAccessControl.role ||
      payloadAccessControl.workerRole ||
      payloadAccessControl.roleName ||
      cloudflare.role ||
      cloudflare.workerRole ||
      config.storageRoleGate ||
      config.workerRoleGate ||
      'admin'
    ) || 'admin',
  };
};

const authorizeWorkerRoleAccess = ({ config, requesterAddress, baseHeaders, deps }) => {
  const roleAccess = evaluateWorkerRoleCondition({
    condition: resolveBareRoleGateCondition(config),
    config,
    requesterAddress,
  });
  if (!roleAccess.ok) {
    return {
      ok: false,
      response: responseJson(deps, {
        error: 'Access denied: worker role gate failed.',
        reason: roleAccess.reason || 'worker_role_denied',
      }, roleAccess.reason === 'missing_principal' ? 401 : 403, baseHeaders),
    };
  }
  return {
    ok: true,
    conditionMatched: {
      source: 'gate_fallback',
      ...(roleAccess.matchedCondition || resolveBareRoleGateCondition(config)),
    },
  };
};

const authorizeCloudflareStorageAccess = async ({
  env,
  config,
  slug,
  resource,
  requesterAddress,
  authScopes,
  metadata,
  baseHeaders,
  deps,
}) => {
  const access = resolvePayloadAccessControl(config);
  const payloadConditions = resolvePayloadAccessConditions({ metadata, access });
  if (payloadConditions.document) {
    const conditionResult = await evaluateAccessConditionDocument({
      document: payloadConditions.document,
      source: payloadConditions.source,
      env,
      slug,
      config,
      requesterAddress,
      authScopes,
      deps,
    });
    if (conditionResult.ok) {
      return {
        ok: true,
        mode: access.mode,
        payloadAccessControl: access,
        conditionMatched: conditionResult.conditionMatched,
      };
    }
    return {
      ok: false,
      response: responseJson(deps, {
        error: 'Access denied: Cloudflare storage conditions failed.',
        reason: conditionResult.reason,
      }, 403, baseHeaders),
    };
  }
  if (access.encryption === PAYLOAD_ENCRYPTION_MODES.LIT) {
    return { ok: true, mode: access.mode, payloadAccessControl: access };
  }
  if (access.gate === PAYLOAD_ACCESS_GATES.NONE) {
    return { ok: true, mode: access.mode, payloadAccessControl: access };
  }
  if (access.gate === PAYLOAD_ACCESS_GATES.GROUP_GATE) {
    const groupAccess = await authorizeWorkerGroupAccess({
      env,
      slug,
      groupIds: resolveGroupGateIds({ metadata, access }),
      requesterAddress,
      authScopes,
      baseHeaders,
      deps,
    });
    if (!groupAccess.ok) return groupAccess;
    return {
      ok: true,
      mode: access.mode,
      payloadAccessControl: access,
      conditionMatched: groupAccess.conditionMatched,
    };
  }
  if (access.gate === PAYLOAD_ACCESS_GATES.ROLE_GATE) {
    const roleAccess = authorizeWorkerRoleAccess({
      config,
      requesterAddress,
      baseHeaders,
      deps,
    });
    if (!roleAccess.ok) return roleAccess;
    return {
      ok: true,
      mode: access.mode,
      payloadAccessControl: access,
      conditionMatched: roleAccess.conditionMatched,
    };
  }
  if (access.gate !== PAYLOAD_ACCESS_GATES.SBT_GATE) {
    return {
      ok: false,
      response: responseJson(deps, { error: 'Access denied: unsupported Cloudflare storage gate.' }, 403, baseHeaders),
    };
  }
  const address = trim(requesterAddress);
  if (!address) {
    return {
      ok: false,
      response: responseJson(deps, { error: 'Missing requester address for worker SBT gate.' }, 401, baseHeaders),
    };
  }
  const gateRead = await readStorageGate({ config, slug, resource, deps });
  if (!gateRead.ok || !gateRead.gate) {
    return {
      ok: false,
      response: responseJson(deps, { error: gateRead.error || 'Cloudflare worker SBT gate unavailable.' }, gateRead.status || 403, baseHeaders),
    };
  }
  const gate = gateRead.gate;
  if (!gate.sbtAddresses.length) {
    return {
      ok: true,
      mode: access.mode,
      payloadAccessControl: access,
      gateKey: gateRead.resourceKey,
      conditionMatched: { source: 'gate_fallback', kind: 'sbt_onchain', resourceKey: gateRead.resourceKey, emptyGate: true },
    };
  }
  const rpcUrls = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate(config, gate.chainId)
    : [];
  if (!rpcUrls.length || typeof deps?.checkSbtGate !== 'function') {
    return {
      ok: false,
      response: responseJson(deps, { error: 'Missing RPC URL for Cloudflare worker SBT gate.' }, 403, baseHeaders),
    };
  }
  for (const rpcUrl of rpcUrls) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await deps.checkSbtGate({
      sbtAddresses: gate.sbtAddresses,
      address,
      rpcUrl,
      mode: gate.mode,
      chainId: gate.chainId,
    });
    if (ok) {
      return {
        ok: true,
        mode: access.mode,
        payloadAccessControl: access,
        gateKey: gateRead.resourceKey,
        conditionMatched: { source: 'gate_fallback', kind: 'sbt_onchain', resourceKey: gateRead.resourceKey },
      };
    }
  }
  return {
    ok: false,
    response: responseJson(deps, { error: 'Access denied: Cloudflare worker SBT gate failed.' }, 403, baseHeaders),
  };
};

const enforceCloudflareUploadPolicy = async ({ env, config, slug, payload, requesterAddress, authScopes, baseHeaders, deps }) => {
  const policy = payload?.uploadPolicy;
  if (!policy?.mode) return { ok: true };
  if (policy.mode === 'group_allowlist') {
    const groupIds = normalizeGroupIdList([...policy.groupIds, ...normalizeGroupIdList(payload?.groupIds)]);
    const groupAccess = await authorizeWorkerGroupAccess({
      env,
      slug,
      groupIds,
      requesterAddress,
      authScopes,
      baseHeaders,
      deps,
    });
    if (!groupAccess.ok) return groupAccess;
    return { ok: true, conditionMatched: groupAccess.conditionMatched, groupIds };
  }
  if (policy.mode === 'sbt_allowlist') {
    const address = normalizeAddress(requesterAddress);
    if (!address) {
      return {
        ok: false,
        response: responseJson(deps, { error: 'Missing requester address for SBT upload policy.' }, 401, baseHeaders),
      };
    }
    if (!policy.sbtAddresses.length) {
      return {
        ok: false,
        response: responseJson(deps, { error: 'Invalid SBT upload policy.', reason: 'missing_sbt_upload_policy_contract' }, 400, baseHeaders),
      };
    }
    const chainId = policy.chainId || null;
    const rpcUrls = typeof deps?.resolveRpcUrlListForGate === 'function'
      ? deps.resolveRpcUrlListForGate(config, chainId)
      : [];
    if (!rpcUrls.length || typeof deps?.checkSbtGate !== 'function') {
      return {
        ok: false,
        response: responseJson(deps, { error: 'Missing RPC URL for SBT upload policy.', reason: 'missing_sbt_rpc' }, 403, baseHeaders),
      };
    }
    for (const rpcUrl of rpcUrls) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await deps.checkSbtGate({
        sbtAddresses: policy.sbtAddresses,
        address,
        rpcUrl,
        mode: policy.anyOrAll,
        chainId,
      });
      if (ok) return { ok: true };
    }
    return {
      ok: false,
      response: responseJson(deps, { error: 'Access denied: SBT upload policy failed.', reason: 'sbt_upload_policy_denied' }, 403, baseHeaders),
    };
  }
  return {
    ok: false,
    response: responseJson(deps, { error: 'Unsupported upload policy.', reason: 'unsupported_upload_policy' }, 400, baseHeaders),
  };
};

const responseJson = (deps, body, status, headers) => deps?.json?.(body, status, headers) || new Response(JSON.stringify(body), { status, headers });

const parseArweaveUploadResponse = async (response) => {
  let body = {};
  try { body = await response.clone().json(); } catch { body = {}; }
  const id = trim(body.id || body.txId || body.arweaveTxId || body.url || body.arweaveUrl);
  return { body, id };
};

const handleArweaveStorageUpload = async ({ request, env, config, slug, uploaderAddress, backend, payload, baseHeaders, deps }) => {
  const secrets = (await deps?.getSessionSecrets?.(env, slug)) || {};
  const response = await deps?.arweaveUpload?.({
    request,
    env,
    secrets,
    baseHeaders,
    config,
    slug,
    uploaderAddress,
  });
  if (!response?.ok) return response;
  const parsed = await parseArweaveUploadResponse(response);
  if (!parsed.id) return responseJson(deps, { error: 'Storage upload succeeded but no id was returned.' }, 502, baseHeaders);
  const compatible = attachStorageRefCompatibilityFields({
    backend,
    arweaveTxId: parsed.id,
    contentType: payload?.contentType,
    resource: payload?.resource,
    gate: payload?.gate,
    encrypted: backend === STORAGE_BACKENDS.LIT_ARWEAVE,
  });
  return responseJson(deps, {
    id: parsed.id,
    ...compatible,
  }, 200, baseHeaders);
};

const handleCloudflareUpload = async ({ env, config, slug, uploaderAddress, authScopes, payload, baseHeaders, deps }) => {
  const r2 = getStorageR2Binding(env);
  const index = getStorageIndexBinding(env);
  const canWriteR2 = !!r2 && typeof r2.put === 'function';
  const canWriteKvPayload = !!index && typeof index.put === 'function';
  if (!canWriteR2 && !canWriteKvPayload) {
    return responseJson(deps, { error: 'Cloudflare storage binding not configured.' }, 501, baseHeaders);
  }
  const access = await authorizeCloudflareStorageAccess({
    env,
    config,
    slug,
    resource: payload.resource,
    requesterAddress: uploaderAddress,
    authScopes,
    metadata: payload.accessConditions ? { accessConditions: payload.accessConditions } : null,
    baseHeaders,
    deps,
  });
  if (!access.ok) return access.response;
  const uploadPolicy = await enforceCloudflareUploadPolicy({
    env,
    config,
    slug,
    payload,
    requesterAddress: uploaderAddress,
    authScopes,
    baseHeaders,
    deps,
  });
  if (!uploadPolicy.ok) return uploadPolicy.response;
  const payloadAccess = resolvePayloadAccessControl(config);
  if (payloadAccess.encryption === PAYLOAD_ENCRYPTION_MODES.LIT && payload.payloadEncrypted !== true) {
    return responseJson(deps, { error: 'Cloudflare lit_encrypted storage requires payloadEncrypted=true.' }, 400, baseHeaders);
  }

  let id = '';
  try {
    id = buildCloudflareStorageId({
      randomBytes: deps?.randomBytes,
      getRandomValues: deps?.getRandomValues,
    });
  } catch {
    return responseJson(deps, { error: 'Secure randomness is required for Cloudflare storage references.' }, 500, baseHeaders);
  }
  if (!isSafeCloudflareStorageRefId(id)) {
    return responseJson(deps, { error: 'Failed to create safe Cloudflare storage reference.' }, 500, baseHeaders);
  }
  const createdAt = new Date((deps?.now?.() || Date.now())).toISOString();
  const objectKey = buildObjectKey({ slug, id });
  const resource = trim(payload.resource) || 'docsContext';
  const storageLayer = canWriteR2 ? 'r2' : 'kv';
  let bytesToStore = payload.bytes || new Uint8Array();
  let envelope = null;
  let accessConditions = payload.accessConditions || null;
  let conditionRef = accessConditions?.conditions?.length ? 'payload' : 'gate_fallback';
  if (!accessConditions?.conditions?.length && payloadAccess.conditions?.conditions?.length) {
    accessConditions = payloadAccess.conditions;
    conditionRef = 'session';
  }
  if (payloadAccess.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE) {
    try {
      const encrypted = await encryptPayloadWithStorageEnvelope({
        env,
        config,
        slug,
        payloadId: id,
        plaintextBytes: bytesToStore,
        contentType: payload.contentType,
        accessConditions,
        conditionRef,
        deps,
      });
      bytesToStore = encrypted.ciphertextBytes;
      envelope = encrypted.envelope;
    } catch (error) {
      return responseJson(deps, { error: error?.message || 'Cloudflare worker envelope encryption failed.' }, 500, baseHeaders);
    }
  }
  const metadata = {
    id,
    backend: STORAGE_BACKENDS.CLOUDFLARE,
    resource,
    contentType: trim(payload.contentType) || 'application/octet-stream',
    encrypted: payload.payloadEncrypted === true || payloadAccess.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE,
    gate: trim(payload.gate),
    tags: payload.tags,
    groupIds: normalizeGroupIdList([
      ...normalizeGroupIdList(payload.groupIds),
      ...normalizeGroupIdList(uploadPolicy.groupIds),
      ...normalizeGroupIdList(payloadAccess.groupIds),
    ]),
    uploadPolicy: payload.uploadPolicy?.mode ? payload.uploadPolicy : undefined,
    size: bytesToStore?.length || 0,
    createdAt,
    payloadAccessMode: payloadAccess.mode,
    payloadAccessControl: {
      gate: payloadAccess.gate,
      encryption: payloadAccess.encryption,
      ...(payloadAccess.groupIds.length ? { groupIds: payloadAccess.groupIds } : {}),
    },
    ...(accessConditions?.conditions?.length ? { accessConditions } : {}),
    ...(envelope ? { envelope } : {}),
    storageLayer,
  };
  assertNoCloudflarePrivateMaterial({
    id,
    backend: metadata.backend,
    resource,
    contentType: metadata.contentType,
    gate: metadata.gate,
    createdAt,
    payloadAccessMode: payloadAccess.mode,
    payloadAccessControl: metadata.payloadAccessControl,
  });

  if (canWriteR2) {
    await r2.put(objectKey, bytesToStore, {
      httpMetadata: { contentType: metadata.contentType },
      customMetadata: {
        id,
        resource,
        encrypted: metadata.encrypted ? 'true' : 'false',
        payloadAccessMode: payloadAccess.mode,
        payloadAccessControl: JSON.stringify(metadata.payloadAccessControl),
        groupIds: metadata.groupIds?.length ? JSON.stringify(metadata.groupIds) : '',
      },
    });
  } else {
    await index.put(buildPayloadKey({ slug, id }), JSON.stringify({
      metadata,
      payloadBase64url: bytesToBase64url(bytesToStore || new Uint8Array()),
    }));
  }

  if (index && typeof index.put === 'function') {
    await index.put(buildIndexKey({ slug, resource, id }), JSON.stringify(metadata));
  }

  const storageRef = normalizeStorageRef(metadata);
  return responseJson(deps, {
    id,
    storageRef,
  }, 200, baseHeaders);
};

const readRequestId = async ({ request, url }) => {
  const fromQuery = trim(url.searchParams.get('id') || url.searchParams.get('storageId'));
  if (fromQuery) return fromQuery;
  if (request.method.toUpperCase() !== 'POST') return '';
  try {
    const body = await (typeof request?.clone === 'function' ? request.clone() : request).json();
    return trim(body?.id || body?.storageId || body?.storageRef?.id);
  } catch {
    return '';
  }
};

const readListResource = async ({ request, url }) => {
  const fromQuery = trim(url.searchParams.get('resource'));
  if (fromQuery) return { ok: true, resource: fromQuery };
  if (request.method.toUpperCase() !== 'POST') return { ok: true, resource: 'docsContext' };

  let raw = '';
  try {
    raw = await (typeof request?.clone === 'function' ? request.clone() : request).text();
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  if (!trim(raw)) return { ok: true, resource: 'docsContext' };

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  if (!isObj(body)) return { ok: false, error: 'Invalid JSON.' };
  return { ok: true, resource: trim(body.resource) || 'docsContext' };
};

const handleCloudflareRead = async ({ request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps }) => {
  const url = new URL(request.url);
  const id = await readRequestId({ request, url });
  if (!isSafeCloudflareStorageRefId(id)) return responseJson(deps, { error: 'Invalid storage id.' }, 400, baseHeaders);
  const r2 = getStorageR2Binding(env);
  const index = getStorageIndexBinding(env);
  const canReadR2 = !!r2 && typeof r2.get === 'function';
  const canReadKvPayload = !!index && typeof index.get === 'function';
  if (!canReadR2 && !canReadKvPayload) {
    return responseJson(deps, { error: 'Cloudflare storage binding not configured.' }, 501, baseHeaders);
  }
  let object = null;
  let metadata = null;
  let body = null;
  if (canReadR2) {
    object = await r2.get(buildObjectKey({ slug, id }));
    if (object) {
      metadata = {
        resource: trim(object?.customMetadata?.resource) || 'docsContext',
        contentType: trim(object?.httpMetadata?.contentType || object?.customMetadata?.contentType) || 'application/octet-stream',
        payloadAccessMode: trim(object?.customMetadata?.payloadAccessMode),
      };
      if (trim(object?.customMetadata?.payloadAccessControl)) {
        try {
          metadata.payloadAccessControl = JSON.parse(object.customMetadata.payloadAccessControl);
        } catch {
          metadata.payloadAccessControl = null;
        }
      }
      body = object?.body || object;
      if (typeof object?.arrayBuffer === 'function') {
        body = await object.arrayBuffer();
      } else if (typeof object?.text === 'function') {
        body = await object.text();
      }
      if (canReadKvPayload) {
        try {
          const indexed = JSON.parse(await index.get(buildIndexKey({ slug, resource: metadata.resource, id })) || 'null');
          if (isObj(indexed)) metadata = { ...metadata, ...indexed };
        } catch {
          // R2 custom metadata remains the compatibility fallback.
        }
      }
    }
  }
  if (!object && canReadKvPayload) {
    const envelope = await readKvPayloadEnvelope({ index, slug, id });
    if (!envelope || !isObj(envelope?.metadata)) {
      return responseJson(deps, { error: 'Storage object not found.' }, 404, baseHeaders);
    }
    metadata = envelope.metadata;
    body = base64urlToBytes(envelope.payloadBase64url);
  } else if (!object && !canReadKvPayload) {
    return responseJson(deps, { error: 'Storage object not found.' }, 404, baseHeaders);
  }
  const resource = trim(metadata?.resource) || 'docsContext';
  const access = await authorizeCloudflareStorageAccess({
    env,
    config,
    slug,
    resource,
    requesterAddress: uploaderAddress,
    authScopes,
    metadata,
    baseHeaders,
    deps,
  });
  if (!access.ok) return access.response;
  let responseBody = body;
  const resolvedAccess = normalizePayloadAccessControl(
    metadata?.payloadAccessControl || metadata?.payloadAccessMode || resolvePayloadAccessControl(config)
  );
  if (resolvedAccess.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE) {
    try {
      await writeStorageEnvelopeKeyReleaseAudit({
        env,
        slug,
        payloadId: id,
        principal: uploaderAddress,
        conditionMatched: access.conditionMatched || 'gate_fallback',
        deps,
      });
      responseBody = await decryptPayloadWithStorageEnvelope({
        env,
        config,
        slug,
        payloadId: id,
        ciphertextBytes: await toUint8Array(body),
        envelope: metadata?.envelope,
        deps,
      });
    } catch (error) {
      return responseJson(deps, { error: error?.message || 'Cloudflare worker envelope decrypt failed.' }, 403, baseHeaders);
    }
  }
  const contentType = trim(metadata?.contentType) || 'application/octet-stream';
  return new Response(responseBody, {
    status: 200,
    headers: {
      ...baseHeaders,
      'Content-Type': contentType,
      'X-CE-Storage-Backend': STORAGE_BACKENDS.CLOUDFLARE,
      'X-CE-Storage-Ref': id,
      'X-CE-Payload-Access-Mode': deriveLegacyPayloadAccessMode(resolvedAccess),
      ...(resolvedAccess.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE
        ? { 'Cache-Control': 'private, no-store' }
        : {}),
    },
  });
};

const handleCloudflareList = async ({ request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps }) => {
  const url = new URL(request.url);
  const resolvedResource = await readListResource({ request, url });
  if (!resolvedResource.ok) return responseJson(deps, { error: resolvedResource.error }, 400, baseHeaders);
  const resource = resolvedResource.resource;
  const access = await authorizeCloudflareStorageAccess({
    env,
    config,
    slug,
    resource,
    requesterAddress: uploaderAddress,
    authScopes,
    baseHeaders,
    deps,
  });
  if (!access.ok) return access.response;
  const index = getStorageIndexBinding(env);
  if (!index || typeof index.list !== 'function') {
    return responseJson(deps, { error: 'Cloudflare storage index binding not configured.' }, 501, baseHeaders);
  }
  const listed = await index.list({ prefix: buildIndexPrefix({ slug, resource }) });
  const keys = Array.isArray(listed?.keys) ? listed.keys : [];
  const items = [];
  for (const keyEntry of keys) {
    const name = trim(keyEntry?.name || keyEntry);
    if (!name || typeof index.get !== 'function') continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const raw = await index.get(name);
      const metadata = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const storageRef = normalizeStorageRef(metadata || {});
      if (!storageRef) continue;
      const itemAccess = await authorizeCloudflareStorageAccess({
        env,
        config,
        slug,
        resource: storageRef.resource || trim(metadata?.resource) || resource,
        requesterAddress: uploaderAddress,
        authScopes,
        metadata,
        baseHeaders,
        deps,
      });
      if (!itemAccess.ok) continue;
      const metadataAccess = normalizePayloadAccessControl(
        metadata?.payloadAccessControl ||
        metadata?.payloadAccessMode ||
        resolvePayloadAccessControl(config)
      );
      items.push({
        storageRef,
        metadata: {
          resource: storageRef.resource || resource,
          contentType: trim(metadata?.contentType),
          encrypted: metadata?.encrypted === true,
          tags: normalizeTagsForMetadata(metadata?.tags),
          size: Number(metadata?.size || 0) || 0,
          createdAt: trim(metadata?.createdAt),
          payloadAccessControl: {
            gate: metadataAccess.gate,
            encryption: metadataAccess.encryption,
          },
          payloadAccessMode: deriveLegacyPayloadAccessMode(metadataAccess),
        },
      });
    } catch {
      // ignore malformed index rows
    }
  }
  return responseJson(deps, { items }, 200, baseHeaders);
};

const listCloudflareMetadataRows = async ({ index, slug, resource = '' }) => {
  const rows = [];
  const prefix = trim(resource)
    ? buildIndexPrefix({ slug, resource })
    : buildSessionIndexPrefix({ slug });
  let cursor = '';
  do {
    // eslint-disable-next-line no-await-in-loop
    const listed = await index.list({
      prefix,
      ...(cursor ? { cursor } : {}),
    });
    const keys = Array.isArray(listed?.keys) ? listed.keys : [];
    for (const keyEntry of keys) {
      const key = trim(keyEntry?.name || keyEntry);
      if (!key || typeof index.get !== 'function') continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        const raw = await index.get(key);
        const metadata = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (isObj(metadata) && trim(metadata.id)) rows.push({ key, metadata });
      } catch {
        rows.push({ key, metadata: null, error: 'invalid_metadata' });
      }
    }
    cursor = listed?.list_complete === false ? trim(listed?.cursor) : '';
  } while (cursor);
  return rows;
};

const readStoredCloudflarePayloadBytes = async ({ env, index, slug, metadata }) => {
  const id = trim(metadata?.id);
  if (!id) return null;
  const r2 = getStorageR2Binding(env);
  if (r2 && typeof r2.get === 'function') {
    const object = await r2.get(buildObjectKey({ slug, id }));
    if (object) return toUint8Array(object);
  }
  const envelope = await readKvPayloadEnvelope({ index, slug, id });
  if (envelope?.payloadBase64url) return base64urlToBytes(envelope.payloadBase64url);
  return null;
};

const resolveEnvelopeExportKeyProvider = ({ metadataAccess, metadata, config }) => {
  const explicit = trim(metadata?.envelope?.keyProvider);
  if (explicit) return explicit;
  if (metadataAccess?.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE) {
    return trim(config?.storageEnvelope?.keyProvider || 'worker_secret');
  }
  if (metadataAccess?.encryption === PAYLOAD_ENCRYPTION_MODES.LIT) return 'lit';
  return '';
};

const resolveEnvelopeExportManifestKeyProvider = ({ sessionEnvelope, payloads }) => {
  const providers = new Set();
  const sessionProvider = trim(sessionEnvelope?.keyProvider);
  if (sessionProvider) providers.add(sessionProvider);
  for (const payload of payloads || []) {
    const provider = trim(payload?.keyProvider);
    if (provider) providers.add(provider);
  }
  if (providers.size > 1) return 'mixed';
  return [...providers][0] || 'worker_secret';
};

export const exportCloudflareEncryptedPayloadEnvelopes = async ({
  env,
  config,
  slug,
  resource = '',
  includeSessionEnvelope = true,
  deps = {},
} = {}) => {
  const configuredBackend = resolveConfiguredStorageBackend({ config });
  if (configuredBackend !== STORAGE_BACKENDS.CLOUDFLARE) {
    return {
      ok: false,
      status: 400,
      error: 'Encrypted-envelope export is only available for Cloudflare storage.',
    };
  }
  const index = getStorageIndexBinding(env);
  if (!index || typeof index.list !== 'function' || typeof index.get !== 'function') {
    return {
      ok: false,
      status: 501,
      error: 'Cloudflare storage index binding not configured.',
    };
  }
  const generatedAt = new Date((deps?.now?.() || Date.now())).toISOString();
  let rows = [];
  let storageListError = null;
  try {
    rows = await listCloudflareMetadataRows({ index, slug, resource });
  } catch (error) {
    storageListError = { reason: error?.message || 'storage_list_failed' };
  }
  const payloads = [];
  const readErrors = [];
  let encryptedPayloadCount = 0;
  for (const row of rows) {
    if (!row.metadata) {
      readErrors.push({ key: row.key, error: row.error || 'invalid_metadata' });
      continue;
    }
    const metadataAccess = normalizePayloadAccessControl(
      row.metadata.payloadAccessControl ||
      row.metadata.payloadAccessMode ||
      resolvePayloadAccessControl(config)
    );
    if (metadataAccess.encryption === PAYLOAD_ENCRYPTION_MODES.NONE) continue;
    encryptedPayloadCount += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      const ciphertextBytes = await readStoredCloudflarePayloadBytes({ env, index, slug, metadata: row.metadata });
      if (!ciphertextBytes) {
        readErrors.push({ id: trim(row.metadata.id), error: 'payload_bytes_missing' });
        continue;
      }
      const keyProvider = resolveEnvelopeExportKeyProvider({ metadataAccess, metadata: row.metadata, config });
      payloads.push({
        storageRef: normalizeStorageRef(row.metadata),
        metadata: {
          id: trim(row.metadata.id),
          resource: trim(row.metadata.resource),
          contentType: trim(row.metadata.contentType) || 'application/octet-stream',
          encrypted: row.metadata.encrypted === true,
          createdAt: trim(row.metadata.createdAt),
          size: Number(row.metadata.size || ciphertextBytes.length || 0) || 0,
          payloadAccessControl: {
            gate: metadataAccess.gate,
            encryption: metadataAccess.encryption,
          },
          payloadAccessMode: deriveLegacyPayloadAccessMode(metadataAccess),
          ...(row.metadata.accessConditions ? { accessConditions: row.metadata.accessConditions } : {}),
        },
        envelope: isObj(row.metadata.envelope) ? row.metadata.envelope : null,
        ciphertextBase64url: bytesToBase64url(ciphertextBytes),
        keyProvider,
        wrappedKeysIncluded: !!trim(row.metadata.envelope?.dek?.wrappedKey),
      });
    } catch (error) {
      readErrors.push({ id: trim(row.metadata.id), error: error?.message || 'payload_read_failed' });
    }
  }
  const sessionEnvelope = includeSessionEnvelope && isObj(config?.storageEnvelope)
    ? JSON.parse(JSON.stringify(config.storageEnvelope))
    : null;
  const keyProvider = resolveEnvelopeExportManifestKeyProvider({ sessionEnvelope, payloads });
  const manifest = {
    type: 'ce_storage_encrypted_envelopes_export',
    version: 1,
    exportScope: 'encrypted_envelopes_only',
    storageBackend: STORAGE_BACKENDS.CLOUDFLARE,
    sessionSlug: safeSlugPart(slug),
    resource: trim(resource) || 'all',
    exportedAt: generatedAt,
    exportedPayloadCount: payloads.length,
    encryptedPayloadCount,
    partial: !!storageListError || readErrors.length > 0,
    storageListError,
    readErrors,
    gatewayErrors: [],
    errors: [
      ...(storageListError ? [storageListError] : []),
      ...readErrors,
    ],
    wrappedKeysIncluded: !!sessionEnvelope?.sessionKey?.wrappedKey || payloads.some((entry) => entry.wrappedKeysIncluded),
    keyProvider,
    rewrapRequiredForNewDeployment: true,
  };
  return {
    ok: true,
    manifest,
    ...(sessionEnvelope ? { sessionEnvelope } : {}),
    payloads,
  };
};

export const storageRoute = async ({ path, method, request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps } = {}) => {
  if (path === '/storage/upload' && method === 'POST') {
    const maxUploadBytes = resolveMaxUploadBytes({ env, deps });
    const uploadPayload = await (deps?.readStorageUploadRequestPayload || readStorageUploadRequestPayload)(request, { maxUploadBytes });
    if (!uploadPayload?.ok) return responseJson(deps, { error: uploadPayload?.error || 'Invalid storage upload payload.' }, uploadPayload?.status || 400, baseHeaders);
    const payload = uploadPayload.payload || {};
    const backend = resolveConfiguredStorageBackend({
      config,
      requestedBackend: payload.backend,
      payloadEncrypted: payload.payloadEncrypted,
    });
    if (isArweaveStorageBackend(backend)) {
      return handleArweaveStorageUpload({ request, env, config, slug, uploaderAddress, backend, payload, baseHeaders, deps });
    }
    return handleCloudflareUpload({ env, config, slug, uploaderAddress, authScopes, payload, baseHeaders, deps });
  }

  const configuredBackend = resolveConfiguredStorageBackend({ config });
  if (configuredBackend !== STORAGE_BACKENDS.CLOUDFLARE) {
    return responseJson(deps, { error: 'Storage route read/list is only available for Cloudflare storage.' }, 400, baseHeaders);
  }
  if (path === '/storage/read' && (method === 'GET' || method === 'POST')) {
    return handleCloudflareRead({ request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps });
  }
  if (path === '/storage/list' && (method === 'GET' || method === 'POST')) {
    return handleCloudflareList({ request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps });
  }
  if (path === '/storage/export-envelopes' && (method === 'GET' || method === 'POST')) {
    if (!isEnvelopeExportAuthorized({ config, requesterAddress: uploaderAddress, authScopes })) {
      return responseJson(deps, { error: 'Encrypted-envelope export requires session export admin authorization.' }, 403, baseHeaders);
    }
    const url = new URL(request.url);
    let resource = trim(url.searchParams.get('resource'));
    if (!resource && method === 'POST') {
      try {
        const body = await request.clone().json();
        resource = trim(body?.resource);
      } catch {
        resource = '';
      }
    }
    const result = await exportCloudflareEncryptedPayloadEnvelopes({
      env,
      config,
      slug,
      resource,
      includeSessionEnvelope: false,
      deps,
    });
    return responseJson(deps, result.ok ? result : { error: result.error }, result.ok ? 200 : (result.status || 500), baseHeaders);
  }

  return responseJson(deps, { error: 'Not found.' }, 404, baseHeaders);
};
