import { normalizeSessionSlug } from '../session/sessionNaming.js';
import { sbtBasePath } from '../ui/terminology.js';

export const buildSbtDetailPath = (sbtAddress, sessionSlugRaw = '') => {
  const address = String(sbtAddress || '').trim();
  if (!address) return '#';

  const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
  if (!sessionSlug) return `${sbtBasePath()}/${address}`;

  const params = new URLSearchParams();
  params.set('session', sessionSlug);
  return `${sbtBasePath()}/${address}?${params.toString()}`;
};

export default buildSbtDetailPath;
