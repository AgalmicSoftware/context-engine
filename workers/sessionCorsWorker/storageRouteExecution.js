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
  base64urlToBytes,
  bytesToBase64url,
  decryptPayloadWithStorageEnvelope,
  encryptPayloadWithStorageEnvelope,
  toUint8Array,
  writeStorageEnvelopeKeyReleaseAudit,
  writeStorageVisibilityAudit,
} from './storageEnvelopeEncryption.js';
import {
  isWorkerGroupMember,
  resolveWorkerGroupPrincipal,
} from './workerGroups.js';
import {
  rejectBytesOverLimit,
  rejectContentLengthOverLimit,
  rejectKvValueOverLimit,
  resolveMaxUploadBytes,
} from './uploadSizeLimits.js';
import {
  attachSessionSecretRpcForGateRuntime,
  canUseSessionSecretRpcForGateRuntime,
  isSessionSecretRpcUrlForGateRuntime,
} from './gateRpcResolution.js';
import {
  resolveChainIdWithLegacyFallback,
  resolveRegistryChainId,
  toChainId,
} from './chainIdNormalization.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import {
  isStorageResourceId,
  readStoragePayloadResourceId,
  validateStorageUploadPayload,
} from './storageUploadValidation.js';
import {
  isOwnedStorageResource,
  isStorageResourceHidden,
  LEGACY_STORAGE_OWNER,
  legacyStorageOwnersMarkerKey,
  listHiddenStorageResourceIds,
  readStorageResourceOwner,
  writeStorageResourceHidden,
  writeStorageResourceOwner,
} from './storageResourceOwnership.js';
import { checkCoordinatedLegacyStorageOwner } from './sessionWriteCoordinator.js';
import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { responseFieldKeyRoute } from './responseFieldKeyRoute.js';
import { toStr } from './stringCoercion.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const RESOLVE_STORAGE_GATE_RUNTIME_CONFIG = Symbol('resolve-storage-gate-runtime-config');
const STORAGE_RPC_CHAIN_ATTESTATION_CACHE = Symbol('storage-rpc-chain-attestation-cache');
const trim = (value) => toStr(value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isJsonContentType = (contentType) => {
  const mediaType = trim(contentType).split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json' || mediaType.endsWith('+json');
};
const MEDIA_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
const INLINE_MEDIA_TYPE_RE = /^(?:application\/(?:pdf|json|[a-z0-9.-]+\+json)|text\/plain|(?:image|audio|video)\/[a-z0-9.+-]+)$/;
// Keeps the declared type (fetch-based readers such as the document library
// rely on it) but serves only JSON, plain text, raster images, audio, video,
// and PDF inline. SVG, HTML, XML, scripts, and unknown types download.
const resolveStorageReadContentType = (storedContentType) => {
  const declared = trim(storedContentType);
  const mediaType = declared.split(';', 1)[0].trim().toLowerCase();
  if (!MEDIA_TYPE_RE.test(mediaType) || !/^[ -~]*$/.test(declared) || declared.includes(',')) {
    return { contentType: 'application/octet-stream', inline: false };
  }
  return {
    contentType: declared,
    inline: INLINE_MEDIA_TYPE_RE.test(mediaType) && !/svg|xml/.test(mediaType),
  };
};

export const getStorageR2Binding = (env = {}) => env.CE_STORAGE_R2 || env.STORAGE_R2 || env.R2_BUCKET || null;
export const getStorageIndexBinding = (env = {}) => env.CE_STORAGE_INDEX_KV || env.STORAGE_INDEX_KV || env.STORAGE_KV || null;
const DEFAULT_STORAGE_LIST_PAGE_SIZE = 100;
const MAX_STORAGE_LIST_PAGE_SIZE = 100;
const DEFAULT_RESOURCE_GATES = Object.freeze({
  docsContext: 'docUploads',
  questions: 'questionResponses',
  surveys: 'surveyResponses',
  responses: 'questionResponses',
  generatedArtifacts: 'surveyResponses',
  media: 'docUploads',
  images: 'docUploads',
});

const isStorageResource = (resource) => Object.hasOwn(DEFAULT_RESOURCE_GATES, trim(resource) || 'docsContext');

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
export const buildObjectKey = ({ slug, id }) => `sessions/${sessionSlugStorageKey(slug)}/storage/${id}`;
export const buildIndexKey = ({ slug, resource, id }) => `ce-storage:${sessionSlugStorageKey(slug)}:${trim(resource) || 'docsContext'}:${id}`;
export const buildIndexPrefix = ({ slug, resource }) => `ce-storage:${sessionSlugStorageKey(slug)}:${trim(resource) || 'docsContext'}:`;
const buildSessionIndexPrefix = ({ slug }) => `ce-storage:${sessionSlugStorageKey(slug)}:`;
export const buildPayloadKey = ({ slug, id }) => `ce-storage-payload:${sessionSlugStorageKey(slug)}:${id}`;
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

const invalidUploadPolicy = (field, detail) => {
  throw new Error(`Invalid ${field}: ${detail}.`);
};

const readUploadGroupIds = (source, fields = ['groupIds', 'groups', 'groupId', 'workerGroupId']) => {
  const lists = fields.map((field) => {
    const raw = source[field];
    if (raw == null) return [];
    const entries = Array.isArray(raw) ? raw : [raw];
    const ids = entries.flatMap((entry) => {
      if (typeof entry !== 'string') return invalidUploadPolicy(field, 'expected group ID text');
      const text = entry.trim();
      if (!text) return [];
      let values = [text];
      if (text.startsWith('[') || text.startsWith('{')) {
        try {
          values = JSON.parse(text);
        } catch {
          return invalidUploadPolicy(field, 'malformed group ID JSON');
        }
        if (!Array.isArray(values)) return invalidUploadPolicy(field, 'expected a group ID array');
      }
      return values.map((value) => {
        if (typeof value !== 'string' || !safeGroupId(value) || value.trim().startsWith('[') || value.trim().startsWith('{')) {
          return invalidUploadPolicy(field, 'expected nonempty group ID text');
        }
        return safeGroupId(value);
      });
    });
    return Array.from(new Set(ids));
  });
  // Validate every supplied alias before choosing one: malformed restrictions
  // must not disappear behind a valid alias or the session fallback policy.
  return lists.find((ids) => ids.length) || [];
};

const readUploadAccessConditions = (input) => {
  if (input == null || (typeof input === 'string' && !input.trim())) return null;
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return invalidUploadPolicy('accessConditions', 'malformed JSON');
    }
  }
  if (raw === null) return null;
  if (!isObj(raw)) return invalidUploadPolicy('accessConditions', 'expected an object');
  if (raw.match !== undefined && (typeof raw.match !== 'string' || !['any', 'all'].includes(raw.match.trim().toLowerCase()))) {
    return invalidUploadPolicy('accessConditions.match', 'expected any or all');
  }
  if (!Array.isArray(raw.conditions) || !raw.conditions.length) {
    return invalidUploadPolicy('accessConditions.conditions', 'expected at least one rule');
  }
  const requireText = (condition, fields) => {
    fields.forEach((field) => {
      if (condition[field] !== undefined && (typeof condition[field] !== 'string' || !condition[field].trim())) {
        invalidUploadPolicy(`accessConditions.${field}`, 'expected nonempty text');
      }
    });
    return fields.some((field) => typeof condition[field] === 'string' && condition[field].trim());
  };
  const conditions = raw.conditions.map((condition) => {
    if (!isObj(condition) || typeof condition.kind !== 'string') {
      return invalidUploadPolicy('accessConditions.conditions', 'expected a rule with a kind');
    }
    const kind = condition.kind.trim().toLowerCase();
    if (kind === 'worker_role') {
      requireText(condition, ['role', 'name']); // Omitted roles retain the legacy admin default.
    } else if (kind === 'agent_grant_scope') {
      if (!requireText(condition, ['scope', 'value'])) return invalidUploadPolicy('accessConditions.scope', 'required');
    } else if (kind === 'worker_group') {
      const groupIds = readUploadGroupIds(condition, ['groupIds', 'groups', 'groupId']);
      if (!groupIds.length) return invalidUploadPolicy('accessConditions.groupIds', 'required');
      return { ...condition, kind, groupIds };
    } else if (kind === 'sbt_onchain') {
      if (condition.sbtAddresses !== undefined && !Array.isArray(condition.sbtAddresses)) {
        return invalidUploadPolicy('accessConditions.sbtAddresses', 'expected an array');
      }
      const contracts = [
        ...(condition.sbtAddresses || []),
        ...['contract', 'address'].filter((field) => condition[field] !== undefined).map((field) => condition[field]),
      ];
      if (
        !contracts.length ||
        contracts.some((value) => typeof value !== 'string' || !/^0x[0-9a-f]{40}$/i.test(value.trim()) || /^0x0{40}$/i.test(value.trim()))
      ) {
        return invalidUploadPolicy('accessConditions.contract', 'expected an SBT contract address');
      }
      for (const field of ['chainId', 'networkChainId']) {
        // Absent/zero chain IDs have historically selected the session chain.
        if (!resolveChainIdWithLegacyFallback(condition[field], 1))
          return invalidUploadPolicy(`accessConditions.${field}`, 'expected a positive chain ID');
      }
      for (const field of ['anyOrAll', 'mode', 'match']) {
        if (condition[field] !== undefined && !['any', 'all', '0', '1'].includes(trim(condition[field]).toLowerCase())) {
          return invalidUploadPolicy(`accessConditions.${field}`, 'expected any or all');
        }
      }
    } else {
      return invalidUploadPolicy('accessConditions.kind', 'unsupported rule');
    }
    return { ...condition, kind };
  });
  return { match: raw.match?.trim().toLowerCase() || 'any', conditions };
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
    chainId: resolveChainIdWithLegacyFallback(
      raw.chainId,
      resolveChainIdWithLegacyFallback(raw.networkChainId, 0),
    ) || null,
    anyOrAll: normalizeGateMode(raw.anyOrAll || raw.match || raw.gateMode),
  };
};

const readUploadPolicyFields = (source) => {
  try {
    const conditions = [source.accessConditions, source.conditions].map(readUploadAccessConditions);
    const groupIds = readUploadGroupIds(source);
    const policies = [source.uploadPolicy, source.documentUploadPolicy, source.policy].map((input) => {
      if (input == null || (typeof input === 'string' && !input.trim())) return null;
      let raw = input;
      if (typeof raw === 'string') {
        if (['group_allowlist', 'sbt_allowlist'].includes(raw.trim().toLowerCase())) {
          raw = { mode: raw };
        } else {
          try {
            raw = JSON.parse(raw);
          } catch {
            return invalidUploadPolicy('uploadPolicy', 'expected a supported mode or JSON object');
          }
        }
      }
      if (raw === null) return null;
      if (!isObj(raw)) return invalidUploadPolicy('uploadPolicy', 'expected an object');
      for (const field of ['mode', 'kind', 'type']) {
        if (raw[field] !== undefined && (typeof raw[field] !== 'string' || !['group_allowlist', 'sbt_allowlist'].includes(raw[field].trim().toLowerCase()))) {
          return invalidUploadPolicy(`uploadPolicy.${field}`, 'expected group_allowlist or sbt_allowlist');
        }
      }
      const policy = normalizeUploadPolicy(raw);
      if (!policy) return invalidUploadPolicy('uploadPolicy.mode', 'required');
      policy.groupIds = readUploadGroupIds(raw, ['groupIds', 'groups', 'groupId']);
      return policy;
    });
    return {
      ok: true,
      fields: { accessConditions: conditions.find(Boolean) || null, groupIds, uploadPolicy: policies.find(Boolean) || null },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
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
  const policy = readUploadPolicyFields(raw);
  if (!policy.ok) return policy;
  return {
    ok: true,
    payload: {
      bytes,
      contentType,
      backend: raw.backend || raw.storageBackend || raw.storage,
      resource: trim(raw.resource) || 'docsContext',
      gate: raw.gate || raw.gateResource || raw.resourceGate,
      tags: normalizeTagsForMetadata(raw.tags),
      ...policy.fields,
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
  // Only list fields may repeat. get() alone would silently discard a second
  // restriction, including malformed values that must fail validation.
  for (const field of ['accessConditions', 'conditions', 'uploadPolicy', 'documentUploadPolicy', 'policy', 'groupId', 'workerGroupId']) {
    if (form.getAll(field).length > 1) return { ok: false, error: `Invalid ${field}: must occur at most once.` };
  }
  const fileOrBlob = form.get('file') || form.get('data');
  if (!fileOrBlob || typeof fileOrBlob.arrayBuffer !== 'function') {
    return { ok: false, error: 'Missing "file" or "data" field.' };
  }
  const buf = await fileOrBlob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const tooLarge = rejectBytesOverLimit({ bytes, maxUploadBytes });
  if (tooLarge) return tooLarge;
  const policy = readUploadPolicyFields({
    accessConditions: form.get('accessConditions'),
    conditions: form.get('conditions'),
    groupIds: form.getAll('groupIds'),
    groups: form.getAll('groups'),
    groupId: form.get('groupId'),
    workerGroupId: form.get('workerGroupId'),
    uploadPolicy: form.get('uploadPolicy'),
    documentUploadPolicy: form.get('documentUploadPolicy'),
    policy: form.get('policy'),
  });
  if (!policy.ok) return policy;
  return {
    ok: true,
    payload: {
      bytes,
      contentType: trim(form.get('contentType')) || fileOrBlob.type || 'application/octet-stream',
      backend: form.get('backend') || form.get('storageBackend') || form.get('storage'),
      resource: trim(form.get('resource')) || 'docsContext',
      gate: form.get('gate') || form.get('gateResource') || form.get('resourceGate'),
      tags: normalizeTagsForMetadata(form.get('tags')),
      ...policy.fields,
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
    payloadAccessControl.mode || cloudflare.payloadAccessMode || profile.payloadAccessMode || profile.accessControlMode,
  );
  const accessControl = (
    Object.prototype.hasOwnProperty.call(payloadAccessControl, 'gate') ||
    Object.prototype.hasOwnProperty.call(payloadAccessControl, 'encryption')
  )
    ? normalizePayloadAccessControl(payloadAccessControl, legacyMode)
    : normalizePayloadAccessControl(legacyMode);
  const resourceGates = isObj(payloadAccessControl.resources) ? payloadAccessControl.resources : {};
  const conditions = normalizeAccessConditionDocument(
    payloadAccessControl.accessConditions || payloadAccessControl.conditions || cloudflare.accessConditions || profile.accessConditions,
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
    chainId: toChainId(gate.chainId) || null,
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
    expectedChainId: resolveRegistryChainId(config),
    chainAttestationCache: deps?.[STORAGE_RPC_CHAIN_ATTESTATION_CACHE],
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

export const resolveSessionAdminAddresses = (config = {}) => resolveRoleAddressSet({ config, role: 'admin' });

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
  const chainId = resolveChainIdWithLegacyFallback(
    condition.chainId,
    resolveChainIdWithLegacyFallback(condition.networkChainId, resolveRegistryChainId(config)),
  ) || null;
  if (!chainId) {
    return {
      ok: false,
      reason: 'invalid_sbt_chain',
      condition: { kind: 'sbt_onchain', chainId: null },
    };
  }
  let gateConfig = config;
  try {
    gateConfig = await resolveStorageGateRuntimeConfig({ config, deps });
  } catch {
    return { ok: false, reason: 'sbt_rpc_secret_unavailable' };
  }
  const rpcUrls = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate(gateConfig, chainId)
    : [];
  if (!rpcUrls.length || typeof deps?.checkSbtGate !== 'function') {
    return { ok: false, reason: 'missing_sbt_rpc' };
  }
  const mode = normalizeGateMode(condition.anyOrAll || condition.mode || condition.match);
  for (const rpcUrl of rpcUrls) {
    const ok = await deps.checkSbtGate({
      sbtAddresses,
      address,
      rpcUrl,
      mode,
      chainId,
      rpcUrlIsPrivate: isSessionSecretRpcUrlForGateRuntime({
        config: gateConfig,
        gateChainId: chainId,
        rpcUrl,
      }),
      chainAttestationCache: deps?.[STORAGE_RPC_CHAIN_ATTESTATION_CACHE],
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

const checkWorkerGroupMembership = async ({
  env,
  slug,
  config,
  groupId,
  requesterAddress,
  authScopes,
  deps,
}) => {
  const check = typeof deps?.isWorkerGroupMember === 'function' ? deps.isWorkerGroupMember : isWorkerGroupMember;
  return check({
    env,
    slug,
    sessionId: resolveCanonicalWorkerSessionIdHex(config),
    groupId,
    requesterAddress,
    authScopes,
    deps,
  });
};

const evaluateWorkerGroupCondition = async ({
  condition,
  env,
  slug,
  config,
  requesterAddress,
  authScopes,
  deps,
}) => {
  const groupIds = normalizeGroupIdList(condition.groupIds || condition.groups || condition.groupId);
  if (!groupIds.length) return { ok: false, reason: 'missing_worker_group', condition: { kind: 'worker_group' } };
  let firstFailure = null;
  for (const groupId of groupIds) {
    const result = await checkWorkerGroupMembership({
      env,
      slug,
      config,
      groupId,
      requesterAddress,
      authScopes,
      deps,
    });
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
    return evaluateWorkerGroupCondition({
      condition,
      env,
      slug,
      config,
      requesterAddress,
      authScopes,
      deps,
    });
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

const authorizeWorkerGroupAccess = async ({
  env,
  slug,
  config,
  groupIds,
  requesterAddress,
  authScopes,
  baseHeaders,
  deps,
}) => {
  if (!groupIds.length) {
    return {
      ok: false,
      response: responseJson(deps, { error: 'Access denied: missing worker group.' }, 403, baseHeaders),
    };
  }
  let firstFailure = null;
  for (const groupId of groupIds) {
    const result = await checkWorkerGroupMembership({
      env,
      slug,
      config,
      groupId,
      requesterAddress,
      authScopes,
      deps,
    });
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
          'admin',
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

const hasPrivateResponsePolicy = ({ config, resource }) => {
  const profile = config?.sessionModeProfile;
  return trim(resource) === 'responses' && profile?.authority?.mode === 'worker_canonical' &&
    !!profile?.results?.visibility && profile.results.visibility !== 'public_full_if_storage_public';
};

const canReadPrivateResponse = ({ config, resource, metadata, requesterAddress, authScopes, operation }) => {
  if (operation === 'upload' || !hasPrivateResponsePolicy({ config, resource })) return true;

  const scopes = isObj(authScopes) ? authScopes : {};
  const address = normalizeAddress(requesterAddress);
  if (address && resolveRoleAddressSet({ config, role: 'admin' }).has(address)) return true;
  const delegatedScopes = [scopes.agent_grant, scopes.agentGrant, scopes.delegationScopes].filter(Array.isArray);
  const agent = resolveWorkerGroupPrincipal({ requesterAddress, authScopes: scopes });
  if (
    delegatedScopes.some((items) => items.map(trim).includes('storage')) ||
    (scopes.storage === true && agent.ok && agent.principal.kind === 'agent')
  ) return true;

  // A participant's route scope permits submission, not reading everyone else's
  // answers. List preflight permits scanning; each row still requires its owner.
  if (!address || (scopes.storage !== true && scopes.arweave !== true)) return false;
  if (operation === 'list') return true;
  return !!trim(metadata?.responder) && normalizeAddress(metadata.responder) === address;
};

const authorizeCloudflareStorageAccess = async ({
  env,
  config,
  slug,
  resource,
  requesterAddress,
  authScopes,
  metadata,
  operation = 'read',
  baseHeaders,
  deps,
}) => {
  if (!isStorageResource(resource)) {
    return { ok: false, response: responseJson(deps, { error: 'Invalid storage resource.' }, 400, baseHeaders) };
  }
  if (!canReadPrivateResponse({ config, resource, metadata, requesterAddress, authScopes, operation })) {
    return {
      ok: false,
      response: responseJson(deps, {
        error: 'Access denied: individual response access requires its author, a session admin, or a delegated storage grant.',
        reason: 'private_response_owner_required',
      }, 403, baseHeaders),
    };
  }
  // Payload restrictions are additional to the session gate, never a replacement.
  const args = { env, config, slug, resource, requesterAddress, authScopes, baseHeaders, deps };
  const sessionAccess = await authorizeCloudflareStorageGate(args);
  if (!sessionAccess.ok || !metadata) return sessionAccess;
  const groups = resolveGroupGateIds({ metadata, access: {} });
  if (groups.length) {
    const groupAccess = await authorizeWorkerGroupAccess({ ...args, groupIds: groups });
    if (!groupAccess.ok) return groupAccess;
  }
  const payloadConditions = normalizeAccessConditionDocument(metadata.accessConditions || metadata.envelope?.accessConditions);
  if (!payloadConditions?.conditions?.length ||
      JSON.stringify(payloadConditions) === JSON.stringify(resolvePayloadAccessControl(config).conditions)) return sessionAccess;
  return authorizeCloudflareStorageGate({ ...args, metadata });
};

const authorizeCloudflareStorageGate = async ({
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
      config,
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
  if (!gate.chainId) {
    return {
      ok: false,
      response: responseJson(deps, {
        error: 'Invalid chain ID for Cloudflare worker SBT gate.',
        reason: 'invalid_sbt_gate_chain',
      }, 403, baseHeaders),
    };
  }
  let gateConfig = config;
  try {
    gateConfig = await resolveStorageGateRuntimeConfig({ config, deps });
  } catch {
    return {
      ok: false,
      response: responseJson(deps, {
        error: 'Cloudflare worker SBT gate RPC credentials unavailable.',
        reason: 'sbt_rpc_secret_unavailable',
      }, 403, baseHeaders),
    };
  }
  const rpcUrls = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate(gateConfig, gate.chainId)
    : [];
  if (!rpcUrls.length || typeof deps?.checkSbtGate !== 'function') {
    return {
      ok: false,
      response: responseJson(deps, { error: 'Missing RPC URL for Cloudflare worker SBT gate.' }, 403, baseHeaders),
    };
  }
  for (const rpcUrl of rpcUrls) {
    const ok = await deps.checkSbtGate({
      sbtAddresses: gate.sbtAddresses,
      address,
      rpcUrl,
      mode: gate.mode,
      chainId: gate.chainId,
      rpcUrlIsPrivate: isSessionSecretRpcUrlForGateRuntime({
        config: gateConfig,
        gateChainId: gate.chainId,
        rpcUrl,
      }),
      chainAttestationCache: deps?.[STORAGE_RPC_CHAIN_ATTESTATION_CACHE],
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


export const authorizeCloudflareStorageResourceRead = async ({
  env,
  config,
  slug,
  resource = 'generatedArtifacts',
  requesterAddress = '',
  authScopes,
  baseHeaders,
  deps,
} = {}) => authorizeCloudflareStorageAccess({
  env,
  config,
  slug,
  resource,
  requesterAddress,
  authScopes,
  metadata: { resource },
  baseHeaders,
  deps,
});

const enforceCloudflareUploadPolicy = async ({ env, config, slug, payload, requesterAddress, authScopes, baseHeaders, deps }) => {
  const policy = payload?.uploadPolicy;
  if (!policy?.mode) return { ok: true };
  if (policy.mode === 'group_allowlist') {
    const groupIds = normalizeGroupIdList([...policy.groupIds, ...normalizeGroupIdList(payload?.groupIds)]);
    const groupAccess = await authorizeWorkerGroupAccess({
      env,
      slug,
      config,
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
    if (!chainId) {
      return {
        ok: false,
        response: responseJson(deps, {
          error: 'Invalid SBT upload policy chain ID.',
          reason: 'invalid_sbt_upload_policy_chain',
        }, 400, baseHeaders),
      };
    }
    let gateConfig = config;
    try {
      gateConfig = await resolveStorageGateRuntimeConfig({ config, deps });
    } catch {
      return {
        ok: false,
        response: responseJson(deps, {
          error: 'SBT upload policy RPC credentials unavailable.',
          reason: 'sbt_rpc_secret_unavailable',
        }, 403, baseHeaders),
      };
    }
    const rpcUrls = typeof deps?.resolveRpcUrlListForGate === 'function'
      ? deps.resolveRpcUrlListForGate(gateConfig, chainId)
      : [];
    if (!rpcUrls.length || typeof deps?.checkSbtGate !== 'function') {
      return {
        ok: false,
        response: responseJson(deps, { error: 'Missing RPC URL for SBT upload policy.', reason: 'missing_sbt_rpc' }, 403, baseHeaders),
      };
    }
    for (const rpcUrl of rpcUrls) {
      const ok = await deps.checkSbtGate({
        sbtAddresses: policy.sbtAddresses,
        address,
        rpcUrl,
        mode: policy.anyOrAll,
        chainId,
        rpcUrlIsPrivate: isSessionSecretRpcUrlForGateRuntime({
          config: gateConfig,
          gateChainId: chainId,
          rpcUrl,
        }),
        chainAttestationCache: deps?.[STORAGE_RPC_CHAIN_ATTESTATION_CACHE],
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

const attachStorageGateRuntimeRpc = async ({ config, env, slug, deps }) => {
  if (
    !canUseSessionSecretRpcForGateRuntime(config) ||
    typeof deps?.getSessionSecrets !== 'function'
  ) {
    return config;
  }
  const secrets = (await deps.getSessionSecrets(env, slug)) || {};
  return attachSessionSecretRpcForGateRuntime({ config, secrets });
};

const resolveStorageGateRuntimeConfig = async ({ config, deps }) => {
  const resolver = deps?.[RESOLVE_STORAGE_GATE_RUNTIME_CONFIG];
  return typeof resolver === 'function' ? resolver() : config;
};

const createStorageRouteGateDeps = ({ config, env, slug, deps }) => {
  let runtimeConfigPromise = null;
  const routeDeps = { ...(deps || {}) };
  Object.defineProperty(routeDeps, RESOLVE_STORAGE_GATE_RUNTIME_CONFIG, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: () => {
      if (!runtimeConfigPromise) {
        runtimeConfigPromise = attachStorageGateRuntimeRpc({ config, env, slug, deps: routeDeps });
      }
      return runtimeConfigPromise;
    },
  });
  Object.defineProperty(routeDeps, STORAGE_RPC_CHAIN_ATTESTATION_CACHE, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: new Map(),
  });
  return routeDeps;
};

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

const handleCloudflareUpload = async ({ env, config, slug, uploaderAddress, authScopes, payload, resourceId = '', baseHeaders, deps }) => {
  const r2 = getStorageR2Binding(env);
  const index = getStorageIndexBinding(env);
  const canWriteR2 = !!r2 && typeof r2.put === 'function';
  const canWriteKvPayload = !!index && typeof index.put === 'function';
  const canUseR2Index = canWriteKvPayload && typeof index.get === 'function';
  if (!canWriteR2 && !canWriteKvPayload) {
    return responseJson(deps, { error: 'Cloudflare storage binding not configured.' }, 501, baseHeaders);
  }
  if (canWriteR2 && !canUseR2Index) {
    return responseJson(deps, { error: 'Cloudflare R2 storage requires an index KV binding.' }, 501, baseHeaders);
  }
  const access = await authorizeCloudflareStorageAccess({
    env,
    config,
    slug,
    resource: payload.resource,
    operation: 'upload',
    requesterAddress: uploaderAddress,
    authScopes,
    metadata: null,
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
  const resource = trim(payload.resource) || 'docsContext';
  const uploader = normalizeAddress(uploaderAddress);
  const owned = isOwnedStorageResource(resource);
  let owner = null;
  let hidden = false;
  if (owned) {
    if (!isStorageResourceId(resourceId)) {
      return responseJson(deps, { error: `Invalid ${resource} payload: missing id.` }, 400, baseHeaders);
    }
    if (typeof index?.get !== 'function') {
      return responseJson(deps, { error: 'Cloudflare storage index binding not configured.' }, 501, baseHeaders);
    }
    // Only the id's first author or a session admin may upload it again;
    // anyone else would be rewriting a question or survey people answered.
    const uploaderIsAdmin = resolveSessionAdminAddresses(config).has(uploader);
    owner = await readStorageResourceOwner({ index, slug, resource, resourceId });
    if (!owner && !uploaderIsAdmin) {
      const legacy = await resolveLegacyStorageOwner({ env, config, slug, resource, resourceId, deps });
      if (!legacy.ok) return responseJson(deps, { error: legacy.error }, legacy.status || 503, baseHeaders);
      owner = legacy.owner;
    }
    if (owner && normalizeAddress(owner.uploader) !== uploader && !uploaderIsAdmin) {
      const noun = resource === 'questions' ? 'question' : 'survey';
      return responseJson(deps, {
        error: owner.uploader === LEGACY_STORAGE_OWNER
          ? `This ${noun} id was stored before authors were recorded, so only a session admin can upload it again.`
          : `This ${noun} id already belongs to another author. Only its first author or a session admin can upload it again.`,
        reason: 'storage_resource_id_owned',
      }, 409, baseHeaders);
    }
    hidden = await isStorageResourceHidden({ index, slug, resource, resourceId });
    // A hidden id stays hidden: only an admin can upload it again, and that
    // upload starts hidden too.
    if (hidden && !resolveSessionAdminAddresses(config).has(uploader)) {
      return responseJson(deps, {
        error: `A session admin hid this ${resource === 'questions' ? 'question' : 'survey'} id, so it cannot be uploaded again.`,
        reason: 'storage_resource_id_hidden',
      }, 409, baseHeaders);
    }
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
  const effectiveGroupIds = normalizeGroupIdList([
    ...normalizeGroupIdList(payload.groupIds),
    ...normalizeGroupIdList(uploadPolicy.groupIds),
    ...normalizeGroupIdList(payloadAccess.groupIds),
  ]);
  const metadata = {
    id,
    backend: STORAGE_BACKENDS.CLOUDFLARE,
    resource,
    contentType: trim(payload.contentType) || 'application/octet-stream',
    encrypted: payload.payloadEncrypted === true || payloadAccess.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE,
    gate: trim(payload.gate),
    tags: payload.tags,
    groupIds: effectiveGroupIds,
    uploadPolicy: payload.uploadPolicy?.mode ? payload.uploadPolicy : undefined,
    size: bytesToStore?.length || 0,
    createdAt,
    ...(resource === 'responses' && trim(uploaderAddress)
      ? { responder: trim(uploaderAddress).toLowerCase() }
      : {}),
    // Trusted authorship for questions and surveys, like responder above.
    ...(owned ? { resourceId, ...(uploader ? { uploader } : {}), ...(hidden ? { hidden: true } : {}) } : {}),
    payloadAccessMode: payloadAccess.mode,
    payloadAccessControl: {
      gate: payloadAccess.gate,
      encryption: payloadAccess.encryption,
      ...(effectiveGroupIds.length ? { groupIds: effectiveGroupIds } : {}),
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

  const serializedMetadata = JSON.stringify(metadata);
  const serializedKvPayload = canWriteR2
    ? ''
    : JSON.stringify({
        metadata,
        payloadBase64url: bytesToBase64url(bytesToStore || new Uint8Array()),
      });
  const kvValueFailure = (
    (!canWriteR2 && rejectKvValueOverLimit({ serializedValue: serializedKvPayload, deps })) ||
    (index && rejectKvValueOverLimit({ serializedValue: serializedMetadata, deps }))
  );
  if (kvValueFailure) {
    return responseJson(deps, { error: kvValueFailure.error }, kvValueFailure.status, baseHeaders);
  }

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
    await index.put(buildPayloadKey({ slug, id }), serializedKvPayload);
  }

  if (index && typeof index.put === 'function') {
    await index.put(buildIndexKey({ slug, resource, id }), serializedMetadata);
  }
  if (owned && !owner && uploader) {
    await writeStorageResourceOwner({ index, slug, resource, resourceId, uploader, storageRefId: id, createdAt });
  }

  const storageRef = normalizeStorageRef(metadata);
  if (resource === 'responses') {
    const enqueueAutomatic = deps?.enqueueResultsAnalysisAutoJob;
    if (typeof enqueueAutomatic === 'function') {
      let committedPayload = null;
      try { committedPayload = JSON.parse(decoder.decode(bytesToStore || new Uint8Array())); } catch { committedPayload = null; }
      const committedResponses = committedPayload && typeof committedPayload === 'object'
        ? [{ metadata, payload: committedPayload }]
        : [];
      await enqueueAutomatic({
        env,
        slug,
        config,
        job: {
          slug,
          requestId: `auto-upload:${id}`,
          committedResponses,
        },
      }).catch((error) => {
        deps?.log?.warn?.('[results-analysis] auto enqueue failed', { slug, error: error?.message || String(error || '') });
      });
    }
  }
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

const normalizeStorageListLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STORAGE_LIST_PAGE_SIZE;
  return Math.min(MAX_STORAGE_LIST_PAGE_SIZE, Math.max(1, Math.trunc(parsed)));
};

const readStorageListOptions = async ({ request, url }) => {
  const queryResource = trim(url.searchParams.get('resource'));
  const queryCursor = trim(url.searchParams.get('cursor'));
  const queryLimit = trim(url.searchParams.get('limit'));
  if (request.method.toUpperCase() !== 'POST') {
    return {
      ok: true,
      resource: queryResource || 'docsContext',
      cursor: queryCursor,
      limit: normalizeStorageListLimit(queryLimit),
    };
  }

  let raw = '';
  try {
    raw = await (typeof request?.clone === 'function' ? request.clone() : request).text();
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  if (!trim(raw)) {
    return {
      ok: true,
      resource: queryResource || 'docsContext',
      cursor: queryCursor,
      limit: normalizeStorageListLimit(queryLimit),
    };
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  if (!isObj(body)) return { ok: false, error: 'Invalid JSON.' };
  return {
    ok: true,
    resource: queryResource || trim(body.resource) || 'docsContext',
    cursor: queryCursor || trim(body.cursor),
    limit: normalizeStorageListLimit(queryLimit || body.limit),
  };
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
  if (canReadR2 && !canReadKvPayload) {
    return responseJson(deps, { error: 'Cloudflare R2 storage requires an index KV binding.' }, 501, baseHeaders);
  }
  let object = null;
  let metadata = null;
  let body = null;
  if (canReadR2) {
    object = await r2.get(buildObjectKey({ slug, id }));
    if (object) {
      const indexedResource = trim(object?.customMetadata?.resource) || 'docsContext';
      let rawMetadata;
      try {
        rawMetadata = await index.get(buildIndexKey({ slug, resource: indexedResource, id }));
      } catch {
        return responseJson(
          deps,
          { error: 'Cloudflare storage index metadata is unavailable.' },
          503,
          baseHeaders,
        );
      }
      if (rawMetadata == null || (typeof rawMetadata === 'string' && !trim(rawMetadata))) {
        return responseJson(deps, { error: 'Storage object not found.' }, 404, baseHeaders);
      }
      try {
        metadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
      } catch {
        return responseJson(
          deps,
          { error: 'Cloudflare storage index metadata is unavailable.' },
          503,
          baseHeaders,
        );
      }
      if (
        !isObj(metadata) ||
        trim(metadata.id) !== id ||
        (trim(metadata.resource) || 'docsContext') !== indexedResource
      ) {
        return responseJson(
          deps,
          { error: 'Cloudflare storage index metadata is unavailable.' },
          503,
          baseHeaders,
        );
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
  if (object) {
    body = object?.body || object;
    if (typeof object?.arrayBuffer === 'function') {
      body = await object.arrayBuffer();
    } else if (typeof object?.text === 'function') {
      body = await object.text();
    }
  }
  let responseBody = body;
  const resolvedAccess = normalizePayloadAccessControl(
    metadata?.payloadAccessControl || metadata?.payloadAccessMode || resolvePayloadAccessControl(config),
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
  const { contentType, inline } = resolveStorageReadContentType(metadata?.contentType);
  const responseHeaders = new Headers(baseHeaders || {});
  responseHeaders.set('Content-Type', contentType);
  // Uploaders choose the content type, so a read must never run as a page on
  // the Worker origin: no sniffing, an opaque script-free sandbox, and a
  // download instead of a render for anything outside the safe inline list.
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('Content-Security-Policy', "sandbox; default-src 'none'");
  if (!inline) responseHeaders.set('Content-Disposition', 'attachment');
  responseHeaders.set('X-CE-Storage-Backend', STORAGE_BACKENDS.CLOUDFLARE);
  responseHeaders.set('X-CE-Storage-Ref', id);
  responseHeaders.set('X-CE-Payload-Access-Mode', deriveLegacyPayloadAccessMode(resolvedAccess));
  if (resolvedAccess.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE || hasPrivateResponsePolicy({ config, resource })) {
    responseHeaders.set('Cache-Control', 'private, no-store');
  }
  return new Response(responseBody, {
    status: 200,
    headers: responseHeaders,
  });
};

const handleCloudflareList = async ({ request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps }) => {
  const url = new URL(request.url);
  const listOptions = await readStorageListOptions({ request, url });
  if (!listOptions.ok) return responseJson(deps, { error: listOptions.error }, 400, baseHeaders);
  const { cursor, limit, resource } = listOptions;
  const mine = url.searchParams.get('mine') === 'true';
  const responder = mine ? normalizeAddress(uploaderAddress) : '';
  if (mine && (resource !== 'responses' || !responder)) {
    return responseJson(deps, { error: 'Own responses require authentication and the responses resource.' }, 403, baseHeaders);
  }
  if (!isStorageResource(resource)) return responseJson(deps, { error: 'Invalid storage resource.' }, 400, baseHeaders);
  const access = await authorizeCloudflareStorageAccess({
    env,
    config,
    slug,
    resource,
    operation: 'list',
    requesterAddress: uploaderAddress,
    authScopes,
    baseHeaders,
    deps,
  });
  if (!access.ok) return access.response;
  const index = getStorageIndexBinding(env);
  if (!index || typeof index.list !== 'function' || typeof index.get !== 'function') {
    return responseJson(deps, { error: 'Cloudflare storage index binding not configured.' }, 501, baseHeaders);
  }
  const listed = await index.list({
    prefix: buildIndexPrefix({ slug, resource }),
    ...(cursor ? { cursor } : {}),
    limit,
  });
  const nextCursor = listed?.list_complete === false ? trim(listed?.cursor) : '';
  if (listed?.list_complete === false && !nextCursor) {
    return responseJson(
      deps,
      { error: 'Cloudflare storage list cursor is unavailable.' },
      503,
      baseHeaders,
    );
  }
  const keys = Array.isArray(listed?.keys) ? listed.keys : [];
  const rows = [];
  let hiddenIds = null;
  try {
    // Hidden markers also cover a version whose own flag a hide has not
    // written yet, such as one uploaded in another region during the hide.
    if (isOwnedStorageResource(resource)) hiddenIds = await listHiddenStorageResourceIds({ index, slug, resource });
    for (let offset = 0; offset < keys.length; offset += 8) {
      rows.push(...await Promise.all(keys.slice(offset, offset + 8).map(async (keyEntry) => {
        const name = trim(keyEntry?.name || keyEntry);
        return { name, raw: name ? await index.get(name) : null };
      })));
    }
  } catch {
    return responseJson(deps, { error: 'Cloudflare storage index metadata is unavailable.' }, 503, baseHeaders);
  }
  const items = [];
  // Clients cannot see every Worker role, so lists say whether each question
  // or survey uploader is a session admin under the current role set.
  const admins = isOwnedStorageResource(resource) ? resolveSessionAdminAddresses(config) : null;
  for (const { name, raw } of rows) {
    if (!name) continue;
    let metadata;
    try {
      metadata = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      if (mine) return responseJson(deps, { error: 'Response metadata is unavailable.' }, 503, baseHeaders);
      continue;
    }
    const storageRef = normalizeStorageRef(metadata || {});
    if (!storageRef || storageRef.resource !== resource ||
        name !== buildIndexKey({ slug, resource, id: storageRef.id })) {
      if (mine) return responseJson(deps, { error: 'Response metadata is unavailable.' }, 503, baseHeaders);
      continue;
    }
    if (mine && !trim(metadata?.responder)) {
      return responseJson(deps, { error: 'Response ownership is unavailable.' }, 503, baseHeaders);
    }
    if (mine && normalizeAddress(metadata.responder) !== responder) continue;
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
    // A denied own answer is not evidence of an empty answer history.
    if (!itemAccess.ok) {
      if (mine) return itemAccess.response;
      continue;
    }
    const owned = isOwnedStorageResource(storageRef.resource);
    const resourceId = owned ? normalizeAddress(metadata?.resourceId) : '';
    if (owned && (metadata?.hidden === true || hiddenIds?.has(resourceId))) {
      // An admin hid this id. List no reference to the stored record, only a
      // marker so clients can drop a copy they cached before the hide.
      if (resourceId) items.push({ hidden: true, metadata: { resource: storageRef.resource, resourceId, hidden: true } });
      continue;
    }
    const metadataAccess = normalizePayloadAccessControl(
      metadata?.payloadAccessControl || metadata?.payloadAccessMode || resolvePayloadAccessControl(config),
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
        ...(storageRef.resource === 'responses' && trim(metadata?.responder)
          ? { responder: trim(metadata.responder).toLowerCase() }
          : {}),
        ...(resourceId ? { resourceId } : {}),
        ...(owned && trim(metadata?.uploader) ? { uploader: normalizeAddress(metadata.uploader) } : {}),
        ...(owned ? { uploaderIsAdmin: !!admins?.has(normalizeAddress(metadata?.uploader)) } : {}),
        payloadAccessControl: {
          gate: metadataAccess.gate,
          encryption: metadataAccess.encryption,
        },
        payloadAccessMode: deriveLegacyPayloadAccessMode(metadataAccess),
      },
    });
  }
  return responseJson(deps, {
    items,
    cursor: nextCursor || null,
    listComplete: !nextCursor,
    ...(mine ? { responder, sessionId: resolveCanonicalWorkerSessionIdHex(config) } : {}),
  }, 200, mine || hasPrivateResponsePolicy({ config, resource })
    ? { ...Object.fromEntries(new Headers(baseHeaders || {})), 'Cache-Control': 'private, no-store' }
    : baseHeaders);
};

export const listCloudflareMetadataRows = async ({ index, slug, resource = '' }) => {
  const rows = [];
  const prefix = trim(resource)
    ? buildIndexPrefix({ slug, resource })
    : buildSessionIndexPrefix({ slug });
  let cursor = '';
  do {
    const listed = await index.list({
      prefix,
      ...(cursor ? { cursor } : {}),
    });
    const keys = Array.isArray(listed?.keys) ? listed.keys : [];
    for (const keyEntry of keys) {
      const key = trim(keyEntry?.name || keyEntry);
      if (!key || typeof index.get !== 'function') continue;
      try {
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

export const readStoredCloudflarePayloadBytes = async ({ env, index, slug, metadata }) => {
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

const readStoredPayloadJson = async ({ env, index, slug, config, metadata, deps }) => {
  try {
    let bytes = await readStoredCloudflarePayloadBytes({ env, index, slug, metadata });
    if (!bytes) return null;
    if (isObj(metadata?.envelope)) {
      bytes = await decryptPayloadWithStorageEnvelope({
        env, config, slug, payloadId: trim(metadata.id), ciphertextBytes: bytes, envelope: metadata.envelope, deps,
      });
    }
    const payload = JSON.parse(decoder.decode(await toUint8Array(bytes)));
    return isObj(payload) ? payload : null;
  } catch {
    return null;
  }
};

// The questions or surveys id of an index row. Rows stored before resourceId
// was recorded need one payload read; their id is then written back, so later
// scans read only the index. Returns null when the payload cannot be read and
// '' when it has no valid id.
const readIndexRowResourceId = async ({ env, index, slug, config, resource, row, deps }) => {
  const recorded = normalizeAddress(row.metadata?.resourceId);
  if (recorded) return recorded;
  const payload = await readStoredPayloadJson({ env, index, slug, config, metadata: row.metadata, deps });
  if (!payload) return null;
  const resourceId = readStoragePayloadResourceId(resource, payload);
  if (!isStorageResourceId(resourceId)) return '';
  row.metadata = { ...row.metadata, resourceId };
  await index.put(row.key, JSON.stringify(row.metadata));
  return resourceId;
};

// Questions and surveys stored before first-writer records existed have no
// owner, so the first upload of such an id after an update would claim it.
// One scan per session and resource gives each of those ids an admin-only
// owner. Ids with a recorded uploader already have their first writer.
export const backfillLegacyStorageOwners = async ({ env, config, slug, resource, deps } = {}) => {
  const index = getStorageIndexBinding(env);
  if (!index || ['get', 'put', 'list'].some((method) => typeof index[method] !== 'function')) {
    throw new Error('Cloudflare storage index binding not configured.');
  }
  const recorded = new Set();
  const legacy = new Set();
  const rows = await listCloudflareMetadataRows({ index, slug, resource });
  for (const row of rows) {
    if (!row.metadata) continue;
    const resourceId = await readIndexRowResourceId({ env, index, slug, config, resource, row, deps });
    if (resourceId) (normalizeAddress(row.metadata.uploader) ? recorded : legacy).add(resourceId);
  }
  const ids = [...legacy].filter((resourceId) => !recorded.has(resourceId)).sort();
  const createdAt = new Date(deps?.now?.() || Date.now()).toISOString();
  for (const resourceId of ids) {
    if (await readStorageResourceOwner({ index, slug, resource, resourceId })) continue;
    await writeStorageResourceOwner({
      index, slug, resource, resourceId, uploader: LEGACY_STORAGE_OWNER, storageRefId: '', createdAt,
    });
  }
  return { ids, scannedRows: rows.length };
};

// Whether an id without an owner record was stored before first-writer
// records existed. The session coordinator runs the scan once and answers from
// its own storage, so racing first uploads cannot both claim a legacy id.
// Without a coordinator binding (local tools and tests) the same idempotent
// scan runs inline once, marked in KV.
const LEGACY_OWNER = Object.freeze({ uploader: LEGACY_STORAGE_OWNER });

const resolveLegacyStorageOwner = async ({ env, config, slug, resource, resourceId, deps }) => {
  const coordinated = await checkCoordinatedLegacyStorageOwner({ env, config, slug, resource, resourceId });
  if (coordinated) return coordinated.ok ? { ok: true, owner: coordinated.adminOnly ? LEGACY_OWNER : null } : coordinated;
  try {
    const index = getStorageIndexBinding(env);
    const markerKey = legacyStorageOwnersMarkerKey({ slug, resource });
    // Another upload may have just recorded the owners; read them again.
    if (await index.get(markerKey)) return { ok: true, owner: await readStorageResourceOwner({ index, slug, resource, resourceId }) };
    const { ids, scannedRows } = await backfillLegacyStorageOwners({ env, config, slug, resource, deps });
    // Nothing stored yet means nothing to backfill, since every later row
    // records its uploader; skip the marker so a failed first upload leaves none.
    if (scannedRows) await index.put(markerKey, JSON.stringify({ version: 1, count: ids.length }));
    return { ok: true, owner: ids.includes(resourceId) ? LEGACY_OWNER : null };
  } catch {
    return { ok: false, status: 503, error: 'Recording the owners of existing questions and surveys failed; retry.' };
  }
};

// Admin soft hide: every stored version stays readable by its storage id, but
// lists, the interview catalog, and results analysis skip the question or
// survey id, and later uploads of the id start hidden.
export const setCloudflareStorageResourceHidden = async ({ env, config, slug, body, actor = '', deps = {} } = {}) => {
  const resource = trim(body?.resource);
  const resourceId = normalizeAddress(body?.id);
  if (!isOwnedStorageResource(resource)) {
    return { ok: false, status: 400, error: 'Only questions and surveys can be hidden.' };
  }
  if (!isStorageResourceId(resourceId)) return { ok: false, status: 400, error: `Invalid ${resource} id.` };
  if (typeof body?.hidden !== 'boolean') return { ok: false, status: 400, error: 'hidden must be true or false.' };
  const index = getStorageIndexBinding(env);
  if (!index || ['get', 'put', 'list', 'delete'].some((method) => typeof index[method] !== 'function')) {
    return { ok: false, status: 501, error: 'Cloudflare storage index binding not configured.' };
  }
  const { hidden } = body;
  try {
    await writeStorageVisibilityAudit({ env, slug, resource, resourceId, hidden, principal: actor, deps });
  } catch (error) {
    return { ok: false, status: 503, error: error?.message || 'Storage audit store is unavailable.' };
  }
  await writeStorageResourceHidden({
    index, slug, resource, resourceId, hidden, actor, updatedAt: new Date(deps?.now?.() || Date.now()).toISOString(),
  });
  // Mark every stored version so lists can skip them from index metadata.
  // Uploads from before this release lack resourceId; read those once here.
  let matchedRows = 0;
  let unreadableRows = 0;
  for (const row of await listCloudflareMetadataRows({ index, slug, resource })) {
    if (!row.metadata) {
      unreadableRows += 1;
      continue;
    }
    const rowResourceId = await readIndexRowResourceId({ env, index, slug, config, resource, row, deps });
    if (rowResourceId === null) {
      unreadableRows += 1;
      continue;
    }
    if (rowResourceId !== resourceId) continue;
    matchedRows += 1;
    const next = { ...row.metadata, resourceId };
    if (hidden) next.hidden = true;
    else delete next.hidden;
    await index.put(row.key, JSON.stringify(next));
  }
  const hiddenIds = [...await listHiddenStorageResourceIds({ index, slug, resource })].sort();
  return {
    ok: true,
    status: 200,
    body: { ok: true, resource, id: resourceId, hidden, matchedRows, unreadableRows, hiddenIds },
  };
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
      row.metadata.payloadAccessControl || row.metadata.payloadAccessMode || resolvePayloadAccessControl(config),
    );
    if (metadataAccess.encryption === PAYLOAD_ENCRYPTION_MODES.NONE) continue;
    encryptedPayloadCount += 1;
    try {
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
  const deploymentKekContinuityRequired = (
    !!trim(sessionEnvelope?.sessionKey?.wrappedKey) ||
    payloads.some((entry) => entry.keyProvider === 'worker_secret' || entry.keyProvider === 'mixed')
  );
  const manifest = {
    type: 'ce_storage_encrypted_envelopes_export',
    version: 1,
    exportScope: 'encrypted_envelopes_only',
    storageBackend: STORAGE_BACKENDS.CLOUDFLARE,
    sessionSlug: sessionSlugStorageKey(slug),
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
    deploymentKekContinuityRequired,
    // Version-1 consumers still read this name. It is now a continuity warning,
    // not an instruction to call a key-changing worker action.
    rewrapRequiredForNewDeployment: deploymentKekContinuityRequired,
  };
  return {
    ok: true,
    manifest,
    ...(sessionEnvelope ? { sessionEnvelope } : {}),
    payloads,
  };
};

export const storageRoute = async ({ path, method, request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps } = {}) => {
  if (method === 'POST' && ['/storage/response-field-key/wrap', '/storage/response-field-key/unwrap'].includes(path)) {
    return responseFieldKeyRoute({
      path, request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps,
      isAdmin: principal => resolveRoleAddressSet({ config, role: 'admin' }).has(principal),
      authorizeSession: () => authorizeCloudflareStorageGate({
        env, config, slug, resource: 'responses', requesterAddress: uploaderAddress, authScopes, baseHeaders, deps,
      }),
    });
  }
  if (path === '/storage/upload' && method === 'POST') {
    const maxUploadBytes = resolveMaxUploadBytes({ env, deps });
    const uploadPayload = await (deps?.readStorageUploadRequestPayload || readStorageUploadRequestPayload)(request, { maxUploadBytes });
    if (!uploadPayload?.ok) return responseJson(deps, { error: uploadPayload?.error || 'Invalid storage upload payload.' }, uploadPayload?.status || 400, baseHeaders);
    const payload = uploadPayload.payload || {};
    if (!isStorageResource(payload.resource)) return responseJson(deps, { error: 'Invalid storage resource.' }, 400, baseHeaders);
    const checked = validateStorageUploadPayload({
      resource: trim(payload.resource),
      bytes: payload.bytes,
      payloadEncrypted: payload.payloadEncrypted === true,
    });
    if (!checked.ok) return responseJson(deps, { error: checked.error }, checked.status, baseHeaders);
    const backend = resolveConfiguredStorageBackend({
      config,
      requestedBackend: payload.backend,
      payloadEncrypted: payload.payloadEncrypted,
    });
    if (isArweaveStorageBackend(backend)) {
      return handleArweaveStorageUpload({ request, env, config, slug, uploaderAddress, backend, payload, baseHeaders, deps });
    }
    const routeDeps = createStorageRouteGateDeps({ config, env, slug, deps });
    return handleCloudflareUpload({
      env, config, slug, uploaderAddress, authScopes, payload, resourceId: checked.resourceId, baseHeaders, deps: routeDeps,
    });
  }

  const configuredBackend = resolveConfiguredStorageBackend({ config });
  if (configuredBackend !== STORAGE_BACKENDS.CLOUDFLARE) {
    return responseJson(deps, { error: 'Storage route read/list is only available for Cloudflare storage.' }, 400, baseHeaders);
  }
  if (path === '/storage/read' && (method === 'GET' || method === 'POST')) {
    const routeDeps = createStorageRouteGateDeps({ config, env, slug, deps });
    return handleCloudflareRead({ request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps: routeDeps });
  }
  if (path === '/storage/list' && (method === 'GET' || method === 'POST')) {
    const routeDeps = createStorageRouteGateDeps({ config, env, slug, deps });
    return handleCloudflareList({ request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps: routeDeps });
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
