import {
  buildQuestionIdScopeSignature,
  buildRenderedIdsSignature,
  buildSliceToken,
  buildSurveyResponseSliceSignature,
  normalizeQuestionIdKey,
} from './surveyToolSignatures.js';

describe('surveyToolSignatures', () => {
  it('normalizes question ids consistently for signature keys', () => {
    expect(normalizeQuestionIdKey(' Q1 ')).toBe('q1');
    expect(normalizeQuestionIdKey(null)).toBe('');
  });

  it('builds stable slice tokens for equivalent structured payloads regardless of key order', () => {
    expect(
      buildSliceToken({
        b: ['x', { y: 2 }],
        a: { nested: true },
      }),
    ).toBe(
      buildSliceToken({
        a: { nested: true },
        b: ['x', { y: 2 }],
      }),
    );
  });

  it('changes survey response slice signatures when filtered question payloads change', () => {
    const base = {
      answers: {
        q1: {
          value: 'hello',
          encrypted: false,
        },
        q2: {
          value: 'ignored',
          encrypted: false,
        },
      },
      additionalComments: {
        q1: { value: '', encrypted: false },
      },
      importance: {
        q1: 3,
      },
      conviction: {
        q1: 4,
      },
    };
    const next = {
      ...base,
      answers: {
        ...base.answers,
        q1: {
          value: 'changed',
          encrypted: false,
        },
      },
    };

    expect(
      buildSurveyResponseSliceSignature(base, {
        normalizedIdFilter: new Set(['q1']),
      }),
    ).not.toBe(
      buildSurveyResponseSliceSignature(next, {
        normalizedIdFilter: new Set(['q1']),
      }),
    );

    expect(
      buildSurveyResponseSliceSignature(base, {
        normalizedIdFilter: new Set(['q2']),
      }),
    ).toBe(
      buildSurveyResponseSliceSignature(next, {
        normalizedIdFilter: new Set(['q2']),
      }),
    );
  });

  it('builds rendered-id and question-scope signatures from normalized ids', () => {
    expect(buildRenderedIdsSignature(['Q1', 'q2', '', 'Q3'])).toBe('q1|q2|q3');
    expect(buildQuestionIdScopeSignature([{ id: 'Q2' }, { id: 'q1' }, { id: 'Q2' }])).toBe('q1|q2');
  });
});
