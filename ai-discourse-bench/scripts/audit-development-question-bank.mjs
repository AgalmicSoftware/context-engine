import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCorpusEvidenceIndex, resolveQuestionEvidence } from '../src/corpus-evidence.mjs';
import { readJsonFile, writeJsonFile } from '../src/io.mjs';
import { hashJson } from '../src/provenance.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const questionBankPath = path.join(packageRoot, 'data', 'question-bank.sample.json');
const corpusRoot = path.resolve(packageRoot, '..', 'ai-discourse-corpus');
const reviewedCandidatePath = path.join(
  packageRoot,
  'banks',
  'ai-futures',
  'v0.2-reviewed-candidate',
  'question-bank.json',
);

const bank = await readJsonFile(questionBankPath);
const reviewedCandidate = await readJsonFile(reviewedCandidatePath);
const corpusIndex = await loadCorpusEvidenceIndex(corpusRoot);
const candidateIds = new Set(reviewedCandidate.questions.map((question) => question.id));
const promptOwners = new Map();
const duplicatePrompts = [];
const unresolvedAnchors = [];

for (const question of bank.questions) {
  for (const [polarity, prompt] of [
    ['canonical', question.canonicalPrompt],
    ['reversed', question.reversedPrompt],
  ]) {
    const normalized = prompt.trim().toLowerCase();
    if (promptOwners.has(normalized)) {
      duplicatePrompts.push({
        prompt,
        first: promptOwners.get(normalized),
        second: { questionId: question.id, polarity },
      });
    } else {
      promptOwners.set(normalized, { questionId: question.id, polarity });
    }
  }
  try {
    resolveQuestionEvidence(corpusIndex, question);
  } catch (error) {
    unresolvedAnchors.push({ questionId: question.id, error: error.message });
  }
}

const topics = Object.entries(bank.questions.reduce((counts, question) => ({
  ...counts,
  [question.topic]: (counts[question.topic] || 0) + 1,
}), {})).map(([topic, count]) => ({ topic, count }));

const audit = {
  schemaVersion: 1,
  kind: 'ai_discourse_bench_development_bank_audit',
  benchmarkId: bank.benchmarkId,
  questionBankHash: hashJson(bank),
  releaseStatus: bank.releaseStatus,
  structuralChecks: {
    questionCount: bank.questions.length,
    uniqueQuestionIds: new Set(bank.questions.map((question) => question.id)).size,
    topicCount: topics.length,
    topicDistribution: topics,
    duplicatePromptCount: duplicatePrompts.length,
    duplicatePrompts,
    resolvedQuestionCount: bank.questions.length - unresolvedAnchors.length,
    unresolvedAnchors,
  },
  semanticReview: {
    reviewedCandidateQuestionCount: candidateIds.size,
    deferredQuestionCount: bank.questions.length - candidateIds.size,
    reviewedCandidateId: reviewedCandidate.benchmarkId,
    reviewedCandidateHash: hashJson(reviewedCandidate),
    note: 'The release-oriented 50-question slice received an AI-assisted single-axis and reversal audit. The remaining 150 development questions retain generator quality assertions and have not received item-level release adjudication.',
  },
  decision: {
    suitableForDevelopmentRuns: unresolvedAnchors.length === 0 && duplicatePrompts.length === 0,
    suitableForOfficialRelease: false,
    reasonsReleaseIsBlocked: [
      'The 200-question bank is explicitly a development seed.',
      'Only the 50-question reviewed candidate has received an item-level AI wording audit.',
      'Neither bank has the required two independent human adjudications.',
    ],
  },
};

await writeJsonFile(path.join(packageRoot, 'audits', 'development-seed-200-audit.json'), audit);
console.log(`audited ${bank.questions.length} development questions`);
console.log(`${audit.structuralChecks.resolvedQuestionCount} source-resolved; ${duplicatePrompts.length} duplicate prompts`);
console.log(`${candidateIds.size} questions promoted to the reviewed candidate; ${audit.semanticReview.deferredQuestionCount} deferred`);
