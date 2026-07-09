import { buildSurveyResultsDemoAnalysisArtifact } from './surveyResultsDemoAnalysisArtifact';
import type { SessionResultsAnalysisPayloadBuildResult } from '../../utilities/sessionResultsExport';

const buildAnalysisPayload = ({
  questions = [
    { id: 'q1', prompt: 'First prompt', type: 'freeform', options: [], tags: [] },
    { id: 'q2', prompt: 'Second prompt', type: 'binary', options: ['Yes', 'No'], tags: ['tag'] },
  ],
  responses = [
    { answer: 'A', participantId: 'p1', questionId: 'q1' },
    { answer: 'B', participantId: 'p2', questionId: 'q1' },
    { answer: 'Yes', participantId: 'p1', questionId: 'q2' },
  ],
}: Partial<SessionResultsAnalysisPayloadBuildResult['aiPayload']> = {}): SessionResultsAnalysisPayloadBuildResult => ({
  aiPayload: {
    counts: {
      participants: 2,
      questions: questions.length,
      responses: responses.length,
    },
    inputLimits: {
      maxOptionsPerQuestion: 12,
      maxQuestionPromptChars: 900,
      maxQuestions: 80,
      maxResponseAdditionalChars: 900,
      maxResponseAnswerChars: 1400,
      maxResponses: 420,
      maxSegmentDimensions: 12,
      maxSegmentValuesPerDimension: 60,
      maxTagsPerQuestion: 16,
    },
    questions,
    responses,
    segmentDimensions: [],
    session: {
      name: 'Demo session',
      slug: 'demo',
    },
  },
  participants: [
    { displayAddress: '0x111...1111', syntheticId: 'p1' },
    { displayAddress: '0x222...2222', syntheticId: 'p2' },
  ],
});

describe('surveyResultsDemoAnalysisArtifact', () => {
  it('builds a demo analysis artifact from passed-in payload data without download side effects', () => {
    const artifact = buildSurveyResultsDemoAnalysisArtifact({
      analysisPayload: buildAnalysisPayload(),
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'payload-signature',
    });

    expect(artifact).toMatchObject({
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'demo-preview-payload-signature',
      kind: 'ce_session_results_analysis_artifact',
      model: 'demo-preview',
      source: 'ai-generated',
      version: 1,
    });
    expect(artifact.participants).toHaveLength(2);
    expect(artifact.sections.breakdown.groups).toEqual([
      expect.objectContaining({ id: 'demo_group_1', questionIds: ['q1'], responseCount: 2 }),
      expect.objectContaining({ id: 'demo_group_2', questionIds: ['q2'], responseCount: 1 }),
    ]);
    expect(artifact.sections.atlas.nodes).toHaveLength(2);
    expect(artifact.sections.riskMatrix.heatmap).toMatchObject({
      demo_risk_1: { impact: 'medium', likelihood: 'medium' },
      demo_risk_2: { impact: 'high', likelihood: 'low' },
    });
  });

  it('uses the fallback demo question when payload questions are empty', () => {
    const artifact = buildSurveyResultsDemoAnalysisArtifact({
      analysisPayload: buildAnalysisPayload({ questions: [], responses: [] }),
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'empty-payload',
    });

    expect(artifact.sections.breakdown.groups).toEqual([
      expect.objectContaining({
        id: 'demo_group_1',
        label: 'Demo results',
        questionIds: ['demo-results'],
        responseCount: 0,
      }),
    ]);
    expect(artifact.sections.argumentMap.debates[0]).toMatchObject({
      id: 'demo_debate_1',
      title: 'Demo results',
    });
  });
});
