import { buildReportFingerprint } from './provenance.mjs';
import { withOpinionGroupAvailability } from './opinion-groups.mjs';

export const buildContextEngineBenchmarkDataset = (sourceReport = {}) => {
  const report = withOpinionGroupAvailability(sourceReport);
  const participants = Array.isArray(report.participants) ? report.participants : [];
  const statements = Array.isArray(report.questions) ? report.questions : [];
  const matrix = report.polisReport?.byModelQuestion || {};
  return {
    schemaVersion: 1,
    kind: 'ce_benchmark_results_dataset',
    generatedAt: report.generatedAt || new Date().toISOString(),
    sourceReport: {
      benchmarkId: report.benchmarkId || '',
      reportGeneratedAt: report.generatedAt || null,
      reportFingerprint: buildReportFingerprint(sourceReport),
      mode: report.mode || 'self',
      personaId: report.personaId || null,
      status: report.status || 'preview',
    },
    summaryCorrection: report.summaryCorrection || null,
    stanceScale: {
      minimum: -1,
      midpoint: 0,
      maximum: 1,
      labels: { '-1': 'opposition', '0': 'mixed or unsure', '1': 'support' },
    },
    statistics: report.statistics || {},
    participants: participants.map((participant) => ({
      id: participant.id,
      label: participant.label || participant.id,
      model: participant.model || participant.id,
      provider: participant.provider || '',
      traits: participant.traits || {},
      provenance: participant.provenance || {},
      runtimeProvenance: participant.runtimeProvenance || {},
      aggregate: participant.summary || null,
      coverage: participant.coverage || null,
      opinionGroup: participant.opinionGroup ?? null,
    })),
    statements: statements.map((statement) => ({ ...statement })),
    responses: participants.flatMap((participant) => statements.map((statement) => ({
      participantId: participant.id,
      statementId: statement.id,
      summary: matrix[participant.id]?.[statement.id] || null,
    }))),
    polisReport: {
      aggregationUnit: report.polisReport?.aggregationUnit || 'model-participant',
      responseDistributionVersion: report.polisReport?.responseDistributionVersion || null,
      uncertaintyRateSemantics: report.polisReport?.uncertaintyRateSemantics || null,
      byQuestion: report.polisReport?.byQuestion || {},
      similarityMatrix: report.polisReport?.similarityMatrix || {},
      similarityDetails: report.polisReport?.similarityDetails || {},
      similarityEdges: report.polisReport?.similarityEdges || [],
    },
    participantGraph: report.participantGraph || {},
    breakdown: report.breakdown || {},
    importance: report.importance || { available: false },
    debateAtlas: report.debateAtlas || {},
    riskMatrix: report.riskMatrix || {},
    integrity: report.integrity || {},
    note: 'Measured response distributions are preserved for native Context Engine rendering, not discretized as in ce_polis_question_responses_export. Unsupported opinion groups are withheld using participantGraph.opinionGroupAvailability.',
  };
};
