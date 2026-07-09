import {
  asParsedJsonRecord,
  parseJsonFlexible,
  pickParsedString,
  readParsedLegacyString,
  readParsedString,
} from './aiClientParsing';

describe('aiClientParsing typed record readers', () => {
  it('narrows parsed JSON objects without accepting arrays or primitives', () => {
    expect(asParsedJsonRecord({ short: 'Summary' })).toEqual({ short: 'Summary' });
    expect(asParsedJsonRecord(['not', 'record'])).toBeNull();
    expect(asParsedJsonRecord('not-record')).toBeNull();
    expect(asParsedJsonRecord(null)).toBeNull();
  });

  it('reads only string fields from parsed model records', () => {
    const record = asParsedJsonRecord({ text: 'Plain answer', count: 2 });

    expect(readParsedString(record, 'text')).toBe('Plain answer');
    expect(readParsedString(record, 'count')).toBe('');
    expect(readParsedString(null, 'text')).toBe('');
  });

  it('preserves legacy string coercion for parsed summary records', () => {
    const record = asParsedJsonRecord({ count: 2, enabled: true, zero: 0 });

    expect(readParsedLegacyString(record, 'count')).toBe('2');
    expect(readParsedLegacyString(record, 'enabled')).toBe('true');
    expect(readParsedLegacyString(record, 'zero')).toBe('');
  });

  it('picks the first non-empty string from fallback model response keys', () => {
    const record = asParsedJsonRecord({
      explanation: '',
      message: 'Fallback message',
      text: 42,
    });

    expect(pickParsedString(record, ['text', 'explanation', 'message'])).toBe('Fallback message');
  });

  it('composes with flexible fenced JSON parsing', () => {
    const parsed = asParsedJsonRecord(parseJsonFlexible('```json\n{"name":"Alpha"}\n```'));

    expect(readParsedString(parsed, 'name')).toBe('Alpha');
  });
});
