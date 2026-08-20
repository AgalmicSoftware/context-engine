import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from '../src/io.mjs';
import { hashJson } from '../src/provenance.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankDirectory = path.join(packageRoot, 'banks', 'ai-futures', 'v0.2-reviewed-candidate');

test('reviewed candidate records the audit without claiming human validation', async () => {
  const bank = await readJsonFile(path.join(bankDirectory, 'question-bank.json'));
  const manifest = await readJsonFile(path.join(bankDirectory, 'manifest.json'));
  const audit = await readJsonFile(path.join(bankDirectory, 'audit.json'));
  const reviewCsv = await fs.readFile(path.join(bankDirectory, 'human-review.csv'), 'utf8');

  assert.equal(bank.questions.length, 50);
  assert.equal(bank.releaseStatus, 'candidate');
  assert.equal(bank.reviewPolicy.aiWordingAuditComplete, true);
  assert.equal(bank.reviewPolicy.humanClaimReviewComplete, false);
  assert.equal(bank.reviewPolicy.humanReversalReviewComplete, false);
  assert.equal(bank.reviewPolicy.humanSingleAxisReviewComplete, false);
  assert.equal(manifest.questionBankHash, hashJson(bank));
  assert.equal(manifest.reviewStatus, 'ai-reviewed-pending-independent-human-review');
  assert.equal(audit.outcome.revised, 8);
  assert.equal(audit.outcome.acceptedWithoutWordingChange, 42);
  assert.equal(reviewCsv.trim().split('\n').length, 51);
  assert.match(reviewCsv.split('\n')[0], /reviewer_1_claim_support/);
  assert.match(reviewCsv.split('\n')[0], /reviewer_2_claim_support/);
});
