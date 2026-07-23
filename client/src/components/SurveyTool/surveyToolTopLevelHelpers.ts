import {
  appendExplicitSessionHintToPath,
  applyExistingGroupPrefix,
  isSurveyToolFilterStateActive,
  normalizeSessionSlugValue,
  normalizeSurveyToolFilterState,
  resolveEffectiveSlug,
  serializeSurveyToolFilterState,
} from './surveyToolUtils';
import { deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';

type SurveyToolPropsLike = {
  filterState?: unknown;
  minifiedMode?: unknown;
  miniMode?: unknown;
  network?: Record<string, unknown> | null;
  preventUrlChange?: unknown;
  autoOpenResults?: unknown;
  isSurveyCacheReady?: unknown;
  isQuestionCacheReady?: unknown;
  isResponsesCacheReady?: unknown;
  questionResponsesNonce?: unknown;
  sessionSlug?: unknown;
  surveyId?: unknown;
  surveyID?: unknown;
  [key: string]: unknown;
};
type SurveyToolCachedSurveyEntry = Record<string, unknown> & {
  id?: unknown;
  questionIDs?: unknown;
  surveyID?: unknown;
  title?: unknown;
};
type SurveyToolInitialCacheState = {
  surveyIDs: unknown[];
  questionIDs: unknown[];
  questionResponses: Record<string, unknown>;
  arweaveContent: Record<string, unknown>;
};
type SurveyCacheLookupResult = {
  data: unknown;
  foundSlug: string;
};
type SurveyToolResultsModalStatePatch = {
  showResultsModal: boolean;
};
type SurveyToolQuestionsCacheNoncePatch = {
  questionsCacheNonce: number;
};
type SurveyToolLoadingStatePatch = {
  loading: boolean;
};
type SurveyToolPubKeyStatePatch = {
  pubKey: string;
};
type SurveyToolSurveyListStatePatch = {
  surveys: unknown[];
  loading: boolean;
};
type SurveyToolHydratedFilterState = {
  filterState: unknown;
  cleanUrl: string | null;
  error: unknown | null;
};

export const getInitialCacheState = (): SurveyToolInitialCacheState => ({
  surveyIDs: [],
  questionIDs: [],
  questionResponses: {},
  arweaveContent: {},
});

export const getSurveyToolSessionPropFromProps = (props: SurveyToolPropsLike = {}): string | undefined => {
  if (typeof props.sessionSlug === 'string') return normalizeSessionSlugValue(props.sessionSlug);
  return undefined;
};

export const getResolvedSurveyToolPropsFromProps = <TProps extends SurveyToolPropsLike>(props: TProps): TProps => {
  const sessionSlug = getSurveyToolSessionPropFromProps(props);
  if (typeof sessionSlug === 'undefined') return props;
  return {
    ...props,
    sessionSlug,
  };
};

export const getNormalizedSurveyIdFromPropsValue = (props: SurveyToolPropsLike = {}): string | null => {
  const { surveyId, surveyID } = props;
  const rawId = surveyId || surveyID;
  return rawId ? String(rawId).trim().toLowerCase() : null;
};

export const resolveSurveyToolRenderMode = ({
  minifiedMode = '',
  singleQuestionMode = false,
}: ResolveSurveyToolRenderModeArgs = {}): SurveyToolRenderModeState => {
  const shouldRenderPileMode = minifiedMode === 'pile';
  const shouldRenderSingleQuestionMode = !shouldRenderPileMode && !!singleQuestionMode;
  return {
    shouldRenderPileMode,
    shouldRenderSingleQuestionMode,
    shouldRenderSurveySelectorMode: !shouldRenderPileMode && !shouldRenderSingleQuestionMode,
  };
};

export const resolveSurveyToolSelectorRenderState = ({
  props = {},
  hydratedFilterState = null,
}: ResolveSurveyToolSelectorRenderStateArgs = {}): SurveyToolSelectorRenderState => {
  const { surveyId, surveyID } = props;
  const shouldWarnMismatchedSurveyIds = !!(
    surveyId &&
    surveyID &&
    String(surveyId).trim().toLowerCase() !== String(surveyID).trim().toLowerCase()
  );
  const rawId = surveyId || surveyID;
  const normalizedSurveyId = rawId ? String(rawId).trim().toLowerCase() : null;

  let effectiveFilterState = normalizeSurveyToolFilterState(props.filterState);
  if (!serializeSurveyToolFilterState(effectiveFilterState)) {
    effectiveFilterState = normalizeSurveyToolFilterState(hydratedFilterState || {});
  }

  return {
    normalizedSurveyId,
    effectiveFilterState,
    shouldWarnMismatchedSurveyIds,
    mismatchedSurveyIdWarning: shouldWarnMismatchedSurveyIds
      ? `[SurveyTool] Both surveyId and surveyID props were provided with different values. Preferring surveyId: "${surveyId}" over surveyID: "${surveyID}"`
      : '',
  };
};

export const shouldRouteSurveyToolMountToQuestions = ({
  pathname = '',
  props = {},
}: ShouldRouteSurveyToolMountToQuestionsArgs = {}): boolean =>
  typeof pathname === 'string' &&
  !pathname.includes('/survey/') &&
  !pathname.includes('/question/') &&
  !pathname.includes('/questions') &&
  !pathname.includes('/surveys') &&
  props.minifiedMode !== 'pile' &&
  !props.preventUrlChange &&
  !props.miniMode;

export const shouldFetchSurveyToolSurveyIndex = (props: SurveyToolPropsLike = {}): boolean => {
  const renderMode = resolveSurveyToolRenderMode({
    minifiedMode: props.minifiedMode,
    singleQuestionMode: props.singleQuestionMode,
  });
  if (!renderMode.shouldRenderSurveySelectorMode) return false;

  const projection = resolveSessionCapabilityProjection(props.sessionConfig);
  if (projection.source === 'invalid_profile' || projection.source === 'missing') return false;
  return !projection.isWorkerCanonical;
};

export const shouldFetchSurveyToolSurveysOnPropsChange = ({
  prevProps = {},
  props = {},
}: SurveyToolPropsChangeArgs = {}): boolean => {
  if (!shouldFetchSurveyToolSurveyIndex(props)) return false;
  if (!shouldFetchSurveyToolSurveyIndex(prevProps)) return true;
  return (
    getNetworkIdFromPropsLike(prevProps) !== getNetworkIdFromPropsLike(props) ||
    (prevProps.isSurveyCacheReady !== props.isSurveyCacheReady && !!props.isSurveyCacheReady)
  );
};

export const shouldOpenSurveyToolResultsOnPropsChange = ({
  prevProps = {},
  props = {},
  showResultsModal = false,
}: ShouldOpenSurveyToolResultsOnPropsChangeArgs = {}): boolean =>
  !!props.autoOpenResults && !prevProps.autoOpenResults && !showResultsModal;

export const shouldBumpSurveyToolQuestionsCacheNonce = ({
  prevProps = {},
  props = {},
}: SurveyToolPropsChangeArgs = {}): boolean => {
  const questionCacheReadyChanged = prevProps.isQuestionCacheReady !== props.isQuestionCacheReady;
  const responsesCacheReadyChanged = prevProps.isResponsesCacheReady !== props.isResponsesCacheReady;
  const questionResponsesNonceChanged = prevProps.questionResponsesNonce !== props.questionResponsesNonce;
  const networkChanged = getNetworkIdFromPropsLike(prevProps) !== getNetworkIdFromPropsLike(props);

  return (
    (questionCacheReadyChanged && !!props.isQuestionCacheReady) ||
    (responsesCacheReadyChanged && !!props.isResponsesCacheReady) ||
    questionResponsesNonceChanged ||
    networkChanged
  );
};

export const resolveSurveyToolResultsModalCloseState = ({
  pathname = '',
  search = '',
  hash = '',
  hasExternalCloseHandler = false,
}: ResolveSurveyToolResultsModalCloseStateArgs = {}): SurveyToolResultsModalCloseState => {
  // Query and fragment carry worker/session discovery identity; trimming only
  // the results pathname must never discard that routing context.
  const currentPathname = typeof pathname === 'string' ? pathname : '';
  const currentSearch = typeof search === 'string' ? search : '';
  const currentHash = typeof hash === 'string' ? hash : '';
  const shouldCallExternalCloseHandler = !!hasExternalCloseHandler;
  const shouldTrimResultsPath = currentPathname.endsWith('/results') && !shouldCallExternalCloseHandler;
  const sessionQuestionsResultsMatch = shouldTrimResultsPath
    ? currentPathname.match(/^(.*\/session\/[^/]+)\/questions\/results$/)
    : null;

  return {
    shouldTrimResultsPath,
    nextPathname: shouldTrimResultsPath
      ? sessionQuestionsResultsMatch
        ? sessionQuestionsResultsMatch[1]
        : currentPathname.slice(0, currentPathname.length - '/results'.length)
      : currentPathname,
    shouldCallExternalCloseHandler,
  };
};

type SurveyCacheEntryLike = {
  slug?: unknown;
  value?: unknown;
};
type SurveyCacheEntryReader = (namespace: string, options?: { cloneValues?: boolean }) => SurveyCacheEntryLike[];
type SurveyToolQuestionsCacheNonceStateLike = {
  questionsCacheNonce?: unknown;
};
type SurveyToolResultsModalStatePatchArgs = {
  open?: unknown;
};
type SurveyToolLoadingStatePatchArgs = {
  loading?: unknown;
};
type SurveyToolPubKeyStatePatchArgs = {
  pubKey?: unknown;
};
type SurveyToolSurveyListStatePatchArgs = SurveyToolLoadingStatePatchArgs & {
  surveys?: unknown;
};
type BuildSurveyToolHydratedFilterStateArgs = {
  props?: SurveyToolPropsLike;
  href?: unknown;
};
type ResolveSurveyToolRenderModeArgs = {
  minifiedMode?: unknown;
  singleQuestionMode?: unknown;
};
type SurveyToolRenderModeState = {
  shouldRenderPileMode: boolean;
  shouldRenderSingleQuestionMode: boolean;
  shouldRenderSurveySelectorMode: boolean;
};
type ResolveSurveyToolSelectorRenderStateArgs = {
  props?: SurveyToolPropsLike;
  hydratedFilterState?: unknown;
};
type SurveyToolSelectorRenderState = {
  normalizedSurveyId: string | null;
  effectiveFilterState: unknown;
  shouldWarnMismatchedSurveyIds: boolean;
  mismatchedSurveyIdWarning: string;
};
type ShouldRouteSurveyToolMountToQuestionsArgs = {
  pathname?: unknown;
  props?: SurveyToolPropsLike;
};
type SurveyToolPropsChangeArgs = {
  prevProps?: SurveyToolPropsLike;
  props?: SurveyToolPropsLike;
};
type ShouldOpenSurveyToolResultsOnPropsChangeArgs = SurveyToolPropsChangeArgs & {
  showResultsModal?: unknown;
};
type ResolveSurveyToolResultsModalCloseStateArgs = {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
  hasExternalCloseHandler?: unknown;
};
type SurveyToolResultsModalCloseState = {
  shouldTrimResultsPath: boolean;
  nextPathname: string;
  nextUrl: string;
  shouldCallExternalCloseHandler: boolean;
};
type SurveyCacheNetworkBucket = {
  surveys?: Record<string, unknown>;
};
type SurveyCacheByNetwork = Record<string, SurveyCacheNetworkBucket | undefined>;

const getNetworkIdFromPropsLike = (props: SurveyToolPropsLike = {}): unknown | undefined => {
  const network = props.network;
  if (!network || typeof network !== 'object') return undefined;
  return network.id;
};

export const findSurveyInSurveyCacheEntries = (
  surveyID: unknown,
  entries: SurveyCacheEntryLike[] = [],
): SurveyCacheLookupResult | null => {
  if (!surveyID) return null;
  const sid = String(surveyID).toLowerCase();

  for (const entry of entries) {
    const slug = String(entry?.slug || '');
    const cache = entry?.value && typeof entry.value === 'object' ? (entry.value as SurveyCacheByNetwork) : {};
    for (const netKey in cache) {
      const foundData = cache[netKey]?.surveys?.[sid];
      if (foundData) {
        return { data: foundData, foundSlug: slug };
      }
    }
  }
  return null;
};

export const findSurveyInAllSurveyCaches = (
  surveyID: unknown,
  listNamespaceEntries: SurveyCacheEntryReader,
): SurveyCacheLookupResult | null => {
  const entries = listNamespaceEntries('surveysCache', { cloneValues: false });
  return findSurveyInSurveyCacheEntries(surveyID, Array.isArray(entries) ? entries : []);
};

export const buildSurveyToolResultsModalStatePatch = ({
  open = false,
}: SurveyToolResultsModalStatePatchArgs = {}): SurveyToolResultsModalStatePatch => ({
  showResultsModal: open === true,
});

export const buildSurveyToolQuestionsCacheNoncePatch = (
  prevState: SurveyToolQuestionsCacheNonceStateLike = {},
): SurveyToolQuestionsCacheNoncePatch => ({
  questionsCacheNonce: Number(prevState?.questionsCacheNonce || 0) + 1,
});

export const buildSurveyToolLoadingStatePatch = ({
  loading = false,
}: SurveyToolLoadingStatePatchArgs = {}): SurveyToolLoadingStatePatch => ({
  loading: loading === true,
});

export const buildSurveyToolPubKeyStatePatch = ({
  pubKey = '',
}: SurveyToolPubKeyStatePatchArgs = {}): SurveyToolPubKeyStatePatch => ({
  pubKey: String(pubKey ?? ''),
});

export const buildSurveyToolSurveyListStatePatch = ({
  surveys = [],
  loading = false,
}: SurveyToolSurveyListStatePatchArgs = {}): SurveyToolSurveyListStatePatch => ({
  surveys: Array.isArray(surveys) ? surveys : [],
  loading: loading === true,
});

// Keep URL cleanup outside this helper; callers still need the hydrated filter if history mutation fails.
export const buildSurveyToolHydratedFilterState = ({
  props = {},
  href = '',
}: BuildSurveyToolHydratedFilterStateArgs = {}): SurveyToolHydratedFilterState => {
  if (props.minifiedMode === 'pile' || isSurveyToolFilterStateActive(props.filterState)) {
    return { filterState: null, cleanUrl: null, error: null };
  }

  if (typeof href !== 'string' || !href) {
    return { filterState: null, cleanUrl: null, error: null };
  }

  try {
    const url = new URL(href);
    const filterParam = url.searchParams.get('filter');
    if (!filterParam) return { filterState: null, cleanUrl: null, error: null };

    const filterState = normalizeSurveyToolFilterState(deserializeFilterState(filterParam));
    url.searchParams.delete('filter');

    return { filterState, cleanUrl: url.toString(), error: null };
  } catch (error) {
    return { filterState: null, cleanUrl: null, error };
  }
};

export const buildSurveyToolSurveyListFromBag = (surveyBag: unknown): SurveyToolCachedSurveyEntry[] => {
  if (!surveyBag || typeof surveyBag !== 'object') return [];

  const next: SurveyToolCachedSurveyEntry[] = [];
  const seen = new Set();
  const surveyMap = surveyBag as Record<string, SurveyToolCachedSurveyEntry | null | undefined>;

  for (const sid of Object.keys(surveyMap)) {
    const sData = surveyMap[sid];
    if (!sData || !sData.title || !Array.isArray(sData.questionIDs)) continue;

    const qids = (sData.questionIDs || []).map((q: unknown) => String(q || '').toLowerCase());
    if (qids.length === 0) continue;

    if (!sData.id) sData.id = sData.surveyID || sid;
    const lowered = String(sData.id || sid).toLowerCase();
    if (!seen.has(lowered)) {
      seen.add(lowered);
      next.push(sData);
    }
  }

  return next;
};

export const buildSurveyToolFilterStateUrlPath = (props: SurveyToolPropsLike = {}, newFilterState: unknown): string => {
  const serializedState = serializeSurveyToolFilterState(newFilterState);
  const normalizedSurveyId = getNormalizedSurveyIdFromPropsValue(props);
  const slug = resolveEffectiveSlug(getResolvedSurveyToolPropsFromProps(props)) || '';
  let newPath = normalizedSurveyId ? `/survey/${normalizedSurveyId}/results` : `/questions/results`;

  if (serializedState) {
    newPath += `?filter=${serializedState}`;
  }
  newPath = appendExplicitSessionHintToPath(newPath, slug);
  return applyExistingGroupPrefix(newPath);
};
