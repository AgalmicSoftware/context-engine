import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeSecureFile } from './keyEncryption.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_SLUG_RE = /^[a-z0-9_-]+$/i;

const getDataDir = () => resolve(process.env.CE_CC_DATA_DIR || resolve(__dirname, '..', '.data'));
const getConfirmedSubmissionsDir = () => resolve(getDataDir(), 'confirmed-submissions');

const normalizeAddressLower = (value) => String(value || '').trim().toLowerCase();
const normalizeQuestionId = (value) => String(value || '').trim().toLowerCase();

const sanitizePathSegment = (value) => (
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
);

const normalizeSessionSlug = (value) => {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug || !SESSION_SLUG_RE.test(slug)) return '';
  return slug;
};

const buildEmptyIndex = ({ slug = '', walletAddress = '' } = {}) => ({
  session: normalizeSessionSlug(slug),
  wallet: normalizeAddressLower(walletAddress),
  updatedAt: null,
  questions: {},
});

const getIndexFilePath = (slug, walletAddress) => {
  const normalizedSlug = normalizeSessionSlug(slug);
  const normalizedWallet = normalizeAddressLower(walletAddress);
  if (!normalizedSlug || !normalizedWallet) return '';
  return resolve(
    getConfirmedSubmissionsDir(),
    sanitizePathSegment(normalizedSlug),
    `${sanitizePathSegment(normalizedWallet)}.json`
  );
};

export function loadConfirmedSubmissionIndex(slug, walletAddress) {
  const file = getIndexFilePath(slug, walletAddress);
  const base = buildEmptyIndex({ slug, walletAddress });
  if (!file || !existsSync(file)) return base;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const questions = (parsed?.questions && typeof parsed.questions === 'object') ? parsed.questions : {};
    return {
      session: base.session,
      wallet: base.wallet,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
      questions,
    };
  } catch {
    return base;
  }
}

export function getConfirmedSubmittedQuestionIds(slug, opts = {}) {
  const normalizedSlug = normalizeSessionSlug(slug);
  if (!normalizedSlug) return new Set();
  const requestedWallet = normalizeAddressLower(opts.walletAddress || opts.respondent || '');

  const collectFromIndex = (index) => {
    const out = new Set();
    const questions = (index?.questions && typeof index.questions === 'object') ? index.questions : {};
    Object.keys(questions).forEach((key) => {
      const qid = normalizeQuestionId(key);
      if (qid) out.add(qid);
    });
    return out;
  };

  if (requestedWallet) {
    return collectFromIndex(loadConfirmedSubmissionIndex(normalizedSlug, requestedWallet));
  }

  const dir = resolve(getConfirmedSubmissionsDir(), sanitizePathSegment(normalizedSlug));
  if (!existsSync(dir)) return new Set();
  const aggregate = new Set();
  readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .forEach((file) => {
      try {
        const parsed = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
        collectFromIndex(parsed).forEach((qid) => aggregate.add(qid));
      } catch {
        // Ignore malformed entries; answered state is best-effort.
      }
    });
  return aggregate;
}

export function recordConfirmedSubmission({
  slug = '',
  walletAddress = '',
  txHash = null,
  blockNumber = null,
  questionIds = [],
  arweaveTxIds = [],
  submittedAt = new Date().toISOString(),
  surveyId = null,
  surveyArweaveTxId = null,
} = {}) {
  const normalizedSlug = normalizeSessionSlug(slug);
  const normalizedWallet = normalizeAddressLower(walletAddress);
  if (!normalizedSlug || !normalizedWallet) return false;

  const normalizedQuestionIds = Array.isArray(questionIds)
    ? questionIds.map((value) => normalizeQuestionId(value)).filter(Boolean)
    : [];
  if (normalizedQuestionIds.length === 0) return false;

  const file = getIndexFilePath(normalizedSlug, normalizedWallet);
  if (!file) return false;
  const next = loadConfirmedSubmissionIndex(normalizedSlug, normalizedWallet);
  const safeSubmittedAt = typeof submittedAt === 'string' && submittedAt.trim()
    ? submittedAt
    : new Date().toISOString();
  const safeTxHash = String(txHash || '').trim() || null;
  const safeSurveyId = String(surveyId || '').trim() || null;
  const safeSurveyArweaveTxId = String(surveyArweaveTxId || '').trim() || null;
  const safeBlockNumber = Number.isFinite(Number(blockNumber)) ? Number(blockNumber) : null;

  normalizedQuestionIds.forEach((questionId, index) => {
    const existing = (next.questions[questionId] && typeof next.questions[questionId] === 'object')
      ? next.questions[questionId]
      : {};
    const arweaveTxId = Array.isArray(arweaveTxIds)
      ? String(arweaveTxIds[index] || '').trim() || null
      : null;
    next.questions[questionId] = {
      questionId,
      wallet: normalizedWallet,
      submittedAt: safeSubmittedAt,
      ...(safeTxHash ? { txHash: safeTxHash } : {}),
      ...(safeBlockNumber != null ? { blockNumber: safeBlockNumber } : {}),
      ...(safeSurveyId ? { surveyId: safeSurveyId } : {}),
      ...(safeSurveyArweaveTxId ? { surveyArweaveTxId: safeSurveyArweaveTxId } : {}),
      ...(arweaveTxId ? { arweaveTxId } : {}),
      ...existing,
    };
    next.questions[questionId] = {
      ...next.questions[questionId],
      questionId,
      wallet: normalizedWallet,
      submittedAt: safeSubmittedAt,
      ...(safeTxHash ? { txHash: safeTxHash } : {}),
      ...(safeBlockNumber != null ? { blockNumber: safeBlockNumber } : {}),
      ...(safeSurveyId ? { surveyId: safeSurveyId } : {}),
      ...(safeSurveyArweaveTxId ? { surveyArweaveTxId: safeSurveyArweaveTxId } : {}),
      ...(arweaveTxId ? { arweaveTxId } : {}),
    };
  });

  next.updatedAt = safeSubmittedAt;
  mkdirSync(dirname(file), { recursive: true });
  writeSecureFile(file, JSON.stringify(next, null, 2));
  return true;
}

export const __test__submissionState = {
  normalizeSessionSlug,
  normalizeAddressLower,
  normalizeQuestionId,
  buildEmptyIndex,
  getIndexFilePath,
};
