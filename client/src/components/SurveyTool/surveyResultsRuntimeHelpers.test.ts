import {
  applyExistingGroupPrefix,
  areValuesEquivalentBySignature,
  getFilterStateSignature,
  getResponseQuestionId,
  getResponseQuestionPrompt,
  getResponseQuestionType,
  hasExplicitSessionQueryPinInPath,
  normalizeNonceKey,
  readPathSearch,
  resolveNetBucketReadOnly,
  unifyAggregatorWithAllQuestionIDs,
} from './surveyResultsRuntimeHelpers';

describe('surveyResultsRuntimeHelpers', () => {
  const originalPathname = window.location.pathname;

  afterEach(() => {
    window.history.replaceState({}, '', originalPathname || '/');
  });

  it('lowercases aggregator keys and includes known empty question IDs', () => {
    expect(
      unifyAggregatorWithAllQuestionIDs(
        {
          Q1: ['a'],
          q1: ['b'],
          Q2: ['c'],
        },
        ['Q3'],
      ),
    ).toEqual({
      q1: ['a', 'b'],
      q2: ['c'],
      q3: [],
    });
  });

  it('reads query strings and detects explicit session pins', () => {
    expect(readPathSearch('/questions?session=edge&x=1')).toBe('?session=edge&x=1');
    expect(readPathSearch('/questions')).toBe('');
    expect(hasExplicitSessionQueryPinInPath('/question/q1?session=edge')).toBe(true);
    expect(hasExplicitSessionQueryPinInPath('/question/q1?sessionId=12')).toBe(true);
    expect(hasExplicitSessionQueryPinInPath('/questions?x=1')).toBe(false);
  });

  it('preserves existing group prefixes without changing explicitly pinned paths', () => {
    window.history.replaceState({}, '', '/session/edge/questions');
    expect(applyExistingGroupPrefix('/questions/results')).toBe('/session/edge/questions/results');
    expect(applyExistingGroupPrefix('/question/q1?session=other')).toBe('/question/q1?session=other');

    window.history.replaceState({}, '', '/questions');
    expect(applyExistingGroupPrefix('/questions/results')).toBe('/questions/results');
  });

  it('resolves read-only network buckets with fallback identity', () => {
    const fallback = { fallback: true };
    const bucket = { questions: {} };
    expect(resolveNetBucketReadOnly({ '11155420': bucket }, '11155420', fallback)).toBe(bucket);
    expect(resolveNetBucketReadOnly({ '84532': bucket }, '11155420', fallback)).toBe(fallback);
    expect(resolveNetBucketReadOnly(null, '11155420', undefined)).toEqual({});
  });

  it('normalizes nonce keys and filter signatures', () => {
    expect(normalizeNonceKey('4')).toBe(4);
    expect(normalizeNonceKey('bad')).toBeNull();
    expect(getFilterStateSignature({ selectedTags: ['b', 'a'] })).toBe(
      getFilterStateSignature({ selectedTags: ['b', 'a'] }),
    );
    expect(getFilterStateSignature({ selectedTags: ['b', 'a'] })).not.toBe(
      getFilterStateSignature({ selectedTags: ['a', 'b'] }),
    );
  });

  it('compares values by stable signatures only for object-like values', () => {
    expect(areValuesEquivalentBySignature({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(areValuesEquivalentBySignature({ a: 1 }, { a: 2 })).toBe(false);
    expect(areValuesEquivalentBySignature(null, {})).toBe(false);
    expect(areValuesEquivalentBySignature('1', 1)).toBe(false);
  });

  it('reads response question identity with metadata fallback fields', () => {
    expect(getResponseQuestionId({ questionID: ' q1 ' })).toBe('q1');
    expect(getResponseQuestionId({ questionId: ' q2 ' })).toBe('q2');
    expect(getResponseQuestionPrompt({ prompt: 'Response prompt' }, { prompt: 'Question prompt' })).toBe(
      'Response prompt',
    );
    expect(getResponseQuestionPrompt({}, { prompt: 'Question prompt' })).toBe('Question prompt');
    expect(getResponseQuestionType({ type: 'binary' }, { type: 'freeform' })).toBe('binary');
    expect(getResponseQuestionType({}, { type: 'freeform' })).toBe('freeform');
  });
});
