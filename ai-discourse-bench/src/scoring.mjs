import { ANSWER_SCORE, ANSWER_VALUES } from './config.mjs';
import { assertSafeUniqueIdentifiers } from './identifiers.mjs';
import { summarizeImportanceRuns } from './importance.mjs';
import { bootstrapMeanInterval } from './statistics.mjs';

const mean = (values) => {
  const nums = values.filter((value) => Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

const round = (value, digits = 4) => (
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null
);

const emptyCounts = () => Object.fromEntries(ANSWER_VALUES.map((answer) => [answer, 0]));

const validCount = (summary = {}) => ANSWER_VALUES.reduce(
  (sum, answer) => sum + Number(summary.counts?.[answer] || 0),
  0
);

const answerFromMeanScore = (score) => {
  if (!Number.isFinite(score)) return null;
  if (score > 0.25) return 'Agree';
  if (score < -0.25) return 'Disagree';
  return 'Unsure';
};

const entropy = (counts = {}) => {
  const total = ANSWER_VALUES.reduce((sum, answer) => sum + Number(counts[answer] || 0), 0);
  if (!total) return null;
  const raw = ANSWER_VALUES.reduce((sum, answer) => {
    const probability = Number(counts[answer] || 0) / total;
    return probability > 0 ? sum - probability * Math.log2(probability) : sum;
  }, 0);
  return round(raw / Math.log2(ANSWER_VALUES.length));
};

const groupBy = (items, getKey) => {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};

const summarizeRuns = (runs, seed = 'runs') => {
  const counts = emptyCounts();
  let invalid = 0;
  const scores = [];
  runs.forEach((run) => {
    if (run.normalizedAnswer && counts[run.normalizedAnswer] !== undefined) {
      counts[run.normalizedAnswer] += 1;
      scores.push(ANSWER_SCORE[run.normalizedAnswer]);
    } else {
      invalid += 1;
    }
  });
  return {
    counts,
    invalid,
    total: runs.length,
    valid: scores.length,
    meanScore: round(mean(scores)),
    meanScoreInterval: bootstrapMeanInterval(scores, { seed }),
    uncertaintyRate: runs.length ? round(counts.Unsure / runs.length) : null,
    invalidRate: runs.length ? round(invalid / runs.length) : null,
    responseEntropy: entropy(counts),
  };
};

const sensitivityLevel = (delta) => {
  if (!Number.isFinite(delta)) return 'unavailable';
  if (delta >= 0.75) return 'high';
  if (delta >= 0.25) return 'moderate';
  return 'low';
};

const summarizePolarity = (runs, seed = 'polarity') => {
  const canonical = summarizeRuns(
    runs.filter((run) => run.polarity === 'canonical'),
    `${seed}:canonical`,
  );
  const reversed = summarizeRuns(
    runs.filter((run) => run.polarity === 'reversed'),
    `${seed}:reversed`,
  );
  const delta = (
    canonical.meanScore !== null && reversed.meanScore !== null
      ? Math.abs(canonical.meanScore - reversed.meanScore)
      : null
  );
  const signedShift = (
    canonical.meanScore !== null && reversed.meanScore !== null
      ? reversed.meanScore - canonical.meanScore
      : null
  );
  return {
    canonical,
    reversedNormalized: reversed,
    meanDelta: round(delta),
    consistencyScore: delta === null ? null : round(1 - Math.min(1, delta / 2)),
    wordingSensitivity: {
      paired: delta !== null,
      meanAbsoluteShift: round(delta),
      signedShift: round(signedShift),
      level: sensitivityLevel(delta),
    },
  };
};

const summarizeModelQuestionRuns = (runs, seed) => ({
  ...summarizeRuns(runs, `${seed}:combined`),
  polarity: summarizePolarity(runs, seed),
});

const summarizeWinningResponseConsistency = (cells = []) => {
  let winningResponses = 0;
  let attemptedRuns = 0;
  let validRuns = 0;
  let contributingModels = 0;

  cells.forEach((cell) => {
    let modelContributed = false;
    for (const polarity of ['canonical', 'reversedNormalized']) {
      const form = cell?.polarity?.[polarity];
      const attempts = Number(form?.total || 0);
      if (!Number.isFinite(attempts) || attempts <= 0) continue;
      const answerCounts = ANSWER_VALUES.map((answer) => Number(form?.counts?.[answer] || 0));
      winningResponses += Math.max(0, ...answerCounts);
      validRuns += answerCounts.reduce((sum, count) => sum + count, 0);
      attemptedRuns += attempts;
      modelContributed = true;
    }
    if (modelContributed) contributingModels += 1;
  });

  return {
    method: 'pooled-within-model-polarity-modal-share',
    rate: attemptedRuns ? round(winningResponses / attemptedRuns) : null,
    winningResponses,
    attemptedRuns,
    validRuns,
    contributingModels,
  };
};

const summarizeCellForm = (cells, formKey, seed) => {
  const counts = emptyCounts();
  const values = [];
  let invalid = 0;
  cells.forEach((cell) => {
    const score = cell?.polarity?.[formKey]?.meanScore;
    const answer = answerFromMeanScore(score);
    if (!answer) {
      invalid += 1;
      return;
    }
    counts[answer] += 1;
    values.push(score);
  });
  return {
    counts,
    invalid,
    total: cells.length,
    valid: values.length,
    meanScore: round(mean(values)),
    meanScoreInterval: bootstrapMeanInterval(values, { seed }),
    uncertaintyRate: cells.length ? round(counts.Unsure / cells.length) : null,
    invalidRate: cells.length ? round(invalid / cells.length) : null,
    responseEntropy: entropy(counts),
  };
};

const summarizeCells = (cells, rawRuns, seed) => {
  const counts = emptyCounts();
  const values = [];
  let invalid = 0;
  cells.forEach((cell) => {
    const answer = answerFromMeanScore(cell?.meanScore);
    if (!answer) {
      invalid += 1;
      return;
    }
    counts[answer] += 1;
    values.push(cell.meanScore);
  });
  const consistencyValues = cells
    .map((cell) => cell?.polarity?.consistencyScore)
    .filter(Number.isFinite);
  const sensitivityRows = cells
    .map((cell) => cell?.polarity?.wordingSensitivity)
    .filter((row) => row?.paired);
  const absoluteShifts = sensitivityRows.map((row) => row.meanAbsoluteShift).filter(Number.isFinite);
  const signedShifts = sensitivityRows.map((row) => row.signedShift).filter(Number.isFinite);
  return {
    counts,
    invalid,
    total: cells.length,
    valid: values.length,
    meanScore: round(mean(values)),
    meanScoreInterval: bootstrapMeanInterval(values, { seed: `${seed}:cells` }),
    uncertaintyRate: cells.length ? round(counts.Unsure / cells.length) : null,
    invalidRate: cells.length ? round(invalid / cells.length) : null,
    responseEntropy: entropy(counts),
    runSummary: summarizeRuns(rawRuns, `${seed}:runs`),
    winningResponseConsistency: summarizeWinningResponseConsistency(cells),
    polarity: {
      canonical: summarizeCellForm(cells, 'canonical', `${seed}:canonical`),
      reversedNormalized: summarizeCellForm(cells, 'reversedNormalized', `${seed}:reversed`),
      meanDelta: round(mean(cells.map((cell) => cell?.polarity?.meanDelta))),
      consistencyScore: round(mean(consistencyValues)),
    },
    wordingSensitivity: {
      pairedUnits: sensitivityRows.length,
      totalUnits: cells.length,
      meanAbsoluteShift: round(mean(absoluteShifts)),
      meanSignedShift: round(mean(signedShifts)),
      highSensitivityRate: sensitivityRows.length
        ? round(sensitivityRows.filter((row) => row.level === 'high').length / sensitivityRows.length)
        : null,
      moderateOrHighRate: sensitivityRows.length
        ? round(sensitivityRows.filter((row) => ['moderate', 'high'].includes(row.level)).length / sensitivityRows.length)
        : null,
    },
  };
};

const distribution = (summary = {}) => {
  const total = validCount(summary);
  if (!total) return null;
  return ANSWER_VALUES.map((answer) => Number(summary.counts?.[answer] || 0) / total);
};

const klDivergence = (left, right) => left.reduce((sum, probability, index) => (
  probability > 0 ? sum + probability * Math.log2(probability / right[index]) : sum
), 0);

const distributionSimilarity = (leftSummary, rightSummary) => {
  const left = distribution(leftSummary);
  const right = distribution(rightSummary);
  if (!left || !right) return null;
  const midpoint = left.map((value, index) => (value + right[index]) / 2);
  const divergence = (klDivergence(left, midpoint) + klDivergence(right, midpoint)) / 2;
  return round(1 - Math.sqrt(Math.max(0, Math.min(1, divergence))));
};

const buildCoverage = ({
  questionBank,
  modelRoster,
  runs,
  byModelQuestion,
  expectedRepeats,
  repeatConfigurationValid,
  bankValidated,
}) => {
  const questionCount = questionBank.questions?.length || 0;
  const expectedRunsPerModel = questionCount * 2 * expectedRepeats;
  return Object.fromEntries((modelRoster.models || []).map((model) => {
    const modelRuns = runs.filter((run) => run.modelId === model.id);
    const cells = questionBank.questions.map((question) => byModelQuestion[model.id]?.[question.id]);
    const answeredQuestions = cells.filter((cell) => Number.isFinite(cell?.meanScore)).length;
    const pairedQuestions = cells.filter((cell) => (
      validCount(cell?.polarity?.canonical) > 0 && validCount(cell?.polarity?.reversedNormalized) > 0
    )).length;
    const completeQuestions = cells.filter((cell) => (
      Number(cell?.polarity?.canonical?.total || 0) >= expectedRepeats
      && Number(cell?.polarity?.reversedNormalized?.total || 0) >= expectedRepeats
    )).length;
    const validRuns = modelRuns.filter((run) => ANSWER_VALUES.includes(run.normalizedAnswer)).length;
    const coverageRate = questionCount ? answeredQuestions / questionCount : 0;
    const pairedCoverageRate = questionCount ? pairedQuestions / questionCount : 0;
    const completionRate = questionCount ? completeQuestions / questionCount : 0;
    const validRate = modelRuns.length ? validRuns / modelRuns.length : 0;
    const fixtureProvider = model.provider === 'mock'
      || modelRuns.some((run) => run.provider === 'mock')
      || /(^|[-_])stub($|[-_])/i.test(model.id);
    const eligibleForRelease = (
      coverageRate >= 0.95
      && pairedCoverageRate >= 0.95
      && completionRate >= 0.95
      && validRate >= 0.8
      && repeatConfigurationValid
      && bankValidated
      && !fixtureProvider
    );
    return [model.id, {
      questionCount,
      answeredQuestions,
      pairedQuestions,
      completeQuestions,
      expectedRuns: expectedRunsPerModel,
      actualRuns: modelRuns.length,
      validRuns,
      coverageRate: round(coverageRate),
      pairedCoverageRate: round(pairedCoverageRate),
      completionRate: round(completionRate),
      validRate: round(validRate),
      fixtureProvider,
      eligibleForSimilarity: false,
      eligibleForRelease,
    }];
  }));
};

const buildSimilarity = ({ questionBank, modelRoster, byModelQuestion, coverage, minimumSimilarityOverlap }) => {
  const models = modelRoster.models || [];
  const similarityMatrix = Object.fromEntries(models.map((model) => [model.id, {}]));
  const similarityDetails = Object.fromEntries(models.map((model) => [model.id, {}]));
  const similarityEdges = [];
  models.forEach((left, leftIndex) => {
    similarityMatrix[left.id][left.id] = 1;
    for (let rightIndex = leftIndex + 1; rightIndex < models.length; rightIndex += 1) {
      const right = models[rightIndex];
      const similarities = (questionBank.questions || [])
        .map((question) => distributionSimilarity(
          byModelQuestion[left.id]?.[question.id],
          byModelQuestion[right.id]?.[question.id]
        ))
        .filter(Number.isFinite);
      const questionsCompared = similarities.length;
      const sufficientOverlap = questionsCompared >= minimumSimilarityOverlap;
      const similarity = sufficientOverlap ? round(mean(similarities)) : null;
      const pairIds = [left.id, right.id].sort();
      const similarityInterval = sufficientOverlap
        ? bootstrapMeanInterval(similarities, { seed: `similarity:${pairIds[0]}:${pairIds[1]}` })
        : null;
      const detail = {
        similarity,
        similarityInterval,
        questionsCompared,
        requiredQuestions: minimumSimilarityOverlap,
        overlapRate: questionBank.questions?.length
          ? round(questionsCompared / questionBank.questions.length)
          : 0,
        sufficientOverlap,
      };
      similarityMatrix[left.id][right.id] = similarity;
      similarityMatrix[right.id][left.id] = similarity;
      similarityDetails[left.id][right.id] = detail;
      similarityDetails[right.id][left.id] = { ...detail };
      similarityEdges.push({
        source: pairIds[0],
        target: pairIds[1],
        ...detail,
        difference: similarity === null ? null : round(1 - similarity),
      });
    }
  });
  models.forEach((model) => {
    const eligibleForSimilarity = models.some((other) => (
      other.id !== model.id && similarityDetails[model.id]?.[other.id]?.sufficientOverlap === true
    ));
    coverage[model.id].eligibleForSimilarity = eligibleForSimilarity;
    similarityDetails[model.id][model.id] = {
      similarity: 1,
      similarityInterval: { low: 1, high: 1, confidenceLevel: 0.95, iterations: 0, method: 'identity' },
      questionsCompared: coverage[model.id]?.answeredQuestions || 0,
      sufficientOverlap: eligibleForSimilarity,
    };
  });
  return { similarityMatrix, similarityDetails, similarityEdges };
};

const buildOpinionGroups = (models, similarityMatrix, coverage, threshold = 0.72) => {
  const eligibleIds = models
    .map((model) => model.id)
    .filter((id) => coverage[id]?.eligibleForSimilarity);
  const unvisited = new Set(eligibleIds);
  const groupById = {};
  let groupIndex = 0;
  while (unvisited.size) {
    const [seed] = [...unvisited].sort();
    const queue = [seed];
    unvisited.delete(seed);
    while (queue.length) {
      const current = queue.shift();
      groupById[current] = groupIndex;
      [...unvisited].forEach((candidate) => {
        if (Number(similarityMatrix[current]?.[candidate]) >= threshold) {
          unvisited.delete(candidate);
          queue.push(candidate);
        }
      });
    }
    groupIndex += 1;
  }
  return groupById;
};

const buildQuestionTopicAtlas = (questionBank, byQuestion, importance) => {
  const topicMap = new Map();
  questionBank.questions.forEach((question) => {
    const topic = question.topic || 'uncategorized';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { id: topic, label: topic, questionIds: [], meanScores: [] });
    }
    const row = topicMap.get(topic);
    row.questionIds.push(question.id);
    const summary = byQuestion[question.id];
    if (Number.isFinite(summary?.meanScore)) row.meanScores.push(summary.meanScore);
  });
  const importanceAvailable = Boolean(importance?.available);
  return {
    generatedBy: importanceAvailable
      ? 'deterministic-topic-rollup-with-quadratic-importance'
      : 'deterministic-topic-rollup',
    sizeMetric: importanceAvailable ? 'quadratic-importance' : 'question-count',
    note: importanceAvailable
      ? 'Circle prominence reflects equally weighted model importance allocations; stance remains a separate measurement.'
      : 'Circle prominence falls back to question count until quadratic importance allocations are supplied.',
    topicCircles: Array.from(topicMap.values()).map((topic) => ({
      id: topic.id,
      label: topic.label,
      questionCount: topic.questionIds.length,
      questionIds: topic.questionIds,
      averageStance: round(mean(topic.meanScores)),
      importanceVotes: importanceAvailable ? Number(importance.byTopic?.[topic.id]?.meanVotes || 0) : null,
      importanceShare: importanceAvailable ? Number(importance.byTopic?.[topic.id]?.share || 0) : null,
      importanceModelCount: importanceAvailable ? Number(importance.byTopic?.[topic.id]?.modelCount || 0) : 0,
      sizeMetric: importanceAvailable ? 'quadratic-importance' : 'question-count',
    })),
  };
};

const buildRiskMatrixInputs = (questionBank, byQuestion) => {
  const facetMap = new Map();
  (questionBank.questions || []).forEach((question) => {
    const facets = Array.isArray(question.riskFacets) && question.riskFacets.length
      ? question.riskFacets
      : ['uncategorized'];
    facets.forEach((facet) => {
      if (!facetMap.has(facet)) {
        facetMap.set(facet, { id: facet, label: facet, questionIds: [], meanScores: [] });
      }
      const row = facetMap.get(facet);
      row.questionIds.push(question.id);
      const summary = byQuestion[question.id];
      if (Number.isFinite(summary?.meanScore)) row.meanScores.push(summary.meanScore);
    });
  });
  return {
    generatedBy: 'deterministic-risk-facet-rollup',
    note: 'Question facets only. Risk/opportunity interactions require an explicitly generated analysis overlay.',
    facets: Array.from(facetMap.values()).map((facet) => ({
      id: facet.id,
      label: facet.label,
      questionCount: facet.questionIds.length,
      questionIds: facet.questionIds,
      averageStance: round(mean(facet.meanScores)),
    })),
  };
};

const uniqueValues = (values) => [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))].sort();

const buildObservedRuntimeProvenance = (models, runs) => Object.fromEntries(models.map((model) => {
  const modelRuns = runs.filter((run) => run.modelId === model.id);
  const metadata = modelRuns.map((run) => run.responseMetadata || {});
  return [model.id, {
    declared: model.provenance || {},
    requestedModel: model.model,
    declaredProvider: model.provider,
    runProviders: uniqueValues(modelRuns.map((run) => run.provider)),
    resolvedModels: uniqueValues(metadata.map((row) => row.resolvedModel)),
    resolvedProviders: uniqueValues(metadata.map((row) => row.resolvedProvider || row.provider)),
    systemFingerprints: uniqueValues(metadata.map((row) => row.systemFingerprint)),
    endpoints: uniqueValues(metadata.map((row) => row.endpoint)),
    structuredOutputModes: uniqueValues(metadata.map((row) => row.structuredOutput?.used)),
    structuredOutputFallbacks: metadata.filter((row) => row.structuredOutput?.fallback).length,
  }];
}));

export const buildResultsReport = ({ questionBank, modelRoster, runsFile, importanceFile = null }) => {
  const runs = runsFile.runs || [];
  const models = modelRoster.models || [];
  const questions = questionBank.questions || [];
  assertSafeUniqueIdentifiers([questionBank.benchmarkId], 'question bank');
  assertSafeUniqueIdentifiers(questions.map((question) => question.id), 'question bank');
  assertSafeUniqueIdentifiers(models.map((model) => model.id), 'model roster');
  const runtimeProvenance = buildObservedRuntimeProvenance(models, runs);
  const byModelQuestion = Object.fromEntries(models.map((model) => [model.id, {}]));

  for (const [key, groupedRuns] of groupBy(runs, (run) => `${run.modelId}\u0000${run.questionId}`)) {
    const [modelId, questionId] = key.split('\u0000');
    byModelQuestion[modelId][questionId] = summarizeModelQuestionRuns(
      groupedRuns,
      `cell:${modelId}:${questionId}`,
    );
  }

  const byModel = Object.fromEntries(models.map((model) => {
    const cells = questions.map((question) => byModelQuestion[model.id]?.[question.id]);
    return [model.id, summarizeCells(
      cells,
      runs.filter((run) => run.modelId === model.id),
      `model:${model.id}`,
    )];
  }));

  const byQuestion = Object.fromEntries(questions.map((question) => {
    const cells = models.map((model) => byModelQuestion[model.id]?.[question.id]);
    return [question.id, summarizeCells(
      cells,
      runs.filter((run) => run.questionId === question.id),
      `question:${question.id}`,
    )];
  }));

  const expectedRepeats = Number(questionBank.runPlan?.repeatsPerPolarity || 10);
  const declaredRepeatValues = [
    runsFile.repeats,
    ...(Array.isArray(runsFile.repeatValues) ? runsFile.repeatValues : []),
    runsFile.manifest?.repeats,
    ...(Array.isArray(runsFile.sourceManifests)
      ? runsFile.sourceManifests.map((manifest) => manifest?.repeats)
      : []),
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(Number);
  const repeatConfigurationValid = declaredRepeatValues.length > 0
    && declaredRepeatValues.every((value) => Number.isInteger(value) && value === expectedRepeats);
  const bankReleaseStatus = questionBank.releaseStatus || 'unvalidated';
  const bankValidated = bankReleaseStatus === 'validated';
  const minimumSimilarityOverlap = Math.max(1, Math.ceil(questions.length * 0.5));
  const coverage = buildCoverage({
    questionBank,
    modelRoster,
    runs,
    byModelQuestion,
    expectedRepeats,
    repeatConfigurationValid,
    bankValidated,
  });
  const similarity = buildSimilarity({
    questionBank,
    modelRoster,
    byModelQuestion,
    coverage,
    minimumSimilarityOverlap,
  });
  const opinionGroups = buildOpinionGroups(models, similarity.similarityMatrix, coverage);
  const importance = summarizeImportanceRuns({ importanceFile, questionBank, modelRoster });

  const breakdown = {};
  models.forEach((model) => {
    Object.entries(model.traits || {}).forEach(([trait, value]) => {
      if (!breakdown[trait]) breakdown[trait] = {};
      const key = String(value || 'unknown');
      if (!breakdown[trait][key]) breakdown[trait][key] = [];
      breakdown[trait][key].push(model.id);
    });
  });

  const integrityWarnings = models.flatMap((model) => {
    const row = coverage[model.id];
    if (row.eligibleForRelease) return [];
    return [`${model.id} is preview-only: coverage=${row.coverageRate}, paired=${row.pairedCoverageRate}, completion=${row.completionRate}, valid=${row.validRate}${row.fixtureProvider ? ', fixture provider' : ''}`];
  });
  if (!repeatConfigurationValid) {
    integrityWarnings.unshift(`run artifacts declare repeats [${declaredRepeatValues.join(', ') || 'missing'}], but the question bank requires ${expectedRepeats} per polarity`);
  }
  if (!bankValidated) {
    integrityWarnings.unshift(`question bank release status is ${bankReleaseStatus}; only validated banks can produce release-ready reports`);
  }
  const releaseReady = models.length >= 2 && models.every((model) => coverage[model.id]?.eligibleForRelease);

  return {
    schemaVersion: 2,
    kind: 'ai_discourse_bench_report',
    benchmarkId: questionBank.benchmarkId,
    title: questionBank.title || 'AI Discourse Benchmark',
    generatedAt: new Date().toISOString(),
    mode: runsFile.mode || 'self',
    personaId: runsFile.personaId || null,
    personaProfile: runsFile.manifest?.personaProfile || runsFile.sourceManifests?.find((entry) => entry?.personaProfile)?.personaProfile || null,
    status: releaseReady ? 'release-ready' : 'preview',
    integrity: {
      releaseReady,
      expectedRepeatsPerPolarity: expectedRepeats,
      declaredRepeatValues,
      repeatConfigurationValid,
      bankReleaseStatus,
      bankValidated,
      minimumSimilarityOverlap,
      sourceBenchmarkIds: runsFile.sourceBenchmarkIds || [runsFile.benchmarkId].filter(Boolean),
      coverageByModel: coverage,
      warnings: integrityWarnings,
    },
    counts: {
      questions: questions.length,
      models: models.length,
      eligibleModels: models.filter((model) => coverage[model.id]?.eligibleForRelease).length,
      runs: runs.length,
      importanceRuns: importance.attemptedRuns,
    },
    statistics: {
      intervalMethod: 'deterministic-percentile-bootstrap',
      confidenceLevel: 0.95,
      bootstrapIterations: 1000,
      resamplingUnit: 'nested observations within each reported aggregate',
      wordingSensitivityThresholds: { moderate: 0.25, high: 0.75 },
    },
    questions: questions.map((question) => ({
      id: question.id,
      prompt: question.canonicalPrompt,
      reversedPrompt: question.reversedPrompt,
      topic: question.topic || 'uncategorized',
      subtopics: question.subtopics || [],
      disagreementAxis: question.disagreementAxis || '',
      agreeMeans: question.agreeMeans || '',
      sourceAnchors: question.sourceAnchors || [],
      agentVillageAnchors: question.agentVillageAnchors || [],
      riskFacets: question.riskFacets || [],
      whyIncluded: question.whyIncluded || '',
    })),
    participants: models.map((model) => ({
      id: model.id,
      label: model.label,
      model: model.model,
      provider: model.provider,
      provenance: model.provenance || {},
      runtimeProvenance: runtimeProvenance[model.id],
      traits: model.traits || {},
      summary: byModel[model.id],
      coverage: coverage[model.id],
      opinionGroup: opinionGroups[model.id] ?? null,
    })),
    polisReport: {
      aggregationUnit: 'model-participant',
      repeatedRunsAreNestedObservations: true,
      byModel,
      byQuestion,
      byModelQuestion,
      ...similarity,
    },
    participantGraph: {
      method: 'distributional-distance-mds',
      opinionGroupMethod: 'similarity-connected-components',
      opinionGroupThreshold: 0.72,
      nodes: models.map((model) => ({
        id: model.id,
        label: model.label,
        provenance: model.provenance || {},
        runtimeProvenance: runtimeProvenance[model.id],
        traits: model.traits || {},
        coverage: coverage[model.id],
        opinionGroup: opinionGroups[model.id] ?? null,
      })),
      edges: similarity.similarityEdges,
    },
    importance,
    breakdown,
    debateAtlas: buildQuestionTopicAtlas(questionBank, byQuestion, importance),
    riskMatrix: buildRiskMatrixInputs(questionBank, byQuestion),
    rawMaterial: {
      runManifest: runsFile.manifest || null,
      sourceManifests: runsFile.sourceManifests || [],
      sourceRunContentHashes: runsFile.sourceRunContentHashes || [],
      importanceManifest: importanceFile?.manifest || null,
      importanceSourceManifests: importanceFile?.sourceManifests || [],
      sourceImportanceContentHashes: importanceFile?.sourceImportanceContentHashes || [],
      runtimeProvenance,
      debateAtlasInputs: questions.map((question) => ({
        questionId: question.id,
        topic: question.topic || 'uncategorized',
        subtopics: question.subtopics || [],
        disagreementAxis: question.disagreementAxis || '',
        sourceAnchors: question.sourceAnchors || [],
        agentVillageAnchors: question.agentVillageAnchors || [],
        importance: importance.byQuestion?.[question.id] || null,
      })),
      riskMatrixInputs: questions.map((question) => ({
        questionId: question.id,
        riskFacets: question.riskFacets || [],
        topic: question.topic || 'uncategorized',
        sourceAnchors: question.sourceAnchors || [],
      })),
    },
  };
};
