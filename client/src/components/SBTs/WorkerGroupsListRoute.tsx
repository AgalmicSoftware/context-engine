import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';

import WorkerSessionGroupsPanel from '../OnePageSession/WorkerSessionGroupsPanel';
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
import { buildPublicRoute, stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
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
  const sessionSlug = normalizeSessionSlug(props.sessionSlug || workerSessionConfig.slug || '');
  const configuredSessionName = String(workerSessionConfig.sessionName || '').trim();
  const querySessionName =
    typeof window !== 'undefined'
      ? String(new URLSearchParams(window.location.search).get('sessionName') || '')
          .trim()
          .slice(0, 160)
      : '';
  const sessionName = configuredSessionName || querySessionName || sessionSlug;
  const sessionHref = buildPublicRoute(`/session/${encodeURIComponent(sessionSlug)}`);
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
    if (![1, 2].includes(routeParts.length) || !['groups', 'sbts'].includes(routeRoot)) return;
    if (routeParts.length === 2 && routeSlug !== sessionSlug) return;
    const currentUrl = new URL(window.location.href);
    const canonicalPath = workerGroupNavigationPort.buildPath({
      groupId: workerGroupNavigationPort.readGroupIdFromHash(currentUrl.hash),
      rootPath: `/${routeRoot}`,
      sessionSlug,
    });
    const canonicalUrl = new URL(canonicalPath, currentUrl.origin);
    currentUrl.searchParams.forEach((value, key) => {
      if (key !== 'sessionName') canonicalUrl.searchParams.set(key, value);
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
  }, [sessionName, sessionSlug]);

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
        <>
          <section className={styles.workerRouteSessionHero} data-testid="ce-worker-groups-session-hero">
            <span className={styles.workerRouteSessionEyebrow}>Active session</span>
            <h1 className={styles.workerRouteSessionName}>
              <a href={sessionHref} aria-label={`Open session ${sessionName}`}>
                <span className={styles.workerRouteSessionNameText}>{sessionName}</span>
                <FontAwesomeIcon
                  aria-hidden="true"
                  className={styles.workerRouteSessionExternalIcon}
                  icon={faExternalLinkAlt}
                />
              </a>
            </h1>
          </section>
          <div className={styles.header}>
            <Button
              className={styles.createGroupButton}
              onClick={() => setShowWorkerCreate((visible) => !visible)}
              data-testid="ce-sbts-create-toggle"
            >
              <FontAwesomeIcon icon={faPlus} /> {showWorkerCreate ? 'Exit Group Creation' : 'Create Group'}
            </Button>
          </div>
        </>
      ) : null}
      <WorkerSessionGroupsPanel
        account={props.account}
        provider={props.provider}
        networkChainId={props.network?.chainId || props.network?.id || null}
        sessionConfig={workerSessionConfig}
        sessionName={sessionName}
        sessionSlug={sessionSlug}
        showCreate={showWorkerCreate}
        createOnly={false}
        selectedGroupId={selectedGroupId}
        toggleLoginModal={props.toggleLoginModal as ((open: boolean) => void) | undefined}
      />
    </div>
  );
};

export default WorkerGroupsListRoute;
