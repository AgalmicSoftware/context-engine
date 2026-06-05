import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { renderSurveyResultsSyncStatusPanel } from './SurveyResultsPanels';

const basePanelProps = {
  isSynced: false,
  isSyncingOrLoading: true,
  syncStatusText: 'Syncing...',
  showLongSyncNotice: false,
  syncDetailsOpen: true,
  syncDetailsStyle: { display: 'block' },
  onToggleSyncDetails: jest.fn(),
  onManualRefresh: jest.fn(),
  viewMode: 'questions',
  showQuickRefresh: true,
  showQuestionSpinner: false,
  questionProgress: 50,
  questionColor: 'info',
  questionBarText: 'Remaining Blocks: 50',
  showQuestionRemainingSpinner: true,
  showResponseSpinner: false,
  responseProgress: 60,
  responseColor: 'info',
  responseBarText: 'Remaining Blocks: 40',
  showResponseRemainingSpinner: true,
  miniBarSpinnerStyle: { width: 12 },
  miniProgressStyle: { height: 6 },
  remainingSpinnerStyle: { marginLeft: 4 },
};

describe('renderSurveyResultsSyncStatusPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders stale question-mode readiness without invoking refresh side effects', () => {
    const onManualRefresh = jest.fn();
    const onToggleSyncDetails = jest.fn();

    render(
      <>
        {renderSurveyResultsSyncStatusPanel({
          ...basePanelProps,
          onManualRefresh,
          onToggleSyncDetails,
        })}
      </>
    );

    expect(screen.getByRole('button', { name: 'Toggle sync details' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(screen.getByText('Questions:')).toBeInTheDocument();
    expect(screen.getByText('Responses:')).toBeInTheDocument();
    expect(screen.getByText(/Remaining Blocks: 50/)).toBeInTheDocument();
    expect(screen.getByText(/Remaining Blocks: 40/)).toBeInTheDocument();
    expect(onManualRefresh).not.toHaveBeenCalled();
    expect(onToggleSyncDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh sync data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sync details' }));

    expect(onManualRefresh).toHaveBeenCalledTimes(1);
    expect(onToggleSyncDetails).toHaveBeenCalledTimes(1);
  });

  it('renders ready survey-mode state without question identity rows or quick refresh', () => {
    render(
      <>
        {renderSurveyResultsSyncStatusPanel({
          ...basePanelProps,
          isSynced: true,
          isSyncingOrLoading: false,
          syncStatusText: 'In Sync',
          showQuickRefresh: false,
          viewMode: 'survey',
          questionBarText: '',
          responseColor: 'success',
          responseProgress: 100,
          responseBarText: 'In Sync (Current: 100 / Latest: 100)',
          showQuestionRemainingSpinner: false,
          showResponseRemainingSpinner: false,
        })}
      </>
    );

    expect(screen.getByText('In Sync')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh sync data' })).not.toBeInTheDocument();
    expect(screen.queryByText('Questions:')).not.toBeInTheDocument();
    expect(screen.getByText('Responses:')).toBeInTheDocument();
    expect(screen.getByText('In Sync (Current: 100 / Latest: 100)')).toBeInTheDocument();
  });

  it('renders blocked loading state as passive spinner display until handlers are clicked', () => {
    const onManualRefresh = jest.fn();
    const onToggleSyncDetails = jest.fn();

    render(
      <>
        {renderSurveyResultsSyncStatusPanel({
          ...basePanelProps,
          isSynced: false,
          isSyncingOrLoading: true,
          syncStatusText: 'Loading...',
          syncDetailsOpen: false,
          syncDetailsStyle: { display: undefined },
          onManualRefresh,
          onToggleSyncDetails,
          showQuestionSpinner: true,
          showResponseSpinner: true,
          questionBarText: '',
          responseBarText: '',
        })}
      </>
    );

    expect(screen.getByRole('button', { name: 'Toggle sync details' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('Loading...')).toHaveLength(3);
    expect(onManualRefresh).not.toHaveBeenCalled();
    expect(onToggleSyncDetails).not.toHaveBeenCalled();
  });
});
