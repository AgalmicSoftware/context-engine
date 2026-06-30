import { normalizeSessionSlug } from './sessionNaming.js';
import { getSessionSlugByName } from '../web3/sessionConfigResolvers.js';

export type MetadataSessionAuthority = 'explicit' | 'name' | 'fallback';

export type MetadataSessionBinding = {
  sessionSlug: string;
  authority: MetadataSessionAuthority;
};

export type MetadataSessionCacheEnvelope = {
  metadata: MetadataRecord & {
    sessionSlug: string;
    sessionSlugExplicit: boolean;
    slug?: string;
  };
  targetSlug: string;
  authority: MetadataSessionAuthority;
};

export type BuildEnvelopeOptions = {
  scoped?: boolean;
  includeSlugField?: boolean;
};

export type MetadataRecord = Record<string, unknown>;

const isMetadataRecord = (value: unknown): value is MetadataRecord => (
  value !== null && typeof value === 'object'
);

export const resolveMetadataSessionBinding = (
  metadata: unknown,
  fallbackSlug = ''
): MetadataSessionBinding => {
  const fallback = normalizeSessionSlug(fallbackSlug || '');
  if (!isMetadataRecord(metadata)) {
    return { sessionSlug: fallback, authority: 'fallback' };
  }

  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(metadata, key);
  const hasExplicitSlugField =
    hasOwn('sessionSlug') ||
    hasOwn('slug');
  const hasExplicitFlag = hasOwn('sessionSlugExplicit');
  const metadataSlugIsAuthoritative = !hasExplicitFlag || metadata?.sessionSlugExplicit === true;

  if (hasExplicitSlugField && metadataSlugIsAuthoritative) {
    const explicitCandidates = [
      metadata?.sessionSlug,
      metadata?.slug,
    ];
    for (let index = 0; index < explicitCandidates.length; index += 1) {
      const rawValue = explicitCandidates[index];
      if (rawValue == null) continue;
      const trimmed = String(rawValue).trim();
      if (!trimmed) continue;
      return {
        sessionSlug: normalizeSessionSlug(trimmed),
        authority: 'explicit',
      };
    }
  }

  const sessionName = String(metadata?.sessionName || '').trim();
  if (sessionName) {
    const byName = getSessionSlugByName(sessionName);
    if (byName !== null && byName !== undefined) {
      return {
        sessionSlug: normalizeSessionSlug(byName),
        authority: 'name',
      };
    }
  }

  return { sessionSlug: fallback, authority: 'fallback' };
};

export const resolveMetadataSessionSlug = (
  metadata: unknown,
  fallbackSlug = ''
): string => (
  resolveMetadataSessionBinding(metadata, fallbackSlug).sessionSlug
);

export const resolveScopedMetadataSessionSlug = (
  metadata: unknown,
  fallbackSlug = ''
): string => {
  const binding = resolveMetadataSessionBinding(metadata, fallbackSlug);
  if (binding.authority === 'fallback') return '';
  return normalizeSessionSlug(binding.sessionSlug || '');
};

export const buildMetadataSessionCacheEnvelope = (
  metadata: unknown,
  fallbackSlug = '',
  options: BuildEnvelopeOptions = {}
): MetadataSessionCacheEnvelope => {
  const scoped = options.scoped === true;
  const includeSlugField = options.includeSlugField === true;
  const binding = resolveMetadataSessionBinding(metadata, fallbackSlug);
  const targetSlug = scoped
    ? resolveScopedMetadataSessionSlug(metadata, fallbackSlug)
    : normalizeSessionSlug(binding.sessionSlug || '');
  const next: MetadataSessionCacheEnvelope['metadata'] = {
    ...(isMetadataRecord(metadata) ? metadata : {}),
    sessionSlug: targetSlug,
    sessionSlugExplicit: binding.authority === 'explicit',
  };
  if (includeSlugField) next.slug = targetSlug;
  return {
    metadata: next,
    targetSlug,
    authority: binding.authority,
  };
};
