import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import type { SessionSetupConflict } from '../../../utilities/session/sessionModeRuleMessages';
import { setupSectionDomId, type SetupSectionKey } from './SetupPrimitives';
import styles from './SessionSetup.module.scss';

export type SetupCreateStage = 'idle' | 'sign-in' | 'deploy' | 'publish';

const STAGE_LABELS: Record<SetupCreateStage, string> = {
  idle: '',
  'sign-in': 'Confirm with your passkey to create the session…',
  deploy: 'Deploying your Session Worker…',
  publish: 'Saving the session…',
};

const SECTION_TITLES: Record<SessionSetupConflict['section'], string> = {
  results: 'Results visibility',
  access: 'Access and identity',
  hosting: 'Hosting and storage',
};

type SetupCreatePanelProps = {
  /** What still has to be filled in, in plain words. */
  missing: string[];
  conflicts: SessionSetupConflict[];
  stage: SetupCreateStage;
  busy: boolean;
  completed: boolean;
  onCreate: () => void;
  onCancel: () => void;
  progress?: React.ReactNode;
  settings?: React.ReactNode;
  results?: React.ReactNode;
};

const jumpTo = (section: SetupSectionKey) => {
  const element = typeof document === 'undefined' ? null : document.getElementById(setupSectionDomId(section));
  if (element && typeof element.scrollIntoView === 'function')
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Create stays blocked only while a conflict remains or a required input is
// empty. Signing in with a passkey is its confirmation.
const SetupCreatePanel = ({
  missing,
  conflicts,
  stage,
  busy,
  completed,
  onCreate,
  onCancel,
  progress = null,
  settings = null,
  results = null,
}: SetupCreatePanelProps): React.ReactElement => {
  const blocked = missing.length > 0 || conflicts.length > 0;
  const working = busy || stage !== 'idle';
  return (
    <section className={styles.section} aria-labelledby="ce-setup-create-title" data-testid="ce-setup-create">
      <h2 id="ce-setup-create-title" className={styles.sectionTitle}>
        Create
      </h2>
      {!completed && missing.length ? (
        <ul className={styles.hint} data-testid="ce-setup-missing">
          {missing.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : null}
      {!completed && conflicts.length ? (
        <div role="status" data-testid="ce-setup-conflicts">
          {conflicts.map((conflict) => (
            <p key={`${conflict.path}:${conflict.code}`} className={styles.conflict}>
              {conflict.message}{' '}
              <button type="button" className={styles.button} onClick={() => jumpTo(conflict.section)}>
                {SECTION_TITLES[conflict.section]}
              </button>
            </p>
          ))}
        </div>
      ) : null}
      {settings}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={`${styles.button} ${styles.primaryButton}`}
          disabled={completed || blocked || working}
          onClick={onCreate}
          data-testid={E2E_TESTIDS.WIZARD_PUBLISH}
        >
          {working ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" /> Creating…
            </>
          ) : completed ? (
            'Session created'
          ) : (
            'Create session'
          )}
        </button>
        {stage === 'sign-in' ? (
          <button type="button" className={styles.button} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      {stage !== 'idle' ? (
        <p className={styles.statusText} role="status" data-testid="ce-setup-create-stage">
          {STAGE_LABELS[stage]}
        </p>
      ) : null}
      {progress}
      {results}
    </section>
  );
};

export default SetupCreatePanel;
