import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { Input } from 'reactstrap';

import { toStr } from '../../utilities/shared/primitives.js';
import {
  getContractExplainer,
  getSessionWizardContractModalTriggerTestId,
  getSessionWizardContractRowTestId,
  getSessionWizardContractTooltipTestId,
} from '../DocsPage/contractMetadata.js';
import ContractsSection from './ContractsSection';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';
import { formatContractLabel } from './sessionWizardCoreUtils';
import styles from './SessionWizard.module.scss';

type ContractRecord = Record<string, unknown>;

export type SessionWizardContractsFieldProps = {
  contracts?: ContractRecord | null;
  defaults?: ContractRecord | null;
  isCollapsed?: boolean;
  onAddressChange: (contractKey: string, address: string) => void;
  onOpenContractViewer: (contractKey: string) => void;
  onToggleCollapsed: () => void;
  renderInfoTooltip: (options?: SessionWizardTooltipRenderOptions) => React.ReactNode;
  title: string;
  visibleKeys?: string[] | null;
};

const getContractEntryAddress = (
  contractKey: string,
  contracts: ContractRecord | null | undefined,
  defaults: ContractRecord | null | undefined,
): string => {
  const entry =
    contracts?.[contractKey] && typeof contracts[contractKey] === 'object'
      ? (contracts[contractKey] as ContractRecord)
      : {};
  return toStr(entry.address || '').trim() || toStr(defaults?.[contractKey] || '').trim();
};

const SessionWizardContractsField = ({
  contracts = null,
  defaults = null,
  isCollapsed = false,
  onAddressChange,
  onOpenContractViewer,
  onToggleCollapsed,
  renderInfoTooltip,
  title,
  visibleKeys = [],
}: SessionWizardContractsFieldProps): React.ReactElement => (
  <ContractsSection
    title={title}
    contracts={contracts}
    defaults={defaults}
    visibleKeys={visibleKeys}
    isCollapsed={isCollapsed}
    onToggleCollapsed={onToggleCollapsed}
    toggleAriaLabel={`${title} ${isCollapsed ? 'expand' : 'collapse'}`}
    renderContractEntry={(contractKey, sectionContracts, sectionDefaults) => {
      const contractTooltipId = `gw-contract-tooltip-${contractKey}`;
      const contractLabel = formatContractLabel(contractKey);
      const address = getContractEntryAddress(contractKey, sectionContracts, sectionDefaults);
      return (
        <div
          key={contractKey}
          className={styles.contractRow}
          data-testid={getSessionWizardContractRowTestId(contractKey)}
        >
          <div className={styles.contractRowHeader}>
            <div className={styles.contractLabelActions}>
              <div className={styles.contractLabel}>{contractLabel}</div>
              <div className={styles.contractActions}>
                {renderInfoTooltip({
                  id: contractTooltipId,
                  content: getContractExplainer(contractKey),
                  placement: 'right',
                  testId: getSessionWizardContractTooltipTestId(contractKey),
                  ariaLabel: `${contractLabel} contract info`,
                })}
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.contractActionButton}`}
                  onClick={() => onOpenContractViewer(contractKey)}
                  aria-label={`Open ${contractLabel} contract details`}
                  title={`Open ${contractLabel} contract details`}
                  data-testid={getSessionWizardContractModalTriggerTestId(contractKey)}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </button>
              </div>
            </div>
          </div>
          <Input
            className={styles.contractInput}
            value={address}
            placeholder="0x..."
            onChange={(event) => onAddressChange(contractKey, event.target.value)}
          />
        </div>
      );
    }}
  />
);

export default SessionWizardContractsField;
