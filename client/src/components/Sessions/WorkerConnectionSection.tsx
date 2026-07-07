/** @file WorkerConnectionSection.tsx */
import React from 'react';
import { Button } from 'reactstrap';
import styles from './SessionWizard.module.scss';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';
import type { SessionWizardRenderField } from './sessionWizardFieldDescriptors';

type RenderInfoTooltip = (props: {
  id?: string;
  content?: React.ReactNode;
  placement?: SessionWizardTooltipRenderOptions['placement'];
  testId?: string;
  ariaLabel?: string;
}) => React.ReactNode;

export type WorkerConnectionSectionProps = {
  showWorkerUrlField: boolean;
  displayedWorkerUrl: string;
  renderField: SessionWizardRenderField;
  workerUrlAutoFilled: boolean;
  renderInfoTooltip?: RenderInfoTooltip;
  showSharedWorkerChoice: boolean;
  onResetToDefault: () => void;
};

const WorkerConnectionSection = ({
  showWorkerUrlField,
  displayedWorkerUrl,
  renderField,
  workerUrlAutoFilled,
  renderInfoTooltip,
  showSharedWorkerChoice,
  onResetToDefault,
}: WorkerConnectionSectionProps) => {
  const renderTooltip = typeof renderInfoTooltip === 'function' ? renderInfoTooltip : () => null;

  if (!showWorkerUrlField) {
    return <div className={styles.helperText}>Worker URL appears here after a successful custom worker deploy.</div>;
  }

  return (
    <div className={styles.corsFieldRow}>
      <div className={styles.corsFieldBlock}>
        {renderField('corsWorkerUrl', displayedWorkerUrl, [], { forceShow: true })}
        {workerUrlAutoFilled && (
          <div className={styles.corsFieldBadgeRow}>
            <div className={styles.corsFieldBadge}>Auto-filled from deploy-helper</div>
            {renderTooltip({
              id: 'gw-worker-autofill-tip',
              content: 'You can still edit this field manually if you want to point to a different worker.',
              placement: 'right',
              testId: 'ce-wizard-worker-tooltip-gw-worker-autofill-tip',
              ariaLabel: 'Auto-filled worker URL info',
            })}
          </div>
        )}
      </div>
      {showSharedWorkerChoice && (
        <Button type="button" className={styles.secondaryButton} onClick={onResetToDefault}>
          Reset to default
        </Button>
      )}
    </div>
  );
};

export default WorkerConnectionSection;
