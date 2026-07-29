import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { resolveEffectiveSlug } from '../SurveyTool/surveyToolUtils';

export const resolveOnePageSessionRouteUiState = (props: any = {}) => {
  const autoOpenResults = props.routeAutoOpenResults === true;
  return {
    showQuestions: autoOpenResults || props.routeQuestionsOpen === true,
    autoOpenResults,
  };
};

export const resolveOnePageSessionAggregatorCacheScope = (props: any = {}): string => {
  const sessionConfig =
    props.sessionConfig && typeof props.sessionConfig === 'object' && !Array.isArray(props.sessionConfig)
      ? props.sessionConfig
      : null;
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  if (capabilities.source === 'invalid_profile') return '';
  if (capabilities.profileValid && capabilities.isWorkerCanonical) {
    return 'worker';
  }
  if (capabilities.showNetworkControls && capabilities.chainId) {
    return String(capabilities.chainId);
  }
  if (capabilities.source === 'missing' && (sessionConfig !== null || !!resolveEffectiveSlug(props))) {
    return '';
  }
  return String(props.network?.id ?? props.network?.chainId ?? props.networkChainId ?? '');
};

const buildOnePageSessionPublicRoute = (pathname: unknown = '') => {
  const normalizedPath = String(pathname || '').trim();
  const basePath = readPublicUrlBasePath();
  if (!normalizedPath) return basePath || '/';
  return `${basePath}${normalizedPath}` || normalizedPath;
};

export const buildOnePageSessionCanonicalBaseUrl = (props: any = {}) => {
  try {
    const slug = resolveEffectiveSlug(props);
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = buildOnePageSessionPublicRoute(`/session${slug ? `/${slug}` : ''}`);
    nextUrl.searchParams.delete('sessionSlug');
    nextUrl.searchParams.delete('s');
    if (slug) nextUrl.searchParams.set('session', slug);
    else nextUrl.searchParams.delete('session');
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch (_) {
    const slug = resolveEffectiveSlug(props);
    return `${buildOnePageSessionPublicRoute(`/session${slug ? `/${slug}` : ''}`)}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`;
  }
};

export const buildOnePageSessionRawResultsRoute = (props: any = {}) => {
  const slug = resolveEffectiveSlug(props);
  return buildOnePageSessionPublicRoute(slug ? `/session/${slug}/questions/results` : '/questions/results');
};
