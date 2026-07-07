import {
  buildRedactedSessionResultsSnapshot,
  type SessionResultsExporterMetadata,
  type SessionResultsGeneratedAnalysisArtifact,
  type SessionResultsHtmlSnapshot,
  type SessionResultsReportQuestion,
} from '../../utilities/sessionResultsExport';

export type BuildSurveyResultsHtmlReportSnapshotArgs = {
  analysisArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  chainId?: number | null;
  countsByQuestion?: Map<string, number> | null;
  exportedAt?: unknown;
  exporterMetadata?: SessionResultsExporterMetadata | null;
  filterState?: unknown;
  filteredQuestionsCount?: unknown;
  filteredResponsesCount?: unknown;
  latestKnownBlock?: unknown;
  networkLabel?: unknown;
  participantCount?: unknown;
  questions?: SessionResultsReportQuestion[] | null;
  sessionName?: unknown;
  sessionSlug?: unknown;
  surveyId?: unknown;
  surveyTitle?: unknown;
  surveyViewMode?: unknown;
  totalQuestionsCount?: unknown;
  totalResponsesCount?: unknown;
  viewMode?: unknown;
};

export const buildSurveyResultsHtmlReportSnapshot = ({
  analysisArtifact = null,
  chainId = null,
  countsByQuestion = new Map<string, number>(),
  exportedAt = new Date().toISOString(),
  exporterMetadata = null,
  filterState = {},
  filteredQuestionsCount = 0,
  filteredResponsesCount = 0,
  latestKnownBlock = null,
  networkLabel = '',
  participantCount = 0,
  questions = [],
  sessionName = '',
  sessionSlug = '',
  surveyId = null,
  surveyTitle = '',
  surveyViewMode = '',
  totalQuestionsCount = 0,
  totalResponsesCount = 0,
  viewMode = '',
}: BuildSurveyResultsHtmlReportSnapshotArgs = {}): SessionResultsHtmlSnapshot => {
  const reportQuestions = Array.isArray(questions) ? questions : [];
  const responseCountFromRows = Array.from(countsByQuestion?.values() || []).reduce(
    (sum, count) => sum + Number(count || 0),
    0,
  );
  const responsesCount = responseCountFromRows || Number(filteredResponsesCount) || Number(totalResponsesCount) || 0;
  const questionsCount = reportQuestions.length || Number(filteredQuestionsCount) || Number(totalQuestionsCount) || 0;
  const slug = String(sessionSlug || '').trim();
  const name = String(sessionName || slug || 'Session').trim();
  const hasReportContent = reportQuestions.length > 0 || responsesCount > 0;
  const latestBlock = Number(latestKnownBlock);

  return buildRedactedSessionResultsSnapshot({
    exportedAt,
    session: {
      slug,
      name,
      chainId,
      networkLabel: String(networkLabel || '').trim(),
      latestKnownBlock: Number.isFinite(latestBlock) ? latestBlock : null,
    },
    exportedBy: exporterMetadata || undefined,
    counts: {
      questions: questionsCount,
      responses: responsesCount,
      participants: Number(participantCount) || 0,
      atlasNodes: analysisArtifact?.sections.atlas.nodes.length || 0,
      riskMatrixComments: analysisArtifact?.sections.riskMatrix.comments.length || 0,
    },
    filters: {
      filterState: filterState || {},
      surveyId: surveyId || null,
      surveyViewMode: surveyViewMode || null,
      viewMode: viewMode || null,
    },
    sections: {
      report: {
        available: hasReportContent,
        summary: {
          ...(analysisArtifact?.sections.breakdown.summary || {}),
          filteredQuestions: reportQuestions.length,
          generatedAnalysisAt: analysisArtifact?.generatedAt || null,
          surveyId: surveyId || null,
          surveyTitle: surveyTitle || '',
          surveyViewMode: surveyViewMode || '',
          viewMode: viewMode || '',
        },
        dimensions: analysisArtifact?.sections.breakdown.dimensions || [],
        groups: analysisArtifact?.sections.breakdown.groups || [],
        representativeQuestions: [],
        questions: reportQuestions,
        reason: hasReportContent ? undefined : 'No filtered questions or responses are hydrated yet.',
      },
      argumentMap: {
        available: !!analysisArtifact?.sections.argumentMap.available,
        debates: analysisArtifact?.sections.argumentMap.debates || [],
        reason:
          analysisArtifact?.sections.argumentMap.reason ||
          'Generate analysis views to derive an argument map from this session data.',
      },
      riskMatrix: {
        available: !!analysisArtifact?.sections.riskMatrix.available,
        categories: analysisArtifact?.sections.riskMatrix.categories || [],
        comments: analysisArtifact?.sections.riskMatrix.comments || [],
        heatmap: analysisArtifact?.sections.riskMatrix.heatmap || {},
        scenarioLinks: analysisArtifact?.sections.riskMatrix.scenarioLinks || [],
        reason:
          analysisArtifact?.sections.riskMatrix.reason ||
          'Generate analysis views to derive a custom risk matrix from this session data.',
      },
      atlas: {
        available: !!analysisArtifact?.sections.atlas.available,
        nodes: analysisArtifact?.sections.atlas.nodes || [],
        edges: analysisArtifact?.sections.atlas.edges || [],
        reason:
          analysisArtifact?.sections.atlas.reason ||
          'Generate analysis views to derive atlas nodes from this session data.',
      },
    },
  });
};
