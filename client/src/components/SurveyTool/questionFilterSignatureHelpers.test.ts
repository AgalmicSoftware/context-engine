import {
  areQuestionListsEquivalentById,
  buildAiCandidateSignature,
  buildFilterPayloadSignature,
  buildFilteredResponsesByQuestionSignature,
  buildQuestionIdListSignature,
  hashNormalizedString,
  normalizeNonceKey,
  stableSerializeSmallObject,
  toLowerId,
} from './questionFilterSignatureHelpers.js';

describe('questionFilterSignatureHelpers', () => {
  it('normalizes ids and compares question arrays by id plus object identity', () => {
    const first = { id: ' Q1 ' };
    const second = { id: 'q2' };

    expect(toLowerId(' Q1 ')).toBe('q1');
    expect(areQuestionListsEquivalentById([first, second], [first, second])).toBe(true);
    expect(areQuestionListsEquivalentById([first], [{ id: 'q1' }])).toBe(false);
    expect(areQuestionListsEquivalentById([first], [second])).toBe(false);
  });

  it('stable-serializes objects with sorted keys, cycles, and large sentinels', () => {
    expect(stableSerializeSmallObject({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    const circular: any = { id: 'x' };
    circular.self = circular;
    expect(stableSerializeSmallObject(circular)).toBe('{"id":"x","self":null}');
    expect(stableSerializeSmallObject({ long: 'abcdef' }, 8)).toMatch(/^__large:\d+:[0-9a-f]{8}$/);
    expect(hashNormalizedString('abc')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('builds question and response signatures', () => {
    expect(buildQuestionIdListSignature([{ id: 'q1' }])).toBe('[{"id":"q1"}]');
    expect(buildFilteredResponsesByQuestionSignature({ q1: { responder: '0x1' } })).toBe('{"q1":{"responder":"0x1"}}');
    expect(buildFilteredResponsesByQuestionSignature(null)).toBe('');
  });

  it('builds filter payload signatures by payload shape', () => {
    expect(buildFilterPayloadSignature([{ id: 'q1' }])).toBe('arr:[{"id":"q1"}]');
    expect(
      buildFilterPayloadSignature({
        filteredQuestions: [{ id: 'q1' }],
        filteredResponsesByQuestion: { q1: { responder: '0x1' } },
      }),
    ).toBe('combo:[{"id":"q1"}]|{"q1":{"responder":"0x1"}}');
    expect(buildFilterPayloadSignature({ b: 2, a: 1 })).toBe('obj:{"a":1,"b":2}');
    expect(buildFilterPayloadSignature('x')).toBe('prim:x');
  });

  it('normalizes nonce keys and AI candidate signatures', () => {
    expect(normalizeNonceKey('4')).toBe(4);
    expect(normalizeNonceKey('bad')).toBeNull();
    expect(
      buildAiCandidateSignature([
        { id: 'Q1', prompt: 'Prompt one' },
        { id: 'q2', prompt: null },
      ]),
    ).toBe('[{"id":"q1","prompt":"Prompt one"},{"id":"q2","prompt":""}]');
  });
});
