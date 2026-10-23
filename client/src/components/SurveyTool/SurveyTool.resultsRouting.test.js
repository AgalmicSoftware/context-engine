import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SurveyTool from './SurveyTool';
import SurveyResults from './SurveyResults';
import { SurveySelector } from './SurveySelector';

jest.mock('./SurveyResults', () => ({
  __esModule: true,
  default: jest.fn(({ isOpen, onClose, onFilterStateChangeForUrlUpdate }) => (
    <div data-testid="mock-survey-results">
      {isOpen && <button onClick={onClose}>Close functional results</button>}
      <button onClick={() => onFilterStateChangeForUrlUpdate({ questionTypes: ['binary'] })}>
        Filter binary questions
      </button>
    </div>
  )),
}));

jest.mock('./SurveySelector', () => ({
  SurveySelector: jest.fn(() => <div data-testid="mock-survey-selector" />),
}));

const latestProps = (component) => component.mock.calls[component.mock.calls.length - 1][0];

const expectNoLocalSessionSelector = () => {
  for (const suffix of ['', '-toggle', '-panel', '-backdrop']) {
    expect(screen.queryByTestId(`ce-surveytool-session-selector${suffix}`)).not.toBeInTheDocument();
  }
};

describe('SurveyTool results routing', () => {
  let priorUrl;

  beforeEach(() => {
    priorUrl = window.location.href;
  });

  afterEach(() => {
    window.history.replaceState({}, '', priorUrl);
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('does not auto-open SurveyTool results modal from ?results=true URL param', async () => {
    window.history.replaceState({}, '', '/surveys?results=true');
    render(<SurveyTool autoOpenResults={false} preventUrlChange />);

    await screen.findByTestId('mock-survey-results');
    expect(screen.queryByRole('button', { name: 'Close functional results' })).not.toBeInTheDocument();
    expect(latestProps(SurveyResults).isOpen).toBe(false);
  });

  it('calls onResultsModalClose after closing the results modal', async () => {
    window.history.pushState({}, '', '/session/edge/questions/results');
    const onResultsModalClose = jest.fn();
    render(<SurveyTool autoOpenResults onResultsModalClose={onResultsModalClose} preventUrlChange />);

    fireEvent.click(await screen.findByRole('button', { name: 'Close functional results' }));

    expect(screen.queryByRole('button', { name: 'Close functional results' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/session/edge/questions/results');
    expect(onResultsModalClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/session/edge/questions/results',
    '/session/edge/questions/results/',
    '/session/edge/QUESTIONS/RESULTS',
    '/ce/session/edge/questions/results',
  ])('returns to the session root without dropping query or hash when closing results from %s', async (resultsPath) => {
    window.history.pushState({}, '', `${resultsPath}?worker=https%3A%2F%2Fworker.example.test&session=edge#responses`);
    render(<SurveyTool autoOpenResults preventUrlChange />);

    fireEvent.click(await screen.findByRole('button', { name: 'Close functional results' }));

    expect(screen.queryByRole('button', { name: 'Close functional results' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(resultsPath.startsWith('/ce/') ? '/ce/session/edge' : '/session/edge');
    expect(window.location.search).toBe('?worker=https%3A%2F%2Fworker.example.test&session=edge');
    expect(window.location.hash).toBe('#responses');
  });

  it('opens functional results when autoOpenResults flips on immediately after the full view mounts', async () => {
    const { rerender } = render(
      <SurveyTool autoOpenResults={false} preventUrlChange activeSessionSlug="edge" network={{ id: 84532 }} />,
    );

    expect(screen.queryByRole('button', { name: 'Close functional results' })).not.toBeInTheDocument();

    rerender(<SurveyTool autoOpenResults preventUrlChange activeSessionSlug="edge" network={{ id: 84532 }} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close functional results' })).toBeInTheDocument();
    });
  });

  it('preserves query and hash through the functional results close path', async () => {
    window.history.pushState(
      {},
      '',
      '/ce/session/edge/questions/results?worker=https%3A%2F%2Fworker.example.test&session=edge#responses',
    );
    render(<SurveyTool autoOpenResults preventUrlChange activeSessionSlug="edge" network={{ id: 84532 }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Close functional results' }));

    expect(window.location.pathname).toBe('/ce/session/edge');
    expect(window.location.search).toBe('?worker=https%3A%2F%2Fworker.example.test&session=edge');
    expect(window.location.hash).toBe('#responses');
  });

  it('leaves functional results routing to an external close owner', async () => {
    const onResultsModalClose = jest.fn();
    window.history.pushState({}, '', '/session/edge/questions/results?worker=external#owned');
    render(
      <SurveyTool
        autoOpenResults
        preventUrlChange
        activeSessionSlug="edge"
        network={{ id: 84532 }}
        onResultsModalClose={onResultsModalClose}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Close functional results' }));

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/session/edge/questions/results?worker=external#owned',
    );
    expect(onResultsModalClose).toHaveBeenCalledTimes(1);
  });

  it('keeps route-driven auto-open owned by SurveyTool instead of cascading it into SurveySelector', async () => {
    render(
      <SurveyTool
        autoOpenResults
        surveyId="0xABC"
        filterState={{}}
        network={{ id: 84532 }}
        networkChainId={11155420}
        activeSessionSlug="edge"
        preventUrlChange
      />,
    );

    await screen.findByRole('button', { name: 'Close functional results' });
    expect(latestProps(SurveySelector).autoOpenResults).toBe(false);
    expect(latestProps(SurveyResults).isOpen).toBe(true);
    expect(latestProps(SurveyResults).surveyId).toBe('0xabc');
    expect(latestProps(SurveyResults).networkChainId).toBe(11155420);
  });

  it('does not render orphaned results text and keeps embedded results props aligned', async () => {
    const progress = {
      slug: 'edge',
      phase: 'scan',
      totalBlocks: 120,
      requestedTotalBlocks: 120,
      scannedBlocks: 30,
      remainingBlocks: 90,
    };
    const { container } = render(
      <SurveyTool
        filterState={{}}
        network={{ id: 84532 }}
        activeSessionSlug="edge"
        sessionSlugPinned
        hideEmbeddedDebugUi
        questionScanProgress={progress}
        preventUrlChange
      />,
    );

    await screen.findByTestId('mock-survey-results');
    expect(latestProps(SurveyResults).sessionSlugPinned).toBe(true);
    expect(latestProps(SurveyResults).hideEmbeddedDebugUi).toBe(true);
    expect(latestProps(SurveyResults).questionScanProgress).toBe(progress);
    expect(container).not.toHaveTextContent(')}');
  });

  it('does not render a local SurveyTool session selector and keeps default global session resolution', () => {
    render(
      <SurveyTool
        surveyId="0xABC"
        filterState={{}}
        network={{ id: 84532 }}
        activeSessionSlug="edge"
        sessionSlugPinned={false}
        preventUrlChange
      />,
    );

    expectNoLocalSessionSelector();
    expect(latestProps(SurveySelector).sessionSlug).toBeUndefined();
  });

  it('does not render a local session selector in embedded one-page-demo mode', () => {
    render(
      <SurveyTool
        surveyId="0xABC"
        filterState={{}}
        network={{ id: 84532 }}
        activeSessionSlug="edge"
        hideSessionSelector
        preventUrlChange
        miniMode
      />,
    );

    expectNoLocalSessionSelector();
  });

  it('does not render a local session selector on routed SurveyPage surfaces that prevent URL writes', () => {
    render(
      <SurveyTool
        surveyId="0xABC"
        filterState={{}}
        network={{ id: 84532 }}
        activeSessionSlug="edge"
        preventUrlChange
      />,
    );

    expectNoLocalSessionSelector();
  });

  it('preserves filter query and session slug when SurveyTool updates results URL state', async () => {
    window.history.replaceState({}, '', '/surveys');
    render(<SurveyTool surveyId="0xABC" activeSessionSlug="edge" preventUrlChange={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Filter binary questions' }));

    expect(window.location.pathname).toBe('/survey/0xabc/results');
    expect(new URLSearchParams(window.location.search).get('filter')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('session')).toBe('edge');
  });

  it('preserves question-results session pins and avoids hardcoded session subroutes when SurveyTool updates URL state', async () => {
    window.history.replaceState({}, '', '/session/edge/questions/results');
    render(<SurveyTool activeSessionSlug="edge" preventUrlChange={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Filter binary questions' }));

    expect(window.location.pathname).toBe('/questions/results');
    expect(new URLSearchParams(window.location.search).get('filter')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('session')).toBe('edge');
  });

  it('uses an explicit SurveyTool session prop when updating the results URL state', async () => {
    window.history.replaceState({}, '', '/surveys');
    render(<SurveyTool surveyId="0xABC" activeSessionSlug="edge" sessionSlug="rxc" preventUrlChange={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Filter binary questions' }));

    expect(window.location.pathname).toBe('/survey/0xabc/results');
    expect(new URLSearchParams(window.location.search).get('session')).toBe('rxc');
  });
});
