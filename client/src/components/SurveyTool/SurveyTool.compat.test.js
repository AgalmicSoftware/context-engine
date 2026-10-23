import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import SurveyResults from './SurveyResults';
import { SurveyQuestions } from './SurveyQuestions';
import SurveyTool from './SurveyTool';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { SurveySelector } from './SurveySelector';
import { createSurveyQuestionsTestStore, renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { resolveSurveyToolQuestionReadCacheContext } from './surveyToolSessionResolution';

jest.mock('./SurveySelector', () => ({
  SurveySelector: jest.fn(() => <div data-testid="mock-survey-selector" />),
  QuestionsDashboard: jest.fn(() => <div data-testid="mock-questions-dashboard" />),
}));

jest.mock('./SurveyResults', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="mock-survey-results" />),
}));

jest.mock('./SurveyQuestions', () => {
  const actual = jest.requireActual('./SurveyQuestions');
  return {
    ...actual,
    SurveyQuestions: jest.fn((props) => jest.requireActual('react').createElement(actual.SurveyQuestions, props)),
  };
});

const latestProps = (component) => component.mock.calls[component.mock.calls.length - 1][0];

describe('SurveyTool compatibility wiring', () => {
  beforeEach(() => {
    const ActualSurveyQuestions = jest.requireActual('./SurveyQuestions').SurveyQuestions;
    SurveyQuestions.mockImplementation((props) => <ActualSurveyQuestions {...props} />);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('loads without syntax/runtime import errors', () => {
    expect(SurveyTool).toBeDefined();
  });

  it('uses __registry.registryChainId when SurveyQuestions resolves the session chain', () => {
    const resolveBySlug = jest.fn((slug) =>
      slug === 'edge'
        ? {
            slug: 'edge',
            __registry: {
              registryChainId: 84532,
              sessionIdHex: '0x00112233445566778899aabbccddeeff',
            },
          }
        : null,
    );

    const resolved = resolveSurveyToolQuestionReadCacheContext({
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          registryChainId: 84532,
        },
      },
      networkId: 84532,
      networkIdStr: '84532',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('edge');
    // port note: dropped direct `SurveyQuestions.resolveSessionChainId()`
    // invocation. The exported session-resolution helper is the behavior-level
    // chain selector that preserves the same registryChainId-over-wallet rule.
  });

  it('renders extracted PileViewMode through SurveyTool.tsx in pile mode', async () => {
    render(
      <Provider store={createSurveyQuestionsTestStore()}>
        <MemoryRouter>
          <SurveyTool
            minifiedMode="pile"
            network={{ id: 84532 }}
            networkChainId={84532}
            isQuestionCacheReady={true}
            onFilterChange={jest.fn()}
          />
        </MemoryRouter>
      </Provider>,
    );

    expect(await screen.findByTestId('ce-survey-filter-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('ce-survey-create-toggle-pile')).toBeInTheDocument();
    expect(latestProps(SurveyQuestions).minifiedMode).toBe('pile');
  });

  it('forwards scoped Lit hooks from SurveyTool into normal survey surfaces', async () => {
    const litHooks = { getKey: jest.fn(), saveKey: jest.fn() };
    const lit = { getKey: jest.fn() };
    render(
      <SurveyTool
        {...{
          network: { id: 11155420 },
          networkChainId: 11155420,
          lit,
          litHooks,
          preventUrlChange: true,
        }}
      />,
    );

    await screen.findByTestId('mock-survey-results');

    expect(latestProps(SurveySelector).lit).toBe(lit);
    expect(latestProps(SurveySelector).litHooks).toBe(litHooks);
    expect(latestProps(SurveyResults).lit).toBe(lit);
    expect(latestProps(SurveyResults).litHooks).toBe(litHooks);
    expect(latestProps(SurveyResults).isOpen).toBe(false);
  });

  it('forwards optional toolbar and question-count targets only to the selector', async () => {
    const toolbarTarget = document.createElement('div');
    const questionCountTarget = document.createElement('span');
    render(
      <SurveyTool
        network={{ id: 11155420 }}
        toolbarTarget={toolbarTarget}
        questionCountTarget={questionCountTarget}
        preventUrlChange
      />,
    );
    await screen.findByTestId('mock-survey-results');

    expect(latestProps(SurveySelector).toolbarTarget).toBe(toolbarTarget);
    expect(latestProps(SurveyResults).toolbarTarget).toBeUndefined();
    expect(latestProps(SurveySelector).questionCountTarget).toBe(questionCountTarget);
    expect(latestProps(SurveyResults).questionCountTarget).toBeUndefined();
  });

  it('forwards scoped Lit hooks from SurveyTool into single-question surfaces', async () => {
    SurveyQuestions.mockImplementation(() => <div data-testid="mock-survey-question" />);
    const litHooks = { getKey: jest.fn(), saveKey: jest.fn() };
    const lit = { getKey: jest.fn() };
    const sessionConfig = {
      slug: 'edge',
      networkChainId: 11155420,
      encryption: {
        gates: {
          questionResponses: {
            type: 'sbt',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
          },
        },
      },
    };
    render(
      <SurveyTool
        {...{
          singleQuestionMode: true,
          questionID: '0xquestion',
          network: { id: 11155420 },
          networkChainId: 11155420,
          sessionSlug: 'edge',
          sessionConfig,
          lit,
          litHooks,
          preventUrlChange: true,
        }}
      />,
    );

    await screen.findByTestId('mock-survey-question');

    expect(latestProps(SurveyQuestions).lit).toBe(lit);
    expect(latestProps(SurveyQuestions).litHooks).toBe(litHooks);
    expect(latestProps(SurveyQuestions).sessionSlug).toBe('edge');
    expect(latestProps(SurveyQuestions).sessionConfig).toBe(sessionConfig);
    expect(latestProps(SurveyQuestions).networkChainId).toBe(11155420);
  });

  it('keeps extracted PileViewMode wired to the shared SurveyQuestions runtime', () => {
    const { getByTestId } = renderSurveyPileViewMode({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      isQuestionCacheReady: true,
      onFilterChange: jest.fn(),
      runtimeStrategy: createPileViewRuntimeStrategy(),
    });

    expect(getByTestId('ce-survey-filter-toggle')).toBeInTheDocument();
    expect(getByTestId('ce-survey-create-toggle-pile')).toBeInTheDocument();
    // port note: dropped prototype inheritance assertion. The coordinated
    // hooks flip intentionally removes `extends SurveyQuestions`; this guard
    // now verifies the extracted pile surface still renders through its shared
    // runtime wiring instead of pinning the class prototype chain.
  });

  it('updates the public key through the rendered single-question callback', async () => {
    SurveyQuestions.mockImplementation(({ pubKey, updatePubKey }) => (
      <button onClick={() => updatePubKey('test-public-key')}>Public key: {pubKey || 'unset'}</button>
    ));
    render(<SurveyTool singleQuestionMode questionID="0xquestion" preventUrlChange />);

    fireEvent.click(await screen.findByRole('button', { name: 'Public key: unset' }));

    expect(screen.getByRole('button', { name: 'Public key: test-public-key' })).toBeInTheDocument();
  });

  it('keeps selector and results cache nonces aligned through readiness, response, and network changes', async () => {
    let props = {
      preventUrlChange: true,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      questionResponsesNonce: 0,
      network: { id: 11155420 },
    };
    const { rerender } = render(<SurveyTool {...props} />);
    await screen.findByTestId('mock-survey-results');

    expect(latestProps(SurveySelector).questionsCacheNonce).toBe(0);
    expect(latestProps(SurveyResults).questionsCacheNonce).toBe(0);

    const updates = [
      { isQuestionCacheReady: true },
      { isResponsesCacheReady: true },
      { questionResponsesNonce: 1 },
      { network: { id: 84532 } },
    ];
    updates.forEach((update, index) => {
      props = { ...props, ...update };
      rerender(<SurveyTool {...props} />);
      expect(latestProps(SurveySelector).questionsCacheNonce).toBe(index + 1);
      expect(latestProps(SurveyResults).questionsCacheNonce).toBe(index + 1);
    });

    rerender(<SurveyTool {...props} isQuestionCacheReady={false} isResponsesCacheReady={false} />);
    expect(latestProps(SurveySelector).questionsCacheNonce).toBe(4);
    expect(latestProps(SurveyResults).questionsCacheNonce).toBe(4);
  });
});
