import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerConnectionSection from './WorkerConnectionSection';

describe('WorkerConnectionSection', () => {
  it('shows the fallback helper text while no worker URL is available', () => {
    render(
      <WorkerConnectionSection
        showWorkerUrlField={false}
        displayedWorkerUrl=""
        renderField={() => null}
        workerUrlAutoFilled={false}
        renderInfoTooltip={() => null}
        showSharedWorkerChoice={false}
        onResetToDefault={() => {}}
      />,
    );

    expect(screen.getByText('Worker URL appears here after a successful custom worker deploy.')).toBeInTheDocument();
  });

  it('renders the URL field, auto-fill badge, and reset action when a custom worker URL is available', () => {
    const onResetToDefault = jest.fn();
    const renderField = jest.fn(() => <div data-testid="mock-worker-url-field">Worker URL field</div>);

    render(
      <WorkerConnectionSection
        showWorkerUrlField
        displayedWorkerUrl="https://worker.example"
        renderField={renderField}
        workerUrlAutoFilled
        renderInfoTooltip={({ testId }) => <button type="button" data-testid={testId} />}
        showSharedWorkerChoice
        onResetToDefault={onResetToDefault}
      />,
    );

    expect(renderField).toHaveBeenCalledWith('corsWorkerUrl', 'https://worker.example', [], { forceShow: true });
    expect(screen.getByTestId('mock-worker-url-field')).toBeInTheDocument();
    expect(screen.getByText('Auto-filled from deploy-helper')).toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-worker-autofill-tip')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(onResetToDefault).toHaveBeenCalledTimes(1);
  });
});
