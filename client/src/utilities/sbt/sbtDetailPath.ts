import { normalizeSessionSlug } from '../session/sessionNaming.js';
import { sbtBasePath } from '../ui/terminology.js';
import { buildPublicRoute } from '../ui/publicUrl.js';

export const buildSbtDetailPath = (sbtAddress: unknown, sessionSlugRaw = ''): string => {
  const address = String(sbtAddress || '').trim();
  if (!address) return '#';

  const detailPath = buildPublicRoute(`${sbtBasePath()}/${address}`);
  const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
  if (!sessionSlug) return detailPath;

  const params = new URLSearchParams();
  params.set('session', sessionSlug);
  return `${detailPath}?${params.toString()}`;
};

export default buildSbtDetailPath;
