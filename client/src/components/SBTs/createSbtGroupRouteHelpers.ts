import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';

type CreateSbtAutoJoinUrlBuilder = (sbtAddress: unknown) => unknown;

type ResolveCreateSbtMetadataSessionSlugArgs = {
  deferredDeployMode?: unknown;
  effectiveSessionSlug?: unknown;
  sbtLabel?: unknown;
  sessionConfigSlug?: unknown;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildSessionRoutePath = (slugRaw?: string, basePath?: string): string => {
  const slug = normalizeSessionSlug(slugRaw || '');
  const normalizedBasePath = String(basePath || '').replace(/\/+$/, '');
  return normalizedBasePath + (slug ? `/session/${encodeURIComponent(slug)}` : '/session');
};

export const buildCreateSbtAutoJoinUrl = ({
  basePath = '',
  origin = '',
  sbtAddress = '',
  sessionSlug = '',
}: {
  basePath?: unknown;
  origin?: unknown;
  sbtAddress?: unknown;
  sessionSlug?: unknown;
} = {}): string => {
  const normalizedOrigin = String(origin || '').replace(/\/+$/, '');
  const normalizedAddress = String(sbtAddress || '').trim();
  if (!normalizedOrigin || !normalizedAddress) return '';
  const sessionPath = buildSessionRoutePath(String(sessionSlug || ''), String(basePath || ''));
  return `${normalizedOrigin}${sessionPath}?sbt=${encodeURIComponent(normalizedAddress)}&auto=1`;
};

export const resolveCreateSbtOpenMintAutoJoinUrl = ({
  autoJoinUrl = '',
  buildSessionAutoJoinUrl = null,
  distributionOption = '',
  sbtAddress = '',
}: {
  autoJoinUrl?: unknown;
  buildSessionAutoJoinUrl?: CreateSbtAutoJoinUrlBuilder | null;
  distributionOption?: unknown;
  sbtAddress?: unknown;
} = {}): string => {
  if (distributionOption !== 'anyoneCanMint') return '';
  const cached = String(autoJoinUrl || '');
  if (cached) return cached;
  return typeof buildSessionAutoJoinUrl === 'function' ? String(buildSessionAutoJoinUrl(sbtAddress) || '') : '';
};

export const resolveCreateSbtEffectiveSessionSlug = ({
  pathname = '',
  props = {},
}: {
  pathname?: unknown;
  props?: unknown;
} = {}): string => {
  const propsRecord = isPlainObject(props) ? props : {};
  const slugFromProps = propsRecord.sessionSlug || propsRecord.slug || '';
  if (slugFromProps) return String(slugFromProps);
  const path = String(pathname || '');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'demo' && parts[1]) return parts[1];
  if (parts[0] === 'sbts' && parts[1] && parts[1] !== 'new') return parts[1];
  return '';
};

export const resolveCreateSbtMetadataSessionSlug = ({
  deferredDeployMode = false,
  effectiveSessionSlug = '',
  sbtLabel = 'SBT',
  sessionConfigSlug = '',
}: ResolveCreateSbtMetadataSessionSlugArgs = {}): string => {
  const metadataSessionSlug = normalizeSessionSlug(effectiveSessionSlug || sessionConfigSlug || '');
  if (deferredDeployMode && !metadataSessionSlug) {
    throw new Error(`Set the session URL before adding this ${String(sbtLabel || 'SBT')} to the session.`);
  }
  return metadataSessionSlug;
};
