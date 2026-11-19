import { QUESTION_TYPES, normalizeAnswerValue } from '../../shared/questions/answerValue.mjs';
import {
  listCloudflareMetadataRows,
  readStoredCloudflarePayloadBytes,
  readStoredCloudflarePayloadsBulk,
} from './storageRouteExecution.js';
import { decryptPayloadWithStorageEnvelope } from './storageEnvelopeEncryption.js';
import { selectCanonicalStorageVersions } from './storageResourceOwnership.js';
import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { createResultsAnalysisScanBudget, jsonByteLength } from './storageScanBudget.js';
import { countAgentProposedQuestions, readAgentProposedQuestion } from './agent/agentQuestionProposals.mjs';
import { createAgentStorage } from './agent/storage.mjs';

const decoder = new TextDecoder();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const lower = (value) => trim(value).toLowerCase();
const parseJson = (bytes) => {
  try {
    return bytes ? JSON.parse(decoder.decode(bytes)) : null;
  } catch {
    return null;
  }
};

const refusal = (status, error, reason) => ({ ok: false, status, error, reason });

// The answers one upload carries: one answer, or a survey's bundled answers.
export const listUploadedAnswers = (payload) => (Array.isArray(payload?.responses) ? payload.responses : [payload])
  .filter(isObj)
  .map((item) => {
    const field = item.answer;
    return {
      rawQuestionId: trim(item.questionID || item.questionId),
      questionId: lower(item.questionID || item.questionId),
      value: isObj(field) ? field.value : field,
      encrypted: isObj(field) && field.encrypted === true,
    };
  });

const isBlank = (value) => value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
// Locked questions keep their type in the clear but mask what an answer is checked against.
const isMaskedQuestion = (question) => question.locked === true || question.promptEncrypted === true ||
  isObj(question.encryptedFields) || isObj(question.encryption);

// The session's questions from stored metadata alone: every id ever stored
// (hidden ones too) and each id's current version, chosen as readers choose it.
// An answer to a hidden question is still an answer to a question the session has.
const readQuestionVersions = async ({ env, index, slug }) => {
  const budget = createResultsAnalysisScanBudget();
  const rows = await listCloudflareMetadataRows({ index, slug, resource: 'questions', budget, strict: true });
  const candidates = [];
  const untrusted = [];
  for (const { metadata } of rows) {
    const resourceId = lower(metadata.resourceId);
    if (!resourceId) {
      untrusted.push(metadata);
      continue;
    }
    candidates.push({
      resourceId,
      metadata,
      createdAtMs: Date.parse(trim(metadata.createdAt)) || 0,
      storageRefId: trim(metadata.id),
      uploader: trim(metadata.uploader),
      uploadAuthority: metadata.uploadAuthority,
    });
  }
  const current = new Map(selectCanonicalStorageVersions(candidates).map((candidate) => [candidate.resourceId, candidate]));
  // Every stored question counts, hidden ones too, so hiding a question
  // people have answered never shrinks what they may still save.
  return { current, untrusted, storedCount: current.size };
};

// A question the Worker encrypted at rest (its storage envelope) is read here
// like a plain one; one the client encrypted is not readable.
const readQuestionPayloads = async ({ env, config, index, slug, budget, metadataList, deps }) => {
  const readable = metadataList.filter((metadata) => metadata.payloadEncrypted !== true &&
    (metadata.encrypted !== true || isObj(metadata.envelope)));
  const bulk = await readStoredCloudflarePayloadsBulk({ env, index, slug, metadataList: readable, budget });
  const payloads = new Map();
  for (const metadata of readable) {
    const id = trim(metadata.id);
    let bytes = bulk.has(id) ? bulk.get(id) : await readStoredCloudflarePayloadBytes({ env, index, slug, metadata, budget });
    if (bytes && isObj(metadata.envelope)) {
      try {
        bytes = await decryptPayloadWithStorageEnvelope({
          env, config, slug, payloadId: id, ciphertextBytes: bytes, envelope: metadata.envelope, deps,
        });
      } catch {
        bytes = null;
      }
    }
    const payload = parseJson(bytes);
    if (isObj(payload)) payloads.set(id, payload);
  }
  return payloads;
};

// Every answer upload is checked against the session's questions, which
// reads each one's metadata: about 45 billed reads an answer. An isolate keeps
// the set it read for QUESTION_SET_TTL_MS, so a Submit's answers share a read.
// A question added since is never refused for it: an answer naming an id the
// set lacks reads it again first. Questions are hidden, never deleted, and
// hidden ones take answers anyway; one edited in that window is checked as
// the person's page showed it, and reports count only values its current
// version accepts. A question written through this isolate drops its copy.
export const QUESTION_SET_TTL_MS = 5_000;
// A Session Worker serves one session; a shared one keeps the latest few.
const MAX_CACHED_SESSIONS = 8;
// Question payloads one cached set keeps, counted as JSON.
const MAX_CACHED_PAYLOAD_BYTES = 2 * 1024 * 1024;
const questionSets = new WeakMap();

/** Drops this isolate's copy of a session's questions, after one is written here. */
export const forgetSessionQuestions = (index, slug) => {
  const sets = index && questionSets.get(index);
  for (const [key, state] of sets || []) {
    if (key.startsWith(`${sessionSlugStorageKey(slug)}\n`)) {
      state.generation += 1;
      state.cached = null;
    }
  }
};

// The session's question versions, with the payloads read from them so far
// (a version's payload never changes), and whether this call read them.
// Only finished reads are shared: on Cloudflare a request waiting on a read
// another request started can stall if that request is cancelled. Agents'
// proposed questions are kept elsewhere and counted fresh, so archiving one
// changes the limit at once.
const sessionQuestionSet = async ({ env, config, index, slug, fresh = false }) => {
  if (!index || typeof index !== 'object') return { set: await loadQuestionSet({ env, index, slug }), read: true };
  let sets = questionSets.get(index);
  if (!sets) questionSets.set(index, sets = new Map());
  // Keyed as storage keys are, so a slug's aliases share one set.
  const key = `${sessionSlugStorageKey(slug)}\n${trim(config?.sessionId)}`;
  // Most recently used last, so the busiest sessions stay.
  const state = sets.get(key) || { generation: 0, cached: null };
  sets.delete(key);
  sets.set(key, state);
  if (sets.size > MAX_CACHED_SESSIONS) sets.delete(sets.keys().next().value);
  if (!fresh && state.cached && Date.now() - state.cached.at < QUESTION_SET_TTL_MS) return { set: state.cached.set, read: false };
  const generation = state.generation;
  const startedAt = Date.now();
  const set = await loadQuestionSet({ env, index, slug });
  // A read that overlapped a question written here may predate it, and an
  // older read never replaces a newer one.
  if (state.generation === generation && !(state.cached && state.cached.at > startedAt)) state.cached = { at: startedAt, set };
  return { set, read: true };
};

const loadQuestionSet = async ({ env, index, slug }) =>
  ({ ...await readQuestionVersions({ env, index, slug }), payloads: new Map(), payloadBytes: 0 });

// The payloads of these question versions. Each one read is kept with the
// set, up to its byte cap; one that could not be read is asked for again.
const questionPayloadsOf = async ({ env, config, index, slug, set, metadataList, deps }) => {
  const found = new Map();
  const missing = [];
  for (const metadata of metadataList) {
    const id = trim(metadata.id);
    if (set.payloads.has(id)) found.set(id, set.payloads.get(id));
    else missing.push(metadata);
  }
  if (missing.length) {
    const read = await readQuestionPayloads({ env, config, index, slug, budget: createResultsAnalysisScanBudget(), metadataList: missing, deps });
    for (const [id, payload] of read) {
      found.set(id, payload);
      const bytes = jsonByteLength(payload);
      if (set.payloadBytes + bytes > MAX_CACHED_PAYLOAD_BYTES) continue;
      set.payloads.set(id, payload);
      set.payloadBytes += bytes;
    }
  }
  return found;
};

// Agents' proposed questions sit under the session's own agent prefix.
const agentKv = ({ env, config }) => {
  try {
    return createAgentStorage({ kv: env.GROUP_KV, sessionId: trim(config?.sessionId) });
  } catch {
    return null;
  }
};

const readProposedQuestion = async ({ env, config, slug, questionId }) => {
  const kv = agentKv({ env, config });
  return kv ? readAgentProposedQuestion({ AGENT_ACTION_KV: kv }, slug, questionId) : null;
};

const countProposedQuestions = async ({ env, config, slug }) => {
  const kv = agentKv({ env, config });
  return kv ? countAgentProposedQuestions({ AGENT_ACTION_KV: kv }, slug) : 0;
};

// The session's stored questions, its own and agents' proposed ones. Bounds
// how many rows one person may store.
export const countSessionQuestions = async ({ env, config, index, slug }) => {
  const { set } = await sessionQuestionSet({ env, config, index, slug });
  return set.storedCount + await countProposedQuestions({ env, config, slug });
};

/**
 * Checks each answer an upload carries against its stored question. Refuses
 * an unknown question id and a readable value its question does not accept;
 * encrypted values, blank answers (a comment alone) and locked or encrypted
 * questions are not checked. Returns the session's question count.
 */
const findAnsweredQuestions = async ({ env, config, index, slug, answers, set, deps }) => {
  const questions = new Map();
  const wanted = answers.map((answer) => set.current.get(answer.questionId)?.metadata).filter(Boolean);
  const wantedPayloads = await questionPayloadsOf({ env, config, index, slug, set, metadataList: wanted, deps });
  for (const answer of answers) {
    const candidate = set.current.get(answer.questionId);
    if (candidate) questions.set(answer.questionId, wantedPayloads.get(trim(candidate.metadata.id)) || null);
  }
  // Questions stored before uploads recorded their id name it only in the payload.
  if (answers.some((answer) => !questions.has(answer.questionId)) && set.untrusted.length) {
    for (const [, question] of await questionPayloadsOf({ env, config, index, slug, set, metadataList: set.untrusted, deps })) {
      const id = lower(question.id || question.questionId || question.questionID);
      if (id && !questions.has(id)) questions.set(id, question);
    }
  }
  return questions;
};

export const checkUploadedAnswers = async ({ env, config, index, slug, payload, deps }) => {
  const answers = listUploadedAnswers(payload);
  const first = await sessionQuestionSet({ env, config, index, slug });
  let { set } = first;
  let questions = await findAnsweredQuestions({ env, config, index, slug, answers, set, deps });
  // Questions agents propose are kept apart, under their exact id.
  const findProposed = async () => {
    for (const answer of answers) {
      if (questions.has(answer.questionId) || !answer.rawQuestionId.startsWith('ceq_')) continue;
      const proposed = await readProposedQuestion({ env, config, slug, questionId: answer.rawQuestionId });
      if (proposed) questions.set(answer.questionId, proposed);
    }
  };
  await findProposed();
  // A question added since a kept set was read: read it again before refusing.
  if (!first.read && answers.some((answer) => !questions.has(answer.questionId))) {
    ({ set } = await sessionQuestionSet({ env, config, index, slug, fresh: true }));
    questions = await findAnsweredQuestions({ env, config, index, slug, answers, set, deps });
    await findProposed();
  }
  for (const answer of answers) {
    if (!questions.has(answer.questionId)) {
      return refusal(422, 'This answer is for a question this session does not have. Reload the session and try again.', 'response_question_unknown');
    }
    const question = questions.get(answer.questionId);
    const type = question && trim(question.type || question.questionType);
    if (!QUESTION_TYPES.includes(type) || answer.encrypted || isBlank(answer.value) || isMaskedQuestion(question)) continue;
    // The stored-answer size cap bounds freeform text here, not the agents' shorter limit.
    const checked = normalizeAnswerValue({ ...question, type }, answer.value, { maxFreeformLength: Infinity });
    if (!checked.ok) return refusal(422, `This answer can't be saved: ${checked.error}`, 'response_answer_invalid');
  }
  return { ok: true, questionCount: set.storedCount + await countProposedQuestions({ env, config, slug }) };
};
