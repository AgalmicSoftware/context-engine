import {
  LOCKED_FIELD_MASK,
  sanitizeQuestionPromptForResponsePayload,
  sanitizeSurveyTitleForResponsePayload,
  validateNoLockedPlaintextInPayload,
} from './noLeakPayloads.js';

describe('no-leak Arweave payload guards', () => {
  it('rejects locked survey metadata that still carries plaintext', () => {
    expect(() => validateNoLockedPlaintextInPayload({
      title: 'Secret survey title',
      titleEncrypted: '{"ciphertext":"cipher"}',
    }, { family: 'survey_metadata' })).toThrow('payload.title');

    expect(() => validateNoLockedPlaintextInPayload({
      title: LOCKED_FIELD_MASK,
      titleEncrypted: '{"ciphertext":"cipher"}',
      documentURLs: [],
      documentURLsEncrypted: '{"ciphertext":"docs"}',
    }, { family: 'survey_metadata' })).not.toThrow();
  });

  it('rejects locked response fields that keep plaintext beside encrypted envelopes', () => {
    expect(() => validateNoLockedPlaintextInPayload({
      questionID: 'q1',
      answer: {
        value: 'private answer',
        encrypted: true,
        encryptedPortion: '{"ciphertext":"cipher"}',
      },
      additional: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"ciphertext":"cipher2"}',
      },
    }, { family: 'question_response_payload' })).toThrow('payload.answer.value');

    expect(() => validateNoLockedPlaintextInPayload({
      responses: [{
        questionID: 'q1',
        answer: {
          value: '*',
          encrypted: true,
          encryptedPortion: '{"ciphertext":"cipher"}',
        },
        additional: {
          value: '',
          encrypted: true,
          encryptedPortion: '',
        },
        importance: null,
        importanceEncrypted: '{"ciphertext":"rating"}',
      }],
    }, { family: 'survey_response_payload' })).not.toThrow();
  });

  it('rejects locked SBT tokenURI fields with plaintext aliases', () => {
    expect(() => validateNoLockedPlaintextInPayload({
      name: 'Private group name',
      tags: [],
      encryptedFields: {
        name: { ciphertext: 'cipher' },
      },
    }, { family: 'sbt_metadata' })).toThrow('payload.name');

    expect(() => validateNoLockedPlaintextInPayload({
      name: '',
      tags: [],
      documentURLs: [],
      encryptedFields: {
        name: { ciphertext: 'cipher' },
        tags: { ciphertext: 'tags' },
        documentURLs: { ciphertext: 'docs' },
      },
    }, { family: 'sbt_metadata' })).not.toThrow();
  });

  it('masks locked question prompts before they are copied into response payloads', () => {
    expect(sanitizeQuestionPromptForResponsePayload({
      prompt: 'Sensitive question prompt',
      promptEncrypted: '{"ciphertext":"cipher"}',
    })).toBe(LOCKED_FIELD_MASK);

    expect(sanitizeQuestionPromptForResponsePayload({
      prompt: 'Public question prompt',
    })).toBe('Public question prompt');
  });

  it('masks locked survey titles before they are copied into response payloads', () => {
    expect(sanitizeSurveyTitleForResponsePayload({
      title: 'Sensitive survey title',
      titleEncrypted: '{"ciphertext":"cipher"}',
    })).toBe(LOCKED_FIELD_MASK);

    expect(sanitizeSurveyTitleForResponsePayload({
      title: 'Public survey title',
    })).toBe('Public survey title');
  });

  it('does not copy non-string prompts or titles into response payloads', () => {
    expect(sanitizeQuestionPromptForResponsePayload({
      prompt: { nested: 'metadata' },
    })).toBe('');

    expect(sanitizeSurveyTitleForResponsePayload({
      title: ['metadata'],
    })).toBeNull();
  });
});
