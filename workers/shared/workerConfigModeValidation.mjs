import { normalizeSessionEndsAt } from './sessionLifecycle.mjs';

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const AUTHORITY_MODES = new Set(['worker_canonical', 'evm_registry_canonical']);
const SESSION_PRESETS = new Set(['fast_cheap_cloudflare', 'trustless_public_decentralized', 'custom']);
const SESSION_STORAGE_BACKENDS = new Set(['cloudflare', 'arweave']);
const DEPLOY_STORAGE_BACKENDS = new Set(['cloudflare', 'arweave', 'lit-arweave']);
const PAYLOAD_ACCESS_MODES = new Set(['public_read', 'worker_sbt_gate', 'lit_encrypted']);
const PAYLOAD_ACCESS_GATES = new Set(['none', 'sbt_gate', 'group_gate', 'role_gate']);
const PAYLOAD_ENCRYPTION_MODES = new Set(['none', 'worker_envelope', 'lit']);
const SESSION_KEY_PROVIDERS = new Set(['worker_secret']);
const IDENTITY_DEFAULTS = new Set(['passkey', 'wallet', 'telegram']);
const IDENTITY_METHODS = new Set(['passkey', 'wallet', 'telegram', 'agent_grant']);
const AUTHORIZATION_MECHANISMS = new Set([
  'worker_roles',
  'worker_groups',
  'sbt_onchain',
  'evm_address_allowlist',
  'telegram_account_role',
  'agent_grant',
]);
const SURFACES = ['web', 'telegram', 'miniApp', 'agentHttp', 'mcp', 'ceCc'];
const RESULTS_VISIBILITIES = new Set([
  'participant_aggregate',
  'session_member_aggregate',
  'public_full_if_storage_public',
]);
const EXPORT_SCOPES = new Set(['admin_raw', 'all_session', 'encrypted_envelopes_only']);
const ACCESS_MATCHES = new Set(['any', 'all']);
const ACCESS_KINDS = new Set(['worker_role', 'sbt_onchain', 'agent_grant_scope']);
const RESOURCE_KEYS = new Set([
  'docsContext',
  'questions',
  'surveys',
  'responses',
  'generatedArtifacts',
  'media',
  'images',
]);
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const MAX_ACCESS_CONDITION_TEXT_LENGTH = 128;
const CANONICAL_NAMED_SESSION_MODE_PROFILES = Object.freeze({
  fast_cheap_cloudflare: {
    profileVersion: 1,
    preset: 'fast_cheap_cloudflare',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: {
        gate: 'role_gate',
        encryption: 'worker_envelope',
        accessConditions: {
          match: 'any',
          conditions: [
            { kind: 'worker_role', role: 'admin' },
            { kind: 'agent_grant_scope', scope: 'storage' },
          ],
        },
      },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    surfaces: {
      web: true,
      telegram: false,
      miniApp: false,
      agentHttp: false,
      mcp: false,
      ceCc: false,
    },
    results: {
      visibility: 'participant_aggregate',
      exposure: {
        aggregateResultsEnabled: true,
        anonymizedGroupsEnabled: false,
        minGroupSize: 2,
      },
    },
    export: { scope: 'admin_raw' },
  },
  trustless_public_decentralized: {
    profileVersion: 1,
    preset: 'trustless_public_decentralized',
    authority: { mode: 'evm_registry_canonical' },
    evm: { registryChainId: 11155420 },
    storage: { backend: 'arweave' },
    identity: { default: 'wallet', enabled: ['wallet', 'passkey'] },
    authorization: { mechanisms: ['sbt_onchain'] },
    encryption: { mode: 'none' },
    surfaces: {
      web: true,
      telegram: false,
      miniApp: false,
      agentHttp: false,
      mcp: false,
      ceCc: false,
    },
    results: {
      visibility: 'public_full_if_storage_public',
      exposure: {
        aggregateResultsEnabled: true,
        anonymizedGroupsEnabled: false,
        minGroupSize: 2,
      },
    },
    export: { scope: 'all_session' },
  },
});

const valid = () => ({ ok: true });
const invalid = (path) => ({ ok: false, path });

const stableSessionModeValue = (value) => {
  if (Array.isArray(value)) return value.map(stableSessionModeValue);
  if (!isObj(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce((next, key) => {
      if (typeof value[key] !== 'undefined') next[key] = stableSessionModeValue(value[key]);
      return next;
    }, {});
};

const sessionModeValuesEqual = (left, right) =>
  JSON.stringify(stableSessionModeValue(left)) === JSON.stringify(stableSessionModeValue(right));

const validateEnumField = (record, key, path, allowed) => {
  if (!hasOwn(record, key)) return valid();
  const value = record[key];
  return typeof value === 'string' && allowed.has(value) ? valid() : invalid(path);
};

const validateRequiredEnumField = (record, key, path, allowed) =>
  hasOwn(record, key) ? validateEnumField(record, key, path, allowed) : invalid(path);

const validateObjectField = (record, key, path) => {
  if (!hasOwn(record, key)) return { ok: true, value: null };
  return isObj(record[key]) ? { ok: true, value: record[key] } : { ok: false, path };
};

const validateExactKeys = (record, path, allowed) => {
  const allowedKeys = new Set(allowed);
  const unknownKey = Object.keys(record).find((key) => !allowedKeys.has(key));
  return unknownKey ? invalid(path ? `${path}.${unknownKey}` : unknownKey) : valid();
};

const validateRequiredObjectField = (record, key, path, allowed) => {
  const result = validateObjectField(record, key, path);
  if (!result.ok || !result.value) return result.ok ? invalid(path) : result;
  const keysResult = validateExactKeys(result.value, path, allowed);
  return keysResult.ok ? result : keysResult;
};

const validateEnumArray = (value, path, allowed) => {
  if (!Array.isArray(value) || !value.length) return invalid(path);
  const invalidIndex = value.findIndex((entry) => typeof entry !== 'string' || !allowed.has(entry));
  if (invalidIndex >= 0) return invalid(`${path}.${invalidIndex}`);
  if (new Set(value).size !== value.length) return invalid(path);
  return { ok: true, value };
};

const positiveChainId = (value) => Number.isSafeInteger(value) && value > 0;

const validateAccessConditions = (value, path) => {
  if (!isObj(value)) return invalid(path);
  let result = validateExactKeys(value, path, ['match', 'conditions']);
  if (!result.ok) return result;
  result = validateRequiredEnumField(value, 'match', `${path}.match`, ACCESS_MATCHES);
  if (!result.ok) return result;
  if (!Array.isArray(value.conditions) || !value.conditions.length) return invalid(`${path}.conditions`);
  const sbtChainIds = [];
  for (let index = 0; index < value.conditions.length; index += 1) {
    const conditionPath = `${path}.conditions.${index}`;
    const condition = value.conditions[index];
    if (!isObj(condition)) return invalid(conditionPath);
    result = validateRequiredEnumField(condition, 'kind', `${conditionPath}.kind`, ACCESS_KINDS);
    if (!result.ok) return result;
    if (condition.kind === 'worker_role') {
      result = validateExactKeys(condition, conditionPath, ['kind', 'role']);
      if (!result.ok) return result;
      if (
        typeof condition.role !== 'string' ||
        !condition.role.trim() ||
        condition.role !== condition.role.trim() ||
        condition.role.length > MAX_ACCESS_CONDITION_TEXT_LENGTH
      ) {
        return invalid(`${conditionPath}.role`);
      }
      continue;
    }
    if (condition.kind === 'agent_grant_scope') {
      result = validateExactKeys(condition, conditionPath, ['kind', 'scope']);
      if (!result.ok) return result;
      if (
        typeof condition.scope !== 'string' ||
        !condition.scope.trim() ||
        condition.scope !== condition.scope.trim() ||
        condition.scope.length > MAX_ACCESS_CONDITION_TEXT_LENGTH
      ) {
        return invalid(`${conditionPath}.scope`);
      }
      continue;
    }
    result = validateExactKeys(condition, conditionPath, ['kind', 'chainId', 'contract', 'anyOrAll']);
    if (!result.ok) return result;
    if (!positiveChainId(condition.chainId)) return invalid(`${conditionPath}.chainId`);
    if (
      typeof condition.contract !== 'string' ||
      condition.contract !== condition.contract.trim() ||
      !EVM_ADDRESS_PATTERN.test(condition.contract) ||
      /^0x0{40}$/i.test(condition.contract)
    ) {
      return invalid(`${conditionPath}.contract`);
    }
    result = validateRequiredEnumField(condition, 'anyOrAll', `${conditionPath}.anyOrAll`, ACCESS_MATCHES);
    if (!result.ok) return result;
    sbtChainIds.push(condition.chainId);
  }
  return { ok: true, sbtChainIds };
};

const validatePayloadAccessControl = (record, path) => {
  if (!isObj(record)) return invalid(path);
  for (const [key, allowed] of [
    ['mode', PAYLOAD_ACCESS_MODES],
    ['gate', PAYLOAD_ACCESS_GATES],
    ['encryption', PAYLOAD_ENCRYPTION_MODES],
  ]) {
    const result = validateEnumField(record, key, `${path}.${key}`, allowed);
    if (!result.ok) return result;
  }
  return valid();
};

const validateStorageProfile = (
  profile,
  path,
  { allowString = false, requireCanonicalBackend = false } = {},
) => {
  if (allowString && typeof profile === 'string') {
    return DEPLOY_STORAGE_BACKENDS.has(profile) ? valid() : invalid(`${path}.backend`);
  }
  if (!isObj(profile)) return invalid(path);

  const backendKeys = ['backend', 'profile', 'storageProfile'].filter((key) => hasOwn(profile, key));
  if (!backendKeys.length) return invalid(`${path}.backend`);
  if (requireCanonicalBackend && !hasOwn(profile, 'backend')) return invalid(`${path}.backend`);
  for (const key of backendKeys) {
    const result = validateEnumField(profile, key, `${path}.${key}`, DEPLOY_STORAGE_BACKENDS);
    if (!result.ok) return result;
  }
  const backend = profile[backendKeys[0]];
  const conflictingBackendKey = backendKeys.find((key) => profile[key] !== backend);
  if (conflictingBackendKey) return invalid(`${path}.${conflictingBackendKey}`);
  for (const key of ['payloadAccessMode', 'accessControlMode']) {
    const result = validateEnumField(profile, key, `${path}.${key}`, PAYLOAD_ACCESS_MODES);
    if (!result.ok) return result;
  }
  for (const [key, allowed] of [
    ['gate', PAYLOAD_ACCESS_GATES],
    ['encryption', PAYLOAD_ENCRYPTION_MODES],
  ]) {
    const result = validateEnumField(profile, key, `${path}.${key}`, allowed);
    if (!result.ok) return result;
  }

  const payloadAccess = validateObjectField(profile, 'payloadAccessControl', `${path}.payloadAccessControl`);
  if (!payloadAccess.ok) return payloadAccess;
  if (payloadAccess.value) {
    const result = validatePayloadAccessControl(payloadAccess.value, `${path}.payloadAccessControl`);
    if (!result.ok) return result;
  }

  const cloudflare = validateObjectField(profile, 'cloudflare', `${path}.cloudflare`);
  if (!cloudflare.ok) return cloudflare;
  if (cloudflare.value) {
    const result = validateEnumField(
      cloudflare.value,
      'payloadAccessMode',
      `${path}.cloudflare.payloadAccessMode`,
      PAYLOAD_ACCESS_MODES,
    );
    if (!result.ok) return result;
  }
  return valid();
};

const validateVersionedSessionModeProfile = (profile, path) => {
  let result = validateExactKeys(profile, path, [
    'profileVersion',
    'preset',
    'authority',
    'evm',
    'storage',
    'identity',
    'authorization',
    'encryption',
    'surfaces',
    'results',
    'export',
  ]);
  if (!result.ok) return result;
  if (profile.profileVersion !== 1) return invalid(`${path}.profileVersion`);
  result = validateRequiredEnumField(profile, 'preset', `${path}.preset`, SESSION_PRESETS);
  if (!result.ok) return result;

  const authority = validateRequiredObjectField(profile, 'authority', `${path}.authority`, ['mode']);
  if (!authority.ok) return authority;
  result = validateRequiredEnumField(authority.value, 'mode', `${path}.authority.mode`, AUTHORITY_MODES);
  if (!result.ok) return result;
  const authorityMode = authority.value.mode;

  const evm = validateRequiredObjectField(profile, 'evm', `${path}.evm`, ['registryChainId']);
  if (!evm.ok) return evm;
  if (evm.value.registryChainId !== null && !positiveChainId(evm.value.registryChainId)) {
    return invalid(`${path}.evm.registryChainId`);
  }

  const storage = validateRequiredObjectField(profile, 'storage', `${path}.storage`, [
    'backend',
    'payloadAccessControl',
    'resources',
    'mirrors',
  ]);
  if (!storage.ok) return storage;
  result = validateRequiredEnumField(storage.value, 'backend', `${path}.storage.backend`, SESSION_STORAGE_BACKENDS);
  if (!result.ok) return result;
  if (hasOwn(storage.value, 'resources')) {
    if (!isObj(storage.value.resources)) return invalid(`${path}.storage.resources`);
    const unknownResource = Object.keys(storage.value.resources).find((key) => !RESOURCE_KEYS.has(key));
    return invalid(unknownResource ? `${path}.storage.resources.${unknownResource}` : `${path}.storage.resources`);
  }
  if (hasOwn(storage.value, 'mirrors')) return invalid(`${path}.storage.mirrors`);

  let payloadAccess = null;
  let storageAccess = { ok: true, sbtChainIds: [] };
  if (hasOwn(storage.value, 'payloadAccessControl')) {
    const payloadAccessResult = validateRequiredObjectField(
      storage.value,
      'payloadAccessControl',
      `${path}.storage.payloadAccessControl`,
      ['gate', 'encryption', 'mode', 'accessConditions'],
    );
    if (!payloadAccessResult.ok) return payloadAccessResult;
    payloadAccess = payloadAccessResult.value;
    result = validateRequiredEnumField(
      payloadAccess,
      'gate',
      `${path}.storage.payloadAccessControl.gate`,
      PAYLOAD_ACCESS_GATES,
    );
    if (!result.ok) return result;
    if (!new Set(['none', 'role_gate']).has(payloadAccess.gate)) {
      return invalid(`${path}.storage.payloadAccessControl.gate`);
    }
    result = validateRequiredEnumField(
      payloadAccess,
      'encryption',
      `${path}.storage.payloadAccessControl.encryption`,
      PAYLOAD_ENCRYPTION_MODES,
    );
    if (!result.ok) return result;
    if (hasOwn(payloadAccess, 'mode')) return invalid(`${path}.storage.payloadAccessControl.mode`);
    if (hasOwn(payloadAccess, 'accessConditions')) {
      storageAccess = validateAccessConditions(
        payloadAccess.accessConditions,
        `${path}.storage.payloadAccessControl.accessConditions`,
      );
      if (!storageAccess.ok) return storageAccess;
    }
  }
  if (storage.value.backend === 'cloudflare' && !payloadAccess) {
    return invalid(`${path}.storage.payloadAccessControl`);
  }
  if (storage.value.backend === 'arweave' && payloadAccess) {
    return invalid(`${path}.storage.payloadAccessControl`);
  }

  const identity = validateRequiredObjectField(profile, 'identity', `${path}.identity`, ['default', 'enabled']);
  if (!identity.ok) return identity;
  result = validateRequiredEnumField(identity.value, 'default', `${path}.identity.default`, IDENTITY_DEFAULTS);
  if (!result.ok) return result;
  const identities = validateEnumArray(identity.value.enabled, `${path}.identity.enabled`, IDENTITY_METHODS);
  if (!identities.ok) return identities;
  if (!identities.value.includes(identity.value.default)) return invalid(`${path}.identity.default`);
  if (identities.value.some((method) => method === 'telegram' || method === 'agent_grant')) {
    return invalid(`${path}.identity.enabled`);
  }

  const authorization = validateRequiredObjectField(profile, 'authorization', `${path}.authorization`, ['mechanisms']);
  if (!authorization.ok) return authorization;
  const mechanisms = validateEnumArray(
    authorization.value.mechanisms,
    `${path}.authorization.mechanisms`,
    AUTHORIZATION_MECHANISMS,
  );
  if (!mechanisms.ok) return mechanisms;
  if (
    mechanisms.value.some((mechanism) =>
      ['worker_groups', 'evm_address_allowlist', 'telegram_account_role', 'agent_grant'].includes(mechanism),
    )
  ) {
    return invalid(`${path}.authorization.mechanisms`);
  }

  const encryption = validateRequiredObjectField(profile, 'encryption', `${path}.encryption`, [
    'mode',
    'keyProvider',
    'accessConditions',
  ]);
  if (!encryption.ok) return encryption;
  result = validateRequiredEnumField(encryption.value, 'mode', `${path}.encryption.mode`, PAYLOAD_ENCRYPTION_MODES);
  if (!result.ok) return result;
  result = validateEnumField(encryption.value, 'keyProvider', `${path}.encryption.keyProvider`, SESSION_KEY_PROVIDERS);
  if (!result.ok) return result;
  let encryptionAccess = { ok: true, sbtChainIds: [] };
  if (hasOwn(encryption.value, 'accessConditions')) {
    encryptionAccess = validateAccessConditions(
      encryption.value.accessConditions,
      `${path}.encryption.accessConditions`,
    );
    if (!encryptionAccess.ok) return encryptionAccess;
  }
  if (encryption.value.mode === 'worker_envelope') {
    if (encryption.value.keyProvider !== 'worker_secret') return invalid(`${path}.encryption.keyProvider`);
  } else if (hasOwn(encryption.value, 'keyProvider')) {
    return invalid(`${path}.encryption.keyProvider`);
  }
  if (encryption.value.mode !== 'worker_envelope' && hasOwn(encryption.value, 'accessConditions')) {
    return invalid(`${path}.encryption.accessConditions`);
  }
  if (payloadAccess && payloadAccess.encryption !== encryption.value.mode) {
    return invalid(`${path}.storage.payloadAccessControl.encryption`);
  }

  const surfaces = validateRequiredObjectField(profile, 'surfaces', `${path}.surfaces`, SURFACES);
  if (!surfaces.ok) return surfaces;
  for (const surface of SURFACES) {
    if (typeof surfaces.value[surface] !== 'boolean') return invalid(`${path}.surfaces.${surface}`);
  }
  if (surfaces.value.web !== true) return invalid(`${path}.surfaces.web`);
  if (surfaces.value.miniApp && !surfaces.value.telegram) return invalid(`${path}.surfaces.miniApp`);
  if (surfaces.value.mcp) return invalid(`${path}.surfaces.mcp`);
  if (surfaces.value.ceCc) return invalid(`${path}.surfaces.ceCc`);

  const results = validateRequiredObjectField(profile, 'results', `${path}.results`, ['visibility', 'exposure']);
  if (!results.ok) return results;
  result = validateRequiredEnumField(results.value, 'visibility', `${path}.results.visibility`, RESULTS_VISIBILITIES);
  if (!result.ok) return result;
  // Mirrors the client public_results_require_public_storage rule: public
  // stored-results visibility requires unencrypted storage; Cloudflare also
  // requires an unconditional public-read payload policy.
  if (
    results.value.visibility === 'public_full_if_storage_public' &&
    (
      encryption.value.mode !== 'none' ||
      (
        storage.value.backend === 'cloudflare' &&
        (
          !payloadAccess ||
          payloadAccess.gate !== 'none' ||
          hasOwn(payloadAccess, 'accessConditions')
        )
      )
    )
  ) {
    return invalid(`${path}.results.visibility`);
  }
  const exposure = validateRequiredObjectField(results.value, 'exposure', `${path}.results.exposure`, [
    'aggregateResultsEnabled',
    'anonymizedGroupsEnabled',
    'minGroupSize',
  ]);
  if (!exposure.ok) return exposure;
  if (exposure.value.aggregateResultsEnabled !== true) {
    return invalid(`${path}.results.exposure.aggregateResultsEnabled`);
  }
  if (typeof exposure.value.anonymizedGroupsEnabled !== 'boolean') {
    return invalid(`${path}.results.exposure.anonymizedGroupsEnabled`);
  }
  if (!Number.isSafeInteger(exposure.value.minGroupSize) || exposure.value.minGroupSize < 2) {
    return invalid(`${path}.results.exposure.minGroupSize`);
  }

  const exportConfig = validateRequiredObjectField(profile, 'export', `${path}.export`, ['scope', 'surfaceFilter']);
  if (!exportConfig.ok) return exportConfig;
  result = validateRequiredEnumField(exportConfig.value, 'scope', `${path}.export.scope`, EXPORT_SCOPES);
  if (!result.ok) return result;
  if (hasOwn(exportConfig.value, 'surfaceFilter')) return invalid(`${path}.export.surfaceFilter`);
  if (exportConfig.value.scope === 'encrypted_envelopes_only' && encryption.value.mode === 'none') {
    return invalid(`${path}.export.scope`);
  }

  const sbtChainIds = [...storageAccess.sbtChainIds, ...encryptionAccess.sbtChainIds];
  const hasSbtCondition = sbtChainIds.length > 0;
  if (hasSbtCondition && encryption.value.mode !== 'worker_envelope') {
    return invalid(`${path}.encryption.mode`);
  }
  const chainRelevant =
    authorityMode === 'evm_registry_canonical' || encryption.value.mode === 'lit' || hasSbtCondition;
  if (chainRelevant && !positiveChainId(evm.value.registryChainId)) {
    return invalid(`${path}.evm.registryChainId`);
  }
  if (!chainRelevant && evm.value.registryChainId !== null) {
    return invalid(`${path}.evm.registryChainId`);
  }
  if (
    positiveChainId(evm.value.registryChainId) &&
    sbtChainIds.some((chainId) => chainId !== evm.value.registryChainId)
  ) {
    return invalid(`${path}.evm.registryChainId`);
  }

  if (authorityMode === 'worker_canonical') {
    if (storage.value.backend !== 'cloudflare') return invalid(`${path}.storage.backend`);
    if (
      identity.value.default !== 'passkey' ||
      !identities.value.includes('passkey') ||
      identities.value.includes('wallet')
    ) {
      return invalid(`${path}.identity`);
    }
    if (!mechanisms.value.includes('worker_roles')) return invalid(`${path}.authorization.mechanisms`);
    if (mechanisms.value.includes('sbt_onchain') && !hasSbtCondition) {
      return invalid(`${path}.authorization.mechanisms`);
    }
  } else {
    if (storage.value.backend !== 'arweave') return invalid(`${path}.storage.backend`);
    if (
      identity.value.default !== 'wallet' ||
      identities.value.length !== 2 ||
      !identities.value.includes('wallet') ||
      !identities.value.includes('passkey')
    ) {
      return invalid(`${path}.identity`);
    }
    if (mechanisms.value.length !== 1 || mechanisms.value[0] !== 'sbt_onchain') {
      return invalid(`${path}.authorization.mechanisms`);
    }
  }
  const canonicalNamedProfile = CANONICAL_NAMED_SESSION_MODE_PROFILES[profile.preset];
  if (canonicalNamedProfile && !sessionModeValuesEqual(profile, canonicalNamedProfile)) {
    return invalid(`${path}.preset`);
  }
  return valid();
};

const validateSessionModeProfile = (profile, path) => {
  if (!isObj(profile)) return invalid(path);
  if (!hasOwn(profile, 'profileVersion')) return invalid(`${path}.profileVersion`);
  return validateVersionedSessionModeProfile(profile, path);
};

const resolveProfileStorageSide = (
  config,
  { allowMissing = false, requirePersistedCanonicalKey = false } = {},
) => {
  const hasStorageProfile = hasOwn(config, 'storageProfile');
  const hasStorageBackend = hasOwn(config, 'storageBackend');
  if (hasStorageProfile && hasStorageBackend) return invalid('storageBackend');
  if (!hasStorageProfile && !hasStorageBackend) {
    return allowMissing ? { ok: true, value: null, key: '' } : invalid('storageProfile');
  }
  const key = hasStorageProfile ? 'storageProfile' : 'storageBackend';
  if (requirePersistedCanonicalKey && key !== 'storageProfile') return invalid('storageBackend');
  const value = config[key];
  return isObj(value) ? { ok: true, value, key } : invalid('storageProfile');
};

const profileStorageBackendMatches = ({ profile, storageBackend }) => {
  const profileBackend = profile?.storage?.backend;
  if (profileBackend === 'cloudflare') return storageBackend === 'cloudflare';
  if (profileBackend !== 'arweave') return false;
  if (profile?.encryption?.mode === 'lit') {
    return storageBackend === 'arweave' || storageBackend === 'lit-arweave';
  }
  return storageBackend === 'arweave';
};

const validateCanonicalStorageAccessConditions = ({ profile, storageSide }) => {
  for (const key of ['accessConditions', 'conditions']) {
    if (hasOwn(storageSide, key)) return invalid(`storageProfile.${key}`);
  }
  const cloudflare = isObj(storageSide.cloudflare) ? storageSide.cloudflare : {};
  for (const key of ['accessConditions', 'conditions']) {
    if (hasOwn(cloudflare, key)) return invalid(`storageProfile.cloudflare.${key}`);
  }
  const storageAccess = isObj(storageSide.payloadAccessControl)
    ? storageSide.payloadAccessControl
    : {};
  if (hasOwn(storageAccess, 'conditions')) {
    return invalid('storageProfile.payloadAccessControl.conditions');
  }
  // Keep this precedence identical to the client compiler:
  // encryption.accessConditions is the explicit override, with the embedded
  // storage policy serving as the preset/default condition document.
  const profileAccess = isObj(profile?.storage?.payloadAccessControl)
    ? profile.storage.payloadAccessControl
    : {};
  const profileEncryption = isObj(profile?.encryption) ? profile.encryption : {};
  const effectiveProfileConditions = hasOwn(profileEncryption, 'accessConditions')
    ? profileEncryption.accessConditions
    : profileAccess.accessConditions;
  const profileHasConditions =
    hasOwn(profileEncryption, 'accessConditions') ||
    hasOwn(profileAccess, 'accessConditions');
  const storageHasConditions = hasOwn(storageAccess, 'accessConditions');
  if (storageHasConditions) {
    const result = validateAccessConditions(
      storageAccess.accessConditions,
      'storageProfile.payloadAccessControl.accessConditions',
    );
    if (!result.ok) return result;
  }
  if (
    profileHasConditions !== storageHasConditions ||
    (
      profileHasConditions &&
      !sessionModeValuesEqual(effectiveProfileConditions, storageAccess.accessConditions)
    )
  ) {
    return invalid('storageProfile.payloadAccessControl.accessConditions');
  }
  return valid();
};

// Runtime storage enforcement reads the canonical top-level storageProfile
// while capability projection reads the embedded profile. A complete
// profile-bearing record must therefore carry one canonical storage source
// whose backend, payload policy, and condition document agree exactly.
const validateProfileStoragePolicyCoherence = ({ profile, storageSide }) => {
  const profileStorage = isObj(profile.storage) ? profile.storage : {};
  const storageBackend = storageSide.backend;
  if (!profileStorageBackendMatches({ profile, storageBackend })) {
    return invalid('storageProfile.backend');
  }
  if (storageBackend !== 'cloudflare') {
    return hasOwn(storageSide, 'payloadAccessControl')
      ? invalid('storageProfile.payloadAccessControl')
      : valid();
  }
  // Top-level policy shorthands are ambiguous next to a governing profile:
  // runtime consumers give them different precedence, so fail closed.
  for (const key of ['gate', 'encryption', 'payloadAccessMode', 'accessControlMode']) {
    if (hasOwn(storageSide, key)) return invalid(`storageProfile.${key}`);
  }
  const profileAccess = isObj(profileStorage.payloadAccessControl) ? profileStorage.payloadAccessControl : {};
  const storageAccess = isObj(storageSide.payloadAccessControl)
    ? storageSide.payloadAccessControl
    : {};
  // The client compiler forces Lit payloads to an ungated storage envelope;
  // Lit access control is represented by encryption rather than a Worker gate.
  const effectiveProfileGate = profile?.encryption?.mode === 'lit'
    ? 'none'
    : profileAccess.gate;
  if (!hasOwn(storageAccess, 'gate') || storageAccess.gate !== effectiveProfileGate) {
    return invalid('storageProfile.payloadAccessControl.gate');
  }
  if (!hasOwn(storageAccess, 'encryption') || storageAccess.encryption !== profileAccess.encryption) {
    return invalid('storageProfile.payloadAccessControl.encryption');
  }
  return validateCanonicalStorageAccessConditions({ profile, storageSide });
};

export const validateWorkerConfigModeValues = (
  config,
  { allowPartialProfileStorage = false } = {},
) => {
  if (!isObj(config)) return invalid('config');
  if (hasOwn(config, 'sessionEndsAt') && !normalizeSessionEndsAt(config.sessionEndsAt).ok) {
    return invalid('sessionEndsAt');
  }

  let profile = null;
  if (hasOwn(config, 'sessionModeProfile')) {
    const result = validateSessionModeProfile(config.sessionModeProfile, 'sessionModeProfile');
    if (!result.ok) return result;
    profile = config.sessionModeProfile;
  }
  if (
    profile &&
    hasOwn(config, 'sessionEndsAt') &&
    profile?.authority?.mode !== 'worker_canonical'
  ) {
    return invalid('sessionEndsAt');
  }
  if (profile) {
    const storageSource = resolveProfileStorageSide(config, {
      allowMissing: allowPartialProfileStorage,
      requirePersistedCanonicalKey: true,
    });
    if (!storageSource.ok) return storageSource;
    if (!storageSource.value) return valid();
    const storageResult = validateStorageProfile(storageSource.value, 'storageProfile', {
      requireCanonicalBackend: true,
    });
    if (!storageResult.ok) return storageResult;
    return validateProfileStoragePolicyCoherence({
      profile,
      storageSide: storageSource.value,
    });
  }
  if (hasOwn(config, 'storageProfile')) {
    const result = validateStorageProfile(config.storageProfile, 'storageProfile');
    if (!result.ok) return result;
  }
  return valid();
};

export const workerConfigAllowsAnonymousGroupDiscovery = (config) => {
  if (!isObj(config) || !validateWorkerConfigModeValues(config).ok) return false;
  const profile = isObj(config.sessionModeProfile) ? config.sessionModeProfile : {};
  const authority = isObj(profile.authority) ? profile.authority : {};
  const storage = isObj(profile.storage) ? profile.storage : {};
  const payloadAccess = isObj(storage.payloadAccessControl) ? storage.payloadAccessControl : {};
  const encryption = isObj(profile.encryption) ? profile.encryption : {};
  const results = isObj(profile.results) ? profile.results : {};
  return (
    authority.mode === 'worker_canonical' &&
    storage.backend === 'cloudflare' &&
    payloadAccess.gate === 'none' &&
    payloadAccess.encryption === 'none' &&
    !hasOwn(payloadAccess, 'accessConditions') &&
    encryption.mode === 'none' &&
    !hasOwn(encryption, 'accessConditions') &&
    results.visibility === 'public_full_if_storage_public'
  );
};

export const validateDeploymentModeValues = (body) => {
  if (!isObj(body)) return invalid('request');

  let profile = null;
  if (hasOwn(body, 'sessionModeProfile')) {
    const result = validateSessionModeProfile(body.sessionModeProfile, 'sessionModeProfile');
    if (!result.ok) return result;
    profile = body.sessionModeProfile;
  }
  if (profile) {
    const storageSource = resolveProfileStorageSide(body);
    if (!storageSource.ok) return storageSource;
    const storageResult = validateStorageProfile(storageSource.value, 'storageProfile', {
      requireCanonicalBackend: true,
    });
    if (!storageResult.ok) return storageResult;
    return validateProfileStoragePolicyCoherence({
      profile,
      storageSide: storageSource.value,
    });
  }
  if (hasOwn(body, 'storageProfile')) {
    const result = validateStorageProfile(body.storageProfile, 'storageProfile', { allowString: true });
    if (!result.ok) return result;
  } else if (hasOwn(body, 'storageBackend')) {
    const result = validateStorageProfile(body.storageBackend, 'storageProfile', { allowString: true });
    if (!result.ok) return result;
  }
  return valid();
};
