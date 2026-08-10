import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export const buildSbtListDetailHref = (sbtAddress: unknown, sessionSlug: unknown = ''): string =>
  buildSbtDetailPath(sbtAddress, isSbtListSyntheticNoSessionSlug(sessionSlug) ? '' : String(sessionSlug || ''));
