import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faExternalLinkAlt, faLock, faSpinner } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { t } from '../../utilities/ui/terminology.js';
import styles from './SurveyTool.module.scss';

type LockedQuestionGateSbt = {
  address: string;
  href: string;
  label: React.ReactNode;
};

export type LockedQuestionGateDetail = {
  id: string;
  label?: React.ReactNode;
  questionCount: number;
  sbts: LockedQuestionGateSbt[];
};

type SurveyQuestionsLockedQuestionsPanelProps = {
  hiddenMaskedQuestionIds?: string[];
  lockedGateDetails?: LockedQuestionGateDetail[];
  title?: string;
  subtitle?: React.ReactNode;
  forceExpanded?: boolean;
  surface?: string;
  showCaret?: boolean;
  bulkPromptReloading?: boolean;
  lockedGateDetailsExpanded?: boolean;
  onDecrypt?: (questionIds: string[]) => void;
  onToggleDetails?: () => void;
};

type RequiredSbtLinkItem = {
  key: string;
  href: string;
  label: React.ReactNode;
  labelText: string;
};

const nodeToText = (value: React.ReactNode): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
};

const collectRequiredSbtLinks = (lockedGateDetails: LockedQuestionGateDetail[] = []): RequiredSbtLinkItem[] => {
  const out: RequiredSbtLinkItem[] = [];
  const seen = new Set<string>();
  (Array.isArray(lockedGateDetails) ? lockedGateDetails : []).forEach((gate) => {
    (Array.isArray(gate?.sbts) ? gate.sbts : []).forEach((sbt) => {
      const href = String(sbt?.href || '').trim();
      const address = String(sbt?.address || '').trim();
      const labelText = nodeToText(sbt?.label) || address;
      if (!href || !labelText) return;
      const key = `${address.toLowerCase()}|${href}|${labelText.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        key,
        href,
        label: sbt?.label || labelText,
        labelText,
      });
    });
  });
  return out;
};

const buildRequirementText = (items: RequiredSbtLinkItem[]): string => {
  if (!items.length) return '';
  const labels = items.map((item) => item.labelText);
  const shown = labels.slice(0, 3);
  const extra = labels.length > shown.length ? ` +${labels.length - shown.length} more` : '';
  return `${t('sbt')}${labels.length === 1 ? '' : 's'} required: ${shown.join(', ')}${extra}.`;
};

const renderRequirementLinks = (items: RequiredSbtLinkItem[]): React.ReactNode => {
  if (!items.length) return null;
  const shown = items.slice(0, 3);
  const extra = items.length > shown.length ? ` +${items.length - shown.length} more` : '';
  return (
    <>
      {t('sbt')}
      {items.length === 1 ? '' : 's'} required:{' '}
      {shown.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? ', ' : null}
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.lockedSbtInlineLink}
            aria-label={`Open ${t('sbt')} ${item.labelText}`}
          >
            {item.label}
          </a>
        </React.Fragment>
      ))}
      {extra}.
    </>
  );
};

const renderLinkedSubtitle = ({
  lockedGateDetails,
  subtitle,
}: {
  lockedGateDetails: LockedQuestionGateDetail[];
  subtitle: React.ReactNode;
}): React.ReactNode => {
  if (typeof subtitle !== 'string') return subtitle;
  const items = collectRequiredSbtLinks(lockedGateDetails);
  const requirementText = buildRequirementText(items);
  if (!requirementText || !subtitle.startsWith(requirementText)) return subtitle;
  const rest = subtitle.slice(requirementText.length);
  return (
    <>
      {renderRequirementLinks(items)}
      {rest}
    </>
  );
};

const SurveyQuestionsLockedQuestionsPanel = ({
  hiddenMaskedQuestionIds = [],
  lockedGateDetails = [],
  title = '',
  subtitle = '',
  forceExpanded = false,
  surface = 'light',
  showCaret = true,
  bulkPromptReloading = false,
  lockedGateDetailsExpanded = false,
  onDecrypt,
  onToggleDetails,
}: SurveyQuestionsLockedQuestionsPanelProps): React.ReactElement | null => {
  const hiddenCount = Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds.length : 0;
  if (hiddenCount <= 0) return null;

  const resolvedTitle = title || `${hiddenCount} Locked Question${hiddenCount === 1 ? '' : 's'}`;
  const canToggleLockedDetails = lockedGateDetails.length > 0 && showCaret;
  const showLockedGateDetails = forceExpanded || (!!lockedGateDetailsExpanded && canToggleLockedDetails);
  const bannerClassName =
    [styles.lockedQuestionsBanner, surface === 'dark' ? styles.lockedQuestionsBannerOnDark : '']
      .filter(Boolean)
      .join(' ') || undefined;
  const renderedSubtitle = subtitle ? renderLinkedSubtitle({ lockedGateDetails, subtitle }) : null;

  return (
    <div className={bannerClassName} role="status" data-testid={E2E_TESTIDS.SURVEY_LOCKED_BANNER}>
      <div className={styles.lockedQuestionsBackdrop}>
        <FontAwesomeIcon icon={faLock} />
      </div>
      <div className={styles.lockedQuestionsHeader}>
        <div className={styles.lockedQuestionsCopy}>
          <div className={styles.lockedQuestionsTitle}>{resolvedTitle}</div>
          {renderedSubtitle ? <div className={styles.lockedQuestionsSubtext}>{renderedSubtitle}</div> : null}
        </div>
        <div className={styles.lockedQuestionsAction}>
          <button
            type="button"
            className={styles.lockedQuestionsDecryptButton}
            onClick={() => onDecrypt?.(hiddenMaskedQuestionIds)}
            disabled={!!bulkPromptReloading}
            data-testid={E2E_TESTIDS.SURVEY_LOCKED_DECRYPT}
          >
            {bulkPromptReloading ? (
              <span className={styles.lockedQuestionsDecryptLoading}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Decrypting...</span>
              </span>
            ) : (
              'Decrypt'
            )}
          </button>
        </div>
      </div>
      {showLockedGateDetails && (
        <div className={styles.lockedQuestionsDetails}>
          {lockedGateDetails.map((gate) => (
            <div key={gate.id} className={styles.lockedGateDetailCard}>
              <div className={styles.lockedGateDetailHeader}>
                <span className={styles.lockedGateDetailName}>{gate.label || t('gate')}</span>
                <span className={styles.lockedGateDetailCount}>
                  {gate.questionCount} question{gate.questionCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className={styles.lockedGateSbtList}>
                {gate.sbts.map((sbt) => (
                  <a
                    key={`${gate.id}:${sbt.address}`}
                    href={sbt.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.lockedSbtCard}
                  >
                    <span className={styles.lockedSbtName}>{sbt.label}</span>
                    <span className={styles.lockedSbtMeta}>required to view</span>
                    <FontAwesomeIcon icon={faExternalLinkAlt} className={styles.lockedSbtLinkIcon} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {canToggleLockedDetails ? (
        <button
          type="button"
          className={styles.lockedQuestionsCaretButton}
          onClick={onToggleDetails}
          aria-expanded={showLockedGateDetails}
          aria-label={showLockedGateDetails ? `Hide ${t('gateLower')} details` : `Show ${t('gateLower')} details`}
          data-testid={E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET}
        >
          <FontAwesomeIcon icon={showLockedGateDetails ? faCaretUp : faCaretDown} />
        </button>
      ) : null}
    </div>
  );
};

export default SurveyQuestionsLockedQuestionsPanel;
