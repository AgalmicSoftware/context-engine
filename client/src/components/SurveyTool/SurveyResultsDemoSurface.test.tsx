import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsDemoSurface from './SurveyResultsDemoSurface';

const mockPolisReport = jest.fn((props: any) => (
  <div
    data-testid="polis-report"
    data-slug={props.slug}
    data-question-count={Array.isArray(props.questionResponses) ? props.questionResponses.length : 0}
    data-disclaimers-active={String(props.disclaimersActive)}
  />
));

jest.mock('../PolisReport/PolisReport', () => (props: any) => mockPolisReport(props));

jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="demo-breakdown" data-session-slug={props.sessionSlug} />,
}));

jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="demo-atlas"
      data-session-slug={props.activeSessionSlug}
      data-embedded={String(props.embedded)}
      data-modal-node={String(props.requestedModalNodeId || '')}
    >
      <button type="button" onClick={() => props.onModalClose?.()}>
        close atlas
      </button>
    </div>
  ),
}));

jest.mock('../MainContent/RiskMatrix', () => ({
  __esModule: true,
  default: (props: any) => (
    <button type="button" data-testid="risk-matrix" onClick={() => props.onOpenAtlasNode?.('node-1')}>
      risk matrix
    </button>
  ),
}));

describe('SurveyResultsDemoSurface', () => {
  beforeEach(() => {
    mockPolisReport.mockClear();
  });

  it('renders the report view with parent-prepared Polis inputs', () => {
    const questionResponses = [{ id: 'q1' }, { id: 'q2' }];

    render(
      <SurveyResultsDemoSurface
        activeSlug="demo"
        defaultTags={['tag']}
        filterState={{ active: true }}
        isQuestionCacheReady
        isResponsesCacheReady={false}
        network={{ id: 84532 }}
        networkChainId={84532}
        onAtlasModalClose={jest.fn()}
        onAtlasNodeOpen={jest.fn()}
        questionResponses={questionResponses}
        questionResponsesNonce={3}
        questionScanProgress={{ done: 2 }}
        viewKey="report"
      />,
    );

    expect(screen.getByTestId('polis-report')).toHaveAttribute('data-slug', 'demo');
    expect(screen.getByTestId('polis-report')).toHaveAttribute('data-question-count', '2');
    expect(screen.getByTestId('polis-report')).toHaveAttribute('data-disclaimers-active', 'true');
    expect(mockPolisReport).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTags: ['tag'],
        filterState: { active: true },
        isQuestionCacheReady: true,
        isResponsesCacheReady: false,
        network: { id: 84532 },
        questionResponses,
        questionResponsesNonce: 3,
        questionScanProgress: { done: 2 },
        slug: 'demo',
      }),
    );
  });

  it('preserves opaque cache progress inputs at the report handoff', () => {
    const progress = { slug: 'demo', phase: 'scan' };

    render(
      <SurveyResultsDemoSurface
        activeSlug="demo"
        onAtlasModalClose={jest.fn()}
        onAtlasNodeOpen={jest.fn()}
        questionResponses={[]}
        questionResponsesNonce="opaque-nonce"
        questionScanProgress={progress}
        viewKey="report"
      />,
    );

    expect(mockPolisReport).toHaveBeenCalledWith(
      expect.objectContaining({
        questionResponsesNonce: 'opaque-nonce',
        questionScanProgress: progress,
      }),
    );
  });

  it('renders atlas and keeps modal close state owned by the parent callback', async () => {
    const onAtlasModalClose = jest.fn();

    render(
      <SurveyResultsDemoSurface
        activeSlug="demo"
        atlasNodeId="node-1"
        onAtlasModalClose={onAtlasModalClose}
        onAtlasNodeOpen={jest.fn()}
        questionResponses={[]}
        viewKey="atlas"
      />,
    );

    const atlas = await screen.findByTestId('demo-atlas');
    expect(atlas).toHaveAttribute('data-session-slug', 'demo');
    expect(atlas).toHaveAttribute('data-modal-node', 'node-1');

    fireEvent.click(screen.getByRole('button', { name: 'close atlas' }));
    expect(onAtlasModalClose).toHaveBeenCalledTimes(1);
  });

  it('renders risk matrix and routes atlas-open requests through the parent callback', async () => {
    const onAtlasNodeOpen = jest.fn();

    render(
      <SurveyResultsDemoSurface
        activeSlug="demo"
        onAtlasModalClose={jest.fn()}
        onAtlasNodeOpen={onAtlasNodeOpen}
        questionResponses={[]}
        viewKey="riskMatrix"
      />,
    );

    fireEvent.click(await screen.findByTestId('risk-matrix'));
    expect(onAtlasNodeOpen).toHaveBeenCalledWith('node-1');
  });
});
