import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import DebateMap from '../DebateMap/DebateMap';
import ResultsBuildPanel from '../ResultsBuilds/ResultsBuildPanel';
import {
  buildDebateAtlasTree,
  buildSessionAtlasLink,
  buildSessionQuestionLink,
  debateAtlasBuildIdOf,
} from './debateAtlasTree';
import type { DebateAtlasBuild, DebateAtlasQuestionSummaries } from '../../domains/debateAtlas/debateAtlasTypes';
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
  /** Whether this viewer may build: only they are told how far the questions' AI summaries got. */
  canBuild?: boolean;
};

// For someone who may build again: how many questions got an AI summary and why the rest did not. Nothing for a
// build that summarised every question, or one from before builds made summaries.
export const questionSummariesNote = (counts: DebateAtlasQuestionSummaries | undefined): string => {
  const whole = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));
  const listed = whole(counts?.listed);
  const summarised = Math.min(listed, whole(counts?.summarised));
  if (!counts || listed === 0 || summarised === listed) return '';
  const outOfTime = whole(counts.outOfTime);
  const other = Math.max(0, listed - summarised - outOfTime);
  const reasons = [
    outOfTime ? `${outOfTime} ran out of time` : '',
    other ? `${other} failed or gave nothing usable` : '',
  ].filter(Boolean);
  return `AI summaries for ${summarised} of ${listed} questions${reasons.length ? `: ${reasons.join(', ')}` : ''}.`;
};

// A built atlas has topics, under each its subtopics, and under each of those its questions.
const LEVEL_LABELS = ['Topic', 'Subtopic', 'Question'];

// A built atlas replaces the demo atlas and the RxC topic circles: read-only
// circles whose topics and subtopics each open a compass of positions and participants.
export default function SessionDebateAtlasView({
  build,
  builds,
  onSelectBuild,
  sessionSlug,
  workerUrl = '',
  requestedNodeId = null,
  onRequestedNodeClose = null,
  canBuild = false,
}: Props) {
  const treeData = useMemo(() => buildDebateAtlasTree(build, { sessionSlug }), [build, sessionSlug]);
  const title = build.title || 'Atlas';
  const missing = build.missingTopics || [];
  const summariesNote = canBuild ? questionSummariesNote(build.questionSummaries) : '';
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
      label="Atlas"
      className={styles.atlas}
      build={build}
      builds={builds}
      onSelectBuild={(id) => {
        // Another version was picked, so a node a link asked for stays shut.
        onRequestedNodeClose?.();
        onSelectBuild(id);
      }}
      help="The session's AI built this from the responses at that moment. Open a topic or subtopic to see its compass: the positions found and where each participant sits."
    >
      {missing.length > 0 && (
        <p className={styles.notice} role="status">
          Not mapped this time: {missing.join(', ')}.
        </p>
      )}
      {summariesNote && (
        <p className={styles.notice} role="status" data-testid="ce-atlas-question-summaries-note">
          {summariesNote}
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
