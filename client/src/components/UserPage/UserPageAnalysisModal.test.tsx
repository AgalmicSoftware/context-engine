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
  it('is titled Analyze user and opens on the Breakdown, with the text one press away', () => {
    const analysisBreakdown = {
      holds: 'Local councils should decide.',
      openTo: 'National standards, if reviewed yearly.',
      unsure: 'How fast a rollout should go.',
      ownWords: 'People must see how a decision was made.',
    };
    render(<UserPageAnalysisModal {...createProps({ analysisBreakdown })} />);
    expect(screen.getByText('Analyze user')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Breakdown' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Card' })).toBeNull();
    // The generated name heads the view, over the summary and details as the analysis wrote them.
    expect(screen.getByRole('heading', { name: 'Custom Analysis' })).toBeTruthy();
    expect(screen.getByText('Profile synthesis')).toBeTruthy();
    expect(screen.getByText('Detailed analysis text')).toBeTruthy();
    const labels = ['Holds most strongly', 'Open to', 'Least sure about', 'Own words', 'Historical Alignment'];
    expect(screen.getAllByText(new RegExp(`^(${labels.join('|')})$`)).map((node) => node.textContent)).toEqual(labels);
    expect(screen.getByText('Local councils should decide.')).toBeTruthy();
    expect(screen.getByText('“People must see how a decision was made.”')).toBeTruthy();
    expect(screen.getByText('A historical figure')).toBeTruthy();
    expect(screen.getByText('Reasoning text')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.getByRole('button', { name: 'Text' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Holds most strongly')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Custom Analysis' })).toBeTruthy();
    expect(screen.getByText('Profile synthesis')).toBeTruthy();
    expect(screen.getByText('Detailed analysis text')).toBeTruthy();
    expect(screen.getByText('Historical Alignment')).toBeTruthy();
    expect(screen.getByText('Reasoning text')).toBeTruthy();
  });

  it('draws only the Breakdown lines the analysis gave, and none for an analysis kept from before', () => {
    const { rerender } = render(<UserPageAnalysisModal {...createProps()} />);
    expect(screen.getAllByRole('heading', { name: 'Custom Analysis' })).toHaveLength(1);
    expect(screen.queryByText('Holds most strongly')).toBeNull();
    expect(screen.queryByText('Own words')).toBeNull();
    expect(screen.getByText('Historical Alignment')).toBeTruthy();

    const analysisBreakdown = { holds: '', openTo: 'A trial first.', unsure: '', ownWords: '' };
    rerender(<UserPageAnalysisModal {...createProps({ analysisBreakdown })} />);
    expect(screen.getByText('Open to')).toBeTruthy();
    expect(screen.queryByText('Holds most strongly')).toBeNull();
    expect(screen.queryByText('Least sure about')).toBeNull();
    expect(screen.queryByText('Own words')).toBeNull();

    // No empty heading where the analysis has no name.
    rerender(<UserPageAnalysisModal {...createProps({ analysisName: '' })} />);
    expect(screen.getAllByRole('heading').map((node) => node.textContent)).toEqual(['Historical Alignment']);
  });

  it('offers the picture card as a third view, with one way to it: the Card button', () => {
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
    const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
    const { rerender } = render(<UserPageAnalysisModal {...createProps()} />);
    expect(screen.queryByRole('button', { name: 'Card' })).toBeNull();

    // The analysis is readable while the card is still being written; the Card view says it is on its way.
    rerender(<UserPageAnalysisModal {...createProps({ analysisCardPending: true })} />);
    expect(screen.getByText('Profile synthesis')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Card' }));
    expect(screen.getByRole('status').textContent).toContain('Making the card…');
    expect(screen.queryByText('Profile synthesis')).toBeNull();

    // One card, seen in the Card view only, and no second button for it anywhere.
    rerender(
      <UserPageAnalysisModal {...createProps({ analysisCard: card, analysisCardPicture: { status: 'ready' } })} />,
    );
    expect(pressed('Card')).toBe('true');
    expect(screen.getAllByTestId('analysis-card')).toHaveLength(1);
    expect(screen.getByTestId('analysis-card')).toBeVisible();
    expect(screen.getByTestId('analysis-card').textContent).toBe('Wants AI doing paperwork / ready');
    expect(screen.queryByRole('button', { name: 'View User Card' })).toBeNull();
    // In the other views the card stays drawn out of sight, so a saved card gets its picture either way.
    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.getAllByTestId('analysis-card')).toHaveLength(1);
    expect(screen.getByTestId('analysis-card')).not.toBeVisible();
    expect(screen.getAllByRole('button', { name: /card/i })).toHaveLength(1);

    // A card that is taken away leaves the Breakdown, not an empty view.
    fireEvent.click(screen.getByRole('button', { name: 'Card' }));
    rerender(<UserPageAnalysisModal {...createProps()} />);
    expect(pressed('Breakdown')).toBe('true');
    expect(screen.getByText('Profile synthesis')).toBeTruthy();

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
    expect(screen.queryByRole('button', { name: 'Card' })).toBeNull();
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
    // The box belongs to the card: it is in the Card view and in neither of the others.
    expect(screen.getByRole('button', { name: 'Breakdown' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Card' }));
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

    // Another person's saved card: no box in any view, and its date under the card in the Card view.
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
          aiAnalysis: '',
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

    expect(screen.getByText('Analyze user')).toBeInTheDocument();
    expect(screen.getByText('Generating insights… 2 of about 19 seconds')).toBeInTheDocument();
    expect(screen.getByText('Analysis failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh analysis' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh analysis' }));
    expect(onRefreshAnalysis).not.toHaveBeenCalled();
  });

  const waiting = {
    shouldRenderAnalysisBody: false,
    shouldRenderAnalyzing: true,
    shouldRenderDetails: false,
    shouldRenderError: false,
    shouldRenderHistoricalAlignment: false,
    shouldRenderHistoricalFigure: false,
    shouldRenderHistoricalReasoning: false,
  };
  const failed = { ...waiting, shouldRenderAnalyzing: false, shouldRenderError: true };
  const firstRead = {
    aiAnalysis: 'Wants decisions made close to home.',
    analysisCacheStatusState: { shouldRenderAnalysisCacheStatus: false },
    analysisDetails: 'Holds hearings dear.\nOpen to national standards.',
    analysisName: '',
  };

  it('shows the first read under the waiting line while the full analysis is written', () => {
    render(
      <UserPageAnalysisModal
        {...createProps({ ...firstRead, analysisElapsedMs: 8400, analysisModalDisplayState: waiting, analyzing: true })}
      />,
    );

    expect(screen.getByText('Writing the full analysis… 8 of about 19 seconds')).toBeInTheDocument();
    const block = screen.getByTestId('analysis-first-read');
    expect(block).toHaveTextContent('First read');
    expect(block).toHaveTextContent('Wants decisions made close to home.');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Holds hearings dear.',
      'Open to national standards.',
    ]);
    expect(screen.queryByText(/AI model:/)).not.toBeInTheDocument();
  });

  it('draws lines that read the same, and none for a blank one', () => {
    render(
      <UserPageAnalysisModal
        {...createProps({
          ...firstRead,
          analysisDetails: 'Same line.\n\nSame line.',
          analysisModalDisplayState: waiting,
          analyzing: true,
        })}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('First read');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Same line.', 'Same line.']);
  });

  it('keeps the first read when the full analysis fails, and offers to try again', () => {
    const onRefreshAnalysis = jest.fn();
    render(
      <UserPageAnalysisModal
        {...createProps({
          ...firstRead,
          analysisError: 'Unable to reach the AI service.',
          analysisErrorAction: 'open-ai-settings',
          analysisModalDisplayState: failed,
          onOpenAiSettings: jest.fn(),
          onRefreshAnalysis,
        })}
      />,
    );

    expect(screen.getByTestId('analysis-first-read')).toHaveTextContent('Wants decisions made close to home.');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The full analysis did not arrive. Unable to reach the AI service.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRefreshAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Open AI settings' })).toBeInTheDocument();
  });

  it('draws no first read once the analysis is on screen, and none where there was none', () => {
    const { rerender } = render(<UserPageAnalysisModal {...createProps()} />);
    expect(screen.queryByTestId('analysis-first-read')).not.toBeInTheDocument();
    expect(screen.getByText('Profile synthesis')).toBeInTheDocument();

    rerender(
      <UserPageAnalysisModal
        {...createProps({ aiAnalysis: '', analysisDetails: '', analysisModalDisplayState: waiting, analyzing: true })}
      />,
    );
    expect(screen.queryByTestId('analysis-first-read')).not.toBeInTheDocument();
    expect(screen.getByText('Generating insights… 1 of about 19 seconds')).toBeInTheDocument();
  });

  it('offers Try again after a failure, except where a key has to be added first', () => {
    const { rerender } = render(
      <UserPageAnalysisModal
        {...createProps({ aiAnalysis: '', analysisError: 'It failed.', analysisModalDisplayState: failed })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    rerender(
      <UserPageAnalysisModal
        {...createProps({
          aiAnalysis: '',
          analysisError: 'A key is needed.',
          analysisErrorAction: 'add-ai-key',
          analysisModalDisplayState: failed,
          onOpenAiSettings: jest.fn(),
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
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
    expect(screen.getByText('Generating insights… 1 of about 19 seconds')).toBeInTheDocument();

    const refreshButton = screen.getByRole('button', { name: 'Refresh analysis' });
    expect(refreshButton).toBeDisabled();
    fireEvent.click(refreshButton);
    expect(onRefreshAnalysis).not.toHaveBeenCalled();
  });
});
