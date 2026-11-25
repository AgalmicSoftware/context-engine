import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

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
  default: ({
    card,
    picture,
    waitingSince,
  }: {
    card: { title: string };
    picture: { status: string } | null;
    waitingSince?: number | null;
  }) => (
    <div data-testid="analysis-card" data-waiting-since={waitingSince ?? ''}>
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
  afterEach(() => window.localStorage.clear());

  it('is titled Analyze user and opens on the Breakdown', () => {
    const analysisBreakdown = {
      holds: 'Local councils should decide.',
      openTo: 'National standards, if reviewed yearly.',
      unsure: 'How fast a rollout should go.',
      ownWords: 'People must see how a decision was made.',
    };
    render(<UserPageAnalysisModal {...createProps({ analysisBreakdown })} />);
    expect(screen.getByText('Analyze user')).toBeTruthy();
    // With no card there is nothing to switch between.
    expect(screen.queryByRole('group', { name: 'How to show the analysis' })).toBeNull();
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
  });

  // The Text view said what the Breakdown says, and was offered only under an Options box with nothing else in it.
  it('has no Text view and no Options, even where this browser once asked for the Text view', () => {
    window.localStorage.setItem('ce-analysis-text-view', '1');
    render(<UserPageAnalysisModal {...createProps()} />);
    expect(screen.queryByText('Options')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Text' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'How to show the analysis' })).toBeNull();
    expect(screen.getByText('Profile synthesis').parentElement).toHaveClass('banner');
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

  it('offers the picture card as a second view, with one way to it: the Card button', () => {
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
    expect(screen.getByRole('status').textContent).toMatch(/^Making the card… · \d+s$/);
    // In outline, with every heading a card can have, until the card says which guesses it has.
    expect(screen.getByText('Historical match').closest('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.getAllByText(/ guess$/).map((node) => node.textContent)).toEqual([
      'book guess',
      'game guess',
      'film guess',
      'song guess',
    ]);
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
    // In the Breakdown the card stays drawn out of sight, so a saved card gets its picture either way.
    fireEvent.click(screen.getByRole('button', { name: 'Breakdown' }));
    expect(screen.getAllByTestId('analysis-card')).toHaveLength(1);
    expect(screen.getByTestId('analysis-card')).not.toBeVisible();
    expect(screen.getAllByRole('button', { name: /card/i })).toHaveLength(1);

    // A card that is taken away leaves the Breakdown, not an empty view, and no switch.
    fireEvent.click(screen.getByRole('button', { name: 'Card' }));
    rerender(<UserPageAnalysisModal {...createProps()} />);
    expect(screen.queryByRole('group', { name: 'How to show the analysis' })).toBeNull();
    expect(screen.getByText('Profile synthesis').parentElement).toHaveClass('banner');

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

  it('counts how long the card has been on its way from when it was asked for, through a switch of view', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(100_000);
      const { rerender } = render(
        <UserPageAnalysisModal {...createProps({ analysisCardPending: true, analysisCardStartedAt: 80_000 })} />,
      );
      // Asked for 20 seconds before the Card view was opened: the count says so, not 0.
      fireEvent.click(screen.getByRole('button', { name: 'Card' }));
      expect(screen.getByRole('status')).toHaveTextContent('Making the card… · 20s');
      fireEvent.click(screen.getByRole('button', { name: 'Breakdown' }));
      act(() => {
        jest.advanceTimersByTime(5_000);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Card' }));
      expect(screen.getByRole('status')).toHaveTextContent('Making the card… · 25s');
      // Its words arrive: the wait for the picture counts on from the same start.
      rerender(
        <UserPageAnalysisModal
          {...createProps({
            analysisCard: { title: 'Wants AI doing paperwork' } as never,
            analysisCardPicture: { status: 'loading' },
            analysisCardStartedAt: 80_000,
          })}
        />,
      );
      expect(screen.getByTestId('analysis-card')).toHaveAttribute('data-waiting-since', '80000');
    } finally {
      jest.useRealTimers();
    }
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
    // The box belongs to the card: it is in the Card view and not in the Breakdown.
    const cardBox = () => screen.queryByRole('checkbox', { name: 'Show this card on my page' });
    expect(screen.getByRole('button', { name: 'Breakdown' }).getAttribute('aria-pressed')).toBe('true');
    expect(cardBox()).toBeNull();
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
    expect(cardBox()).toBeNull();
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

  it('keeps the saved card in the box while an analysis is awaited or has failed, and not beside an analysis', () => {
    const savedCard = <section aria-label="Picture card">My saved card</section>;
    const quiet = { analysisCacheStatusState: { shouldRenderAnalysisCacheStatus: false }, analysisName: '' };
    const { rerender } = render(
      <UserPageAnalysisModal {...createProps({ ...quiet, analysisModalDisplayState: waiting, savedCard })} />,
    );
    expect(screen.getByRole('region', { name: 'Picture card' })).toHaveTextContent('My saved card');

    rerender(
      <UserPageAnalysisModal
        {...createProps({
          ...quiet,
          analysisError: 'Unable to reach the AI service.',
          analysisModalDisplayState: failed,
          savedCard,
        })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the AI service.');
    expect(screen.getByRole('region', { name: 'Picture card' })).toBeInTheDocument();

    // An analysis on screen brings its own card.
    rerender(<UserPageAnalysisModal {...createProps({ savedCard })} />);
    expect(screen.queryByText('My saved card')).not.toBeInTheDocument();
  });

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
