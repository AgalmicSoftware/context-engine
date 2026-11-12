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

type SetupHelpProps = {
  /** The control's id; the screen-reader copy is setupHelpId(id). */
  id: string;
  /** The control's label, for the "?" button's name. */
  label: string;
  help: string;
};

// The "?" beside a label, and the copy screen readers get with the control,
// which names setupHelpId(id) in aria-describedby. Tooltip ids are CSS
// selectors, so React's colons are dropped from them.
export const SetupHelp = ({ id, label, help }: SetupHelpProps): React.ReactElement => {
  const tooltipsEnabled = useSessionWizardTooltipPreference(useContext(ReactReduxContext)?.store ?? null);
  return (
    <>
      <SessionWizardInfoTooltip
        enabled={tooltipsEnabled}
        id={`${id.replace(/:/g, '')}-tip`}
        content={help}
        placement="top"
        ariaLabel={`About ${label}`}
      />
      <span id={setupHelpId(id)} className={styles.srOnly}>
        {help}
      </span>
    </>
  );
};

const helpLabel = (label: React.ReactNode) => (typeof label === 'string' ? label : 'this setting');

// Label first, then the input; explanations stay behind the "?" so labels
// stay short. The input names setupHelpId(id) in aria-describedby.
export const SetupField = ({ id, label, help = '', children }: SetupFieldProps): React.ReactElement => (
  <div className={styles.field}>
    <div className={styles.fieldLabelRow}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      {help ? <SetupHelp id={id} label={helpLabel(label)} help={help} /> : null}
    </div>
    {children}
  </div>
);

type SetupFactProps = {
  id: string;
  label: string;
  help: string;
  children: React.ReactNode;
  testId?: string;
};

// A setting another choice decides, shown as text with the same "?" help.
export const SetupFact = ({ id, label, help, children, testId }: SetupFactProps): React.ReactElement => (
  <div className={styles.field}>
    <div className={styles.fieldLabelRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <SetupHelp id={id} label={label} help={help} />
    </div>
    <p className={styles.fact} data-testid={testId}>
      {children}
    </p>
  </div>
);

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
}: SetupCheckProps): React.ReactElement => (
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
    {help ? <SetupHelp id={id} label={helpLabel(label)} help={help} /> : null}
  </div>
);

type SetupToggleProps = {
  id: string;
  label: string;
  help?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  testId?: string;
};

// A few choices side by side: one radio group, with the same "?" help as fields.
export const SetupToggle = ({
  id,
  label,
  help = '',
  value,
  options,
  onChange,
  testId,
}: SetupToggleProps): React.ReactElement => (
  <div className={styles.field}>
    <div className={styles.fieldLabelRow}>
      <span id={`${id}-label`} className={styles.fieldLabel}>
        {label}
      </span>
      {help ? <SetupHelp id={id} label={label} help={help} /> : null}
    </div>
    <div
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-describedby={help ? setupHelpId(id) : undefined}
      className={styles.toggle}
      data-testid={testId}
    >
      {options.map((option) => (
        <label key={option.value} className={styles.toggleOption}>
          <input
            type="radio"
            name={id}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  </div>
);

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
