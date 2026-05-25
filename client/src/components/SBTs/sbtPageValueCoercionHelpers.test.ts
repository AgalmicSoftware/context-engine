import {
  coerceSbtPageEpochSeconds,
  coerceSbtPageStringArrayValue,
  getErrorMessage,
  resolveSbtPageCopyableErrorText,
} from './sbtPageValueCoercionHelpers';

describe('sbtPageValueCoercionHelpers', () => {
  it('coerces decrypted metadata string arrays without changing JSON and scalar handling', () => {
    expect(coerceSbtPageStringArrayValue(['a', null, 2])).toEqual(['a', 'null', '2']);
    expect(coerceSbtPageStringArrayValue(' ["a",2] ')).toEqual(['a', '2']);
    expect(coerceSbtPageStringArrayValue(' not json ')).toEqual(['not json']);
    expect(coerceSbtPageStringArrayValue('')).toEqual([]);
    expect(coerceSbtPageStringArrayValue({})).toEqual([]);
  });

  it('formats SBT page errors and epoch seconds with existing fallbacks', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage({ message: 'plain' }, 'fallback')).toBe('plain');
    expect(getErrorMessage('', 'fallback')).toBe('fallback');
    expect(resolveSbtPageCopyableErrorText('plain error')).toBe('plain error');
    expect(resolveSbtPageCopyableErrorText({ message: 'object error' })).toBe('object error');
    expect(resolveSbtPageCopyableErrorText('')).toBe('');
    expect(coerceSbtPageEpochSeconds(1710000000000)).toBe(1710000000);
    expect(coerceSbtPageEpochSeconds('42')).toBe(42);
    expect(coerceSbtPageEpochSeconds(-1)).toBe(0);
    expect(coerceSbtPageEpochSeconds('bad')).toBe(0);
  });
});
