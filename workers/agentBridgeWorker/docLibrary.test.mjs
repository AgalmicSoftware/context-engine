import test from 'node:test';
import assert from 'node:assert/strict';
import { DOC_VISIBILITY, SUPPORTED_DOC_TYPES } from './constants.mjs';
import {
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
    contentPreview: 'Public summary only',
    privateContentRef: 'r2://private/public-notes.md',
  },
  {
    docId: 'doc-gated-pdf',
    sessionSlug: 'alpha',
    title: 'Gated brief',
    fileType: 'pdf',
    visibility: DOC_VISIBILITY.SBT_GATED,
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
  assert.deepEqual([...SUPPORTED_DOC_TYPES], ['md', 'pdf', 'png', 'jpg', 'jpeg', 'webp']);

  assert.equal(normalizeDocumentRecord({
    title: 'Spreadsheet',
    fileType: 'xlsx',
  }).ok, false);
  assert.equal(normalizeDocumentRecord({
    title: 'Photo',
    mimeType: 'image/jpeg',
  }).record.fileType, 'jpeg');
});

test('selected docs create mocked question-generation request without embedding bytes', () => {
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
  assert.equal(request.ok, true);
  assert.equal(request.request.status, 'mocked_contract_only');
  assert.deepEqual(request.request.selectedDocTypes.sort(), ['md', 'pdf']);
  assert.deepEqual(request.request.visibility.sort(), ['public', 'sbt_gated']);
  assert.equal(JSON.stringify(request).includes('Private gated contents'), false);
  assert.equal(createQuestionGenerationRequestFromDocs({
    sessionSlug: 'alpha',
    docs: DOCS,
    selectedDocIds: ['doc-public-md'],
    policy: {},
  }).reason, 'question_generation_not_allowed');
});

test('group-safe doc summaries represent visibility without leaking private or gated contents', () => {
  const publicSummary = summarizeDocumentForGroup(DOCS[0]);
  const gatedSummary = summarizeDocumentForGroup(DOCS[1]);

  assert.equal(publicSummary.ok, true);
  assert.equal(publicSummary.summary.contentPreview, 'Public summary only');
  assert.equal(gatedSummary.summary.visibility, DOC_VISIBILITY.SBT_GATED);
  assert.equal(gatedSummary.summary.contentPreview, null);
  assert.equal(gatedSummary.summary.gatedContentHidden, true);
  assert.equal(JSON.stringify(gatedSummary).includes('Private gated contents'), false);
  assert.equal(JSON.stringify(gatedSummary).includes('r2://private'), false);
});
