import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import DebateMap from '../DebateMap/DebateMap';
import CETooltip from '../Shared/CETooltip';
import {
  buildDebateAtlasTree,
  buildSessionAtlasLink,
  debateAtlasBuildIdOf,
  describeDebateAtlasBuild,
} from './debateAtlasTree';
import type { DebateAtlasBuild, DebateAtlasBuildSummary } from '../../domains/debateAtlas/debateAtlasTypes';
import styles from './SessionDebateAtlasView.module.scss';

type Props = {
  build: DebateAtlasBuild;
  builds: DebateAtlasBuildSummary[];
  onSelectBuild: (id: string) => void;
  sessionSlug: string;
  workerUrl?: string;
  /** A node a link asked for; its build is shown and the node opened. */
  requestedNodeId?: string | null;
  onRequestedNodeClose?: (() => void) | null;
};

// A built atlas replaces the demo atlas and the RxC topic circles: read-only
// circles whose categories and topics each open a compass of positions and participants.
export default function SessionDebateAtlasView({
  build,
  builds,
  onSelectBuild,
  sessionSlug,
  workerUrl = '',
  requestedNodeId = null,
  onRequestedNodeClose = null,
}: Props) {
  const helpId = `debate-atlas-help-${useId().replace(/:/g, '')}`;
  const treeData = useMemo(() => buildDebateAtlasTree(build, { sessionSlug }), [build, sessionSlug]);
  const title = build.title || 'Debate atlas';
  const sampled = Number(build.counts?.aiResponses) < Number(build.counts?.responses);
  const missing = build.missingTopics || [];
  const requestedBuildId = requestedNodeId ? debateAtlasBuildIdOf(requestedNodeId) : '';
  const requestedBuildKept = builds.some((entry) => entry.id === requestedBuildId);

  // A link to a node of an earlier build shows that build, once, so the reader can still pick another.
  const switchedFor = useRef('');
  useEffect(() => {
    if (!requestedNodeId || switchedFor.current === requestedNodeId) return;
    switchedFor.current = requestedNodeId;
    if (requestedBuildId !== build.id && requestedBuildKept) onSelectBuild(requestedBuildId);
  }, [build.id, onSelectBuild, requestedBuildId, requestedBuildKept, requestedNodeId]);

  const buildNodeLink = useCallback(
    (nodeId: string) => buildSessionAtlasLink({ nodeId, sessionSlug, workerUrl }),
    [sessionSlug, workerUrl],
  );

  return (
    <section className={styles.atlas} aria-label="Debate atlas" data-testid="ce-session-debate-atlas">
      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h3>{title}</h3>
            <button
              type="button"
              id={helpId}
              className={styles.help}
              data-ce-control-appearance="frameless"
              aria-label="About this atlas"
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            <CETooltip target={helpId} placement="bottom" trigger="hover focus" autohide={false}>
              The session&apos;s AI built this from the responses at that moment. Open a category or topic to see its
              compass: the positions found and where each participant sits.
              {sampled ? ` The AI read ${build.counts?.aiResponses} of the ${build.counts?.responses} responses.` : ''}
            </CETooltip>
          </div>
          <p className={styles.meta}>Built {describeDebateAtlasBuild(build)}</p>
        </div>
        {builds.length > 1 && (
          <label className={styles.picker}>
            <span>Build</span>
            <select
              value={build.id}
              onChange={(event) => {
                // Another build was picked, so a node a link asked for stays shut.
                onRequestedNodeClose?.();
                onSelectBuild(event.target.value);
              }}
            >
              {builds.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {describeDebateAtlasBuild(entry)}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {missing.length > 0 && (
        <p className={styles.notice} role="status">
          Not mapped this time: {missing.join(', ')}.
        </p>
      )}
      <div className={styles.canvas}>
        <DebateMap
          key={build.id}
          treeData={treeData}
          readOnly
          hideDemoModeToggle
          atlasRootLabel={title}
          atlasLayoutMode="packed"
          embedded
          activeSessionSlug={sessionSlug}
          requestedModalNodeId={requestedBuildId === build.id ? requestedNodeId : null}
          onModalClose={onRequestedNodeClose}
          buildNodeLink={buildNodeLink}
        />
      </div>
    </section>
  );
}
