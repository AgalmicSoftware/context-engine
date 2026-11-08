import React, { useId, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import DebateMap from '../DebateMap/DebateMap';
import CETooltip from '../Shared/CETooltip';
import { buildDebateAtlasTree, describeDebateAtlasBuild } from './debateAtlasTree';
import type { DebateAtlasBuild, DebateAtlasBuildSummary } from '../../domains/debateAtlas/debateAtlasTypes';
import styles from './SessionDebateAtlasView.module.scss';

type Props = {
  build: DebateAtlasBuild;
  builds: DebateAtlasBuildSummary[];
  onSelectBuild: (id: string) => void;
  sessionSlug: string;
};

// A built atlas replaces the demo atlas and the RxC topic circles: read-only
// circles whose topics each open a compass of positions and participants.
export default function SessionDebateAtlasView({ build, builds, onSelectBuild, sessionSlug }: Props) {
  const helpId = `debate-atlas-help-${useId().replace(/:/g, '')}`;
  const treeData = useMemo(() => buildDebateAtlasTree(build, { sessionSlug }), [build, sessionSlug]);
  const title = build.title || 'Debate atlas';
  const sampled = Number(build.counts?.aiResponses) < Number(build.counts?.responses);
  const missing = build.missingTopics || [];

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
              The session&apos;s AI built this from the responses at that moment. Open a topic to see its compass: the
              positions found and where each participant sits.
              {sampled ? ` The AI read ${build.counts?.aiResponses} of the ${build.counts?.responses} responses.` : ''}
            </CETooltip>
          </div>
          <p className={styles.meta}>Built {describeDebateAtlasBuild(build)}</p>
        </div>
        {builds.length > 1 && (
          <label className={styles.picker}>
            <span>Build</span>
            <select value={build.id} onChange={(event) => onSelectBuild(event.target.value)}>
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
        />
      </div>
    </section>
  );
}
