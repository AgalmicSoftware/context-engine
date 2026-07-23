import React, { Suspense } from 'react';

import type { AppShell } from './AppShell';
import RouteErrorBoundaryRaw from '../ErrorBoundary/RouteErrorBoundary';
import LazyFallbackRaw from '../Shared/LazyFallback';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { t } from '../../utilities/ui/terminology.js';
import { SBTsOverviewPage as SBTsOverviewPageRaw } from './routeLazyComponents.js';

type RouteComponent = React.ComponentType<Record<string, unknown>>;
type SbtCreateRouteContext = {
  fullPath: string;
  defaultSlug: string;
  defaultSessionCfg: Record<string, unknown> | null;
  defaultSessionNetwork: Record<string, unknown> | null | undefined;
};

const asRouteComponent = (component: unknown): RouteComponent => component as RouteComponent;
const LazyFallback = asRouteComponent(LazyFallbackRaw);
const RouteErrorBoundary = asRouteComponent(RouteErrorBoundaryRaw);
const SBTsOverviewPage = asRouteComponent(SBTsOverviewPageRaw);

export const renderMainSiteSbtCreateRoute = (host: AppShell, ctx: SbtCreateRouteContext): React.ReactNode => {
  const { fullPath, defaultSlug, defaultSessionCfg, defaultSessionNetwork } = ctx;
  return (
    <Suspense fallback={<LazyFallback label={`Loading Create ${t('sbt')}...`} />}>
      <RouteErrorBoundary resetKey={fullPath}>
        <div data-testid={E2E_TESTIDS.PAGE_SBTS_ROOT}>
          <SBTsOverviewPage
            provider={host.props.provider}
            account={host.props.account}
            litHooks={host.state.litHooks}
            network={defaultSessionNetwork}
            loginComplete={host.props.loginComplete}
            toggleLoginModal={host.props.toggleLoginModal}
            sessionSlug={defaultSlug || undefined}
            sessionConfig={defaultSessionCfg}
            isSBTCacheReady={host.state.isSBTCacheReady}
            sbtCacheRevision={host.state.sbtCacheRevision}
          />
        </div>
      </RouteErrorBoundary>
    </Suspense>
  );
};
