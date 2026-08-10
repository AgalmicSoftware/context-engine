import { normalizeSessionSlug } from '../session/sessionNaming.js';

type SbtCacheRecord = {
  [field: string]: unknown;
  sbtInfo?: SbtCacheRecord | null;
};

const readSbtSessionBindingSource = (source: unknown = null) => {
  if (!source || typeof source !== 'object') return null;
  const record = source as SbtCacheRecord;
  if (!Object.prototype.hasOwnProperty.call(record, 'sessionSlug')) return null;
  const hasExplicitFlag = Object.prototype.hasOwnProperty.call(record, 'sessionSlugExplicit');
  const explicit = hasExplicitFlag ? record.sessionSlugExplicit === true : true;
  return {
    slug: normalizeSessionSlug(record.sessionSlug || ''),
    explicit,
    hasExplicitFlag,
  };
};

export const withSessionScopedSbtCacheBinding = (entry: unknown = {}, slugIn: unknown = '') => {
  const normalizedSlug = normalizeSessionSlug(slugIn || '');
  const record = entry && typeof entry === 'object' ? (entry as SbtCacheRecord) : {};
  const info = record.sbtInfo && typeof record.sbtInfo === 'object' ? record.sbtInfo : null;
  const infoBinding = readSbtSessionBindingSource(info);
  const recordBinding = readSbtSessionBindingSource(record);
  let bindingSlug = normalizedSlug;
  let bindingExplicit = false;
  let includeExplicitFlag = true;

  if (infoBinding?.explicit) {
    bindingSlug = infoBinding.slug;
    bindingExplicit = true;
    includeExplicitFlag = infoBinding.hasExplicitFlag;
  } else if (infoBinding?.hasExplicitFlag) {
    // Fresh metadata that explicitly says the binding is inferred must win over
    // stale cache records that previously promoted bucket membership to explicit.
    bindingSlug = normalizedSlug;
    bindingExplicit = false;
    includeExplicitFlag = true;
  } else if (recordBinding?.explicit) {
    bindingSlug = recordBinding.slug;
    bindingExplicit = true;
    includeExplicitFlag = recordBinding.hasExplicitFlag;
  }

  const sessionBindingPatch = bindingExplicit
    ? {
        sessionSlug: bindingSlug,
        ...(includeExplicitFlag ? { sessionSlugExplicit: true } : {}),
      }
    : {
        sessionSlug: bindingSlug,
        sessionSlugExplicit: false,
      };

  return {
    ...record,
    slug: normalizedSlug,
    ...sessionBindingPatch,
    sbtInfo: info
      ? {
          ...info,
          ...sessionBindingPatch,
        }
      : record.sbtInfo,
  };
};
