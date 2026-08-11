import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CANDIDATE_QUESTION_IDS, defaultCandidatePaths } from '../src/candidate-bank.mjs';
import { loadCorpusEvidenceIndex, resolveCorpusRecord } from '../src/corpus-evidence.mjs';
import { hashJson, sha256 } from '../src/provenance.mjs';
import { validateQuestionBank } from '../src/schema.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = defaultCandidatePaths(packageRoot);
const bankPath = path.join(paths.outputDirectory, 'question-bank.json');
const manifestPath = path.join(paths.outputDirectory, 'manifest.json');

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

test('candidate bank is source-resolved, balanced, and explicitly not validated', async () => {
  const bank = await readJson(bankPath);
  assert.equal(bank.releaseStatus, 'candidate');
  assert.equal(bank.reviewPolicy.releaseBlockedUntilApproved, true);
  assert.equal(bank.questions.length, 50);
  assert.deepEqual(bank.questions.map((question) => question.id), CANDIDATE_QUESTION_IDS);
  assert.deepEqual(validateQuestionBank(bank), []);

  const topics = Object.groupBy(bank.questions, (question) => question.topic);
  const counts = Object.values(topics).map((questions) => questions.length);
  assert.equal(Object.keys(topics).length, 20);
  assert.equal(counts.filter((count) => count === 3).length, 10);
  assert.equal(counts.filter((count) => count === 2).length, 10);

  const evidenceIndex = await loadCorpusEvidenceIndex(paths.corpusRoot);
  for (const question of bank.questions) {
    assert.ok(question.sourceEvidence.length > 0, `${question.id} has evidence`);
    assert.equal(question.review.claimSupport, 'pending-human-review');
    assert.equal(question.review.reversal, 'pending-human-review');
    for (const evidence of question.sourceEvidence) {
      const resolved = resolveCorpusRecord(evidenceIndex, evidence.corpus, evidence.idOrUrl);
      assert.ok(resolved, `${question.id} resolves ${evidence.corpus}:${evidence.idOrUrl}`);
      assert.equal(evidence.sourceRecordHash, hashJson(resolved.record));
      assert.equal(evidence.evidenceScope, 'source-record-resolution-only');
      assert.equal(evidence.relatedDisagreementAxis, question.disagreementAxis);
      assert.equal(Object.hasOwn(evidence, 'supports'), false);
      assert.ok(
        evidence.url || evidence.supportingRecords.some((record) => record.url),
        `${question.id} has a concrete source URL`,
      );
    }
  }
});

test('candidate manifest pins the bank and corpus file contents', async () => {
  const [bank, manifest] = await Promise.all([readJson(bankPath), readJson(manifestPath)]);
  assert.equal(manifest.questionBankHash, hashJson(bank));
  assert.equal(manifest.sourceCorpusRevision, bank.sourceCorpus.revision);
  assert.equal(manifest.reviewStatus, 'pending-human-review');
  assert.ok(manifest.sourceFiles.length > 0);

  for (const sourceFile of manifest.sourceFiles) {
    const fileName = path.basename(sourceFile.relativePath);
    const raw = await fs.readFile(path.join(paths.corpusRoot, 'corpuses', fileName));
    assert.equal(sourceFile.sha256, sha256(raw));
  }
});

test('validated banks require completed question adjudication', async () => {
  const bank = await readJson(bankPath);
  bank.releaseStatus = 'validated';
  const errors = validateQuestionBank(bank);
  assert.ok(errors.some((error) => error.includes('claimSupport must be approved')));
  assert.ok(errors.some((error) => error.includes('reversal must be approved')));
  assert.ok(errors.some((error) => error.includes('adjudicationStatus must be approved')));
});
