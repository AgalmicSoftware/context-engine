import { asParsedJsonRecord, parseJsonFlexible, readParsedLegacyString } from './aiClientParsing';

describe('aiClientParsing typed record readers', () => {
  it('narrows parsed JSON objects without accepting arrays or primitives', () => {
    expect(asParsedJsonRecord({ short: 'Summary' })).toEqual({ short: 'Summary' });
    expect(asParsedJsonRecord(['not', 'record'])).toBeNull();
    expect(asParsedJsonRecord('not-record')).toBeNull();
    expect(asParsedJsonRecord(null)).toBeNull();
  });

  it('preserves legacy string coercion for parsed summary records', () => {
    const record = asParsedJsonRecord({ count: 2, enabled: true, zero: 0 });

    expect(readParsedLegacyString(record, 'count')).toBe('2');
    expect(readParsedLegacyString(record, 'enabled')).toBe('true');
    expect(readParsedLegacyString(record, 'zero')).toBe('');
  });

  it('composes with flexible fenced JSON parsing', () => {
    const parsed = asParsedJsonRecord(parseJsonFlexible('```json\n{"name":"Alpha"}\n```'));

    expect(readParsedLegacyString(parsed, 'name')).toBe('Alpha');
  });
});
