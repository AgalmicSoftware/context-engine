const answerFromMeanScore = (score) => {
  if (!Number.isFinite(score)) return null;
  if (score > 0.25) return 'Agree';
  if (score < -0.25) return 'Disagree';
  return 'Unsure';
};

const compactSummary = (summary = {}) => ({
  counts: summary.counts || {},
  invalid: summary.invalid || 0,
  total: summary.total || 0,
  meanScore: Number.isFinite(summary.meanScore) ? summary.meanScore : null,
  uncertaintyRate: Number.isFinite(summary.uncertaintyRate) ? summary.uncertaintyRate : null,
  invalidRate: Number.isFinite(summary.invalidRate) ? summary.invalidRate : null,
  polarity: summary.polarity || {},
});

export const buildContextEnginePolisExport = (report) => {
  const questions = Array.isArray(report.questions) ? report.questions : [];
  const participants = Array.isArray(report.participants) ? report.participants : [];
  const matrix = report.polisReport?.byModelQuestion || {};
  const questionResponses = {};
  const displayNamesMap = {};

  participants.forEach((participant) => {
    displayNamesMap[String(participant.id).toLowerCase()] = participant.label || participant.id;
  });

  questions.forEach((question) => {
    const rows = participants
      .map((participant) => {
        const summary = matrix[participant.id]?.[question.id] || {};
        const answer = answerFromMeanScore(summary.meanScore);
        if (!answer) return null;
        return {
          responder: String(participant.id).toLowerCase(),
          questionId: question.id,
          response: JSON.stringify({
            type: 'binary',
            prompt: question.prompt || question.id,
            answer: {
              value: answer,
              encrypted: false,
            },
            sessionSlug: report.benchmarkId || 'ai-discourse-bench',
            source: 'ai-discourse-bench',
            benchmark: {
              benchmarkId: report.benchmarkId || '',
              mode: report.mode || 'self',
              personaId: report.personaId || null,
              modelId: participant.id,
              modelLabel: participant.label || participant.id,
              modelTraits: participant.traits || {},
              averagedFrom: compactSummary(summary),
            },
          }),
        };
      })
      .filter(Boolean);
    if (rows.length) questionResponses[question.id] = rows;
  });

  return {
    schemaVersion: 1,
    kind: 'ce_polis_question_responses_export',
    generatedAt: new Date().toISOString(),
    benchmarkId: report.benchmarkId || '',
    title: report.title || 'AI Discourse Bench Report',
    mode: report.mode || 'self',
    personaId: report.personaId || null,
    note: 'Import questionResponses and displayNamesMap into Context Engine PolisReport to render benchmark models as participants. Averaged model/question scores are discretized to Agree, Unsure, or Disagree.',
    counts: {
      questions: Object.keys(questionResponses).length,
      participants: participants.length,
      responses: Object.values(questionResponses).reduce((sum, rows) => sum + rows.length, 0),
    },
    questionResponses,
    displayNamesMap,
    questionPrompts: Object.fromEntries(questions.map((question) => [question.id, question.prompt || question.id])),
    participants: participants.map((participant) => ({
      id: participant.id,
      label: participant.label || participant.id,
      model: participant.model || participant.id,
      provider: participant.provider || '',
      traits: participant.traits || {},
    })),
  };
};
