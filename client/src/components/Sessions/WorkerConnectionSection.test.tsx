import React from 'react';
import { render, screen } from '@testing-library/react';
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
      />,
    );

    expect(screen.getByText('Worker URL appears here after a successful custom worker deploy.')).toBeInTheDocument();
  });

  it('renders the URL field and auto-fill badge when a custom worker URL is available', () => {
    const renderField = jest.fn(() => <div data-testid="mock-worker-url-field">Worker URL field</div>);

    render(
      <WorkerConnectionSection
        showWorkerUrlField
        displayedWorkerUrl="https://worker.example"
        renderField={renderField}
        workerUrlAutoFilled
        renderInfoTooltip={({ testId }) => <button type="button" data-testid={testId} />}
      />,
    );

    expect(renderField).toHaveBeenCalledWith('corsWorkerUrl', 'https://worker.example', [], { forceShow: true });
    expect(screen.getByTestId('mock-worker-url-field')).toBeInTheDocument();
    expect(screen.getByText('Auto-filled from deploy-helper')).toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-worker-autofill-tip')).toBeInTheDocument();
  });
});
