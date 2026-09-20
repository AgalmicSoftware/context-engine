import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from '../src/io.mjs';
import { hashJson } from '../src/provenance.mjs';
import { validateQuestionBank } from '../src/schema.mjs';
import {
  TOPIC_TARGETS,
  TOTAL_TARGET,
  computeStats,
  constraintViolations,
  interleaveTopics,
  lintItem,
  nearDuplicatePairs,
  parseAuthoringLine,
} from '../src/v03-bank.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankDirectory = path.join(packageRoot, 'banks', 'ai-futures', 'v0.3-candidate');

const baseLine = {
  t: 'agent-money-and-commitments',
  c: 'normative',
  k: 'threshold',
  d: 'intervention',
  q: 'An AI agent should stop and ask before any single purchase above $50.',
  r: 'An AI agent should complete single purchases above $50 without asking.',
  a: 'require_confirmation_above_50_usd',
  x: 'per-transaction confirmation versus standing authority',
  p: ['Even with pre-approval, an agent should pause on purchases over fifty dollars.'],
  s: ['arxiv:governing_agentic_ai_shavit_2023', 'labs:openai_model_spec_2025_12'],
};

const line = (overrides = {}) => JSON.stringify({ ...baseLine, ...overrides });

test('parseAuthoringLine accepts a valid item and canonicalizes corpus aliases', () => {
  const item = parseAuthoringLine(line(), 'fixture.jsonl', 1);
  assert.equal(item.topic, 'agent-money-and-commitments');
  assert.equal(item.role, 'probe');
  assert.deepEqual(item.anchors.map((anchor) => anchor.corpus), ['arxiv-ai-safety', 'lab-primary-docs']);
  assert.equal(item.paraphrases.length, 1);
});

test('parseAuthoringLine rejects unknown topics, kinds, directions, and roles', () => {
  assert.throws(() => parseAuthoringLine(line({ t: 'not-a-topic' }), 'f', 1), /not a v0.3 topic/);
  assert.throws(() => parseAuthoringLine(line({ k: 'vibe' }), 'f', 1), /k \(vibe\)/);
  assert.throws(() => parseAuthoringLine(line({ d: 'sideways' }), 'f', 1), /d \(sideways\)/);
  assert.throws(() => parseAuthoringLine(line({ role: 'hero' }), 'f', 1), /role \(hero\)/);
  assert.throws(() => parseAuthoringLine(line({ s: [] }), 'f', 1), /non-empty array/);
  assert.throws(() => parseAuthoringLine(line({ r: baseLine.q }), 'f', 1), /q and r must differ/);
});

test('lintItem enforces the reversal and canonical-form contract', () => {
  const clean = parseAuthoringLine(line(), 'f', 1);
  assert.deepEqual(lintItem(clean), []);

  const needNot = parseAuthoringLine(line({ r: 'An AI agent need not ask before purchases above $50.' }), 'f', 1);
  assert.ok(lintItem(needNot).some((issue) => issue.includes('need not')));

  const always = parseAuthoringLine(line({ r: 'An AI agent should always ask before purchases above $50.' }), 'f', 1);
  assert.ok(lintItem(always).some((issue) => issue.includes('always')));

  const doubleNegative = parseAuthoringLine(line({ r: 'An AI agent should not buy anything without asking first.' }), 'f', 1);
  assert.ok(lintItem(doubleNegative).some((issue) => issue.includes('double negative')));

  const thanNot = parseAuthoringLine(line({
    c: 'forecast', k: 'forecast', d: 'neutral',
    q: 'It is more likely than not that agents will shop without supervision by 2030.',
    r: 'It is less likely than not that agents will shop without supervision by 2030.',
  }), 'f', 1);
  assert.deepEqual(lintItem(thanNot), []);

  const motherhood = parseAuthoringLine(line({ q: 'AI policy should distinguish learning from cheating.' }), 'f', 1);
  assert.ok(lintItem(motherhood).some((issue) => issue.includes('should distinguish')));

  const selfRef = parseAuthoringLine(line({ role: 'self-referential' }), 'f', 1);
  assert.ok(lintItem(selfRef).some((issue) => issue.includes('self-referential item must start')));

  const missingParaphrase = parseAuthoringLine(line({ p: [] }), 'f', 1);
  assert.ok(lintItem(missingParaphrase).some((issue) => issue.includes('paraphrase')));

  const neutralNormative = parseAuthoringLine(line({ d: 'neutral' }), 'f', 1);
  assert.ok(lintItem(neutralNormative).some((issue) => issue.includes('neutral direction')));
});

test('interleaveTopics round-robins topics deterministically', () => {
  const items = [
    { topic: 'b', n: 1 }, { topic: 'b', n: 2 },
    { topic: 'a', n: 1 }, { topic: 'a', n: 2 }, { topic: 'a', n: 3 },
  ];
  const ordered = interleaveTopics(items).map((item) => `${item.topic}${item.n}`);
  assert.deepEqual(ordered, ['a1', 'b1', 'a2', 'b2', 'a3']);
});

test('nearDuplicatePairs flags near-identical canonical prompts only', () => {
  const pairs = nearDuplicatePairs([
    { id: 'x1', canonicalPrompt: 'Frontier labs should publish quarterly compute use figures.' },
    { id: 'x2', canonicalPrompt: 'Frontier labs should publish quarterly compute use figures publicly.' },
    { id: 'x3', canonicalPrompt: 'Deepfake rules should be stricter for elections.' },
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].left, 'x1');
  assert.equal(pairs[0].right, 'x2');
});

test('constraintViolations reports count, balance, role, and anchor-share problems', () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    topic: 'agent-money-and-commitments',
    role: 'probe',
    kind: 'principle',
    claimType: 'normative',
    direction: 'intervention',
    paraphrases: ['p'],
  }));
  const questions = items.map(() => ({ sourceEvidence: [{ corpus: 'tweets', url: null, supportingRecords: [] }] }));
  const stats = computeStats(items, questions);
  const violations = constraintViolations(stats);
  assert.ok(violations.some((message) => message.includes(`expected ${TOTAL_TARGET}`)));
  assert.ok(violations.some((message) => message.includes('intervention share')));
  assert.ok(violations.some((message) => message.includes('control-anchor')));
  assert.ok(violations.some((message) => message.includes('tweet-only')));
  assert.ok(violations.some((message) => message.includes('lack a concrete source URL')));
});

test('checked-in v0.3 candidate bank matches its manifest and satisfies the schema and constraints', async () => {
  const bank = await readJsonFile(path.join(bankDirectory, 'question-bank.json'));
  const manifest = await readJsonFile(path.join(bankDirectory, 'manifest.json'));
  const audit = await readJsonFile(path.join(bankDirectory, 'generation-audit.json'));
  const reviewCsv = await fs.readFile(path.join(bankDirectory, 'human-review.csv'), 'utf8');

  assert.equal(bank.questions.length, TOTAL_TARGET);
  assert.equal(bank.releaseStatus, 'candidate');
  assert.equal(bank.reviewPolicy.humanClaimReviewComplete, false);
  assert.equal(bank.reviewPolicy.releaseBlockedUntilApproved, true);
  assert.deepEqual(validateQuestionBank(bank), []);
  assert.equal(manifest.questionBankHash, hashJson(bank));
  assert.equal(audit.constraintViolations.length, 0);
  assert.equal(audit.schemaErrorCount, 0);
  assert.equal(audit.nearDuplicatePairs.length, 0);

  const topics = new Set(bank.questions.map((question) => question.topic));
  assert.deepEqual([...topics].sort(), Object.keys(TOPIC_TARGETS).sort());
  const agentItems = bank.questions.filter((question) => question.topic.startsWith('agent-'));
  assert.equal(agentItems.length, 250);

  bank.questions.forEach((question) => {
    assert.equal(question.review.claimSupport, 'pending-human-review');
    assert.equal(question.review.adjudicationStatus, 'pending');
    assert.ok(question.sourceEvidence.length >= 1);
    assert.ok(['probe', 'self-referential', 'minority', 'control-anchor', 'attention-check'].includes(question.v03.role));
    if (question.v03.role === 'self-referential') {
      assert.ok(question.canonicalPrompt.startsWith('The AI system answering this question'));
    }
    if (!['control-anchor', 'attention-check'].includes(question.v03.role)) {
      assert.ok(question.v03.paraphrases.length >= 1);
    }
  });

  const rows = reviewCsv.trim().split('\n');
  assert.equal(rows.length, TOTAL_TARGET + 1);
  assert.match(rows[0], /reviewer1_claimSupport/);
  assert.match(rows[0], /reviewer2_singleAxis/);
});
