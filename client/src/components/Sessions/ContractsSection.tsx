/** @file ContractsSection.tsx */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';

type ContractRecord = Record<string, unknown>;

export type ContractsSectionProps = {
  title: React.ReactNode;
  variant?: 'grid' | 'object';
  contracts?: ContractRecord | null;
  defaults?: ContractRecord | null;
  visibleKeys?: string[] | null;
  childNodes?: React.ReactNode[] | null;
  emptyMessage?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapsed?: React.MouseEventHandler<HTMLButtonElement>;
  toggleAriaLabel?: string;
  renderContractEntry?: (
    contractKey: string,
    contracts: ContractRecord | null | undefined,
    defaults: ContractRecord | null | undefined,
  ) => React.ReactNode;
};

const ContractsSection = ({
  title,
  variant = 'grid',
  contracts = null,
  defaults = null,
  visibleKeys = [],
  childNodes = [],
  emptyMessage = 'No contract defaults available for this chain.',
  isCollapsed = false,
  onToggleCollapsed,
  toggleAriaLabel,
  renderContractEntry,
}: ContractsSectionProps) => {
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
          {keys.length ? (
            keys.map((contractKey) => renderContractEntry!(contractKey, contracts, defaults))
          ) : (
            <div className={styles.helperText}>{emptyMessage}</div>
          )}
        </div>
      )}
      {!isCollapsed && variant === 'object' && (
        <div className={styles.objectBody}>
          {children.length ? children : <div className={styles.helperText}>{emptyMessage}</div>}
        </div>
      )}
    </div>
  );
};

export default ContractsSection;
