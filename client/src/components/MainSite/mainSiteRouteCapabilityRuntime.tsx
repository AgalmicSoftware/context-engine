import React from 'react';
import { BootRecoveryReady } from '../ErrorBoundary/InitialRouteBoundary';
import { normalizeSessionSlug } from '../../domains/sessions/sessionConfig.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import {
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import type { AppShell } from './AppShell';
import { MainSiteRouteStatusView } from './mainSiteRouteStatusView';

export type MainSiteRouteCapabilities = ReturnType<typeof resolveSessionCapabilityProjection>;

export type MainSiteRouteCapabilityContext = {
  capabilities: MainSiteRouteCapabilities;
  hasResolvedSession: boolean;
  allowChainContext: boolean;
  allowSbtContext: boolean;
  allowLitContext: boolean;
  allowRegistryScan: boolean;
  cacheScope: string;
};

export const resolveMainSiteRouteCapabilityContext = ({
  slug,
  sessionConfig,
  fallbackChainId,
}: {
  slug: unknown;
  sessionConfig: unknown;
  fallbackChainId?: unknown;
}): MainSiteRouteCapabilityContext => {
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  const hasResolvedSession = capabilities.source !== 'missing' || !!normalizeSessionSlug(slug || '');
  let cacheScope = '';
  if (capabilities.profileValid && capabilities.isWorkerCanonical) {
    cacheScope = 'worker';
  } else if (capabilities.chainId && capabilities.hasOnChainComponent) {
    cacheScope = String(capabilities.chainId);
  } else if (!hasResolvedSession) {
    const fallback = Number(fallbackChainId || 0);
    cacheScope = Number.isSafeInteger(fallback) && fallback > 0 ? String(fallback) : '';
  }
  return {
    capabilities,
    hasResolvedSession,
    allowChainContext: !hasResolvedSession || capabilities.hasOnChainComponent,
    allowSbtContext: !hasResolvedSession || capabilities.usesOnChainSbt,
    allowLitContext: !hasResolvedSession || capabilities.source === 'legacy_registry' || capabilities.usesLit,
    allowRegistryScan: !hasResolvedSession || capabilities.isRegistryCanonical,
    cacheScope,
  };
};

export const renderWorkerSurveyMetadataStatus = ({
  context,
  surveyMissing,
  cacheReady,
  cacheError,
  sessionSlug,
  onRetry,
}: {
  context: MainSiteRouteCapabilityContext;
  surveyMissing: boolean;
  cacheReady: boolean;
  cacheError: boolean;
  sessionSlug: string;
  onRetry: () => void;
}): React.ReactNode | null => {
  const workerCanonical =
    context.hasResolvedSession && context.capabilities.profileValid && context.capabilities.isWorkerCanonical;
  if (!workerCanonical || !surveyMissing) return null;
  if (cacheError) {
    return (
      <>
        <MainSiteRouteStatusView
          heading="Survey Metadata Load Error"
          message={<>Survey metadata for session &quot;{sessionSlug}&quot; could not be loaded.</>}
          actionLabel="Retry"
          onAction={onRetry}
        />
        <BootRecoveryReady />
      </>
    );
  }
  if (cacheReady) return null;
  return (
    <MainSiteRouteStatusView
      heading="Loading Survey Metadata..."
      message={<>Loading surveys for session &quot;{sessionSlug}&quot;...</>}
      showSpinner={true}
    />
  );
};

type MainSiteSurveyMetadataCache = Record<string, { surveys?: Record<string, unknown> } | undefined>;

export const resolveMainSiteSurveyRouteCapabilityState = ({
  host,
  sessionSlug,
  surveyId,
}: {
  host: AppShell;
  sessionSlug: string;
  surveyId: string;
}) => {
  const sessionConfig = host.getDisplaySessionCfg(sessionSlug);
  const context = resolveMainSiteRouteCapabilityContext({
    slug: sessionSlug,
    sessionConfig,
    fallbackChainId: host.getSessionChainId(sessionSlug),
  });
  const cache = host.readDgRecord('surveysCache', sessionSlug, {
    clone: false,
  }) as MainSiteSurveyMetadataCache | null;
  const scopedCacheNode = context.cacheScope ? cache?.[context.cacheScope] : null;
  let cacheIdentityMatches = true;
  if (context.cacheScope === 'worker') {
    try {
      const expectedIdentity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug });
      cacheIdentityMatches = workerCanonicalCacheIdentityMatches(scopedCacheNode, expectedIdentity);
    } catch {
      cacheIdentityMatches = false;
    }
  }
  const inCache = !!context.cacheScope && cacheIdentityMatches && !!scopedCacheNode?.surveys?.[surveyId];
  const inConfig =
    Array.isArray(sessionConfig?.HIGHLIGHTED_SURVEY_IDS) &&
    sessionConfig.HIGHLIGHTED_SURVEY_IDS.some((id: string) => id.toLowerCase() === surveyId);
  const surveyMissing = !inCache && !inConfig;
  return {
    ...context,
    sessionConfig,
    surveyMissing,
    isScanning: host.state.isScanningForGroup === surveyId,
    hasFailed: host.state.scanFailedFor === surveyId,
    hasError: host.state.scanErrorFor === surveyId,
    workerMetadataStatus: renderWorkerSurveyMetadataStatus({
      context,
      surveyMissing,
      cacheReady: !!host.state.isSurveyCacheReady,
      cacheError: !!host.state.surveyCacheInitializationError,
      sessionSlug,
      onRetry: () => {
        host.setState({ surveyCacheInitializationError: false, isSurveyCacheReady: false });
        void host.initializeSurveyCacheForGroup(sessionSlug, { background: false }).catch(() => undefined);
      },
    }),
  };
};

export const renderMainSiteSurveyResolutionStatus = ({
  host,
  sessionSlug,
  surveyId,
  surveyMissing,
  allowRegistryScan,
  isScanning,
  hasFailed,
  hasError,
}: {
  host: AppShell;
  sessionSlug: string;
  surveyId: string;
  surveyMissing: boolean;
  allowRegistryScan: boolean;
  isScanning: boolean;
  hasFailed: boolean;
  hasError: boolean;
}): React.ReactNode | null => {
  if (allowRegistryScan && surveyMissing && !hasFailed && !hasError && !isScanning) {
    host.queueSurveyGroupScan(surveyId, { hintedSlug: host.getSurveyRouteSessionSlugHint() });
  }
  if (allowRegistryScan && ((surveyMissing && !hasFailed && !hasError) || isScanning)) {
    const routeHintSlug = host.getSurveyRouteSessionSlugHint();
    const scanTargetLabel = routeHintSlug ? `session "${routeHintSlug}" first, then other sessions` : 'demo sessions';
    return (
      <MainSiteRouteStatusView
        heading="Resolving Survey Context..."
        message={`Scanning ${scanTargetLabel} for ID: ${surveyId.substring(0, 6)}...`}
        showSpinner={true}
      />
    );
  }
  if (hasError) {
    const message =
      String(host.state.scanErrorMessage || '').trim() || 'Survey metadata was found but could not be loaded.';
    return (
      <>
        <MainSiteRouteStatusView
          heading="Survey Load Error"
          message={message}
          actionLabel="Retry"
          onAction={() =>
            host.setState({ scanErrorFor: null, scanErrorMessage: '', scanFailedFor: null }, () =>
              host.queueSurveyGroupScan(surveyId, { hintedSlug: host.getSurveyRouteSessionSlugHint() }),
            )
          }
        />
        <BootRecoveryReady />
      </>
    );
  }
  if (hasFailed || (surveyMissing && !allowRegistryScan)) {
    return (
      <>
        <MainSiteRouteStatusView
          heading="Survey Not Found"
          message="This survey ID does not exist in any known session."
          actionLabel="Go Back"
          onAction={() => window.history.back()}
        />
        <BootRecoveryReady />
      </>
    );
  }
  return null;
};
