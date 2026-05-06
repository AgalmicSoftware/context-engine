import {
  cloneUserPageParsedResponsePayload,
  compareUserPageResponseRecency,
  extractUserPageFirstDefinedValue,
  extractUserPageResponseRecency,
  extractUserPageResponseRecencyWithHints,
  hasDisplayableUserPageResponsePayload,
  hasUserPageResponseSubmissionHints,
  isDisplayableUserPageResponseValue,
  normalizeUserPageQuestionResponseInfoOrder,
  normalizeUserPageResponseField,
  normalizeUserPageSingleQuestionResponsePayload,
  parseUserPageCachedResponsePayload,
} from './userPageResponseHelpers';

describe('userPageResponseHelpers', () => {
  it('parses cached response payloads through bounded memoized clones', () => {
    const memo = new Map<string, unknown>();
    const payload = '{"answer":{"value":"safe"}}';

    const first = parseUserPageCachedResponsePayload(payload, memo, 2);
    const second = parseUserPageCachedResponsePayload(payload, memo, 2);

    expect(first).toEqual({ answer: { value: 'safe' } });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect((second as any).answer).not.toBe((first as any).answer);

    parseUserPageCachedResponsePayload('{"next":1}', memo, 2);
    parseUserPageCachedResponsePayload('{"third":1}', memo, 2);
    expect(memo.has(payload)).toBe(false);
    expect(parseUserPageCachedResponsePayload('not json', memo, 2)).toBe('not json');
  });

  it('clones response objects without preserving nested references or prototypes', () => {
    const source = {
      answer: { value: 'yes' },
      nested: [{ value: 'one' }],
    };
    const clone = cloneUserPageParsedResponsePayload(source);

    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
    expect((clone as any).answer).not.toBe(source.answer);
    expect((clone as any).nested[0]).not.toBe(source.nested[0]);

    const parsed = parseUserPageCachedResponsePayload(
      '{"__proto__":{"polluted":"yes"},"answer":{"value":"safe"}}',
      new Map(),
      10
    );
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true);
    expect((parsed as any).polluted).toBeUndefined();
  });

  it('normalizes response fields and single-question response payload variants', () => {
    expect(extractUserPageFirstDefinedValue(undefined, '', 'fallback')).toBe('');
    expect(normalizeUserPageResponseField({ value: 'kept', encrypted: true }, ['fallback'])).toEqual({
      value: 'kept',
      encrypted: true,
    });
    expect(normalizeUserPageResponseField('scalar', ['fallback'])).toEqual({ value: 'scalar' });
    expect(normalizeUserPageResponseField({}, [undefined, 'fallback'])).toEqual({ value: 'fallback' });

    expect(normalizeUserPageSingleQuestionResponsePayload('plain answer')).toEqual({
      answer: { value: 'plain answer' },
      additional: { value: '' },
    });
    expect(normalizeUserPageSingleQuestionResponsePayload({
      response: {
        value: 'nested answer',
        additionalComment: 'nested note',
      },
      blockNumber: 50,
    })).toEqual(expect.objectContaining({
      value: 'nested answer',
      blockNumber: 50,
      answer: { value: 'nested answer' },
      additional: { value: 'nested note' },
    }));
    expect(normalizeUserPageSingleQuestionResponsePayload({ arbitrary: 'legacy' })).toEqual(expect.objectContaining({
      arbitrary: 'legacy',
      answer: {},
      additional: {},
      __ceMalformedPayload: true,
    }));
  });

  it('detects displayable response payloads and submission hints', () => {
    expect(isDisplayableUserPageResponseValue('*')).toBe(false);
    expect(isDisplayableUserPageResponseValue(['*', { value: 'yes' }])).toBe(true);
    expect(hasDisplayableUserPageResponsePayload({
      answer: { value: '*' },
      additional: { value: 'comment' },
    })).toBe(true);
    expect(hasDisplayableUserPageResponsePayload({
      answer: { value: '*' },
      additional: { value: '' },
    })).toBe(false);

    expect(hasUserPageResponseSubmissionHints('answer')).toBe(true);
    expect(hasUserPageResponseSubmissionHints('  ')).toBe(false);
    expect(hasUserPageResponseSubmissionHints({ answer: {} })).toBe(true);
    expect(hasUserPageResponseSubmissionHints({ transactionHash: '0xabc' })).toBe(true);
    expect(hasUserPageResponseSubmissionHints({})).toBe(false);
  });

  it('orders response recency from chain metadata and strips private sort hints', () => {
    expect(extractUserPageResponseRecency({
      blockNumber: 10,
      transactionIndex: 2,
      logIndex: 4,
      timestamp: 100,
    }, {
      bn: 11,
      txi: 1,
      li: 3,
      ts: 200,
    })).toEqual({
      bn: 11,
      txi: 1,
      li: 3,
      ts: 200,
    });
    expect(extractUserPageResponseRecencyWithHints({}, { bn: 12 })).toEqual({
      bn: 12,
      txi: 0,
      li: 0,
      ts: 0,
      hasHints: true,
    });
    expect(compareUserPageResponseRecency({ blockNumber: 10 }, { blockNumber: 9 })).toBe(1);
    expect(normalizeUserPageQuestionResponseInfoOrder([
      { id: 'z', prompt: 'Older', _responseRecency: { bn: 1 } },
      { id: 'b', prompt: 'Newest B', _responseRecency: { bn: 3, txi: 1 } },
      { id: 'a', prompt: 'Newest A', _responseRecency: { bn: 3, txi: 1 } },
    ])).toEqual([
      { id: 'a', prompt: 'Newest A' },
      { id: 'b', prompt: 'Newest B' },
      { id: 'z', prompt: 'Older' },
    ]);
  });
});
