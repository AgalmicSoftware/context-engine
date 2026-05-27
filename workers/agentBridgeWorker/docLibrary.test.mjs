import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOC_VISIBILITY,
  SUPPORTED_DOC_TYPES,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import {
  buildDocumentStorageAccessRequest,
  createDocSelectionAction,
  createQuestionGenerationRequestFromDocs,
  listDocumentsForSession,
  normalizeDocumentRecord,
  summarizeDocumentForGroup,
} from './docLibrary.mjs';

const DOCS = [
  {
    docId: 'doc-public-md',
    sessionSlug: 'alpha',
    title: 'Public notes',
    fileType: 'md',
    visibility: DOC_VISIBILITY.PUBLIC,
    storageProfile: 'cloudflare',
    contentPreview: 'Public summary only',
    privateContentRef: 'r2://private/public-notes.md',
  },
  {
    docId: 'doc-gated-pdf',
    sessionSlug: 'alpha',
    title: 'Gated brief',
    fileType: 'pdf',
    visibility: DOC_VISIBILITY.SBT_GATED,
    storageProfile: 'cloudflare',
    contentPreview: 'Private gated contents must not leak',
    privateContentRef: 'r2://private/gated.pdf',
  },
  {
    docId: 'doc-image',
    sessionSlug: 'beta',
    title: 'Image chart',
    fileType: 'png',
    visibility: DOC_VISIBILITY.SESSION,
  },
];

test('doc library lists supported docs by session and rejects unsupported types', () => {
  const listed = listDocumentsForSession(DOCS, { sessionSlug: 'alpha' });
  assert.equal(listed.count, 2);
  assert.equal(listed.buttonLabel, 'Attachments');
  assert.deepEqual([...SUPPORTED_DOC_TYPES], ['md', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'url']);

  assert.equal(normalizeDocumentRecord({
    title: 'Spreadsheet',
    fileType: 'xlsx',
  }).ok, false);
  assert.equal(normalizeDocumentRecord({
    title: 'Photo',
    mimeType: 'image/jpeg',
  }).record.fileType, 'jpeg');
  const urlDoc = normalizeDocumentRecord({
    title: 'External brief',
    fileType: 'url',
    externalUrl: 'https://example.com/brief',
  });
  assert.equal(urlDoc.record.fileType, 'url');
  assert.equal(urlDoc.record.externalUrl, 'https://example.com/brief');
  for (const fileType of SUPPORTED_DOC_TYPES) {
    assert.equal(normalizeDocumentRecord({
      title: `fixture.${fileType}`,
      fileType,
    }).record.fileType, fileType);
  }
});

test('selected docs create generate-question context without embedding bytes', () => {
  const selection = createDocSelectionAction({
    sessionSlug: 'alpha',
    docIds: ['doc-public-md', 'doc-gated-pdf', 'doc-public-md'],
  });
  const request = createQuestionGenerationRequestFromDocs({
    sessionSlug: 'alpha',
    docs: DOCS,
    selectedDocIds: selection.selectedDocIds,
    policy: {
      allowQuestionGeneration: true,
    },
  });

  assert.equal(selection.selectedDocIds.length, 2);
  assert.equal(selection.targetLane, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT);
  assert.deepEqual(selection.selectionUses, ['generate_questions_input', 'answer_context_candidate']);
  assert.deepEqual(selection.nextActions.map((entry) => entry.label), [
    'Generate Questions',
    'Use as Answer Context',
  ]);
  assert.equal(request.ok, true);
  assert.equal(request.request.status, 'mocked_contract_only');
  assert.equal(request.request.requestContext.use, 'generate_questions_input');
  assert.deepEqual(request.request.requestContext.selectedDocIds, ['doc-public-md', 'doc-gated-pdf']);
  assert.equal(request.request.answerContext.status, 'eligible_later');
  assert.equal(request.request.answerContext.action, TELEGRAM_BRIDGE_ACTIONS.USE_DOCS_AS_ANSWER_CONTEXT);
  assert.deepEqual(request.request.selectedDocTypes.sort(), ['md', 'pdf']);
  assert.deepEqual(request.request.visibility.sort(), ['public', 'sbt_gated']);
  assert.equal(JSON.stringify(request).includes('Private gated contents'), false);
  assert.equal(createQuestionGenerationRequestFromDocs({
    sessionSlug: 'alpha',
    docs: DOCS,
    selectedDocIds: ['doc-public-md'],
    policy: {},
  }).reason, 'question_generation_not_allowed');
  assert.deepEqual(createQuestionGenerationRequestFromDocs({
    sessionSlug: 'alpha',
    docs: DOCS,
    selectedDocIds: [],
    policy: {
      allowQuestionGeneration: true,
    },
  }), {
    ok: false,
    reason: 'selected_docs_required',
    prompt: 'Select or upload attachments before generating questions.',
  });
});

test('group-safe doc summaries represent visibility without leaking private or gated contents', () => {
  const publicSummary = summarizeDocumentForGroup(DOCS[0]);
  const gatedSummary = summarizeDocumentForGroup(DOCS[1]);

  assert.equal(publicSummary.ok, true);
  assert.equal(publicSummary.summary.contentPreview, 'Public summary only');
  assert.equal(gatedSummary.summary.visibility, DOC_VISIBILITY.SBT_GATED);
  assert.equal(gatedSummary.summary.contentPreview, null);
  assert.equal(gatedSummary.summary.gatedContentHidden, true);
  assert.equal(gatedSummary.summary.storageProfile, 'cloudflare');
  assert.equal(JSON.stringify(gatedSummary).includes('Private gated contents'), false);
  assert.equal(JSON.stringify(gatedSummary).includes('r2://private'), false);
});

test('Cloudflare storage access requests use session worker gates without exposing storage internals', () => {
  const access = buildDocumentStorageAccessRequest({
    sessionSlug: 'alpha',
    doc: {
      ...DOCS[1],
      r2: {
        bucket: 'private-bucket-name',
        objectKey: 'raw/private/path.pdf',
      },
    },
    account: {
      accountAddress: '0x1111111111111111111111111111111111111111',
    },
    operation: 'download',
    payloadEncrypted: false,
  });
  const encrypted = buildDocumentStorageAccessRequest({
    sessionSlug: 'alpha',
    doc: DOCS[1],
    operation: 'download',
    payloadEncrypted: true,
  });

  assert.equal(access.ok, true);
  assert.equal(access.request.storageProfile, 'cloudflare');
  assert.equal(access.request.sbtGated, true);
  assert.equal(access.request.litRequired, false);
  assert.equal(access.request.gateAuthority, 'session_worker_sbt_gate');
  assert.equal(access.request.canonicalApiRequest.path, '/api/agent/session-storage/access-request');
  assert.equal(access.request.exposesBucketName, false);
  assert.equal(access.request.exposesRawStoragePath, false);
  assert.equal(access.request.exposesLongLivedUrl, false);
  assert.equal(JSON.stringify(access).includes('private-bucket-name'), false);
  assert.equal(JSON.stringify(access).includes('raw/private/path.pdf'), false);
  assert.equal(encrypted.request.litRequired, true);
});
