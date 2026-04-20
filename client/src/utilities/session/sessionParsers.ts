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

type AnyRecord = Record<string, any>;
type SessionIdentityInput = AnyRecord & {
  slug?: unknown;
  sessionId?: unknown;
  metadataURI?: unknown;
  chainId?: unknown;
};
type ParsedSessionIdentity = {
  ok: boolean;
  slug: string;
  sessionId: string;
  metadataURI: string;
  chainId: number | null;
  errors: string[];
};
type SessionMetadataInput = AnyRecord;
type ParsedSessionMetadata = {
  ok: boolean;
  metadata: AnyRecord;
  errors: string[];
};
type WorkerConfig = {
  corsWorkerUrl: string;
  allowOrigins: string[];
  limits: AnyRecord;
  rpcEndpoint: string;
  embeddedDeployHelperEnabled?: boolean;
};
type WorkerConfigInput = AnyRecord & {
  corsWorkerUrl?: unknown;
  allowOrigins?: unknown;
  limits?: unknown;
  rpcEndpoint?: unknown;
  rpcUrl?: unknown;
  rpc?: unknown;
  embeddedDeployHelperEnabled?: unknown;
  deployHelperEnabled?: unknown;
};
type ParsedWorkerConfig = {
  ok: boolean;
  config: WorkerConfig;
  errors: string[];
};
type LocalResourceOverrides = {
  rpc: { useLocal: boolean; apiKey: string };
  arweave: { useLocal: boolean; jwk: string };
  faucet: { useLocal: boolean; privateKey: string };
};
type LocalResourceOverridesInput = AnyRecord & {
  rpc?: unknown;
  arweave?: unknown;
  faucet?: unknown;
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

const isObj = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
const trimString = (value: unknown): string => toStr(value).trim();
const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
  if (isObj(value)) {
    return Object.keys(value).reduce((acc: AnyRecord, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {}) as T;
  }
  return (typeof value === 'string' ? value.trim() : value) as T;
};
const pushTypeError = (errors: string[], field: string, expected: string): void => {
  errors.push(`${field} must be ${expected}.`);
};
const defaultWorkerConfig = (): WorkerConfig => ({
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
  target: AnyRecord,
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
  target[key] = typeof transform === 'function' ? transform(trimmed) : trimmed;
  return target[key];
};
const normalizeOptionalBooleanField = (
  target: AnyRecord,
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
const normalizeTags = (metadata: AnyRecord, errors: string[]): void => {
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
const stripInternalMetadataFields = <T>(metadata: T): T => {
  if (!isObj(metadata)) return metadata;
  Object.keys(metadata).forEach((key) => {
    if (key.startsWith('__')) delete metadata[key];
  });
  return metadata;
};
const normalizeLegacySessionNaming = (metadata: AnyRecord): AnyRecord => {
  if (!isObj(metadata)) return metadata;
  const sessionName = normalizeOptionalStringField(metadata, 'sessionName', [], { label: 'sessionName' });
  const orgName = normalizeOptionalStringField(metadata, 'orgName', [], { label: 'orgName' });
  if (!sessionName && orgName) metadata.sessionName = orgName;

  const sessionInfo = normalizeOptionalStringField(metadata, 'sessionInfo', [], { label: 'sessionInfo' });
  const orgInfo = normalizeOptionalStringField(metadata, 'orgInfo', [], { label: 'orgInfo' });
  if (!sessionInfo && orgInfo) metadata.sessionInfo = orgInfo;
  return metadata;
};
export const parseSessionIdentity = (raw: SessionIdentityInput = {}): ParsedSessionIdentity => {
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

export const parseSessionMetadata = (raw: SessionMetadataInput): ParsedSessionMetadata => {
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

export const parseWorkerConfig = (raw: WorkerConfigInput): ParsedWorkerConfig => {
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

  return {
    ok: errors.length === 0,
    config,
    errors,
  };
};

export const parseLocalResourceOverrides = (
  raw: LocalResourceOverridesInput
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
    const section = overrides[sectionKey] as AnyRecord;
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
