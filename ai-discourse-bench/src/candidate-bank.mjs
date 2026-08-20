import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { loadCorpusEvidenceIndex, resolveQuestionEvidence } from './corpus-evidence.mjs';
import { hashJson } from './provenance.mjs';

export const CANDIDATE_QUESTION_IDS = Object.freeze([
  'aidb_0001', 'aidb_0006', 'aidb_0010',
  'aidb_0011', 'aidb_0013', 'aidb_0016',
  'aidb_0021', 'aidb_0025', 'aidb_0030',
  'aidb_0031', 'aidb_0036', 'aidb_0040',
  'aidb_0041', 'aidb_0042', 'aidb_0050',
  'aidb_0052', 'aidb_0057', 'aidb_0059',
  'aidb_0062', 'aidb_0064', 'aidb_0070',
  'aidb_0071', 'aidb_0072', 'aidb_0080',
  'aidb_0081', 'aidb_0086', 'aidb_0089',
  'aidb_0091', 'aidb_0093', 'aidb_0096',
  'aidb_0102', 'aidb_0104',
  'aidb_0111', 'aidb_0113',
  'aidb_0121', 'aidb_0122',
  'aidb_0131', 'aidb_0134',
  'aidb_0141', 'aidb_0147',
  'aidb_0154', 'aidb_0155',
  'aidb_0161', 'aidb_0163',
  'aidb_0172', 'aidb_0178',
  'aidb_0183', 'aidb_0184',
  'aidb_0192', 'aidb_0193',
]);

const CLAIM_TYPES_BY_TOPIC = Object.freeze({
  'capability-forecasts': 'forecast',
  'ai-rd-automation': 'forecast',
  'benchmark-validity': 'empirical',
  'environment-and-infrastructure': 'empirical',
  'ai-rights-and-moral-status': 'moral',
  'regulation-and-coordination': 'institutional',
  'public-sector-and-high-stakes-ai': 'institutional',
  'procurement-liability-and-audits': 'institutional',
});

const corpusRevision = (corpusRoot) => {
  try {
    return execFileSync('git', ['log', '-1', '--format=%H', '--', '.'], {
      cwd: corpusRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
};

export const buildCandidateBank = async ({ seedBank, corpusRoot, packageRoot }) => {
  const selectedIds = new Set(CANDIDATE_QUESTION_IDS);
  const questions = (seedBank.questions || []).filter((question) => selectedIds.has(question.id));
  if (questions.length !== CANDIDATE_QUESTION_IDS.length) {
    const found = new Set(questions.map((question) => question.id));
    const missing = CANDIDATE_QUESTION_IDS.filter((id) => !found.has(id));
    throw new Error(`candidate selection is missing seed questions: ${missing.join(', ')}`);
  }
  const evidenceIndex = await loadCorpusEvidenceIndex(corpusRoot);
  const enrichedQuestions = questions.map((question) => ({
    ...question,
    claimType: CLAIM_TYPES_BY_TOPIC[question.topic] || 'normative',
    selectionRationale: `Selected as a concise, single-axis probe of ${question.disagreementAxis}.`,
    sourceEvidence: resolveQuestionEvidence(evidenceIndex, question),
    review: {
      sourceResolution: 'resolved',
      claimSupport: 'pending-human-review',
      reversal: 'pending-human-review',
      singleAxis: 'pending-human-review',
      adjudicationStatus: 'pending',
    },
  }));
  const revision = corpusRevision(corpusRoot);
  const bank = {
    benchmarkId: 'ai-discourse-bench-ai-futures-v0.1-candidate',
    schemaVersion: 2,
    releaseStatus: 'candidate',
    track: 'ai-futures',
    version: '0.1.0-candidate.1',
    title: 'AI Discourse Bench: AI Futures Candidate v0.1',
    description: 'A source-resolved 50-question candidate bank spanning AI policy, futures, deployment, rights, labor, safety, and discourse. Human claim and reversal review remains pending.',
    sourceCorpus: {
      name: 'ai-discourse-corpus',
      path: 'ai-discourse-corpus',
      revision,
      resolutionMethod: 'direct record resolution with compact debate supporting records',
    },
    selection: {
      sourceBankId: seedBank.benchmarkId,
      questionCount: enrichedQuestions.length,
      topicCount: new Set(enrichedQuestions.map((question) => question.topic)).size,
      policy: 'Three questions from ten core topics and two questions from ten breadth topics; selection favors clear disagreement axes and non-trivial model differentiation.',
      selectedQuestionIds: CANDIDATE_QUESTION_IDS,
    },
    reviewPolicy: {
      automatedSourceResolutionComplete: true,
      humanClaimReviewComplete: false,
      humanReversalReviewComplete: false,
      minimumIndependentReviewers: 2,
      releaseBlockedUntilApproved: true,
    },
    runPlan: {
      answerType: 'agree_unsure_disagree',
      repeatsPerPolarity: 10,
      polarities: ['canonical', 'reversed'],
      normalizeReversedToCanonical: true,
    },
    questions: enrichedQuestions,
  };
  return {
    bank,
    manifest: {
      schemaVersion: 1,
      kind: 'ai_discourse_bench_question_bank_manifest',
      track: bank.track,
      version: bank.version,
      releaseStatus: bank.releaseStatus,
      benchmarkId: bank.benchmarkId,
      questionBankHash: hashJson(bank),
      sourceCorpusRevision: revision,
      sourceFiles: evidenceIndex.files
        .filter((file) => enrichedQuestions.some((question) => question.sourceEvidence.some((evidence) => (
          evidence.corpus === file.corpus
          || evidence.supportingRecords.some((record) => record.corpus === file.corpus)
        ))))
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
      reviewStatus: 'pending-human-review',
    },
  };
};

export const defaultCandidatePaths = (packageRoot) => ({
  corpusRoot: (() => {
    const worktreeCorpus = path.resolve(packageRoot, '../ai-discourse-corpus');
    const hasCanonicalCorpus = (corpusRoot) => fs.existsSync(path.join(
      corpusRoot,
      'corpuses',
      'ai-forecasting-economics-corpus.json',
    ));
    if (hasCanonicalCorpus(worktreeCorpus)) return worktreeCorpus;
    try {
      const commonGitDirectory = execFileSync('git', ['rev-parse', '--git-common-dir'], {
        cwd: packageRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      const repositoryRoot = path.dirname(path.resolve(packageRoot, commonGitDirectory));
      const sharedCorpus = path.join(repositoryRoot, 'ai-discourse-corpus');
      if (hasCanonicalCorpus(sharedCorpus)) return sharedCorpus;
    } catch {
      // The caller receives the ordinary missing-path error below.
    }
    return worktreeCorpus;
  })(),
  seedBankPath: path.resolve(packageRoot, 'data/question-bank.sample.json'),
  outputDirectory: path.resolve(packageRoot, 'banks/ai-futures/v0.1-candidate'),
});
