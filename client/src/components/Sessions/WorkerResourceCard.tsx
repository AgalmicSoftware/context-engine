/** @file WorkerResourceCard.tsx */
import React from 'react';
import styles from './SessionWizard.module.scss';
import GateMultiSelectLock from '../Gates/GateMultiSelectLock';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type RenderInfoTooltip = (props: {
  id?: string;
  content?: React.ReactNode;
  placement?: string;
  testId?: string;
  ariaLabel?: string;
}) => React.ReactNode;

export type WorkerResourceCardProps = {
  resourceKey: string;
  label: string;
  tooltipText?: React.ReactNode;
  renderInfoTooltip?: RenderInfoTooltip;
  gateOptions?: unknown[];
  selectedGateIds?: string[];
  onChangeSelectedGateIds: (nextIds: unknown) => void;
  open: boolean;
  onToggleOpen: (nextOpen: boolean) => void;
  disabled: boolean;
  children?: React.ReactNode;
};

const WorkerResourceCard = ({
  resourceKey,
  label,
  tooltipText = '',
  renderInfoTooltip,
  gateOptions = [],
  selectedGateIds = [],
  onChangeSelectedGateIds,
  open,
  onToggleOpen,
  disabled,
  children = null,
}: WorkerResourceCardProps) => {
  const renderTooltip = typeof renderInfoTooltip === 'function'
    ? renderInfoTooltip
    : () => null;

  return (
    <div
      className={styles.gateCard}
      data-testid={E2E_TESTIDS.WIZARD_RESOURCE_CARD}
      data-ce-resource-key={resourceKey}
    >
      <div className={styles.gateHeader}>
        <div className={styles.gateTitleRow}>
          <div className={styles.gateTitle}>{label}</div>
          {renderTooltip({
            id: `gw-resource-secret-tip-${resourceKey}`,
            content: tooltipText,
            placement: 'right',
            testId: `ce-wizard-resource-tooltip-${resourceKey}`,
            ariaLabel: `${label} info`,
          })}
        </div>
        <GateMultiSelectLock
          gateOptions={gateOptions}
          selectedGateIds={selectedGateIds}
          onChangeSelectedGateIds={onChangeSelectedGateIds}
          open={open}
          onToggleOpen={onToggleOpen}
          disabled={disabled}
          showDots={false}
        />
      </div>
      <div className={styles.resourceFields}>
        {children}
      </div>
    </div>
  );
};

export default WorkerResourceCard;
