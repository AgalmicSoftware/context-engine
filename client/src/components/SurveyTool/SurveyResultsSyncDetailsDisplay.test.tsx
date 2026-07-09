import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsSyncDetailsDisplay from './SurveyResultsSyncDetailsDisplay';
import type { SurveyResultsSyncStatusDisplayPlan } from './surveyResultsSyncStatusController';

const buildSyncStatusDisplay = (
  overrides: Partial<SurveyResultsSyncStatusDisplayPlan> = {},
): SurveyResultsSyncStatusDisplayPlan => ({
  isSynced: false,
  isSyncingOrLoading: true,
  syncStatusText: 'Syncing...',
  showLongSyncNotice: false,
  showQuickRefresh: true,
  viewMode: 'questions',
  question: {
    color: 'info',
    label: 'Remaining Blocks: 12',
    progress: 40,
    remainingBlocks: 12,
    showRemainingSpinner: true,
    showSpinner: false,
  },
  response: {
    color: 'success',
    label: 'In Sync (Current: 20 / Latest: 20)',
    progress: 100,
    remainingBlocks: 0,
    showRemainingSpinner: false,
    showSpinner: false,
  },
  ...overrides,
});

const baseProps = {
  miniBarSpinnerStyle: { width: 12 },
  miniProgressStyle: { height: 6 },
  remainingSpinnerStyle: { marginLeft: 4 },
  syncDetailsStyle: { display: 'block' },
};

describe('SurveyResultsSyncDetailsDisplay', () => {
  it('renders question and response track descriptors without refreshing', () => {
    const onManualRefresh = jest.fn();

    render(
      <SurveyResultsSyncDetailsDisplay
        {...baseProps}
        onManualRefresh={onManualRefresh}
        syncStatusDisplay={buildSyncStatusDisplay()}
      />,
    );

    expect(screen.getByText('Questions:')).toBeInTheDocument();
    expect(screen.getByText('Responses:')).toBeInTheDocument();
    expect(screen.getByText(/Remaining Blocks: 12/)).toBeInTheDocument();
    expect(screen.getByText('In Sync (Current: 20 / Latest: 20)')).toBeInTheDocument();
    expect(onManualRefresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Refresh Data from Cache/Chain'));
    expect(onManualRefresh).toHaveBeenCalledTimes(1);
  });

  it('hides question track rows outside question view and shows passive loading labels', () => {
    render(
      <SurveyResultsSyncDetailsDisplay
        {...baseProps}
        onManualRefresh={jest.fn()}
        syncStatusDisplay={buildSyncStatusDisplay({
          viewMode: 'survey',
          response: {
            color: 'info',
            label: '',
            progress: 0,
            remainingBlocks: 0,
            showRemainingSpinner: false,
            showSpinner: true,
          },
        })}
      />,
    );

    expect(screen.queryByText('Questions:')).not.toBeInTheDocument();
    expect(screen.getByText('Responses:')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
