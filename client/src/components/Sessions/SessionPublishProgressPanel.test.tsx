import React from 'react';
import { render, screen, within } from '@testing-library/react';

import SessionPublishProgressPanel from './SessionPublishProgressPanel';

describe('SessionPublishProgressPanel', () => {
  it('renders active publish progress from the display descriptor', () => {
    render(
      <SessionPublishProgressPanel
        publishBusy={true}
        progressDisplayState={{
          activePublishProgressStepLabel: 'Upload Arweave',
          publishStep: 2,
          publishProgressPercent: 42.4,
          publishProgressPercentRounded: 42,
          publishProgressSteps: [
            { key: 'deploy-worker', label: 'Deploy Worker' },
            { key: 'upload-metadata', label: 'Upload Arweave' },
            { key: 'register-session', label: 'Register On-chain' },
          ],
          showPublishProgress: true,
        }}
      />
    );

    const progressCard = screen.getByTestId('ce-wizard-publish-progress');
    expect(progressCard).toHaveTextContent('Publishing Session');
    expect(within(progressCard).getAllByText('Upload Arweave')).toHaveLength(2);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '42% Upload Arweave');
  });

  it('renders completed publish progress and hides when descriptor says hidden', () => {
    const { rerender } = render(
      <SessionPublishProgressPanel
        publishBusy={false}
        progressDisplayState={{
          activePublishProgressStepLabel: 'Done',
          publishStep: 3,
          publishProgressPercent: 100,
          publishProgressPercentRounded: 100,
          publishProgressSteps: [
            { key: 'upload-metadata', label: 'Upload Arweave' },
            { key: 'register-session', label: 'Register On-chain' },
            { key: 'done', label: 'Done' },
          ],
          showPublishProgress: true,
        }}
      />
    );

    expect(screen.getByTestId('ce-wizard-publish-progress')).toHaveTextContent('Publish Complete');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    rerender(
      <SessionPublishProgressPanel
        publishBusy={false}
        progressDisplayState={{
          activePublishProgressStepLabel: '',
          publishStep: 0,
          publishProgressPercent: 0,
          publishProgressPercentRounded: 0,
          publishProgressSteps: [],
          showPublishProgress: false,
        }}
      />
    );

    expect(screen.queryByTestId('ce-wizard-publish-progress')).not.toBeInTheDocument();
  });
});
