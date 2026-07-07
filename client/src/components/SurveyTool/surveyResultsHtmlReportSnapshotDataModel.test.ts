import {
  normalizeGeneratedSessionResultsAnalysisArtifact,
  type SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';
import { buildSurveyResultsHtmlReportSnapshot } from './surveyResultsHtmlReportSnapshotDataModel';

const buildArtifact = (): SessionResultsGeneratedAnalysisArtifact =>
  normalizeGeneratedSessionResultsAnalysisArtifact({
    generatedAt: '2026-07-01T00:00:00.000Z',
    inputSignature: 'sig',
    rawOutput: {
      sections: {
        argumentMap: {
          debates: [{ id: 'debate-1' }],
        },
        atlas: {
          edges: [{ id: 'edge-1' }],
          nodes: [{ id: 'node-1' }, { id: 'node-2' }],
        },
        breakdown: {
          dimensions: [{ id: 'dimension-1' }],
          groups: [{ id: 'group-1' }],
          summary: { headline: 'summary' },
        },
        riskMatrix: {
          categories: [{ id: 'risk-1' }],
          comments: [{ id: 'comment-1' }],
          heatmap: { high: 1 },
          scenarioLinks: [{ id: 'scenario-1' }],
        },
      },
    },
  });

describe('surveyResultsHtmlReportSnapshotDataModel', () => {
  it('builds a redacted snapshot from question and response counts', () => {
    const snapshot = buildSurveyResultsHtmlReportSnapshot({
      chainId: 11155420,
      countsByQuestion: new Map([
        ['q1', 2],
        ['q2', 1],
      ]),
      exportedAt: '2026-07-02T00:00:00.000Z',
      exporterMetadata: {
        address: '0xabc',
        chainId: 11155420,
        displayAddress: '0xabc...def',
      },
      filterState: { tag: 'ops' },
      filteredQuestionsCount: 8,
      latestKnownBlock: 123,
      networkLabel: 'OP Sepolia',
      participantCount: 2,
      questions: [
        {
          id: 'q1',
          options: [],
          prompt: 'Question one',
          responseCount: 2,
          tags: ['ops'],
          type: 'freeform',
        },
      ],
      sessionName: 'Session one',
      sessionSlug: 'session-one',
      surveyId: 'survey-1',
      surveyTitle: 'Survey one',
      surveyViewMode: 'aggregate',
      totalResponsesCount: 10,
      viewMode: 'survey',
    });

    expect(snapshot.session).toEqual({
      chainId: 11155420,
      latestKnownBlock: 123,
      name: 'Session one',
      networkLabel: 'OP Sepolia',
      slug: 'session-one',
    });
    expect(snapshot.counts).toMatchObject({
      participants: 2,
      questions: 1,
      responses: 3,
    });
    expect(snapshot.exportedBy).toEqual({
      address: '0xabc',
      chainId: 11155420,
      displayAddress: '0xabc...def',
    });
    expect(snapshot.filters).toEqual({
      filterState: { tag: 'ops' },
      surveyId: 'survey-1',
      surveyViewMode: 'aggregate',
      viewMode: 'survey',
    });
    expect(snapshot.sections.report.available).toBe(true);
    expect(snapshot.sections.report.summary).toMatchObject({
      filteredQuestions: 1,
      generatedAnalysisAt: null,
      surveyId: 'survey-1',
      surveyTitle: 'Survey one',
    });
  });

  it('falls back to aggregate counts without hydrated rows', () => {
    const snapshot = buildSurveyResultsHtmlReportSnapshot({
      filteredQuestionsCount: 4,
      filteredResponsesCount: 5,
      sessionSlug: 'fallback-session',
    });

    expect(snapshot.session.name).toBe('fallback-session');
    expect(snapshot.counts).toMatchObject({
      questions: 4,
      responses: 5,
    });
    expect(snapshot.sections.report.available).toBe(true);
    expect(snapshot.sections.report.reason).toBeUndefined();
    expect(snapshot.sections.argumentMap.reason).toBe(
      'Generate analysis views to derive an argument map from this session data.',
    );
  });

  it('keeps the empty-section reason when no questions or responses are hydrated', () => {
    const snapshot = buildSurveyResultsHtmlReportSnapshot({
      sessionSlug: 'empty-session',
    });

    expect(snapshot.sections.report.available).toBe(false);
    expect(snapshot.sections.report.reason).toBe('No filtered questions or responses are hydrated yet.');
    expect(snapshot.sections.argumentMap.reason).toBe(
      'Generate analysis views to derive an argument map from this session data.',
    );
  });

  it('threads generated analysis artifact sections into the snapshot', () => {
    const artifact = buildArtifact();
    const snapshot = buildSurveyResultsHtmlReportSnapshot({
      analysisArtifact: artifact,
      questions: [
        {
          id: 'q1',
          options: [],
          prompt: 'Question one',
          responseCount: 1,
          tags: [],
          type: 'freeform',
        },
      ],
    });

    expect(snapshot.counts.atlasNodes).toBe(2);
    expect(snapshot.counts.riskMatrixComments).toBe(1);
    expect(snapshot.sections.report.summary).toMatchObject({
      generatedAnalysisAt: artifact.generatedAt,
      headline: 'summary',
    });
    expect(snapshot.sections.report.dimensions).toEqual([{ id: 'dimension-1' }]);
    expect(snapshot.sections.argumentMap.debates).toEqual([{ id: 'debate-1' }]);
    expect(snapshot.sections.riskMatrix.heatmap).toEqual({ high: 1 });
    expect(snapshot.sections.atlas.nodes).toEqual([{ id: 'node-1' }, { id: 'node-2' }]);
  });
});
