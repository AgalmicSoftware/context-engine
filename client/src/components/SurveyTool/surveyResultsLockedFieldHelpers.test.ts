import {
  buildLockedResponseSignature,
  extractEnvelopeCandidate,
  hasEnvelopeShape,
  hasVisibleFieldValue,
  isBannerEligibleLockedField,
  isLockedEncryptedField,
  normalizeGateSbtEntries,
  normalizeGateText,
} from './surveyResultsLockedFieldHelpers';

describe('surveyResultsLockedFieldHelpers', () => {
  it('normalizes and dedupes gate SBT entries', () => {
    expect(normalizeGateSbtEntries({
      sbtAddress: ' 0xCCC ',
      sbtAddresses: ['0xbbb', '0xBBB', null],
      sbts: [
        ' 0xAAA ',
        { address: '0xaaa', label: 'Duplicate' },
        { name: 'Named gate', sbtAddress: ' 0xDDD ' },
        { address: '', label: 'empty' },
      ],
    })).toEqual([
      { address: '0xAAA', label: '' },
      { address: '0xDDD', label: 'Named gate' },
      { address: '0xbbb', label: '' },
      { address: '0xCCC', label: '' },
    ]);
  });

  it('selects direct, nested, and self envelope candidates', () => {
    const direct = { encryptedPortion: ' envelope-string ' };
    const payload = { payload: { ciphertext: 'cipher' } };
    const valueEnvelope = { valueEnvelope: { encryptedData: 'payload' } };
    const selfEnvelope = { chain: 'optimism', dataToEncryptHash: 'hash' };

    expect(extractEnvelopeCandidate(direct)).toBe('envelope-string');
    expect(extractEnvelopeCandidate(payload)).toBe(payload.payload);
    expect(extractEnvelopeCandidate(valueEnvelope)).toBe(valueEnvelope.valueEnvelope);
    expect(extractEnvelopeCandidate(selfEnvelope)).toBe(selfEnvelope);
    expect(hasEnvelopeShape({ unrelated: true })).toBe(false);
  });

  it('detects visible values and locked encrypted fields', () => {
    expect(hasVisibleFieldValue({ value: 'visible', encrypted: true })).toBe(true);
    expect(hasVisibleFieldValue({ value: '*', encrypted: true })).toBe(false);
    expect(isLockedEncryptedField({ value: 'visible', encrypted: true })).toBe(false);
    expect(isLockedEncryptedField({ value: '*', encrypted: true })).toBe(true);
    expect(isLockedEncryptedField({ locked: true, value: 'visible' })).toBe(true);
    expect(isLockedEncryptedField({ payload: { ciphertext: 'cipher' } })).toBe(true);
    expect(isLockedEncryptedField({ value: 'visible' })).toBe(false);
  });

  it('excludes self-audience locked fields from the shared banner', () => {
    expect(isBannerEligibleLockedField({
      encrypted: true,
      encryptionAudience: ' responder ',
      value: '*',
    })).toBe(true);
    expect(isBannerEligibleLockedField({
      encrypted: true,
      encryptionAudience: ' self ',
      value: '*',
    })).toBe(false);
  });

  it('normalizes gate labels and object placeholders', () => {
    expect(normalizeGateText(' Gate A ')).toBe('Gate A');
    expect(normalizeGateText({})).toBe('');
    expect(normalizeGateText(null)).toBe('');
  });

  it('builds stable locked response signatures from encrypted field identity', () => {
    const response = {
      additional: { encryptedEnvelope: { ciphertext: 'additional' } },
      answer: { hash: 'answer-hash', value: '*' },
      convictionEncrypted: 'conviction-payload',
      importanceEncrypted: 'importance-payload',
      questionID: 'q1',
      timeStamp: 42,
    };

    expect(buildLockedResponseSignature(response)).toBe(buildLockedResponseSignature({ ...response }));
    expect(buildLockedResponseSignature({
      ...response,
      answer: { hash: 'changed', value: '*' },
    })).not.toBe(buildLockedResponseSignature(response));
  });
});
