import React, { Suspense } from 'react';
import { ethers } from 'ethers';
import stylesRaw from './AppShell.module.scss';
import MainAreaTabsRaw from '../MainContent/MainAreaTabs';
import RightSideRaw from '../RightSidebar/RightSide';
import LazyFallbackRaw from '../Shared/LazyFallback';
import RouteErrorBoundaryRaw from '../ErrorBoundary/RouteErrorBoundary';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { t } from '../../utilities/ui/terminology.js';
import { deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import {
  buildQuestionRoutePath,
  isKnownOrGeneralSessionSlug,
  shouldRetryMaskedQuestionRefresh,
} from '../../utilities/survey/questionRouting.js';
import { isRouteResponderAddress } from '../../utilities/session/mainSiteUtils.js';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import { DEFAULT_SESSION_SLUG, DEFAULT_SESSION_SLUG_ALIAS } from '../../variables/appConfig.js';
import {
  composeMainSiteAuthViewProps,
  composeMainSiteLoginViewProps,
  composeMainSiteQuestionCacheViewProps,
  composeMainSiteSessionCacheViewProps,
  composeMainSiteSurveyCacheViewProps,
  composeMainSiteWalletViewProps,
} from './mainSiteViewProps.js';
import {
  ExperimentalStub as ExperimentalStubRaw,
  NotFoundRoute as NotFoundRouteRaw,
  readHashQueryParam,
  SessionLoadingSkeleton as SessionLoadingSkeletonRaw,
} from './routeStatusViews';
import { QUESTION_RESULTS_RE, SURVEY_RESULTS_RE, VALID_SURVEY_ID_RE } from './routeConfig.js';
import { resolveMainSiteRouteMatch } from './routeTable.js';
import { renderMainSiteRouteView } from './mainSiteRouteViewMap.js';
import { buildPublicRoute, buildPublicUrl, replaceRouteResponderQueryParam } from './urlUtils.js';
import { hasAutoFlag as hasAutoFlagFn } from './autoHashPersistence';
import {
  resolveMainSiteQuestionRouteSessionContext,
  resolveMainSiteSessionRouteContext,
  resolveMainSiteSessionRouteSourceSlug,
} from './routeSessionResolution.js';
import {
  AboutPage as AboutPageRaw,
  AdminPage as AdminPageRaw,
  AgentPage as AgentPageRaw,
  DebateMap as DebateMapRaw,
  BookmarksPage as BookmarksPageRaw,
  CompareAddresses as CompareAddressesRaw,
  ContractPage as ContractPageRaw,
  DemosIndex as DemosIndexRaw,
  OnePageSession as OnePageSessionRaw,
  RiskMatrixDemo as RiskMatrixDemoRaw,
  SBTPage as SBTPageRaw,
  SBTsPage as SBTsPageRaw,
  SessionDocumentsPage as SessionDocumentsPageRaw,
  SessionWizard as SessionWizardRaw,
  SimulatedUserPage as SimulatedUserPageRaw,
  SponsorPage as SponsorPageRaw,
  SurveyPage as SurveyPageRaw,
  SurveyTool as SurveyToolRaw,
  TagPage as TagPageRaw,
  UserPage as UserPageRaw,
} from './routeLazyComponents.js';

type MainSiteRouteRendererHost = any;
type MainSiteRouteRendererMap = any;
type MainSiteRouteComponent = React.ComponentType<Record<string, unknown>>;
type RouteRenderCtx = any;
type RefreshQuestionResponsesOptions = any;
type MainSiteSurveyMetadataCache = any;
type SessionConfigLike = any;
type MainSiteRouteNetwork = Record<string, unknown> | null | undefined;

const styles = stylesRaw as Record<string, string>;
const asMainSiteRouteComponent = (component: unknown): MainSiteRouteComponent => component as MainSiteRouteComponent;
const MainAreaTabs = asMainSiteRouteComponent(MainAreaTabsRaw);
const RightSide = asMainSiteRouteComponent(RightSideRaw);
const LazyFallback = asMainSiteRouteComponent(LazyFallbackRaw);
const RouteErrorBoundary = asMainSiteRouteComponent(RouteErrorBoundaryRaw);
const ExperimentalStub = asMainSiteRouteComponent(ExperimentalStubRaw);
const NotFoundRoute = asMainSiteRouteComponent(NotFoundRouteRaw);
const SessionLoadingSkeleton = asMainSiteRouteComponent(SessionLoadingSkeletonRaw);
const AboutPage = asMainSiteRouteComponent(AboutPageRaw);
const AdminPage = asMainSiteRouteComponent(AdminPageRaw);
const AgentPage = asMainSiteRouteComponent(AgentPageRaw);
const DebateMap = asMainSiteRouteComponent(DebateMapRaw);
const BookmarksPage = asMainSiteRouteComponent(BookmarksPageRaw);
const CompareAddresses = asMainSiteRouteComponent(CompareAddressesRaw);
const ContractPage = asMainSiteRouteComponent(ContractPageRaw);
const DemosIndex = asMainSiteRouteComponent(DemosIndexRaw);
const OnePageSession = asMainSiteRouteComponent(OnePageSessionRaw);
const RiskMatrixDemo = asMainSiteRouteComponent(RiskMatrixDemoRaw);
const SBTPage = asMainSiteRouteComponent(SBTPageRaw);
const SBTsPage = asMainSiteRouteComponent(SBTsPageRaw);
const SessionDocumentsPage = asMainSiteRouteComponent(SessionDocumentsPageRaw);
const SessionWizard = asMainSiteRouteComponent(SessionWizardRaw);
const SimulatedUserPage = asMainSiteRouteComponent(SimulatedUserPageRaw);
const SponsorPage = asMainSiteRouteComponent(SponsorPageRaw);
const SurveyPage = asMainSiteRouteComponent(SurveyPageRaw);
const SurveyTool = asMainSiteRouteComponent(SurveyToolRaw);
const TagPage = asMainSiteRouteComponent(TagPageRaw);
const UserPage = asMainSiteRouteComponent(UserPageRaw);

const hasMainSiteRegistryIdentity = (sessionConfig: unknown): boolean => {
  if (!sessionConfig || typeof sessionConfig !== 'object') return false;
  const cfg = sessionConfig as Record<string, unknown>;
  const registry =
    cfg.__registry && typeof cfg.__registry === 'object' ? (cfg.__registry as Record<string, unknown>) : {};
  return !!(
    cfg.sessionId ||
    cfg.sessionIdHex ||
    cfg.metadataURI ||
    registry.sessionId ||
    registry.sessionIdHex ||
    registry.metadataURI
  );
};

export const createMainSiteRouteRenderers = (host: MainSiteRouteRendererHost): MainSiteRouteRendererMap => ({
  _renderDebateRoute: (fullPath: string) => <ExperimentalStub featureName="Debate view" path={fullPath} />,

  _renderBookmarksRoute: () => (
    <Suspense fallback={<LazyFallback label="Loading Bookmarks..." />}>
      <div data-testid={E2E_TESTIDS.PAGE_BOOKMARKS_ROOT}>
        <BookmarksPage />
      </div>
    </Suspense>
  ),

  _renderAboutRoute: () => (
    <Suspense fallback={<LazyFallback label="Loading..." />}>
      <div data-testid={E2E_TESTIDS.PAGE_ABOUT_ROOT}>
        <AboutPage />
      </div>
    </Suspense>
  ),

  _renderDemosRoute: () => (
    <Suspense fallback={<div />}>
      <DemosIndex />
    </Suspense>
  ),

  _renderMatrixRoute: () => (
    <Suspense fallback={<LazyFallback label="Loading..." />}>
      <div data-testid={E2E_TESTIDS.PAGE_MATRIX_ROOT}>
        <RiskMatrixDemo />
      </div>
    </Suspense>
  ),

  _renderAgentRoute: () => {
    if (process.env.NODE_ENV === 'production') {
      return <div>Page not found or invalid path.</div>;
    }
    return (
      <Suspense fallback={<LazyFallback label="Loading Agent..." />}>
        <div data-testid={E2E_TESTIDS.PAGE_AGENT_ROOT}>
          <AgentPage />
        </div>
      </Suspense>
    );
  },

  _renderSimUserRoute: (fullPath: string, defaultSessionNetwork: MainSiteRouteNetwork) => {
    const simUsername = fullPath.slice(4);
    return (
      <Suspense fallback={<LazyFallback label="Loading profile..." minHeight="40vh" />}>
        <SimulatedUserPage simUsername={simUsername} provider={host.props.provider} network={defaultSessionNetwork} />
      </Suspense>
    );
  },

  _renderAtlasRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug, defaultSessionNetwork, routeDemoMode } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Atlas..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_ATLAS_ROOT}>
            <DebateMap
              // Pass necessary context props
              account={host.props.account}
              provider={host.props.provider}
              network={defaultSessionNetwork}
              litHooks={host.state.litHooks}
              toggleLoginModal={host.props.toggleLoginModal}
              loginComplete={host.props.loginComplete}
              activeSessionSlug={defaultSlug}

              // Pass Cache props
              isSBTCacheReady={host.state.isSBTCacheReady}
              isSurveyCacheReady={host.state.isSurveyCacheReady}
              isQuestionCacheReady={host.state.isQuestionCacheReady}
              sbtCacheRevision={host.state.sbtCacheRevision}
              questionResponsesNonce={host.state.questionResponsesNonce}
              questionScanProgress={host.state.questionScanProgress}

              // Pass Data Refresh functions
              refreshSbtData={host.refreshSbtData}
              refreshQuestionMetadata={host.refreshQuestionMetadata}
              refreshQuestionResponses={host.refreshQuestionResponses}

              // Demo/Config props
              demoMode={routeDemoMode}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderTagRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug, defaultSessionNetwork } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Tags..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <TagPage
            path={fullPath}
            activeSessionSlug={defaultSlug}
            network={defaultSessionNetwork}
            isQuestionCacheReady={host.state.isQuestionCacheReady}
            questionResponsesNonce={host.state.questionResponsesNonce}
          />
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderCompareRoute: (ctx: RouteRenderCtx) => {
    const { fullPath } = ctx;
    const comparePath = String(fullPath || '').split('?')[0];
    const firstAddress =
      comparePath
        .replace(/^\/compare\/?/, '')
        .split('&')
        .filter(Boolean)[0] || '';
    return (
      <Suspense fallback={<LazyFallback label="Loading..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_COMPARE_ROOT}>
            <CompareAddresses
              firstAddress={firstAddress}
              account={host.props.account}
              scanSpecificUserProfile={host.scanSpecificUserProfile}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderContractsRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Contracts..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_CONTRACTS_ROOT}>
            <ContractPage activeSessionSlug={defaultSlug} />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderAdminRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, requestedSessionId, requestedChainId } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Admin..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_ADMIN_ROOT}>
            <AdminPage
              account={host.props.account}
              provider={host.props.provider}
              network={host.props.network}
              toggleLoginModal={host.props.toggleLoginModal}
              loginComplete={host.props.loginComplete}
              ensureLightSbtUniverse={host.ensureLightSbtUniverse}
              initialSessionId={requestedSessionId}
              initialRegistryChainId={requestedChainId}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderSponsorRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, requestedSessionId, requestedChainId } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Sponsor..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_SPONSOR_ROOT}>
            <SponsorPage
              account={host.props.account}
              provider={host.props.provider}
              network={host.props.network}
              toggleLoginModal={host.props.toggleLoginModal}
              loginComplete={host.props.loginComplete}
              initialSessionId={requestedSessionId}
              initialRegistryChainId={requestedChainId}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderSbtsListRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSessionNetwork } = ctx;
    const routeSessionSlug = host.getSbtListRouteSessionSlug(fullPath);
    const allSessionsMode = !routeSessionSlug;
    return (
      <Suspense fallback={<LazyFallback label={`Loading ${t('sbts')}...`} />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_SBTS_ROOT}>
            <SBTsPage
              provider={host.props.provider}
              account={host.props.account}
              litHooks={host.state.litHooks}
              network={defaultSessionNetwork}
              modalView={true}
              loginComplete={host.props.loginComplete}
              toggleLoginModal={host.props.toggleLoginModal}
              miniaturized={false}
              sessionSlug={routeSessionSlug || undefined}
              allSessionsMode={allSessionsMode}
              isSBTCacheReady={host.state.isSBTCacheReady}
              sbtCacheRevision={host.state.sbtCacheRevision}
              refreshSbtData={host.refreshSbtData}
              latestBlockNumber={host.state.latestBlockNumber}
              sbtScanProgressBySlug={host.state.sbtScanProgressBySlug}
              sbtRealtimeCoverageBySlug={host.state.sbtRealtimeCoverageBySlug}
              ensureLightSbtDiscovery={host.ensureLightSbtDiscovery}
              ensureLightSbtUniverse={host.ensureLightSbtUniverse}
              refreshSessionUniverseRegistryCache={host.refreshSessionUniverseRegistryCache}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderSbtDetailRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, searchStr, defaultSlug, defaultSessionNetwork } = ctx;
    const pathParts = fullPath.split('/');
    const sbtAddress = pathParts[2];
    const sbtPassword = pathParts.length > 3 ? pathParts[3] : null;
    const sbtLower = (sbtAddress || '').toLowerCase();
    const detailRouteHintSlug = host.resolveTrustedSbtRouteSessionSlug(searchStr) || '';
    const initialDetailSlug = detailRouteHintSlug || defaultSlug;
    const resolvedDetailSlug =
      host.state.sbtDetailAddress &&
      host.state.sbtDetailAddress.toLowerCase() === sbtLower &&
      host.state.sbtDetailGroupSlug != null
        ? host.state.sbtDetailGroupSlug
        : initialDetailSlug;
    const resolvedDetailNetwork = host.getSessionNetwork(resolvedDetailSlug) || defaultSessionNetwork;
    return (
      <Suspense fallback={<LazyFallback label={`Loading ${t('sbt')}...`} />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_SBT_ROOT}>
            <SBTPage
              SBTAddress={sbtAddress}
              sbtMintPassword={sbtPassword}
              toggleLoginModal={host.props.toggleLoginModal}
              account={host.props.account}
              provider={host.props.provider}
              litHooks={host.state.litHooks}
              loginComplete={host.props.loginComplete}
              loginInProgress={host.props.loginInProgress}
              network={resolvedDetailNetwork}
              chains={host.props.wagmiChainOptions}
              blockNumber={host.props.wagmiBlocknumber}
              isSBTCacheReady={host.state.isSBTCacheReady}
              sbtCacheRevision={host.state.sbtCacheRevision}
              sessionSlug={resolvedDetailSlug}
              refreshSbtData={host.refreshSbtData}
              sbtScanInProgress={host.readFlag('sbt:fullScanInProgress', resolvedDetailSlug)}
              sbtScanPending={host.readFlag('sbt:deferredFullScanNeeded', resolvedDetailSlug)}
              sbtScanProgress={host.state.sbtScanProgressBySlug?.[resolvedDetailSlug] || null}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderUserProfileRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug, defaultSessionNetwork } = ctx;
    const profilePath = fullPath;
    const profileSearchStr = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const profileSearchParams = new URLSearchParams(profileSearchStr);

    const viewAddress = profilePath.slice(1).replace('u/', '');
    const defaultTab = profileSearchParams.get('tab');

    return (
      <Suspense fallback={<LazyFallback label="Loading Profile..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <UserPage
            viewAddress={viewAddress}
            account={host.props.account}
            address={host.props.address}
            provider={host.props.provider}
            network={defaultSessionNetwork}
            activeSessionSlug={defaultSlug}
            sbtCacheRevision={host.state.sbtCacheRevision}
            questionResponsesNonce={host.state.questionResponsesNonce}
            defaultTab={defaultTab}
            isSBTCacheReady={!!host.state.isSBTCacheReady}
            isSurveyCacheReady={!!host.state.isSurveyCacheReady}
            isQuestionCacheReady={!!host.state.isQuestionCacheReady}
            isResponsesCacheReady={!!host.state.isResponsesCacheReady}
            isAllCachesReady={!!host.state.isAllCachesReady}
            cacheHasLoaded={!!host.state.cacheHasLoaded}
            latestBlockNumber={host.state.latestBlockNumber}
            scanSpecificUserProfile={host.scanSpecificUserProfilePriority}
          />
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderHomeRoute: (ctx: RouteRenderCtx) => {
    const { defaultSlug, defaultSessionNetwork, cacheInitializationError } = ctx;
    return (
      <div className={styles.main} data-testid={E2E_TESTIDS.PAGE_HOME_ROOT}>
        <MainAreaTabs
          changeFocusedTab={host.props.changeFocusedTab}
          toggleLoginModal={host.props.toggleLoginModal}
          toggleDemoMode={host.props.toggleDemoMode}
          account={host.props.account}
          provider={host.props.provider}
          litHooks={host.state.litHooks}
          focusedTab={host.props.focusedTab}
          loginComplete={host.props.loginComplete}
          loginInProgress={host.props.loginInProgress}
          demoMode={host.props.demoMode}
          demoSurfaceMode={host.props.demoSurfaceMode}
          activeSessionSlug={defaultSlug}
          network={defaultSessionNetwork}
          isAllCachesReady={host.state.isAllCachesReady}
          cacheHasLoaded={host.state.cacheHasLoaded}
          sbtCacheRevision={host.state.sbtCacheRevision}
          isSurveyCacheReady={host.state.isSurveyCacheReady}
          isQuestionCacheReady={host.state.isQuestionCacheReady}
          isSBTCacheReady={host.state.isSBTCacheReady}
          sbtRealtimeCoverageBySlug={host.state.sbtRealtimeCoverageBySlug}
          ensureLightSbtDiscovery={host.ensureLightSbtDiscovery}
          ensureLightSbtUniverse={host.ensureLightSbtUniverse}
          cacheInitializationError={cacheInitializationError}
        />
        <RightSide />
      </div>
    );
  },

  _renderSurveyIdRoute: (ctx: RouteRenderCtx) => {
    const {
      surveyIDFromPath,
      fullPath,
      searchStr,
      searchParams,
      autoOpenResults,
      parsedFilterStateFromUrl,
      cacheInitializationError,
    } = ctx;
    const sidLower = surveyIDFromPath!.toLowerCase();

    // 0. LOADING GATE: If caches haven't loaded yet, don't attempt to resolve or scan.
    // This prevents "Survey Not Found" from flashing during initial hydration.
    if (!host.state.cacheHasLoaded && !host.state.isAllCachesReady) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            color: 'white',
          }}
        >
          <h3>Loading...</h3>
          <div style={{ marginTop: '1rem' }} className="spinner-border text-light" role="status" />
        </div>
      );
    }

    // 1. Determine the "Best Guess" Slug
    const effectiveSlug = host.findGroupSlugForSurvey(sidLower);

    // 2. Check if the data actually exists in this resolved context
    const cfg = host.getSessionCfg(effectiveSlug);
    const cache = host.readDgRecord('surveysCache', effectiveSlug, {
      clone: false,
    }) as MainSiteSurveyMetadataCache | null;
    const netKey = String(host.getSessionChainId(effectiveSlug));

    const inCache = !!cache?.[netKey]?.surveys?.[sidLower];
    const inConfig =
      Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
      cfg.HIGHLIGHTED_SURVEY_IDS.some((id: string) => id.toLowerCase() === sidLower);

    // 3. Check Scan State
    const isScanning = host.state.isScanningForGroup === sidLower;
    const hasFailed = host.state.scanFailedFor === sidLower;
    const hasError = host.state.scanErrorFor === sidLower;

    // 4. BLOCKING LOGIC: If missing, not scanning, and not failed -> Start Scan
    if (!inCache && !inConfig && !hasFailed && !hasError && !isScanning) {
      host.queueSurveyGroupScan(sidLower, { hintedSlug: host.getSurveyRouteSessionSlugHint() });
    }

    // 5. RENDER SPINNER (Block SurveyPage from mounting if scanning or missing)
    if ((!inCache && !inConfig && !hasFailed && !hasError) || isScanning) {
      const routeHintSlug = host.getSurveyRouteSessionSlugHint();
      const scanTargetLabel = routeHintSlug ? `session "${routeHintSlug}" first, then other sessions` : 'demo sessions';
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            color: 'white',
          }}
        >
          <h3>Resolving Survey Context...</h3>
          <p>
            Scanning {scanTargetLabel} for ID: {sidLower.substring(0, 6)}...
          </p>
          <div style={{ marginTop: '1rem' }} className="spinner-border text-light" role="status" />
        </div>
      );
    }

    if (hasError) {
      const loadErrorMessage =
        String(host.state.scanErrorMessage || '').trim() || 'Survey metadata was found but could not be loaded.';
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            color: 'white',
          }}
        >
          <h3>Survey Load Error</h3>
          <p>{loadErrorMessage}</p>
          <button
            className="btn btn-outline-light"
            onClick={() =>
              host.setState({ scanErrorFor: null, scanErrorMessage: '', scanFailedFor: null }, () =>
                host.queueSurveyGroupScan(sidLower, { hintedSlug: host.getSurveyRouteSessionSlugHint() }),
              )
            }
          >
            Retry
          </button>
        </div>
      );
    }

    // 6. If Scan Failed (Survey truly doesn't exist in any known group)
    if (hasFailed) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            color: 'white',
          }}
        >
          <h3>Survey Not Found</h3>
          <p>This survey ID does not exist in any known session.</p>
          <button className="btn btn-outline-light" onClick={() => window.history.back()}>
            Go Back
          </button>
        </div>
      );
    }

    // 7. Success: We have the data (or config) and the correct slug. Render the Page immediately.
    const effectiveNetwork = host.getSessionNetwork(effectiveSlug);
    const authViewProps = composeMainSiteAuthViewProps(host.props);
    const surveyCacheViewProps = composeMainSiteSurveyCacheViewProps(host.state);
    const surveyPathParts = fullPath.split('/');
    let responderParam = searchParams.get('responder') || null;
    const legacySurveyResponder = surveyPathParts.length > 3 ? surveyPathParts[3] : null;
    const isSurveyResultsRoute = fullPath.includes('/results');
    if (!isSurveyResultsRoute && !responderParam && isRouteResponderAddress(legacySurveyResponder)) {
      responderParam = legacySurveyResponder;
      replaceRouteResponderQueryParam(`/survey/${surveyIDFromPath}`, responderParam, searchStr);
    }

    return (
      <Suspense fallback={<LazyFallback label="Loading..." />}>
        <div data-testid={E2E_TESTIDS.PAGE_SURVEYS_ROOT}>
          <SurveyPage
            key={`${effectiveSlug}-${sidLower}`} // Force remount if slug changes
            surveyID={sidLower}
            autoOpenResults={autoOpenResults}
            filterState={parsedFilterStateFromUrl}
            displayAnswerMode={isSurveyResultsRoute ? false : !!responderParam}
            viewAddress={isSurveyResultsRoute ? null : responderParam}
            {...authViewProps}
            network={effectiveNetwork}
            activeSessionSlug={effectiveSlug}
            {...surveyCacheViewProps}
            refreshSurveyResponsesByID={host.refreshSurveyResponsesByID}
            refreshQuestionMetadata={host.refreshQuestionMetadata}
            refreshQuestionResponses={host.refreshQuestionResponses}
            refreshSbtData={host.refreshSbtData}
            scanForSurveyGroup={host.scanForSurveyGroup}
            cacheInitializationError={cacheInitializationError}
            defaultTags={cfg?.defaultTags}
            defaultSbtTags={cfg?.defaultSbtTags}
            defaultFilterState={cfg?.defaultFilterState}
            defaultFeaturedSBTs={cfg?.defaultFeaturedSBTs || []}
          />
        </div>
      </Suspense>
    );
  },

  _renderSurveysOrQuestionsListRoute: (ctx: RouteRenderCtx) => {
    const {
      fullPath,
      searchStr,
      searchParams,
      defaultSlug,
      defaultSessionCfg,
      defaultSessionChainId,
      defaultSessionNetwork,
      autoOpenResults,
      parsedFilterStateFromUrl,
      cacheInitializationError,
    } = ctx;

    // Note: Specific survey ID routes are intercepted above.
    // This block now primarily handles /surveys (list) and /questions (list).
    const isQuestionsListRoute = fullPath.startsWith('/questions');
    const initialQuestionRouteSession = isQuestionsListRoute
      ? resolveMainSiteQuestionRouteSessionContext({
          search: searchStr,
          isCacheManagerReady: host.state.isCacheManagerReady,
          getSessionConfigBySlug: (slug: string) => host.getDisplaySessionCfg(slug) as SessionConfigLike | null,
          formatSessionId: sessionRegistryReadsPort.formatSessionId,
          resolveSessionConfigById: (sessionId: string | number) =>
            sessionRegistryReadsPort.getSessionConfigById(sessionId),
        })
      : null;
    const inheritedNetworkWaitSlug =
      isQuestionsListRoute && initialQuestionRouteSession?.sessionSlugPinned
        ? initialQuestionRouteSession.sessionSlug
        : defaultSlug;
    const inheritedNetworkWaitCfg =
      inheritedNetworkWaitSlug === defaultSlug
        ? defaultSessionCfg
        : host.getDisplaySessionCfg(inheritedNetworkWaitSlug);
    const inheritedNetworkWaitChainId =
      inheritedNetworkWaitSlug === defaultSlug
        ? defaultSessionChainId
        : host.getDisplaySessionChainId(inheritedNetworkWaitSlug);
    const slugStatus = host._sessionPathResolver.getSlugStatus(String(inheritedNetworkWaitSlug || ''));
    const shouldWaitForInheritedSessionNetwork =
      !!inheritedNetworkWaitSlug &&
      !inheritedNetworkWaitChainId &&
      !inheritedNetworkWaitCfg?.networkChainId &&
      (!slugStatus.hasAttempted || slugStatus.isPending);
    if (shouldWaitForInheritedSessionNetwork) {
      host.resolveSessionPathSlug(inheritedNetworkWaitSlug);
      return <LazyFallback label={fullPath.startsWith('/questions') ? 'Loading Questions...' : 'Loading Surveys...'} />;
    }

    const parts = fullPath.split('?')[0].split('/').filter(Boolean);
    let surveyID = null;
    let displayAnswerMode = false;
    let viewResponseAddress = null;

    // Fallback extraction if regex above didn't catch it (unlikely given logic order, but safe)
    if (parts[0] === 'survey' && parts[1] && VALID_SURVEY_ID_RE.test(parts[1])) {
      surveyID = parts[1];
      let responderParam = searchParams.get('responder') || null;
      const legacySurveyResponder = parts[2] || null;
      if (!responderParam && isRouteResponderAddress(legacySurveyResponder)) {
        responderParam = legacySurveyResponder;
        replaceRouteResponderQueryParam(`/survey/${surveyID}`, responderParam, searchStr);
      }
      if (responderParam) {
        displayAnswerMode = true;
        viewResponseAddress = responderParam;
      }
    }

    const pageRootTestId = fullPath.startsWith('/questions')
      ? E2E_TESTIDS.PAGE_QUESTIONS_ROOT
      : E2E_TESTIDS.PAGE_SURVEYS_ROOT;
    const questionRouteSession = initialQuestionRouteSession || {
      sessionSlug: null,
      sessionId: null,
      sessionSlugKnown: false,
      sessionSlugPinned: false,
      shouldBlockDuringBootstrap: false,
    };
    if (questionRouteSession.shouldBlockDuringBootstrap) {
      return <LazyFallback label="Loading Questions..." />;
    }
    const effectivePageSlug =
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned ? questionRouteSession.sessionSlug : defaultSlug;
    const effectivePageSessionCfg = isQuestionsListRoute
      ? host.getDisplaySessionCfg(effectivePageSlug)
      : defaultSessionCfg;
    const effectivePageChainId = isQuestionsListRoute
      ? host.getDisplaySessionChainId(effectivePageSlug)
      : defaultSessionChainId;
    const effectivePageNetwork = isQuestionsListRoute
      ? host.getDisplaySessionNetwork(effectivePageSlug)
      : defaultSessionNetwork;
    const strictQuestionRouteSessionCfg =
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned && effectivePageSlug
        ? host.getSessionCfg(effectivePageSlug)
        : null;
    const strictQuestionRouteChainId =
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned && effectivePageSlug
        ? host.getSessionChainId(effectivePageSlug)
        : null;
    const shouldResolvePinnedQuestionRouteSession = !!(
      isQuestionsListRoute &&
      questionRouteSession.sessionSlugPinned &&
      effectivePageSlug &&
      effectivePageSessionCfg &&
      (!strictQuestionRouteSessionCfg || !strictQuestionRouteChainId) &&
      !hasMainSiteRegistryIdentity(effectivePageSessionCfg)
    );
    if (shouldResolvePinnedQuestionRouteSession) {
      const slugStatus = host._sessionPathResolver.getSlugStatus(String(effectivePageSlug || ''));
      const recentError = !!(slugStatus.lastErrorTs && Date.now() - slugStatus.lastErrorTs < 2 * 60 * 1000);
      const keepResolving = recentError && slugStatus.retryCount > 0;
      host.resolveSessionPathSlug(effectivePageSlug!);
      if (!slugStatus.hasAttempted || slugStatus.isPending || keepResolving) {
        return <LazyFallback label="Loading Questions..." />;
      }
    }
    const shouldRefreshBuiltInDemoQuestionSources =
      isQuestionsListRoute &&
      questionRouteSession.sessionSlugPinned &&
      normalizeSessionSlug(effectivePageSlug || '') === 'demo';
    const pageRefreshSurveyResponsesByID =
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? (id: string) => {
            const primary = host.refreshSurveyResponsesByIDForGroup(effectivePageSlug!, id);
            if (!shouldRefreshBuiltInDemoQuestionSources) return primary;
            return Promise.all([
              Promise.resolve(primary),
              Promise.resolve(host.refreshSurveyResponsesByIDForGroup('', id)),
            ]).then(() => undefined);
          }
        : host.refreshSurveyResponsesByID;
    const pageRefreshQuestionMetadata =
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? (opts = {}) => {
            const primary = host.refreshQuestionMetadataForGroup(effectivePageSlug!, opts);
            if (!shouldRefreshBuiltInDemoQuestionSources) return primary;
            return Promise.all([
              Promise.resolve(primary),
              Promise.resolve(host.refreshQuestionMetadataForGroup('', opts)),
            ]).then(() => undefined);
          }
        : host.refreshQuestionMetadata;
    const pageRefreshQuestionResponses =
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? (questionIds?: string[] | null, opts: RefreshQuestionResponsesOptions = {}) => {
            const primary = host.refreshQuestionResponses(questionIds, {
              ...(opts || {}),
              slug: effectivePageSlug ?? undefined,
            });
            if (!shouldRefreshBuiltInDemoQuestionSources) return primary;
            return Promise.all([
              Promise.resolve(primary),
              Promise.resolve(host.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: '' })),
            ]).then(() => undefined);
          }
        : host.refreshQuestionResponses;
    const pageRefreshSbtData =
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? (addr: string, slug?: string) => host.refreshSbtData(addr, slug || effectivePageSlug!)
        : host.refreshSbtData;
    const authViewProps = composeMainSiteAuthViewProps(host.props);
    const surveyCacheViewProps = composeMainSiteSurveyCacheViewProps(host.state);

    return (
      <Suspense fallback={<LazyFallback label="Loading..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={pageRootTestId}>
            <SurveyPage
              surveyID={surveyID}
              displayAnswerMode={displayAnswerMode}
              viewAddress={viewResponseAddress}
              {...authViewProps}
              network={effectivePageNetwork}
              networkChainId={effectivePageChainId}
              activeSessionSlug={effectivePageSlug}
              sessionSlug={isQuestionsListRoute ? effectivePageSlug : undefined}
              sessionSlugPinned={questionRouteSession.sessionSlugPinned}
              sessionConfig={effectivePageSessionCfg}
              ensureLightSbtUniverse={host.ensureLightSbtUniverse}
              {...surveyCacheViewProps}
              refreshSurveyResponsesByID={pageRefreshSurveyResponsesByID}
              refreshQuestionMetadata={pageRefreshQuestionMetadata}
              refreshQuestionResponses={pageRefreshQuestionResponses}
              autoOpenResults={autoOpenResults}
              filterState={parsedFilterStateFromUrl}
              refreshSbtData={pageRefreshSbtData}
              scanForSurveyGroup={host.scanForSurveyGroup}
              cacheInitializationError={cacheInitializationError}
              litHooks={host.state.litHooks}
              defaultTags={effectivePageSessionCfg?.defaultTags}
              defaultSbtTags={effectivePageSessionCfg?.defaultSbtTags}
              defaultFilterState={effectivePageSessionCfg?.defaultFilterState}
              defaultFeaturedSBTs={effectivePageSessionCfg?.defaultFeaturedSBTs || []}
              contracts={effectivePageSessionCfg?.contracts || {}}
              blockLimits={effectivePageSessionCfg?.blockLimits || { start: null, end: null }}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  _renderQuestionDetailRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, searchStr, defaultSessionNetwork, cacheInitializationError } = ctx;
    const pathParts = fullPath.split('/');
    const questionIndex = pathParts.indexOf('question');
    const questionID = pathParts[questionIndex + 1];
    const urlParams = new URLSearchParams(searchStr);
    let responderAddress = urlParams.get('responder') || null;
    const legacyResponderAddress = pathParts[questionIndex + 2] || null;
    if (!responderAddress && isRouteResponderAddress(legacyResponderAddress)) {
      responderAddress = legacyResponderAddress;
      replaceRouteResponderQueryParam(
        `/question/${String(questionID || '')
          .trim()
          .toLowerCase()}`,
        responderAddress,
        searchStr,
      );
    }
    const questionRouteSession = resolveMainSiteQuestionRouteSessionContext({
      search: searchStr,
      isCacheManagerReady: host.state.isCacheManagerReady,
      getSessionConfigBySlug: (slug: string) => host.getDisplaySessionCfg(slug) as SessionConfigLike | null,
      formatSessionId: sessionRegistryReadsPort.formatSessionId,
      resolveSessionConfigById: (sessionId: string | number) =>
        sessionRegistryReadsPort.getSessionConfigById(sessionId),
    });
    const queryQuestionSlug = questionRouteSession.sessionSlug;
    const queryQuestionSessionId = questionRouteSession.sessionId;
    const questionSlugPinned = questionRouteSession.sessionSlugPinned;
    if (questionRouteSession.shouldBlockDuringBootstrap) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            color: 'white',
          }}
        >
          <h3>Loading Question...</h3>
          <div style={{ marginTop: '1rem' }} className="spinner-border text-light" role="status" />
        </div>
      );
    }
    const effectiveQuestionSlug = questionSlugPinned ? queryQuestionSlug : host.findGroupSlugForQuestion(questionID);
    if (effectiveQuestionSlug != null && typeof window !== 'undefined') {
      const canonicalQuestionPath = buildQuestionRoutePath(questionID, {
        responderAddress,
        sessionSlug: effectiveQuestionSlug,
        sessionId: queryQuestionSessionId || undefined,
      });
      const currentPath = `${window.location.pathname || ''}${window.location.search || ''}`;
      const canonicalQuestionPublicPath = buildPublicRoute(canonicalQuestionPath);
      if (canonicalQuestionPublicPath !== currentPath) {
        const withHash = `${canonicalQuestionPublicPath}${window.location.hash || ''}`;
        window.history.replaceState({}, '', withHash);
      }
    }
    const walletNetwork = host.props.network && typeof host.props.network === 'object' ? host.props.network : null;
    const effectiveQuestionNetwork =
      host.getSessionNetwork(effectiveQuestionSlug) ||
      defaultSessionNetwork ||
      walletNetwork ||
      host.getSessionNetwork('') ||
      null;
    const questionSessionCfg = host.getSessionCfg(effectiveQuestionSlug);
    const authViewProps = composeMainSiteAuthViewProps(host.props);
    const questionCacheViewProps = composeMainSiteQuestionCacheViewProps(host.state);
    return (
      <Suspense fallback={<LazyFallback label="Loading Question..." />}>
        <div data-testid={E2E_TESTIDS.PAGE_QUESTIONS_ROOT}>
          <SurveyTool
            key={`${effectiveQuestionSlug}-${String(questionID || '').toLowerCase()}-${String(responderAddress || '').toLowerCase()}`}
            questionID={questionID}
            responderAddress={responderAddress}
            singleQuestionMode={true}
            {...authViewProps}
            network={effectiveQuestionNetwork}
            networkChainId={effectiveQuestionNetwork?.id || host.props.network?.id || null}
            activeSessionSlug={effectiveQuestionSlug}
            sessionSlug={effectiveQuestionSlug}
            sessionSlugPinned={questionSlugPinned}
            sessionConfig={questionSessionCfg}
            ensureLightSbtUniverse={host.ensureLightSbtUniverse}
            {...questionCacheViewProps}
            refreshSurveyResponsesByID={(id: string) =>
              host.refreshSurveyResponsesByIDForGroup(effectiveQuestionSlug!, id)
            }
            refreshQuestionMetadata={() => host.refreshQuestionMetadataForGroup(effectiveQuestionSlug!)}
            refreshQuestionResponses={(questionIds?: string[] | null, opts: RefreshQuestionResponsesOptions = {}) =>
              host.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: effectiveQuestionSlug ?? undefined })
            }
            refreshSbtData={(addr: string, slug?: string) => host.refreshSbtData(addr, slug || effectiveQuestionSlug!)}
            scanForSurveyGroup={host.scanForSurveyGroup}
            cacheInitializationError={cacheInitializationError}
            litHooks={host.state.litHooks}
            defaultTags={questionSessionCfg?.defaultTags}
            defaultSbtTags={questionSessionCfg?.defaultSbtTags}
            defaultFilterState={questionSessionCfg?.defaultFilterState}
            defaultFeaturedSBTs={questionSessionCfg?.defaultFeaturedSBTs || []}
          />
        </div>
      </Suspense>
    );
  },

  _renderSessionRoute: (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSessionNetwork, cacheInitializationError } = ctx;
    const parts = fullPath.split('/').filter(Boolean);
    const sessionTokenRaw = (parts[1] || '').trim();
    const subroute = (parts[2] || '').trim().toLowerCase();
    const isDocsRoute = subroute === 'docs';
    const nextSubroute = (parts[3] || '').trim().toLowerCase();
    const isQuestionsRoute = subroute === 'questions' && (!nextSubroute || nextSubroute === 'results');
    const isQuestionResultsRoute = isQuestionsRoute && nextSubroute === 'results' && !parts[4];
    const hasUnsupportedSessionSubroute =
      (!!parts[2] && !isDocsRoute && !isQuestionsRoute) ||
      (subroute === 'questions' && !!nextSubroute && nextSubroute !== 'results') ||
      (subroute === 'questions' && nextSubroute === 'results' && !!parts[4]);
    const sessionRoute = resolveMainSiteSessionRouteContext({
      sessionTokenRaw,
      formatSessionId: sessionRegistryReadsPort.formatSessionId,
      resolveSessionConfigById: (sessionId: string | number) =>
        sessionRegistryReadsPort.getSessionConfigById(sessionId),
      resolveSessionConfigBySlug: (slug: string) =>
        sessionRegistryReadsPort.getSessionConfig(slug) || getSessionConfigBySlug(slug),
      resolveDisplaySessionConfigBySlug: (slug: string) =>
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) ||
        (normalizeSessionSlug(slug) === 'demo' ? getDemoSessionConfigBySlug('', { allowDemoFallback: true }) : null),
      resolveSessionSlugFromPathToken: (sessionToken: string) =>
        sessionToken
          ? host.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true })
          : DEFAULT_SESSION_SLUG,
    });
    const sessionIdFromPath = sessionRoute.sessionIdFromPath;
    const configBySessionId = sessionRoute.configBySessionId;
    let slug = sessionRoute.sessionSlug;

    if (!isDocsRoute && sessionIdFromPath && configBySessionId && typeof window !== 'undefined') {
      const resolvedSlug = normalizeSessionSlug(configBySessionId.slug || '');
      const canonicalToken = resolvedSlug || DEFAULT_SESSION_SLUG_ALIAS;
      if (sessionTokenRaw.toLowerCase() !== canonicalToken.toLowerCase()) {
        const nextPath = `/session/${canonicalToken}${
          isQuestionResultsRoute ? '/questions/results' : isQuestionsRoute ? '/questions' : ''
        }`;
        const nextUrl = buildPublicUrl(nextPath, window.location.search || '', window.location.hash || '');
        window.history.replaceState({}, '', nextUrl);
      }
    }

    if (sessionRoute.hasUnresolvedSessionId) {
      const unresolvedSessionId = sessionIdFromPath!;
      const idStatus = host._sessionPathResolver.getIdStatus(unresolvedSessionId);
      const recentError = !!(idStatus.lastErrorTs && Date.now() - idStatus.lastErrorTs < 2 * 60 * 1000);
      const keepResolving = recentError && idStatus.retryCount > 0;
      host.resolveSessionPathId(unresolvedSessionId);
      if (!idStatus.hasAttempted || idStatus.isPending || keepResolving) {
        return <SessionLoadingSkeleton statusTitle={`Resolving ${unresolvedSessionId} Session...`} />;
      }
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            color: 'rgba(244,247,255,0.65)',
          }}
        >
          <h3>Session Not Found</h3>
          <p>No session metadata was found for {sessionIdFromPath}.</p>
        </div>
      );
    }

    slug = normalizeSessionSlug(slug);
    const canonicalSessionToken = slug || sessionTokenRaw || DEFAULT_SESSION_SLUG_ALIAS;

    const searchStr = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const qp = new URLSearchParams(searchStr);
    const hasAutoFlag = hasAutoFlagFn(searchStr);

    if (!isDocsRoute && (qp.has('password') || qp.has('gp')) && !hasAutoFlag) {
      const base = `/session/${canonicalSessionToken}`;
      if (typeof window !== 'undefined') window.location.replace(buildPublicRoute(base));
      return <div />;
    }
    const sessionConfig = sessionRoute.sessionConfig;

    if (!sessionConfig) {
      if (slug) {
        const slugStatus = host._sessionPathResolver.getSlugStatus(slug);
        const recentError = !!(slugStatus.lastErrorTs && Date.now() - slugStatus.lastErrorTs < 2 * 60 * 1000);
        const keepResolving = recentError && slugStatus.retryCount > 0;
        host.resolveSessionPathSlug(slug);
        if (!slugStatus.hasAttempted || slugStatus.isPending || keepResolving) {
          return <SessionLoadingSkeleton statusTitle={`Resolving ${slug} Session...`} />;
        }
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '50vh',
              color: 'rgba(244,247,255,0.65)',
            }}
          >
            <h3>Session Not Found</h3>
            <p>No session metadata was found for {slug}.</p>
          </div>
        );
      }
      return <div>Session not found.</div>;
    }

    const sessionConfigSlug = normalizeSessionSlug(sessionConfig.slug || '');
    const sessionRegistryInfo =
      sessionConfig.__registry && typeof sessionConfig.__registry === 'object' ? sessionConfig.__registry : {};
    const sessionConfigHasRegistryIdentity = !!(
      sessionConfig.sessionId ||
      sessionConfig.sessionIdHex ||
      sessionConfig.metadataURI ||
      sessionRegistryInfo.sessionId ||
      sessionRegistryInfo.sessionIdHex ||
      sessionRegistryInfo.metadataURI
    );
    if (slug && sessionConfigSlug !== slug && !sessionConfigHasRegistryIdentity) {
      host.resolveSessionPathSlug(slug);
    }

    if (isDocsRoute) {
      const resolvedSlug = normalizeSessionSlug(sessionConfig.slug || slug);
      const sessionNetwork = host.getSessionNetwork(resolvedSlug) || defaultSessionNetwork;
      return (
        <Suspense fallback={<LazyFallback label="Loading Docs..." />}>
          <div data-testid={E2E_TESTIDS.PAGE_SESSION_DOCS_ROOT}>
            <SessionDocumentsPage
              provider={host.props.provider}
              account={host.props.account}
              network={sessionNetwork}
              litHooks={host.state.litHooks}
              toggleLoginModal={(loginModalIsOpen?: boolean) => host.props.toggleLoginModal(loginModalIsOpen)}
              loginComplete={host.props.loginComplete}
              sessionToken={sessionTokenRaw}
              sessionSlug={resolvedSlug}
              sessionConfig={sessionConfig}
              sessionIdHex={sessionConfig?.__registry?.sessionIdHex || null}
            />
          </div>
        </Suspense>
      );
    }

    if (hasUnsupportedSessionSubroute) {
      const base = `/session/${canonicalSessionToken}`;
      if (typeof window !== 'undefined') window.location.replace(buildPublicRoute(base));
      return <div />;
    }

    const sessionRouteSourceSlug = resolveMainSiteSessionRouteSourceSlug({
      sessionTokenRaw,
      sessionSlug: slug,
      sessionConfig,
    });
    const sessionRouteDisplaySlug = normalizeSessionSlug(sessionConfig.slug || slug);
    const shouldRefreshBuiltInDemoLiveBucket =
      normalizeSessionSlug(sessionTokenRaw) === 'demo' &&
      sessionRouteDisplaySlug === 'demo' &&
      sessionRouteSourceSlug === '';
    const refreshSessionRouteSurveyResponsesByID = (id: string) => {
      const primary = host.refreshSurveyResponsesByIDForGroup(sessionRouteSourceSlug, id);
      if (!shouldRefreshBuiltInDemoLiveBucket) return primary;
      return Promise.all([
        Promise.resolve(primary),
        Promise.resolve(host.refreshSurveyResponsesByIDForGroup('demo', id)),
      ]).then(() => undefined);
    };
    const refreshSessionRouteQuestionMetadata = (opts = {}) => {
      const primary = host.refreshQuestionMetadataForGroup(sessionRouteSourceSlug, opts);
      if (!shouldRefreshBuiltInDemoLiveBucket) return primary;
      return Promise.all([
        Promise.resolve(primary),
        Promise.resolve(host.refreshQuestionMetadataForGroup('demo', opts)),
      ]).then(() => undefined);
    };
    const refreshSessionRouteQuestionResponses = (
      questionIds?: string[] | null,
      opts: RefreshQuestionResponsesOptions = {},
    ) => {
      const primary = host.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: sessionRouteSourceSlug });
      if (!shouldRefreshBuiltInDemoLiveBucket) return primary;
      return Promise.all([
        Promise.resolve(primary),
        Promise.resolve(host.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: 'demo' })),
      ]).then(() => undefined);
    };
    const resolvedSessionInfo = host.getSessionInfoForGroup(sessionConfig, sessionConfig?.slug || slug);
    const resolvedSessionName = host.getSessionNameForGroup(sessionConfig, sessionConfig?.slug || slug);
    const resolvedSessionHeader = host.getSessionHeaderForGroup(sessionConfig, sessionConfig?.slug || slug);
    const walletViewProps = composeMainSiteWalletViewProps(host.props);
    const loginViewProps = composeMainSiteLoginViewProps(host.props);
    const sessionCacheViewProps = composeMainSiteSessionCacheViewProps(host.state);

    return (
      <Suspense fallback={<LazyFallback label="Loading Session..." />}>
        <RouteErrorBoundary resetKey={host.props.path}>
          <div data-testid={E2E_TESTIDS.PAGE_SESSION_ROOT}>
            <OnePageSession
              slug={sessionConfig.slug || slug}
              sessionName={resolvedSessionName}
              sessionHeader={resolvedSessionHeader}
              sessionInfo={resolvedSessionInfo}
              sessionConfig={sessionConfig}
              defaultTags={sessionConfig.defaultTags}
              defaultSbtTags={sessionConfig.defaultSbtTags}
              defaultFilterState={sessionConfig.defaultFilterState}
              defaultFeaturedSBTs={sessionConfig.defaultFeaturedSBTs || []}
              contracts={sessionConfig.contracts || {}}
              blockLimits={sessionConfig.blockLimits || { start: null, end: null }}
              networkChainId={sessionConfig.networkChainId}
              questionsGenPrompt={sessionConfig.questionsGenPrompt}
              {...walletViewProps}
              network={defaultSessionNetwork}
              {...loginViewProps}
              {...sessionCacheViewProps}
              refreshSurveyResponsesByID={refreshSessionRouteSurveyResponsesByID}
              refreshQuestionMetadata={refreshSessionRouteQuestionMetadata}
              refreshQuestionResponses={refreshSessionRouteQuestionResponses}
              questionSessionSlug={sessionRouteSourceSlug}
              refreshSbtData={host.refreshSbtData}
              ensureLightSbtDiscovery={host.ensureLightSbtDiscovery}
              ensureLightSbtUniverse={host.ensureLightSbtUniverse}
              sbtScanProgressBySlug={host.state.sbtScanProgressBySlug}
              sbtRealtimeCoverageBySlug={host.state.sbtRealtimeCoverageBySlug}
              cacheInitializationError={cacheInitializationError}
              autoFeatureSBTsBySessionSlug={
                sessionConfig?.autoFeatureSBTsBySessionSlug !== undefined
                  ? sessionConfig.autoFeatureSBTsBySessionSlug
                  : sessionConfig?.autoFeatureSBTsWithFeaturedSbtTags
              }
              routeQuestionsOpen={isQuestionsRoute}
              routeAutoOpenResults={isQuestionResultsRoute}
              litHooks={host.state.litHooks}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  },

  getMainView: (relevantMatch: RegExpMatchArray | null | undefined) => {
    // Variable initialization
    let surveyIDFromPath: string | null = null;
    let parsedFilterStateFromUrl: Record<string, unknown> = {};
    let autoOpenResults = false;
    let isResultsRoute = false;
    const cacheInitializationError = !!(
      host.state.surveyCacheInitializationError || host.state.questionCacheInitializationError
    );

    let fullPath = host.getEffectiveRoutePath(host.getCurrentPathname());
    const searchStr = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const hashStr = (typeof window !== 'undefined' ? window.location.hash : '') || '';
    const searchParams = new URLSearchParams(searchStr);
    const routeDemoMode = host.props.demoSurfaceMode !== false || searchParams.get('demo') === '1';
    const requestedSessionId = searchParams.get('sessionId') || searchParams.get('sessionID') || '';
    const requestedChainIdRaw = searchParams.get('chainId') || searchParams.get('chainID') || '';
    const requestedSponsoredBundleId = searchParams.get('sponsored') || '';
    const requestedSponsoredBundleKey = readHashQueryParam(hashStr, 'k');
    const requestedChainIdTokens = requestedChainIdRaw ? requestedChainIdRaw.match(/\d+/g) : null;
    const requestedChainId =
      requestedChainIdTokens && requestedChainIdTokens.length
        ? Number(requestedChainIdTokens[requestedChainIdTokens.length - 1])
        : null;
    const sessionFallbackTarget = host.applySessionFallbackRedirect({ pathIn: fullPath });
    if (sessionFallbackTarget) {
      fullPath = sessionFallbackTarget.path;
    }
    const pathWithoutQuery = String(fullPath || '').split('?')[0] || '';
    const pathSegments = pathWithoutQuery.split('/').filter(Boolean);
    const firstPathSegment = String(pathSegments[0] || '')
      .trim()
      .toLowerCase();

    // Robust results routing (/survey/:id/results or /questions/results)
    const surveyMatch = fullPath.match(SURVEY_RESULTS_RE);
    const questionMatch = fullPath.match(QUESTION_RESULTS_RE);

    // Default slug/network for non-survey routes
    const defaultSlug = sessionFallbackTarget?.slug || host.getRenderActiveSessionSlug(fullPath, searchStr);
    const defaultSessionCfg = host.getDisplaySessionCfg(defaultSlug);
    const defaultSessionChainId = host.getDisplaySessionChainId(defaultSlug);
    const defaultSessionNetwork = host.getDisplaySessionNetwork(defaultSlug);

    const routeMatch = resolveMainSiteRouteMatch({
      fullPath,
      isAddress: ethers.utils.isAddress,
      surveyIDFromPath,
    });
    const isWizardRoute = routeMatch.key === 'wizard';
    const shouldBypassCacheHydrationWait = routeMatch.shouldBypassCacheHydrationWait;
    const isKnownRoutePrefix = routeMatch.isKnownRoutePrefix;
    if (isWizardRoute) {
      if (routeMatch.canonicalPath && typeof window !== 'undefined') {
        window.history.replaceState({}, '', `${buildPublicRoute(routeMatch.canonicalPath)}${searchStr}${hashStr}`);
      }
      return (
        <Suspense fallback={<LazyFallback label="Loading Session Wizard..." />}>
          <RouteErrorBoundary resetKey={fullPath}>
            <div data-testid={E2E_TESTIDS.PAGE_SESSION_WIZARD_ROOT}>
              <SessionWizard
                account={host.props.account}
                provider={host.props.provider}
                network={defaultSessionNetwork}
                activeSessionSlug={defaultSlug}
                ensureLightSbtUniverse={host.ensureLightSbtUniverse}
                sbtCacheRevision={host.state.sbtCacheRevision}
                toggleLoginModal={host.props.toggleLoginModal}
                loginComplete={host.props.loginComplete}
                loginInProgress={host.props.loginInProgress}
                initialSessionId={requestedSessionId}
                initialRegistryChainId={requestedChainId}
                initialSponsoredBundleId={requestedSponsoredBundleId}
                initialSponsoredBundleKey={requestedSponsoredBundleKey}
              />
            </div>
          </RouteErrorBoundary>
        </Suspense>
      );
    }

    // Prevent cache-backed views from mounting before cache mirror hydration completes.
    if (!host.state.isCacheManagerReady && !shouldBypassCacheHydrationWait && isKnownRoutePrefix) {
      return <LazyFallback label="Initializing Cache..." />;
    }

    if (surveyMatch) {
      isResultsRoute = true;
      surveyIDFromPath = surveyMatch[1];
      autoOpenResults = true;

      const seg = surveyMatch[2];
      const q = searchParams.get('filter');
      if (seg) {
        parsedFilterStateFromUrl = deserializeFilterState(seg) || {};
      } else if (q) {
        parsedFilterStateFromUrl = deserializeFilterState(q) || {};
      }
    } else if (questionMatch) {
      isResultsRoute = true;
      autoOpenResults = true;
      const seg = questionMatch[1]; // <-- index 1, not 2
      const q = searchParams.get('filter');
      if (seg) {
        parsedFilterStateFromUrl = deserializeFilterState(seg) || {};
      } else if (q) {
        parsedFilterStateFromUrl = deserializeFilterState(q) || {};
      }
    }

    // Extract ID if not already extracted (for non-results view)
    if (!surveyIDFromPath && fullPath.startsWith('/survey/')) {
      const parts = fullPath.split('?')[0].split('/').filter(Boolean);
      if (parts[1] && VALID_SURVEY_ID_RE.test(parts[1])) {
        surveyIDFromPath = parts[1];
      }
    }

    const ctx: RouteRenderCtx = {
      fullPath,
      searchStr,
      hashStr,
      searchParams,
      pathWithoutQuery,
      pathSegments,
      firstPathSegment,
      routeDemoMode,
      requestedSessionId,
      requestedChainId,
      requestedSponsoredBundleId,
      requestedSponsoredBundleKey,
      defaultSlug,
      defaultSessionCfg,
      defaultSessionChainId,
      defaultSessionNetwork,
      cacheInitializationError,
      surveyIDFromPath,
      autoOpenResults,
      parsedFilterStateFromUrl,
      isResultsRoute,
    };

    return renderMainSiteRouteView({
      routeKey: routeMatch.key,
      fullPath,
      renderers: {
        surveyId: () => host._renderSurveyIdRoute(ctx),
        home: () => host._renderHomeRoute(ctx),
        debate: () => host._renderDebateRoute(fullPath),
        atlas: () => host._renderAtlasRoute(ctx),
        tag: () => host._renderTagRoute(ctx),
        bookmarks: () => host._renderBookmarksRoute(),
        compare: () => host._renderCompareRoute(ctx),
        surveysOrQuestionsList: () => host._renderSurveysOrQuestionsListRoute(ctx),
        questionDetail: () => host._renderQuestionDetailRoute(ctx),
        sbtsList: () => host._renderSbtsListRoute(ctx),
        sbtDetail: () => host._renderSbtDetailRoute(ctx),
        simUser: () => host._renderSimUserRoute(fullPath, defaultSessionNetwork),
        userProfile: () => host._renderUserProfileRoute(ctx),
        about: () => host._renderAboutRoute(),
        demos: () => host._renderDemosRoute(),
        matrix: () => host._renderMatrixRoute(),
        contracts: () => host._renderContractsRoute(ctx),
        admin: () => host._renderAdminRoute(ctx),
        sponsor: () => host._renderSponsorRoute(ctx),
        agent: () => host._renderAgentRoute(),
        session: () => host._renderSessionRoute(ctx),
      },
      renderNotFound: (path: string) => <NotFoundRoute path={path} />,
    });
  },
});
