import {
  authorizeArweaveSbtAssociation,
  resolveArweaveSessionIdAssociation,
} from './arweaveAssociationAuthority.js';

export const normalizeArweaveAssociationTags = async ({
  tags,
  slug,
  config,
  uploaderAddress,
  chainAttestationCache,
  deps,
}) => {
  const normalizedTags = Array.isArray(tags) ? tags : [];

  const sessionIdCheck = await resolveArweaveSessionIdAssociation({
    tags: normalizedTags,
    slug,
    config,
    chainAttestationCache,
    deps,
  });
  if (!sessionIdCheck.ok) {
    return sessionIdCheck;
  }

  const sbtAuth = await authorizeArweaveSbtAssociation({
    config,
    tags: normalizedTags,
    uploaderAddress,
    chainAttestationCache,
    deps,
  });
  if (!sbtAuth.ok) {
    return sbtAuth;
  }

  return {
    ok: true,
    status: 200,
    error: '',
    reason: '',
    tags: normalizedTags,
  };
};
