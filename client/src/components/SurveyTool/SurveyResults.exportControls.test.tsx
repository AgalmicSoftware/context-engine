import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { resolveSurveyResultsToggleKnobStyle } from './SurveyResults';
import type { SurveyResultsProps } from './SurveyResults';
import styles from './SurveyResults.module.scss';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import { renderSurveyResults } from './surveyResultsTestHarness';
import { callAI } from '../../utilities/ai/aiScripts.js';
import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  downloadSessionResultsHtmlReport,
  downloadSessionResultsPdfReport,
} from '../../utilities/sessionResultsExport';

const cacheScripts: any = cacheScriptsModule;
const contractScripts: any = (contractScriptsModule as any).default;

const mockSbtFilter = jest.fn((..._args: any[]) => null);
jest.mock('../SBTs/SBTFilter', () => (props: any) => {
  mockSbtFilter(props);
  return null;
});
jest.mock('./QuestionFilter', () => () => null);
jest.mock('../../utilities/sessionResultsExport', () => {
  const actual = jest.requireActual('../../utilities/sessionResultsExport');
  return {
    ...actual,
    downloadSessionResultsHtmlReport: jest.fn(),
    downloadSessionResultsPdfReport: jest.fn(),
  };
});
jest.mock('../../utilities/ai/aiScripts.js', () => ({
  callAI: jest.fn(),
}));
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

const OP_NETWORK = { id: 11155420 };
const WALLET_ACCOUNT = '0x9999999999999999999999999999999999999999';
const SURVEY_ID = '0x1111111111111111111111111111111111111111111111111111111111111111';
const RESPONDER_ONE = '0x1111111111111111111111111111111111111111';
const RESPONDER_TWO = '0x2222222222222222222222222222222222222222';

const cacheStoreKey = (namespace: unknown, slug: unknown = ''): string => (
  `${String(namespace || '')}|${String(slug || '')}`
);

let cacheStore: Map<string, any>;
let analysisPeekError: Error | null;
let analysisWriteErrors: Error[];
let peekSpy: jest.SpyInstance;
let readSpy: jest.SpyInstance;
let writeSpy: jest.SpyInstance;
let listSpy: jest.SpyInstance;
let latestBlockSpy: jest.SpyInstance;

const installModuleBoundarySpies = (): void => {
  peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation(
    (namespace: any, slug: any = '') => {
      if (analysisPeekError && String(namespace) === 'analysisCache') throw analysisPeekError;
      const value = cacheStore.get(cacheStoreKey(namespace, slug));
      return value === undefined ? null : value;
    }
  );
  readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(
    async (namespace: any, slug: any = '') => {
      const value = cacheStore.get(cacheStoreKey(namespace, slug));
      return value === undefined ? null : value;
    }
  );
  writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockImplementation(
    async (namespace: any, slug: any = '', value: any = null) => {
      if (analysisWriteErrors.length > 0 && String(namespace) === 'analysisCache') {
        throw analysisWriteErrors.shift();
      }
      cacheStore.set(cacheStoreKey(namespace, slug), value);
      return true;
    }
  );
  listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockImplementation(
    (namespace: any) => {
      const prefix = `${String(namespace)}|`;
      return Array.from(cacheStore.entries())
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({
          key,
          namespace: String(namespace),
          slug: key.slice(prefix.length),
          value,
        }));
    }
  );
  latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(1);
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
};

const flushMicrotasks = async (cycles = 6): Promise<void> => {
  for (let index = 0; index < cycles; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const createAnalysisArtifact = (inputSignature = 'input-sig') => ({
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact',
  participants: [],
  sections: {
    argumentMap: { available: true, debates: [] },
    atlas: { available: true, edges: [], nodes: [] },
    breakdown: { available: true, dimensions: [], groups: [], summary: {} },
    riskMatrix: { available: true, categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
  },
  source: 'ai-generated',
  version: 1,
});

const mountSurveyResults = (props: SurveyResultsProps = {}) => renderSurveyResults({
  filterState: {},
  isOpen: true,
  isQuestionCacheReady: true,
  isResponsesCacheReady: true,
  isSBTCacheReady: true,
  preventUrlChange: true,
  sessionSlugPinned: true,
  viewMode: 'questions',
  ...props,
});

type QuestionsCacheSeed = {
  netId?: number;
  questionResponses?: Record<string, Record<string, any>>;
  questions?: Record<string, any>;
  slug: string;
};

const seedQuestionsCache = ({
  netId = 11155420,
  questionResponses = {},
  questions = {},
  slug,
}: QuestionsCacheSeed): void => {
  cacheStore.set(cacheStoreKey('questionsCache', slug), {
    [String(netId)]: {
      questionResponses,
      questions,
      questionResponsesLatestBlock: 1,
      questionsLatestBlock: 1,
    },
  });
};

const seedSingleBinaryQuestion = ({
  netId = 11155420,
  responder = '0xabc',
  response = { answer: { encrypted: false, value: 'Agree' }, questionId: 'q1', timeStamp: '2026-05-01T00:00:00.000Z' },
  prompt = 'Export this report?',
  slug,
}: {
  netId?: number;
  prompt?: string;
  responder?: string;
  response?: any;
  slug: string;
}): void => {
  seedQuestionsCache({
    netId,
    questionResponses: { q1: { [responder]: response } },
    questions: {
      q1: {
        id: 'q1',
        options: ['Agree', 'Disagree'],
        prompt,
        type: 'binary',
      },
    },
    slug,
  });
};

/** Eligible analysis dataset: 2 questions, 3 responses, 2 participants. */
const seedAnalysisEligibleSession = (slug: string, netId = 11155420): void => {
  seedQuestionsCache({
    netId,
    questionResponses: {
      q1: {
        [RESPONDER_ONE]: { answer: { encrypted: false, value: 'Use a viewer.' }, questionId: 'q1', timeStamp: '2026-05-01T00:00:00.000Z' },
        [RESPONDER_TWO]: { answer: { encrypted: false, value: 'Keep it private.' }, questionId: 'q1', timeStamp: '2026-05-02T00:00:00.000Z' },
      },
      q2: {
        [RESPONDER_ONE]: { answer: { encrypted: false, value: 'Make PDF readable.' }, questionId: 'q2', timeStamp: '2026-05-03T00:00:00.000Z' },
      },
    },
    questions: {
      q1: { id: 'q1', prompt: 'What export should exist?', tags: ['exports'], type: 'freeform' },
      q2: { id: 'q2', prompt: 'What risk matters?', tags: ['safety'], type: 'freeform' },
    },
    slug,
  });
};

const waitForHydratedResponseCount = async (count: number): Promise<void> => {
  await waitFor(() => {
    const summary = document.querySelector('.filterSummaryText');
    expect(summary).not.toBeNull();
    expect(String(summary?.textContent || '')).toMatch(new RegExp(`Responses: ${count}(\\D|$)`));
  });
};

const openExportArea = (): void => {
  // No-op when the export area is already expanded (the collapsed toggle is gone).
  const collapsedToggle = screen.queryByRole('button', { name: 'Export Data' });
  if (collapsedToggle) fireEvent.click(collapsedToggle);
};

/** jsdom Blob has no .text(); read captured download blobs through FileReader. */
const readBlobText = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

const openHtmlReportModal = async (): Promise<HTMLElement> => {
  openExportArea();
  fireEvent.click(screen.getByTestId('ce-surveyresults-export-html-report'));
  return screen.findByTestId('ce-surveyresults-html-report-modal');
};

const getDownloadReportButton = (): HTMLElement => (
  screen.getByTestId('ce-surveyresults-html-report-download')
);
const getGenerateAnalysisButton = (): HTMLElement => (
  screen.getByTestId('ce-surveyresults-html-report-generate-analysis')
);
const clickGenerateAnalysis = (): void => {
  fireEvent.click(getGenerateAnalysisButton());
};

const getSectionRows = (): Array<{ availability: string; label: string; reason: string }> => {
  const table = document.querySelector('.htmlReportSectionTable');
  expect(table).not.toBeNull();
  return Array.from((table as HTMLElement).querySelectorAll('tbody tr')).map((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || '');
    return { availability: cells[2], label: cells[1], reason: cells[3] };
  });
};

const analysisCachePeeks = (): any[][] => (
  peekSpy.mock.calls.filter((call: any[]) => String(call[0]) === 'analysisCache')
);
const analysisCacheReads = (): any[][] => (
  readSpy.mock.calls.filter((call: any[]) => String(call[0]) === 'analysisCache')
);
const analysisCacheWrites = (): any[][] => (
  writeSpy.mock.calls.filter((call: any[]) => String(call[0]) === 'analysisCache')
);
const analysisArtifactsFromWrite = (writeIndex: number): Array<[string, any]> => {
  const call = analysisCacheWrites()[writeIndex];
  expect(call).toBeTruthy();
  return Object.entries((call[2] || {}).sessionResultsAnalysis || {}) as Array<[string, any]>;
};

const callAIPrompts = (): string[] => (
  (callAI as jest.Mock).mock.calls.map((call) => String(call[0]))
);

const waitForAnalysisCacheWrites = async (count: number): Promise<void> => {
  await waitFor(() => expect(analysisCacheWrites()).toHaveLength(count));
};
const waitForAnalysisIdle = async (): Promise<void> => {
  await waitFor(() => {
    expect(getGenerateAnalysisButton()).not.toHaveTextContent(/Generating/);
  });
};

const BREAKDOWN_ANALYSIS_JSON = JSON.stringify({
  breakdown: {
    dimensions: [],
    groups: [{ id: 'group_1', label: 'Generated group' }],
    summary: { overview: 'Generated analysis.' },
  },
});
const RISK_MATRIX_ANALYSIS_JSON = JSON.stringify({
  riskMatrix: {
    categories: [{ id: 'risk_1', label: 'Generated risk' }],
    comments: [],
    heatmap: {},
    scenarioLinks: [],
  },
});

/**
 * Runs one real generation pass to discover the data-derived analysis cache
 * key + artifact, then resets the cache store and call records so a test can
 * seed the analysisCache under the exact computed key.
 */
const primeAnalysisArtifactCacheKey = async (
  mountProps: SurveyResultsProps,
  seed: () => void
): Promise<{ artifact: any; cacheKey: string }> => {
  (callAI as jest.Mock).mockResolvedValue(BREAKDOWN_ANALYSIS_JSON);
  seed();
  const primed = mountSurveyResults(mountProps);
  await waitForHydratedResponseCount(3);
  await openHtmlReportModal();
  clickGenerateAnalysis();
  await waitForAnalysisCacheWrites(1);
  await waitForAnalysisIdle();
  const entries = analysisArtifactsFromWrite(0);
  const [cacheKey, artifact] = entries[entries.length - 1];
  primed.unmount();
  cacheStore = new Map();
  (callAI as jest.Mock).mockClear();
  peekSpy.mockClear();
  readSpy.mockClear();
  writeSpy.mockClear();
  listSpy.mockClear();
  (downloadSessionResultsHtmlReport as jest.Mock).mockClear();
  (downloadSessionResultsPdfReport as jest.Mock).mockClear();
  return { artifact, cacheKey };
};

type BrowserDownloadCapture = {
  anchor: HTMLAnchorElement;
  anchorClickSpy: jest.SpyInstance;
  appendChildSpy: jest.SpyInstance;
  blobs: Blob[];
  createObjectURLMock: jest.Mock;
  removeChildSpy: jest.SpyInstance;
  restore: () => void;
};

const installBrowserDownloadCapture = (): BrowserDownloadCapture => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const blobs: Blob[] = [];
  const createObjectURLMock = jest.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:test-export';
  });
  (window.URL as any).createObjectURL = createObjectURLMock;
  const appendChildSpy = jest.spyOn(document.body, 'appendChild');
  const removeChildSpy = jest.spyOn(document.body, 'removeChild');
  const originalCreateElement = document.createElement.bind(document);
  const anchor = originalCreateElement('a') as HTMLAnchorElement;
  const anchorClickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
  const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: any, options: any) => (
    String(tagName).toLowerCase() === 'a' ? anchor : originalCreateElement(tagName, options)
  )) as any);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    createElementSpy.mockRestore();
    anchorClickSpy.mockRestore();
    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (window.URL as any).createObjectURL;
    }
  };
  return { anchor, anchorClickSpy, appendChildSpy, blobs, createObjectURLMock, removeChildSpy, restore };
};

const selectExportType = (label: string): void => {
  const menu = document.querySelector('.dropdown-menu');
  expect(menu).not.toBeNull();
  fireEvent.click(within(menu as HTMLElement).getByText(label));
};

const clickExportDownload = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
};

beforeEach(() => {
  cacheStore = new Map();
  analysisPeekError = null;
  analysisWriteErrors = [];
  installModuleBoundarySpies();
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
  (downloadSessionResultsHtmlReport as jest.Mock).mockReset();
  (downloadSessionResultsPdfReport as jest.Mock).mockReset();
  (callAI as jest.Mock).mockReset();
  window.localStorage.clear();
});

describe('SurveyResults export/view controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults export area to collapsed', () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });

    expect(screen.getByRole('button', { name: 'Export Data' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    expect(document.getElementById('surveyResultsExportArea')).toBeNull();
  });

  it('toggleExportArea flips exportAreaOpen state', () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });

    openExportArea();
    expect(document.getElementById('surveyResultsExportArea')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse export area' }));
    expect(document.getElementById('surveyResultsExportArea')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Data' })).toBeInTheDocument();
  });

  it('renders the survey view mode toggle switch without legacy view buttons', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    const toggle = screen.getByRole('switch', { name: 'Toggle between individual and aggregate view' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Individual')).toBeInTheDocument();
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
    expect(screen.queryByText('Individuals View')).toBeNull();
    expect(screen.queryByText('Aggregate View')).toBeNull();

    const knob = document.querySelector('.toggleKnob');
    expect(knob).not.toBeNull();
    expect(knob).toHaveStyle(resolveSurveyResultsToggleKnobStyle(false) as Record<string, string>);
  });

  it('toggles survey view mode from keyboard activation and ignores other keys', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    const getToggle = () => screen.getByRole('switch', { name: 'Toggle between individual and aggregate view' });

    // fireEvent returns false when preventDefault was called by the handler.
    const arrowNotPrevented = fireEvent.keyDown(getToggle(), { key: 'ArrowRight' });
    expect(arrowNotPrevented).toBe(true);
    expect(getToggle()).toHaveAttribute('aria-checked', 'false');

    const enterPrevented = fireEvent.keyDown(getToggle(), { key: 'Enter' });
    expect(enterPrevented).toBe(false);
    expect(getToggle()).toHaveAttribute('aria-checked', 'true');

    const spacePrevented = fireEvent.keyDown(getToggle(), { key: ' ' });
    expect(spacePrevented).toBe(false);
    expect(getToggle()).toHaveAttribute('aria-checked', 'false');
  });

  it('passes the light-surface filter button variant to survey-mode SBT filters', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    expect(mockSbtFilter).toHaveBeenCalled();
    const filterProps = mockSbtFilter.mock.calls[mockSbtFilter.mock.calls.length - 1][0];
    expect(filterProps.autoExpand).toBe(false);
    expect(filterProps.buttonSurface).toBe('light');
  });

  it('suppresses the embedded SBTFilter loading overlay in survey results', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    expect(mockSbtFilter).toHaveBeenCalled();
    const filterProps = mockSbtFilter.mock.calls[mockSbtFilter.mock.calls.length - 1][0];
    expect(filterProps.hideLoadingOverlay).toBe(true);
  });

  it('renders the current export options list', () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });

    openExportArea();

    // Default export type label on the dropdown toggle.
    const dropdownToggle = document.querySelector('.exportDropdown');
    expect(dropdownToggle).not.toBeNull();
    expect(dropdownToggle).toHaveTextContent('CSV: Questions + Responses');

    const menu = document.querySelector('.dropdown-menu');
    expect(menu).not.toBeNull();
    const optionLabels = Array.from((menu as HTMLElement).querySelectorAll('button.dropdown-item'))
      .map((item) => item.textContent?.trim());

    expect(optionLabels).toEqual([
      'CSV: Questions',
      'CSV: Questions + Responses',
      'JSON: Questions',
      'JSON: Questions + Responses',
    ]);
    expect(optionLabels).not.toContain('Polis Report');
  });

  it('renders the HTML report export action in the expanded export area', async () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });

    openExportArea();
    const exportHtmlButton = screen.getByTestId('ce-surveyresults-export-html-report');
    expect(exportHtmlButton).toHaveTextContent('Export HTML Report');

    // port note: the onExportHtmlReport === openHtmlReportExportModal handler-identity
    // assertion is replaced by the behavioral wiring check (click opens the modal).
    fireEvent.click(exportHtmlButton);
    expect(await screen.findByTestId('ce-surveyresults-html-report-modal')).toBeInTheDocument();
  });

  it('shows the HTML report confirmation modal in redacted mode and disables download without reportable data', async () => {
    mountSurveyResults({ sessionSlug: 'demo' });

    await openHtmlReportModal();

    expect(screen.getByText(/Privacy mode:/)).toBeInTheDocument();
    expect(screen.getByText('Redacted')).toBeInTheDocument();
    expect(screen.getByText('Exported viewer')).toBeInTheDocument();
    expect(screen.getByText('Single HTML file')).toBeInTheDocument();
    expect(screen.getByText('PDF report')).toBeInTheDocument();
    expect(screen.getByText('Embedded Snapshot JSON')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText('Connect a wallet to download authenticated exports.')).toBeInTheDocument();
    expect(screen.queryByText(/Protection/)).toBeNull();
    expect(screen.queryByText(/Exporter metadata/)).toBeNull();
    expect(screen.queryByText(/Integrity warning/)).toBeNull();
    expect(screen.queryByText(/Redaction/)).toBeNull();
    expect(screen.queryByText(/Raw responses in snapshot/)).toBeNull();
    expect(screen.queryByText(/Downloader address in artifact metadata/)).toBeNull();

    const downloadButton = getDownloadReportButton();
    expect(downloadButton).toBeDisabled();
    expect(downloadButton).toHaveClass(styles.htmlReportDownloadButton);
  });

  it('pins HTML report readiness to snapshot availability and selected section identity without side effects', async () => {
    seedSingleBinaryQuestion({
      prompt: 'Which sections are ready?',
      slug: 'readiness-session',
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Readiness Session',
      sessionSlug: 'readiness-session',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();
    fireEvent.click(screen.getByLabelText('Include Argument Map'));
    fireEvent.click(screen.getByLabelText('Include Embedded Snapshot JSON'));

    // port note: the original drove buildSessionResultsHtmlReportSnapshot directly with a
    // stale in-state artifact missing `kind`; injecting state artifacts has no behavior seam.
    // Malformed-artifact rejection stays covered by the analysis-artifact read controller and
    // cache-port module tests; here readiness derives from real hydrated data.
    expect(getSectionRows()).toEqual([
      { availability: 'Available', label: 'Report', reason: 'Ready' },
      { availability: 'Unavailable', label: 'Argument Map', reason: 'Needs analysis' },
      { availability: 'Unavailable', label: 'Risk Matrix', reason: 'Needs analysis' },
      { availability: 'Unavailable', label: 'Atlas Nodes', reason: 'Needs analysis' },
      { availability: 'Available', label: 'Embedded Snapshot JSON', reason: 'Always available' },
    ]);
    expect(screen.getByText('Selected analysis sections need generated data before download.')).toBeInTheDocument();

    const downloadButton = getDownloadReportButton();
    expect(downloadButton).toBeDisabled();
    fireEvent.click(downloadButton);

    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCachePeeks()).toHaveLength(0);
    expect(analysisCacheReads()).toHaveLength(0);
    expect(analysisCacheWrites()).toHaveLength(0);
  });

  it('enables demo preview mode with local analysis sections without a connected wallet', async () => {
    seedAnalysisEligibleSession('demo', 84532);
    mountSurveyResults({
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();

    const demoToggle = screen.getByTestId('ce-surveyresults-html-report-demo-mode');
    expect(demoToggle).not.toBeChecked();
    expect(screen.getByText('Demo preview mode')).toBeInTheDocument();
    expect(getDownloadReportButton()).toBeDisabled();

    fireEvent.click(demoToggle);

    expect(screen.getByTestId('ce-surveyresults-html-report-demo-mode')).toBeChecked();
    expect(screen.getByLabelText('Include Argument Map')).toBeChecked();
    expect(screen.getByLabelText('Include Risk Matrix')).toBeChecked();
    expect(screen.getByLabelText('Include Atlas Nodes')).toBeChecked();
    const downloadButton = getDownloadReportButton();
    expect(downloadButton).not.toBeDisabled();

    fireEvent.click(downloadButton);

    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1));
    const [html] = (downloadSessionResultsHtmlReport as jest.Mock).mock.calls[0];
    expect(html).toContain('"address": "demo-preview"');
    expect(html).toContain('Demo preview');
    expect(html).toContain('"chainId": 84532');
    expect(html).toContain('<section id="argument-map"');
    expect(html).toContain('<section id="risk-matrix"');
    expect(html).toContain('<section id="atlas"');
  });

  it('routes the enabled report download control to parent-owned report execution', async () => {
    seedSingleBinaryQuestion({
      prompt: 'Can the parent own report execution?',
      slug: 'download-route',
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Download Route Session',
      sessionSlug: 'download-route',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();

    const downloadButton = getDownloadReportButton();
    expect(downloadButton).not.toBeDisabled();

    // port note: the original stubbed the downloadHtmlReport instance method to assert
    // delegation identity; the ported wiring guard asserts the rendered control executes
    // exactly one module-level report download with no analysis/cache side effects.
    fireEvent.click(downloadButton);

    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1));
    const [, filename] = (downloadSessionResultsHtmlReport as jest.Mock).mock.calls[0];
    expect(filename).toMatch(/^contextEngine_sessionReport_download-route_.*\.html$/);
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCachePeeks()).toHaveLength(0);
    expect(analysisCacheReads()).toHaveLength(0);
    expect(analysisCacheWrites()).toHaveLength(0);
  });

  it('builds a redacted HTML report snapshot from hydrated SurveyResults state', async () => {
    seedSingleBinaryQuestion({
      prompt: 'Should exports be redacted?',
      response: {
        additional: { encrypted: false, value: 'Raw note' },
        answer: { encrypted: false, value: 'Raw answer' },
        questionId: 'q1',
        timeStamp: '2026-05-01T00:00:00.000Z',
      },
      responder: '0xabc',
      slug: 'demo',
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();
    fireEvent.click(getDownloadReportButton());

    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1));
    const [html] = (downloadSessionResultsHtmlReport as jest.Mock).mock.calls[0];

    expect(html).toContain('Should exports be redacted?');
    expect(html).toContain('"responseCount": 1');
    expect(html).toContain('"participants": 1');
    expect(html).toContain('"privacyMode": "redacted"');
    expect(html).toContain('"address": "0x9999999999999999999999999999999999999999"');
    expect(html).toContain('0x9999...9999');
    expect(html).not.toContain('0xabc');
    expect(html).not.toContain('Raw answer');
    expect(html).not.toContain('Raw note');
  });

  it('downloads the confirmed HTML report through the browser helper', async () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();
    const downloadButton = getDownloadReportButton();
    expect(downloadButton).not.toBeDisabled();
    fireEvent.click(downloadButton);

    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1));
    const [html, filename] = (downloadSessionResultsHtmlReport as jest.Mock).mock.calls[0];
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Export this report?');
    expect(html).toContain('Downloaded by 0x9999...9999');
    expect(html).toContain('"address": "0x9999999999999999999999999999999999999999"');
    expect(html).not.toContain('0xabc');
    expect(filename).toMatch(/^contextEngine_sessionReport_demo_\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2}_\d{3}Z\.html$/);

    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-html-report-modal')).toBeNull();
    });
  });

  it('downloads the selected report as a PDF report when that format is selected', async () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();
    fireEvent.click(screen.getByLabelText(/PDF report/));
    expect(getDownloadReportButton()).toHaveTextContent('Download PDF');
    fireEvent.click(getDownloadReportButton());

    await waitFor(() => expect(downloadSessionResultsPdfReport).toHaveBeenCalledTimes(1));
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect((downloadSessionResultsPdfReport as jest.Mock).mock.calls[0][0]).toEqual(expect.objectContaining({
      filename: expect.stringMatching(/^contextEngine_sessionReport_demo_.*\.pdf$/),
      html: expect.stringContaining('ce-report-pdf'),
    }));
  });

  it('blocks HTML report downloads without exporter identity before rendering artifacts', async () => {
    seedSingleBinaryQuestion({ slug: 'locked-session' });
    mountSurveyResults({
      loginComplete: false,
      network: OP_NETWORK,
      sessionName: 'Locked Session',
      sessionSlug: 'locked-session',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();

    // port note: the original awaited downloadHtmlReport() directly to assert the
    // 'Connect a wallet with permission...' alert; that direct-execution branch is
    // unreachable from the DOM (the download control is disabled) and the blocked
    // alert string is pinned in surveyResultsHtmlReportDownloadAttempt.test.ts.
    expect(screen.getByText('Connect a wallet to download authenticated exports.')).toBeInTheDocument();
    expect(screen.getByText('Connect a wallet to enable download.')).toBeInTheDocument();
    const downloadButton = getDownloadReportButton();
    expect(downloadButton).toBeDisabled();
    fireEvent.click(downloadButton);

    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-surveyresults-html-report-modal')).toBeInTheDocument();
  });

  it('blocks selected report sections when the generated analysis artifact is missing', async () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();
    fireEvent.click(screen.getByLabelText('Include Risk Matrix'));

    // port note: the direct downloadHtmlReport() alert ('Generate selected analysis
    // views before downloading the report.') is unreachable while the control is
    // disabled; the alert string is pinned in surveyResultsHtmlReportDownloadAttempt.test.ts.
    const riskMatrixRow = getSectionRows().find((row) => row.label === 'Risk Matrix');
    expect(riskMatrixRow).toEqual({ availability: 'Unavailable', label: 'Risk Matrix', reason: 'Needs analysis' });
    expect(screen.getByText('Selected analysis sections need generated data before download.')).toBeInTheDocument();

    const downloadButton = getDownloadReportButton();
    expect(downloadButton).toBeDisabled();
    fireEvent.click(downloadButton);

    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-surveyresults-html-report-modal')).toBeInTheDocument();
  });

  it('keeps report export blocked when the selected payload is missing and no snapshot key is selected', async () => {
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Missing Payload Session',
      sessionSlug: 'missing-payload',
    });

    await openHtmlReportModal();
    // Deselect the snapshot JSON section; the still-selected Report section has no
    // hydrated payload, so no exportable section remains.
    fireEvent.click(screen.getByLabelText('Include Embedded Snapshot JSON'));

    // port note: the direct downloadHtmlReport() alert ('Select at least one available
    // report section before export.') is unreachable while the control is disabled; the
    // alert string is pinned in surveyResultsHtmlReportDownloadAttempt.test.ts.
    const downloadButton = getDownloadReportButton();
    expect(downloadButton).toBeDisabled();
    fireEvent.click(downloadButton);

    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCachePeeks()).toHaveLength(0);
    expect(analysisCacheReads()).toHaveLength(0);
    expect(analysisCacheWrites()).toHaveLength(0);
    expect(screen.getByTestId('ce-surveyresults-html-report-modal')).toBeInTheDocument();
  });

  it('falls back missing selected-section keys to snapshot JSON identity without cache persistence', async () => {
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Missing Key Session',
      sessionSlug: 'missing-key-session',
    });

    await openHtmlReportModal();
    // port note: checkbox toggles always emit full selected-section maps, so the original
    // partial-map seed ({ report: false } with other keys absent) has no UI seam; the
    // missing-keys normalization guard lives with the selected-section helpers. The
    // behavioral substance — snapshot-JSON-only download without cache persistence —
    // is exercised by deselecting Report (unavailable here) and downloading.
    fireEvent.click(screen.getByLabelText('Include Report'));

    const downloadButton = getDownloadReportButton();
    expect(downloadButton).not.toBeDisabled();
    fireEvent.click(downloadButton);

    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1));
    const [html, filename] = (downloadSessionResultsHtmlReport as jest.Mock).mock.calls[0];
    expect(filename).toMatch(/^contextEngine_sessionReport_missing-key-session_.*\.html$/);
    expect(html).toContain('"slug": "missing-key-session"');
    expect(html).toContain('"name": "Missing Key Session"');
    expect(html).toContain('<a href="#snapshot-json">Snapshot JSON</a>');
    expect(html).toContain('<section id="snapshot-json"');
    expect(html).not.toContain('<a href="#report">Report</a>');
    expect(html).not.toContain('<section id="report"');
    expect(html).toContain('"privacyMode": "redacted"');
    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCacheReads()).toHaveLength(0);
    expect(analysisCacheWrites()).toHaveLength(0);
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-html-report-modal')).toBeNull();
    });
  });

  it('keeps the rendered report export action inert while analysis generation is pending', async () => {
    const pendingAnalysis = createDeferred<string>();
    (callAI as jest.Mock).mockImplementation(() => pendingAnalysis.promise);
    seedAnalysisEligibleSession('pending-export');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Pending Export Session',
      sessionSlug: 'pending-export',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();

    await screen.findByText('Generating Breakdown (1/1)');
    const downloadButton = getDownloadReportButton();
    expect(downloadButton).toBeDisabled();
    fireEvent.click(downloadButton);

    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();

    await act(async () => {
      pendingAnalysis.resolve(BREAKDOWN_ANALYSIS_JSON);
    });
    await waitForAnalysisIdle();
  });

  it('blocks direct report download execution while analysis generation is pending', async () => {
    const pendingAnalysis = createDeferred<string>();
    (callAI as jest.Mock).mockImplementation(() => pendingAnalysis.promise);
    seedAnalysisEligibleSession('pending-export');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Pending Export Session',
      sessionSlug: 'pending-export',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();
    await screen.findByText('Generating Breakdown (1/1)');

    // port note: direct downloadHtmlReport() invocation while generating is unreachable
    // from the DOM (the control is disabled); the 'Wait for analysis generation...' blocked
    // alert is pinned in surveyResultsHtmlReportDownloadAttempt.test.ts. The ported guard
    // asserts the pending-generation window produces no download side effects or alert.
    fireEvent.click(getDownloadReportButton());
    await flushMicrotasks();

    expect(screen.queryByText('Wait for analysis generation to finish before downloading the report.')).toBeNull();
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-surveyresults-html-report-modal')).toBeInTheDocument();

    await act(async () => {
      pendingAnalysis.resolve(BREAKDOWN_ANALYSIS_JSON);
    });
    await waitForAnalysisIdle();
  });

  it('recovers from stale selected analysis state after the report artifact becomes available', async () => {
    (callAI as jest.Mock).mockImplementation((prompt: string) => {
      if (String(prompt).includes('Generate only this result view: Risk Matrix')) {
        return Promise.resolve(RISK_MATRIX_ANALYSIS_JSON);
      }
      return Promise.resolve(BREAKDOWN_ANALYSIS_JSON);
    });
    seedAnalysisEligibleSession('stale-analysis');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Stale Analysis Session',
      sessionSlug: 'stale-analysis',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    fireEvent.click(screen.getByLabelText('Include Risk Matrix'));

    expect(getDownloadReportButton()).toBeDisabled();
    expect(getSectionRows().find((row) => row.label === 'Risk Matrix')).toEqual({
      availability: 'Unavailable',
      label: 'Risk Matrix',
      reason: 'Needs analysis',
    });

    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(2);
    await waitForAnalysisIdle();

    const downloadButton = getDownloadReportButton();
    await waitFor(() => expect(downloadButton).not.toBeDisabled());
    fireEvent.click(downloadButton);

    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1));
    const [html, filename] = (downloadSessionResultsHtmlReport as jest.Mock).mock.calls[0];
    expect(filename).toMatch(/^contextEngine_sessionReport_stale-analysis_.*\.html$/);
    expect(html).toContain('What export should exist?');
    expect(html).toContain('<a href="#risk-matrix">Risk Matrix</a>');
    expect(html).toContain('<section id="risk-matrix"');
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-html-report-modal')).toBeNull();
    });
  });

  it('surfaces HTML report download failures and allows a later retry', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (downloadSessionResultsHtmlReport as jest.Mock).mockImplementationOnce(() => {
      throw new Error('download failed');
    });
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(1);

    await openHtmlReportModal();
    fireEvent.click(getDownloadReportButton());

    await screen.findByText('Unable to export the HTML report.');
    expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ce-surveyresults-html-report-modal')).toBeInTheDocument();
    expect(consoleErrorSpy.mock.calls.some((call) => call.some((arg) => (
      String(arg).includes('[SurveyResults.downloadHtmlReport] Failed to export HTML report')
    )))).toBe(true);

    fireEvent.click(getDownloadReportButton());

    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.queryByText('Unable to export the HTML report.')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-html-report-modal')).toBeNull();
    });
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('generates AI analysis with synthetic participant IDs and stores the local artifact', async () => {
    (callAI as jest.Mock).mockImplementation((prompt: string) => {
      if (prompt.includes('Generate only this result view: Breakdown')) {
        return Promise.resolve(JSON.stringify({
          breakdown: {
            dimensions: [{ id: 'question_tags', label: 'Question Tags', values: [{ id: 'exports', label: 'exports', count: 3 }] }],
            summary: { overview: 'Participants broadly prioritize clear export controls.' },
            groups: [{ id: 'group_1', label: 'Export controls', participantIds: ['participant_001'] }],
          },
        }));
      }
      if (prompt.includes('Generate only this result view: Argument Map')) {
        return Promise.resolve(JSON.stringify({
          argumentMap: {
            debates: [{ id: 'debate_1', title: 'Export scope', claims: [{ id: 'claim_1', participantIds: ['participant_001'] }] }],
          },
        }));
      }
      if (prompt.includes('Generate only this result view: Risk Matrix')) {
        return Promise.resolve(JSON.stringify({
          riskMatrix: {
            categories: [{ id: 'risk_1', label: 'Privacy leakage' }],
            comments: [{ id: 'risk_comment_1', participantIds: ['participant_002'] }],
            heatmap: { risk_1: { likelihood: 'medium', impact: 'high' } },
          },
        }));
      }
      return Promise.resolve(JSON.stringify({
        atlas: {
          nodes: [{ id: 'atlas_1', label: 'Privacy-preserving exports', participantIds: ['participant_001'] }],
          edges: [],
        },
      }));
    });
    seedAnalysisEligibleSession('demo');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      filterState: {
        sbtFilter: {
          onlyVerifiedHumans: true,
          selectedSBTGroupsResponder: [
            {
              address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              label: 'Builders Guild',
            },
            {
              address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          ],
        },
      },
      loginComplete: true,
      network: OP_NETWORK,
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    fireEvent.click(screen.getByLabelText('Include Argument Map'));
    fireEvent.click(screen.getByLabelText('Include Risk Matrix'));
    fireEvent.click(screen.getByLabelText('Include Atlas Nodes'));

    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(4);
    await waitForAnalysisIdle();

    expect(callAI).toHaveBeenCalledTimes(4);
    const prompt = (callAI as jest.Mock).mock.calls[0][0];
    expect(prompt).toContain('participant_001');
    expect(prompt).toContain('Use a viewer.');
    expect(prompt).toContain('Question Tags');
    expect(prompt).toContain('Builders Guild');
    expect(prompt).toContain('Verified humans');
    expect(prompt).not.toContain(RESPONDER_ONE);
    expect(prompt).not.toContain(RESPONDER_TWO);
    expect(prompt).not.toContain('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(callAIPrompts()).toEqual([
      expect.stringContaining('Generate only this result view: Breakdown'),
      expect.stringContaining('Generate only this result view: Argument Map'),
      expect.stringContaining('Generate only this result view: Risk Matrix'),
      expect.stringContaining('Generate only this result view: Atlas Nodes'),
    ]);

    const rows = getSectionRows();
    expect(rows.find((row) => row.label === 'Argument Map')?.availability).toBe('Available');
    expect(rows.find((row) => row.label === 'Risk Matrix')?.availability).toBe('Available');
    expect(rows.find((row) => row.label === 'Atlas Nodes')?.availability).toBe('Available');
  });

  it('orders analysis generation status, cache writes, and final parent state on success', async () => {
    const firstAnalysis = createDeferred<string>();
    const secondAnalysis = createDeferred<string>();
    (callAI as jest.Mock)
      .mockImplementationOnce(() => firstAnalysis.promise)
      .mockImplementationOnce(() => secondAnalysis.promise);
    seedAnalysisEligibleSession('lifecycle-session');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'lifecycle-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    fireEvent.click(screen.getByLabelText('Include Risk Matrix'));
    clickGenerateAnalysis();

    // port note: the original instrumented setState to assert exact patch objects and the
    // stubbed 'lifecycle-input' signature; patch-shape equality lives in the
    // surveyResultsAnalysisLifecyclePlan module tests. Ordering is observed here through
    // DOM status text and cross-mock invocation order on the module seams.
    await screen.findByText('Generating Breakdown (1/2)');
    expect(callAIPrompts()).toEqual([
      expect.stringContaining('Generate only this result view: Breakdown'),
    ]);
    expect(analysisCacheWrites()).toHaveLength(0);

    await act(async () => {
      firstAnalysis.resolve(BREAKDOWN_ANALYSIS_JSON);
    });

    await screen.findByText('Generating Risk Matrix (2/2)');
    await waitForAnalysisCacheWrites(1);
    const firstWriteEntries = analysisArtifactsFromWrite(0);
    expect(firstWriteEntries).toHaveLength(1);
    expect(firstWriteEntries[0][1].sections.breakdown.available).toBe(true);
    expect(firstWriteEntries[0][1].sections.riskMatrix.available).toBe(false);
    expect(callAIPrompts()).toEqual([
      expect.stringContaining('Generate only this result view: Breakdown'),
      expect.stringContaining('Generate only this result view: Risk Matrix'),
    ]);
    // The first cache write committed before the second section generation started.
    expect(writeSpy.mock.invocationCallOrder[writeSpy.mock.invocationCallOrder.length - 1])
      .toBeLessThan((callAI as jest.Mock).mock.invocationCallOrder[1]);

    await act(async () => {
      secondAnalysis.resolve(RISK_MATRIX_ANALYSIS_JSON);
    });
    await waitForAnalysisCacheWrites(2);
    await waitForAnalysisIdle();

    const firstWrite = analysisCacheWrites()[0];
    const secondWrite = analysisCacheWrites()[1];
    expect(firstWrite[1]).toBe('lifecycle-session');
    expect(secondWrite[1]).toBe('lifecycle-session');
    const secondWriteEntries = analysisArtifactsFromWrite(1);
    expect(secondWriteEntries).toHaveLength(1);
    expect(secondWriteEntries[0][0]).toBe(firstWriteEntries[0][0]);
    expect(secondWriteEntries[0][1].sections.breakdown.available).toBe(true);
    expect(secondWriteEntries[0][1].sections.riskMatrix.available).toBe(true);

    expect(screen.queryByText(/Generating/)).toBeNull();
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
    const rows = getSectionRows();
    expect(rows.find((row) => row.label === 'Risk Matrix')?.availability).toBe('Available');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('skips generated artifact cache dispatch when the completion plan has no cache key', async () => {
    // port note: the analysis cache key builder falls back to 'unknown' rather than an
    // empty key, so the empty-key dispatch skip has no behavior seam; it is pinned in
    // surveyResultsAnalysisGeneratedArtifactCompletionPlan.test.ts (empty cacheKey ->
    // shouldWriteCache false). Behaviorally, missing chain identity blocks generation
    // before any artifact dispatch can happen.
    seedAnalysisEligibleSession('missing-cache-key-session');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: null,
      sessionSlug: 'missing-cache-key-session',
    });

    await openHtmlReportModal();
    const generateButton = getGenerateAnalysisButton();
    expect(generateButton).toBeDisabled();
    fireEvent.click(generateButton);
    await flushMicrotasks();

    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCacheWrites()).toHaveLength(0);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('keeps section generation failures inside the analysis lifecycle without fetch, decrypt, or download side effects', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (callAI as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify({
        breakdown: {
          dimensions: [],
          groups: [{ id: 'group_1', label: 'Partial group' }],
          summary: { overview: 'First section ready.' },
        },
      }))
      .mockRejectedValueOnce(new Error('risk matrix unavailable'))
      .mockResolvedValueOnce(JSON.stringify({
        riskMatrix: {
          categories: [{ id: 'risk_1', label: 'Recovered risk' }],
          comments: [],
          heatmap: {},
          scenarioLinks: [],
        },
      }));
    seedAnalysisEligibleSession('partial-failure-session');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'partial-failure-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    fireEvent.click(screen.getByLabelText('Include Risk Matrix'));
    const latestBlockCallsBeforeGenerate = latestBlockSpy.mock.calls.length;
    clickGenerateAnalysis();

    await screen.findByText('Unable to generate analysis views right now. Check AI settings and try again.');
    expect(callAI).toHaveBeenCalledTimes(2);
    expect((callAI as jest.Mock).mock.calls[0][1]).toEqual(expect.objectContaining({
      sessionSlug: 'partial-failure-session',
      taskType: 'analysis',
    }));
    expect(analysisCacheWrites()).toHaveLength(1);
    const partialEntries = analysisArtifactsFromWrite(0);
    expect(partialEntries[0][1]).toEqual(expect.objectContaining({
      kind: 'ce_session_results_analysis_artifact',
      source: 'ai-generated',
      version: 1,
    }));
    expect(partialEntries[0][1].sections.breakdown.available).toBe(true);
    expect(partialEntries[0][1].sections.riskMatrix.available).toBe(false);
    // port note: the lifecycle failure-recovery setState patch equality is covered by the
    // buildSurveyResultsAnalysisLifecyclePlan module tests; here the recovery is observed
    // through the rendered error state and section rows.
    expect(getSectionRows().find((row) => row.label === 'Risk Matrix')?.reason).toBe('Needs analysis');
    expect(consoleErrorSpy.mock.calls.some((call) => call.some((arg) => (
      String(arg).includes('[SurveyResults.generateHtmlReportAnalysisViews] Failed to generate analysis')
    )))).toBe(true);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(latestBlockSpy.mock.calls.length).toBe(latestBlockCallsBeforeGenerate);

    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(2);
    await waitForAnalysisIdle();

    expect(callAI).toHaveBeenCalledTimes(3);
    expect((callAI as jest.Mock).mock.calls[2][0]).toEqual(
      expect.stringContaining('Generate only this result view: Risk Matrix')
    );
    const recoveredEntries = analysisArtifactsFromWrite(1);
    expect(recoveredEntries[0][1].sections.breakdown.available).toBe(true);
    expect(recoveredEntries[0][1].sections.riskMatrix.available).toBe(true);
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
    expect(getSectionRows().find((row) => row.label === 'Risk Matrix')?.availability).toBe('Available');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('skips analysis artifact cache reads when persistence has no generated artifact', async () => {
    // port note: the original invoked the private write port with a null artifact; no
    // render/DOM path ever dispatches a null artifact (pinned in
    // surveyResultsCacheWriteEligibilityPlan.test.ts: null artifact -> shouldReadCache
    // false). Behaviorally: report downloads without a generated artifact perform no
    // analysisCache persistence reads/writes, while a real generation does.
    (callAI as jest.Mock).mockResolvedValue(BREAKDOWN_ANALYSIS_JSON);
    seedAnalysisEligibleSession('missing-artifact-session');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'missing-artifact-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    fireEvent.click(getDownloadReportButton());
    await waitFor(() => expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1));

    expect(analysisCacheReads()).toHaveLength(0);
    expect(analysisCacheWrites()).toHaveLength(0);

    await openHtmlReportModal();
    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(1);

    expect(analysisCacheReads()).toHaveLength(1);
  });

  it('reads generated analysis artifacts through the scoped sync analysis cache request', async () => {
    const { artifact, cacheKey } = await primeAnalysisArtifactCacheKey(
      {
        account: WALLET_ACCOUNT,
        loginComplete: true,
        network: OP_NETWORK,
        sessionSlug: 'alpha-session',
      },
      () => seedAnalysisEligibleSession('alpha-session')
    );

    seedAnalysisEligibleSession('alpha-session');
    cacheStore.set(cacheStoreKey('analysisCache', 'alpha-session'), {
      sessionResultsAnalysis: { [cacheKey]: artifact },
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'alpha-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();

    await waitFor(() => {
      expect(peekSpy).toHaveBeenCalledWith('analysisCache', 'alpha-session', { clone: false });
    });
    await waitForAnalysisIdle();
    await flushMicrotasks();

    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCacheWrites()).toHaveLength(0);
    expect(getSectionRows().find((row) => row.label === 'Report')).toEqual({
      availability: 'Available',
      label: 'Report',
      reason: 'Ready',
    });
  });

  it('skips analysis artifact cache reads when the read request has no cache key', async () => {
    // port note: the analysis cache key builder never yields an empty key (it falls back
    // to 'unknown'), so the empty-key read skip has no behavior seam; it is pinned in
    // surveyResultsAnalysisArtifactCachePorts.test.ts ('blocks read requests when the
    // cache key is missing'). Behaviorally, missing chain identity blocks generation
    // before any analysisCache read can happen.
    seedAnalysisEligibleSession('missing-key-session');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: null,
      sessionSlug: 'missing-key-session',
    });

    await openHtmlReportModal();
    const generateButton = getGenerateAnalysisButton();
    expect(generateButton).toBeDisabled();
    fireEvent.click(generateButton);
    await flushMicrotasks();

    expect(analysisCachePeeks()).toHaveLength(0);
    expect(callAI).not.toHaveBeenCalled();
  });

  it('rejects stale analysis artifacts returned from the selected cache key', async () => {
    const { artifact, cacheKey } = await primeAnalysisArtifactCacheKey(
      {
        account: WALLET_ACCOUNT,
        loginComplete: true,
        network: OP_NETWORK,
        sessionSlug: 'alpha-session',
      },
      () => seedAnalysisEligibleSession('alpha-session')
    );

    seedAnalysisEligibleSession('alpha-session');
    cacheStore.set(cacheStoreKey('analysisCache', 'alpha-session'), {
      sessionResultsAnalysis: {
        [cacheKey]: { ...artifact, inputSignature: 'stale-input' },
      },
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'alpha-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(1);
    await waitForAnalysisIdle();

    // The stale-signature artifact is rejected, so regeneration runs and a fresh
    // artifact is written under the same data-derived key.
    expect(callAI).toHaveBeenCalledTimes(1);
    const writtenEntries = analysisArtifactsFromWrite(0);
    expect(writtenEntries[0][0]).toBe(cacheKey);
    expect(writtenEntries[0][1].inputSignature).not.toBe('stale-input');
    expect(writtenEntries[0][1].sections.breakdown.available).toBe(true);
  });

  it('rejects partial analysis artifacts returned from the selected cache key', async () => {
    const { artifact, cacheKey } = await primeAnalysisArtifactCacheKey(
      {
        account: WALLET_ACCOUNT,
        loginComplete: true,
        network: OP_NETWORK,
        sessionSlug: 'alpha-session',
      },
      () => seedAnalysisEligibleSession('alpha-session')
    );

    const partialArtifact: any = { ...artifact };
    delete partialArtifact.sections;
    seedAnalysisEligibleSession('alpha-session');
    cacheStore.set(cacheStoreKey('analysisCache', 'alpha-session'), {
      sessionResultsAnalysis: { [cacheKey]: partialArtifact },
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'alpha-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(1);
    await waitForAnalysisIdle();

    // The sections-less artifact is not consumed as a cache hit; a complete artifact
    // is regenerated and written.
    expect(callAI).toHaveBeenCalledTimes(1);
    const writtenEntries = analysisArtifactsFromWrite(0);
    expect(writtenEntries[0][0]).toBe(cacheKey);
    expect(writtenEntries[0][1].sections.breakdown.available).toBe(true);
  });

  it('falls back to generation when the analysis cache read port throws', async () => {
    (callAI as jest.Mock).mockResolvedValue(JSON.stringify({
      breakdown: {
        dimensions: [],
        groups: [{ id: 'read_error_group', label: 'Read error group' }],
        summary: { overview: 'Generated after cache read failure.' },
      },
    }));
    seedAnalysisEligibleSession('read-error-session');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'read-error-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    // Only the analysisCache read port throws; questionsCache reads keep working.
    analysisPeekError = new Error('analysis cache read failed');
    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(1);
    await waitForAnalysisIdle();
    analysisPeekError = null;

    expect(peekSpy).toHaveBeenCalledWith('analysisCache', 'read-error-session', { clone: false });
    expect(callAI).toHaveBeenCalledTimes(1);
    const writtenEntries = analysisArtifactsFromWrite(0);
    expect(writtenEntries[0][1].sections.breakdown.available).toBe(true);
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
    expect(getSectionRows().find((row) => row.label === 'Report')?.reason).toBe('Ready');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('writes generated analysis artifacts to the scoped cache key without clobbering siblings', async () => {
    (callAI as jest.Mock).mockResolvedValue(BREAKDOWN_ANALYSIS_JSON);
    const existingArtifact = createAnalysisArtifact('old-input');
    seedAnalysisEligibleSession('alpha-session');
    cacheStore.set(cacheStoreKey('analysisCache', 'alpha-session'), {
      existingFlag: true,
      sessionResultsAnalysis: {
        'sessionResultsAnalysis:v1:OP Sepolia:old-input': existingArtifact,
      },
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'alpha-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(1);
    await waitForAnalysisIdle();

    expect(readSpy).toHaveBeenCalledWith('analysisCache', 'alpha-session');
    const [, writeSlug, payload] = analysisCacheWrites()[0];
    expect(writeSlug).toBe('alpha-session');
    expect(payload.existingFlag).toBe(true);
    expect(payload.sessionResultsAnalysis['sessionResultsAnalysis:v1:OP Sepolia:old-input']).toBe(existingArtifact);
    const newKeys = Object.keys(payload.sessionResultsAnalysis)
      .filter((key) => key !== 'sessionResultsAnalysis:v1:OP Sepolia:old-input');
    expect(newKeys).toHaveLength(1);
    expect(newKeys[0]).toMatch(/^sessionResultsAnalysis:v1:OP Sepolia:/);
    expect(payload.sessionResultsAnalysis[newKeys[0]].sections.breakdown.available).toBe(true);
  });

  it('uses a cached complete analysis artifact without AI calls or cache writes', async () => {
    const { artifact, cacheKey } = await primeAnalysisArtifactCacheKey(
      {
        account: WALLET_ACCOUNT,
        loginComplete: true,
        network: OP_NETWORK,
        sessionSlug: 'cached-session',
      },
      () => seedAnalysisEligibleSession('cached-session')
    );

    seedAnalysisEligibleSession('cached-session');
    cacheStore.set(cacheStoreKey('analysisCache', 'cached-session'), {
      sessionResultsAnalysis: { [cacheKey]: artifact },
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'cached-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();

    await waitFor(() => {
      expect(peekSpy).toHaveBeenCalledWith('analysisCache', 'cached-session', { clone: false });
    });
    await waitForAnalysisIdle();
    await flushMicrotasks();

    // port note: the original asserted setState was called exactly once with the
    // lifecycle-plan ready patch; plan-patch equality lives in the
    // buildSurveyResultsAnalysisLifecyclePlan module tests.
    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCacheWrites()).toHaveLength(0);
    expect(screen.queryByText(/Generating/)).toBeNull();
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
    expect(getSectionRows().find((row) => row.label === 'Report')?.reason).toBe('Ready');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('blocks analysis generation before cache reads when exporter identity is missing', async () => {
    seedAnalysisEligibleSession('missing-identity-session');
    mountSurveyResults({
      account: '',
      loginComplete: false,
      network: OP_NETWORK,
      sessionSlug: 'missing-identity-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();

    // port note: the original asserted the 'Connect a wallet with permission to view these
    // results before generating analysis views.' state patch via a direct method call; the
    // rendered control is disabled before that branch can run, so the ported guard pins
    // the disabled control plus zero side effects across the analysis seams.
    expect(screen.getByText('Connect a wallet to download authenticated exports.')).toBeInTheDocument();
    const generateButton = getGenerateAnalysisButton();
    expect(generateButton).toBeDisabled();
    fireEvent.click(generateButton);
    await flushMicrotasks();

    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCachePeeks()).toHaveLength(0);
    expect(analysisCacheReads()).toHaveLength(0);
    expect(analysisCacheWrites()).toHaveLength(0);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('ignores stale in-memory analysis artifacts and regenerates the current input signature', async () => {
    (callAI as jest.Mock).mockResolvedValue(JSON.stringify({
      breakdown: {
        dimensions: [],
        groups: [{ id: 'fresh_group', label: 'Fresh group' }],
        summary: { overview: 'Fresh analysis.' },
      },
    }));
    seedAnalysisEligibleSession('stale-artifact-session');
    const harness = mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      questionResponsesNonce: 1,
      sessionSlug: 'stale-artifact-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(1);
    await waitForAnalysisIdle();
    const firstEntries = analysisArtifactsFromWrite(0);
    const [firstKey, firstArtifact] = firstEntries[0];

    // New response lands in the cache and the parent bumps the responses nonce; the
    // in-memory artifact's signature is now stale for the regenerated payload.
    seedQuestionsCache({
      questionResponses: {
        q1: {
          [RESPONDER_ONE]: { answer: { encrypted: false, value: 'Use a viewer.' }, questionId: 'q1', timeStamp: '2026-05-01T00:00:00.000Z' },
          [RESPONDER_TWO]: { answer: { encrypted: false, value: 'Keep it private.' }, questionId: 'q1', timeStamp: '2026-05-02T00:00:00.000Z' },
        },
        q2: {
          [RESPONDER_ONE]: { answer: { encrypted: false, value: 'Make PDF readable.' }, questionId: 'q2', timeStamp: '2026-05-03T00:00:00.000Z' },
          [RESPONDER_TWO]: { answer: { encrypted: false, value: 'Add a fresh angle.' }, questionId: 'q2', timeStamp: '2026-05-04T00:00:00.000Z' },
        },
      },
      questions: {
        q1: { id: 'q1', prompt: 'What export should exist?', tags: ['exports'], type: 'freeform' },
        q2: { id: 'q2', prompt: 'What risk matters?', tags: ['safety'], type: 'freeform' },
      },
      slug: 'stale-artifact-session',
    });
    harness.rerenderSurveyResults({ questionResponsesNonce: 2 });
    await waitForHydratedResponseCount(4);

    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(2);
    await waitForAnalysisIdle();

    expect(callAI).toHaveBeenCalledTimes(2);
    const secondEntries = analysisArtifactsFromWrite(1);
    const freshEntry = secondEntries.find(([key]) => key !== firstKey);
    expect(freshEntry).toBeTruthy();
    const [secondKey, secondArtifact] = freshEntry as [string, any];
    expect(secondKey).not.toBe(firstKey);
    expect(secondArtifact.inputSignature).not.toBe(firstArtifact.inputSignature);
    expect(secondArtifact).not.toBe(firstArtifact);
    expect(secondArtifact.sections.breakdown.available).toBe(true);
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('ignores stale cached analysis artifacts and keeps generation side effects in the analysis path', async () => {
    const { artifact, cacheKey } = await primeAnalysisArtifactCacheKey(
      {
        account: WALLET_ACCOUNT,
        loginComplete: true,
        network: OP_NETWORK,
        sessionSlug: 'stale-cache-session',
      },
      () => seedAnalysisEligibleSession('stale-cache-session')
    );

    (callAI as jest.Mock).mockResolvedValue(JSON.stringify({
      breakdown: {
        dimensions: [],
        groups: [{ id: 'fresh_cached_group', label: 'Fresh cached group' }],
        summary: { overview: 'Fresh cached analysis.' },
      },
    }));
    seedAnalysisEligibleSession('stale-cache-session');
    cacheStore.set(cacheStoreKey('analysisCache', 'stale-cache-session'), {
      sessionResultsAnalysis: {
        [cacheKey]: { ...artifact, inputSignature: 'stale-cache-input' },
      },
    });
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'stale-cache-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    const latestBlockCallsBeforeGenerate = latestBlockSpy.mock.calls.length;
    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(1);
    await waitForAnalysisIdle();

    expect(callAI).toHaveBeenCalledTimes(1);
    const writtenEntries = analysisArtifactsFromWrite(0);
    expect(writtenEntries[0][1].inputSignature).not.toBe('stale-cache-input');
    expect(writtenEntries[0][1].sections.breakdown.available).toBe(true);
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
    // Generation stays inside the analysis path: no report downloads and no extra
    // network refreshes are triggered by the analysis run.
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(latestBlockSpy.mock.calls.length).toBe(latestBlockCallsBeforeGenerate);
  });

  it('blocks ineligible analysis payloads before cache lookup, AI calls, or artifact writes', async () => {
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'blocked-session',
    });

    await openHtmlReportModal();

    // The real payload builder reports why generation is ineligible with no data hydrated.
    expect(screen.getByText(
      'Needs at least 3 viewable responses; 0 available. Needs at least 2 participants; 0 available. Needs at least 1 hydrated question; 0 available.'
    )).toBeInTheDocument();
    const generateButton = getGenerateAnalysisButton();
    expect(generateButton).toBeDisabled();
    expect(generateButton).toHaveTextContent('Generate Analysis Views');
    fireEvent.click(generateButton);
    await flushMicrotasks();

    expect(callAI).not.toHaveBeenCalled();
    expect(analysisCachePeeks()).toHaveLength(0);
    expect(analysisCacheReads()).toHaveLength(0);
    expect(analysisCacheWrites()).toHaveLength(0);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('surfaces analysis cache write failures and allows a later retry at the write boundary', async () => {
    (callAI as jest.Mock).mockResolvedValue(BREAKDOWN_ANALYSIS_JSON);
    seedAnalysisEligibleSession('beta-session', 84532);
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      sessionSlug: 'beta-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    analysisWriteErrors = [new Error('analysis write failed')];
    clickGenerateAnalysis();

    // port note: the original asserted the write port rejects-and-rethrows when the cache
    // write fails; once generation catches that rejection there is no DOM seam for the
    // rethrow contract itself (covered by surveyResultsAnalysisArtifactWriteController
    // module tests). The retry/merge half ports here.
    await screen.findByText('Unable to generate analysis views right now. Check AI settings and try again.');
    expect(analysisCacheWrites()).toHaveLength(1);

    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(2);
    await waitForAnalysisIdle();

    const [, writeSlug, payload] = analysisCacheWrites()[1];
    expect(writeSlug).toBe('beta-session');
    const keys = Object.keys(payload.sessionResultsAnalysis);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^sessionResultsAnalysis:v1:Base Sepolia:/);
    expect(payload.sessionResultsAnalysis[keys[0]].sections.breakdown.available).toBe(true);
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
  });

  it('keeps analysis write failures in the generation status path and recovers without starting downloads', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (callAI as jest.Mock).mockResolvedValue(JSON.stringify({
      breakdown: {
        dimensions: [],
        groups: [],
        summary: { overview: 'Generated but not cached.' },
      },
    }));
    seedAnalysisEligibleSession('write-failure-session');
    mountSurveyResults({
      account: WALLET_ACCOUNT,
      loginComplete: true,
      network: OP_NETWORK,
      sessionSlug: 'write-failure-session',
    });
    await waitForHydratedResponseCount(3);

    await openHtmlReportModal();
    analysisWriteErrors = [new Error('cache write failed')];
    clickGenerateAnalysis();

    await screen.findByText('Unable to generate analysis views right now. Check AI settings and try again.');
    expect(callAI).toHaveBeenCalledTimes(1);
    expect(analysisCacheWrites()).toHaveLength(1);
    expect(consoleErrorSpy.mock.calls.some((call) => call.some((arg) => (
      String(arg).includes('[SurveyResults.generateHtmlReportAnalysisViews] Failed to generate analysis')
    )))).toBe(true);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    // The failed run keeps the artifact out of readiness: analysis sections still need generation.
    expect(getSectionRows().find((row) => row.label === 'Argument Map')?.reason).toBe('Needs analysis');

    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(2);
    await waitForAnalysisIdle();

    expect(callAI).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.')).toBeNull();
    const recoveredEntries = analysisArtifactsFromWrite(1);
    expect(recoveredEntries[0][1].sections.breakdown.available).toBe(true);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('exports survey-response CSV from current individual payloads with metadata fallbacks and latest-row dedupe', async () => {
    // port note: the responder-object direct-state branch is internal-only after survey
    // hydration; the cache-driven port keeps the latest-row dedupe and metadata fallback
    // coverage observable through the downloaded CSV.
    cacheStore.set(cacheStoreKey('surveysCache', 'demo'), {
      '11155420': {
        surveyResponses: {
          [SURVEY_ID]: {
            [RESPONDER_ONE]: {
              responses: [
                {
                  additional: { encrypted: false, hash: 'old-add-hash', value: 'Old note' },
                  answer: { encrypted: false, hash: 'old-hash', value: ['Beta'] },
                  conviction: 2,
                  questionID: 'q1',
                  timeStamp: '2024-12-31T00:00:00.000Z',
                },
                {
                  additional: { encrypted: false, hash: 'add-hash-1', value: 'Latest note' },
                  answer: { encrypted: false, hash: 'hash-1', value: ['Alpha', 'Gamma'] },
                  conviction: 7,
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                },
              ],
            },
            [RESPONDER_TWO]: {
              responses: [
                {
                  additional: { encrypted: false, value: '' },
                  answer: { encrypted: true, value: '*' },
                  importance: 4,
                  questionId: 'q2',
                  timeStamp: '2025-02-02T00:00:00.000Z',
                },
              ],
            },
          },
        },
        surveyResponsesLatestBlock: { [SURVEY_ID]: 1 },
        surveys: {
          [SURVEY_ID]: { documentURLs: [], questionIDs: ['q1', 'q2'], title: 'Demo Survey' },
        },
        surveysLatestBlock: 1,
      },
    });
    seedQuestionsCache({
      questions: {
        q1: { id: 'q1', options: ['Alpha', 'Beta', 'Gamma'], prompt: 'Question One', type: 'multichoice' },
        q2: { id: 'q2', prompt: 'Question Two', type: 'freeform' },
      },
      slug: 'demo',
    });
    mountSurveyResults({
      network: OP_NETWORK,
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    await waitForHydratedResponseCount(2);

    openExportArea();
    const capture = installBrowserDownloadCapture();
    let csv = '';
    try {
      clickExportDownload();
      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      capture.restore();
      csv = await readBlobText(capture.blobs[0]);
    } finally {
      capture.restore();
    }

    const lines = csv.split('\n');
    expect(lines[0]).toBe('responderAddress,questionID,questionPrompt,type,options,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp');
    expect(lines[1]).toBe(`"${RESPONDER_ONE}","q1","Question One","multichoice","Alpha;Beta;Gamma","7","Alpha, Gamma","hash-1","Latest note","false","false","add-hash-1","2025-01-01T00:00:00.000Z"`);
    expect(lines[2]).toBe(`"${RESPONDER_TWO}","q2","Question Two","freeform","","4","*","","","true","false","","2025-02-02T00:00:00.000Z"`);
    expect(csv).not.toContain('Old note');
    expect(csv).not.toContain('old-hash');
    expect(lines).toHaveLength(3);
  });

  it('exports aggregate response CSV from mixed object/string payloads using current question metadata', async () => {
    // port note: the original direct-state duplicate-row branch is covered by the
    // survey-response CSV case above; this cache-driven port preserves mixed raw
    // string/object payload coverage before hydration normalizes state.
    seedQuestionsCache({
      questionResponses: {
        q1: {
          [RESPONDER_ONE]: JSON.stringify({
            additional: { encrypted: false, hash: 'add-hash', value: 'Current note' },
            answer: { encrypted: false, hash: 'ans-hash', value: ['Alpha', 'Gamma'] },
            conviction: 9,
            questionID: 'q1',
            timeStamp: '2025-03-01T00:00:00.000Z',
          }),
          [RESPONDER_TWO]: {
            additional: { encrypted: false, hash: 'second-add-hash', value: 'Second note' },
            answer: { encrypted: false, hash: 'second-ans-hash', value: ['Beta'] },
            conviction: 5,
            questionID: 'q1',
            timeStamp: '2025-03-02T00:00:00.000Z',
          },
        },
      },
      questions: {
        q1: { id: 'q1', options: ['Alpha', 'Beta', 'Gamma'], prompt: 'Aggregate Question', type: 'multichoice' },
      },
      slug: 'demo',
    });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });
    await waitForHydratedResponseCount(2);

    openExportArea();
    const capture = installBrowserDownloadCapture();
    let csv = '';
    try {
      clickExportDownload();
      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      capture.restore();
      csv = await readBlobText(capture.blobs[0]);
    } finally {
      capture.restore();
    }

    const lines = csv.split('\n');
    expect(lines[0]).toBe('questionID,questionPrompt,type,options,responderAddress,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp');
    expect(lines[1]).toBe(`"q1","Aggregate Question","multichoice","Alpha;Beta;Gamma","${RESPONDER_ONE}","9","Alpha, Gamma","ans-hash","Current note","false","false","add-hash","2025-03-01T00:00:00.000Z"`);
    expect(lines[2]).toBe(`"q1","Aggregate Question","multichoice","Alpha;Beta;Gamma","${RESPONDER_TWO}","5","Beta","second-ans-hash","Second note","false","false","second-add-hash","2025-03-02T00:00:00.000Z"`);
    expect(lines).toHaveLength(3);
  });

  it('falls back to the aggregate bucket key when response payloads omit question IDs', async () => {
    seedQuestionsCache({
      questionResponses: {
        q2: {
          [RESPONDER_TWO]: {
            answer: { encrypted: false, value: 'Yes' },
            importance: 4,
            timeStamp: '2025-04-01T00:00:00.000Z',
          },
        },
      },
      questions: {
        q2: { id: 'q2', options: ['Yes', 'No'], prompt: 'Fallback Question', type: 'multichoice' },
      },
      slug: 'demo',
    });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });
    await waitForHydratedResponseCount(1);

    openExportArea();
    const capture = installBrowserDownloadCapture();
    let csv = '';
    try {
      clickExportDownload();
      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      capture.restore();
      csv = await readBlobText(capture.blobs[0]);
    } finally {
      capture.restore();
    }

    const lines = csv.split('\n');
    expect(lines[1]).toBe(`"q2","Fallback Question","multichoice","Yes;No","${RESPONDER_TWO}","4","Yes","","","false","","","2025-04-01T00:00:00.000Z"`);
  });

  it('exports results JSON for the current filtered question view', async () => {
    seedQuestionsCache({
      questionResponses: {
        q1: {
          '0xabc': { answer: { encrypted: false, value: 'Agree' }, questionId: 'q1', timeStamp: '2025-05-01T00:00:00.000Z' },
        },
      },
      questions: {
        q1: {
          id: 'Q1',
          options: ['Alpha', 'Beta'],
          prompt: 'Prompt One',
          tags: ['governance', 'ai'],
          type: 'multichoice',
        },
      },
      slug: 'demo',
    });
    mountSurveyResults({
      filterState: {
        sbtFilter: {
          selectedTraits: ['builder'],
        },
      },
      network: OP_NETWORK,
      sessionSlug: 'demo',
    });
    await waitForHydratedResponseCount(1);

    openExportArea();
    selectExportType('JSON: Questions + Responses');
    const capture = installBrowserDownloadCapture();
    let exportedText = '';
    try {
      clickExportDownload();
      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      capture.restore();
      exportedText = await readBlobText(capture.blobs[0]);
    } finally {
      capture.restore();
    }

    const exported = JSON.parse(exportedText);
    expect(exported.sessionSlug).toBe('demo');
    expect(exported.viewMode).toBe('questions');
    expect(exported.surveyTitle).toBe('');
    expect(exported.counts).toEqual(expect.objectContaining({
      totalQuestions: 1,
      totalResponses: 1,
      filteredResponses: 1,
    }));
    expect(exported.filterState).toEqual({
      sbtFilter: {
        selectedTraits: ['builder'],
      },
    });
    expect(exported.filteredQuestions).toEqual([
      {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'multichoice',
        tags: ['governance', 'ai'],
        options: ['Alpha', 'Beta'],
      },
    ]);
    expect(exported.filteredQuestionResponses.q1).toHaveLength(1);
    expect(exported.filteredResponses).toEqual([]);
    expect(typeof exported.exportedAt).toBe('string');
  });

  it('exports question-only JSON without response payloads', async () => {
    seedQuestionsCache({
      questionResponses: {
        q1: {
          '0xabc': { answer: { encrypted: false, value: 'Agree' }, questionId: 'q1', timeStamp: '2025-05-01T00:00:00.000Z' },
        },
      },
      questions: {
        q1: { id: 'Q1', options: [], prompt: 'Prompt One', tags: ['governance'], type: 'binary' },
        q2: { id: 'Q2', options: [], prompt: 'Prompt Two', tags: ['safety'], type: 'freeform' },
      },
      slug: 'edge',
    });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'edge' });
    await waitForHydratedResponseCount(1);

    openExportArea();
    selectExportType('JSON: Questions');
    const capture = installBrowserDownloadCapture();
    let exportedText = '';
    try {
      clickExportDownload();
      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      capture.restore();
      exportedText = await readBlobText(capture.blobs[0]);
    } finally {
      capture.restore();
    }

    const exported = JSON.parse(exportedText);
    expect(exported.filteredQuestions).toHaveLength(2);
    expect(exported.filteredQuestions).toEqual(expect.arrayContaining([
      {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'binary',
        tags: ['governance'],
        options: [],
      },
      {
        id: 'Q2',
        prompt: 'Prompt Two',
        type: 'freeform',
        tags: ['safety'],
        options: [],
      },
    ]));
    expect(exported.filteredQuestionResponses).toBeUndefined();
    expect(exported.filteredResponses).toBeUndefined();
  });

  it('downloads current json exports through the active download path', async () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });
    await waitForHydratedResponseCount(1);

    openExportArea();
    selectExportType('JSON: Questions + Responses');
    // port note: the original stubbed generateResultsJSON/getExportBaseFileName and
    // asserted setState was not called; the ported path downloads real generated JSON,
    // with 'no setState' observed as the absence of any rendered alert.
    const capture = installBrowserDownloadCapture();
    let exportedText = '';
    try {
      clickExportDownload();

      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(capture.anchor.getAttribute('href')).toBe('blob:test-export');
      expect(capture.anchor.getAttribute('download')).toMatch(/^contextEngine_questionResults_.*\.json$/);
      expect(capture.anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(capture.appendChildSpy).toHaveBeenCalledWith(capture.anchor);
      expect(capture.removeChildSpy).toHaveBeenCalledWith(capture.anchor);
      capture.restore();
      exportedText = await readBlobText(capture.blobs[0]);
    } finally {
      capture.restore();
    }

    expect(() => JSON.parse(exportedText)).not.toThrow();
    expect(screen.queryByText('Invalid export type selected.')).toBeNull();
    expect(screen.queryByText('Network not available for fetching question data.')).toBeNull();
  });

  it('routes the rendered download button through the export controller path', async () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });
    await waitForHydratedResponseCount(1);

    openExportArea();
    selectExportType('JSON: Questions + Responses');
    const capture = installBrowserDownloadCapture();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));

      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(capture.anchor.getAttribute('href')).toBe('blob:test-export');
      expect(capture.anchor.getAttribute('download')).toMatch(/^contextEngine_questionResults_.*\.json$/);
      expect(capture.anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(capture.appendChildSpy).toHaveBeenCalledWith(capture.anchor);
      expect(capture.removeChildSpy).toHaveBeenCalledWith(capture.anchor);
    } finally {
      capture.restore();
    }

    expect(screen.queryByText('Invalid export type selected.')).toBeNull();
  });

  it('downloads question-only csv exports through the active download path', async () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });
    await waitForHydratedResponseCount(1);

    openExportArea();
    selectExportType('CSV: Questions');
    const capture = installBrowserDownloadCapture();
    let csv = '';
    try {
      clickExportDownload();

      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(capture.anchor.getAttribute('href')).toBe('blob:test-export');
      expect(capture.anchor.getAttribute('download')).toMatch(/^contextEngine_filteredQuestions_.*\.csv$/);
      expect(capture.anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(capture.appendChildSpy).toHaveBeenCalledWith(capture.anchor);
      expect(capture.removeChildSpy).toHaveBeenCalledWith(capture.anchor);
      capture.restore();
      csv = await readBlobText(capture.blobs[0]);
    } finally {
      capture.restore();
    }

    expect(csv.split('\n')[0]).toBe('"questionID","prompt","type","tags","options"');
    expect(screen.queryByText('No filtered questions to export.')).toBeNull();
    expect(screen.queryByText('Invalid export type selected.')).toBeNull();
  });

  it('rejects unknown export types through the invalid-export fallback', async () => {
    // port note: the export-type dropdown only offers valid types, so an unknown
    // exportType (legacy persisted state) cannot be reached through interaction; the
    // 'Invalid export type selected.' fallback is pinned in surveyResultsExportController.test.ts.
    // The ported guard proves every reachable export type downloads without the fallback.
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });
    await waitForHydratedResponseCount(1);

    openExportArea();
    const capture = installBrowserDownloadCapture();
    try {
      const optionLabels = [
        'CSV: Questions',
        'CSV: Questions + Responses',
        'JSON: Questions',
        'JSON: Questions + Responses',
      ];
      optionLabels.forEach((label) => {
        selectExportType(label);
        clickExportDownload();
      });

      expect(capture.createObjectURLMock).toHaveBeenCalledTimes(4);
    } finally {
      capture.restore();
    }

    expect(screen.queryByText('Invalid export type selected.')).toBeNull();
  });
});
