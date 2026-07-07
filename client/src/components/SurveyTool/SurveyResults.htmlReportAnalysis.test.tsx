import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { callAI } from '../../utilities/ai/aiClient.js';
import {
  downloadSessionResultsHtmlReport,
  downloadSessionResultsPdfReport,
} from '../../utilities/sessionResultsExport';
import {
  BREAKDOWN_ANALYSIS_JSON,
  OP_NETWORK,
  RESPONDER_ONE,
  RESPONDER_TWO,
  RISK_MATRIX_ANALYSIS_JSON,
  WALLET_ACCOUNT,
  analysisArtifactsFromWrite,
  analysisCachePeeks,
  analysisCacheReads,
  analysisCacheWrites,
  cacheStore,
  cacheStoreKey,
  callAIPrompts,
  clickGenerateAnalysis,
  createAnalysisArtifact,
  createDeferred,
  flushMicrotasks,
  getDownloadReportButton,
  getGenerateAnalysisButton,
  getSectionRows,
  latestBlockSpy,
  mountSurveyResults,
  openHtmlReportModal,
  peekSpy,
  primeAnalysisArtifactCacheKey,
  readSpy,
  resetSurveyResultsExportControlsHarness,
  seedAnalysisEligibleSession,
  seedSingleBinaryQuestion,
  seedQuestionsCache,
  setAnalysisPeekError,
  setAnalysisWriteErrors,
  waitForAnalysisCacheWrites,
  waitForAnalysisIdle,
  waitForHydratedResponseCount,
  writeSpy,
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

describe('SurveyResults HTML report analysis controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some((arg) => String(arg).includes('[SurveyResults.downloadHtmlReport] Failed to export HTML report')),
      ),
    ).toBe(true);

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
        return Promise.resolve(
          JSON.stringify({
            breakdown: {
              dimensions: [
                {
                  id: 'question_tags',
                  label: 'Question Tags',
                  values: [{ id: 'exports', label: 'exports', count: 3 }],
                },
              ],
              summary: { overview: 'Participants broadly prioritize clear export controls.' },
              groups: [{ id: 'group_1', label: 'Export controls', participantIds: ['participant_001'] }],
            },
          }),
        );
      }
      if (prompt.includes('Generate only this result view: Argument Map')) {
        return Promise.resolve(
          JSON.stringify({
            argumentMap: {
              debates: [
                {
                  id: 'debate_1',
                  title: 'Export scope',
                  claims: [{ id: 'claim_1', participantIds: ['participant_001'] }],
                },
              ],
            },
          }),
        );
      }
      if (prompt.includes('Generate only this result view: Risk Matrix')) {
        return Promise.resolve(
          JSON.stringify({
            riskMatrix: {
              categories: [{ id: 'risk_1', label: 'Privacy leakage' }],
              comments: [{ id: 'risk_comment_1', participantIds: ['participant_002'] }],
              heatmap: { risk_1: { likelihood: 'medium', impact: 'high' } },
            },
          }),
        );
      }
      return Promise.resolve(
        JSON.stringify({
          atlas: {
            nodes: [{ id: 'atlas_1', label: 'Privacy-preserving exports', participantIds: ['participant_001'] }],
            edges: [],
          },
        }),
      );
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
    expect(callAIPrompts()).toEqual([expect.stringContaining('Generate only this result view: Breakdown')]);
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
    expect(writeSpy.mock.invocationCallOrder[writeSpy.mock.invocationCallOrder.length - 1]).toBeLessThan(
      (callAI as jest.Mock).mock.invocationCallOrder[1],
    );

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
    expect(
      screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.'),
    ).toBeNull();
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
      .mockResolvedValueOnce(
        JSON.stringify({
          breakdown: {
            dimensions: [],
            groups: [{ id: 'group_1', label: 'Partial group' }],
            summary: { overview: 'First section ready.' },
          },
        }),
      )
      .mockRejectedValueOnce(new Error('risk matrix unavailable'))
      .mockResolvedValueOnce(
        JSON.stringify({
          riskMatrix: {
            categories: [{ id: 'risk_1', label: 'Recovered risk' }],
            comments: [],
            heatmap: {},
            scenarioLinks: [],
          },
        }),
      );
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
    expect((callAI as jest.Mock).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        sessionSlug: 'partial-failure-session',
        taskType: 'analysis',
      }),
    );
    expect(analysisCacheWrites()).toHaveLength(1);
    const partialEntries = analysisArtifactsFromWrite(0);
    expect(partialEntries[0][1]).toEqual(
      expect.objectContaining({
        kind: 'ce_session_results_analysis_artifact',
        source: 'ai-generated',
        version: 1,
      }),
    );
    expect(partialEntries[0][1].sections.breakdown.available).toBe(true);
    expect(partialEntries[0][1].sections.riskMatrix.available).toBe(false);
    // port note: the lifecycle failure-recovery setState patch equality is covered by the
    // buildSurveyResultsAnalysisLifecyclePlan module tests; here the recovery is observed
    // through the rendered error state and section rows.
    expect(getSectionRows().find((row) => row.label === 'Risk Matrix')?.reason).toBe('Needs analysis');
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some((arg) =>
          String(arg).includes('[SurveyResults.generateHtmlReportAnalysisViews] Failed to generate analysis'),
        ),
      ),
    ).toBe(true);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(latestBlockSpy.mock.calls.length).toBe(latestBlockCallsBeforeGenerate);

    clickGenerateAnalysis();
    await waitForAnalysisCacheWrites(2);
    await waitForAnalysisIdle();

    expect(callAI).toHaveBeenCalledTimes(3);
    expect((callAI as jest.Mock).mock.calls[2][0]).toEqual(
      expect.stringContaining('Generate only this result view: Risk Matrix'),
    );
    const recoveredEntries = analysisArtifactsFromWrite(1);
    expect(recoveredEntries[0][1].sections.breakdown.available).toBe(true);
    expect(recoveredEntries[0][1].sections.riskMatrix.available).toBe(true);
    expect(
      screen.queryByText('Unable to generate analysis views right now. Check AI settings and try again.'),
    ).toBeNull();
    expect(getSectionRows().find((row) => row.label === 'Risk Matrix')?.availability).toBe('Available');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });
});
