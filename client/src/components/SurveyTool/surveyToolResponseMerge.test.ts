import { areEnvelopesEquivalent, mergeDecryptedViewedResponse } from './surveyToolResponseMerge.js';

describe('surveyToolResponseMerge', () => {
  it('treats empty envelopes as equivalent only when both sides are encrypted', () => {
    expect(areEnvelopesEquivalent('env-a', 'env-a', true, true)).toBe(true);
    expect(areEnvelopesEquivalent('env-a', 'env-b', true, true)).toBe(false);
    expect(areEnvelopesEquivalent('', '', true, true)).toBe(true);
    expect(areEnvelopesEquivalent('', '', true, false)).toBe(false);
    expect(areEnvelopesEquivalent('env-a', '', true, true)).toBe(false);
  });

  it('preserves decrypted single-response fields when a later refresh re-masks matching envelopes', () => {
    expect(
      mergeDecryptedViewedResponse(
        {
          answer: {
            value: 'kept answer',
            encrypted: true,
            encryptedPortion: 'ans-env',
          },
          additional: {
            value: 'kept note',
            encrypted: true,
            encryptedPortion: 'add-env',
          },
          importance: 4,
          importanceEncrypted: 'imp-env',
          conviction: 2,
          convictionEncrypted: 'conv-env',
        },
        {
          answer: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'ans-env',
          },
          additional: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'add-env',
          },
          importance: null,
          importanceEncrypted: 'imp-env',
          conviction: '*',
          convictionEncrypted: 'conv-env',
        },
      ),
    ).toEqual({
      answer: {
        value: 'kept answer',
        encrypted: true,
        encryptedPortion: 'ans-env',
      },
      additional: {
        value: 'kept note',
        encrypted: true,
        encryptedPortion: 'add-env',
      },
      importance: 4,
      importanceEncrypted: 'imp-env',
      conviction: 2,
      convictionEncrypted: 'conv-env',
    });
  });

  it('does not preserve decrypted values when envelopes no longer match', () => {
    expect(
      mergeDecryptedViewedResponse(
        {
          answer: {
            value: 'old answer',
            encrypted: true,
            encryptedPortion: 'ans-env-old',
          },
          importance: 4,
          importanceEncrypted: 'imp-env-old',
        },
        {
          answer: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'ans-env-new',
          },
          importance: null,
          importanceEncrypted: 'imp-env-new',
        },
      ),
    ).toEqual({
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: 'ans-env-new',
      },
      importance: null,
      importanceEncrypted: 'imp-env-new',
    });
  });

  it('prefers refreshed plaintext over stale decrypted values even when envelopes match', () => {
    expect(
      mergeDecryptedViewedResponse(
        {
          answer: {
            value: 'old decrypted answer',
            encrypted: true,
            encryptedPortion: 'ans-env',
          },
          additional: {
            value: 'old decrypted note',
            encrypted: true,
            encryptedPortion: 'add-env',
          },
          importance: 4,
          importanceEncrypted: 'imp-env',
          conviction: 2,
          convictionEncrypted: 'conv-env',
        },
        {
          answer: {
            value: 'fresh plaintext answer',
            encrypted: false,
            encryptedPortion: 'ans-env',
          },
          additional: {
            value: 'fresh plaintext note',
            encrypted: false,
            encryptedPortion: 'add-env',
          },
          importance: 9,
          importanceEncrypted: 'imp-env',
          conviction: 7,
          convictionEncrypted: 'conv-env',
        },
      ),
    ).toEqual({
      answer: {
        value: 'fresh plaintext answer',
        encrypted: false,
        encryptedPortion: 'ans-env',
      },
      additional: {
        value: 'fresh plaintext note',
        encrypted: false,
        encryptedPortion: 'add-env',
      },
      importance: 9,
      importanceEncrypted: 'imp-env',
      conviction: 7,
      convictionEncrypted: 'conv-env',
    });
  });

  it('merges survey response arrays per question id while keeping untouched rows intact', () => {
    expect(
      mergeDecryptedViewedResponse(
        {
          responses: [
            {
              questionID: 'Q1',
              answer: {
                value: 'persisted',
                encrypted: true,
                encryptedPortion: 'ans-env-1',
              },
            },
            {
              questionID: 'Q2',
              answer: {
                value: 'other',
                encrypted: false,
              },
            },
          ],
        },
        {
          responses: [
            {
              questionID: 'q1',
              answer: {
                value: '*',
                encrypted: true,
                encryptedPortion: 'ans-env-1',
              },
            },
            {
              questionID: 'Q2',
              answer: {
                value: 'other',
                encrypted: false,
              },
            },
          ],
        },
      ),
    ).toEqual({
      responses: [
        {
          questionID: 'q1',
          answer: {
            value: 'persisted',
            encrypted: true,
            encryptedPortion: 'ans-env-1',
          },
        },
        {
          questionID: 'Q2',
          answer: {
            value: 'other',
            encrypted: false,
          },
        },
      ],
    });
  });

  it('restores same-envelope decrypted values across cache refresh while keeping latest cache metadata', () => {
    expect(
      mergeDecryptedViewedResponse(
        {
          responses: [
            {
              questionID: 'Q1',
              answer: {
                value: 'clear answer',
                encrypted: true,
                encryptedPortion: 'ans-env',
                source: 'previous-decrypt',
              },
              additional: {
                value: 'clear note',
                encrypted: true,
                encryptedPortion: 'add-env',
              },
              importance: 8,
              importanceEncrypted: 'importance-env',
            },
          ],
        },
        {
          responses: [
            {
              questionId: 'q1',
              prompt: '[encrypted prompt from refreshed cache]',
              cacheUpdatedAt: '2026-06-02T12:00:00.000Z',
              answer: {
                value: '*',
                encrypted: true,
                encryptedPortion: 'ans-env',
                source: 'refreshed-cache',
              },
              additional: {
                value: '*',
                encrypted: true,
                encryptedPortion: 'add-env',
                source: 'refreshed-cache',
              },
              importance: '*',
              importanceEncrypted: 'importance-env',
            },
          ],
        },
      ),
    ).toEqual({
      responses: [
        {
          questionId: 'q1',
          prompt: '[encrypted prompt from refreshed cache]',
          cacheUpdatedAt: '2026-06-02T12:00:00.000Z',
          answer: {
            value: 'clear answer',
            encrypted: true,
            encryptedPortion: 'ans-env',
            source: 'refreshed-cache',
          },
          additional: {
            value: 'clear note',
            encrypted: true,
            encryptedPortion: 'add-env',
            source: 'refreshed-cache',
          },
          importance: 8,
          importanceEncrypted: 'importance-env',
        },
      ],
    });
  });
});
