/**
 * @module sessionParsers
 * @description Pure boundary parsers for canonical session identity, metadata, worker config,
 *              and local browser overrides.
 *
 * Key exports: parseSessionIdentity, parseSessionMetadata, parseWorkerConfig,
 *              parseLocalResourceOverrides
 */
import { toStr, normalizeSessionIdHex } from '../shared/primitives.js';
import { canonicalizeSessionSlug } from './canonicalSessionContext.js';
import {
  stripAuthoritativeSessionGateFields,
  normalizeSessionNaming,
  normalizeLitMetadataNetwork,
} from './sessionMetadata.js';
import { readConfiguredSessionWorkerUrlCandidate } from './sessionWorkerUrlCompatibility.js';
import { normalizeWorkerUrl } from '../worker/workerUrl.js';
import type {
  LocalResourceOverrides,
  SessionIdentity,
  SessionMetadataRecord,
  SessionWorkerConfig,
  UnknownRecord,
} from './sessionTypes.js';

type ParsedSessionIdentity = {
  ok: boolean;
  errors: string[];
} & SessionIdentity;
type ParsedSessionMetadata = {
  ok: boolean;
  metadata: SessionMetadataRecord;
  errors: string[];
};
type ParsedWorkerConfig = {
  ok: boolean;
  config: SessionWorkerConfig;
  errors: string[];
};
type ParsedLocalResourceOverrides = {
  ok: boolean;
  overrides: LocalResourceOverrides;
  errors: string[];
};

const LOCAL_OVERRIDE_SECTIONS = [
  { sectionKey: 'rpc', secretKey: 'apiKey' },
  { sectionKey: 'arweave', secretKey: 'jwk' },
  { sectionKey: 'faucet', secretKey: 'privateKey' },
] as const;
const WORKER_LIT_CREDENTIAL_FIELDS = [
  'litApiBase',
  'litGroupId',
  'litPkpId',
  'litActionCid',
] as const;

const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
const trimString = (value: unknown): string => toStr(value).trim();
const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
  if (isObj(value)) {
    return Object.keys(value).reduce((acc: UnknownRecord, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {}) as T;
  }
  return (typeof value === 'string' ? value.trim() : value) as T;
};
const pushTypeError = (errors: string[], field: string, expected: string): void => {
  errors.push(`${field} must be ${expected}.`);
};
const defaultWorkerConfig = (): SessionWorkerConfig => ({
  corsWorkerUrl: '',
  allowOrigins: [],
  limits: {},
  rpcEndpoint: '',
});
const defaultLocalOverrides = (): LocalResourceOverrides => ({
  rpc: { useLocal: false, apiKey: '' },
  arweave: { useLocal: false, jwk: '' },
  faucet: { useLocal: false, privateKey: '' },
});
const normalizeOptionalStringField = (
  target: UnknownRecord,
  key: string,
  errors: string[],
  {
    label = key,
    transform,
  }: { label?: string; transform?: ((value: string) => string) | undefined } = {}
): string => {
  if (!hasOwn(target, key)) return '';
  const raw = target[key];
  if (raw == null) {
    delete target[key];
    return '';
  }
  if (typeof raw !== 'string') {
    pushTypeError(errors, label, 'a string');
    delete target[key];
    return '';
  }
  const trimmed = trimString(raw);
  if (!trimmed) {
    delete target[key];
    return '';
  }
  const nextValue = typeof transform === 'function' ? transform(trimmed) : trimmed;
  target[key] = nextValue;
  return nextValue;
};
const normalizeOptionalBooleanField = (
  target: UnknownRecord,
  key: string,
  errors: string[],
  { label = key }: { label?: string } = {}
): boolean => {
  if (!hasOwn(target, key)) return false;
  const raw = target[key];
  if (raw == null) return false;
  if (typeof raw !== 'boolean') {
    pushTypeError(errors, label, 'a boolean');
    return false;
  }
  return raw;
};
const parsePositiveInteger = (raw: unknown, field: string, errors: string[]): number | null => {
  if (raw == null || raw === '') return null;
  const next = Number(raw);
  if (!Number.isInteger(next) || next <= 0) {
    errors.push(`${field} must be a positive integer.`);
    return null;
  }
  return next;
};
const normalizeTags = (metadata: UnknownRecord, errors: string[]): void => {
  if (!hasOwn(metadata, 'tags')) return;
  const raw = metadata.tags;
  if (raw == null) {
    delete metadata.tags;
    return;
  }
  if (!Array.isArray(raw)) {
    pushTypeError(errors, 'tags', 'an array of strings');
    delete metadata.tags;
    return;
  }
  const tags = raw.reduce((acc: string[], entry: unknown, index: number) => {
    if (typeof entry !== 'string') {
      pushTypeError(errors, `tags[${index}]`, 'a string');
      return acc;
    }
    const value = trimString(entry);
    if (value) acc.push(value);
    return acc;
  }, []);
  if (tags.length) {
    metadata.tags = tags;
  } else {
    delete metadata.tags;
  }
};
const normalizeWorkerLitCredentials = (
  raw: unknown,
  errors: string[]
): UnknownRecord | null => {
  if (raw == null) return {};
  if (!isObj(raw)) {
    pushTypeError(errors, 'litCredentials', 'an object');
    return null;
  }
  return WORKER_LIT_CREDENTIAL_FIELDS.reduce((acc: UnknownRecord, key) => {
    if (!hasOwn(raw, key)) return acc;
    const value = raw[key];
    if (value == null) return acc;
    if (typeof value !== 'string') {
      pushTypeError(errors, `litCredentials.${key}`, 'a string');
      return acc;
    }
    const trimmed = trimString(value);
    if (trimmed) acc[key] = trimmed;
    return acc;
  }, {});
};
const stripInternalMetadataFields = <T>(metadata: T): T => {
  if (!isObj(metadata)) return metadata;
  Object.keys(metadata).forEach((key) => {
    if (key.startsWith('__')) delete metadata[key];
  });
  return metadata;
};
const normalizeLegacySessionNaming = (metadata: UnknownRecord): UnknownRecord => {
  if (!isObj(metadata)) return metadata;
  const sessionName = normalizeOptionalStringField(metadata, 'sessionName', [], { label: 'sessionName' });
  const orgName = normalizeOptionalStringField(metadata, 'orgName', [], { label: 'orgName' });
  if (!sessionName && orgName) metadata.sessionName = orgName;

  const sessionInfo = normalizeOptionalStringField(metadata, 'sessionInfo', [], { label: 'sessionInfo' });
  const orgInfo = normalizeOptionalStringField(metadata, 'orgInfo', [], { label: 'orgInfo' });
  if (!sessionInfo && orgInfo) metadata.sessionInfo = orgInfo;
  return metadata;
};
export const parseSessionIdentity = (raw: unknown = {}): ParsedSessionIdentity => {
  const input = isObj(raw) ? raw : {};
  const errors: string[] = [];

  let slug = '';
  if (hasOwn(input, 'slug')) {
    if (input.slug == null) {
      slug = '';
    } else if (typeof input.slug !== 'string') {
      pushTypeError(errors, 'slug', 'a string');
    } else {
      slug = canonicalizeSessionSlug(input.slug);
    }
  }

  let sessionId = '';
  if (hasOwn(input, 'sessionId')) {
    if (input.sessionId == null) {
      sessionId = '';
    } else if (typeof input.sessionId !== 'string') {
      pushTypeError(errors, 'sessionId', 'a string');
    } else {
      const normalizedSessionId = normalizeSessionIdHex(input.sessionId);
      if (normalizedSessionId && !/^0x[0-9a-f]{32}$/.test(normalizedSessionId)) {
        errors.push('sessionId must be a valid 32-character hex string.');
        sessionId = '';
      } else {
        sessionId = normalizedSessionId;
      }
    }
  }

  let metadataURI = '';
  if (hasOwn(input, 'metadataURI')) {
    if (input.metadataURI == null) {
      metadataURI = '';
    } else if (typeof input.metadataURI !== 'string') {
      pushTypeError(errors, 'metadataURI', 'a string');
    } else {
      metadataURI = trimString(input.metadataURI);
    }
  }

  const chainId = hasOwn(input, 'chainId')
    ? parsePositiveInteger(input.chainId, 'chainId', errors)
    : null;

  return {
    ok: errors.length === 0,
    slug,
    sessionId,
    metadataURI,
    chainId,
    errors,
  };
};

export const parseSessionMetadata = (raw: unknown): ParsedSessionMetadata => {
  if (!isObj(raw)) {
    return {
      ok: false,
      metadata: {},
      errors: ['session metadata must be an object.'],
    };
  }

  const errors: string[] = [];
  const metadata = stripInternalMetadataFields(cloneValue(raw));

  normalizeOptionalStringField(metadata, 'slug', errors, {
    label: 'slug',
    transform: (value) => canonicalizeSessionSlug(value),
  });
  normalizeOptionalStringField(metadata, 'sessionName', errors);
  normalizeOptionalStringField(metadata, 'orgName', errors);
  normalizeOptionalStringField(metadata, 'sessionInfo', errors);
  normalizeOptionalStringField(metadata, 'orgInfo', errors);
  normalizeOptionalStringField(metadata, 'sessionInfoEncrypted', errors);
  normalizeOptionalStringField(metadata, 'encryptedSessionInfo', errors);
  normalizeOptionalStringField(metadata, 'orgInfoEncrypted', errors);
  normalizeOptionalStringField(metadata, 'encryptedOrgInfo', errors);
  normalizeOptionalStringField(metadata, 'litNetwork', errors);

  if (hasOwn(metadata, 'lit')) {
    if (metadata.lit == null) {
      delete metadata.lit;
    } else if (!isObj(metadata.lit)) {
      pushTypeError(errors, 'lit', 'an object');
      delete metadata.lit;
    } else {
      normalizeOptionalStringField(metadata.lit, 'network', errors, { label: 'lit.network' });
      normalizeOptionalStringField(metadata.lit, 'userMaxPrice', errors, { label: 'lit.userMaxPrice' });
    }
  }

  normalizeTags(metadata, errors);
  normalizeLegacySessionNaming(metadata);

  const withoutGateOverrides = stripAuthoritativeSessionGateFields(metadata);
  const named = normalizeSessionNaming(withoutGateOverrides);
  const normalized = normalizeLitMetadataNetwork(named);

  return {
    ok: errors.length === 0,
    metadata: isObj(normalized) ? normalized : {},
    errors,
  };
};

export const parseWorkerConfig = (raw: unknown): ParsedWorkerConfig => {
  if (!isObj(raw)) {
    return {
      ok: false,
      config: defaultWorkerConfig(),
      errors: ['worker config must be an object.'],
    };
  }

  const errors: string[] = [];
  const config = defaultWorkerConfig();

  // Accept legacy and compatibility key variants for backwards compatibility.
  // Prefer canonical corsWorkerUrl when present.
  const rawCorsWorkerUrl = readConfiguredSessionWorkerUrlCandidate(raw);
  if (rawCorsWorkerUrl !== undefined) {
    if (rawCorsWorkerUrl == null) {
      config.corsWorkerUrl = '';
    } else if (typeof rawCorsWorkerUrl !== 'string') {
      pushTypeError(errors, 'corsWorkerUrl', 'a string');
    } else {
      const normalizedWorkerUrl = normalizeWorkerUrl(rawCorsWorkerUrl);
      if (!normalizedWorkerUrl && trimString(rawCorsWorkerUrl)) {
        errors.push('corsWorkerUrl must be an absolute http(s) URL.');
      } else {
        config.corsWorkerUrl = normalizedWorkerUrl;
      }
    }
  }

  if (hasOwn(raw, 'allowOrigins')) {
    if (raw.allowOrigins == null) {
      config.allowOrigins = [];
    } else if (typeof raw.allowOrigins === 'string') {
      config.allowOrigins = raw.allowOrigins
        .split(/[,\n]/)
        .map((entry) => trimString(entry))
        .filter(Boolean);
    } else if (!Array.isArray(raw.allowOrigins)) {
      pushTypeError(errors, 'allowOrigins', 'an array of strings or a comma/newline-delimited string');
    } else {
      config.allowOrigins = raw.allowOrigins.reduce((acc: string[], entry: unknown, index: number) => {
        if (typeof entry !== 'string') {
          pushTypeError(errors, `allowOrigins[${index}]`, 'a string');
          return acc;
        }
        const value = trimString(entry);
        if (value) acc.push(value);
        return acc;
      }, []);
    }
  }

  if (hasOwn(raw, 'limits')) {
    if (raw.limits == null) {
      config.limits = {};
    } else if (!isObj(raw.limits)) {
      pushTypeError(errors, 'limits', 'an object');
    } else {
      config.limits = cloneValue(raw.limits);
    }
  }

  const rpcEndpointRaw = hasOwn(raw, 'rpcEndpoint')
    ? raw.rpcEndpoint
    : (
      hasOwn(raw, 'rpcUrl')
        ? raw.rpcUrl
        : (
          isObj(raw.rpc) && hasOwn(raw.rpc, 'endpoint')
            ? raw.rpc.endpoint
            : (isObj(raw.rpc) && hasOwn(raw.rpc, 'url') ? raw.rpc.url : undefined)
        )
    );
  if (rpcEndpointRaw !== undefined) {
    if (rpcEndpointRaw == null) {
      config.rpcEndpoint = '';
    } else if (typeof rpcEndpointRaw !== 'string') {
      pushTypeError(errors, 'rpcEndpoint', 'a string');
    } else {
      config.rpcEndpoint = trimString(rpcEndpointRaw);
    }
  }

  const embeddedDeployHelperEnabledRaw = hasOwn(raw, 'embeddedDeployHelperEnabled')
    ? raw.embeddedDeployHelperEnabled
    : (hasOwn(raw, 'deployHelperEnabled') ? raw.deployHelperEnabled : undefined);
  if (embeddedDeployHelperEnabledRaw !== undefined) {
    if (embeddedDeployHelperEnabledRaw == null) {
      config.embeddedDeployHelperEnabled = true;
    } else if (typeof embeddedDeployHelperEnabledRaw !== 'boolean') {
      pushTypeError(errors, 'embeddedDeployHelperEnabled', 'a boolean');
    } else {
      config.embeddedDeployHelperEnabled = embeddedDeployHelperEnabledRaw;
    }
  }

  if (hasOwn(raw, 'litCredentials')) {
    const litCredentials = normalizeWorkerLitCredentials(raw.litCredentials, errors);
    if (litCredentials) config.litCredentials = litCredentials;
  }

  return {
    ok: errors.length === 0,
    config,
    errors,
  };
};

export const parseLocalResourceOverrides = (
  raw: unknown
): ParsedLocalResourceOverrides => {
  if (!isObj(raw)) {
    return {
      ok: false,
      overrides: defaultLocalOverrides(),
      errors: ['local resource overrides must be an object.'],
    };
  }

  const errors: string[] = [];
  const overrides = defaultLocalOverrides();

  LOCAL_OVERRIDE_SECTIONS.forEach(({ sectionKey, secretKey }) => {
    const sectionRaw = raw[sectionKey];
    if (sectionRaw == null) return;
    if (!isObj(sectionRaw)) {
      pushTypeError(errors, sectionKey, 'an object');
      return;
    }
    const section = overrides[sectionKey] as unknown as UnknownRecord;
    section.useLocal = normalizeOptionalBooleanField(sectionRaw, 'useLocal', errors, {
      label: `${sectionKey}.useLocal`,
    });
    if (hasOwn(sectionRaw, secretKey)) {
      const secret = sectionRaw[secretKey];
      if (secret == null) {
        section[secretKey] = '';
      } else if (typeof secret !== 'string') {
        pushTypeError(errors, `${sectionKey}.${secretKey}`, 'a string');
      } else {
        section[secretKey] = trimString(secret);
      }
    }
  });

  return {
    ok: errors.length === 0,
    overrides,
    errors,
  };
};
