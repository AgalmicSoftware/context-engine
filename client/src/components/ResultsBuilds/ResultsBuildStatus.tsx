import React, { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faSpinner } from '@fortawesome/free-solid-svg-icons';

import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import {
  RESULTS_BUILD_KINDS,
  type ResultsBuildKind,
  type ResultsBuildNextBuild,
} from '../../domains/resultsBuilds/resultsBuildWorkerClient';
import styles from './ResultsBuildStatus.module.scss';

type Props = {
  busy: boolean;
  className?: string;
  error?: string;
  kind: ResultsBuildKind;
  nextBuild: ResultsBuildNextBuild | null;
  startedAtMs: number | null;
};

// Each kind's prompts, in the order a build sends them.
const PROMPT_SECTIONS: Record<ResultsBuildKind, Array<{ key: string; label: string; heading: string }>> = {
  'debate-atlas': [
    { key: 'plan', label: 'Planning prompt', heading: 'Planning, once' },
    { key: 'map', label: 'Mapping prompt', heading: 'Mapping, once per topic and per category of several topics' },
  ],
};

// A running build: how long it has run, the model it calls and, on request,
// the prompts it sends, as the question generator shows its own. One live
// region carries the running build and then its failure, so the failure is read out.
export default function ResultsBuildStatus({ busy, className = '', error = '', kind, nextBuild, startedAtMs }: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const promptId = `${kind}-prompt-${useId().replace(/:/g, '')}`;
  const model = busy ? nextBuild?.model || '' : '';
  const prompts = (busy && nextBuild?.prompts) || {};
  const sections = PROMPT_SECTIONS[kind].filter(({ key }) => prompts[key]);

  return (
    <div className={`${className} ${styles.status}`} data-testid={`ce-session-${kind}-status`}>
      <p role="status">
        {busy ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />{' '}
            <ElapsedLoadingLabel label={`Building the ${RESULTS_BUILD_KINDS[kind].name}`} since={startedAtMs} />
          </>
        ) : (
          error
        )}
      </p>
      {model && <p>AI model: {model}</p>}
      {sections.length > 0 && (
        <>
          <button
            type="button"
            className={styles.toggle}
            data-ce-control-appearance="frameless"
            aria-expanded={showPrompt}
            aria-controls={promptId}
            onClick={() => setShowPrompt((open) => !open)}
          >
            {showPrompt ? 'Hide AI prompt' : 'Show AI prompt'}{' '}
            <FontAwesomeIcon icon={showPrompt ? faCaretUp : faCaretDown} aria-hidden="true" />
          </button>
          {showPrompt && (
            <div id={promptId} className={styles.prompts}>
              {sections.map(({ key, label, heading }) => (
                <section key={key} aria-label={label}>
                  <h4>{heading}</h4>
                  <pre>{prompts[key]}</pre>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
