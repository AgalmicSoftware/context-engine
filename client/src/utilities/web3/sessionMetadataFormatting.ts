/**
 * @module sessionMetadataFormatting
 * @description Pure session metadata normalization helpers shared by contractScripts.
 */

import { toStr } from '../shared/primitives.js';
import { normalizeSessionSlug, resolveSessionByName } from './sessionConfigResolvers.js';

type UnknownRecord = Record<string, unknown>;
type ResolvedSbtSessionSlug = {
  slug: string;
  explicit: boolean;
};

export const resolveSessionNameValue = (metadata: unknown = {}): string => {
  const source = metadata && typeof metadata === 'object' ? (metadata as UnknownRecord) : {};
  const fromCanonical = toStr(source.sessionName).trim();
  if (fromCanonical) return fromCanonical;
  return '';
};

export const resolveSbtSessionSlug = (metadata: unknown = {}, fallbackSlug = ''): ResolvedSbtSessionSlug => {
  const source = metadata && typeof metadata === 'object' ? (metadata as UnknownRecord) : {};
  const hasExplicitSlugField =
    metadata &&
    typeof metadata === 'object' &&
    (Object.prototype.hasOwnProperty.call(source, 'sessionSlug') ||
      Object.prototype.hasOwnProperty.call(source, 'slug'));

  if (hasExplicitSlugField) {
    const explicitRaw = toStr(source.sessionSlug ?? source.slug).trim();
    const hasExplicitFlag =
      metadata && typeof metadata === 'object' && Object.prototype.hasOwnProperty.call(source, 'sessionSlugExplicit');
    const explicit = hasExplicitFlag ? source.sessionSlugExplicit === true : true;
    return {
      slug: normalizeSessionSlug(explicitRaw),
      explicit,
    };
  }

  const byName = resolveSessionByName(resolveSessionNameValue(metadata));
  if (byName && typeof (byName as UnknownRecord).slug !== 'undefined') {
    return {
      slug: normalizeSessionSlug((byName as UnknownRecord).slug || ''),
      explicit: false,
    };
  }

  return {
    slug: normalizeSessionSlug(toStr(fallbackSlug).trim()),
    explicit: false,
  };
};

export const normalizeSbtSessionLinkFields = (metadata: unknown, fallbackSlug = ''): unknown => {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const next = metadata as UnknownRecord;
  const resolved = resolveSbtSessionSlug(next, fallbackSlug);
  next.sessionSlug = resolved.slug;
  next.sessionSlugExplicit = resolved.explicit;
  delete next.slug;
  return next;
};

export const normalizeSessionNameFields = (
  metadata: unknown,
  fallbackSessionName = '',
  options: UnknownRecord = {},
): unknown => {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const next = metadata as UnknownRecord;
  const fallback = toStr(fallbackSessionName).trim();
  const sessionName = resolveSessionNameValue(next) || fallback;
  const sessionSlug = normalizeSessionSlug(toStr(options?.sessionSlug ?? next.sessionSlug ?? '').trim());
  if (sessionName) {
    next.sessionName = sessionName;
  } else {
    if (typeof next.sessionName !== 'string') next.sessionName = '';
  }
  if (sessionSlug) next.sessionSlug = sessionSlug;
  return next;
};
