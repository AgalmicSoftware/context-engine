import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HARNESS_VERSION,
  QUESTION_PROMPT_TEMPLATE_VERSION,
} from './config.mjs';

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
};

export const stableStringify = (value) => JSON.stringify(canonicalize(value));

export const sha256 = (value) => createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : String(value ?? ''))
  .digest('hex');

export const hashJson = (value) => sha256(stableStringify(value));

export const detectHarnessCommit = () => {
  try {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const packageStatus = execFileSync('git', ['status', '--porcelain', '--', '.'], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (packageStatus) return null;
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

export const buildRunManifest = ({
  questionBank,
  modelRoster,
  mode,
  persona = null,
  providerOverride = '',
  repeats,
  concurrency,
  maxAttempts,
  scheduleSeed,
  startedAt,
  promptTemplateHash = '',
  requestContract = null,
  harnessCommit = process.env.AIDB_HARNESS_COMMIT || detectHarnessCommit(),
}) => ({
  schemaVersion: 1,
  kind: 'ai_discourse_bench_run_manifest',
  harnessVersion: HARNESS_VERSION,
  harnessCommit,
  benchmarkId: questionBank.benchmarkId,
  questionBankHash: hashJson(questionBank),
  modelRosterHash: hashJson(modelRoster),
  promptTemplateVersion: QUESTION_PROMPT_TEMPLATE_VERSION,
  promptTemplateHash: promptTemplateHash || sha256(QUESTION_PROMPT_TEMPLATE_VERSION),
  requestContract,
  mode,
  personaId: persona?.id || null,
  personaProfileHash: persona ? hashJson(persona) : null,
  personaProfile: persona ? {
    id: persona.id,
    label: persona.label,
    publicFigure: persona.publicFigure,
    profileType: persona.profileType,
    evaluationClaim: persona.evaluationClaim,
  } : null,
  providerOverride: providerOverride || null,
  repeats,
  polarities: ['canonical', 'reversed'],
  concurrency,
  maxAttempts,
  scheduleSeed,
  startedAt,
  models: (modelRoster.models || []).map((model) => ({
    id: model.id,
    model: model.model,
    provider: providerOverride || model.provider,
    temperature: model.temperature ?? 0.2,
    maxTokens: model.maxTokens ?? 220,
    timeoutMs: model.timeoutMs ?? null,
    structuredOutput: model.structuredOutput || 'auto',
    providerRouting: model.providerRouting || null,
    provenance: model.provenance || {},
    pricing: model.pricing || null,
    traits: model.traits || {},
  })),
});

export const buildReportFingerprint = (report = {}) => hashJson({
  benchmarkId: report.benchmarkId || null,
  generatedAt: report.generatedAt || null,
  mode: report.mode || 'self',
  personaId: report.personaId || null,
  counts: report.counts || {},
  questions: report.questions || [],
  participants: report.participants || [],
  polisReport: report.polisReport || {},
  participantGraph: report.participantGraph || {},
  statistics: report.statistics || {},
  importance: report.importance || {},
  debateAtlas: report.debateAtlas || {},
  riskMatrix: report.riskMatrix || {},
  rawMaterial: report.rawMaterial || {},
  integrity: report.integrity || {},
});

export const hashReleaseReportContent = (report = {}) => {
  const { releaseValidationReceipt: _receipt, ...content } = report;
  return hashJson(content);
};

export const hashRunResumeContract = (manifest = {}) => hashJson({
  harnessVersion: manifest.harnessVersion || null,
  harnessCommit: manifest.harnessCommit || null,
  benchmarkId: manifest.benchmarkId || null,
  questionBankHash: manifest.questionBankHash || null,
  modelRosterHash: manifest.modelRosterHash || null,
  promptTemplateVersion: manifest.promptTemplateVersion || null,
  promptTemplateHash: manifest.promptTemplateHash || null,
  requestContract: manifest.requestContract || null,
  mode: manifest.mode || 'self',
  personaId: manifest.personaId || null,
  personaProfileHash: manifest.personaProfileHash || null,
  providerOverride: manifest.providerOverride || null,
  repeats: manifest.repeats || null,
  polarities: manifest.polarities || [],
  maxAttempts: manifest.maxAttempts || null,
  scheduleSeed: manifest.scheduleSeed || null,
  models: manifest.models || [],
});

export const buildReleaseValidationReceipt = ({
  report,
  questionBank,
  modelRoster,
  runsFiles = [],
  importanceFiles = [],
  validatedAt = new Date().toISOString(),
}) => ({
  schemaVersion: 1,
  kind: 'ai_discourse_bench_release_validation_receipt',
  validatedAt,
  reportContentHash: hashReleaseReportContent(report),
  questionBankHash: hashJson(questionBank),
  modelRosterHash: hashJson(modelRoster),
  runManifestHashes: runsFiles.map((file) => hashJson(file?.manifest || null)),
  importanceManifestHashes: importanceFiles.map((file) => hashJson(file?.manifest || null)),
  checks: [
    'validated-question-bank',
    'release-run-provenance',
    'raw-answer-normalization',
    'complete-repeat-coverage',
    ...(importanceFiles.length ? ['release-importance-provenance'] : []),
  ],
});

export const validateReleaseValidationReceipt = (report = {}) => {
  const receipt = report.releaseValidationReceipt;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return ['releaseValidationReceipt must be present for official publication'];
  }
  const errors = [];
  if (receipt.kind !== 'ai_discourse_bench_release_validation_receipt') {
    errors.push('releaseValidationReceipt.kind is invalid');
  }
  if (!/^[a-f0-9]{64}$/i.test(String(receipt.reportContentHash || ''))) {
    errors.push('releaseValidationReceipt.reportContentHash must be a SHA-256 hex digest');
  } else if (receipt.reportContentHash !== hashReleaseReportContent(report)) {
    errors.push('releaseValidationReceipt.reportContentHash does not match the report');
  }
  for (const field of ['questionBankHash', 'modelRosterHash']) {
    if (!/^[a-f0-9]{64}$/i.test(String(receipt[field] || ''))) {
      errors.push(`releaseValidationReceipt.${field} must be a SHA-256 hex digest`);
    }
  }
  if (!Array.isArray(receipt.runManifestHashes) || receipt.runManifestHashes.length === 0) {
    errors.push('releaseValidationReceipt.runManifestHashes must include at least one manifest');
  }
  return errors;
};
