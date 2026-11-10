import React, { useContext } from 'react';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { ReactReduxContext } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import SessionWizardInfoTooltip from '../SessionWizardInfoTooltip';
import useSessionWizardTooltipPreference from '../hooks/useSessionWizardTooltipPreference';
import type { SessionSetupConflict } from '../../../utilities/session/sessionModeRuleMessages';
import styles from './SessionSetup.module.scss';

export type SetupSectionKey =
  'basics' | 'context' | 'questions' | 'participation' | 'results' | 'access' | 'hosting' | 'ai';

export const setupSectionDomId = (key: SetupSectionKey) => `ce-setup-${key}`;
/** The screen-reader copy of a field's "?" help; inputs name it in aria-describedby. */
export const setupHelpId = (fieldId: string) => `${fieldId}-help`;

type SetupSectionProps = {
  sectionKey: SetupSectionKey;
  title: string;
  /** The section's current settings in one line, shown under the title. */
  summary?: React.ReactNode;
  /** Basics only: no More button and no summary. */
  alwaysOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  conflictCount?: number;
  /** Inputs that stay visible while the section is closed (the quick path's). */
  quick?: React.ReactNode;
  children?: React.ReactNode;
};

export const SetupSection = ({
  sectionKey,
  title,
  summary = null,
  alwaysOpen = false,
  open = false,
  onToggle,
  conflictCount = 0,
  quick = null,
  children = null,
}: SetupSectionProps): React.ReactElement => {
  const domId = setupSectionDomId(sectionKey);
  const expanded = alwaysOpen || open;
  return (
    <section
      id={domId}
      className={styles.section}
      aria-labelledby={`${domId}-title`}
      data-testid={`${E2E_TESTIDS.SETUP_SECTION_PREFIX}${sectionKey}`}
    >
      <div className={styles.sectionHeader}>
        <h2 id={`${domId}-title`} className={styles.sectionTitle}>
          {title}
        </h2>
        {!alwaysOpen && children ? (
          <button
            type="button"
            className={styles.moreButton}
            aria-expanded={expanded}
            aria-controls={`${domId}-more`}
            onClick={onToggle}
            data-testid={`${E2E_TESTIDS.SETUP_MORE_PREFIX}${sectionKey}`}
          >
            <FontAwesomeIcon icon={expanded ? faCaretUp : faCaretDown} aria-hidden="true" />
            {expanded ? 'Less' : 'More'}
          </button>
        ) : null}
      </div>
      {!alwaysOpen && summary ? (
        <p className={styles.sectionSummary} data-testid={`${E2E_TESTIDS.SETUP_SUMMARY_PREFIX}${sectionKey}`}>
          {summary}
          {conflictCount ? (
            <span className={styles.conflictBadge}>
              {conflictCount === 1 ? '1 conflict' : `${conflictCount} conflicts`}
            </span>
          ) : null}
        </p>
      ) : null}
      {quick ? <div className={styles.sectionQuick}>{quick}</div> : null}
      {expanded && children ? (
        <div id={`${domId}-more`} className={styles.sectionBody}>
          {children}
        </div>
      ) : null}
    </section>
  );
};

type SetupFieldProps = {
  /** The input's id; its label points at it. */
  id: string;
  label: React.ReactNode;
  /** Short explanation behind the "?" (and read by screen readers). */
  help?: string;
  children: React.ReactNode;
};

// Label first, then the input; explanations stay behind the "?" so labels
// stay short. The input names setupHelpId(id) in aria-describedby.
export const SetupField = ({ id, label, help = '', children }: SetupFieldProps): React.ReactElement => {
  const tooltipsEnabled = useSessionWizardTooltipPreference(useContext(ReactReduxContext)?.store ?? null);
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabelRow}>
        <label htmlFor={id} className={styles.fieldLabel}>
          {label}
        </label>
        {help ? (
          <SessionWizardInfoTooltip
            enabled={tooltipsEnabled}
            id={`${id}-tip`}
            content={help}
            placement="top"
            ariaLabel={typeof label === 'string' ? `About ${label}` : 'About this setting'}
          />
        ) : null}
      </div>
      {children}
      {help ? (
        <span id={setupHelpId(id)} className={styles.srOnly}>
          {help}
        </span>
      ) : null}
    </div>
  );
};

type SetupCheckProps = {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
  disabled?: boolean;
  testId?: string;
};

// A checkbox whose label follows it, with the same "?" help as fields.
export const SetupCheck = ({
  id,
  label,
  checked,
  onChange,
  help = '',
  disabled = false,
  testId,
}: SetupCheckProps): React.ReactElement => {
  const tooltipsEnabled = useSessionWizardTooltipPreference(useContext(ReactReduxContext)?.store ?? null);
  return (
    <div className={styles.checkRow}>
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={help ? setupHelpId(id) : undefined}
          data-testid={testId}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {help ? (
        <>
          <SessionWizardInfoTooltip
            enabled={tooltipsEnabled}
            id={`${id}-tip`}
            content={help}
            placement="top"
            ariaLabel={typeof label === 'string' ? `About ${label}` : 'About this setting'}
          />
          <span id={setupHelpId(id)} className={styles.srOnly}>
            {help}
          </span>
        </>
      ) : null}
    </div>
  );
};

// The rules table's plain messages for the conflicts at one option.
export const SetupConflicts = ({ conflicts }: { conflicts: SessionSetupConflict[] }): React.ReactElement | null =>
  conflicts.length ? (
    <div role="status">
      {conflicts.map((conflict) => (
        <p
          key={`${conflict.path}:${conflict.code}`}
          className={styles.conflict}
          data-testid={`${E2E_TESTIDS.SETUP_CONFLICT_PREFIX}${conflict.code}`}
        >
          {conflict.message}
        </p>
      ))}
    </div>
  ) : null;
