import { buildReportFingerprint, hashJson } from './provenance.mjs';

const round = (value, digits = 4) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const mean = (values) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;
const direction = (score) => {
  if (!Number.isFinite(score)) return 'no-data';
  if (score > 0.25) return 'support';
  if (score < -0.25) return 'opposition';
  return 'mixed';
};
const edgeKey = (left, right) => [left, right].sort().join('\u0000');

export const buildReportSnapshot = (report = {}, { label = '' } = {}) => {
  const reportFingerprint = buildReportFingerprint(report);
  const questions = Array.isArray(report.questions) ? report.questions : [];
  const participants = Array.isArray(report.participants) ? report.participants : [];
  const matrix = report.polisReport?.byModelQuestion || {};
  const snapshot = {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_longitudinal_snapshot',
    label: label || report.generatedAt || reportFingerprint.slice(0, 12),
    capturedAt: new Date().toISOString(),
    source: {
      benchmarkId: report.benchmarkId || '',
      generatedAt: report.generatedAt || null,
      reportFingerprint,
      mode: report.mode || 'self',
      personaId: report.personaId || null,
    },
    questions: questions.map((question) => ({ id: question.id, prompt: question.prompt || question.id, topic: question.topic || '' })),
    models: participants.map((participant) => ({
      id: participant.id,
      label: participant.label || participant.id,
      model: participant.model || participant.id,
      provider: participant.provider || '',
      provenance: participant.provenance || {},
      runtimeProvenance: participant.runtimeProvenance || {},
      aggregate: participant.summary || null,
      byQuestion: Object.fromEntries(questions.map((question) => {
        const summary = matrix[participant.id]?.[question.id] || null;
        return [question.id, summary ? {
          meanScore: Number.isFinite(summary.meanScore) ? summary.meanScore : null,
          meanScoreInterval: summary.meanScoreInterval || null,
          counts: summary.counts || {},
          wordingSensitivity: summary.polarity?.wordingSensitivity || null,
        } : null];
      })),
    })),
    similarityEdges: (report.polisReport?.similarityEdges || []).map((edge) => ({ ...edge })),
    statistics: report.statistics || {},
    integrity: report.integrity || {},
  };
  return {
    ...snapshot,
    snapshotId: hashJson({
      source: snapshot.source,
      questions: snapshot.questions,
      models: snapshot.models,
      similarityEdges: snapshot.similarityEdges,
    }),
  };
};

export const compareLongitudinalSnapshots = (baseline = {}, current = {}) => {
  for (const field of ['benchmarkId', 'mode', 'personaId']) {
    if ((baseline.source?.[field] ?? null) !== (current.source?.[field] ?? null)) {
      throw new Error(`snapshot source ${field} values do not match`);
    }
  }
  const baselineModels = new Map((baseline.models || []).map((model) => [model.id, model]));
  const currentModels = new Map((current.models || []).map((model) => [model.id, model]));
  const commonModelIds = [...baselineModels.keys()].filter((id) => currentModels.has(id)).sort();
  const modelDrift = commonModelIds.map((modelId) => {
    const before = baselineModels.get(modelId);
    const after = currentModels.get(modelId);
    const commonQuestionIds = Object.keys(before.byQuestion || {})
      .filter((questionId) => after.byQuestion?.[questionId])
      .filter((questionId) => Number.isFinite(before.byQuestion[questionId]?.meanScore)
        && Number.isFinite(after.byQuestion[questionId]?.meanScore))
      .sort();
    const questionDrift = commonQuestionIds.map((questionId) => {
      const baselineScore = before.byQuestion[questionId].meanScore;
      const currentScore = after.byQuestion[questionId].meanScore;
      const signedShift = currentScore - baselineScore;
      return {
        questionId,
        baselineScore,
        currentScore,
        signedShift: round(signedShift),
        absoluteShift: round(Math.abs(signedShift)),
        baselineDirection: direction(baselineScore),
        currentDirection: direction(currentScore),
        directionChanged: direction(baselineScore) !== direction(currentScore),
      };
    });
    return {
      modelId,
      questionsCompared: questionDrift.length,
      meanSignedShift: round(mean(questionDrift.map((row) => row.signedShift))),
      meanAbsoluteShift: round(mean(questionDrift.map((row) => row.absoluteShift))),
      directionChanges: questionDrift.filter((row) => row.directionChanged).length,
      questionDrift,
    };
  });

  const baselineEdges = new Map((baseline.similarityEdges || []).map((edge) => [edgeKey(edge.source, edge.target), edge]));
  const similarityDrift = (current.similarityEdges || []).flatMap((edge) => {
    const before = baselineEdges.get(edgeKey(edge.source, edge.target));
    if (!before || !Number.isFinite(before.similarity) || !Number.isFinite(edge.similarity)) return [];
    return [{
      source: edge.source,
      target: edge.target,
      baselineSimilarity: before.similarity,
      currentSimilarity: edge.similarity,
      signedShift: round(edge.similarity - before.similarity),
      absoluteShift: round(Math.abs(edge.similarity - before.similarity)),
    }];
  }).sort((left, right) => right.absoluteShift - left.absoluteShift);

  return {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_longitudinal_comparison',
    generatedAt: new Date().toISOString(),
    baseline: { snapshotId: baseline.snapshotId || null, label: baseline.label || '', source: baseline.source || {} },
    current: { snapshotId: current.snapshotId || null, label: current.label || '', source: current.source || {} },
    commonModels: commonModelIds.length,
    modelDrift,
    similarityDrift,
    summary: {
      meanModelAbsoluteShift: round(mean(modelDrift.map((row) => row.meanAbsoluteShift).filter(Number.isFinite))),
      totalDirectionChanges: modelDrift.reduce((sum, row) => sum + row.directionChanges, 0),
      meanSimilarityAbsoluteShift: round(mean(similarityDrift.map((row) => row.absoluteShift))),
    },
  };
};
