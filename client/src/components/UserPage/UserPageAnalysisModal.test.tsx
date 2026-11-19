import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageAnalysisModal from './UserPageAnalysisModal';

jest.mock('reactstrap', () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="analysis-modal">{children}</div> : null,
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalHeader: ({
    children,
    toggle,
    close,
  }: {
    children: React.ReactNode;
    toggle: () => void;
    close?: React.ReactNode;
  }) => (
    <div>
      {close || (
        <button type="button" onClick={toggle}>
          close
        </button>
      )}
      {children}
    </div>
  ),
  UncontrolledTooltip: ({ children }: { children: React.ReactNode }) => <div role="tooltip">{children}</div>,
}));

jest.mock('utilities/analysisCard/analysisCardSaved', () => ({
  formatSavedAnalysisCardDate: (savedAt: number) => `day ${savedAt}`,
}));

jest.mock('./UserPageAnalysisCard', () => ({
  __esModule: true,
  default: ({ card, picture }: { card: { title: string }; picture: { status: string } | null }) => (
    <div data-testid="analysis-card">
      {card.title} / {picture?.status || 'no picture yet'}
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
  it('shows the picture card under the analysis only when the analysis has one', () => {
    const card = {
      own: true,
      link: 'contextengine.sh',
      account: '',
      title: 'Wants AI doing paperwork',
      matchNote: '',
      figure: 'Elinor Ostrom (1933–2012)',
      figureName: 'Elinor Ostrom',
      years: '1933–2012',
      tastes: { book: null, game: null, film: null, song: null },
      answers: { yesNo: null, ownWords: null, vote: null },
    };
    const { rerender } = render(<UserPageAnalysisModal {...createProps()} />);
    expect(screen.queryByText('Picture card')).toBeNull();

    // The analysis is readable while the card is still being written.
    rerender(<UserPageAnalysisModal {...createProps({ analysisCardPending: true })} />);
    expect(screen.getByText('Profile synthesis')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Making the card…');
    expect(screen.queryByTestId('analysis-card')).toBeNull();

    rerender(
      <UserPageAnalysisModal {...createProps({ analysisCard: card, analysisCardPicture: { status: 'loading' } })} />,
    );
    expect(screen.getByText('Picture card')).toBeTruthy();
    expect(screen.getByTestId('analysis-card').textContent).toBe('Wants AI doing paperwork / loading');

    // While an analysis is running or has failed there is no card to show.
    rerender(
      <UserPageAnalysisModal
        {...createProps({
          analysisCard: card,
          analysisModalDisplayState: { shouldRenderAnalyzing: true, shouldRenderAnalysisBody: false },
        })}
      />,
    );
    expect(screen.queryByTestId('analysis-card')).toBeNull();
  });

  it('on my own page puts a "Show this card on my page" box under the card; on another page, their date', () => {
    const card = {
      own: true,
      link: 'contextengine.sh',
      account: '',
      title: 'Wants AI doing paperwork',
      matchNote: '',
      figure: 'Elinor Ostrom (1933–2012)',
      figureName: 'Elinor Ostrom',
      years: '1933–2012',
      tastes: { book: null, game: null, film: null, song: null },
      answers: { yesNo: null, ownWords: null, vote: null },
    };
    const onAnalysisCardShownChange = jest.fn();
    const { rerender } = render(
      <UserPageAnalysisModal
        {...createProps({
          analysisCard: card,
          analysisCardPublish: { shown: true, saving: false, note: '' },
          onAnalysisCardShownChange,
        })}
      />,
    );
    const box = screen.getByRole('checkbox', { name: 'Show this card on my page' }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByRole('tooltip').textContent).toMatch(
      /read your answers sees this card on your page, with up to three of those answers/,
    );
    fireEvent.click(box);
    expect(onAnalysisCardShownChange).toHaveBeenCalledWith(false);

    rerender(
      <UserPageAnalysisModal
        {...createProps({
          analysisCard: card,
          analysisCardPublish: { shown: false, saving: true, note: 'The card could not be saved to your page.' },
          onAnalysisCardShownChange,
        })}
      />,
    );
    const saving = screen.getByRole('checkbox', { name: 'Show this card on my page' }) as HTMLInputElement;
    expect(saving.checked).toBe(false);
    expect(saving.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('The card could not be saved to your page.');

    rerender(<UserPageAnalysisModal {...createProps({ analysisCard: card, analysisCardSavedAt: 7 })} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Their saved card, from day 7')).toBeTruthy();
  });

  it('labels the model that produced a cached summary and distinguishes older requested-only metadata', () => {
    const { rerender } = render(
      <UserPageAnalysisModal
        {...createProps({
          analysisGeneration: { provider: 'openrouter', model: 'provider/resolved-model', source: 'reported' },
        })}
      />,
    );
    expect(screen.getByText('AI model: provider/resolved-model (openrouter)')).toBeInTheDocument();
    rerender(
      <UserPageAnalysisModal
        {...createProps({
          analysisGeneration: { provider: 'openrouter', model: 'openrouter/auto', source: 'requested' },
        })}
      />,
    );
    expect(screen.getByText('Requested AI model: openrouter/auto (openrouter)')).toBeInTheDocument();
    rerender(<UserPageAnalysisModal {...createProps()} />);
    expect(screen.getByText('AI model: not recorded')).toBeInTheDocument();
  });

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
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveAttribute('data-ce-control-appearance', 'frameless');
    expect(screen.getByRole('button', { name: 'Refresh analysis' })).toHaveAttribute(
      'data-ce-control-appearance',
      'frameless',
    );
    fireEvent.click(close);

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

  it('renders an AI settings action only for missing-key analysis errors', () => {
    const onOpenAiSettings = jest.fn();
    const { rerender } = render(
      <UserPageAnalysisModal
        {...createProps({
          analysisCacheStatusState: { shouldRenderAnalysisCacheStatus: false },
          analysisError: 'AI analysis needs a configured AI provider key.',
          analysisErrorAction: 'add-ai-key',
          analysisModalDisplayState: {
            shouldRenderAnalysisBody: false,
            shouldRenderAnalyzing: false,
            shouldRenderDetails: false,
            shouldRenderError: true,
            shouldRenderHistoricalAlignment: false,
            shouldRenderHistoricalFigure: false,
            shouldRenderHistoricalReasoning: false,
          },
          onOpenAiSettings,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add AI key' }));
    expect(onOpenAiSettings).toHaveBeenCalledTimes(1);

    rerender(
      <UserPageAnalysisModal
        {...createProps({
          analysisCacheStatusState: { shouldRenderAnalysisCacheStatus: false },
          analysisError: 'Unable to reach the AI service.',
          analysisErrorAction: 'open-ai-settings',
          analysisModalDisplayState: {
            shouldRenderAnalysisBody: false,
            shouldRenderAnalyzing: false,
            shouldRenderDetails: false,
            shouldRenderError: true,
            shouldRenderHistoricalAlignment: false,
            shouldRenderHistoricalFigure: false,
            shouldRenderHistoricalReasoning: false,
          },
          onOpenAiSettings,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Add AI key' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open AI settings' })).toBeInTheDocument();
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
