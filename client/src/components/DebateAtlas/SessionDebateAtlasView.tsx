import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import DebateMap from '../DebateMap/DebateMap';
import ResultsBuildPanel from '../ResultsBuilds/ResultsBuildPanel';
import {
  buildDebateAtlasTree,
  buildSessionAtlasLink,
  buildSessionQuestionLink,
  debateAtlasBuildIdOf,
} from './debateAtlasTree';
import type { DebateAtlasBuild } from '../../domains/debateAtlas/debateAtlasTypes';
import type { ResultsBuildSummary } from '../../domains/resultsBuilds/resultsBuildWorkerClient';
import styles from './SessionDebateAtlasView.module.scss';

type Props = {
  build: DebateAtlasBuild;
  builds: ResultsBuildSummary[];
  onSelectBuild: (id: string) => void;
  sessionSlug: string;
  workerUrl?: string;
  /** A node a link asked for; its build is shown and the node opened. */
  requestedNodeId?: string | null;
  onRequestedNodeClose?: (() => void) | null;
};

// A built atlas has categories and, under each, topics.
const LEVEL_LABELS = ['Category', 'Topic'];

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
  const treeData = useMemo(() => buildDebateAtlasTree(build, { sessionSlug }), [build, sessionSlug]);
  const title = build.title || 'Debate atlas';
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
  const buildQuestionLink = useCallback(
    (questionId: string) => buildSessionQuestionLink({ questionId, sessionSlug, workerUrl }),
    [sessionSlug, workerUrl],
  );

  return (
    <ResultsBuildPanel
      kind="debate-atlas"
      label="Debate atlas"
      className={styles.atlas}
      build={build}
      builds={builds}
      onSelectBuild={(id) => {
        // Another version was picked, so a node a link asked for stays shut.
        onRequestedNodeClose?.();
        onSelectBuild(id);
      }}
      help="The session's AI built this from the responses at that moment. Open a category or topic to see its compass: the positions found and where each participant sits."
    >
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
          buildQuestionLink={buildQuestionLink}
          levelLabels={LEVEL_LABELS}
        />
      </div>
    </ResultsBuildPanel>
  );
}
