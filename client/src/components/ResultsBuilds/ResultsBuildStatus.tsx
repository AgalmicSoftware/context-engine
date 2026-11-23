import React, { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faQuestionCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

import AiPromptBox from '../Shared/AiPromptBox';
import { findPromptPlaceholders } from '../Shared/aiPromptPieces';
import CETooltip from '../Shared/CETooltip';
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
  // The reader's press lost its connection, and the build it may have started is being followed.
  dropped?: boolean;
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
    // Only a Worker that summarises each question's answers sends this one.
    { key: 'question', label: 'Question prompt', heading: 'Summarising, once per question' },
  ],
  'risk-matrix': [{ key: 'build', label: 'Building prompt', heading: 'Building, in one call' }],
};

// A running build: how long it has run, the model it calls and, on request,
// the prompts it sends, as the question generator shows its own. One live
// region carries the running build and then its failure, so the failure is read out.
export default function ResultsBuildStatus({
  busy,
  className = '',
  dropped = false,
  error = '',
  kind,
  nextBuild,
  startedAtMs,
}: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const id = useId().replace(/:/g, '');
  const promptId = `${kind}-prompt-${id}`;
  const droppedHelpId = `${kind}-dropped-help-${id}`;
  const { name } = RESULTS_BUILD_KINDS[kind];
  const model = busy ? nextBuild?.model || '' : '';
  const prompts = (busy && nextBuild?.prompts) || {};
  const sections = PROMPT_SECTIONS[kind].filter(({ key }) => prompts[key]);

  return (
    <div className={`${className} ${styles.status}`} data-testid={`ce-session-${kind}-status`}>
      <p role="status">
        {busy ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />{' '}
            <ElapsedLoadingLabel label={`Building the ${name}`} since={startedAtMs} />
            {dropped && (
              <>
                <br />
                Connection dropped. The build keeps running and appears here when done.
                <button
                  type="button"
                  id={droppedHelpId}
                  className={styles.help}
                  data-ce-control-appearance="frameless"
                  aria-label="About the dropped connection"
                  onClick={(event) => event.currentTarget.focus()}
                >
                  <FontAwesomeIcon icon={faQuestionCircle} />
                </button>
                <CETooltip target={droppedHelpId} placement="top" trigger="hover focus" autohide={false}>
                  A phone can cut a long request, for example when its screen locks or its network changes, while the
                  Worker builds on. This page checks every 20 seconds and when you come back to it, and says so if the
                  build stopped.
                </CETooltip>
              </>
            )}
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
                  <AiPromptBox
                    prompt={prompts[key]}
                    variables={findPromptPlaceholders(prompts[key], { described: true })}
                    title={null}
                  />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
