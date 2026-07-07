import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageAnalysisModal from './UserPageAnalysisModal';

jest.mock('reactstrap', () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="analysis-modal">{children}</div> : null,
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalHeader: ({ children, toggle }: { children: React.ReactNode; toggle: () => void }) => (
    <div>
      <button type="button" onClick={toggle}>
        close
      </button>
      {children}
    </div>
  ),
}));

const createProps = (overrides: Partial<React.ComponentProps<typeof UserPageAnalysisModal>> = {}) => ({
  aiAnalysis: 'Profile synthesis',
  analysisCacheStatusState: {
    analysisCacheAge: '2 minutes ago',
    shouldRenderAnalysisCacheStatus: true,
  },
  analysisDetails: 'Detailed analysis text',
  analysisElapsedMs: 1250,
  analysisError: '',
  analysisHistoricalFigure: 'A historical figure',
  analysisHistoricalReasoning: 'Reasoning text',
  analysisModalDisplayState: {
    shouldRenderAnalysisBody: true,
    shouldRenderAnalyzing: false,
    shouldRenderDetails: true,
    shouldRenderError: false,
    shouldRenderHistoricalAlignment: true,
    shouldRenderHistoricalFigure: true,
    shouldRenderHistoricalReasoning: true,
  },
  analysisName: 'Custom Analysis',
  analyzing: false,
  isOpen: true,
  onRefreshAnalysis: jest.fn(),
  onToggle: jest.fn(),
  ...overrides,
});

describe('UserPageAnalysisModal', () => {
  it('renders cached analysis body and forwards close and refresh handlers', () => {
    const onRefreshAnalysis = jest.fn();
    const onToggle = jest.fn();
    render(
      <UserPageAnalysisModal
        {...createProps({
          onRefreshAnalysis,
          onToggle,
        })}
      />,
    );

    expect(screen.getByTestId('analysis-modal')).toBeInTheDocument();
    expect(screen.getByText('Custom Analysis')).toBeInTheDocument();
    expect(screen.getByText('Cached analysis from 2 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('Profile synthesis')).toBeInTheDocument();
    expect(screen.getByText('Detailed analysis text')).toBeInTheDocument();
    expect(screen.getByText('Historical Alignment')).toBeInTheDocument();
    expect(screen.getByText('A historical figure')).toBeInTheDocument();
    expect(screen.getByText('Reasoning text')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh analysis' }));
    fireEvent.click(screen.getByText('close'));

    expect(onRefreshAnalysis).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders analyzing and error states from parent-derived display state', () => {
    const onRefreshAnalysis = jest.fn();
    render(
      <UserPageAnalysisModal
        {...createProps({
          analysisCacheStatusState: {
            shouldRenderAnalysisCacheStatus: false,
          },
          analysisElapsedMs: 2400,
          analysisError: 'Analysis failed.',
          analysisModalDisplayState: {
            shouldRenderAnalysisBody: false,
            shouldRenderAnalyzing: true,
            shouldRenderDetails: false,
            shouldRenderError: true,
            shouldRenderHistoricalAlignment: false,
            shouldRenderHistoricalFigure: false,
            shouldRenderHistoricalReasoning: false,
          },
          analysisName: '',
          analyzing: true,
          onRefreshAnalysis,
        })}
      />,
    );

    expect(screen.getByText('User Analysis')).toBeInTheDocument();
    expect(screen.getByText('Generating insights… 2.4s')).toBeInTheDocument();
    expect(screen.getByText('Analysis failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh analysis' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh analysis' }));
    expect(onRefreshAnalysis).not.toHaveBeenCalled();
  });

  it('keeps cached analysis visible while refresh is disabled during analysis', () => {
    const onRefreshAnalysis = jest.fn();
    render(
      <UserPageAnalysisModal
        {...createProps({
          analysisCacheStatusState: {
            analysisCacheAge: '30 seconds ago',
            shouldRenderAnalysisCacheStatus: true,
          },
          analysisModalDisplayState: {
            shouldRenderAnalysisBody: true,
            shouldRenderAnalyzing: true,
            shouldRenderDetails: true,
            shouldRenderError: false,
            shouldRenderHistoricalAlignment: false,
            shouldRenderHistoricalFigure: false,
            shouldRenderHistoricalReasoning: false,
          },
          analyzing: true,
          onRefreshAnalysis,
        })}
      />,
    );

    expect(screen.getByText('Cached analysis from 30 seconds ago')).toBeInTheDocument();
    expect(screen.getByText('Profile synthesis')).toBeInTheDocument();
    expect(screen.getByText('Detailed analysis text')).toBeInTheDocument();
    expect(screen.getByText('Generating insights… 1.3s')).toBeInTheDocument();

    const refreshButton = screen.getByRole('button', { name: 'Refresh analysis' });
    expect(refreshButton).toBeDisabled();
    fireEvent.click(refreshButton);
    expect(onRefreshAnalysis).not.toHaveBeenCalled();
  });
});
