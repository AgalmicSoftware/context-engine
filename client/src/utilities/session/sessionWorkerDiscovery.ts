type UnknownRecord = Record<string, unknown>;

export type DiscoveryEnvironment = 'development' | 'production' | 'test' | string;

type WorkerOriginOptions = {
  environment?: DiscoveryEnvironment;
};

type ValidateBootstrapOptions = WorkerOriginOptions & {
  expectedSlug: string;
  workerOrigin: string;
};

type FetchBootstrapOptions = WorkerOriginOptions & {
  fetchImpl?: typeof fetch;
  sessionSlug: string;
  signal?: AbortSignal;
  workerQueryValue: unknown;
};

export type WorkerCanonicalSessionBootstrap = {
  config: UnknownRecord;
  configRevision: string;
  sessionId: string;
  sessionSlug: string;
  workerOrigin: string;
};

const WORKER_URL_KEYS = Object.freeze([
  'corsWorkerUrl',
  'corsWorkerURL',
  'CorsWorkerURL',
  'workerUrl',
  'sessionCorsWorkerUrl',
  'sessionWorkerUrl',
  'sessionWorkerURL',
  'workerURL',
]);

const METADATA_HOSTS = new Set([
  'instance-data.ec2.internal',
  'metadata',
  'metadata.aws.internal',
  'metadata.azure.internal',
  'metadata.google',
  'metadata.google.internal',
  'metadata.internal',
]);

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const runtimeEnvironment = (): DiscoveryEnvironment =>
  typeof process !== 'undefined' && process.env?.NODE_ENV ? process.env.NODE_ENV : 'production';

const normalizeHostname = (value: string): string =>
  value.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '').split('%')[0].replace(/\.+$/, '');

const parseIpv4Octets = (hostname: string): number[] | null => {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
};

const isBlockedIpv4 = (octets: number[]): boolean => {
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 168 && b === 63 && c === 129 && octets[3] === 16) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 31 && c === 196) ||
    (a === 192 && b === 52 && c === 193) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 175 && c === 48) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const parseIpv6Hextets = (hostname: string): number[] | null => {
  const bare = normalizeHostname(hostname);
  if (!bare.includes(':')) return null;
  const halves = bare.split('::');
  if (halves.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const tokens = side.split(':');
    const parsed: number[] = [];
    for (const token of tokens) {
      const ipv4 = parseIpv4Octets(token);
      if (ipv4) {
        parsed.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/i.test(token)) return null;
      parsed.push(Number.parseInt(token, 16));
    }
    return parsed;
  };

  const left = parseSide(halves[0]);
  const right = parseSide(halves[1] || '');
  if (!left || !right) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  const omittedCount = 8 - left.length - right.length;
  if (omittedCount < 1) return null;
  return [...left, ...Array<number>(omittedCount).fill(0), ...right];
};

const isAllZero = (values: number[]): boolean => values.every((value) => value === 0);

const isBlockedIpv6 = (hextets: number[]): boolean => {
  if (hextets.length !== 8) return true;
  if (isAllZero(hextets)) return true;
  if (hextets.slice(0, 7).every((value) => value === 0) && hextets[7] === 1) return true;

  const [first, second, third] = hextets;
  // Regression guard: transition ranges can encode an otherwise blocked IPv4
  // target, so discovery rejects the range instead of inspecting only the text.
  if (hextets.slice(0, 6).every((value) => value === 0)) return true;
  if (hextets.slice(0, 5).every((value) => value === 0) && hextets[5] === 0xffff) return true;
  if (first === 0x0064 && second === 0xff9b) return true;
  if (first === 0x0100 && second === 0 && third === 0 && hextets[3] === 0) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80 || (first & 0xffc0) === 0xfec0) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) return true;
  if (first === 0x2002) return true;
  if ((first & 0xfff0) === 0x3ff0) return true;
  return false;
};

const isLocalDevelopmentHost = (hostname: string): boolean => {
  if (hostname === 'localhost') return true;
  const ipv4 = parseIpv4Octets(hostname);
  if (ipv4?.[0] === 127) return true;
  const ipv6 = parseIpv6Hextets(hostname);
  return !!ipv6 && ipv6.slice(0, 7).every((value) => value === 0) && ipv6[7] === 1;
};

const isBlockedHostname = (hostname: string): boolean => {
  if (!hostname || METADATA_HOSTS.has(hostname)) return true;
  if (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa')
  ) {
    return true;
  }
  const ipv4 = parseIpv4Octets(hostname);
  if (ipv4) return isBlockedIpv4(ipv4);
  const ipv6 = parseIpv6Hextets(hostname);
  if (ipv6) return isBlockedIpv6(ipv6);
  // Single-label names can resolve through local search domains and are not a
  // stable, shareable worker origin.
  return !hostname.includes('.');
};

const assertOriginOnlySyntax = (raw: string): void => {
  const hasControlOrSpace = Array.from(raw).some((character) => character.charCodeAt(0) <= 0x20);
  if (!raw || raw !== raw.trim() || hasControlOrSpace || raw.includes('\\')) {
    throw new Error('Worker discovery URL must be a valid origin.');
  }
  const schemeSeparator = raw.indexOf('://');
  if (schemeSeparator <= 0) throw new Error('Worker discovery URL must be a valid origin.');
  const authorityAndSuffix = raw.slice(schemeSeparator + 3);
  if (authorityAndSuffix.includes('?') || authorityAndSuffix.includes('#')) {
    throw new Error('Worker discovery URL cannot include a query or fragment.');
  }
  const slashIndex = authorityAndSuffix.indexOf('/');
  if (slashIndex >= 0 && authorityAndSuffix.slice(slashIndex) !== '/') {
    throw new Error('Worker discovery URL cannot include a path.');
  }
};

export const parseSessionWorkerDiscoveryOrigin = (
  value: unknown,
  { environment = runtimeEnvironment() }: WorkerOriginOptions = {},
): string => {
  if (typeof value !== 'string') throw new Error('Worker discovery URL must be a valid origin.');
  assertOriginOnlySyntax(value);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Worker discovery URL must be a valid origin.');
  }
  if (parsed.username || parsed.password) throw new Error('Worker discovery URL cannot include credentials.');

  const hostname = normalizeHostname(parsed.hostname);
  const isProduction = String(environment).trim().toLowerCase() === 'production';
  const isLocalDevelopment = !isProduction && isLocalDevelopmentHost(hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalDevelopment)) {
    throw new Error('Worker discovery URL must use HTTPS.');
  }
  if (!isLocalDevelopment && isBlockedHostname(hostname)) {
    throw new Error('Worker discovery URL cannot target a local, private, or reserved host.');
  }

  const host = hostname.includes(':') ? `[${hostname}]` : hostname;
  const port = parsed.port ? `:${parsed.port}` : '';
  return `${parsed.protocol}//${host}${port}`;
};

export const parseSessionWorkerDiscoveryQuery = (search: unknown, options: WorkerOriginOptions = {}): string => {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const values = params.getAll('worker');
  if (values.length === 0) return '';
  if (values.length !== 1 || !values[0]) {
    throw new Error('Worker discovery URL must appear exactly once.');
  }
  return parseSessionWorkerDiscoveryOrigin(values[0], options);
};

const normalizeSecretKey = (key: string): string => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

const isSecretLikeKey = (key: string, value: unknown): boolean => {
  const normalized = normalizeSecretKey(key);
  if (normalized === 'keyprovider') return false;
  if (normalized === 'credentialsource' && typeof value === 'string') return false;
  if (normalized.startsWith('exposes') && typeof value === 'boolean') return false;
  return (
    normalized === 'rpc' ||
    normalized === 'secrets' ||
    normalized.startsWith('faucet') ||
    normalized.includes('credential') ||
    normalized.includes('apikey') ||
    normalized.includes('apitoken') ||
    normalized.includes('privatekey') ||
    normalized.includes('rpcendpoint') ||
    normalized.includes('rpcurl') ||
    normalized.includes('accesstoken') ||
    normalized.endsWith('key') ||
    normalized.includes('jwk') ||
    normalized.endsWith('nonce') ||
    normalized.endsWith('password') ||
    normalized.startsWith('password') ||
    normalized.startsWith('secret') ||
    normalized.endsWith('secret') ||
    normalized.startsWith('token') ||
    normalized.endsWith('token')
  );
};

export const findSecretLikeSessionWorkerBootstrapPath = (value: unknown, path = 'config'): string => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findSecretLikeSessionWorkerBootstrapPath(value[index], `${path}.${index}`);
      if (nested) return nested;
    }
    return '';
  }
  if (!isRecord(value)) return '';
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSecretLikeKey(key, nestedValue)) return `${path}.${key}`;
    const nested = findSecretLikeSessionWorkerBootstrapPath(nestedValue, `${path}.${key}`);
    if (nested) return nested;
  }
  return '';
};

const validateExactSlug = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value !== value.trim() || !/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value)) {
    throw new Error(`${label} must be a canonical session slug.`);
  }
  return value;
};

export const normalizeWorkerCanonicalSessionIdHex = (value: unknown): string => {
  if (typeof value !== 'string' || value !== value.trim()) return '';
  const lower = value.toLowerCase();
  const hex = lower.startsWith('0x') ? lower.slice(2) : lower;
  if (/^[0-9a-f]{32}$/.test(hex) && !/^0+$/.test(hex)) return `0x${hex}`;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(lower)) {
    const uuidHex = lower.replace(/-/g, '');
    return /^0+$/.test(uuidHex) ? '' : `0x${uuidHex}`;
  }
  return '';
};

const comparableSessionId = (value: string): string => value.replace(/^0x/, '').replace(/-/g, '');

const validateConfigSessionId = (config: UnknownRecord): string => {
  const sessionId = normalizeWorkerCanonicalSessionIdHex(config.sessionId);
  const sessionIdHex = normalizeWorkerCanonicalSessionIdHex(config.sessionIdHex);
  if (!sessionId && !sessionIdHex) throw new Error('Worker bootstrap config has an invalid sessionId.');
  if (sessionId && sessionIdHex && comparableSessionId(sessionId) !== comparableSessionId(sessionIdHex)) {
    throw new Error('Worker bootstrap config contains conflicting session IDs.');
  }
  return sessionId || sessionIdHex;
};

const validateConfigRevision = (value: unknown): string => {
  if (typeof value !== 'string' || value !== value.trim() || value.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw new Error('Worker bootstrap config has an invalid configRevision.');
  }
  return value;
};

const validateRepresentedWorkerOrigins = (
  config: UnknownRecord,
  expectedOrigin: string,
  environment: DiscoveryEnvironment,
): void => {
  for (const key of WORKER_URL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(config, key) || config[key] === '') continue;
    const representedOrigin = parseSessionWorkerDiscoveryOrigin(config[key], { environment });
    if (representedOrigin !== expectedOrigin) {
      throw new Error('Worker bootstrap config does not match the discovery worker origin.');
    }
  }
};

export const validateWorkerCanonicalSessionBootstrap = (
  payload: unknown,
  { expectedSlug, workerOrigin, environment = runtimeEnvironment() }: ValidateBootstrapOptions,
): WorkerCanonicalSessionBootstrap => {
  const canonicalExpectedSlug = validateExactSlug(expectedSlug, 'Expected slug');
  const canonicalWorkerOrigin = parseSessionWorkerDiscoveryOrigin(workerOrigin, { environment });
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.config)) {
    throw new Error('Worker bootstrap response has an invalid envelope.');
  }
  const responseSlug = validateExactSlug(payload.sessionSlug, 'Worker bootstrap slug');
  const configSlug = validateExactSlug(payload.config.slug, 'Worker bootstrap config slug');
  if (responseSlug !== canonicalExpectedSlug || configSlug !== canonicalExpectedSlug) {
    throw new Error('Worker bootstrap response slug does not match the requested session.');
  }

  const profile = isRecord(payload.config.sessionModeProfile) ? payload.config.sessionModeProfile : null;
  const authority = profile && isRecord(profile.authority) ? profile.authority : null;
  if (authority?.mode !== 'worker_canonical') {
    throw new Error('Worker bootstrap config is not worker-canonical.');
  }

  const forbiddenPath = findSecretLikeSessionWorkerBootstrapPath(payload, 'response');
  if (forbiddenPath) throw new Error(`Worker bootstrap config contains a secret-like field at ${forbiddenPath}.`);
  const sessionId = validateConfigSessionId(payload.config);
  const configRevision = validateConfigRevision(payload.config.configRevision);
  validateRepresentedWorkerOrigins(payload.config, canonicalWorkerOrigin, environment);

  return {
    config: payload.config,
    configRevision,
    sessionId,
    sessionSlug: canonicalExpectedSlug,
    workerOrigin: canonicalWorkerOrigin,
  };
};

export const buildSessionWorkerBootstrapUrl = (
  workerOrigin: string,
  sessionSlug: string,
  options: WorkerOriginOptions = {},
): string => {
  const canonicalWorkerOrigin = parseSessionWorkerDiscoveryOrigin(workerOrigin, options);
  const canonicalSlug = validateExactSlug(sessionSlug, 'Expected slug');
  const url = new URL('/session-config', canonicalWorkerOrigin);
  url.searchParams.set('slug', canonicalSlug);
  return url.toString();
};

export const fetchWorkerCanonicalSessionBootstrap = async ({
  fetchImpl = globalThis.fetch,
  sessionSlug,
  signal,
  workerQueryValue,
  environment = runtimeEnvironment(),
}: FetchBootstrapOptions): Promise<WorkerCanonicalSessionBootstrap> => {
  if (typeof fetchImpl !== 'function') throw new Error('Worker bootstrap fetch is unavailable.');
  const workerOrigin = parseSessionWorkerDiscoveryOrigin(workerQueryValue, { environment });
  const canonicalSlug = validateExactSlug(sessionSlug, 'Expected slug');
  const bootstrapUrl = buildSessionWorkerBootstrapUrl(workerOrigin, canonicalSlug, { environment });
  const response = await fetchImpl(bootstrapUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Session-Slug': canonicalSlug,
    },
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    mode: 'cors',
    referrerPolicy: 'no-referrer',
    signal,
  });
  if (!response.ok || response.redirected) {
    throw new Error(`Worker bootstrap request failed with status ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Worker bootstrap response was not valid JSON.');
  }
  return validateWorkerCanonicalSessionBootstrap(payload, {
    expectedSlug: canonicalSlug,
    workerOrigin,
    environment,
  });
};
