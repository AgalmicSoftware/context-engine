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

const detectHarnessCommit = () => {
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
  mode,
  personaId: persona?.id || null,
  personaProfileHash: persona ? hashJson(persona) : null,
  personaProfile: persona ? {
    id: persona.id,
    label: persona.label,
    asOf: persona.asOf,
    profileType: persona.profileType,
    evaluationClaim: persona.evaluationClaim,
    sources: persona.sources,
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
});
