/** @file LockableFieldFrame.tsx */
import React from 'react';
import { FormGroup, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faLockOpen, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import GateMultiSelectLock from '../Gates/GateMultiSelectLock';
import CETooltip from '../Shared/CETooltip';
import { toStr } from '../../utilities/shared/primitives.js';
import styles from './SessionWizard.module.scss';

type GateLockProps = React.ComponentProps<typeof GateMultiSelectLock>;

export type LockableFieldFrameProps = {
  label: React.ReactNode;
  tooltipText?: React.ReactNode;
  tooltipId?: string;
  tooltipPlacement?: React.ComponentProps<typeof CETooltip>['placement'];
  tooltipTestId?: string;
  tooltipAriaLabel?: string;
  tooltipsEnabled?: boolean;
  canLock?: boolean;
  isLocked?: boolean;
  onLockToggle?: React.MouseEventHandler<HTMLButtonElement>;
  lockTitle?: string;
  lockDisabled?: boolean;
  lockBadgeLabel?: React.ReactNode;
  lockBadgeStyle?: React.CSSProperties;
  lockIconStyle?: React.CSSProperties;
  gateLockProps?: GateLockProps | null;
  lockTrailingContent?: React.ReactNode;
  labelPrefix?: React.ReactNode;
  labelInlineControl?: React.ReactNode;
  fieldError?: React.ReactNode;
  children?: React.ReactNode;
};

const LockableFieldFrame = ({
  label,
  tooltipText = '',
  tooltipId = '',
  tooltipPlacement = 'right',
  tooltipTestId = '',
  tooltipAriaLabel = '',
  tooltipsEnabled = true,
  canLock = false,
  isLocked = false,
  onLockToggle,
  lockTitle = '',
  lockDisabled = false,
  lockBadgeLabel = '',
  lockBadgeStyle,
  lockIconStyle,
  gateLockProps = null,
  lockTrailingContent = null,
  labelPrefix = null,
  labelInlineControl = null,
  fieldError = '',
  children,
}: LockableFieldFrameProps) => {
  const normalizedTooltipText = toStr(tooltipText).trim();
  const tooltipControl =
    tooltipsEnabled && tooltipId && normalizedTooltipText ? (
      <>
        <span
          id={tooltipId}
          className={styles.tooltipTrigger}
          data-testid={tooltipTestId || undefined}
          role="button"
          tabIndex={0}
          aria-label={tooltipAriaLabel || `${label} info`}
        >
          <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} />
        </span>
        <CETooltip
          placement={tooltipPlacement}
          trigger="hover focus click"
          target={tooltipId}
          className={styles.tooltipBubble}
          delay={0}
          container="body"
        >
          {tooltipText}
        </CETooltip>
      </>
    ) : null;

  const labelControl = labelInlineControl ? (
    <label className={`${styles.fieldLabelRow} ${styles.fieldLabelRowCheckbox}`}>
      {labelInlineControl}
      <span className={styles.fieldLabelText}>{label}</span>
      {tooltipControl}
    </label>
  ) : (
    <div className={styles.fieldLabelRow}>
      {labelPrefix}
      <Label>{label}</Label>
      {tooltipControl}
    </div>
  );

  return (
    <FormGroup className={styles.fieldGroup}>
      <div className={styles.fieldHeader}>
        {labelControl}
        <div className={styles.fieldActions}>
          {canLock && (
            <div className={styles.lockMeta}>
              {lockBadgeLabel && (
                <span className={styles.lockBadge} style={lockBadgeStyle}>
                  {lockBadgeLabel}
                </span>
              )}
              {gateLockProps ? (
                <GateMultiSelectLock {...gateLockProps} />
              ) : (
                <button
                  type="button"
                  className={`${styles.lockButton} ${isLocked ? styles.locked : ''}`}
                  onClick={onLockToggle}
                  title={lockTitle}
                  disabled={!!lockDisabled}
                >
                  <FontAwesomeIcon icon={isLocked ? faLock : faLockOpen} style={lockIconStyle} />
                </button>
              )}
              {lockTrailingContent}
            </div>
          )}
        </div>
      </div>
      {children}
      {fieldError && <div className={styles.errorText}>{fieldError}</div>}
    </FormGroup>
  );
};

export default LockableFieldFrame;
