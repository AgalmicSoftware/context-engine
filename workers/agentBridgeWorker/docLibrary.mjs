import {
  AGENT_BRIDGE_WORKER_VERSION,
  DOC_VISIBILITY,
  SESSION_STORAGE_PROFILES,
  SUPPORTED_DOC_TYPES,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape, sanitizeForGroup } from './redaction.mjs';

const VISIBILITY_SET = new Set(Object.values(DOC_VISIBILITY));
const TYPE_SET = new Set(SUPPORTED_DOC_TYPES);

function safeString(value) {
  return String(value || '').trim();
}

function normalizeSessionStorageProfile(value = SESSION_STORAGE_PROFILES.ARWEAVE) {
  return safeString(value).toLowerCase() === SESSION_STORAGE_PROFILES.CLOUDFLARE
    ? SESSION_STORAGE_PROFILES.CLOUDFLARE
    : SESSION_STORAGE_PROFILES.ARWEAVE;
}

function fileExtension(value = '') {
  const clean = safeString(value).toLowerCase();
  const last = clean.split('?')[0].split('#')[0].split('.').pop();
  return last || '';
}

export function normalizeDocFileType(input = {}) {
  const raw = safeString(input.fileType || input.type || input.mimeType || fileExtension(input.name || input.title || input.objectKey));
  const normalized = raw.includes('/') ? raw.split('/').pop().replace('jpeg', 'jpg') : raw.replace(/^\./, '');
  const extension = normalized === 'markdown' ? 'md' : normalized;
  if (extension === 'jpg' && raw.includes('jpeg')) return 'jpeg';
  return TYPE_SET.has(extension) ? extension : '';
}

export function normalizeDocumentRecord(input = {}) {
  const fileType = normalizeDocFileType(input);
  if (!fileType) {
    return {
      ok: false,
      reason: 'unsupported_doc_type',
      supportedTypes: SUPPORTED_DOC_TYPES,
    };
  }
  const visibility = VISIBILITY_SET.has(input.visibility) ? input.visibility : DOC_VISIBILITY.SESSION;
  const storageProfile = normalizeSessionStorageProfile(input.storageProfile || input.storageBackend);
  const record = {
    type: 'agent_bridge_document_record',
    version: AGENT_BRIDGE_WORKER_VERSION,
    docId: safeString(input.docId || input.id || buildOpaqueActionId(input.objectKey || input.title || fileType)),
    sessionSlug: safeString(input.sessionSlug || input.session),
    title: safeString(input.title || input.name) || 'Untitled document',
    fileType,
    visibility,
    storageProfile,
    r2: {
      bucket: safeString(input.r2?.bucket || input.bucket) || null,
      objectKey: safeString(input.r2?.objectKey || input.objectKey) || null,
      byteLength: Number.isFinite(Number(input.r2?.byteLength ?? input.byteLength))
        ? Number(input.r2?.byteLength ?? input.byteLength)
        : null,
    },
    d1: {
      recordId: safeString(input.d1?.recordId || input.recordId) || null,
      indexStatus: safeString(input.d1?.indexStatus || input.indexStatus || 'not_indexed'),
    },
    kv: {
      shortLivedActionPrefix: 'doc_action:',
      storesBytes: false,
    },
    contentPreview: visibility === DOC_VISIBILITY.PUBLIC ? safeString(input.contentPreview || input.summary) : null,
    externalUrl: safeString(input.externalUrl || input.url) || null,
    privateContentRef: safeString(input.privateContentRef || input.contentRef) || null,
    createdAt: input.createdAt || null,
  };
  assertNoSecretShape(record, 'Document records must not serialize secrets.');
  return { ok: true, record };
}

export function listDocumentsForSession(docs = [], {
  sessionSlug = '',
  includeGated = true,
} = {}) {
  const normalized = [];
  for (const doc of Array.isArray(docs) ? docs : []) {
    const result = normalizeDocumentRecord(doc);
    if (!result.ok) continue;
    if (sessionSlug && result.record.sessionSlug !== sessionSlug) continue;
    if (!includeGated && result.record.visibility === DOC_VISIBILITY.SBT_GATED) continue;
    normalized.push(result.record);
  }
  return {
    type: 'agent_bridge_doc_list',
    version: AGENT_BRIDGE_WORKER_VERSION,
    sessionSlug,
    buttonLabel: 'Attachments',
    docs: normalized,
    count: normalized.length,
  };
}

export function summarizeDocumentForGroup(doc = {}) {
  const result = normalizeDocumentRecord(doc);
  if (!result.ok) return result;
  const { record } = result;
  return {
    ok: true,
    summary: sanitizeForGroup({
      type: 'telegram_group_doc_summary',
      docId: record.docId,
      sessionSlug: record.sessionSlug,
      docTitle: record.title,
      fileType: record.fileType,
      visibility: record.visibility,
      storageProfile: record.storageProfile,
      indexStatus: record.d1.indexStatus,
      contentPreview: record.visibility === DOC_VISIBILITY.PUBLIC ? record.contentPreview : null,
      gatedContentHidden: record.visibility !== DOC_VISIBILITY.PUBLIC,
    }),
  };
}

export function createDocSelectionAction({
  sessionSlug = '',
  docIds = [],
  createdAt = null,
} = {}) {
  const selectedDocIds = [...new Set((Array.isArray(docIds) ? docIds : [])
    .map(safeString)
    .filter(Boolean))];
  return {
    type: 'agent_bridge_doc_selection',
    version: AGENT_BRIDGE_WORKER_VERSION,
    actionId: buildOpaqueActionId(`select_docs|${sessionSlug}|${selectedDocIds.join('|')}`),
    action: TELEGRAM_BRIDGE_ACTIONS.SELECT_DOCS,
    targetLane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    sessionSlug: safeString(sessionSlug),
    selectedDocIds,
    selectionUses: ['generate_questions_input', 'answer_context_candidate'],
    nextActions: [
      {
        action: TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION,
        label: 'Generate Questions',
        requiresSelectedDocs: true,
      },
      {
        action: TELEGRAM_BRIDGE_ACTIONS.USE_DOCS_AS_ANSWER_CONTEXT,
        label: 'Use as Answer Context',
        status: 'deferred_contract_only',
      },
    ],
    createdAt,
  };
}

export function createQuestionGenerationRequestFromDocs({
  sessionSlug = '',
  docs = [],
  selectedDocIds = [],
  policy = {},
  createdAt = null,
} = {}) {
  if (policy.allowQuestionGeneration !== true) {
    return { ok: false, reason: 'question_generation_not_allowed' };
  }
  const selected = new Set(selectedDocIds);
  const normalizedDocs = listDocumentsForSession(docs, { sessionSlug }).docs
    .filter((doc) => selected.has(doc.docId));
  if (!normalizedDocs.length) {
    return {
      ok: false,
      reason: 'selected_docs_required',
      prompt: 'Select or upload attachments before generating questions.',
    };
  }
  const request = {
    type: 'agent_bridge_question_generation_request',
    version: AGENT_BRIDGE_WORKER_VERSION,
    requestId: buildOpaqueActionId(`generate_questions|${sessionSlug}|${normalizedDocs.map((doc) => doc.docId).join('|')}`),
    action: TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION,
    sessionSlug: safeString(sessionSlug),
    selectedDocIds: normalizedDocs.map((doc) => doc.docId),
    selectedDocTypes: [...new Set(normalizedDocs.map((doc) => doc.fileType))],
    visibility: [...new Set(normalizedDocs.map((doc) => doc.visibility))],
    requestContext: {
      source: 'selected_docs',
      use: 'generate_questions_input',
      selectedDocIds: normalizedDocs.map((doc) => doc.docId),
    },
    answerContext: {
      status: 'eligible_later',
      action: TELEGRAM_BRIDGE_ACTIONS.USE_DOCS_AS_ANSWER_CONTEXT,
      selectedDocIds: normalizedDocs.map((doc) => doc.docId),
    },
    status: 'mocked_contract_only',
    aiRoute: policy.safeAiRoute || null,
    createdAt,
  };
  assertNoSecretShape(request, 'Question-generation requests must not serialize secrets.');
  return { ok: true, request };
}

export function buildDocumentStorageAccessRequest({
  sessionSlug = '',
  doc = {},
  account = {},
  operation = 'read_snippet',
  payloadEncrypted = false,
  createdAt = null,
} = {}) {
  const normalized = normalizeDocumentRecord(doc);
  if (!normalized.ok) return normalized;
  const { record } = normalized;
  const cloudflareBacked = record.storageProfile === SESSION_STORAGE_PROFILES.CLOUDFLARE;
  const request = {
    type: 'agent_bridge_document_storage_access_request',
    version: AGENT_BRIDGE_WORKER_VERSION,
    requestId: buildOpaqueActionId(`doc_access|${record.sessionSlug || sessionSlug}|${record.docId}|${operation}`),
    sessionSlug: safeString(sessionSlug || record.sessionSlug),
    docId: record.docId,
    operation: safeString(operation) || 'read_snippet',
    storageProfile: record.storageProfile,
    visibility: record.visibility,
    sbtGated: record.visibility === DOC_VISIBILITY.SBT_GATED,
    litRequired: payloadEncrypted === true,
    gateAuthority: cloudflareBacked
      ? 'session_worker_sbt_gate'
      : 'canonical_agent_decrypt_or_arweave_read',
    canonicalApiRequest: {
      method: 'POST',
      path: cloudflareBacked
        ? '/api/agent/session-storage/access-request'
        : '/api/agent/decrypt/request',
      status: 'planned_contract_only',
      body: {
        session: safeString(sessionSlug || record.sessionSlug),
        docId: record.docId,
        operation: safeString(operation) || 'read_snippet',
        accountAddress: safeString(account.accountAddress || account.address) || null,
        storageProfile: record.storageProfile,
        payloadEncrypted: payloadEncrypted === true,
      },
    },
    exposesCloudflareCredential: false,
    exposesBucketName: false,
    exposesRawStoragePath: false,
    exposesLongLivedUrl: false,
    createdAt,
  };
  assertNoSecretShape(request, 'Document storage access requests must not serialize secrets.');
  return { ok: true, request };
}
