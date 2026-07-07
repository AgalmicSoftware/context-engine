type UnknownRecord = Record<string, unknown>;
type DemoConfigLookupOptions = { allowDemoFallback: true };

type SessionDisplayBaseOptions = {
  overrides: UnknownRecord;
  normalizeSessionSlug: (value: unknown) => string;
  getDemoSessionConfigBySlug: (slug: string, opts: DemoConfigLookupOptions) => unknown;
};

type SessionTextDisplayOptions = SessionDisplayBaseOptions & {
  hasEncryptedSessionField: (cfg: unknown, field: string) => boolean;
};

type SessionHeaderDisplayOptions = SessionDisplayBaseOptions & {
  normalizeArweaveUrl: (url: string, opts?: typeof HEADER_NORMALIZE_OPTS) => string;
};

const HEADER_NORMALIZE_OPTS = { contextLabel: 'session_header_image' };

const isUnknownRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object';

const getResolvedSessionSlug = (
  sessionConfig: unknown,
  slug: string,
  normalizeSessionSlug: (value: unknown) => string,
): string => normalizeSessionSlug(isUnknownRecord(sessionConfig) ? sessionConfig.slug || slug || '' : slug || '');

const getOverrideForSlug = (overrides: UnknownRecord, slug: string): unknown => (overrides || {})[String(slug || '')];

const getDemoConfig = (
  slug: string,
  getDemoSessionConfigBySlug: (slug: string, opts: DemoConfigLookupOptions) => unknown,
): UnknownRecord => {
  const cfg = getDemoSessionConfigBySlug(slug, { allowDemoFallback: true });
  return isUnknownRecord(cfg) ? cfg : {};
};

const hasAuthoritativeSessionIdentity = (sessionConfig: unknown): boolean => {
  const cfg = isUnknownRecord(sessionConfig) ? sessionConfig : {};
  const registry = isUnknownRecord(cfg.__registry) ? cfg.__registry : {};
  return !!(
    cfg.sessionId ||
    cfg.sessionIdHex ||
    cfg.metadataURI ||
    registry.sessionId ||
    registry.sessionIdHex ||
    registry.metadataURI
  );
};

export const hasEncryptedSessionField = (sessionConfig: unknown, field: string): boolean => {
  const cfg = isUnknownRecord(sessionConfig) ? sessionConfig : {};
  const encryptedFields =
    cfg.encryptedFields && typeof cfg.encryptedFields === 'object' ? (cfg.encryptedFields as UnknownRecord) : null;

  if (field === 'sessionName') {
    return !!(encryptedFields?.sessionName || cfg.sessionNameEncrypted || cfg.encryptedSessionName);
  }

  if (field === 'sessionInfo') {
    return !!(encryptedFields?.sessionInfo || cfg.sessionInfoEncrypted || cfg.encryptedSessionInfo);
  }

  return false;
};

export const getSessionInfoForGroup = (
  sessionConfig: unknown,
  slug: string,
  opts: SessionTextDisplayOptions,
): string => {
  const cfg = isUnknownRecord(sessionConfig) ? sessionConfig : {};
  const resolvedSlug = getResolvedSessionSlug(sessionConfig, slug, opts.normalizeSessionSlug);
  const override = getOverrideForSlug(opts.overrides, resolvedSlug);
  if (override !== undefined && override !== null) return override as string;
  if (opts.hasEncryptedSessionField(sessionConfig, 'sessionInfo')) return 'Encrypted';

  const fallbackCfg = hasAuthoritativeSessionIdentity(sessionConfig)
    ? {}
    : getDemoConfig(resolvedSlug, opts.getDemoSessionConfigBySlug);
  return (cfg.sessionInfo ||
    cfg.info ||
    cfg.description ||
    fallbackCfg?.sessionInfo ||
    fallbackCfg?.info ||
    fallbackCfg?.description ||
    '') as string;
};

export const getSessionNameForGroup = (
  sessionConfig: unknown,
  slug: string,
  opts: SessionTextDisplayOptions,
): string => {
  const cfg = isUnknownRecord(sessionConfig) ? sessionConfig : {};
  const resolvedSlug = getResolvedSessionSlug(sessionConfig, slug, opts.normalizeSessionSlug);
  const override = getOverrideForSlug(opts.overrides, resolvedSlug);
  if (override !== undefined && override !== null) return override as string;
  if (opts.hasEncryptedSessionField(sessionConfig, 'sessionName')) return 'Encrypted';

  const fallbackCfg = hasAuthoritativeSessionIdentity(sessionConfig)
    ? {}
    : getDemoConfig(resolvedSlug, opts.getDemoSessionConfigBySlug);
  return (cfg.sessionName ||
    cfg.name ||
    cfg.title ||
    fallbackCfg?.sessionName ||
    fallbackCfg?.name ||
    fallbackCfg?.title ||
    '') as string;
};

export const getSessionHeaderForGroup = (
  sessionConfig: unknown,
  slug: string,
  opts: SessionHeaderDisplayOptions,
): string => {
  const cfg = isUnknownRecord(sessionConfig) ? sessionConfig : {};
  const resolvedSlug = getResolvedSessionSlug(sessionConfig, slug, opts.normalizeSessionSlug);
  const override = getOverrideForSlug(opts.overrides, resolvedSlug);
  if (override !== undefined && override !== null) {
    return opts.normalizeArweaveUrl(override as string, HEADER_NORMALIZE_OPTS);
  }

  const headerValue = cfg.sessionHeaderImg || cfg.sessionHeader || cfg.headerImage || cfg.header || '';

  if (headerValue) {
    return opts.normalizeArweaveUrl(headerValue as string, HEADER_NORMALIZE_OPTS);
  }

  const fallbackCfg = hasAuthoritativeSessionIdentity(sessionConfig)
    ? {}
    : getDemoConfig(resolvedSlug, opts.getDemoSessionConfigBySlug);
  return opts.normalizeArweaveUrl(
    (fallbackCfg?.sessionHeaderImg ||
      fallbackCfg?.sessionHeader ||
      fallbackCfg?.headerImage ||
      fallbackCfg?.header ||
      '') as string,
    HEADER_NORMALIZE_OPTS,
  );
};
