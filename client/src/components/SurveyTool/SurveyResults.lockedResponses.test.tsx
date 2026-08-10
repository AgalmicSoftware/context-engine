import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import ConnectedSurveyResults, {
  SURVEY_RESULTS_CLICKABLE_ICON_STYLE,
  SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE,
  SURVEY_RESULTS_METADATA_MISSING_STYLE,
  SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE,
  SURVEY_RESULTS_MINI_PROGRESS_STYLE,
  SURVEY_RESULTS_SORTABLE_HEADER_STYLE,
  SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE,
  SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE,
  SURVEY_RESULTS_TABLE_BOOKMARK_STYLE,
  SURVEY_RESULTS_TABLE_CELL_STYLE,
  SURVEY_RESULTS_TRAILING_LABEL_STYLE,
  buildSurveyResultsAggregatorPanelClassName,
  buildSurveyResultsMultichoiceOptionClassName,
  countQuestionModeResponses,
  hasAnyCountableSurveyAnswer,
  resolveSurveyResultsSyncDetailsStyle,
  resolveSurveyResultsToggleKnobStyle,
} from './SurveyResults';
import styles from './SurveyResults.module.scss';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import * as sessionScanScopeModule from '../../utilities/session/sessionScanScope.js';
import { resolveSurveyResultsQuestionReadScope } from './surveyResultsSessionResolution.js';
import { sbtBasePath } from '../../utilities/ui/terminology.js';

type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type SurveyResultsProps = Record<string, any>;
const cacheScripts: any = cacheScriptsModule;
const sessionScanScope: any = sessionScanScopeModule;

const mockSbtFilter = jest.fn((..._args: any[]) => null);
jest.mock('../SBTs/SBTFilter', () => (props: any) => {
  mockSbtFilter(props);
  return null;
});
jest.mock('./QuestionFilter', () => () => null);
const mockPolisReport = jest.fn((..._args: any[]) => null);
jest.mock('../PolisReport/PolisReport', () => (props: any) => {
  mockPolisReport(props);
  return null;
});
const mockSingleQuestionResponse = jest.fn((..._args: any[]) => null);
jest.mock('./SingleQuestionResponse', () => (props: any) => {
  mockSingleQuestionResponse(props);
  return null;
});
const mockDemoAnalysisWorkspace = jest.fn((..._args: any[]) => null);
jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDemoAnalysisWorkspace(props);
    return <div data-testid="surveyresults-demo-breakdown-view">Demo Breakdown View</div>;
  },
}));
const mockDebateMap = jest.fn((..._args: any[]) => null);
jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDebateMap(props);
    return (
      <div data-testid="surveyresults-demo-atlas-view">
        Demo Atlas View
        {props?.requestedModalNodeId ? `:${props.requestedModalNodeId}` : ''}
      </div>
    );
  },
}));
const mockRiskMatrix = jest.fn((..._args: any[]) => null);
jest.mock('../MainContent/RiskMatrix', () => ({
  __esModule: true,
  default: (props: any) => {
    mockRiskMatrix(props);
    return (
      <button
        type="button"
        data-testid="surveyresults-demo-risk-matrix-view"
        onClick={() => props?.onOpenAtlasNode?.('atlas-node-1')}
      >
        Demo Risk Matrix View
      </button>
    );
  },
}));

const SurveyResults: any = (ConnectedSurveyResults as any).WrappedComponent;

const GENERIC_GATE_MESSAGE = 'Locked responses require an eligible group. Connect an eligible account to decrypt.';
const VIEW_MODE_SWITCH_NAME = 'Toggle between individual and aggregate view';

// In-memory questionsCache seed served through the spied cacheScripts boundary.
// Shape mirrors peekCacheSync('questionsCache', slug) -> { [netId]: bucket }.
let questionsCacheBySlug: Record<string, Record<string, any>> = {};

const seedQuestionsCache = (slug: string, bucket: Record<string, any>): void => {
  questionsCacheBySlug[slug] = {
    '84532': {
      questionsLatestBlock: 1,
      questionResponsesLatestBlock: 1,
      questions: {},
      questionResponses: {},
      ...bucket,
    },
  };
};

/** Mount the real (unconnected) SurveyResults through the shared harness. */
const mountSurveyResults = (props: Record<string, any> = {}) =>
  renderSurveyResults({
    isOpen: true,
    isQuestionCacheReady: true,
    preventUrlChange: true,
    ...props,
  });

/** Switch the open survey-mode results view from individuals to aggregate. */
const switchToAggregateView = async (): Promise<void> => {
  const viewSwitch = await screen.findByRole('switch', { name: VIEW_MODE_SWITCH_NAME });
  fireEvent.click(viewSwitch);
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: VIEW_MODE_SWITCH_NAME })).toHaveAttribute('aria-checked', 'true');
  });
  return { promise, resolve, reject };
};

/** Inject filtered response data through the recorded SBTFilter onFilter seam. */
const injectSbtFilteredResponses = (payload: unknown, sbtFilterState: Record<string, unknown> = {}): void => {
  const calls = mockSbtFilter.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const sbtFilterProps = calls[calls.length - 1][0] as Record<string, any>;
  act(() => {
    sbtFilterProps.onFilter(payload, sbtFilterState);
  });
  return subject;
};

const buildLockedAggregatorRow = (responder: string, answerOverrides: Record<string, unknown> = {}) => ({
  responder,
  response: {
    questionID: 'q1',
    answer: {
      value: '*',
      encrypted: true,
      ciphertext: `cipher-${responder}`,
      ...answerOverrides,
    },
    timeStamp: 1,
  },
});

beforeEach(() => {
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
});

describe('SurveyResults locked responses banner', () => {
  beforeEach(() => {
    localStorage.clear();
    questionsCacheBySlug = {};
    // Cache boundary: serve seeded questionsCache buckets, nothing else.
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((...args: any[]) => {
      const [namespace, slug] = args;
      return String(namespace) === 'questionsCache' ? (questionsCacheBySlug[String(slug ?? '')] ?? null) : null;
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);
    // Keep mount-time manual refresh off the network.
    jest.spyOn(contractScriptsDefault as any, 'getLatestBlockNumber').mockResolvedValue(0);
  });

describe('SurveyResults locked responses banner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    try {
      window.history.replaceState({}, '', '/');
    } catch (_) {
      /* noop */
    }
  });

  it('renders a compact locked-response toggle while details stay collapsed by default', () => {
    render(
      <LockedToggle
        isOpen={false}
        lockedModel={{
          lockedCount: 6,
          gateDetails: [
            {
              address: '0x1111111111111111111111111111111111111111',
              href: 'https://example.com/sbt/0x1111111111111111111111111111111111111111',
              label: 'Session Access Pass',
            },
          ],
        }}
        onToggleDetails={jest.fn()}
      />,
    );
    const { container: bannerContainer } = render(
      <LockedBanner
        decrypting={false}
        isOpen={false}
        lockedModel={{
          lockedCount: 6,
          gateDetails: [],
        }}
        onDecrypt={jest.fn()}
      />,
    );

    expect(summaryToggle).toBeTruthy();
    expect(summaryToggle.props['aria-label']).toBe('Show 6 locked responses');
    expect(summaryToggle.props['aria-expanded']).toBe(false);
    expect(treeHasText(summaryToggle, '6')).toBe(true);
    expect(detailCard).toBeNull();
  });

  it('shows gate links and decrypt controls when expanded', () => {
    render(
      <LockedBanner
        decrypting={false}
        isOpen
        lockedModel={{
          lockedCount: 2,
          gateDetails: [
            {
              address: '0x2222222222222222222222222222222222222222',
              href: 'https://example.com/sbt/0x2222222222222222222222222222222222222222',
              label: 'Contributor SBT',
            },
          ],
        }}
        onDecrypt={jest.fn()}
      />,
    );

    const decryptButton = screen.getByTestId('ce-results-decrypt-btn');
    expect(decryptButton).toHaveTextContent('Decrypt');
    expect(screen.getByRole('heading', { name: '2 Locked Responses' })).toBeInTheDocument();
    expect(screen.getByText('Required Group for decryption')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contributor SBT' })).toHaveAttribute(
      'href',
      'https://example.com/sbt/0x2222222222222222222222222222222222222222',
    );
  });

  it('keeps decrypt controls display-only and disables them while parent decrypt is running', () => {
    const onDecrypt = jest.fn();
    const lockedModel = {
      lockedCount: 1,
      gateDetails: [],
    };
    const view = render(<LockedBanner decrypting isOpen lockedModel={lockedModel} onDecrypt={onDecrypt} />);

    const decryptButton = screen.getByTestId('ce-results-decrypt-btn');
    expect(decryptButton).toBeDisabled();
    expect(decryptButton).toHaveTextContent('Decrypt');
    fireEvent.click(decryptButton);
    expect(onDecrypt).not.toHaveBeenCalled();

    // port note: dropped onClick === handleDecryptLockedResponses reference-identity check; replaced with the behavior it guarded — disabled clicks never fire the parent handler, enabled clicks fire it exactly once.
    view.rerender(<LockedBanner decrypting={false} isOpen lockedModel={lockedModel} onDecrypt={onDecrypt} />);
    fireEvent.click(screen.getByTestId('ce-results-decrypt-btn'));
    expect(onDecrypt).toHaveBeenCalledTimes(1);
  });

  it('keeps parent-rendered locked toggle and banner wired to parent handlers', async () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(null);
    mountSurveyResults({ viewMode: 'survey' });
    await switchToAggregateView();

    injectSbtFilteredResponses({
      q1: [
        buildLockedAggregatorRow('0xaaa0000000000000000000000000000000000001'),
        buildLockedAggregatorRow('0xaaa0000000000000000000000000000000000002'),
        buildLockedAggregatorRow('0xaaa0000000000000000000000000000000000003'),
      ],
    });
    const decryptButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-results-decrypt-btn'
    );
    const gateLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href === 'https://example.com/sbt/0x2222222222222222222222222222222222222222'
    );
    const markup = renderToStaticMarkup(tree);

    // port note: dropped toggle/decrypt onClick reference-identity checks and getMemoizedLockedResponsesModel.toHaveBeenCalledWith({}) — no behavioral seam for instance-method identity/arguments; click-driven assertions below verify the same wiring.
    const toggle = await screen.findByTestId('ce-results-locked-toggle');
    expect(toggle.closest('.modal-header')).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Show 3 locked responses');

    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByTestId('ce-results-locked-toggle')).toHaveAttribute('aria-expanded', 'true');
    });
    expect(screen.getByTestId('ce-results-locked-toggle')).toHaveAttribute('aria-label', 'Hide 3 locked responses');
    expect(screen.getByTestId('ce-results-locked-banner')).toBeInTheDocument();

    const decryptButton = screen.getByTestId('ce-results-decrypt-btn');
    expect(decryptButton).toBeEnabled();
    fireEvent.click(decryptButton);
    // Decrypt wiring proof: the parent handler's login gate raises the alert.
    expect(await screen.findByText('Login required to decrypt locked responses.')).toBeInTheDocument();

    // Toggle wiring proof in the collapse direction too.
    fireEvent.click(screen.getByTestId('ce-results-locked-toggle'));
    await waitFor(() => {
      expect(screen.queryByTestId('ce-results-locked-banner')).toBeNull();
    });
  });

  it('resolves SBT details from configured session gates before falling back to generic copy', () => {
    const subject = createSubject({
      network: { id: 84532 },
    });
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');

    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue({
      sponsored: {
        resources: {
          questionResponses: { gateId: 'contributors' },
          default: { gateId: 'contributors' },
        },
        gates: {
          contributors: {
            label: 'Contributor Access',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
          },
        },
      },
    });
    jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel').mockReturnValue('Contributor Pass');

    const model = subject.buildLockedGateDetails(
      [
        { questionId: 'q1' },
      ],
      {
        q1: {
          encryption: {
            enabled: true,
            gate: {
              gateId: 'contributors',
              resourceKey: 'questionResponses',
            },
          },
        },
      },
      questionResponses: {
        q1: {
          '0xresponder0000000000000000000000000000000001': {
            questionID: 'q1',
            answer: { value: '*', encrypted: true, ciphertext: 'cipher-q1' },
            timeStamp: 1,
          },
        },
      },
    });

    mountSurveyResults({ viewMode: 'questions', sessionSlug: 'session-slug' });

    const toggle = await screen.findByTestId('ce-results-locked-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Show 1 locked response');
    fireEvent.click(toggle);

    // port note: dropped deep equality on model.gateDetails / model.hasGenericGateMessage — asserted via their rendered projection (gate link label + href, no generic copy); exact model shape belongs in a pure helper test once buildLockedGateDetails is extracted.
    const gateLink = await screen.findByRole('link', { name: 'Contributor Pass' });
    expect(gateLink).toHaveAttribute(
      'href',
      buildSbtDetailPath('0x1111111111111111111111111111111111111111', 'session-slug'),
    );

    expect(model.hasGenericGateMessage).toBe(false);
    expect(model.gateDetails).toEqual([
      expect.objectContaining({
        address: '0x1111111111111111111111111111111111111111',
        label: 'Contributor Pass',
        href: buildSbtDetailPath('0x1111111111111111111111111111111111111111', 'session-slug'),
      }),
    ]);
  });

  it('can resolve named SBT links from gate sbt objects when address arrays are absent', () => {
    const subject = createSubject({
      network: { id: 84532 },
    });
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');

    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue({
      sponsored: {
        gates: {
          contributors: {
            sbts: [
              {
                address: '0x3333333333333333333333333333333333333333',
                name: 'Contributor Pass',
              },
            ],
          },
        },
      },
    });
    jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel').mockReturnValue('');

    const model = subject.buildLockedGateDetails(
      [
        { questionId: 'q1' },
      ],
      {
        q1: {
          encryption: {
            enabled: true,
            gate: {
              gateId: 'contributors',
              resourceKey: 'questionResponses',
            },
          },
        },
      },
      questionResponses: {
        q1: {
          '0xresponder0000000000000000000000000000000001': {
            questionID: 'q1',
            answer: { value: '*', encrypted: true, ciphertext: 'cipher-q1' },
            timeStamp: 1,
          },
        },
      },
    });

    mountSurveyResults({ viewMode: 'questions', sessionSlug: 'session-slug' });

    const toggle = await screen.findByTestId('ce-results-locked-toggle');
    fireEvent.click(toggle);

    // port note: dropped deep equality on model.gateDetails / model.hasGenericGateMessage — asserted via the rendered gate link sourced from the sbt object name (resolveSbtDisplayLabel returns '').
    const gateLink = await screen.findByRole('link', { name: 'Contributor Pass' });
    expect(gateLink).toHaveAttribute(
      'href',
      buildSbtDetailPath('0x3333333333333333333333333333333333333333', 'session-slug'),
    );

    expect(model.hasGenericGateMessage).toBe(false);
    expect(model.gateDetails).toEqual([
      expect.objectContaining({
        address: '0x3333333333333333333333333333333333333333',
        label: 'Contributor Pass',
        href: buildSbtDetailPath('0x3333333333333333333333333333333333333333', 'session-slug'),
      }),
    ]);
  });

  it('does not show the generic decrypt message when named gate details are available', () => {
    render(
      <LockedBanner
        isOpen
        lockedModel={{
          lockedCount: 1,
          gateDetails: [
            {
              address: '0x1111111111111111111111111111111111111111',
              href: `${sbtBasePath()}/0x1111111111111111111111111111111111111111`,
              label: 'Contributor Pass',
            },
          ],
          hasGenericGateMessage: true,
        }}
        onDecrypt={jest.fn()}
      />,
    );

    const tree = subject.renderLockedResponsesBanner({
      lockedCount: 1,
      gateDetails: [
        {
          address: '0x1111111111111111111111111111111111111111',
          href: `${sbtBasePath()}/0x1111111111111111111111111111111111111111`,
          label: 'Contributor Pass',
        },
      ],
      hasGenericGateMessage: true,
    });

    expect(treeHasText(tree, 'Contributor Pass')).toBe(true);
    expect(treeHasText(tree, 'Locked responses require an eligible group. Connect an eligible account to decrypt.')).toBe(false);
  });

  it('uses terminology-aware generic decrypt messaging when gate details are unavailable', () => {
    render(
      <LockedBanner
        isOpen
        lockedModel={{
          lockedCount: 1,
          gateDetails: [],
          hasGenericGateMessage: true,
        }}
        onDecrypt={jest.fn()}
      />,
    );

    const tree = subject.renderLockedResponsesBanner({
      lockedCount: 1,
      gateDetails: [],
      hasGenericGateMessage: true,
    });

    expect(treeHasText(tree, 'Locked responses require an eligible group. Connect an eligible account to decrypt.')).toBe(true);
  });

  it('uses terminology-aware decrypt failure alerts when locked responses stay encrypted', async () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(null);
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockRejectedValue(new Error('decrypt denied'));

    mountSurveyResults({
      viewMode: 'survey',
      loginComplete: true,
      account: '0xabc',
      provider: 'mock-provider',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({}));
    subject.getMemoizedLockedResponsesModel = jest.fn(() => ({
      lockedRows: [{
        key: 'row-1',
        response: { answer: {} },
        mergedResponse: { answer: { locked: true } },
      }],
    }));
    subject.decryptFieldValue = jest.fn().mockResolvedValue({ ok: false });

    await subject.handleDecryptLockedResponses();

    const decryptButton = await screen.findByTestId('ce-results-decrypt-btn');
    fireEvent.click(decryptButton);

    // port note: dropped subject.state.alertMessage read — the failure alert is asserted where users see it, rendered through SurveyResultsStatusMessages.
    expect(
      await screen.findByText('Unable to decrypt locked responses with the connected account.'),
    ).toBeInTheDocument();
    expect(decryptSpy).toHaveBeenCalled();
  });

  it('skips the locked banner model for self-encrypted responses without gate access rules', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.getEffectiveSlug = jest.fn(() => '');
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyViewMode: 'aggregate',
      sbtFilteredResponses: [],
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xabc',
            response: {
              questionID: 'q1',
              answer: {
                value: '*',
                encrypted: true,
                encryptionAudience: 'self',
              },
            },
          },
        ],
      },
    };

    const model = subject.getMemoizedLockedResponsesModel({
      q1: { id: 'q1', type: 'freeform', encryption: { enabled: false } },
    });

    expect(model.lockedCount).toBe(0);
    expect(model.lockedRows).toEqual([]);
    expect(model.gateDetails).toEqual([]);
    expect(model.hasGenericGateMessage).toBe(false);
  });
});

describe('SurveyResults module styles', () => {
  it('keeps the results modal light while giving the locked banner its own dark high-contrast card', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.resultsModal\s*{[\s\S]*?background-color:\s*var\(--ce-color-white\);/);
    expect(scss).toMatch(/\.modalBody\s*{[\s\S]*?color:\s*var\(--ce-color-black\) !important;/);
    expect(scss).toMatch(
      /\.surveyDocUrlLink\s*{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--ce-status-info\) 8%,\s*transparent\);[\s\S]*?color:\s*var\(--ce-status-info\);/,
    );
    expect(scss).toMatch(/\.aggregatorSummaryCard\s*{[\s\S]*?background-color:\s*transparent !important;/);
    expect(scss).not.toMatch(/\.aggregatorSummaryCard\s*{[\s\S]*?background-color:\s*#dce3f7 !important;/);
    expect(scss).toMatch(
      /\.aggregatorSummaryCard:not\(:has\(\.surveyResultsResponseCard\)\) \.questionSummaryHeader\s*{[\s\S]*?border-radius:\s*var\(--ce-radius-12\) !important;/,
    );
    expect(scss).toMatch(
      /\.surveyResultsResponseCard\s*{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--ce-status-info\) 98%,\s*transparent\) !important;[\s\S]*?border-top:\s*0 !important;[\s\S]*?border-radius:\s*var\(--ce-radius-0\) var\(--ce-radius-0\) var\(--ce-radius-12\) var\(--ce-radius-12\) !important;/,
    );
    expect(scss).toMatch(/\.surveyResultsResponseCardBody\s*{[\s\S]*?padding:\s*0 !important;/);
    expect(scss).toMatch(
      /\.surveyResultsAggregatorPanel\s*{[\s\S]*?background:\s*transparent !important;[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*var\(--ce-radius-0\);/,
    );
    expect(scss).toMatch(
      /\.lockedBanner\s*{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--ce-overlay-surface\) 96%,\s*transparent\);[\s\S]*?border-left:\s*4px solid color-mix\(in srgb,\s*var\(--ce-action-accent\) 70%,\s*transparent\);[\s\S]*?color:\s*var\(--ce-color-panel-text\);/,
    );
    expect(scss).toMatch(/\.lockedBannerCaret\s*{[\s\S]*?margin:\s*8px 0 0 auto;[\s\S]*?padding:\s*0;/);
    expect(scss).toMatch(
      /\.lockedBannerDetails\s*{[\s\S]*?border-top:\s*1px solid color-mix\(in srgb,\s*var\(--ce-text-inverse\) 12%,\s*transparent\);/,
    );
    expect(scss).not.toMatch(/\.filterSummaryBox\s*{[\s\S]*?background:\s*rgba\(10,\s*14,\s*43,\s*0\.82\);/);
  });

  it('keeps survey-results controls readable on the light modal surface', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.toggleLabel\s*{[\s\S]*?color:\s*var\(--ce-document-text\);/);
    expect(scss).toMatch(/\.exportAndFilterContainer\s*{[\s\S]*?background:\s*var\(--ce-status-info-text\);/);
    expect(scss).toMatch(
      /\.questionFilterButton\s*{[\s\S]*?background-color:\s*var\(--ce-document-text\) !important;[\s\S]*?color:\s*var\(--ce-document-surface\) !important;/,
    );
    expect(scss).toMatch(/\.filterSummaryBox\s*{[\s\S]*?color:\s*var\(--ce-document-text-muted\);/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface,\s*\.demoResultsRiskMatrixSurface\s*{[\s\S]*?padding:\s*1rem;/);
    expect(scss).toMatch(
      /\.demoResultsAtlasSurface,\s*\.demoResultsRiskMatrixSurface\s*{[\s\S]*?border:\s*1px solid color-mix\(in srgb,\s*var\(--ce-overlay-surface\) 20%,\s*transparent\);/,
    );
    expect(normalizedScss).toMatch(
      /\.demoResultsAtlasSurface\s*{[^}]*background:\s*[^;]*linear-gradient\(180deg,[^;]*var\(--ce-overlay-surface\) 98%[^;]*var\(--ce-overlay-base\) 99\.5%[^;]*;/,
    );
    expect(scss).not.toMatch(/\.demoResultsAtlasSurface\s*{[^}]*radial-gradient\(circle at top/);
    expect(normalizedScss).toMatch(
      /\.demoResultsRiskMatrixSurface\s*{[^}]*background:\s*[^;]*linear-gradient\(180deg,[^;]*var\(--ce-overlay-surface\) 98%[^;]*var\(--ce-overlay-base\) 99\.5%[^;]*;/,
    );
  });
});
