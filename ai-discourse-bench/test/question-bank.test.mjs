import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { defaultCandidatePaths } from '../src/candidate-bank.mjs';
import { loadCorpusEvidenceIndex, resolveCorpusRecord } from '../src/corpus-evidence.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readQuestionBank = async () => JSON.parse(
  await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'),
);

test('sample question bank contains 200 unique corpus-anchored questions', async () => {
  const questionBank = await readQuestionBank();
  assert.equal(questionBank.questions.length, 200);
  assert.equal(questionBank.releaseStatus, 'development-seed');
  assert.equal(questionBank.runPlan.repeatsPerPolarity, 10);
  assert.deepEqual(questionBank.runPlan.polarities, ['canonical', 'reversed']);

  const ids = new Set();
  for (const question of questionBank.questions) {
    assert.equal(question.answerType, 'agree_unsure_disagree');
    assert.ok(question.canonicalPrompt.length > 20);
    assert.ok(question.reversedPrompt.length > 20);
    assert.notEqual(question.canonicalPrompt, question.reversedPrompt);
    assert.ok(Array.isArray(question.sourceAnchors) || Array.isArray(question.agentVillageAnchors));
    assert.ok(Array.isArray(question.riskFacets) && question.riskFacets.length > 0);
    assert.equal(ids.has(question.id), false);
    ids.add(question.id);
  }
});

test('sample question bank covers 20 topics with 10 questions each', async () => {
  const questionBank = await readQuestionBank();
  const counts = new Map();
  for (const question of questionBank.questions) {
    counts.set(question.topic, (counts.get(question.topic) || 0) + 1);
  }
  assert.equal(counts.size, 20);
  for (const count of counts.values()) {
    assert.equal(count, 10);
  }
});

test('every sample question anchor resolves into the OSS ai-discourse-corpus', async () => {
  const questionBank = await readQuestionBank();
  const { corpusRoot } = defaultCandidatePaths(packageRoot);
  const evidenceIndex = await loadCorpusEvidenceIndex(corpusRoot);
  let resolvedAnchorCount = 0;

  for (const question of questionBank.questions) {
    assert.ok(question.sourceAnchors.length > 0, `${question.id} has a corpus anchor`);
    for (const anchor of question.sourceAnchors) {
      assert.ok(
        resolveCorpusRecord(evidenceIndex, anchor.corpus, anchor.idOrUrl),
        `${question.id} resolves ${anchor.corpus}:${anchor.idOrUrl}`,
      );
      resolvedAnchorCount += 1;
    }
  }

  assert.ok(resolvedAnchorCount >= questionBank.questions.length);
});
