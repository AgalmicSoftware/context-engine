import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AI_MODEL } from '../../shared/aiDefaults.mjs';
import {
  answerSimilarity,
  collectSessionFidelityData,
  collectWrappedFidelityPairs,
  inferDraftOrigin,
  normalizeFidelityAnswer,
  normalizeFidelityQuestion,
  reportableKeys,
  resultsResponseRows,
  scoreAgentFidelity,
  scoreFidelityOverview,
  fidelityPairsFromReview,
  summarizeParticipantFidelity,
} from '../../shared/agentFidelity.mjs';

const questions = [
  { id: 'QB1', type: 'binary', prompt: 'One' },
  { id: 'qb2', type: 'binary', prompt: 'Two' },
  { id: 'qb3', type: 'binary', prompt: 'Three' },
  { id: 'qb4', type: 'binary', prompt: 'Four' },
  { id: 'qs', type: 'multichoice', singleSelect: true, options: ['A', 'B', 'C'] },
  { id: 'qm', type: 'multichoice', options: ['X', 'Y', 'Z'] },
  { id: 'qr', type: 'rating', scale: { min: 0, max: 10 } },
  { id: 'qq', type: 'quadratic', options: ['P', 'Q', 'R'], voiceCredits: 99 },
  { id: 'qf', type: 'freeform' },
];
const q = Object.fromEntries(questions.map((question) => [question.id.toLowerCase(), normalizeFidelityQuestion(question)]));
const fast = { bootstrapSamples: 200, minParticipants: 3 };

test('answers are read from stored fields and unreadable ones are rejected', () => {
  assert.equal(normalizeFidelityAnswer(q.qb1, 'agree'), 'Agree');
  assert.equal(normalizeFidelityAnswer(q.qb1, { value: 'Disagree', encrypted: false }), 'Disagree');
  assert.equal(normalizeFidelityAnswer(q.qb1, { value: '0xciphertext', encrypted: true }), null);
  assert.equal(normalizeFidelityAnswer(q.qb1, { redacted: true, reason: 'encrypted_field' }), null);
  assert.equal(normalizeFidelityAnswer(q.qb1, 'maybe'), null);
  assert.deepEqual(normalizeFidelityAnswer(q.qs, ['b']), ['B']);
  assert.deepEqual(normalizeFidelityAnswer(q.qs, 'C'), ['C']);
  assert.equal(normalizeFidelityAnswer(q.qs, ['A', 'B']), null);
  assert.equal(normalizeFidelityAnswer(q.qs, ['D']), null);
  assert.deepEqual(normalizeFidelityAnswer(q.qm, '["Z","X"]'), ['X', 'Z']);
  assert.equal(normalizeFidelityAnswer(q.qr, '7'), 7);
  assert.equal(normalizeFidelityAnswer(q.qr, 11), null);
  assert.deepEqual(normalizeFidelityAnswer(q.qq, { value: [3, -2, 0] }), [3, -2, 0]);
  assert.equal(normalizeFidelityAnswer(q.qq, [1, 2]), null);
  assert.equal(normalizeFidelityAnswer(q.qq, [1.5, 0, 0]), null);
  assert.equal(normalizeFidelityAnswer(q.qf, { text: '  Slow down.  ' }), 'Slow down.');
  assert.equal(normalizeFidelityQuestion({ id: 'x', type: 'multichoice', options: ['Only'] }), null);
  for (const type of [undefined, 'text', 'Freeform']) assert.equal(normalizeFidelityQuestion({ id: 'x', type }).type, 'freeform');
  assert.equal(normalizeFidelityQuestion({ id: 'x', questionType: 'Binary' }).type, 'binary');
});

test('similarity gives graded credit by question type', () => {
  assert.equal(answerSimilarity(q.qb1, 'Agree', 'Agree'), 1);
  assert.equal(answerSimilarity(q.qb1, 'Agree', 'Unsure'), 0);
  assert.equal(answerSimilarity(q.qs, ['A'], ['B']), 0);
  assert.equal(answerSimilarity(q.qm, ['X', 'Y'], ['Y', 'Z']), 1 / 3);
  assert.equal(answerSimilarity(q.qr, 7, 9), 0.8);
  assert.equal(answerSimilarity(q.qq, [3, 1, 0], [3, 1, 0]), 1);
  assert.equal(answerSimilarity(q.qq, [3, 0, 0], [-3, 0, 0]), 0);
  assert.equal(answerSimilarity(q.qq, [3, 0, 0], [0, 3, 0]), 0.5);
  assert.equal(answerSimilarity(q.qq, [0, 0, 0], [0, 0, 0]), 1);
  assert.equal(answerSimilarity(q.qq, [0, 0, 0], [2, 0, 0]), 0.5);
  assert.equal(answerSimilarity(q.qf, 'a', 'a'), null);
  assert.equal(answerSimilarity(q.qb1, null, 'Agree'), null);
});

test('draft origin falls back on the self-reported source', () => {
  assert.equal(inferDraftOrigin({ source: { platform: 'claude', modelId: 'x' } }), 'external_prefill');
  assert.equal(inferDraftOrigin({ source: { platform: 'other', modelId: 'direct-user-context' } }), 'typed_context');
  assert.equal(inferDraftOrigin({ source: { platform: 'other', modelId: DEFAULT_AI_MODEL } }), 'voice_interview');
  assert.equal(inferDraftOrigin({ draftOrigin: 'external_prefill', source: {} }), 'external_prefill');
  assert.equal(inferDraftOrigin({}), 'unknown');
});

const entry = (questionID, answer, provenance, extra = {}) => ({
  questionID,
  answer: { value: answer, encrypted: false },
  importance: 6,
  conviction: 6,
  ...(provenance ? { interviewProvenance: provenance } : {}),
  ...extra,
});
const predicted = (answer, confidence, extra = {}) => ({
  version: 1,
  source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
  originalPrediction: { answer, confidence, importance: 4, conviction: 5, evidence: 'basis' },
  ...extra,
});

test('session records yield final answers and prediction pairs', () => {
  const rows = [
    {
      responder: { address: '0xAAA0000000000000000000000000000000000001' },
      response: JSON.stringify({
        timestamp: 1000,
        responses: [
          entry('QB1', 'Agree', predicted('Agree', 0.8), { recruitment: { source: 'rxc' } }),
          entry('qr', 6, predicted(9, 60), { recruitment: { source: 'rxc' } }),
          entry('qf', 'Freeform text', predicted('Draft text', 0.5)),
          entry('unknown', 'Agree'),
        ],
      }),
    },
    {
      responder: '0xaaa0000000000000000000000000000000000001',
      response: { timestamp: 2000, responses: [entry('qb1', 'Disagree', predicted('Agree', 0.8))] },
    },
    {
      responder: '0xBBB0000000000000000000000000000000000002',
      response: {
        responses: [
          entry('qb2', 'Agree', predicted('Agree', 0.9, { predictionCondition: 'blind', blindAnswer: 'Disagree' })),
          entry('qb3', 'Agree', null, { participant: { kind: 'agent', verification: 'self_reported' } }),
          { questionID: 'qb4', answer: { value: 'secret', encrypted: true } },
        ],
      },
    },
  ];
  const { answers, pairs, skipped } = collectSessionFidelityData({ questions, payloads: rows });
  const first = pairs.find((pair) => pair.questionId === 'qb1');
  assert.equal(first.actual, 'Disagree', 'the later submission wins');
  assert.equal(first.origin, 'external_prefill');
  assert.equal(first.confidence, 0.8);
  assert.equal(pairs.find((pair) => pair.questionId === 'qr').confidence, 0.6, '0-100 confidences are rescaled');
  const blind = pairs.find((pair) => pair.questionId === 'qb2');
  assert.equal(blind.condition, 'blind');
  assert.equal(blind.actual, 'Disagree', 'the answer given before the reveal is scored');
  assert.equal(answers.find((answer) => answer.questionId === 'qb3').isAgent, true);
  assert.equal(answers.find((answer) => answer.questionId === 'qr').source, 'rxc');
  assert.deepEqual(skipped, { unknownQuestion: 1, noParticipant: 0, unreadableAnswer: 1, unreadablePrediction: 0, freeformWithoutText: 0 });
});

test('one account counts once, whoever its payloads claim to be, and platforms are read like the app reads them', () => {
  // The Worker attests the row's responder; the payload's claims are not trusted.
  const account = '0xaaa0000000000000000000000000000000000001';
  const platforms = ['ChatGPT', '__proto__', '', 'gemini', 'claude'];
  const rows = ['qb1', 'qb2', 'qb3', 'qb4', 'qs'].map((questionId, index) => ({
    responder: account,
    questionId,
    response: {
      ...entry(questionId, questionId === 'qs' ? ['A'] : 'Agree', {
        ...predicted(questionId === 'qs' ? ['A'] : 'Agree', 0.8),
        source: { platform: platforms[index], modelId: 'm' },
      }),
      responder: `0xbbb${String(index).padStart(37, '0')}`,
    },
  }));
  const { pairs } = collectSessionFidelityData({ questions, payloads: rows });
  assert.deepEqual([...new Set(pairs.map((pair) => pair.participantId))], [account]);
  assert.deepEqual(
    pairs.map((pair) => pair.platform),
    ['chatgpt', 'other', 'unknown', 'other', 'claude'],
  );
  // Raw payloads without a row still name their responder.
  const raw = collectSessionFidelityData({ questions, payloads: [{ ...rows[0].response }] });
  assert.equal(raw.pairs[0].participantId, rows[0].response.responder);
});

test('confidences are labelled by what the prompt asked them to mean', () => {
  const rows = [
    {
      responder: '0xccc0000000000000000000000000000000000003',
      response: {
        responses: [
          entry('qb1', 'Agree', predicted('Agree', 0.8, { promptVersion: 'ce-interview-brief-v6' })),
          entry('qb2', 'Agree', predicted('Agree', 0.8, { promptVersion: 'ce-interview-brief-v5' })),
          entry('qb3', 'Agree', predicted('Agree', 0.8)),
          // Version 2 records state the meaning even without the AI provenance choice.
          entry('qb4', 'Agree', predicted('Agree', 0.8, { confidenceMeaning: 'keep' })),
        ],
      },
    },
  ];
  const { pairs } = collectSessionFidelityData({ questions, payloads: rows });
  const meanings = Object.fromEntries(pairs.map((pair) => [pair.questionId, pair.confidenceMeaning]));
  assert.deepEqual(meanings, { qb1: 'keep', qb2: 'support', qb3: 'unknown', qb4: 'keep' });
  const [wrapped] = collectWrappedFidelityPairs({
    questions,
    rows: [{ principal_id: 'p1', statement_id: 'qb1', agent_prediction: { value: 'Agree' }, agent_confidence: 70, human_current_answer: { value: 'Agree' } }],
  });
  // The Wrapped rubric grades evidence (90-95 direct, 70-89 supported inference), not a chance of keeping.
  assert.equal(wrapped.confidenceMeaning, 'support');
});

test('Session Wrapped export rows become separate-condition pairs', () => {
  const pairs = collectWrappedFidelityPairs({
    questions,
    rows: [
      { principal_id: 'p1', statement_id: 'qb1', agent_prediction: { value: 'Agree' }, agent_confidence: 70, human_current_answer: { value: 'Agree' }, review_status: '' },
      { principal_id: 'p1', statement_id: 'qb2', agent_prediction: { value: 'Agree' }, agent_confidence: 40, prior_human_answer: { value: 'Unsure' } },
      { principal_id: 'p2', statement_id: 'qb1', agent_prediction: { value: 'Agree' }, agent_confidence: 90, human_current_answer: { value: 'Agree' }, review_status: 'human_confirm' },
      { principal_id: 'p3', statement_id: 'qb1', agent_prediction: { value: 'Agree' }, agent_confidence: 90 },
    ],
  });
  assert.equal(pairs.length, 3);
  assert.equal(pairs[0].condition, 'separate');
  assert.equal(pairs[0].confidence, 0.7);
  assert.equal(pairs[1].actual, 'Unsure');
  assert.equal(pairs[2].condition, 'shown');
});

// Ten people, four statements. Six hold the common view (Agree) and four the
// unusual one (Disagree), so guessing the majority is right for six people.
const people = Array.from({ length: 10 }, (_, index) => ({
  id: `0x${String(index).padStart(40, '0')}`,
  view: index < 6 ? 'Agree' : 'Disagree',
  group: index < 6 ? 'common' : 'unusual',
}));
const statements = ['qb1', 'qb2', 'qb3', 'qb4'];
const answersFor = () =>
  people.flatMap((person) => statements.map((questionId) => ({ participantId: person.id, questionId, value: person.view, at: 1 })));
const pairsFor = (predict, extra = () => ({})) =>
  people.flatMap((person) =>
    statements.map((questionId) => ({
      participantId: person.id,
      questionId,
      condition: 'shown',
      origin: 'external_prefill',
      platform: 'claude',
      modelId: 'test',
      prediction: predict(person, questionId),
      actual: person.view,
      confidence: 0.9,
      at: 1,
      ...extra(person, questionId),
    })),
  );

test('an agent that knows each person beats the majority guess, most for unusual people', () => {
  const report = scoreAgentFidelity({ questions, pairs: pairsFor((person) => person.view), answers: answersFor(), options: fast });
  assert.equal(report.mirrorScore.overall.value, 1);
  assert.equal(report.correctionRate.value, 0);
  assert.equal(report.baselines.population.baseline.value, 0.6);
  assert.ok(Math.abs(report.baselines.population.lift.value - 0.4) < 1e-12);
  const [unusual, , typical] = report.unusualViews.terciles;
  assert.ok(unusual.lift > typical.lift);
  assert.equal(report.coverage.participants, 10);
  assert.equal(report.participants[0].id, 'p001');
  assert.ok(!JSON.stringify(report).includes(people[0].id), 'addresses stay out of the report');
});

test("kappa corrects agreement for chance, and rating error is a share of the scale", () => {
  // Knowing each person: every prediction right, well beyond the 0.52 that the
  // 60/40 answer split gives by chance.
  const knows = scoreAgentFidelity({ questions, pairs: pairsFor((person) => person.view), answers: answersFor(), options: fast });
  assert.equal(knows.agreement.choiceKappa.value, 1);
  // Always "Agree": right for 60% of people, which is exactly what chance gives.
  const stereotype = scoreAgentFidelity({ questions, pairs: pairsFor(() => 'Agree'), answers: answersFor(), options: fast });
  assert.ok(Math.abs(stereotype.agreement.choiceKappa.value) < 1e-12);
  assert.equal(stereotype.agreement.choiceKappa.participants, 10);
  assert.ok(stereotype.agreement.choiceKappa.interval);
  // Rating predictions 7 against answers 9 on a 0–10 scale.
  const rated = pairsFor(() => 'Agree').map((pair) => ({ ...pair, questionId: 'qr', prediction: 7, actual: 9 }));
  const ratings = scoreAgentFidelity({ questions, pairs: rated, answers: answersFor(), options: fast });
  assert.ok(Math.abs(ratings.agreement.ratingError.value - 0.2) < 1e-12);
  assert.equal(ratings.agreement.choiceKappa.suppressed, true, 'no choice predictions');
  const few = scoreAgentFidelity({ questions, pairs: pairsFor(() => 'Agree').slice(0, 16), answers: answersFor(), options: { minParticipants: 5 } });
  assert.equal(few.agreement.choiceKappa.suppressed, true);
  // Knowing each question's majority isn't knowing the person. Nine of ten agree
  // with one statement and disagree with the other, so chance is 0.9 within each
  // question; pooling both questions' answers (half and half) would give 0.8.
  const split = (person, questionId) => (people.indexOf(person) < 9) === (questionId === 'qb1') ? 'Agree' : 'Disagree';
  const majority = pairsFor(
    (person, questionId) => (questionId === 'qb1' ? 'Agree' : 'Disagree'),
    (person, questionId) => ({ actual: split(person, questionId) }),
  ).filter((pair) => pair.questionId === 'qb1' || pair.questionId === 'qb2');
  const byQuestion = scoreAgentFidelity({ questions, pairs: majority, answers: answersFor(), options: fast });
  assert.ok(Math.abs(byQuestion.mirrorScore.overall.value - 0.9) < 1e-12);
  assert.ok(Math.abs(byQuestion.agreement.choiceKappa.value) < 1e-12);
});

test('an agent that only knows the stereotype gains nothing over the majority guess', () => {
  const report = scoreAgentFidelity({ questions, pairs: pairsFor(() => 'Agree'), answers: answersFor(), options: fast });
  assert.ok(Math.abs(report.mirrorScore.overall.value - 0.6) < 1e-12);
  assert.ok(Math.abs(report.baselines.population.lift.value) < 1e-12);
  assert.ok(report.unusualViews.correlation.agent.value > 0, 'it is right only for typical people');
  const calibration = report.calibration.shown;
  assert.equal(calibration.predictions, 40);
  assert.ok(Math.abs(calibration.expectedCalibrationError - 0.3) < 1e-12);
  assert.ok(Math.abs(calibration.brier - 0.33) < 1e-12);
  assert.ok(report.synthesis.majorityPull.value > 0, 'drafts agree with the majority more often than people do');
});

test('calibration uses only confidences that mean the chance of keeping the answer', () => {
  // Prompts before v6 asked for strength of support, which is not a probability to check.
  const pairs = pairsFor(
    () => 'Agree',
    (person, questionId) => (questionId === 'qb1' ? { confidenceMeaning: 'support' } : {}),
  );
  // Ratings are never calibrated, so they don't count either way.
  pairs.push({ ...pairs[0], questionId: 'qr', prediction: 6, actual: 7, confidenceMeaning: 'support' });
  const report = scoreAgentFidelity({ questions, pairs, answers: answersFor(), options: fast });
  assert.equal(report.calibration.shown.predictions, 30);
  assert.deepEqual(report.coverage.byConfidenceMeaning, { keep: 30, support: 10 });
});

test('hidden drafts measure how much showing a draft changes answers', () => {
  // When the draft is shown everyone accepts "Agree"; hidden on qb4, unusual
  // people give their own view.
  const pairs = pairsFor(
    () => 'Agree',
    (person, questionId) =>
      questionId === 'qb4' ? { condition: 'blind', actual: person.view } : { actual: 'Agree' },
  );
  const report = scoreAgentFidelity({ questions, pairs, answers: answersFor(), options: fast });
  assert.ok(Math.abs(report.anchoring.exactMatchShift.value - 0.4) < 1e-12);
  assert.equal(report.mirrorScore.byCondition.blind.value, 0.6);
  assert.equal(report.mirrorScore.byCondition.shown.value, 1);
});

test('hidden drafts are compared only with shown drafts from the same source', () => {
  // Voice drafts summarize what the person just said, so they would make shown
  // drafts look closer than prefill guesses are. Here they all miss instead.
  const pairs = pairsFor(
    () => 'Agree',
    (person, questionId) =>
      questionId === 'qb4'
        ? { condition: 'blind', actual: person.view }
        : questionId === 'qb1'
          ? { origin: 'voice_interview', prediction: 'Disagree', actual: 'Agree' }
          : { actual: 'Agree' },
  );
  const report = scoreAgentFidelity({ questions, pairs, answers: answersFor(), options: fast });
  assert.ok(Math.abs(report.anchoring.exactMatchShift.value - 0.4) < 1e-12);
});

test('group baselines, small-cell suppression, exclusions and agents', () => {
  const groups = Object.fromEntries(people.map((person) => [person.id, person.group]));
  groups[people[9].id] = ['tiny'];
  groups[people[8].id] = ['tiny'];
  const pairs = pairsFor((person) => person.view);
  pairs.push({ ...pairs[0], participantId: '0xagent', isAgent: true });
  const report = scoreAgentFidelity({
    questions,
    pairs,
    answers: answersFor(),
    groups,
    options: { ...fast, excludeParticipants: [people[0].id] },
  });
  assert.equal(report.coverage.participants, 9, 'the excluded person and the agent are left out');
  assert.equal(report.coverage.excludedAgentPredictions, 1);
  assert.equal(report.mirrorScore.byGroup.tiny, undefined, 'small groups are not listed at all');
  assert.equal(report.mirrorScore.groupsWithheld, 2);
  assert.equal(report.mirrorScore.byGroup.common.participants, 5);
  assert.ok(report.participants.every((row) => row.groups.every((group) => group === 'common')));
  assert.equal(report.baselines.group.baseline.value, 1, 'within a like-minded group the majority guess is right');
});

test('breakdowns that divide people withhold what subtracting them would reveal', () => {
  // Nine people use Claude and one ChatGPT: everyone minus Claude would be the
  // ChatGPT user's own score, so neither is shown. Groups split the same way.
  const pairs = pairsFor((person) => person.view, (person) => ({ platform: person === people[9] ? 'chatgpt' : 'claude' }));
  const groups = Object.fromEntries(people.map((person, index) => [person.id, index < 9 ? 'most' : 'one']));
  const report = scoreAgentFidelity({ questions, pairs, answers: answersFor(), groups, options: fast });
  assert.equal(report.mirrorScore.overall.participants, 10);
  assert.deepEqual(report.mirrorScore.byPlatform.claude, { value: null, interval: null, participants: 9, suppressed: true });
  assert.equal(report.mirrorScore.byPlatform.chatgpt.suppressed, true);
  assert.deepEqual(report.mirrorScore.byGroup, {});
  assert.equal(report.mirrorScore.groupsWithheld, 2);
  // Three ChatGPT users are enough to show both.
  const three = pairsFor((person) => person.view, (person) => ({ platform: people.indexOf(person) >= 7 ? 'chatgpt' : 'claude' }));
  const shown = scoreAgentFidelity({ questions, pairs: three, answers: answersFor(), options: fast });
  assert.equal(shown.mirrorScore.byPlatform.claude.value, 1);
  assert.equal(shown.mirrorScore.byPlatform.chatgpt.participants, 3);
  assert.equal(shown.mirrorScore.byPlatform.chatgpt.suppressed, undefined);
  // Overlapping groups: the two people in both a and b form a set of their own,
  // so one of the two is withheld (the first by name when they tie).
  const overlapping = [...Array(5).fill(['a']), ...Array(5).fill(['b']), ['a', 'b'], ['a', 'b']];
  assert.deepEqual(reportableKeys(overlapping, 3), ['b']);
  assert.deepEqual(reportableKeys([['a'], ['a']], 3), [], 'fewer than the minimum in all');
});

test('a missing or broken minimum keeps the default', () => {
  // Four ChatGPT users are fewer than the default 5, with or without an explicit undefined.
  const pairs = pairsFor((person) => person.view, (person) => ({ platform: person.group === 'common' ? 'claude' : 'chatgpt' }));
  for (const minParticipants of [undefined, null, Number.NaN, 0, 2.5]) {
    const overview = scoreFidelityOverview({ questions, pairs, options: { bootstrapSamples: 50, minParticipants } });
    assert.equal(overview.options.minParticipants, 5, `minParticipants ${minParticipants}`);
    assert.equal(overview.mirrorScore.byPlatform.chatgpt.suppressed, true);
  }
});

test('results from fewer people than the minimum are withheld everywhere', () => {
  // Only one person has a hidden draft, so nothing about hidden drafts can be
  // published without revealing that person's answers.
  const pairs = pairsFor(
    () => 'Agree',
    (person, questionId) => (questionId === 'qb4' && person === people[0] ? { condition: 'blind' } : {}),
  );
  const report = scoreAgentFidelity({ questions, pairs, answers: answersFor(), options: { bootstrapSamples: 50, minParticipants: 5 } });
  assert.equal(report.mirrorScore.byCondition.blind.suppressed, true);
  assert.deepEqual(report.calibration.blind, { participants: 1, suppressed: true });
  assert.equal(report.anchoring.exactMatchShift.suppressed, true);
  assert.ok(report.calibration.shown.bins.length > 0);

  // A confidence band only one person's AI used is withheld, while the rest of calibration shows.
  const banded = scoreAgentFidelity({
    questions,
    pairs: pairsFor(
      () => 'Agree',
      (person, questionId) => (questionId === 'qb1' && person === people[0] ? { confidence: 0.35 } : {}),
    ),
    answers: answersFor(),
    options: { bootstrapSamples: 50, minParticipants: 5 },
  });
  assert.deepEqual(banded.calibration.shown.bins[0], { from: 0.3, to: 0.4, predictions: 1, participants: 1, suppressed: true });
  // The other 39 drafts said "Agree" at 90%; 23 of them were kept.
  assert.equal(banded.calibration.shown.bins[1].participants, 10);
  assert.ok(Math.abs(banded.calibration.shown.bins[1].keepRate - 23 / 39) < 1e-12);

  const few = scoreAgentFidelity({ questions, pairs: pairsFor(() => 'Agree').slice(0, 16), answers: answersFor(), options: { minParticipants: 5 } });
  assert.equal(few.coverage.participants, 4);
  assert.equal(few.mirrorScore.overall.suppressed, true);
  assert.equal(few.unusualViews.suppressed, true);
  assert.equal(few.synthesis.spread.suppressed, true);
  assert.deepEqual(few.participants, []);
});

test('the latest record decides, so withdrawn consent and new encryption are honoured', () => {
  const address = '0xccc0000000000000000000000000000000000003';
  const versions = (later) => [
    { responder: address, response: { timeStamp: '2026-10-01T00:00:00Z', responses: [entry('qb1', 'Agree', predicted('Agree', 0.9))] } },
    { responder: address, response: { timeStamp: '2026-10-02T00:00:00Z', responses: [later] } },
  ];
  const withdrawn = collectSessionFidelityData({ questions, payloads: versions(entry('qb1', 'Disagree', null)) });
  assert.equal(withdrawn.pairs.length, 0, 'no draft comparison once consent is withdrawn');
  assert.equal(withdrawn.answers[0].value, 'Disagree');
  const encrypted = collectSessionFidelityData({
    questions,
    payloads: versions({ questionID: 'qb1', answer: { value: '0xcipher', encrypted: true } }),
  });
  assert.deepEqual([encrypted.answers.length, encrypted.pairs.length], [0, 0], 'earlier plaintext is not used');
  // Newest first in the input: the timestamps still decide.
  const reordered = collectSessionFidelityData({ questions, payloads: versions(entry('qb1', 'Disagree', null)).reverse() });
  assert.equal(reordered.answers[0].value, 'Disagree');
});

test('questions-view export rows and legacy ratings are read like the app reads them', () => {
  const { answers, pairs } = collectSessionFidelityData({
    questions,
    payloads: [
      {
        responder: '0xddd0000000000000000000000000000000000004',
        questionId: 'qb1',
        timestamp: 5,
        response: {
          ...entry('qb1', 'Agree', predicted('Agree', 0.7, { originalPrediction: { answer: 'Agree', confidence: 0.7, importance: 60 } })),
          importance: 80,
        },
      },
      {
        responder: '0xddd0000000000000000000000000000000000004',
        questionId: 'qr',
        response: JSON.stringify({ ...entry('qr', 4, predicted(5, 0.5)), importance: null, conviction: 7 }),
      },
    ],
  });
  assert.equal(answers.length, 2);
  const first = pairs.find((pair) => pair.questionId === 'qb1');
  assert.deepEqual([first.importance, first.predictedImportance], [8, 6], 'legacy 0-100 ratings are rescaled');
  assert.equal(pairs.find((pair) => pair.questionId === 'qr').importance, 7, 'missing importance falls back on conviction');
});

test('Session Wrapped confidences are always percents and gold rows order by time', () => {
  const rows = [
    { principal_id: 'p1', statement_id: 'qb1', agent_prediction: { value: 'agree' }, agent_confidence: 1, prior_human_answer: { value: 'Agree' }, created_at: '2026-07-02T00:00:00Z' },
    { principal_id: 'p1', statement_id: 'qb1', agent_prediction: { value: 'disagree' }, agent_confidence: 50, prior_human_answer: { value: 'Agree' }, created_at: '2026-07-01T00:00:00Z' },
  ];
  const [pair] = collectWrappedFidelityPairs({ questions, rows });
  assert.equal(pair.prediction, 'Agree', 'the later prediction wins');
  assert.equal(pair.confidence, 0.01, 'a confidence of 1 means 1%');
});

// Spread and typicality use grouped and closed-form sums; check them against
// the direct definition on random answers of every type.
const randomAnswer = (random, question) => {
  const pick = (list) => list[Math.floor(random() * list.length)];
  switch (question.type) {
    case 'binary':
      return pick(['Agree', 'Unsure', 'Disagree']);
    case 'multichoice':
      return question.singleSelect
        ? [pick(question.options)]
        : question.options.filter((_, index) => random() < 0.5 || index === 0);
    case 'rating':
      return Math.floor(random() * 11);
    default:
      return random() < 0.2 ? [0, 0, 0] : [0, 0, 0].map(() => Math.floor(random() * 11) - 5);
  }
};
const meanPairwise = (question, values, measure) => {
  let [total, count] = [0, 0];
  values.forEach((a, i) => values.slice(i + 1).forEach((b) => {
    total += measure(question, a, b);
    count += 1;
  }));
  return total / count;
};

test('grouped spread and typicality sums match the direct definitions', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const scoredQuestions = ['qb1', 'qs', 'qm', 'qr', 'qq'].map((id) => q[id]);
  const crowd = Array.from({ length: 23 }, (_, index) => `0x${String(index + 100).padStart(40, '0')}`);
  const pairs = crowd.flatMap((participantId) =>
    scoredQuestions.map((question) => ({
      participantId,
      questionId: question.id,
      condition: 'shown',
      origin: 'external_prefill',
      platform: 'claude',
      modelId: 'test',
      prediction: randomAnswer(random, question),
      actual: randomAnswer(random, question),
      confidence: null,
      at: 1,
    })),
  );
  const answers = pairs.map((pair) => ({ participantId: pair.participantId, questionId: pair.questionId, value: pair.actual, at: 1 }));
  const report = scoreAgentFidelity({ questions, pairs, answers, options: { bootstrapSamples: 0, minParticipants: 2 } });
  const dissimilarity = (question, a, b) => 1 - answerSimilarity(question, a, b);
  const expectedSpread =
    scoredQuestions
      .map((question) => {
        const forQuestion = pairs.filter((pair) => pair.questionId === question.id);
        return (
          meanPairwise(question, forQuestion.map((pair) => pair.prediction), dissimilarity) -
          meanPairwise(question, forQuestion.map((pair) => pair.actual), dissimilarity)
        );
      })
      .reduce((sum, value) => sum + value, 0) / scoredQuestions.length;
  assert.ok(Math.abs(report.synthesis.spread.value - expectedSpread) < 1e-9);
  const firstTypicality =
    scoredQuestions
      .map((question) => {
        const own = answers.find((answer) => answer.participantId === crowd[0] && answer.questionId === question.id).value;
        const rest = answers.filter((answer) => answer.questionId === question.id && answer.participantId !== crowd[0]);
        return rest.reduce((sum, answer) => sum + answerSimilarity(question, own, answer.value), 0) / rest.length;
      })
      .reduce((sum, value) => sum + value, 0) / scoredQuestions.length;
  assert.ok(Math.abs(report.participants[0].typicality - firstTypicality) < 1e-9);
});

test('synthesis checks find drafts that flatten strong views', () => {
  const pairs = people.map((person, index) => ({
    participantId: person.id,
    questionId: 'qr',
    condition: 'shown',
    origin: 'voice_interview',
    platform: 'other',
    modelId: DEFAULT_AI_MODEL,
    prediction: 5,
    actual: index % 2 ? 10 : 0,
    confidence: null,
    predictedImportance: 3,
    importance: 8,
    at: 1,
  }));
  const answers = pairs.map((pair) => ({ participantId: pair.participantId, questionId: 'qr', value: pair.actual, at: 1 }));
  const report = scoreAgentFidelity({ questions, pairs, answers, options: fast });
  assert.equal(report.synthesis.ratingExtremity.value, -1);
  assert.equal(report.synthesis.importance.value, -5);
  assert.ok(report.synthesis.spread.value < 0, 'drafts make people look more alike');
  assert.deepEqual(Object.keys(report.calibration), []);
  assert.equal(report.correctionRate.value, null, 'ratings are scored by similarity, not kept-or-changed');
});

test('reports are deterministic for a seed', () => {
  const input = { questions, pairs: pairsFor(() => 'Agree'), answers: answersFor(), options: fast };
  assert.deepEqual(scoreAgentFidelity(input).mirrorScore.overall, scoreAgentFidelity(input).mirrorScore.overall);
  assert.ok(scoreAgentFidelity(input).mirrorScore.overall.interval);
});

test('the Results overview matches the report and withholds the same cells', () => {
  // Common-view people use Claude and unusual-view people ChatGPT; one person has a hidden draft.
  const pairs = pairsFor(
    (person, questionId) => (questionId === 'qb2' ? 'Agree' : person.view),
    (person, questionId) => ({
      platform: person.group === 'common' ? 'claude' : 'chatgpt',
      confidence: questionId === 'qb3' ? 0.4 : 0.9,
      ...(questionId === 'qb4' && person === people[0] ? { condition: 'blind' } : {}),
    }),
  );
  const input = { questions, pairs, answers: answersFor(), options: { bootstrapSamples: 100, minParticipants: 5 } };
  const report = scoreAgentFidelity(input);
  const overview = scoreFidelityOverview(input);
  const { byGroup: _byGroup, groupsWithheld: _groupsWithheld, ...mirrorScore } = report.mirrorScore;
  assert.deepEqual(overview.mirrorScore, mirrorScore);
  assert.deepEqual(overview.correctionRate, report.correctionRate);
  assert.deepEqual(overview.calibration, report.calibration);
  assert.deepEqual(overview.coverage, report.coverage);
  assert.equal(overview.mirrorScore.byCondition.blind.suppressed, true);
  assert.equal(overview.mirrorScore.byPlatform.chatgpt.suppressed, true, 'four people are too few');
  assert.equal(overview.mirrorScore.byPlatform.claude.participants, 6);
  assert.equal(overview.mirrorScore.byPlatform.claude.suppressed, true, 'everyone minus Claude would be those four');
});

test('Results rows come from both views of the screen', () => {
  const surveyRow = { responder: people[0].id, response: { responses: [{ questionID: 'qb1', answer: 'Agree' }] } };
  const questionRow = { responder: people[0].id, questionId: 'qb1', response: { questionID: 'qb1', answer: 'Agree' } };
  assert.deepEqual(resultsResponseRows({ filteredResponses: [surveyRow], filteredQuestionResponses: { qb1: [questionRow] } }), [
    surveyRow,
    questionRow,
  ]);
  assert.deepEqual(resultsResponseRows({ filteredResponses: [], filteredQuestionResponses: {} }), []);
  assert.deepEqual(resultsResponseRows([questionRow]), [questionRow]);
  // The same answer seen in both views counts once.
  const { answers } = collectSessionFidelityData({ questions, payloads: [surveyRow, questionRow] });
  assert.equal(answers.length, 1);
});

test('a participant summary lists the most confident misses first', () => {
  const summary = summarizeParticipantFidelity({
    questions,
    pairs: [
      { questionId: 'qb1', condition: 'shown', prediction: 'Agree', actual: 'Agree', confidence: 0.9 },
      { questionId: 'qb2', condition: 'shown', prediction: 'Agree', actual: 'Disagree', confidence: 0.6 },
      { questionId: 'qb3', condition: 'blind', prediction: 'Disagree', actual: 'Agree', confidence: 0.95 },
      { questionId: 'qr', condition: 'shown', prediction: 7, actual: 8, confidence: 0.99 },
      { questionId: 'qf', condition: 'shown', prediction: 'a', actual: 'b', confidence: 0.99 },
    ],
  });
  assert.equal(summary.predictions, 4, 'freeform is not scored');
  assert.equal(summary.choicePredictions, 3);
  assert.equal(summary.choiceMatches, 1);
  assert.equal(summary.hiddenChoicePredictions, 1);
  assert.equal(summary.hiddenPredictions, 1);
  assert.equal(summary.hiddenMatches, 0);
  assert.deepEqual(summary.confidentMisses.map((miss) => miss.questionId), ['qb3', 'qb2'], 'a near-miss rating is not a miss');
  assert.equal(summarizeParticipantFidelity({ questions, pairs: [] }), null);
});

test("a person's own review becomes pairs from raw drafts and answers", () => {
  const pairs = fidelityPairsFromReview({
    questions,
    reviewed: [
      { questionId: 'QB1', predicted: 'Agree', answered: 'agree', confidence: 0.9 },
      { questionId: 'qs', predicted: 'B', answered: ['B'], confidence: 0.6, condition: 'blind' },
      { questionId: 'qr', predicted: 7, answered: '7', confidence: 80 },
      { questionId: 'qb2', predicted: 'Maybe', answered: 'Agree', confidence: 0.5 },
      { questionId: 'missing', predicted: 'Agree', answered: 'Agree', confidence: 0.5 },
    ],
  });
  assert.deepEqual(pairs, [
    { questionId: 'qb1', condition: 'shown', prediction: 'Agree', actual: 'Agree', confidence: 0.9 },
    { questionId: 'qs', condition: 'blind', prediction: ['B'], actual: ['B'], confidence: 0.6 },
    { questionId: 'qr', condition: 'shown', prediction: 7, actual: 7, confidence: 0.8 },
  ]);
  const summary = summarizeParticipantFidelity({ questions, pairs });
  assert.equal(summary.choiceMatches, 2);
  assert.equal(summary.hiddenChoiceMatches, 1);
  assert.deepEqual([summary.hiddenPredictions, summary.hiddenMatches], [1, 1]);
});

test('minimal freeform predictions are counted as unscored, not unreadable', () => {
  const { pairs, skipped } = collectSessionFidelityData({
    questions,
    payloads: [{ responder: '0xeee0000000000000000000000000000000000005', response: entry('qf', 'My answer', predicted(null, 0.5)) }],
  });
  assert.equal(pairs.length, 0);
  assert.deepEqual([skipped.freeformWithoutText, skipped.unreadablePrediction], [1, 0]);
});
