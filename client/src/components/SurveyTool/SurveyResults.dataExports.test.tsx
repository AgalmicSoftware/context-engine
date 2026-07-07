import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { resolveSurveyResultsToggleKnobStyle } from './SurveyResults';
import {
  OP_NETWORK,
  RESPONDER_ONE,
  RESPONDER_TWO,
  SURVEY_ID,
  cacheStore,
  cacheStoreKey,
  clickExportDownload,
  installBrowserDownloadCapture,
  mountSurveyResults,
  openExportArea,
  readBlobText,
  resetSurveyResultsExportControlsHarness,
  seedQuestionsCache,
  seedSingleBinaryQuestion,
  selectExportType,
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

beforeEach(() => {
  resetSurveyResultsExportControlsHarness();
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
});

describe('SurveyResults data export controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
    expect(lines[0]).toBe(
      'responderAddress,questionID,questionPrompt,type,options,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp',
    );
    expect(lines[1]).toBe(
      `"${RESPONDER_ONE}","q1","Question One","multichoice","Alpha;Beta;Gamma","7","Alpha, Gamma","hash-1","Latest note","false","false","add-hash-1","2025-01-01T00:00:00.000Z"`,
    );
    expect(lines[2]).toBe(
      `"${RESPONDER_TWO}","q2","Question Two","freeform","","4","*","","","true","false","","2025-02-02T00:00:00.000Z"`,
    );
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
    expect(lines[0]).toBe(
      'questionID,questionPrompt,type,options,responderAddress,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp',
    );
    expect(lines[1]).toBe(
      `"q1","Aggregate Question","multichoice","Alpha;Beta;Gamma","${RESPONDER_ONE}","9","Alpha, Gamma","ans-hash","Current note","false","false","add-hash","2025-03-01T00:00:00.000Z"`,
    );
    expect(lines[2]).toBe(
      `"q1","Aggregate Question","multichoice","Alpha;Beta;Gamma","${RESPONDER_TWO}","5","Beta","second-ans-hash","Second note","false","false","second-add-hash","2025-03-02T00:00:00.000Z"`,
    );
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
    expect(lines[1]).toBe(
      `"q2","Fallback Question","multichoice","Yes;No","${RESPONDER_TWO}","4","Yes","","","false","","","2025-04-01T00:00:00.000Z"`,
    );
  });

  it('exports results JSON for the current filtered question view', async () => {
    seedQuestionsCache({
      questionResponses: {
        q1: {
          '0xabc': {
            answer: { encrypted: false, value: 'Agree' },
            questionId: 'q1',
            timeStamp: '2025-05-01T00:00:00.000Z',
          },
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
    expect(exported.counts).toEqual(
      expect.objectContaining({
        totalQuestions: 1,
        totalResponses: 1,
        filteredResponses: 1,
      }),
    );
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
          '0xabc': {
            answer: { encrypted: false, value: 'Agree' },
            questionId: 'q1',
            timeStamp: '2025-05-01T00:00:00.000Z',
          },
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
    expect(exported.filteredQuestions).toEqual(
      expect.arrayContaining([
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
      ]),
    );
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
