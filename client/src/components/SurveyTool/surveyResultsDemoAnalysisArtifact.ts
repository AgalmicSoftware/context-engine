import {
  SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
  SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  type SessionResultsAnalysisPayloadBuildResult,
  type SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

export const buildSurveyResultsDemoAnalysisArtifact = ({
  analysisPayload,
  generatedAt,
  inputSignature,
}: {
  analysisPayload: SessionResultsAnalysisPayloadBuildResult;
  generatedAt: string;
  inputSignature: string;
}): SessionResultsGeneratedAnalysisArtifact => {
  const questions = analysisPayload.aiPayload.questions;
  const responseCounts = new Map<string, number>();
  analysisPayload.aiPayload.responses.forEach((response) => {
    const key = String(response.questionId || '').trim();
    if (!key) return;
    responseCounts.set(key, (responseCounts.get(key) || 0) + 1);
  });
  const questionModels =
    questions.length > 0
      ? questions.slice(0, 6)
      : [{ id: 'demo-results', prompt: 'Demo results', type: 'demo', options: [], tags: [] }];
  const groups = questionModels.slice(0, 4).map((question, index) => ({
    id: `demo_group_${index + 1}`,
    label: question.prompt || `Demo theme ${index + 1}`,
    questionIds: [question.id],
    responseCount: responseCounts.get(question.id) || 0,
    summary: `Demo preview theme derived from ${responseCounts.get(question.id) || 0} visible response${(responseCounts.get(question.id) || 0) === 1 ? '' : 's'}.`,
  }));
  const nodes = questionModels.map((question, index) => ({
    id: `demo_atlas_${index + 1}`,
    label: question.prompt || `Demo node ${index + 1}`,
    path: ['Demo Session', question.prompt || `Question ${index + 1}`],
    questionIds: [question.id],
    responseCount: responseCounts.get(question.id) || 0,
    summary: 'Demo preview node generated from hydrated results.',
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    source: nodes[0]?.id || 'demo_atlas_1',
    target: node.id,
    label: index % 2 === 0 ? 'related theme' : 'adjacent concern',
  }));

  return {
    generatedAt,
    inputSignature: `demo-preview-${inputSignature}`,
    kind: SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
    model: 'demo-preview',
    participants: analysisPayload.participants,
    sections: {
      argumentMap: {
        available: true,
        debates: questionModels.slice(0, 3).map((question, index) => ({
          id: `demo_debate_${index + 1}`,
          title: question.prompt || `Demo debate ${index + 1}`,
          claims: [
            {
              id: `demo_claim_${index + 1}`,
              label: `Participants surface tradeoffs around ${question.prompt || 'this result'}.`,
              questionIds: [question.id],
              responseCount: responseCounts.get(question.id) || 0,
              stance: 'mixed',
            },
          ],
        })),
      },
      atlas: {
        available: true,
        edges,
        nodes,
      },
      breakdown: {
        available: true,
        dimensions: [],
        groups,
        summary: {
          overview: 'Demo preview analysis generated locally from currently hydrated results.',
        },
      },
      riskMatrix: {
        available: true,
        categories: questionModels.slice(0, 4).map((question, index) => ({
          id: `demo_risk_${index + 1}`,
          label: question.prompt || `Demo risk ${index + 1}`,
          description: 'Demo preview category for PDF/HTML layout testing.',
        })),
        comments: questionModels.slice(0, 4).map((question, index) => ({
          id: `demo_risk_comment_${index + 1}`,
          categoryId: `demo_risk_${index + 1}`,
          questionIds: [question.id],
          summary: `Demo preview signal from ${responseCounts.get(question.id) || 0} visible response${(responseCounts.get(question.id) || 0) === 1 ? '' : 's'}.`,
        })),
        heatmap: questionModels.slice(0, 4).reduce<Record<string, unknown>>((acc, question, index) => {
          acc[`demo_risk_${index + 1}`] = {
            impact: index % 2 === 0 ? 'medium' : 'high',
            likelihood: (responseCounts.get(question.id) || 0) > 1 ? 'medium' : 'low',
          };
          return acc;
        }, {}),
        scenarioLinks: [],
      },
    },
    source: 'ai-generated',
    version: SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  };
};
