import { stableCanonicalSerialize } from '../shared/deployHelperCore.mjs';
import {
  findForbiddenCloudflareDeploymentTokenPath,
  findForbiddenWorkerConfigSecretPath,
} from '../shared/workerSessionConfig.mjs';
import { validateWorkerConfigModeValues } from '../shared/workerConfigModeValidation.mjs';
import { normalizeWorkerSessionAppearance } from '../shared/sessionColorSchemeConfig.mjs';
import {
  mergeWorkerConfigRecords,
  mergeWorkerLimitRecords,
  normalizeWorkerConfigRecord,
} from './sessionConfigNormalization.js';
import {
  AUTHORIZATION_EPOCH_KEY,
  incrementAuthorizationEpoch,
} from './authorizationScopeFreshness.js';

const WORKER_CANONICAL_PUBLICATION_REVISION_KEY = 'workerCanonicalPublicationRevision';
const WORKER_GROUPS_BOOTSTRAP_KEY = 'workerGroupsBootstrap';
const REGISTRY_CANONICAL_AUTHORITY_MODES = new Set(['evm_registry_canonical', 'registry_canonical']);
const WORKER_CANONICAL_SET_CONFIG_KEYS = new Set([
  'slug',
  'sessionId',
  'sessionIdHex',
  'configRevision',
  'sessionName',
  'sessionInfo',
  'appearance',
  'sessionHeaderImg',
  'sessionEndsAt',
  'defaultTags',
  'defaultGroupTags',
  'defaultSbtTags',
  'questionsGenPrompt',
  'defaultFilterState',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'adminAddress',
  'adminAddresses',
  'corsWorkerUrl',
  'allowOrigins',
  'sessionModeProfile',
  'agentSessionWrapped',
  'workerAuthority',
  'workerRoles',
  'roles',
  'authorization',
  'groupCreationPolicy',
  'storageProfile',
  'storageEnvelope',
  'ai',
  'limits',
  'scopes',
  'networkChainId',
  'contracts',
  'embeddedDeployHelperEnabled',
  'litCredentials',
  WORKER_GROUPS_BOOTSTRAP_KEY,
]);

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const validGroupCreationPolicy = (config) =>
  !hasOwn(config, 'groupCreationPolicy') ||
  config?.groupCreationPolicy === 'admin_only' ||
  config?.groupCreationPolicy === 'participants';
const validAllowOrigins = (config) =>
  !hasOwn(config, 'allowOrigins') ||
  !Array.isArray(config?.allowOrigins) ||
  config.allowOrigins.every((origin) => typeof origin !== 'string' || !origin.includes('*'));
const validAppearanceConfig = (config) =>
  !hasOwn(config, 'appearance') || normalizeWorkerSessionAppearance(config.appearance) !== null;

const getWorkerAuthorityMode = (config) => toTrimmedString(
  config?.sessionModeProfile?.authority?.mode,
).toLowerCase();

const workerCanonicalUsesOnChainSbt = (config) => {
  const profile = config?.sessionModeProfile;
  if (profile?.authorization?.mechanisms?.includes?.('sbt_onchain')) return true;
  const conditionSources = [
    profile?.encryption?.accessConditions,
    profile?.storage?.payloadAccessControl?.accessConditions,
  ];
  return conditionSources.some((source) =>
    source?.conditions?.some?.((condition) => condition?.kind === 'sbt_onchain'));
};

const workerCanonicalUsesChain = (config) => (
  workerCanonicalUsesOnChainSbt(config) ||
  config?.sessionModeProfile?.encryption?.mode === 'lit'
);

const validateWorkerCanonicalIncomingFields = ({ incomingConfig, mergedConfig } = {}) => {
  if (getWorkerAuthorityMode(mergedConfig) !== 'worker_canonical') return { ok: true };
  const unsupportedKey = Object.keys(incomingConfig || {}).find(
    (key) => !WORKER_CANONICAL_SET_CONFIG_KEYS.has(key),
  );
  if (unsupportedKey) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported worker-canonical session config field: ${unsupportedKey}.`,
    };
  }
  const usesOnChainSbt = workerCanonicalUsesOnChainSbt(mergedConfig);
  const sbtOnlyKeys = ['defaultSbtTags', 'defaultFeaturedSBTs', 'autoFeatureSBTsBySessionSlug'];
  const unsupportedSbtKey = sbtOnlyKeys.find((key) => hasOwn(incomingConfig, key) && !usesOnChainSbt);
  if (unsupportedSbtKey) {
    return {
      ok: false,
      status: 400,
      error: `Worker-native Group sessions do not accept ${unsupportedSbtKey}.`,
    };
  }
  if (hasOwn(incomingConfig, 'networkChainId') && !workerCanonicalUsesChain(mergedConfig)) {
    return {
      ok: false,
      status: 400,
      error: 'Worker-native Group sessions do not accept networkChainId.',
    };
  }
  if (hasOwn(incomingConfig, 'contracts')) {
    const contractKeys = Object.keys(incomingConfig?.contracts || {});
    if (!usesOnChainSbt || contractKeys.some((key) => key !== 'sbtFactory')) {
      return {
        ok: false,
        status: 400,
        error: 'Worker-canonical sessions accept only the on-chain SBT Group Factory contract.',
      };
    }
  }
  return { ok: true };
};

const normalizeCanonicalSessionId = (value) => {
  const raw = toTrimmedString(value).toLowerCase();
  if (!raw) return '';
  const normalized = raw.replace(/^0x/, '').replace(/-/g, '');
  return /^[0-9a-f]{32}$/.test(normalized) && !/^0+$/.test(normalized) ? normalized : '';
};

const resolveCanonicalSessionIdentity = (config) => {
  const rawValues = ['sessionId', 'sessionIdHex']
    .filter((key) => hasOwn(config, key) && toTrimmedString(config?.[key]))
    .map((key) => config[key]);
  const normalizedValues = rawValues.map(normalizeCanonicalSessionId);
  const uniqueValues = new Set(normalizedValues.filter(Boolean));
  return {
    invalid: normalizedValues.some((value) => !value) || uniqueValues.size > 1,
    value: uniqueValues.size === 1 ? [...uniqueValues][0] : '',
  };
};

export const resolveSessionConfigSessionIdHex = (config) => {
  const identity = resolveCanonicalSessionIdentity(config);
  return !identity.invalid && identity.value ? `0x${identity.value}` : '';
};

export const resolveCanonicalWorkerSessionIdHex = resolveSessionConfigSessionIdHex;

const normalizeConfigRevision = (value) => {
  if (typeof value !== 'string' || value !== value.trim()) return '';
  return /^[a-z0-9._:-]{1,128}$/i.test(value) ? value : '';
};

const changesInitializedWorkerCanonicalIdentity = ({ existingConfig, mergedConfig } = {}) => {
  if (getWorkerAuthorityMode(existingConfig) !== 'worker_canonical') return false;
  if (getWorkerAuthorityMode(mergedConfig) !== 'worker_canonical') return true;

  const existingSessionIdentity = resolveCanonicalSessionIdentity(existingConfig);
  const mergedSessionIdentity = resolveCanonicalSessionIdentity(mergedConfig);
  if (existingSessionIdentity.invalid || mergedSessionIdentity.invalid) return true;
  if (existingSessionIdentity.value && mergedSessionIdentity.value !== existingSessionIdentity.value) return true;

  return ['slug', 'corsWorkerUrl'].some((key) => {
    const existingValue = toTrimmedString(existingConfig?.[key]);
    return !!existingValue && toTrimmedString(mergedConfig?.[key]) !== existingValue;
  });
};

const changesInitializedRegistryCanonicalIdentity = ({ existingConfig, mergedConfig } = {}) => {
  if (!REGISTRY_CANONICAL_AUTHORITY_MODES.has(getWorkerAuthorityMode(existingConfig))) return false;
  const existingSessionIdentity = resolveCanonicalSessionIdentity(existingConfig);
  const mergedSessionIdentity = resolveCanonicalSessionIdentity(mergedConfig);
  if (existingSessionIdentity.invalid || mergedSessionIdentity.invalid) return true;
  return !!existingSessionIdentity.value && mergedSessionIdentity.value !== existingSessionIdentity.value;
};

const resolveWorkerCanonicalPublicationWrite = ({
  existingConfig,
  incomingConfig,
  mergedConfig,
} = {}) => {
  if (hasOwn(incomingConfig, WORKER_CANONICAL_PUBLICATION_REVISION_KEY)) {
    return { ok: false, status: 400, error: 'Worker-canonical publication state is server-managed.' };
  }
  if (getWorkerAuthorityMode(mergedConfig) !== 'worker_canonical') {
    return { ok: true, config: mergedConfig };
  }

  const existingPublicationRevision = normalizeConfigRevision(
    existingConfig?.[WORKER_CANONICAL_PUBLICATION_REVISION_KEY],
  );
  const incomingHasRevision = hasOwn(incomingConfig, 'configRevision');
  const incomingRevision = incomingHasRevision ? normalizeConfigRevision(incomingConfig?.configRevision) : '';
  if (incomingHasRevision && !incomingRevision) {
    return { ok: false, status: 400, error: 'Worker config revision is invalid.' };
  }
  if (existingPublicationRevision && incomingHasRevision && incomingRevision !== existingPublicationRevision) {
    return { ok: false, status: 409, error: 'Worker-canonical publication is already finalized.' };
  }
  if (existingPublicationRevision && incomingRevision === existingPublicationRevision) {
    if (stableCanonicalSerialize(mergedConfig) !== stableCanonicalSerialize(existingConfig)) {
      return {
        ok: false,
        status: 409,
        error: 'Worker-canonical publication revision was reused with different config.',
      };
    }
    return { ok: true, skipPersistence: true, config: existingConfig };
  }

  const publicationRevision = existingPublicationRevision || incomingRevision;
  if (!publicationRevision) return { ok: true, config: mergedConfig };
  return {
    ok: true,
    config: {
      ...mergedConfig,
      [WORKER_CANONICAL_PUBLICATION_REVISION_KEY]: publicationRevision,
    },
  };
};

export const applySessionConfigMutation = ({ existingConfig, mutation, slug } = {}) => {
  const authorityExisting = normalizeWorkerConfigRecord(existingConfig) || {};
  const existing = normalizeWorkerConfigRecord(existingConfig, { slug }) || {};
  const kind = toTrimmedString(mutation?.kind);
  let incomingConfig;
  let mergedConfig;

  if (kind === 'set-config') {
    incomingConfig = mutation?.incomingConfig && typeof mutation.incomingConfig === 'object'
      ? mutation.incomingConfig
      : null;
    if (!incomingConfig) return { ok: false, status: 400, error: 'Missing config.' };
    if (hasOwn(incomingConfig, AUTHORIZATION_EPOCH_KEY)) {
      return { ok: false, status: 400, error: 'Authorization epoch is server-managed.' };
    }
    if (findForbiddenCloudflareDeploymentTokenPath(incomingConfig)) {
      return { ok: false, status: 400, error: 'Cloudflare deployment tokens are not allowed in session config.' };
    }
    if (findForbiddenWorkerConfigSecretPath(incomingConfig)) {
      return { ok: false, status: 400, error: 'Secret-like values are not allowed in public session config fields.' };
    }
    if (!validAllowOrigins(incomingConfig)) {
      return { ok: false, status: 400, error: 'Worker CORS allowlists must contain exact origins.' };
    }
    if (!validGroupCreationPolicy(incomingConfig)) {
      return { ok: false, status: 400, error: 'Invalid group creation policy.' };
    }
    if (!validAppearanceConfig(incomingConfig)) {
      return { ok: false, status: 400, error: 'Invalid session appearance config.' };
    }
    // A patch may update the profile without resending the already-persisted
    // canonical storage object. The complete merged record below remains
    // strict and is the only record eligible for persistence.
    const incomingModeValidation = validateWorkerConfigModeValues(incomingConfig, {
      allowPartialProfileStorage: true,
    });
    if (!incomingModeValidation.ok) {
      return {
        ok: false,
        status: 400,
        error: `Invalid session config mode at ${incomingModeValidation.path}.`,
      };
    }
    mergedConfig = mergeWorkerConfigRecords({ existingConfig: existing, incomingConfig, slug });
  } else if (kind === 'set-limits') {
    const incomingLimits = mutation?.incomingLimits && typeof mutation.incomingLimits === 'object'
      ? mutation.incomingLimits
      : null;
    if (!incomingLimits) return { ok: false, status: 400, error: 'Missing limits.' };
    incomingConfig = { limits: incomingLimits };
    mergedConfig = mergeWorkerLimitRecords({ existingConfig: existing, incomingLimits, slug });
  } else if (kind === 'merge-lit-credentials') {
    const litCredentials = mutation?.litCredentials && typeof mutation.litCredentials === 'object'
      ? mutation.litCredentials
      : null;
    if (!litCredentials) return { ok: false, status: 400, error: 'Missing Lit credentials.' };
    incomingConfig = {
      litCredentials: {
        ...((existing.litCredentials && typeof existing.litCredentials === 'object')
          ? existing.litCredentials
          : {}),
        ...litCredentials,
      },
    };
    mergedConfig = mergeWorkerConfigRecords({ existingConfig: existing, incomingConfig, slug });
  } else {
    return { ok: false, status: 400, error: 'Unsupported session config mutation.' };
  }

  // Validate the complete merged record before persistence. This covers limit
  // and Lit-descriptor mutations as well as set-config, so a rejected
  // secret-like value never lands in public config storage.
  if (findForbiddenCloudflareDeploymentTokenPath(mergedConfig)) {
    return { ok: false, status: 400, error: 'Cloudflare deployment tokens are not allowed in session config.' };
  }
  if (findForbiddenWorkerConfigSecretPath(mergedConfig)) {
    return { ok: false, status: 400, error: 'Secret-like values are not allowed in public session config fields.' };
  }
  if (!validAllowOrigins(mergedConfig)) {
    return { ok: false, status: 400, error: 'Worker CORS allowlists must contain exact origins.' };
  }
  if (!validGroupCreationPolicy(mergedConfig)) {
    return { ok: false, status: 400, error: 'Invalid group creation policy.' };
  }
  if (!validAppearanceConfig(mergedConfig)) {
    return { ok: false, status: 400, error: 'Invalid session appearance config.' };
  }
  const mergedModeValidation = validateWorkerConfigModeValues(mergedConfig);
  if (!mergedModeValidation.ok) {
    return {
      ok: false,
      status: 400,
      error: `Invalid session config mode at ${mergedModeValidation.path}.`,
    };
  }
  if (kind === 'set-config') {
    const fieldValidation = validateWorkerCanonicalIncomingFields({
      incomingConfig,
      mergedConfig,
    });
    if (!fieldValidation.ok) return fieldValidation;
  }

  if (changesInitializedWorkerCanonicalIdentity({ existingConfig: authorityExisting, mergedConfig })) {
    return {
      ok: false,
      status: 409,
      error: 'Worker-canonical session identity cannot be changed after initialization.',
    };
  }
  if (changesInitializedRegistryCanonicalIdentity({ existingConfig: authorityExisting, mergedConfig })) {
    return {
      ok: false,
      status: 409,
      error: 'Registry-canonical session identity cannot be changed after initialization.',
    };
  }
  const publicationWrite = resolveWorkerCanonicalPublicationWrite({
    existingConfig: authorityExisting,
    incomingConfig,
    mergedConfig,
  });
  if (!publicationWrite?.ok || publicationWrite.skipPersistence || kind !== 'set-config') {
    return publicationWrite;
  }

  const comparisonExisting = mergeWorkerConfigRecords({
    existingConfig: authorityExisting,
    incomingConfig: {},
    slug,
  });
  if (
    stableCanonicalSerialize(publicationWrite.config) ===
    stableCanonicalSerialize(comparisonExisting)
  ) {
    return publicationWrite;
  }
  const nextEpoch = incrementAuthorizationEpoch(authorityExisting);
  if (nextEpoch === null) {
    return { ok: false, status: 409, error: 'Authorization epoch is invalid.' };
  }
  return {
    ...publicationWrite,
    config: {
      ...publicationWrite.config,
      [AUTHORIZATION_EPOCH_KEY]: nextEpoch,
    },
  };
};
