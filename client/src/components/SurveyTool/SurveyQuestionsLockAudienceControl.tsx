import React from 'react';
import type { CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faLock, faUnlock } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  buildSurveyQuestionsLockAudienceGateClassName,
  buildSurveyQuestionsLockAudiencePopoverClassName,
  buildSurveyQuestionsLockAudienceToggleClassName,
  resolveSurveyQuestionsIconGlowClassName,
} from './surveyQuestionsTypes.js';
import styles from './SurveyTool.module.scss';

type LockAudienceSbtItem = {
  address: string;
  href: string;
  label: React.ReactNode;
  meta: React.ReactNode;
};

type LockAudienceGateOption = {
  gateId: string;
  label: React.ReactNode;
  sbtItems?: LockAudienceSbtItem[];
};

type LockAudienceFieldState = {
  encrypted?: boolean;
};

type SurveyQuestionsLockAudienceControlProps = {
  qid: string;
  effectiveFieldKey: string;
  isPileVisualContext?: boolean;
  pileMenuPressed?: boolean;
  showBrightLockState?: boolean;
  isLockDisabled?: boolean;
  buttonTitle?: string;
  hasAudienceMenu?: boolean;
  menuOpen?: boolean;
  lockButtonStyle?: CSSProperties;
  fieldState?: LockAudienceFieldState | null;
  forcedGate?: unknown;
  gateOptions?: LockAudienceGateOption[];
  gateActive?: boolean;
  currentGateId?: string;
  selfActive?: boolean;
  plaintextActive?: boolean;
  followActive?: boolean;
  allowPlaintextOption?: boolean;
  normalizedSelfAudienceLabel?: React.ReactNode;
  expandedGateId?: string;
  showFollowOption?: boolean;
  onLockClick?: () => void;
  onSelectAudience?: (audience: string, gateId?: string) => void;
  onToggleGateDetails?: (qid: string, gateId: string, effectiveFieldKey: string) => void;
};

const SurveyQuestionsLockAudienceControl = ({
  qid,
  effectiveFieldKey,
  isPileVisualContext = false,
  pileMenuPressed = false,
  showBrightLockState = false,
  isLockDisabled = false,
  buttonTitle = '',
  hasAudienceMenu = false,
  menuOpen = false,
  lockButtonStyle,
  fieldState = null,
  forcedGate = null,
  gateOptions = [],
  gateActive = false,
  currentGateId = '',
  selfActive = false,
  plaintextActive = false,
  followActive = false,
  allowPlaintextOption = false,
  normalizedSelfAudienceLabel = '',
  expandedGateId = '',
  showFollowOption = false,
  onLockClick,
  onSelectAudience,
  onToggleGateDetails,
}: SurveyQuestionsLockAudienceControlProps): React.ReactElement => (
  <div className={styles.lockAudienceContainer}>
    <button
      type="button"
      className={[
        styles.iconButton,
        styles.lockButton,
        showBrightLockState ? styles.iconButtonActive : '',
        isPileVisualContext ? styles.pileLockButton : '',
        pileMenuPressed ? styles.pileLockButtonMenuOpen : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onLockClick}
      disabled={isLockDisabled}
      title={buttonTitle}
      aria-label={buttonTitle}
      aria-expanded={hasAudienceMenu ? menuOpen : undefined}
      aria-haspopup={hasAudienceMenu ? 'dialog' : undefined}
      style={lockButtonStyle}
      data-testid={
        effectiveFieldKey === 'additional' ? E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK : E2E_TESTIDS.SURVEY_ANSWER_LOCK
      }
    >
      <FontAwesomeIcon
        icon={fieldState?.encrypted || forcedGate ? faLock : faUnlock}
        className={resolveSurveyQuestionsIconGlowClassName(styles, showBrightLockState)}
      />
    </button>

    {hasAudienceMenu && menuOpen && !isLockDisabled && (
      <div className={buildSurveyQuestionsLockAudiencePopoverClassName(styles, isPileVisualContext)}>
        {allowPlaintextOption && (
          <button
            type="button"
            className={buildSurveyQuestionsLockAudienceToggleClassName(styles, plaintextActive)}
            onClick={() => onSelectAudience?.('none')}
            data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE}
          >
            <span className={styles.convictionToggleLabel}>Not encrypted</span>
          </button>
        )}
        <button
          type="button"
          className={buildSurveyQuestionsLockAudienceToggleClassName(styles, selfActive)}
          onClick={() => onSelectAudience?.('self')}
          data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF}
        >
          <span className={styles.convictionToggleLabel}>{normalizedSelfAudienceLabel}</span>
        </button>
        {gateOptions.map((option) => {
          const showGateDetails = expandedGateId === option.gateId;
          const sbtItems = Array.isArray(option.sbtItems) ? option.sbtItems : [];

          return (
            <React.Fragment key={`${qid}:${effectiveFieldKey}:${option.gateId}`}>
              <div className={styles.lockAudienceGateRow}>
                <button
                  type="button"
                  className={buildSurveyQuestionsLockAudienceGateClassName(
                    styles,
                    gateActive && currentGateId === option.gateId,
                  )}
                  onClick={() => onSelectAudience?.('gate', option.gateId)}
                  data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE}
                  data-ce-gate-id={option.gateId}
                >
                  <span className={styles.convictionToggleLabel}>{option.label}</span>
                </button>
                {sbtItems.length > 0 && (
                  <button
                    type="button"
                    className={styles.lockAudienceCaretButton}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleGateDetails?.(qid, showGateDetails ? '' : option.gateId, effectiveFieldKey);
                    }}
                    aria-expanded={showGateDetails}
                    aria-label={
                      showGateDetails ? `Hide ${option.label} ${t('sbts')}` : `Show ${option.label} ${t('sbts')}`
                    }
                  >
                    <FontAwesomeIcon icon={showGateDetails ? faCaretUp : faCaretDown} />
                  </button>
                )}
              </div>
              {showGateDetails && (
                <div className={styles.lockAudienceGateDetails}>
                  {sbtItems.map((item) => (
                    <a
                      key={`${option.gateId}:${item.address}`}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.lockAudienceGateDetailItem}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className={styles.lockAudienceGateDetailName}>{item.label}</span>
                      <span className={styles.lockAudienceGateDetailSbts}>{item.meta}</span>
                    </a>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
        {showFollowOption && (
          <button
            type="button"
            className={buildSurveyQuestionsLockAudienceToggleClassName(styles, followActive)}
            onClick={() => onSelectAudience?.('follow')}
            data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_FOLLOW}
          >
            <span className={styles.convictionToggleLabel}>Match Answer</span>
          </button>
        )}
      </div>
    )}
  </div>
);

export default SurveyQuestionsLockAudienceControl;
