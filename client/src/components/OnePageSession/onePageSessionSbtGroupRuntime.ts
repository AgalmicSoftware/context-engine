import { hasCachedCreateSbtForm as hasCachedCreateSbtFormCache } from '../../utilities/sbt/sbtCreateFormCache.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { resolveEffectiveSlug } from '../SurveyTool/surveyToolUtils';
import { buildCurrentSessionConfigRequest, type OnePageSessionPropsLike } from './onePageSessionTelegramController';

type OnePageSessionSbtRuntimeHost = {
  getResolvedSessionConfig: (request: unknown) => unknown;
  resolveCurrentSessionConfig: () => unknown;
};

export const hasCachedCreateSbtForm = (slug: unknown = '') =>
  hasCachedCreateSbtFormCache({
    sessionSlug: slug,
    migrateLegacyToSessionKey: true,
    clearInvalid: true,
  } as never);

export const sessionSupportsOnChainSbt = (sessionConfig: unknown): boolean => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  return projection.source === 'legacy_registry' || projection.isRegistryCanonical || projection.usesOnChainSbt;
};

export const hasCachedOnChainSbtGroup = (sessionConfig: unknown, slug: unknown): boolean =>
  sessionSupportsOnChainSbt(sessionConfig) && hasCachedCreateSbtForm(slug);

export const shouldKickoffSbtUniverseScan = (
  host: OnePageSessionSbtRuntimeHost,
  propsIn: unknown,
  currentProps: unknown,
): boolean => {
  const props = (propsIn && typeof propsIn === 'object' ? propsIn : {}) as OnePageSessionPropsLike;
  const sessionConfig =
    propsIn === currentProps
      ? host.resolveCurrentSessionConfig()
      : host.getResolvedSessionConfig(buildCurrentSessionConfigRequest(props, resolveEffectiveSlug));
  return sessionSupportsOnChainSbt(sessionConfig);
};

export const closeStaleSbtGroupEditor = (
  routeUiPatch: Record<string, unknown>,
  slugChanged: boolean,
  showEmbeddedCreateGroup: boolean,
  sessionConfig: unknown,
): void => {
  if (slugChanged && showEmbeddedCreateGroup && !sessionSupportsOnChainSbt(sessionConfig)) {
    routeUiPatch.showEmbeddedCreateGroup = false;
  }
};
