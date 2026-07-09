/** @file WorkerDeployHelperToggle.tsx */
import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';

type RenderInfoTooltip = (props: {
  id?: string;
  content?: React.ReactNode;
  placement?: SessionWizardTooltipRenderOptions['placement'];
  testId?: string;
  ariaLabel?: string;
}) => React.ReactNode;

export type WorkerDeployHelperToggleProps = {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  renderInfoTooltip?: RenderInfoTooltip;
};

const WorkerDeployHelperToggle = ({ checked, onChange, renderInfoTooltip }: WorkerDeployHelperToggleProps) => {
  const renderTooltip = typeof renderInfoTooltip === 'function' ? renderInfoTooltip : () => null;

  return (
    <FormGroup className={styles.bundleToggleGroup}>
      <Label className={styles.workerToggle}>
        <Input
          type="checkbox"
          checked={checked}
          data-testid={E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED}
          onChange={(e) => onChange(!!e.target.checked)}
        />
        <span>Enable embedded deploy-helper on this worker</span>
        {renderTooltip({
          id: 'gw-embedded-deploy-helper-tip',
          content:
            'Lets this session worker handle sponsored bootstrap deploys locally first. Turn it off to reduce surface area and force sponsored deploys to fall back to the standalone helper URL.',
          placement: 'right',
          testId: 'ce-wizard-worker-tooltip-gw-embedded-deploy-helper-tip',
          ariaLabel: 'Embedded deploy-helper info',
        })}
      </Label>
    </FormGroup>
  );
};

export default WorkerDeployHelperToggle;
