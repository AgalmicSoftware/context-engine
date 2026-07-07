import {
  coerceQuestionOptionLabels,
  coerceStringArray,
  normalizeConvictionImportance,
  normalizeQuestionFlags,
} from './contractScripts.payloadNormalizers.js';

describe('contractScripts payload normalizers', () => {
  it('coerces arrays and string payloads into string arrays', () => {
    expect(coerceStringArray(['alpha', 2, true])).toEqual(['alpha', '2', 'true']);
    expect(coerceStringArray('["alpha",2,true]')).toEqual(['alpha', '2', 'true']);
    expect(coerceStringArray('  single-value  ')).toEqual(['single-value']);
    expect(coerceStringArray('[not-json')).toEqual(['[not-json']);
    expect(coerceStringArray(null)).toEqual([]);
  });

  it('coerces question option aliases into display labels', () => {
    expect(
      coerceQuestionOptionLabels([
        ' Alpha ',
        { label: 'Beta' },
        { text: 'Gamma' },
        { name: 'Delta' },
        { value: 'Epsilon' },
        { id: 'zeta' },
        '',
        'Alpha',
      ]),
    ).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'zeta']);

    expect(
      coerceQuestionOptionLabels({
        one: { label: 'One' },
        two: { id: 'two' },
      }),
    ).toEqual(['One', 'two']);

    expect(coerceQuestionOptionLabels('["A","B"]')).toEqual(['A', 'B']);
  });

  it('mirrors conviction and importance fields without overwriting existing values', () => {
    const payload = {
      conviction: 4,
      responses: [{ importance: 7 }, { conviction: 2, importance: 9 }, { conviction: 5 }],
    };

    const normalized = normalizeConvictionImportance(payload);

    expect(normalized).toBe(payload);
    expect(payload).toEqual({
      conviction: 4,
      importance: 4,
      responses: [
        { importance: 7, conviction: 7 },
        { conviction: 2, importance: 9 },
        { conviction: 5, importance: 5 },
      ],
    });
  });

  it('preserves single-select flags when normalizing cached question payloads', () => {
    const inheritedFlag = { oneSelectionOnly: 1 };
    const explicitFlag = { singleSelect: 'truthy', oneSelectionOnly: 0 };

    normalizeQuestionFlags(inheritedFlag);
    normalizeQuestionFlags(explicitFlag);

    expect(inheritedFlag.singleSelect).toBe(true);
    expect(explicitFlag.singleSelect).toBe(true);
  });

  it('normalizes multichoice option aliases into cached question options', () => {
    const question = {
      type: 'multichoice',
      choices: {
        first: { label: 'Cross-site graph' },
        second: { text: 'Session memory' },
      },
    };

    normalizeQuestionFlags(question);

    expect(question.options).toEqual(['Cross-site graph', 'Session memory']);
  });

  it('keeps non-empty options ahead of fallback aliases', () => {
    const question = {
      type: 'multichoice',
      options: ['Canonical'],
      choices: ['Fallback'],
    };

    normalizeQuestionFlags(question);

    expect(question.options).toEqual(['Canonical']);
  });
});
