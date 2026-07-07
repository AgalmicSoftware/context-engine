import { getSessionSlugByName, normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';

type SessionSlugPropsLike = Record<string, unknown> & {
  sessionSlug?: unknown;
  slug?: unknown;
};
type ResolveSbtPageEffectiveSessionSlugArgs = {
  props?: SessionSlugPropsLike | null;
  resolvedSessionSlug?: unknown;
  sbtInfo?: unknown;
};
type SbtPageSessionConfigReader = (slug: string) => unknown;
type SbtPageDemoSessionConfigReader = (slug: string, options?: { allowDemoFallback?: boolean }) => unknown;
type ResolveSbtPageSessionDisplayConfigArgs = {
  getDemoSessionConfigBySlug?: SbtPageDemoSessionConfigReader | null;
  getSessionConfigBySlugOrDefault?: SbtPageSessionConfigReader | null;
  sessionSlugRaw?: unknown;
};
type ResolveSbtPageSessionDisplayLabelArgs = {
  sessionConfig?: unknown;
  sessionSlugRaw?: unknown;
};
export type SbtPageSessionDisplayConfig = Record<string, unknown> & {
  blockLimits?: Record<string, unknown>;
  sessionName?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const resolveSbtPageSessionSlugFromInfo = (info: unknown): string | null => {
  const record = isRecord(info) ? info : {};
  if (Object.prototype.hasOwnProperty.call(record, 'sessionSlug')) {
    const hasExplicitFlag = Object.prototype.hasOwnProperty.call(record, 'sessionSlugExplicit');
    const isExplicitSessionSlug = record.sessionSlugExplicit === true;
    if (isExplicitSessionSlug || !hasExplicitFlag) {
      return normalizeSessionSlug(record.sessionSlug || '');
    }
  }
  const name = String(record.sessionName || '').trim();
  if (!name) return null;
  return getSessionSlugByName(name);
};

export const hasExplicitSbtPageSessionSlugProp = (props: SessionSlugPropsLike = {}): boolean =>
  !!props &&
  (Object.prototype.hasOwnProperty.call(props, 'sessionSlug') || Object.prototype.hasOwnProperty.call(props, 'slug'));

export const getExplicitSbtPageSessionSlug = (props: SessionSlugPropsLike = {}): string | null => {
  if (!hasExplicitSbtPageSessionSlugProp(props)) return null;
  const raw = Object.prototype.hasOwnProperty.call(props || {}, 'sessionSlug') ? props.sessionSlug : props.slug;
  return normalizeSessionSlug(raw || '');
};

export const resolveSbtPageEffectiveSessionSlug = ({
  props = {},
  resolvedSessionSlug = null,
  sbtInfo = null,
}: ResolveSbtPageEffectiveSessionSlugArgs = {}): string => {
  const propsIn = props || {};
  const explicitSlug = getExplicitSbtPageSessionSlug(propsIn);
  if (explicitSlug != null) return explicitSlug;
  if (resolvedSessionSlug != null) return String(resolvedSessionSlug || '');
  const fromInfo = resolveSbtPageSessionSlugFromInfo(sbtInfo);
  if (fromInfo != null) return fromInfo;
  return String(propsIn.sessionSlug || propsIn.slug || '');
};

export const resolveSbtPageSessionDisplayConfig = ({
  getDemoSessionConfigBySlug: readDemoSessionConfig = null,
  getSessionConfigBySlugOrDefault: readSessionConfig = null,
  sessionSlugRaw = '',
}: ResolveSbtPageSessionDisplayConfigArgs = {}): SbtPageSessionDisplayConfig | null => {
  const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
  try {
    const config =
      (readSessionConfig ? readSessionConfig(sessionSlug || '') : null) ||
      (readDemoSessionConfig ? readDemoSessionConfig(sessionSlug || '', { allowDemoFallback: true }) : null) ||
      null;
    return isRecord(config) ? (config as SbtPageSessionDisplayConfig) : null;
  } catch (_) {
    return null;
  }
};

export const resolveSbtPageSessionDisplayLabel = ({
  sessionConfig = null,
  sessionSlugRaw = '',
}: ResolveSbtPageSessionDisplayLabelArgs = {}): string => {
  const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
  const sessionName = String(isRecord(sessionConfig) ? sessionConfig.sessionName || '' : '').trim();
  if (!sessionSlug) return sessionName || 'General';
  return sessionName || sessionSlug;
};
