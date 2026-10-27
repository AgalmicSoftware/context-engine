import { normalizeAgentRatingScale } from './ratingScale.mjs';
import { normalizeRatingScale } from '../../../shared/questions/ratingScale.mjs';
import { safeString, lower } from './runtimePrimitives.mjs';
import { DEFAULT_RPC_TIMEOUT_MS, QUESTION_PAYLOAD_SKIP, STORAGE_BACKENDS, SELECTORS, ZERO_BYTES32, storageRefForPointer, normalizeHexAddress, normalizeBytes32, strip0x, hexToBase64url } from './registryQuestionCore.mjs';
import { ethCall, fetchArweaveJson, fetchCloudflareStorageJson } from './registryQuestionSource.mjs';

export function normalizeQuestionVisibility(payload = {}) {
  const raw = lower(payload.visibility || payload.access || payload.questionVisibility);
  if (['private', 'sbt_gated', 'lit_encrypted'].includes(raw)) return raw;
  if (payload.private === true || payload.isPrivate === true) return 'private';
  if (payload.sbtGated === true || payload.gated === true) return 'sbt_gated';
  const encryption = payload.encryption && typeof payload.encryption === 'object' && !Array.isArray(payload.encryption)
    ? payload.encryption
    : null;
  const hasEncryptedField =
    payload.litEncrypted === true ||
    payload.encrypted === true ||
    payload.promptEncrypted ||
    payload.optionsEncrypted ||
    payload.tagsEncrypted;
  const encryptionGateCandidates = [
    ...(Array.isArray(encryption?.gates) ? encryption.gates : []),
    encryption?.gate,
    {
      sbtAddress: encryption?.sbtAddress,
      sbtAddresses: encryption?.sbtAddresses,
    },
  ].filter(Boolean);
  const hasEncryptionGate = encryptionGateCandidates
    .some((gate, index) => normalizeQuestionGate(gate, index));
  if (hasEncryptedField || hasEncryptionGate) {
    return 'lit_encrypted';
  }
  return 'public';
}

export function normalizeGateMode(value = '') {
  const mode = lower(value);
  return mode === 'all' ? 'all' : 'any';
}

export function normalizeSbtAddresses(values = []) {
  const raw = Array.isArray(values) ? values : [values];
  const seen = new Set();
  const out = [];
  raw.forEach((value) => {
    const address = normalizeHexAddress(value);
    if (!address) return;
    const key = lower(address);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  });
  return out;
}

export function normalizeQuestionGate(gate = {}, index = 0) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return null;
  const sbtAddresses = normalizeSbtAddresses([
    ...(Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : []),
    ...(Array.isArray(gate.addresses) ? gate.addresses : []),
    gate.sbtAddress,
    gate.address,
  ]);
  if (!sbtAddresses.length) return null;
  const mode = normalizeGateMode(gate.mode || gate.gateMode || gate.operator);
  return {
    id: safeString(gate.gateId || gate.id || gate.resourceKey || `question-gate-${index}`),
    label: safeString(gate.label || gate.name || gate.title),
    resourceKey: safeString(gate.resourceKey || gate.resource || ''),
    mode,
    sbtAddress: sbtAddresses[0],
    sbtAddresses,
  };
}

export function normalizeQuestionEncryption(payload = {}, visibility = 'public') {
  const root = normalizeQuestionPayloadRoot(payload) || {};
  const encryption = root.encryption && typeof root.encryption === 'object' && !Array.isArray(root.encryption)
    ? root.encryption
      : payload.encryption && typeof payload.encryption === 'object' && !Array.isArray(payload.encryption)
          ? payload.encryption
        : {};
  const gateCandidates = [
    ...(Array.isArray(encryption.gates) ? encryption.gates : []),
    encryption.gate,
    ...(Array.isArray(root.gates) ? root.gates : []),
    root.gate,
    payload.gate,
  ].filter(Boolean);
  const gates = gateCandidates
    .map((gate, index) => normalizeQuestionGate(gate, index))
    .filter(Boolean);
  const sbtAddresses = normalizeSbtAddresses([
    ...gates.flatMap((gate) => gate.sbtAddresses || []),
    ...(Array.isArray(encryption.sbtAddresses) ? encryption.sbtAddresses : []),
    ...(Array.isArray(root.sbtAddresses) ? root.sbtAddresses : []),
    encryption.sbtAddress,
    root.sbtAddress,
  ]);
  const encrypted = visibility === 'lit_encrypted' ||
    visibility === 'sbt_gated' ||
    root.encrypted === true ||
    payload.encrypted === true ||
    Boolean(root.promptEncrypted || root.optionsEncrypted || root.tagsEncrypted);
  if (!encrypted && !sbtAddresses.length && !gates.length) return null;
  return {
    enabled: encrypted || gates.length > 0 || sbtAddresses.length > 0,
    encrypted,
    mode: normalizeGateMode(encryption.mode || encryption.gateMode || gates[0]?.mode),
    gates,
    sbtAddresses,
  };
}

export function normalizePayloadSessionSlug(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const sessionObject = payload.session && typeof payload.session === 'object' && !Array.isArray(payload.session)
    ? payload.session
    : {};
  for (const candidate of [
    payload.sessionSlug,
    payload.session_slug,
    payload.groupSlug,
    sessionObject.sessionSlug,
    sessionObject.slug,
    payload.session,
  ]) {
    if (typeof candidate !== 'string' && typeof candidate !== 'number') continue;
    const slug = lower(candidate).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
    if (slug) return slug;
  }
  return '';
}

export function allowUnscopedQuestionPayloads() { return false; }

export function skippedQuestionPayload(reason = 'session_mismatch') {
  return {
    [QUESTION_PAYLOAD_SKIP]: true,
    reason,
  };
}

export function isSkippedQuestionPayload(value = {}) {
  return value && typeof value === 'object' && value[QUESTION_PAYLOAD_SKIP] === true;
}

export function normalizeOptions(payload = {}) {
  const raw = payload.options || payload.answerOptions || payload.choices || payload.answers || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => safeString(typeof entry === 'object'
    ? entry.label || entry.text || entry.value || entry.title || entry.name
    : entry))
    .filter(Boolean)
    .slice(0, (payload.questionType || payload.type) === 'quadratic' ? Infinity : 20);
}

export function normalizeQuestionType(payload = {}, fallback = 'freeform') {
  const raw = lower(payload.questionType || payload.type || payload.kind || payload.responseType || 'freeform')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (['binary', 'boolean', 'yes_no', 'agree_disagree', 'agree_unsure_disagree'].includes(raw)) return 'binary';
  if (raw === 'quadratic') return 'quadratic';
  if (['rating', 'scale', 'linear_scale'].includes(raw)) return 'rating';
  if (
    ['multichoice', 'multi_choice', 'multiple_choice', 'multi_select', 'single_choice', 'single_select'].includes(raw)
  )
    return 'multichoice';
  return fallback;
}

export function normalizeQuestionPayloadRoot(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  for (const candidate of [
    payload,
    payload.question,
    payload.questionData,
    payload.metadata,
    payload.data,
  ]) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const hasQuestionShape = candidate.id || candidate.questionId || candidate.prompt || candidate.questionText || candidate.type || candidate.questionType;
      if (hasQuestionShape) return candidate;
    }
  }
  return payload;
}

export function normalizeQuestionPayload(payload = {}, {
  questionId = '',
  pointerId = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  sessionSlug = '',
  fallbackSessionSlug = '',
} = {}) {
  const root = normalizeQuestionPayloadRoot(payload);
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
  const id = normalizeBytes32(root.questionId || root.id || payload.questionId || payload.id) || normalizeBytes32(questionId);
  if (!id) return null;
  const visibility = normalizeQuestionVisibility(root);
  const encryption = normalizeQuestionEncryption(payload, visibility);
  const publicPrompt = visibility === 'public'
    ? safeString(root.questionText || root.prompt || root.title || payload.questionText || payload.prompt || payload.title)
    : '';
  const type = normalizeQuestionType(root);
  const sharedScale = type === 'rating' ? normalizeRatingScale(root) : null;
  const scale = sharedScale ? { ...sharedScale, step: normalizeAgentRatingScale(root).step } : null;
  const normalized = {
    questionId: id,
    id,
    questionType: type,
    type,
    ...(type === 'quadratic' ? { voiceCredits: root.voiceCredits ?? 99 } : {}),
    ...(scale ? { scale } : {}),
    prompt: publicPrompt,
    questionText: publicPrompt,
    title: publicPrompt || (visibility === 'public' ? 'Untitled question' : 'Locked question'),
    options: visibility === 'public' ? normalizeOptions(root) : [],
    singleSelect: root.singleSelect === true || root.singleChoice === true || root.oneSelectionOnly === true,
    visibility,
    ...(encryption?.encrypted === true ? { encrypted: true } : {}),
    ...(encryption?.sbtAddresses?.length ? { requiredSbtAddresses: encryption.sbtAddresses } : {}),
    ...(encryption?.mode ? { gateMode: encryption.mode } : {}),
    ...(encryption?.enabled === true
      ? {
          encryption: {
            enabled: true,
            encrypted: encryption.encrypted === true,
            mode: encryption.mode,
            gates: encryption.gates,
            sbtAddresses: encryption.sbtAddresses,
          },
        }
      : {}),
    source: 'live_session_question',
    sessionSlug: normalizePayloadSessionSlug(root) || normalizePayloadSessionSlug(payload) || lower(fallbackSessionSlug),
    ...(pointerBackend === STORAGE_BACKENDS.ARWEAVE ? { arweaveTxId: pointerId } : {}),
    storageRef: storageRefForPointer(pointerId, 'questions', pointerBackend),
  };
  return normalized;
}

export function lockedQuestionPlaceholder({
  questionId = '',
  pointerId = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  sessionSlug = '',
  reason = 'question_payload_unavailable',
} = {}) {
  const id = normalizeBytes32(questionId);
  if (!id) return null;
  return {
    questionId: id,
    id,
    questionType: 'unknown',
    prompt: '',
    questionText: '',
    title: 'Question unavailable',
    options: [],
    visibility: 'payload_unavailable',
    locked: false,
    payloadUnavailable: true,
    payloadUnavailableReason: safeString(reason) || 'question_payload_unavailable',
    source: 'live_session_question',
    sessionSlug: lower(sessionSlug),
    ...(pointerBackend === STORAGE_BACKENDS.ARWEAVE ? { arweaveTxId: pointerId } : {}),
    storageRef: storageRefForPointer(pointerId, 'questions', pointerBackend),
  };
}

export async function fetchQuestionPayload({
  rpcUrls = [],
  surveysAddress = '',
  questionId = '',
  session = {},
  sessionSlug = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  getCloudflareAuth = null,
  env = {},
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const id = normalizeBytes32(questionId);
  if (!id || !surveysAddress) return null;
  const hashResult = await ethCall({
    rpcUrls,
    to: surveysAddress,
    data: `${SELECTORS.getQuestionHash}${strip0x(id)}`,
    fetchImpl,
    timeoutMs,
  });
  if (!hashResult.ok) return null;
  const pointerBytes = normalizeBytes32(hashResult.result);
  if (!pointerBytes || pointerBytes === ZERO_BYTES32) return null;
  const pointerId = hexToBase64url(pointerBytes);
  if (!/^[a-zA-Z0-9_-]{43}$/.test(pointerId)) return null;
  const payload = pointerBackend === STORAGE_BACKENDS.CLOUDFLARE
    ? await fetchCloudflareStorageJson(pointerId, {
      env,
      session,
      getAuth: getCloudflareAuth,
      fetchImpl,
      timeoutMs,
    })
    : await fetchArweaveJson(pointerId, { fetchImpl, timeoutMs });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return lockedQuestionPlaceholder({ questionId: id, pointerId, pointerBackend, sessionSlug });
  }
  const payloadSessionSlug = normalizePayloadSessionSlug(payload);
  const requestedSessionSlug = lower(sessionSlug);
  if (payloadSessionSlug && requestedSessionSlug && payloadSessionSlug !== requestedSessionSlug) {
    return skippedQuestionPayload('session_mismatch');
  }
  const shouldStampUnscopedPayload = !payloadSessionSlug &&
    requestedSessionSlug &&
    allowUnscopedQuestionPayloads(env);
  if (!payloadSessionSlug && requestedSessionSlug && !shouldStampUnscopedPayload) {
    return skippedQuestionPayload('session_slug_missing');
  }
  return (
    normalizeQuestionPayload(payload, {
    questionId: id,
    pointerId,
    pointerBackend,
    sessionSlug,
    fallbackSessionSlug: shouldStampUnscopedPayload ? requestedSessionSlug : '',
    }) || lockedQuestionPlaceholder({ questionId: id, pointerId, pointerBackend, sessionSlug })
  );
}
