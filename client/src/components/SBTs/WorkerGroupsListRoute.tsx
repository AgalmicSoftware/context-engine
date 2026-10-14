import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';

import WorkerSessionGroupsPanel from '../OnePageSession/WorkerSessionGroupsPanel';
import WorkerGroupsSessionSelector from './WorkerGroupsSessionSelector';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import { workerGroupNavigationPort } from '../../domains/worker/workerGroupNavigationPort';
import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection.js';
import { stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { buildSbtListRootClassName } from './sbtListHelpers';
import { isRecord } from './sbtListRuntimeValues';
import type { SBTsListProps, UnknownRecord } from './sbtListTypes';
import styles from './SBTsList.module.scss';

const resolveExactWorkerRouteConfig = (
  routeSlug: string,
  candidate: unknown,
  { allowImplicitSlug = false }: { allowImplicitSlug?: boolean } = {},
): UnknownRecord | null => {
  if (!routeSlug || !isRecord(candidate)) return null;
  const candidateSlug = normalizeSessionSlug(candidate.slug || candidate.sessionSlug || '');
  if (candidateSlug && candidateSlug !== routeSlug) return null;
  if (!candidateSlug && !allowImplicitSlug) return null;
  const exactCandidate = candidateSlug ? candidate : { ...candidate, slug: routeSlug };
  const projection = resolveSessionCapabilityProjection(exactCandidate);
  const isWorkerBoundary =
    (projection.source === 'profile' && projection.profileValid && projection.isWorkerCanonical) ||
    claimsWorkerCanonicalAuthority(exactCandidate);
  return isWorkerBoundary ? exactCandidate : null;
};

export const resolveSbtListWorkerRouteConfig = ({
  sessionConfig,
  sessionSlug,
}: Pick<SBTsListProps, 'sessionConfig' | 'sessionSlug'>): UnknownRecord | null => {
  const routeSlug = normalizeSessionSlug(sessionSlug || '');
  if (!routeSlug) return null;
  return (
    resolveExactWorkerRouteConfig(routeSlug, sessionConfig) ||
    resolveExactWorkerRouteConfig(routeSlug, getSessionConfigBySlug(routeSlug), { allowImplicitSlug: true }) ||
    resolveExactWorkerRouteConfig(routeSlug, getDemoSessionConfigBySlug(routeSlug, { allowDemoFallback: true }), {
      allowImplicitSlug: true,
    })
  );
};

type WorkerGroupsListRouteProps = {
  props: SBTsListProps;
  workerSessionConfig: UnknownRecord;
};

const WorkerGroupsListRoute = ({ props, workerSessionConfig }: WorkerGroupsListRouteProps) => {
  const [showWorkerCreate, setShowWorkerCreate] = useState(false);
  const [workerGroupsRefreshNonce, setWorkerGroupsRefreshNonce] = useState(0);
  const sessionSlug = normalizeSessionSlug(props.sessionSlug || workerSessionConfig.slug || '');
  const configuredSessionName = String(workerSessionConfig.sessionName || '').trim();
  const sessionName = configuredSessionName || sessionSlug;
  const selectedGroupId =
    String(props.selectedGroupId || '').trim() ||
    (typeof window !== 'undefined'
      ? workerGroupNavigationPort.readGroupIdFromPath(window.location.pathname) ||
        workerGroupNavigationPort.readGroupIdFromHash(window.location.hash)
      : '');

  useEffect(() => {
    if (!sessionSlug || !sessionName || typeof window === 'undefined') return;
    const routeParts = stripPublicUrlBasePath(window.location.pathname).split('/').filter(Boolean);
    let routeSlug = '';
    try {
      routeSlug = normalizeSessionSlug(decodeURIComponent(routeParts[1] || ''));
    } catch {
      routeSlug = '';
    }
    const routeRoot = String(routeParts[0] || '').toLowerCase();
    const isDetailRoute = routeRoot === 'group' && routeParts.length === 2;
    if (!isDetailRoute && (![1, 2].includes(routeParts.length) || !['groups', 'sbts'].includes(routeRoot))) return;
    if (!isDetailRoute && routeParts.length === 2 && routeSlug !== sessionSlug) return;
    const currentUrl = new URL(window.location.href);
    const canonicalPath = workerGroupNavigationPort.buildPath({
      groupId: isDetailRoute
        ? workerGroupNavigationPort.readGroupIdFromPath(currentUrl.pathname)
        : workerGroupNavigationPort.readGroupIdFromHash(currentUrl.hash),
      rootPath: `/${routeRoot}`,
      sessionSlug,
    });
    const canonicalUrl = new URL(canonicalPath, currentUrl.origin);
    currentUrl.searchParams.forEach((value, key) => {
      if (key !== 'sessionName' && key !== 'sessionSlug') canonicalUrl.searchParams.set(key, value);
    });
    if (
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` ===
      `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`
    ) {
      return;
    }
    window.history.replaceState(
      window.history.state,
      '',
      `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`,
    );
  }, [sessionName, sessionSlug, selectedGroupId]);

  const rootClassName = props.viewMode === 'modal' ? styles.modalViewContainer : styles.standardViewContainer;

  return (
    <div
      className={buildSbtListRootClassName({
        baseClassName: styles.standardBase,
        rootClassName,
      })}
      data-testid="ce-worker-groups-list-route"
    >
      {!props.embeddedMode && !selectedGroupId ? (
        <div className={styles.workerRouteToolbar}>
          <WorkerGroupsSessionSelector
            sessionSlug={sessionSlug}
            sessionName={sessionName}
            sessionConfig={workerSessionConfig}
          />
          <div className={styles.header}>
            <Button
              className={styles.createGroupButton}
              onClick={() => setShowWorkerCreate((visible) => !visible)}
              data-testid="ce-sbts-create-toggle"
            >
              <FontAwesomeIcon icon={faPlus} /> {showWorkerCreate ? 'Exit Group Creation' : 'Create Group'}
            </Button>
            <button
              type="button"
              className={styles.workerRouteRefreshButton}
              data-ce-control-appearance="frameless"
              aria-label="Refresh groups"
              title="Refresh groups"
              onClick={() => setWorkerGroupsRefreshNonce((nonce) => nonce + 1)}
            >
              <FontAwesomeIcon icon={faSyncAlt} />
            </button>
          </div>
        </div>
      ) : null}
      <WorkerSessionGroupsPanel
        account={props.account}
        provider={props.provider}
        networkChainId={props.network?.chainId || props.network?.id || null}
        sessionConfig={workerSessionConfig}
        sessionName={sessionName}
        sessionSlug={sessionSlug}
        refreshNonce={workerGroupsRefreshNonce}
        showCreate={showWorkerCreate}
        scrollToCreate={true}
        showMembershipListHeader={Boolean(props.embeddedMode)}
        createOnly={false}
        selectedGroupId={selectedGroupId}
        toggleLoginModal={props.toggleLoginModal as ((open: boolean) => void) | undefined}
      />
    </div>
  );
};

export default WorkerGroupsListRoute;
