import { STORAGE_BACKENDS, normalizeStorageBackend } from '../storage/storageRefs.js';
import {
  SESSION_STORAGE_PAYLOAD_ACCESS_GATES,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
  deriveLegacyPayloadAccessMode,
  normalizeSessionStoragePayloadAccessControl,
} from '../storage/sessionStorageConfig.js';
import { normalizeSessionModeAccessConditions } from './sessionModeAccessConditions';
import {
  SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID,
  SESSION_MODE_PRESET_IDS,
  SESSION_MODE_PRESETS,
  SESSION_MODE_PROFILE_VERSION,
  cloneSessionModePreset,
  mergeSessionModeProfileStorageAccess,
  normalizeExposure,
  resolveProfilePayloadAccessControl,
  resourceStagesForBackend,
} from './sessionModeProfilePresets';
import type {
  CompiledSessionModeProfile,
  SessionModeProfile,
  SessionModeProfileSupportClassification,
  SessionModeProfileValidationIssue,
  SessionModeResourceKey,
  UnknownRecord,
} from './sessionModeProfileTypes';

export { normalizeSessionModeAccessConditions };
export {
  SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID,
  SESSION_MODE_PRESET_IDS,
  SESSION_MODE_PRESETS,
  SESSION_MODE_PROFILE_VERSION,
  cloneSessionModePreset,
  mergeSessionModeProfileStorageAccess,
};
export type {
  CompiledSessionModeProfile,
  SessionModeAccessConditionDocument,
  SessionModeAuthorityMode,
  SessionModeAuthorizationMechanism,
  SessionModeEncryptionMode,
  SessionModeExportScope,
  SessionModeIdentityMethod,
  SessionModeKeyProvider,
  SessionModePresetId,
  SessionModeProfile,
  SessionModeProfileSupportClassification,
  SessionModeProfileSupportStatus,
  SessionModeProfileValidationIssue,
  SessionModeResourceKey,
  SessionModeResultsVisibility,
  SessionModeStorageBackend,
  SessionModeSurface,
} from './sessionModeProfileTypes';

const SESSION_MODE_RESOURCE_KEYS: SessionModeResourceKey[] = [
  'docsContext',
  'questions',
  'surveys',
  'responses',
  'generatedArtifacts',
  'media',
  'images',
];

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (value: unknown, key: string): boolean =>
  isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);

const SESSION_MODE_AUTHORITY_MODES = new Set<string>([
  'worker_canonical',
  'worker_with_public_anchor',
  'evm_registry_canonical',
  'org_private_chain',
]);
const SESSION_MODE_STORAGE_BACKENDS = new Set<string>(['cloudflare', 'arweave']);
const SESSION_MODE_ENCRYPTION_MODES = new Set<string>(['none', 'lit', 'worker_envelope']);
const SESSION_MODE_KEY_PROVIDERS = new Set<string>(['worker_secret', 'cloudflare_secrets_store', 'external_kms']);
const SESSION_MODE_IDENTITY_DEFAULTS = new Set<string>(['passkey', 'wallet', 'telegram']);
const SESSION_MODE_IDENTITY_METHODS = new Set<string>(['passkey', 'wallet', 'telegram', 'agent_grant']);
const SESSION_MODE_AUTHORIZATION_MECHANISMS = new Set<string>([
  'worker_roles',
  'worker_groups',
  'sbt_onchain',
  'evm_address_allowlist',
  'telegram_account_role',
  'agent_grant',
]);
const SESSION_MODE_SURFACES = new Set<string>(['web', 'telegram', 'miniApp', 'agentHttp', 'mcp', 'ceCc']);
const SESSION_MODE_RESULTS_VISIBILITIES = new Set<string>([
  'private_admin',
  'participant_aggregate',
  'session_member_aggregate',
  'public_redacted_snapshot',
  'public_full_if_storage_public',
]);
const SESSION_MODE_EXPORT_SCOPES = new Set<string>([
  'admin_raw',
  'all_session',
  'selected_surfaces',
  'encrypted_envelopes_only',
]);
const SESSION_MODE_ACCESS_MATCHES = new Set<string>(['any', 'all']);
const SESSION_MODE_ACCESS_CONDITION_KINDS = new Set<string>(['worker_role', 'sbt_onchain', 'agent_grant_scope']);
const SESSION_MODE_RESOURCE_STAGES = new Set<string>(['active', 'staged']);
const SESSION_MODE_LEGACY_PAYLOAD_MODES = new Set<string>(['public_read', 'worker_sbt_gate', 'lit_encrypted']);
const SESSION_MODE_PRESET_VALUES = new Set<string>(Object.values(SESSION_MODE_PRESET_IDS));
const SESSION_MODE_GATE_VALUES = new Set<string>(Object.values(SESSION_STORAGE_PAYLOAD_ACCESS_GATES));
const SESSION_MODE_PAYLOAD_ENCRYPTION_VALUES = new Set<string>(Object.values(SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES));
const SESSION_MODE_SCHEMA_ONLY_ISSUE_CODES = new Set<string>([
  'schema_only_authority',
  'schema_only_authorization_mechanism',
  'schema_only_identity_method',
  'schema_only_payload_access_mode',
  'schema_only_payload_gate',
  'schema_only_resource_routing',
  'schema_only_results_exposure',
  'schema_only_surface',
]);
const SESSION_MODE_UNAVAILABLE_ISSUE_CODES = new Set<string>([
  'reserved',
  'results_visibility_not_implemented',
  'selected_surface_export_not_implemented',
]);
const SESSION_MODE_EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const trim = (value: unknown): string => String(value ?? '').trim();
const lower = (value: unknown): string => trim(value).toLowerCase();

const normalizeModeValue = (value: unknown): string => lower(value);

export const hasLegacyTelegramFirstSessionFlags = (metadata: unknown): boolean => {
  const config = isRecord(metadata) ? metadata : {};
  const telegramConfig = isRecord(config.telegram) ? config.telegram : {};
  return (
    config.telegramOnly === true ||
    config.telegram_only === true ||
    normalizeModeValue(config.sessionMode) === 'telegram_only' ||
    normalizeModeValue(config.telegramMode) === 'telegram_only' ||
    telegramConfig.only === true ||
    normalizeModeValue(telegramConfig.mode) === 'telegram_only'
  );
};

export const isSessionModeProfileTelegramFirst = (metadata: unknown): boolean => {
  const config = isRecord(metadata) ? metadata : {};
  const profile = isRecord(config.sessionModeProfile)
    ? config.sessionModeProfile
    : isRecord(metadata) && isRecord(metadata.authority)
      ? metadata
      : null;
  if (!profile) return false;
  const authority = isRecord(profile.authority) ? profile.authority : {};
  const surfaces = isRecord(profile.surfaces) ? profile.surfaces : {};
  return authority.mode === 'worker_canonical' && surfaces.telegram === true;
};

const stableSessionModeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableSessionModeValue);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<UnknownRecord>((next, key) => {
      if (typeof value[key] !== 'undefined') next[key] = stableSessionModeValue(value[key]);
      return next;
    }, {});
};

const sessionModeValuesEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(stableSessionModeValue(left)) === JSON.stringify(stableSessionModeValue(right));

const isPositiveChainId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const hasExactStringMembers = (values: string[], expected: string[]): boolean =>
  values.length === expected.length && expected.every((value) => values.includes(value));

export const validateSessionModeProfile = (
  profile: unknown,
  _opts: { enableWorkerEnvelope?: boolean } = {},
): { valid: boolean; issues: SessionModeProfileValidationIssue[] } => {
  const issues: SessionModeProfileValidationIssue[] = [];
  const addIssue = (path: string, code: string, message: string) => {
    if (!issues.some((issue) => issue.path === path && issue.code === code)) {
      issues.push({ path, code, message });
    }
  };
  const validateKnownKeys = (path: string, value: UnknownRecord, allowed: readonly string[]) => {
    const allowedKeys = new Set(allowed);
    Object.keys(value).forEach((key) => {
      if (!allowedKeys.has(key)) {
        addIssue(
          path ? `${path}.${key}` : key,
          'unknown_field',
          'Session mode profiles cannot contain unknown fields.',
        );
      }
    });
  };
  const requireRecord = (path: string, value: unknown, allowed: readonly string[]): UnknownRecord | null => {
    if (!isRecord(value)) {
      addIssue(path, 'invalid_object', `${path || 'Session mode profile'} must be an object.`);
      return null;
    }
    validateKnownKeys(path, value, allowed);
    return value;
  };
  const validateEnum = (
    path: string,
    value: unknown,
    allowed: ReadonlySet<string>,
    { optional = false }: { optional?: boolean } = {},
  ): value is string => {
    if (optional && typeof value === 'undefined') return true;
    if (typeof value !== 'string' || !allowed.has(value)) {
      addIssue(path, 'invalid_enum', `${path} must use an exact supported value.`);
      return false;
    }
    return true;
  };
  const validateStringArray = (path: string, value: unknown, allowed: ReadonlySet<string>): string[] | null => {
    if (!Array.isArray(value) || !value.length) {
      addIssue(path, 'invalid_array', `${path} must be a non-empty array.`);
      return null;
    }
    const values: string[] = [];
    value.forEach((entry, index) => {
      if (typeof entry !== 'string' || !allowed.has(entry)) {
        addIssue(`${path}.${index}`, 'invalid_enum', `${path}.${index} must use an exact supported value.`);
        return;
      }
      values.push(entry);
    });
    if (new Set(values).size !== values.length) {
      addIssue(path, 'duplicate_value', `${path} cannot contain duplicate values.`);
    }
    return values.length === value.length ? values : null;
  };
  const validateTrimmedText = (path: string, value: unknown, label: string): value is string => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 128) {
      addIssue(path, 'invalid_text', `${label} must be a non-empty trimmed string of at most 128 characters.`);
      return false;
    }
    return true;
  };
  const sbtConditionChainIds: number[] = [];
  const validateAccessConditions = (path: string, value: unknown): void => {
    const document = requireRecord(path, value, ['match', 'conditions']);
    if (!document) return;
    validateEnum(`${path}.match`, document.match, SESSION_MODE_ACCESS_MATCHES);
    if (!Array.isArray(document.conditions) || !document.conditions.length) {
      addIssue(`${path}.conditions`, 'invalid_array', 'Access conditions must contain at least one rule.');
      return;
    }
    document.conditions.forEach((conditionValue, index) => {
      const conditionPath = `${path}.conditions.${index}`;
      const condition = requireRecord(conditionPath, conditionValue, [
        'kind',
        'role',
        'chainId',
        'contract',
        'anyOrAll',
        'scope',
      ]);
      if (!condition) return;
      if (!validateEnum(`${conditionPath}.kind`, condition.kind, SESSION_MODE_ACCESS_CONDITION_KINDS)) return;
      if (condition.kind === 'worker_role') {
        validateKnownKeys(conditionPath, condition, ['kind', 'role']);
        if (!validateTrimmedText(`${conditionPath}.role`, condition.role, 'Worker role')) {
          addIssue(`${conditionPath}.role`, 'worker_role_required', 'Worker role conditions require a role.');
        }
        return;
      }
      if (condition.kind === 'agent_grant_scope') {
        validateKnownKeys(conditionPath, condition, ['kind', 'scope']);
        if (!validateTrimmedText(`${conditionPath}.scope`, condition.scope, 'Agent grant scope')) {
          addIssue(`${conditionPath}.scope`, 'agent_grant_scope_required', 'Agent grant conditions require a scope.');
        }
        return;
      }
      validateKnownKeys(conditionPath, condition, ['kind', 'chainId', 'contract', 'anyOrAll']);
      if (!isPositiveChainId(condition.chainId)) {
        addIssue(
          `${conditionPath}.chainId`,
          'sbt_condition_chain_required',
          'SBT envelope conditions require a positive integer chain id.',
        );
      } else {
        sbtConditionChainIds.push(condition.chainId);
      }
      const contract = typeof condition.contract === 'string' ? condition.contract : '';
      if (
        contract !== contract.trim() ||
        !SESSION_MODE_EVM_ADDRESS_PATTERN.test(contract) ||
        /^0x0{40}$/i.test(contract)
      ) {
        addIssue(
          `${conditionPath}.contract`,
          'sbt_condition_contract_required',
          'SBT envelope conditions require a contract address.',
        );
      }
      validateEnum(`${conditionPath}.anyOrAll`, condition.anyOrAll, SESSION_MODE_ACCESS_MATCHES);
    });
  };

  const root = requireRecord('', profile, [
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
  if (!root) return { valid: false, issues };
  if (root.profileVersion !== SESSION_MODE_PROFILE_VERSION) {
    addIssue('profileVersion', 'invalid_profile_version', 'Session mode profile must use profileVersion 1.');
  }
  validateEnum('preset', root.preset, SESSION_MODE_PRESET_VALUES);

  const authority = requireRecord('authority', root.authority, ['mode']);
  const authorityModeValid = validateEnum('authority.mode', authority?.mode, SESSION_MODE_AUTHORITY_MODES);
  const authorityMode = authorityModeValid ? authority?.mode : undefined;
  if (authorityMode === 'worker_with_public_anchor') {
    addIssue(
      'authority.mode',
      'schema_only_authority',
      'Public-anchor Worker authority is schema-only and has no supported publication path.',
    );
  }
  if (authorityMode === 'org_private_chain') {
    addIssue('authority.mode', 'reserved', 'Private-chain authority is reserved for a later implementation.');
  }

  const evm = requireRecord('evm', root.evm, ['registryChainId']);
  const registryChainId = evm?.registryChainId;
  if (registryChainId !== null && !isPositiveChainId(registryChainId)) {
    addIssue(
      'evm.registryChainId',
      'invalid_chain_id',
      'evm.registryChainId must be null or a positive integer chain id.',
    );
  }

  const storage = requireRecord('storage', root.storage, ['backend', 'payloadAccessControl', 'resources', 'mirrors']);
  const storageBackendValid = validateEnum('storage.backend', storage?.backend, SESSION_MODE_STORAGE_BACKENDS);
  const storageBackend = storageBackendValid ? storage?.backend : undefined;
  let payloadAccess: UnknownRecord | null = null;
  if (hasOwn(storage, 'payloadAccessControl')) {
    payloadAccess = requireRecord('storage.payloadAccessControl', storage?.payloadAccessControl, [
      'gate',
      'encryption',
      'mode',
      'accessConditions',
    ]);
    if (payloadAccess) {
      const gateValid = validateEnum('storage.payloadAccessControl.gate', payloadAccess.gate, SESSION_MODE_GATE_VALUES);
      const payloadEncryptionValid = validateEnum(
        'storage.payloadAccessControl.encryption',
        payloadAccess.encryption,
        SESSION_MODE_PAYLOAD_ENCRYPTION_VALUES,
      );
      if (hasOwn(payloadAccess, 'mode')) {
        const modeValid = validateEnum(
          'storage.payloadAccessControl.mode',
          payloadAccess.mode,
          SESSION_MODE_LEGACY_PAYLOAD_MODES,
        );
        if (modeValid) {
          addIssue(
            'storage.payloadAccessControl.mode',
            'schema_only_payload_access_mode',
            'Legacy payload access mode is schema-only inside a session mode profile.',
          );
        }
        if (modeValid && gateValid && payloadEncryptionValid) {
          const expectedMode = deriveLegacyPayloadAccessMode({
            gate: payloadAccess.gate as CompiledSessionModeProfile['payloadAccessControl']['gate'],
            encryption: payloadAccess.encryption as CompiledSessionModeProfile['payloadAccessControl']['encryption'],
          });
          if (payloadAccess.mode !== expectedMode) {
            addIssue(
              'storage.payloadAccessControl.mode',
              'payload_access_mode_mismatch',
              'Legacy payload access mode must match the exact gate and encryption values.',
            );
          }
        }
      }
      if (gateValid && ['sbt_gate', 'group_gate'].includes(String(payloadAccess.gate))) {
        addIssue(
          'storage.payloadAccessControl.gate',
          'schema_only_payload_gate',
          'That payload gate is schema-only; use explicit Worker access rules for supported profiles.',
        );
      }
      if (hasOwn(payloadAccess, 'accessConditions')) {
        validateAccessConditions('storage.payloadAccessControl.accessConditions', payloadAccess.accessConditions);
      }
    }
  }
  if (hasOwn(storage, 'resources')) {
    const resources = requireRecord('storage.resources', storage?.resources, SESSION_MODE_RESOURCE_KEYS);
    if (resources) {
      Object.entries(resources).forEach(([key, value]) => {
        const resource = requireRecord(`storage.resources.${key}`, value, ['stage', 'backendOverride']);
        if (!resource) return;
        validateEnum(`storage.resources.${key}.stage`, resource.stage, SESSION_MODE_RESOURCE_STAGES);
        if (
          hasOwn(resource, 'backendOverride') &&
          (typeof resource.backendOverride !== 'string' ||
            !resource.backendOverride.trim() ||
            resource.backendOverride !== resource.backendOverride.trim())
        ) {
          addIssue(
            `storage.resources.${key}.backendOverride`,
            'invalid_text',
            'Resource backend overrides must be non-empty trimmed strings.',
          );
        }
      });
      addIssue(
        'storage.resources',
        'schema_only_resource_routing',
        'Per-resource stage and backend overrides are schema-only in the v1 wizard.',
      );
    }
  }
  if (hasOwn(storage, 'mirrors')) {
    const mirrors = storage?.mirrors;
    if (
      !Array.isArray(mirrors) ||
      !mirrors.length ||
      mirrors.some((value) => typeof value !== 'string' || !value.trim() || value !== value.trim()) ||
      new Set(mirrors).size !== mirrors.length
    ) {
      addIssue('storage.mirrors', 'invalid_array', 'Storage mirrors must be unique non-empty trimmed strings.');
    } else {
      addIssue('storage.mirrors', 'schema_only_resource_routing', 'Storage mirrors are schema-only in the v1 wizard.');
    }
  }

  const identity = requireRecord('identity', root.identity, ['default', 'enabled']);
  const identityDefaultValid = validateEnum('identity.default', identity?.default, SESSION_MODE_IDENTITY_DEFAULTS);
  const identityDefault = identityDefaultValid ? String(identity?.default) : undefined;
  const identityMethods = validateStringArray('identity.enabled', identity?.enabled, SESSION_MODE_IDENTITY_METHODS);
  if (identityMethods && identityDefault && !identityMethods.includes(identityDefault)) {
    addIssue('identity.default', 'identity_default_not_enabled', 'The default identity method must also be enabled.');
  }
  identityMethods
    ?.filter((method) => method === 'telegram' || method === 'agent_grant')
    .forEach((method) => {
      addIssue(
        'identity.enabled',
        'schema_only_identity_method',
        `${method} identity is schema-only in the v1 wizard.`,
      );
    });

  const authorization = requireRecord('authorization', root.authorization, ['mechanisms']);
  const mechanisms = validateStringArray(
    'authorization.mechanisms',
    authorization?.mechanisms,
    SESSION_MODE_AUTHORIZATION_MECHANISMS,
  );
  mechanisms
    ?.filter((mechanism) =>
      ['worker_groups', 'evm_address_allowlist', 'telegram_account_role', 'agent_grant'].includes(mechanism),
    )
    .forEach((mechanism) => {
      addIssue(
        'authorization.mechanisms',
        'schema_only_authorization_mechanism',
        `${mechanism} authorization is schema-only in the v1 wizard.`,
      );
    });

  const encryption = requireRecord('encryption', root.encryption, ['mode', 'keyProvider', 'accessConditions']);
  const encryptionModeValid = validateEnum('encryption.mode', encryption?.mode, SESSION_MODE_ENCRYPTION_MODES);
  const encryptionMode = encryptionModeValid ? encryption?.mode : undefined;
  let keyProviderValid = true;
  if (hasOwn(encryption, 'keyProvider')) {
    keyProviderValid = validateEnum('encryption.keyProvider', encryption?.keyProvider, SESSION_MODE_KEY_PROVIDERS);
    if (keyProviderValid && encryption?.keyProvider !== 'worker_secret') {
      addIssue(
        'encryption.keyProvider',
        'reserved',
        'Only the worker_secret key provider is implemented for Worker envelope encryption.',
      );
    }
  }
  if (hasOwn(encryption, 'accessConditions')) {
    validateAccessConditions('encryption.accessConditions', encryption?.accessConditions);
  }

  const surfaces = requireRecord('surfaces', root.surfaces, [...SESSION_MODE_SURFACES]);
  if (surfaces) {
    SESSION_MODE_SURFACES.forEach((surface) => {
      if (typeof surfaces[surface] !== 'boolean') {
        addIssue(`surfaces.${surface}`, 'invalid_boolean', `surfaces.${surface} must be a boolean.`);
      }
    });
    if (surfaces.web !== true) {
      addIssue('surfaces.web', 'web_surface_fixed_on', 'The web surface is fixed on in v1.');
    }
    if (surfaces.miniApp === true && surfaces.telegram !== true) {
      addIssue('surfaces.miniApp', 'mini_app_requires_telegram', 'Telegram Mini App requires the Telegram channel.');
    }
    ['mcp', 'ceCc'].forEach((surface) => {
      if (surfaces[surface] === true) {
        addIssue(
          `surfaces.${surface}`,
          'schema_only_surface',
          `${surface} participation is schema-only in the v1 wizard.`,
        );
      }
    });
  }

  const results = requireRecord('results', root.results, ['visibility', 'exposure']);
  const visibilityValid = validateEnum('results.visibility', results?.visibility, SESSION_MODE_RESULTS_VISIBILITIES);
  if (visibilityValid && ['private_admin', 'public_redacted_snapshot'].includes(String(results?.visibility))) {
    addIssue(
      'results.visibility',
      'results_visibility_not_implemented',
      'That results visibility option is not available yet. Choose an enforced results policy.',
    );
  }
  const exposure = requireRecord('results.exposure', results?.exposure, [
    'aggregateResultsEnabled',
    'anonymizedGroupsEnabled',
    'minGroupSize',
  ]);
  if (exposure) {
    if (typeof exposure.aggregateResultsEnabled !== 'boolean') {
      addIssue(
        'results.exposure.aggregateResultsEnabled',
        'invalid_boolean',
        'Aggregate results exposure must be a boolean.',
      );
    } else if (exposure.aggregateResultsEnabled === false) {
      addIssue(
        'results.exposure.aggregateResultsEnabled',
        'schema_only_results_exposure',
        'Disabling aggregate results is schema-only in the v1 wizard.',
      );
    }
    if (typeof exposure.anonymizedGroupsEnabled !== 'boolean') {
      addIssue(
        'results.exposure.anonymizedGroupsEnabled',
        'invalid_boolean',
        'Anonymized group exposure must be a boolean.',
      );
    }
    if (
      typeof exposure.minGroupSize !== 'number' ||
      !Number.isSafeInteger(exposure.minGroupSize) ||
      exposure.minGroupSize < 2
    ) {
      addIssue(
        'results.exposure.minGroupSize',
        'invalid_min_group_size',
        'Minimum group size must be an integer of at least 2.',
      );
    }
  }

  const exportConfig = requireRecord('export', root.export, ['scope', 'surfaceFilter']);
  const exportScopeValid = validateEnum('export.scope', exportConfig?.scope, SESSION_MODE_EXPORT_SCOPES);
  const exportScope = exportScopeValid ? exportConfig?.scope : undefined;
  let exportSurfaces: string[] | null = null;
  if (hasOwn(exportConfig, 'surfaceFilter')) {
    exportSurfaces = validateStringArray('export.surfaceFilter', exportConfig?.surfaceFilter, SESSION_MODE_SURFACES);
    if (exportScope !== 'selected_surfaces') {
      addIssue(
        'export.surfaceFilter',
        'surface_filter_requires_selected_export',
        'Export surface filters are valid only with selected-channel export.',
      );
    }
  }
  if (exportScope === 'selected_surfaces') {
    addIssue(
      'export.scope',
      'selected_surface_export_not_implemented',
      'Selected-channel export is not available yet. Choose another export policy.',
    );
    if (!exportSurfaces) {
      addIssue('export.surfaceFilter', 'surface_filter_required', 'Selected-channel export requires a surface filter.');
    }
  }

  if (storageBackend === 'cloudflare' && !payloadAccess) {
    addIssue(
      'storage.payloadAccessControl',
      'cloudflare_payload_access_required',
      'Cloudflare profiles require an explicit payload access policy.',
    );
  }
  if (storageBackend === 'arweave' && hasOwn(storage, 'payloadAccessControl')) {
    addIssue(
      'storage.payloadAccessControl',
      'payload_access_cloudflare_only',
      'Payload access control belongs only to Cloudflare storage profiles.',
    );
  }
  if (
    payloadAccess &&
    encryptionMode &&
    SESSION_MODE_PAYLOAD_ENCRYPTION_VALUES.has(String(payloadAccess.encryption)) &&
    payloadAccess.encryption !== encryptionMode
  ) {
    addIssue(
      'storage.payloadAccessControl.encryption',
      'payload_encryption_mismatch',
      'Cloudflare payload encryption must match the session encryption mode.',
    );
  }

  if (encryptionMode === 'worker_envelope') {
    if (storageBackend !== 'cloudflare') {
      addIssue(
        'encryption.mode',
        'worker_envelope_requires_cloudflare',
        'Worker envelope encryption is available only with Cloudflare storage.',
      );
    }
    if (!hasOwn(encryption, 'keyProvider') || encryption?.keyProvider !== 'worker_secret') {
      addIssue(
        'encryption.keyProvider',
        'worker_secret_required',
        'Worker envelope encryption requires the worker_secret key provider.',
      );
    }
  } else if (hasOwn(encryption, 'keyProvider') && keyProviderValid) {
    addIssue(
      'encryption.keyProvider',
      'key_provider_requires_worker_envelope',
      'A key provider is valid only with Worker envelope encryption.',
    );
  }
  if (encryptionMode !== 'worker_envelope' && hasOwn(encryption, 'accessConditions')) {
    addIssue(
      'encryption.accessConditions',
      'access_conditions_require_worker_envelope',
      'Session encryption access conditions are supported only with Worker envelope encryption.',
    );
  }
  if (sbtConditionChainIds.length && encryptionMode !== 'worker_envelope') {
    addIssue(
      'encryption.mode',
      'sbt_conditions_require_worker_envelope',
      'Explicit SBT access rules are supported only with Worker envelope encryption.',
    );
  }

  const hasSbtCondition = sbtConditionChainIds.length > 0;
  const chainRelevant =
    authorityMode === 'evm_registry_canonical' ||
    authorityMode === 'worker_with_public_anchor' ||
    encryptionMode === 'lit' ||
    hasSbtCondition;
  if (chainRelevant && !isPositiveChainId(registryChainId)) {
    addIssue(
      'evm.registryChainId',
      encryptionMode === 'lit' ? 'lit_requires_registry_chain' : 'sbt_condition_requires_registry_chain',
      'This profile requires a positive registry chain id.',
    );
  }
  if (!chainRelevant && registryChainId !== null) {
    addIssue(
      'evm.registryChainId',
      'unexpected_registry_chain',
      'Chain-free Worker profiles must keep evm.registryChainId null.',
    );
  }
  if (isPositiveChainId(registryChainId) && sbtConditionChainIds.some((chainId) => chainId !== registryChainId)) {
    addIssue(
      'evm.registryChainId',
      'access_condition_chain_mismatch',
      'Every SBT access rule must use the selected registry chain.',
    );
  }

  if (authorityMode === 'worker_canonical') {
    if (storageBackend !== 'cloudflare') {
      addIssue(
        'storage.backend',
        'worker_authority_requires_cloudflare',
        'Worker-canonical profiles require Cloudflare storage.',
      );
    }
    if (identityDefault !== 'passkey' || !identityMethods?.includes('passkey') || identityMethods.includes('wallet')) {
      addIssue(
        'identity',
        'worker_identity_mismatch',
        'Worker-canonical profiles require passkey identity and cannot retain registry wallet identity.',
      );
    }
    if (!mechanisms?.includes('worker_roles') || mechanisms.includes('evm_address_allowlist')) {
      addIssue(
        'authorization.mechanisms',
        'worker_authorization_mismatch',
        'Worker-canonical profiles require Worker role authorization.',
      );
    }
    if (mechanisms?.includes('sbt_onchain') && !hasSbtCondition) {
      addIssue(
        'authorization.mechanisms',
        'sbt_authorization_requires_condition',
        'Worker SBT authorization requires an explicit SBT access condition.',
      );
    }
  }
  if (authorityMode === 'evm_registry_canonical') {
    if (storageBackend !== 'arweave') {
      addIssue(
        'storage.backend',
        'registry_authority_requires_arweave',
        'Registry-canonical profiles require Arweave storage.',
      );
    }
    if (
      identityDefault !== 'wallet' ||
      !identityMethods ||
      !hasExactStringMembers(identityMethods, ['wallet', 'passkey'])
    ) {
      addIssue(
        'identity',
        'registry_identity_mismatch',
        'Registry-canonical profiles require wallet identity with passkey support.',
      );
    }
    if (!mechanisms || !hasExactStringMembers(mechanisms, ['sbt_onchain'])) {
      addIssue(
        'authorization.mechanisms',
        'registry_authorization_mismatch',
        'Registry-canonical profiles require on-chain SBT authorization.',
      );
    }
  }

  if (exportScope === 'encrypted_envelopes_only' && encryptionMode === 'none') {
    addIssue('export.scope', 'encrypted_export_requires_encryption', 'Encrypted-envelope export requires encryption.');
  }
  if (
    mechanisms?.length === 1 &&
    mechanisms[0] === 'telegram_account_role' &&
    ['admin_raw', 'all_session', 'selected_surfaces', 'encrypted_envelopes_only'].includes(String(exportScope))
  ) {
    addIssue(
      'authorization.mechanisms',
      'telegram_role_cannot_be_sole_admin_export_gate',
      'Telegram account role cannot be the only admin or export gate.',
    );
  }

  if (
    root.preset === SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE &&
    !sessionModeValuesEqual(root, SESSION_MODE_PRESETS.fast_cheap_cloudflare)
  ) {
    addIssue('preset', 'preset_profile_mismatch', 'The Cloudflare preset id must match the exact preset profile.');
  }
  if (
    root.preset === SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED &&
    !sessionModeValuesEqual(root, SESSION_MODE_PRESETS.trustless_public_decentralized)
  ) {
    addIssue('preset', 'preset_profile_mismatch', 'The decentralized preset id must match the exact preset profile.');
  }

  return { valid: issues.length === 0, issues };
};

export const classifySessionModeProfileSupport = (profile: unknown): SessionModeProfileSupportClassification => {
  const validation = validateSessionModeProfile(profile);
  if (validation.valid) return { status: 'reachable', validation };
  const issueCodes = validation.issues.map((issue) => issue.code);
  const hasInvalidIssue = issueCodes.some(
    (code) => !SESSION_MODE_SCHEMA_ONLY_ISSUE_CODES.has(code) && !SESSION_MODE_UNAVAILABLE_ISSUE_CODES.has(code),
  );
  if (hasInvalidIssue) return { status: 'invalid', validation };
  if (issueCodes.some((code) => SESSION_MODE_UNAVAILABLE_ISSUE_CODES.has(code))) {
    return { status: 'unavailable', validation };
  }
  return { status: 'schema_only', validation };
};

export const compileSessionModeProfile = (profile: SessionModeProfile): CompiledSessionModeProfile => {
  const support = classifySessionModeProfileSupport(profile);
  if (support.status !== 'reachable') {
    const firstIssue = support.validation.issues[0];
    throw new Error(
      `Cannot compile unsupported session mode profile${
        firstIssue ? ` at ${firstIssue.path || 'profile'} (${firstIssue.code})` : ''
      }.`,
    );
  }
  const storageBackend =
    profile.storage.backend === 'cloudflare' ? STORAGE_BACKENDS.CLOUDFLARE : STORAGE_BACKENDS.ARWEAVE;
  const payloadAccessControl = resolveProfilePayloadAccessControl(profile);
  const payloadAccessMode = deriveLegacyPayloadAccessMode(payloadAccessControl);
  const storageProfile: UnknownRecord = {
    type: 'session_storage_profile',
    version: 'session-storage-profile-v1',
    backend: storageBackend,
    sessionOwned: true,
    telegramOwned: false,
    resources: resourceStagesForBackend(profile.storage.backend, profile.storage.resources),
  };

  if (storageBackend === STORAGE_BACKENDS.CLOUDFLARE) {
    storageProfile.payloadAccessControl = {
      gate: payloadAccessControl.gate,
      encryption: payloadAccessControl.encryption,
      ...(payloadAccessControl.accessConditions
        ? { accessConditions: deepClone(payloadAccessControl.accessConditions) }
        : {}),
    };
    storageProfile.cloudflare = { payloadAccessMode };
  }

  return {
    storageProfile,
    payloadAccessControl,
    payloadAccessMode,
    authorityMode: profile.authority.mode,
    telegramBridgeEnabled: profile.surfaces.telegram === true,
    miniAppEnabled: profile.surfaces.miniApp === true,
    agentHttpEnabled: profile.surfaces.agentHttp === true,
    resultsExposure: normalizeExposure(profile.results.exposure),
    exportScope: profile.export.scope,
    exportSurfaceFilter: Array.isArray(profile.export.surfaceFilter) ? [...profile.export.surfaceFilter] : [],
  };
};

const normalizeRegistryChainId = (value: unknown): number | null => {
  const chainId = Number(value || 0);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
};

export const profileFromLegacyConfig = (sessionConfig: unknown): SessionModeProfile => {
  const config = isRecord(sessionConfig) ? sessionConfig : {};
  const storageProfile = isRecord(config.storageProfile)
    ? config.storageProfile
    : isRecord(config.sessionStorageProfile)
      ? config.sessionStorageProfile
      : {};
  const normalizedBackend = normalizeStorageBackend(storageProfile.backend || config.storageBackend || config.storage);
  if (hasLegacyTelegramFirstSessionFlags(config)) {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.telegram = true;
    profile.surfaces.miniApp = true;
    profile.surfaces.web = true;
    return profile;
  }

  const profile = cloneSessionModePreset(
    normalizedBackend === STORAGE_BACKENDS.CLOUDFLARE
      ? SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE
      : SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
  );
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.evm.registryChainId = normalizeRegistryChainId(
    config.registryChainId || config.networkChainId || (isRecord(config.evm) ? config.evm.registryChainId : null),
  );

  if (normalizedBackend === STORAGE_BACKENDS.LIT_ARWEAVE) {
    profile.storage.backend = 'arweave';
    profile.encryption = { mode: 'lit' };
  } else if (normalizedBackend === STORAGE_BACKENDS.CLOUDFLARE) {
    profile.authority.mode = 'worker_canonical';
    profile.storage.backend = 'cloudflare';
    const access = normalizeSessionStoragePayloadAccessControl(storageProfile);
    const rawPayloadAccess = isRecord(storageProfile.payloadAccessControl) ? storageProfile.payloadAccessControl : {};
    const rawCloudflare = isRecord(storageProfile.cloudflare) ? storageProfile.cloudflare : {};
    const hasExplicitLegacyAccess =
      ['gate', 'encryption', 'mode'].some((key) => hasOwn(rawPayloadAccess, key)) ||
      ['gate', 'encryption', 'payloadAccessMode', 'accessControlMode'].some((key) => hasOwn(storageProfile, key)) ||
      hasOwn(rawCloudflare, 'payloadAccessMode');
    profile.storage.payloadAccessControl = hasExplicitLegacyAccess
      ? {
          gate: access.gate,
          encryption: access.encryption,
        }
      : {
          ...deepClone(
            SESSION_MODE_PRESETS.fast_cheap_cloudflare.storage.payloadAccessControl || {
              gate: 'role_gate',
              encryption: 'worker_envelope',
            },
          ),
          encryption: access.encryption,
        };
    // Mode switches replace, rather than merge, mode-specific key metadata.
    // Carrying worker_secret into Lit/none profiles misstates the decrypt path.
    profile.encryption =
      access.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE
        ? { mode: 'worker_envelope', keyProvider: 'worker_secret' }
        : access.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
          ? { mode: 'lit' }
          : { mode: 'none' };
    if (
      isRecord(storageProfile.payloadAccessControl) &&
      isRecord(storageProfile.payloadAccessControl.accessConditions)
    ) {
      const accessConditions = normalizeSessionModeAccessConditions(
        storageProfile.payloadAccessControl.accessConditions,
      );
      if (accessConditions?.conditions.length) profile.encryption.accessConditions = accessConditions;
    }
  } else {
    profile.authority.mode = 'evm_registry_canonical';
    profile.storage.backend = 'arweave';
    profile.encryption = { mode: 'none' };
  }

  return profile;
};
