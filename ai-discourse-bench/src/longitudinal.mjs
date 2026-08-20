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
    questions: questions.map((question) => ({
      id: question.id,
      prompt: question.prompt || question.id,
      reversedPrompt: question.reversedPrompt || '',
      agreeMeans: question.agreeMeans || '',
      disagreementAxis: question.disagreementAxis || '',
      topic: question.topic || '',
      questionFingerprint: hashJson({
        prompt: question.prompt || question.id,
        reversedPrompt: question.reversedPrompt || '',
        agreeMeans: question.agreeMeans || '',
        disagreementAxis: question.disagreementAxis || '',
      }),
    })),
    models: participants.map((participant) => ({
      id: participant.id,
      label: participant.label || participant.id,
      model: participant.model || participant.id,
      provider: participant.provider || '',
      provenance: participant.provenance || {},
      runtimeProvenance: participant.runtimeProvenance || {},
      modelFingerprint: hashJson({
        model: participant.model || participant.id,
        provider: participant.provider || '',
        provenance: participant.provenance || {},
        resolvedModels: participant.runtimeProvenance?.resolvedModels || [],
        resolvedProviders: participant.runtimeProvenance?.resolvedProviders || [],
        systemFingerprints: participant.runtimeProvenance?.systemFingerprints || [],
      }),
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
  const baselineQuestions = new Map((baseline.questions || []).map((question) => [question.id, question]));
  const currentQuestions = new Map((current.questions || []).map((question) => [question.id, question]));
  for (const questionId of [...baselineQuestions.keys()].filter((id) => currentQuestions.has(id))) {
    if (baselineQuestions.get(questionId).questionFingerprint !== currentQuestions.get(questionId).questionFingerprint) {
      throw new Error(`snapshot question ${questionId} wording or interpretation changed`);
    }
  }
  const commonModelIds = [...baselineModels.keys()].filter((id) => currentModels.has(id)).sort();
  const modelDrift = commonModelIds.map((modelId) => {
    const before = baselineModels.get(modelId);
    const after = currentModels.get(modelId);
    if (before.modelFingerprint !== after.modelFingerprint) {
      throw new Error(`snapshot model ${modelId} provenance changed`);
    }
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
