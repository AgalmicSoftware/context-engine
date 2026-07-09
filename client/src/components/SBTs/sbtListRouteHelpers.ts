import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export const buildSbtListDetailHref = (sbtAddress: unknown, sessionSlug: unknown = ''): string =>
  buildSbtDetailPath(sbtAddress, isSbtListSyntheticNoSessionSlug(sessionSlug) ? '' : String(sessionSlug || ''));
