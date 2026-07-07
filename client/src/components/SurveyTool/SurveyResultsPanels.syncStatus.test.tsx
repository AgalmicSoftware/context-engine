import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { renderSurveyResultsSyncStatusPanel } from './SurveyResultsPanels';
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
    label: 'Remaining Blocks: 50',
    progress: 50,
    remainingBlocks: 50,
    showRemainingSpinner: true,
    showSpinner: false,
  },
  response: {
    color: 'info',
    label: 'Remaining Blocks: 40',
    progress: 60,
    remainingBlocks: 40,
    showRemainingSpinner: true,
    showSpinner: false,
  },
  ...overrides,
});

const basePanelProps = {
  syncDetailsOpen: true,
  syncDetailsStyle: { display: 'block' },
  onToggleSyncDetails: jest.fn(),
  onManualRefresh: jest.fn(),
  miniBarSpinnerStyle: { width: 12 },
  miniProgressStyle: { height: 6 },
  remainingSpinnerStyle: { marginLeft: 4 },
  syncStatusDisplay: buildSyncStatusDisplay(),
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
          syncStatusDisplay: buildSyncStatusDisplay(),
        })}
      </>,
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
          syncStatusDisplay: buildSyncStatusDisplay({
            isSynced: true,
            isSyncingOrLoading: false,
            syncStatusText: 'In Sync',
            showQuickRefresh: false,
            viewMode: 'survey',
            question: {
              color: 'info',
              label: '',
              progress: 0,
              remainingBlocks: 0,
              showRemainingSpinner: false,
              showSpinner: false,
            },
            response: {
              color: 'success',
              label: 'In Sync (Current: 100 / Latest: 100)',
              progress: 100,
              remainingBlocks: 0,
              showRemainingSpinner: false,
              showSpinner: false,
            },
          }),
        })}
      </>,
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
          syncDetailsOpen: false,
          syncDetailsStyle: { display: undefined },
          onManualRefresh,
          onToggleSyncDetails,
          syncStatusDisplay: buildSyncStatusDisplay({
            syncStatusText: 'Loading...',
            question: {
              color: 'info',
              label: '',
              progress: 0,
              remainingBlocks: 0,
              showRemainingSpinner: false,
              showSpinner: true,
            },
            response: {
              color: 'info',
              label: '',
              progress: 0,
              remainingBlocks: 0,
              showRemainingSpinner: false,
              showSpinner: true,
            },
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: 'Toggle sync details' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('Loading...')).toHaveLength(3);
    expect(onManualRefresh).not.toHaveBeenCalled();
    expect(onToggleSyncDetails).not.toHaveBeenCalled();
  });
});
