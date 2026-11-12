import { QUESTION_TYPES, normalizeAnswerValue } from '../../shared/questions/answerValue.mjs';
import {
  listCloudflareMetadataRows,
  readStoredCloudflarePayloadBytes,
  readStoredCloudflarePayloadsBulk,
} from './storageRouteExecution.js';
import { decryptPayloadWithStorageEnvelope } from './storageEnvelopeEncryption.js';
import { selectCanonicalStorageVersions } from './storageResourceOwnership.js';
import { createResultsAnalysisScanBudget } from './storageScanBudget.js';
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
  return { budget, current, untrusted, storedCount: current.size };
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
export const countSessionQuestions = async ({ env, config, index, slug }) =>
  (await readQuestionVersions({ env, index, slug })).storedCount + await countProposedQuestions({ env, config, slug });

/**
 * Checks each answer an upload carries against its stored question. Refuses
 * an unknown question id and a readable value its question does not accept;
 * encrypted values, blank answers (a comment alone) and locked or encrypted
 * questions are not checked. Returns the session's question count.
 */
export const checkUploadedAnswers = async ({ env, config, index, slug, payload, deps }) => {
  const answers = listUploadedAnswers(payload);
  const { budget, current, untrusted, storedCount } = await readQuestionVersions({ env, index, slug });
  const questions = new Map();
  const wanted = answers.map((answer) => current.get(answer.questionId)?.metadata).filter(Boolean);
  const wantedPayloads = await readQuestionPayloads({ env, config, index, slug, budget, metadataList: wanted, deps });
  for (const answer of answers) {
    const candidate = current.get(answer.questionId);
    if (candidate) questions.set(answer.questionId, wantedPayloads.get(trim(candidate.metadata.id)) || null);
  }
  // Questions stored before uploads recorded their id name it only in the payload.
  if (answers.some((answer) => !questions.has(answer.questionId)) && untrusted.length) {
    for (const [, question] of await readQuestionPayloads({ env, config, index, slug, budget, metadataList: untrusted, deps })) {
      const id = lower(question.id || question.questionId || question.questionID);
      if (id && !questions.has(id)) questions.set(id, question);
    }
  }
  // Questions agents propose are kept apart, under their exact id.
  for (const answer of answers) {
    if (questions.has(answer.questionId) || !answer.rawQuestionId.startsWith('ceq_')) continue;
    const proposed = await readProposedQuestion({ env, config, slug, questionId: answer.rawQuestionId });
    if (proposed) questions.set(answer.questionId, proposed);
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
  return { ok: true, questionCount: storedCount + await countProposedQuestions({ env, config, slug }) };
};
