import React, { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faSpinner } from '@fortawesome/free-solid-svg-icons';

import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import type { DebateAtlasNextBuild } from '../../domains/debateAtlas/debateAtlasTypes';
import styles from './DebateAtlasBuildStatus.module.scss';

type Props = {
  busy: boolean;
  className?: string;
  error?: string;
  nextBuild: DebateAtlasNextBuild | null;
  startedAtMs: number | null;
};

// A running build: how long it has run, the model it calls and, on request,
// the prompts it sends, as the question generator shows its own. One live
// region carries the running build and then its failure, so the failure is read out.
export default function DebateAtlasBuildStatus({ busy, className = '', error = '', nextBuild, startedAtMs }: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const promptId = `debate-atlas-prompt-${useId().replace(/:/g, '')}`;
  const model = busy ? nextBuild?.model || '' : '';
  const { plan = '', map = '' } = (busy && nextBuild?.prompts) || {};

  return (
    <div className={`${className} ${styles.status}`} data-testid="ce-session-debate-atlas-status">
      <p role="status">
        {busy ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />{' '}
            <ElapsedLoadingLabel label="Building the atlas" since={startedAtMs} />
          </>
        ) : (
          error
        )}
      </p>
      {model && <p>AI model: {model}</p>}
      {(plan || map) && (
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
              {plan && (
                <section aria-label="Planning prompt">
                  <h4>Planning, once</h4>
                  <pre>{plan}</pre>
                </section>
              )}
              {map && (
                <section aria-label="Mapping prompt">
                  <h4>Mapping, once per topic and per category of several topics</h4>
                  <pre>{map}</pre>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
