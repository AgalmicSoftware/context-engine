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
  /** What the "?" says the view is. */
  help: React.ReactNode;
  kind: ResultsBuildKind;
  /** The view's name, for those who cannot see its tab. */
  label: string;
  onSelectBuild: (id: string) => void;
};

const plural = (count: number, word: string): string => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

const formatBuiltAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// "gpt-6.1 · 1,512 responses · 47 participants"
const describeBuild = (build: ResultsBuildSummary): string => {
  const counts = build.counts || {};
  return [
    build.model || '',
    Number.isFinite(counts.responses) ? plural(Number(counts.responses), 'response') : '',
    Number.isFinite(counts.participants) ? plural(Number(counts.participants), 'participant') : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

// A built Results view under one small header: the version picked, with its
// model and counts beneath, and what the view is behind a "?". The tab names the view.
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
        {/* Shown with one build too, so the time sits in the same place in every built view. */}
        <label className={styles.picker}>
          <span>Version</span>
          <select value={build.id} onChange={(event) => onSelectBuild(event.target.value)}>
            {builds.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {formatBuiltAt(entry.builtAt) || entry.id}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.meta}>
          <span>{describeBuild(build)}</span>
          <button
            type="button"
            id={helpId}
            className={styles.help}
            data-ce-control-appearance="frameless"
            aria-label={`About this ${RESULTS_BUILD_KINDS[kind].name}`}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
        </p>
        <CETooltip target={helpId} placement="bottom" trigger="hover focus" autohide={false}>
          {help}
          {sampled ? ` The AI read ${build.counts?.aiResponses} of the ${build.counts?.responses} responses.` : ''}
        </CETooltip>
      </header>
      {children}
    </section>
  );
}
