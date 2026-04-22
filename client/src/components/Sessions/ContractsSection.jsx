/** @file ContractsSection.jsx */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';

const ContractsSection = ({
  title,
  variant = 'grid',
  contracts,
  defaults,
  visibleKeys,
  childNodes,
  emptyMessage = 'No contract defaults available for this chain.',
  isCollapsed,
  onToggleCollapsed,
  toggleAriaLabel,
  renderContractEntry,
}) => {
  const keys = Array.isArray(visibleKeys) ? visibleKeys : [];
  const children = Array.isArray(childNodes) ? childNodes : [];

  return (
    <div className={styles.objectGroup}>
      <div className={styles.objectHeader}>
        <div className={styles.objectTitle}>{title}</div>
        <button
          type="button"
          className={styles.objectToggle}
          onClick={onToggleCollapsed}
          {...(toggleAriaLabel ? { 'aria-label': toggleAriaLabel } : {})}
        >
          <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
        </button>
      </div>
      {!isCollapsed && variant === 'grid' && (
        <div className={styles.contractsGrid}>
          {keys.length ? keys.map((contractKey) => (
            renderContractEntry(contractKey, contracts, defaults)
          )) : (
            <div className={styles.helperText}>{emptyMessage}</div>
          )}
        </div>
      )}
      {!isCollapsed && variant === 'object' && (
        <div className={styles.objectBody}>
          {children.length ? children : (
            <div className={styles.helperText}>{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractsSection;
