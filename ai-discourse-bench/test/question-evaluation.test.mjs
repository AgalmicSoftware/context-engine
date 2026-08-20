import assert from 'node:assert/strict';
import test from 'node:test';

import {
  annotateQuestionEvaluationReviewStatus,
  evaluateQuestionReport,
  renderQuestionEvaluationCsv,
} from '../src/question-evaluation.mjs';

const summary = ({
  meanScore = 0,
  responseEntropy = 0.5,
  uncertaintyRate = 0,
  valid = 5,
  total = 5,
  invalidRuns = 0,
  totalRuns = 100,
  repeatStability = 0.9,
  pairedUnits = 5,
  wordingSensitivity = 0.1,
  canonicalCounts = { Agree: 4, Unsure: 1, Disagree: 0 },
  reversedNormalizedCounts = { Agree: 1, Unsure: 1, Disagree: 3 },
} = {}) => ({
  meanScore,
  responseEntropy,
  uncertaintyRate,
  valid,
  total,
  runSummary: { invalid: invalidRuns, total: totalRuns },
  winningResponseConsistency: { rate: repeatStability },
  wordingSensitivity: {
    pairedUnits,
    totalUnits: total,
    meanAbsoluteShift: wordingSensitivity,
  },
  polarity: {
    canonical: { counts: canonicalCounts },
    reversedNormalized: { counts: reversedNormalizedCounts },
  },
});

test('question evaluation separates reliability failures from useful consensus', () => {
  const questions = [
    { id: 'consensus', topic: 'topic-a', prompt: 'Consensus?', reversedPrompt: 'Not consensus?' },
    { id: 'split', topic: 'topic-a', prompt: 'Split?', reversedPrompt: 'Not split?' },
    { id: 'sensitive', topic: 'topic-b', prompt: 'Sensitive?', reversedPrompt: 'Not sensitive?' },
    { id: 'invalid', topic: 'topic-b', prompt: 'Invalid?', reversedPrompt: 'Not invalid?' },
  ];
  const report = {
    benchmarkId: 'test-bank',
    generatedAt: '2026-01-01T00:00:00.000Z',
    integrity: { releaseReady: false },
    counts: { models: 5 },
    questions,
    polisReport: {
      byQuestion: {
        consensus: summary({ meanScore: 1, responseEntropy: 0 }),
        split: summary({ meanScore: 0.1, responseEntropy: 0.8 }),
        sensitive: summary({ wordingSensitivity: 0.7 }),
        invalid: summary({ invalidRuns: 10, pairedUnits: 4 }),
      },
    },
  };

  const evaluation = evaluateQuestionReport(report);
  const rows = Object.fromEntries(evaluation.questions.map((row) => [row.id, row]));

  assert.equal(evaluation.provisional, true);
  assert.match(evaluation.provenance.reportHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(evaluation.provenance.questionBankHashes, []);
  assert.equal(rows.consensus.recommendation, 'keep-consensus-anchor');
  assert.equal(rows.split.recommendation, 'keep-high-information');
  assert.equal(rows.sensitive.recommendation, 'review');
  assert.ok(rows.sensitive.flags.includes('high-wording-sensitivity'));
  assert.equal(rows.invalid.recommendation, 'review');
  assert.ok(rows.invalid.flags.includes('high-invalid-run-rate'));
  assert.ok(rows.invalid.flags.includes('incomplete-polarity-pairing'));
  assert.deepEqual(evaluation.summary.recommendations, {
    'keep-consensus-anchor': 1,
    'keep-high-information': 1,
    review: 2,
  });
  assert.deepEqual(evaluation.summary.wordingDirectionality.canonical, {
    validModelQuestionAnswers: 20,
    agree: 0.8,
    unsure: 0.2,
    disagree: 0,
  });
  assert.deepEqual(evaluation.summary.wordingDirectionality.reversed, {
    validModelQuestionAnswers: 20,
    agree: 0.6,
    unsure: 0.2,
    disagree: 0.2,
  });
  assert.equal(evaluation.summary.wordingDirectionality.rawAgreementGap, 0.2);
  assert.equal(evaluation.summary.wordingDirectionality.flag, null);

  const annotated = annotateQuestionEvaluationReviewStatus(evaluation, ['consensus']);
  assert.equal(annotated.questions[0].bankReviewStatus, 'ai-reviewed-candidate');
  assert.equal(annotated.questions[1].bankReviewStatus, 'development-deferred');
  assert.equal(annotated.questions[0].requiresIndependentHumanReview, true);
  assert.deepEqual(annotated.summary.bankReviewStatus, {
    aiReviewedCandidate: 1,
    developmentDeferred: 3,
    independentHumanReviewComplete: 0,
  });

  const csv = renderQuestionEvaluationCsv(annotated);
  assert.match(csv, /^id,topic,bank_review_status,requires_independent_human_review,recommendation,/);
  assert.match(csv, /sensitive,topic-b,development-deferred,true,review/);
  assert.match(csv, /high-wording-sensitivity/);

  const wordingBound = annotateQuestionEvaluationReviewStatus(evaluation, {
    benchmarkId: 'reviewed-bank',
    questions: [{
      id: 'consensus',
      canonicalPrompt: 'Changed wording?',
      reversedPrompt: 'Not changed wording?',
    }],
  });
  assert.equal(wordingBound.questions[0].bankReviewStatus, 'development-deferred');
  assert.match(wordingBound.provenance.reviewedQuestionBankHash, /^[a-f0-9]{64}$/);
});

test('question evaluation flags substantive rewrites and risky negation scope for adjudication', () => {
  const report = {
    benchmarkId: 'wording-test-bank',
    integrity: { releaseReady: false },
    counts: { models: 5 },
    questions: [
      {
        id: 'rewrite',
        topic: 'topic-a',
        prompt: 'Private agent logs should be protected from routine platform access unless needed for security.',
        reversedPrompt: 'Platforms should routinely use agent histories to improve products.',
      },
      {
        id: 'scope',
        topic: 'topic-a',
        prompt: 'Emergency rules should expire after review.',
        reversedPrompt: 'Emergency rules should not expire unless independently reviewed after use.',
      },
    ],
    polisReport: {
      byQuestion: {
        rewrite: summary({ meanScore: 0, responseEntropy: 0.5 }),
        scope: summary({ meanScore: 0, responseEntropy: 0.5 }),
      },
    },
  };

  const rows = Object.fromEntries(
    evaluateQuestionReport(report).questions.map((row) => [row.id, row]),
  );
  assert.equal(rows.rewrite.recommendation, 'review');
  assert.ok(rows.rewrite.flags.includes('substantive-reversal-rewrite'));
  assert.ok(rows.rewrite.metrics.reversalLexicalOverlap < 0.5);
  assert.equal(rows.scope.recommendation, 'review');
  assert.ok(rows.scope.flags.includes('negation-scope-risk'));
});
