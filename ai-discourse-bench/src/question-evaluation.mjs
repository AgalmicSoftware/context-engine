import { hashJson } from './provenance.mjs';

const round = (value, digits = 4) => (
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null
);

const clamp01 = (value, fallback = 0) => (
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
);

export const DEFAULT_QUESTION_EVALUATION_THRESHOLDS = Object.freeze({
  minimumValidModelRate: 0.95,
  minimumPairedModelRate: 0.95,
  maximumInvalidRunRate: 0.05,
  minimumRepeatStability: 0.7,
  moderateWordingSensitivity: 0.25,
  highWordingSensitivity: 0.5,
  highInformationEntropy: 0.45,
  consensusEntropy: 0.1,
  consensusMeanMagnitude: 0.75,
  highUnsureRate: 0.5,
  minimumReversalLexicalOverlap: 0.5,
});

const REVERSAL_STOP_WORDS = new Set([
  'a', 'an', 'the', 'should', 'not', 'no', 'never', 'rather', 'than', 'can', 'may', 'must',
]);

const contentTokens = (value) => new Set(String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/)
  .filter((token) => token && !REVERSAL_STOP_WORDS.has(token)));

const reversalLexicalOverlapFor = (prompt, reversedPrompt) => {
  const canonical = contentTokens(prompt);
  const reversed = contentTokens(reversedPrompt);
  const union = new Set([...canonical, ...reversed]);
  if (!union.size) return null;
  const intersectionSize = [...canonical].filter((token) => reversed.has(token)).length;
  return intersectionSize / union.size;
};

const hasNegationScopeRisk = (value) => (
  /\bnot\b[^.!?]{0,80}\b(unless|without|until|except)\b/i.test(String(value || ''))
);

const recommendationFor = ({ flags, responseEntropy, meanScore }, thresholds) => {
  const reviewFlags = new Set([
    'insufficient-model-coverage',
    'incomplete-polarity-pairing',
    'high-invalid-run-rate',
    'low-repeat-stability',
    'high-wording-sensitivity',
    'substantive-reversal-rewrite',
    'negation-scope-risk',
  ]);
  if (flags.some((flag) => reviewFlags.has(flag))) return 'review';
  if (Number.isFinite(responseEntropy) && responseEntropy >= thresholds.highInformationEntropy) {
    return 'keep-high-information';
  }
  if (
    Number.isFinite(responseEntropy)
    && responseEntropy <= thresholds.consensusEntropy
    && Number.isFinite(meanScore)
    && Math.abs(meanScore) >= thresholds.consensusMeanMagnitude
  ) {
    return 'keep-consensus-anchor';
  }
  return 'keep';
};

const reliabilityScoreFor = ({
  validModelRate,
  pairedModelRate,
  invalidRunRate,
  repeatStability,
  wordingSensitivity,
}) => round(
  (0.25 * clamp01(validModelRate))
  + (0.2 * clamp01(pairedModelRate))
  + (0.2 * (1 - clamp01(invalidRunRate, 1)))
  + (0.2 * clamp01(repeatStability))
  + (0.15 * (1 - clamp01(Number(wordingSensitivity || 0) / 2))),
);

const summarizeWordingDirectionality = (byQuestion) => {
  const counts = {
    canonical: { Agree: 0, Unsure: 0, Disagree: 0 },
    reversed: { Agree: 0, Unsure: 0, Disagree: 0 },
  };
  Object.values(byQuestion).forEach((summary) => {
    const canonical = summary?.polarity?.canonical?.counts || {};
    const reversedNormalized = summary?.polarity?.reversedNormalized?.counts || {};
    counts.canonical.Agree += Number(canonical.Agree || 0);
    counts.canonical.Unsure += Number(canonical.Unsure || 0);
    counts.canonical.Disagree += Number(canonical.Disagree || 0);
    // Reversed responses are stored normalized to the canonical proposition.
    counts.reversed.Agree += Number(reversedNormalized.Disagree || 0);
    counts.reversed.Unsure += Number(reversedNormalized.Unsure || 0);
    counts.reversed.Disagree += Number(reversedNormalized.Agree || 0);
  });
  const ratesFor = (polarityCounts) => {
    const valid = polarityCounts.Agree + polarityCounts.Unsure + polarityCounts.Disagree;
    return {
      validModelQuestionAnswers: valid,
      agree: valid ? round(polarityCounts.Agree / valid) : null,
      unsure: valid ? round(polarityCounts.Unsure / valid) : null,
      disagree: valid ? round(polarityCounts.Disagree / valid) : null,
    };
  };
  const canonical = ratesFor(counts.canonical);
  const reversed = ratesFor(counts.reversed);
  const rawAgreementGap = Number.isFinite(canonical.agree) && Number.isFinite(reversed.agree)
    ? round(canonical.agree - reversed.agree)
    : null;
  return {
    method: 'equally-weighted-model-question-answers',
    canonical,
    reversed,
    rawAgreementGap,
    flag: Number.isFinite(rawAgreementGap) && Math.abs(rawAgreementGap) >= 0.25
      ? 'directional-framing-skew'
      : null,
    note: 'Raw agreement compares answers to the original wording with answers to the reversed wording before polarity normalization. A large gap can indicate directionally framed propositions, acquiescence effects, or both.',
  };
};

export const evaluateQuestionReport = (
  report,
  thresholds = DEFAULT_QUESTION_EVALUATION_THRESHOLDS,
) => {
  const questions = report?.questions || [];
  const byQuestion = report?.polisReport?.byQuestion || {};
  const rows = questions.map((question) => {
    const summary = byQuestion[question.id] || {};
    const totalModels = Number(summary.total || report?.counts?.models || 0);
    const validModels = Number(summary.valid || 0);
    const totalRuns = Number(summary.runSummary?.total || 0);
    const invalidRuns = Number(summary.runSummary?.invalid || 0);
    const totalPolarityUnits = Number(summary.wordingSensitivity?.totalUnits || totalModels || 0);
    const pairedPolarityUnits = Number(summary.wordingSensitivity?.pairedUnits || 0);
    const validModelRate = totalModels ? validModels / totalModels : 0;
    const pairedModelRate = totalPolarityUnits ? pairedPolarityUnits / totalPolarityUnits : 0;
    const invalidRunRate = totalRuns ? invalidRuns / totalRuns : 1;
    const repeatStability = Number.isFinite(summary.winningResponseConsistency?.rate)
      ? summary.winningResponseConsistency.rate
      : null;
    const wordingSensitivity = Number.isFinite(summary.wordingSensitivity?.meanAbsoluteShift)
      ? summary.wordingSensitivity.meanAbsoluteShift
      : null;
    const reversalLexicalOverlap = reversalLexicalOverlapFor(
      question.prompt,
      question.reversedPrompt,
    );
    const flags = [];

    if (validModelRate < thresholds.minimumValidModelRate) flags.push('insufficient-model-coverage');
    if (pairedModelRate < thresholds.minimumPairedModelRate) flags.push('incomplete-polarity-pairing');
    if (invalidRunRate > thresholds.maximumInvalidRunRate) flags.push('high-invalid-run-rate');
    if (!Number.isFinite(repeatStability) || repeatStability < thresholds.minimumRepeatStability) {
      flags.push('low-repeat-stability');
    }
    if (Number.isFinite(wordingSensitivity) && wordingSensitivity >= thresholds.highWordingSensitivity) {
      flags.push('high-wording-sensitivity');
    } else if (
      Number.isFinite(wordingSensitivity)
      && wordingSensitivity >= thresholds.moderateWordingSensitivity
    ) {
      flags.push('moderate-wording-sensitivity');
    }
    if (Number(summary.uncertaintyRate || 0) >= thresholds.highUnsureRate) flags.push('high-unsure-rate');
    if (
      Number.isFinite(reversalLexicalOverlap)
      && reversalLexicalOverlap < thresholds.minimumReversalLexicalOverlap
    ) {
      flags.push('substantive-reversal-rewrite');
    }
    if (hasNegationScopeRisk(question.prompt) || hasNegationScopeRisk(question.reversedPrompt)) {
      flags.push('negation-scope-risk');
    }
    if (
      Number.isFinite(summary.responseEntropy)
      && summary.responseEntropy >= thresholds.highInformationEntropy
    ) {
      flags.push('high-model-discrimination');
    }
    if (
      Number.isFinite(summary.responseEntropy)
      && summary.responseEntropy <= thresholds.consensusEntropy
      && Number.isFinite(summary.meanScore)
      && Math.abs(summary.meanScore) >= thresholds.consensusMeanMagnitude
    ) {
      flags.push('consensus-anchor');
    }

    const metrics = {
      validModelRate: round(validModelRate),
      pairedModelRate: round(pairedModelRate),
      invalidRunRate: round(invalidRunRate),
      repeatStability: round(repeatStability),
      wordingSensitivity: round(wordingSensitivity),
      reversalLexicalOverlap: round(reversalLexicalOverlap),
      responseEntropy: round(summary.responseEntropy),
      uncertaintyRate: round(summary.uncertaintyRate),
      meanScore: round(summary.meanScore),
    };
    const recommendation = recommendationFor({
      flags,
      responseEntropy: metrics.responseEntropy,
      meanScore: metrics.meanScore,
    }, thresholds);

    return {
      id: question.id,
      topic: question.topic || 'uncategorized',
      prompt: question.prompt || '',
      reversedPrompt: question.reversedPrompt || '',
      recommendation,
      requiresHumanReview: recommendation === 'review',
      reliabilityScore: reliabilityScoreFor(metrics),
      flags,
      metrics,
    };
  });

  const countBy = (values, keyFor) => Object.fromEntries(
    [...values.reduce((counts, value) => {
      const key = keyFor(value);
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
  const flagCounts = new Map();
  rows.forEach((row) => row.flags.forEach((flag) => {
    flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
  }));

  return {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_question_evaluation',
    benchmarkId: report?.benchmarkId || null,
    reportGeneratedAt: report?.generatedAt || null,
    evaluatedAt: new Date().toISOString(),
    provisional: report?.integrity?.releaseReady !== true,
    provenance: {
      reportHash: hashJson(report),
      questionBankHashes: Array.from(new Set([
        report?.rawMaterial?.runManifest?.questionBankHash,
        ...(report?.rawMaterial?.sourceManifests || []).map((manifest) => manifest?.questionBankHash),
      ].filter(Boolean))).sort(),
    },
    methodology: {
      note: 'Automated response diagnostics identify items for review; they do not replace source verification or independent human wording adjudication.',
      thresholds,
      recommendationMeanings: {
        review: 'At least one reliability, coverage, polarity-wording, or high wording-sensitivity threshold failed.',
        'keep-high-information': 'Reliable item with substantial between-model answer diversity.',
        'keep-consensus-anchor': 'Reliable item that measures a strong shared position.',
        keep: 'Reliable item without an extreme consensus or discrimination classification.',
      },
    },
    summary: {
      questionCount: rows.length,
      recommendations: countBy(rows, (row) => row.recommendation),
      topics: countBy(rows, (row) => row.topic),
      flags: Object.fromEntries([...flagCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
      wordingDirectionality: summarizeWordingDirectionality(byQuestion),
    },
    questions: rows,
  };
};

export const annotateQuestionEvaluationReviewStatus = (evaluation, reviewedQuestionBank = []) => {
  const reviewedQuestions = Array.isArray(reviewedQuestionBank)
    ? reviewedQuestionBank
    : (reviewedQuestionBank?.questions || []);
  const reviewedById = new Map(reviewedQuestions.map((question) => (
    typeof question === 'string' ? [question, null] : [question.id, question]
  )));
  const questions = (evaluation.questions || []).map((question) => ({
    ...question,
    bankReviewStatus: reviewedById.has(question.id)
      && (!reviewedById.get(question.id)
        || (
          question.prompt === reviewedById.get(question.id).canonicalPrompt
          && question.reversedPrompt === reviewedById.get(question.id).reversedPrompt
        ))
      ? 'ai-reviewed-candidate'
      : 'development-deferred',
    requiresIndependentHumanReview: true,
  }));
  return {
    ...evaluation,
    provenance: {
      ...evaluation.provenance,
      reviewedQuestionBankHash: reviewedQuestions.length ? hashJson(reviewedQuestionBank) : null,
    },
    summary: {
      ...evaluation.summary,
      bankReviewStatus: {
        aiReviewedCandidate: questions.filter((question) => (
          question.bankReviewStatus === 'ai-reviewed-candidate'
        )).length,
        developmentDeferred: questions.filter((question) => (
          question.bankReviewStatus === 'development-deferred'
        )).length,
        independentHumanReviewComplete: 0,
      },
    },
    questions,
  };
};

const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const renderQuestionEvaluationCsv = (evaluation) => {
  const headers = [
    'id', 'topic', 'bank_review_status', 'requires_independent_human_review',
    'recommendation', 'requires_human_review', 'reliability_score',
    'valid_model_rate', 'paired_model_rate', 'invalid_run_rate', 'repeat_stability',
    'wording_sensitivity', 'response_entropy', 'uncertainty_rate', 'mean_score',
    'reversal_lexical_overlap',
    'flags', 'prompt', 'reversed_prompt',
  ];
  const rows = (evaluation.questions || []).map((row) => [
    row.id,
    row.topic,
    row.bankReviewStatus || 'unknown',
    row.requiresIndependentHumanReview ?? true,
    row.recommendation,
    row.requiresHumanReview,
    row.reliabilityScore,
    row.metrics.validModelRate,
    row.metrics.pairedModelRate,
    row.metrics.invalidRunRate,
    row.metrics.repeatStability,
    row.metrics.wordingSensitivity,
    row.metrics.responseEntropy,
    row.metrics.uncertaintyRate,
    row.metrics.meanScore,
    row.metrics.reversalLexicalOverlap,
    row.flags,
    row.prompt,
    row.reversedPrompt,
  ]);
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
};
