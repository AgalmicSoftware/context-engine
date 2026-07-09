import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import styles from './SurveyResults.module.scss';
import { callAI } from '../../utilities/ai/aiClient.js';
import {
  downloadSessionResultsHtmlReport,
  downloadSessionResultsPdfReport,
} from '../../utilities/sessionResultsExport';
import {
  OP_NETWORK,
  WALLET_ACCOUNT,
  analysisCachePeeks,
  analysisCacheReads,
  analysisCacheWrites,
  getDownloadReportButton,
  getSectionRows,
  mountSurveyResults,
  openExportArea,
  openHtmlReportModal,
  resetSurveyResultsExportControlsHarness,
  seedAnalysisEligibleSession,
  seedSingleBinaryQuestion,
  waitForHydratedResponseCount,
} from './SurveyResults.exportControlsHarness';

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
jest.mock('../../utilities/ai/aiClient.js', () => ({
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

beforeEach(() => {
  resetSurveyResultsExportControlsHarness();
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
});

describe('SurveyResults HTML report export controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
    expect((downloadSessionResultsPdfReport as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        filename: expect.stringMatching(/^contextEngine_sessionReport_demo_.*\.pdf$/),
        html: expect.stringContaining('ce-report-pdf'),
      }),
    );
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
});
