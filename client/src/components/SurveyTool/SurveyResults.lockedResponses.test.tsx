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

const createSubject = (props: SurveyResultsProps = {}): any =>
  new SurveyResults({
    network: { id: 84532 },
    ...props,
  });

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const attachStateHarness = (subject: any): any => {
  subject.setState = jest.fn((updater, cb) => {
    const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject;
};

const findElement = (node: TreeNode, predicate: TreePredicate): TreeNode | null => {
  const stack: TreeNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const collectTreeNodes = (
  node: TreeNode,
  predicate: TreePredicate,
  acc: TreeNode[] = []
): TreeNode[] => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const normalizeChildren = (children: TreeNode): TreeNode[] => {
  if (children == null) return [];
  if (Array.isArray(children)) return children.filter(Boolean);
  return [children].filter(Boolean);
};

const renderSubjectTree = (subject: any) => (
  render(
    <MemoryRouter>
      {subject.render()}
    </MemoryRouter>
  )
);

beforeEach(() => {
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
});

const treeHasText = (node: TreeNode, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

describe('SurveyResults locked responses banner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a compact locked-response toggle while details stay collapsed by default', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponsesDecrypting: false,
      lockedResponseDetailsOpen: false,
    };

    const toggle = subject.renderLockedResponsesToggle({
      lockedCount: 6,
      gateDetails: [
        {
          address: '0x1111111111111111111111111111111111111111',
          href: 'https://example.com/sbt/0x1111111111111111111111111111111111111111',
          label: 'Session Access Pass',
        },
      ],
    });
    const detailCard = subject.renderLockedResponsesBanner({
      lockedCount: 6,
      gateDetails: [],
    });

    const summaryToggle = findElement(
      toggle,
      (element) => element?.props?.['data-testid'] === 'ce-results-locked-toggle'
    );

    expect(summaryToggle).toBeTruthy();
    expect(summaryToggle.props['aria-label']).toBe('Show 6 locked responses');
    expect(summaryToggle.props['aria-expanded']).toBe(false);
    expect(treeHasText(summaryToggle, '6')).toBe(true);
    expect(detailCard).toBeNull();
  });

  it('shows gate links and decrypt controls when expanded', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponsesDecrypting: false,
      lockedResponseDetailsOpen: true,
    };

    const tree = subject.renderLockedResponsesBanner({
      lockedCount: 2,
      gateDetails: [
        {
          address: '0x2222222222222222222222222222222222222222',
          href: 'https://example.com/sbt/0x2222222222222222222222222222222222222222',
          label: 'Contributor SBT',
        },
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

    expect(decryptButton).toBeTruthy();
    expect(treeHasText(decryptButton, 'Decrypt')).toBe(true);
    expect(treeHasText(tree, 'Locked Responses')).toBe(true);
    expect(treeHasText(tree, '2')).toBe(true);
    expect(treeHasText(tree, 'Contributor SBT')).toBe(true);
    expect(markup).toContain('Required Group for decryption');
    expect(gateLink).toBeTruthy();
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
      }
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
      }
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
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponseDetailsOpen: true,
    };

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
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponseDetailsOpen: true,
    };

    const tree = subject.renderLockedResponsesBanner({
      lockedCount: 1,
      gateDetails: [],
      hasGenericGateMessage: true,
    });

    expect(treeHasText(tree, 'Locked responses require an eligible group. Connect an eligible account to decrypt.')).toBe(true);
  });

  it('uses terminology-aware decrypt failure alerts when locked responses stay encrypted', async () => {
    const subject = createSubject({
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

    expect(subject.state.alertMessage).toBe('Unable to decrypt locked responses with the connected account.');
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
    expect(scss).toMatch(/\.surveyDocUrlLink\s*{[\s\S]*?background:\s*rgba\(26,\s*115,\s*232,\s*0\.08\);[\s\S]*?color:\s*#174ea6;/);
    expect(scss).toMatch(/\.aggregatorSummaryCard\s*{[\s\S]*?background-color:\s*var\(--ce-color-surface\) !important;/);
    expect(scss).not.toMatch(/\.aggregatorSummaryCard\s*{[\s\S]*?background-color:\s*#dce3f7 !important;/);
    expect(scss).toMatch(/\.surveyResultsResponseCard\s*{[\s\S]*?background:\s*rgba\(50,\s*56,\s*117,\s*0\.96\) !important;/);
    expect(scss).toMatch(/\.surveyResultsResponseCardBody\s*{[\s\S]*?padding:\s*0 !important;/);
    expect(scss).toMatch(/\.surveyResultsAggregatorPanel\s*{[\s\S]*?background:\s*rgba\(30,\s*36,\s*94,\s*0\.92\);/);
    expect(scss).toMatch(/\.lockedBanner\s*{[\s\S]*?background:\s*rgba\(23,\s*25,\s*65,\s*0\.96\);[\s\S]*?border-left:\s*4px solid rgba\(77,\s*255,\s*164,\s*0\.7\);[\s\S]*?color:\s*(?:var\(--ce-color-panel-text\)|#f4f7ff);/);
    expect(scss).toMatch(/\.lockedBannerCaret\s*{[\s\S]*?margin:\s*8px 0 0 auto;[\s\S]*?padding:\s*0;/);
    expect(scss).toMatch(/\.lockedBannerDetails\s*{[\s\S]*?border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.12\);/);
    expect(scss).not.toMatch(/\.filterSummaryBox\s*{[\s\S]*?background:\s*rgba\(10,\s*14,\s*43,\s*0\.82\);/);
  });

  it('keeps survey-results controls readable on the light modal surface', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.toggleLabel\s*{[\s\S]*?color:\s*#1f2733;/);
    expect(scss).toMatch(/\.exportAndFilterContainer\s*{[\s\S]*?background:\s*#f3f5f9;/);
    expect(scss).toMatch(/\.questionFilterButton\s*{[\s\S]*?background-color:\s*#1f2733 !important;[\s\S]*?color:\s*#f8fafc !important;/);
    expect(scss).toMatch(/\.filterSummaryBox\s*{[\s\S]*?color:\s*#4b5563;/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface,\s*\.demoResultsRiskMatrixSurface\s*{[\s\S]*?padding:\s*1rem;/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface,\s*\.demoResultsRiskMatrixSurface\s*{[\s\S]*?border:\s*1px solid rgba\(19,\s*34,\s*86,\s*0\.2\);/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface\s*{[^}]*background:\s*[^;]*linear-gradient\(180deg,[^;]*rgba\(21,\s*31,\s*74,\s*0\.98\)[^;]*rgba\(8,\s*12,\s*28,\s*0\.995\)[^;]*;/);
    expect(scss).not.toMatch(/\.demoResultsAtlasSurface\s*{[^}]*radial-gradient\(circle at top/);
    expect(scss).toMatch(/\.demoResultsRiskMatrixSurface\s*{[^}]*background:\s*[^;]*linear-gradient\(180deg,[^;]*rgba\(23,\s*25,\s*65,\s*0\.98\)[^;]*rgba\(9,\s*13,\s*30,\s*0\.995\)[^;]*;/);
  });
});
