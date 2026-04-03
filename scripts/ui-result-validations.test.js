'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateDocLibrarySbtUiReport,
  evaluateSbtMetadataLocksUiResult,
} = require('./lib/e2e/ui-result-validations');

test('evaluateSbtMetadataLocksUiResult passes when all holder decrypt flags are true', () => {
  const result = evaluateSbtMetadataLocksUiResult({
    holderNameDecrypted: true,
    holderDescriptionDecrypted: true,
    holderImageDecrypted: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.got, {
    holderNameDecrypted: true,
    holderDescriptionDecrypted: true,
    holderImageDecrypted: true,
  });
});

test('evaluateSbtMetadataLocksUiResult reports any missing holder decrypt evidence', () => {
  const result = evaluateSbtMetadataLocksUiResult({
    holderNameDecrypted: false,
    holderDescriptionDecrypted: true,
    holderImageDecrypted: false,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    'holder name decrypted',
    'holder image decrypted',
  ]);
  assert.deepEqual(result.got, {
    holderNameDecrypted: false,
    holderDescriptionDecrypted: true,
    holderImageDecrypted: false,
  });
});

test('evaluateDocLibrarySbtUiReport accepts the required wallet B anti-spam rejection assertion', () => {
  const result = evaluateDocLibrarySbtUiReport({
    ui: {
      assertions: [
        {
          name: 'wallet B upload rejected (anti-spam)',
          ok: true,
          status: 403,
          message: 'Uploader is not authorized to associate this SBT group.',
        },
        { name: 'wallet A can view/decrypt uploaded doc', ok: true },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.checks, {
    walletBUploadRejected: true,
    walletBUploadAllowed: false,
    antiSpamStatus: 403,
    antiSpamMessage: 'Uploader is not authorized to associate this SBT group.',
  });
});

test('evaluateDocLibrarySbtUiReport fails when wallet B upload is allowed by the worker', () => {
  const result = evaluateDocLibrarySbtUiReport({
    ui: {
      assertions: [
        { name: 'wallet B upload allowed by worker', ok: true, status: 200 },
      ],
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['wallet B upload rejected (anti-spam)']);
  assert.deepEqual(result.checks, {
    walletBUploadRejected: false,
    walletBUploadAllowed: true,
    antiSpamStatus: 0,
    antiSpamMessage: '',
  });
});

test('evaluateDocLibrarySbtUiReport rejects transient worker failures mislabeled as anti-spam', () => {
  const result = evaluateDocLibrarySbtUiReport({
    ui: {
      assertions: [
        {
          name: 'wallet B upload rejected (anti-spam)',
          ok: true,
          status: 502,
          message: 'Could not getPrice',
        },
      ],
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['wallet B upload rejected (anti-spam)']);
  assert.deepEqual(result.checks, {
    walletBUploadRejected: false,
    walletBUploadAllowed: false,
    antiSpamStatus: 502,
    antiSpamMessage: 'Could not getPrice',
  });
});
