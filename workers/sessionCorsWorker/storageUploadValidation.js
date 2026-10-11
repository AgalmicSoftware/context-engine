import { UPLOAD_TOO_LARGE_ERROR } from './uploadSizeLimits.js';

const KIB = 1024;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

// Questions, surveys, and responses are small JSON records that every reader
// downloads, so they get bounded caps. Documents, media, and images keep the
// deployment-wide CE_MAX_UPLOAD_BYTES limit.
export const STORAGE_RESOURCE_MAX_BYTES = Object.freeze({
  questions: 128 * KIB,
  surveys: 256 * KIB,
  // A survey submission bundles every changed answer, so it gets more room
  // than one answer; each bundled answer still has the per-answer cap.
  responses: 2 * 1024 * KIB,
});
// One answer, including its encrypted field envelopes and padding. The
// client's largest answers are free text plus a comment, each in a 128-byte
// padded envelope with a few recipients.
export const MAX_RESPONSE_ITEM_BYTES = 64 * KIB;

// Question ids are keccak hashes and survey ids sha256 hashes (0x + 64 hex);
// this also admits short fixture ids while keeping index keys bounded.
const RESOURCE_ID_RE = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const jsonBytes = (value) => encoder.encode(JSON.stringify(value)).byteLength;

const invalid = (resource, detail) => ({ ok: false, status: 400, error: `Invalid ${resource} payload: ${detail}.` });

// Mirrors the client's hydration key: questions use id, questionId, or
// questionID; surveys use surveyID or id.
export const readStoragePayloadResourceId = (resource, payload) => {
  const raw = resource === 'questions'
    ? (payload?.id || payload?.questionId || payload?.questionID)
    : (payload?.surveyID || payload?.id);
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
};

const validateResponseItem = (item, label) => {
  if (!isObj(item) || !isText(item.questionID || item.questionId)) {
    return invalid('responses', `${label} needs a questionID`);
  }
  if (jsonBytes(item) > MAX_RESPONSE_ITEM_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `${UPLOAD_TOO_LARGE_ERROR} Each answer may use at most ${MAX_RESPONSE_ITEM_BYTES} bytes.`,
    };
  }
  return null;
};

// Size and basic shape checks for the JSON records readers depend on. Returns
// the parsed payload and its resource id so callers do not parse twice.
export const validateStorageUploadPayload = ({ resource, bytes, payloadEncrypted = false } = {}) => {
  const maxBytes = STORAGE_RESOURCE_MAX_BYTES[resource];
  if (!maxBytes) return { ok: true };
  if (Number(bytes?.byteLength || 0) > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `${UPLOAD_TOO_LARGE_ERROR} Maximum allowed ${resource} upload is ${maxBytes} bytes.`,
    };
  }
  if (payloadEncrypted) {
    // Client-encrypted answers are opaque here; questions and surveys must
    // stay readable so the Worker can check who owns their id.
    return resource === 'responses' ? { ok: true } : invalid(resource, 'expected plaintext JSON');
  }

  let payload;
  try {
    payload = JSON.parse(decoder.decode(bytes || new Uint8Array()));
  } catch {
    return invalid(resource, 'expected JSON');
  }
  if (!isObj(payload)) return invalid(resource, 'expected a JSON object');

  if (resource === 'responses') {
    if (payload.responses !== undefined) {
      if (!Array.isArray(payload.responses) || !payload.responses.length) {
        return invalid(resource, 'responses must be a non-empty array');
      }
      for (const [index, item] of payload.responses.entries()) {
        const failure = validateResponseItem(item, `responses[${index}]`);
        if (failure) return failure;
      }
      return { ok: true, payload };
    }
    return validateResponseItem(payload, 'an answer') || { ok: true, payload };
  }

  const resourceId = readStoragePayloadResourceId(resource, payload);
  if (!RESOURCE_ID_RE.test(resourceId)) {
    return invalid(resource, 'expected a string id of up to 128 letters, digits, or ._:- characters');
  }
  if (resource === 'questions') {
    if (!isText(payload.type)) return invalid(resource, 'expected a string type');
    if (payload.prompt != null && typeof payload.prompt !== 'string') {
      return invalid(resource, 'expected a string prompt');
    }
    if (payload.options != null && !Array.isArray(payload.options)) {
      return invalid(resource, 'expected an options array');
    }
  } else {
    if (typeof payload.title !== 'string') return invalid(resource, 'expected a string title');
    if (payload.questionIDs != null && (
      !Array.isArray(payload.questionIDs) || payload.questionIDs.some((id) => typeof id !== 'string')
    )) {
      return invalid(resource, 'expected questionIDs to be a list of strings');
    }
  }
  return { ok: true, payload, resourceId };
};
