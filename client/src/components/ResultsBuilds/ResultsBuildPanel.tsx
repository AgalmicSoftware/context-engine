import React, { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import {
  RESULTS_BUILD_KINDS,
  type ResultsBuildKind,
  type ResultsBuildSummary,
} from '../../domains/resultsBuilds/resultsBuildWorkerClient';
import styles from './ResultsBuildPanel.module.scss';

type Props = {
  build: ResultsBuildSummary;
  builds: ResultsBuildSummary[];
  children: React.ReactNode;
  className?: string;
  /** What the "?" beside the title says the view is. */
  help: React.ReactNode;
  kind: ResultsBuildKind;
  /** The view's name, and its title when the build has none. */
  label: string;
  onSelectBuild: (id: string) => void;
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const formatBuiltAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// "8 Nov 2026, 14:05 · 512 responses · 47 participants"
const describeBuild = (build: ResultsBuildSummary): string => {
  const counts = build.counts || {};
  return [
    formatBuiltAt(build.builtAt),
    Number.isFinite(counts.responses) ? plural(Number(counts.responses), 'response') : '',
    Number.isFinite(counts.participants) ? plural(Number(counts.participants), 'participant') : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

// A built Results view: its title and what it is, when it was built and from
// how many responses, and a picker for the earlier builds the Worker keeps.
export default function ResultsBuildPanel({
  build,
  builds,
  children,
  className = '',
  help,
  kind,
  label,
  onSelectBuild,
}: Props) {
  const helpId = `${kind}-help-${useId().replace(/:/g, '')}`;
  const sampled = Number(build.counts?.aiResponses) < Number(build.counts?.responses);

  return (
    <section className={`${styles.panel} ${className}`} aria-label={label} data-testid={`ce-session-${kind}`}>
      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h3>{build.title || label}</h3>
            <button
              type="button"
              id={helpId}
              className={styles.help}
              data-ce-control-appearance="frameless"
              aria-label={`About this ${RESULTS_BUILD_KINDS[kind].name}`}
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            <CETooltip target={helpId} placement="bottom" trigger="hover focus" autohide={false}>
              {help}
              {sampled ? ` The AI read ${build.counts?.aiResponses} of the ${build.counts?.responses} responses.` : ''}
            </CETooltip>
          </div>
          <p className={styles.meta}>Built {describeBuild(build)}</p>
        </div>
        {/* Shown with one build too, so the time sits in the same place in every built view. */}
        <label className={styles.picker}>
          <span>Version</span>
          <select value={build.id} onChange={(event) => onSelectBuild(event.target.value)}>
            {builds.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {describeBuild(entry)}
              </option>
            ))}
          </select>
        </label>
      </header>
      {children}
    </section>
  );
}
