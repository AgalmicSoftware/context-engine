import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faExclamationCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import type { SessionWizardPublishProgressDisplayState } from './sessionWizardPublishFlow';

type SessionPublishProgressPanelProps = {
  progressDisplayState: SessionWizardPublishProgressDisplayState;
};

const SessionPublishProgressPanel = ({
  progressDisplayState,
}: SessionPublishProgressPanelProps): React.ReactElement | null => {
  const {
    activePublishProgressStepLabel,
    publishProgressAriaValueText,
    publishProgressEyebrow,
    publishProgressPercent,
    publishProgressPercentRounded,
    publishProgressSteps,
    showPublishProgress,
  } = progressDisplayState;

  if (!showPublishProgress) return null;

  return (
    <div className={styles.publishProgressCard} data-testid="ce-wizard-publish-progress">
      <div className={styles.publishProgressHeader}>
        <div className={styles.publishProgressCopy}>
          <span className={styles.publishProgressEyebrow}>{publishProgressEyebrow}</span>
          <strong className={styles.publishProgressStage}>{activePublishProgressStepLabel || 'Preparing'}</strong>
        </div>
        <span className={styles.publishProgressPercent}>{publishProgressPercentRounded}%</span>
      </div>
      <div
        className={styles.publishProgressBar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={publishProgressPercentRounded}
        aria-valuetext={publishProgressAriaValueText}
      >
        <div className={styles.publishProgressFill} style={{ width: `${publishProgressPercent}%` }} />
      </div>
      <div className={styles.progressIndicator}>
        {publishProgressSteps.map((step) => {
          const isActive = step.state === 'active';
          const isComplete = step.state === 'complete';
          return (
            <div
              key={step.key}
              className={`${step.state !== 'pending' ? styles.stepCompleted : styles.step} ${isActive ? styles.stepActive : ''}`}
            >
              <FontAwesomeIcon
                icon={isActive ? faSpinner : isComplete ? faCheck : faExclamationCircle}
                spin={isActive}
              />
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionPublishProgressPanel;
