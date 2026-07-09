/** @file CollapsibleFieldGroup.tsx */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';

export type CollapsibleFieldGroupProps = {
  title: React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
  className?: string;
  toggleAriaLabel: string;
};

const CollapsibleFieldGroup = ({
  title,
  isCollapsed,
  onToggleCollapsed,
  children,
  className = styles.objectGroup,
  toggleAriaLabel,
}: CollapsibleFieldGroupProps) => (
  <div className={className}>
    <div className={styles.objectHeader}>
      <div className={styles.objectTitle}>{title}</div>
      <button
        type="button"
        className={styles.objectToggle}
        aria-expanded={!isCollapsed}
        aria-label={toggleAriaLabel}
        onClick={onToggleCollapsed}
      >
        <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
      </button>
    </div>
    {!isCollapsed && <div className={styles.objectBody}>{children}</div>}
  </div>
);

export default CollapsibleFieldGroup;
