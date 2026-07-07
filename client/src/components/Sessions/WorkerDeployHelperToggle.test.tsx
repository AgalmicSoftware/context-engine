import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerDeployHelperToggle from './WorkerDeployHelperToggle';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

describe('WorkerDeployHelperToggle', () => {
  it('renders the embedded deploy-helper toggle with stable test hooks', () => {
    const onChange = jest.fn();

    render(
      <WorkerDeployHelperToggle
        checked
        onChange={onChange}
        renderInfoTooltip={({ testId }) => <button type="button" data-testid={testId} />}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED)).toBeChecked();
    expect(screen.getByText('Enable embedded deploy-helper on this worker')).toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-embedded-deploy-helper-tip')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
