/**
 * @module sessionMetadataFormatting
 * @description Pure session metadata normalization helpers shared by contractScripts.
 */

import { toStr } from '../shared/primitives.js';
import { normalizeSessionSlug, resolveSessionByName } from './sessionConfigResolvers.js';

export const resolveSessionNameValue = (metadata = {}) => {
  const fromCanonical = toStr(metadata?.sessionName).trim();
  if (fromCanonical) return fromCanonical;
  return '';
};

export const resolveSbtSessionSlug = (metadata = {}, fallbackSlug = '') => {
  const hasExplicitSlugField =
    metadata &&
    typeof metadata === 'object' &&
    (
      Object.prototype.hasOwnProperty.call(metadata, 'sessionSlug') ||
      Object.prototype.hasOwnProperty.call(metadata, 'slug')
    );

  if (hasExplicitSlugField) {
    const explicitRaw = toStr(
      metadata?.sessionSlug ??
      metadata?.slug
    ).trim();
    const hasExplicitFlag =
      metadata &&
      typeof metadata === 'object' &&
      Object.prototype.hasOwnProperty.call(metadata, 'sessionSlugExplicit');
    const explicit = hasExplicitFlag
      ? (metadata?.sessionSlugExplicit === true)
      : true;
    return {
      slug: normalizeSessionSlug(explicitRaw),
      explicit,
    };
  }

  const byName = resolveSessionByName(resolveSessionNameValue(metadata));
  if (byName && typeof byName.slug !== 'undefined') {
    return {
      slug: normalizeSessionSlug(byName.slug || ''),
      explicit: false,
    };
  }

  return {
    slug: normalizeSessionSlug(toStr(fallbackSlug).trim()),
    explicit: false,
  };
};

export const normalizeSbtSessionLinkFields = (metadata, fallbackSlug = '') => {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const resolved = resolveSbtSessionSlug(metadata, fallbackSlug);
  metadata.sessionSlug = resolved.slug;
  metadata.sessionSlugExplicit = resolved.explicit;
  delete metadata.slug;
  return metadata;
};

export const normalizeSessionNameFields = (metadata, fallbackSessionName = '', options = {}) => {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const fallback = toStr(fallbackSessionName).trim();
  const sessionName = resolveSessionNameValue(metadata) || fallback;
  if (sessionName) {
    metadata.sessionName = sessionName;
  } else {
    if (typeof metadata.sessionName !== 'string') metadata.sessionName = '';
  }
  return metadata;
};
