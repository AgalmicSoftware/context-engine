const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const AUTHORITY_MODES = new Set([
  'worker_canonical',
  'worker_with_public_anchor',
  'evm_registry_canonical',
]);
const SESSION_PRESETS = new Set([
  'fast_cheap_cloudflare',
  'trustless_public_decentralized',
  'custom',
]);
const SESSION_STORAGE_BACKENDS = new Set(['cloudflare', 'arweave']);
const DEPLOY_STORAGE_BACKENDS = new Set(['cloudflare', 'arweave', 'lit-arweave']);
const PAYLOAD_ACCESS_MODES = new Set(['public_read', 'worker_sbt_gate', 'lit_encrypted']);
const PAYLOAD_ACCESS_GATES = new Set(['none', 'sbt_gate', 'group_gate', 'role_gate']);
const PAYLOAD_ENCRYPTION_MODES = new Set(['none', 'worker_envelope', 'lit']);
const SESSION_KEY_PROVIDERS = new Set(['worker_secret']);

const valid = () => ({ ok: true });
const invalid = (path) => ({ ok: false, path });

const validateEnumField = (record, key, path, allowed) => {
  if (!hasOwn(record, key)) return valid();
  const value = record[key];
  return typeof value === 'string' && allowed.has(value) ? valid() : invalid(path);
};

const validateRequiredEnumField = (record, key, path, allowed) => (
  hasOwn(record, key) ? validateEnumField(record, key, path, allowed) : invalid(path)
);

const validateObjectField = (record, key, path) => {
  if (!hasOwn(record, key)) return { ok: true, value: null };
  return isObj(record[key])
    ? { ok: true, value: record[key] }
    : { ok: false, path };
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

const validateStorageProfile = (profile, path, { allowString = false } = {}) => {
  if (allowString && typeof profile === 'string') {
    return DEPLOY_STORAGE_BACKENDS.has(profile) ? valid() : invalid(`${path}.backend`);
  }
  if (!isObj(profile)) return invalid(path);

  const backendKeys = ['backend', 'profile', 'storageProfile'].filter((key) => hasOwn(profile, key));
  if (!backendKeys.length) return invalid(`${path}.backend`);
  for (const key of backendKeys) {
    const result = validateEnumField(profile, key, `${path}.${key}`, DEPLOY_STORAGE_BACKENDS);
    if (!result.ok) return result;
  }
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

const validateSessionModeProfile = (profile, path) => {
  if (!isObj(profile)) return invalid(path);

  let result = validateEnumField(profile, 'preset', `${path}.preset`, SESSION_PRESETS);
  if (!result.ok) return result;

  const authority = validateObjectField(profile, 'authority', `${path}.authority`);
  if (!authority.ok) return authority;
  if (authority.value) {
    result = validateRequiredEnumField(authority.value, 'mode', `${path}.authority.mode`, AUTHORITY_MODES);
    if (!result.ok) return result;
  }

  const storage = validateObjectField(profile, 'storage', `${path}.storage`);
  if (!storage.ok) return storage;
  if (storage.value) {
    result = validateRequiredEnumField(
      storage.value,
      'backend',
      `${path}.storage.backend`,
      SESSION_STORAGE_BACKENDS,
    );
    if (!result.ok) return result;
    const payloadAccess = validateObjectField(
      storage.value,
      'payloadAccessControl',
      `${path}.storage.payloadAccessControl`,
    );
    if (!payloadAccess.ok) return payloadAccess;
    if (payloadAccess.value) {
      result = validatePayloadAccessControl(payloadAccess.value, `${path}.storage.payloadAccessControl`);
      if (!result.ok) return result;
    }
  }

  const encryption = validateObjectField(profile, 'encryption', `${path}.encryption`);
  if (!encryption.ok) return encryption;
  if (encryption.value) {
    result = validateRequiredEnumField(
      encryption.value,
      'mode',
      `${path}.encryption.mode`,
      PAYLOAD_ENCRYPTION_MODES,
    );
    if (!result.ok) return result;
    result = validateEnumField(
      encryption.value,
      'keyProvider',
      `${path}.encryption.keyProvider`,
      SESSION_KEY_PROVIDERS,
    );
    if (!result.ok) return result;
  }
  return valid();
};

export const validateWorkerConfigModeValues = (config) => {
  if (!isObj(config)) return invalid('config');

  if (hasOwn(config, 'sessionModeProfile')) {
    const result = validateSessionModeProfile(config.sessionModeProfile, 'sessionModeProfile');
    if (!result.ok) return result;
  }
  if (hasOwn(config, 'storageProfile')) {
    const result = validateStorageProfile(config.storageProfile, 'storageProfile');
    if (!result.ok) return result;
  }
  return valid();
};

export const validateDeploymentModeValues = (body) => {
  if (!isObj(body)) return invalid('request');

  if (hasOwn(body, 'sessionModeProfile')) {
    const result = validateSessionModeProfile(body.sessionModeProfile, 'sessionModeProfile');
    if (!result.ok) return result;
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
