import {
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

  it('mirrors conviction and importance fields without overwriting existing values', () => {
    const payload = {
      conviction: 4,
      responses: [
        { importance: 7 },
        { conviction: 2, importance: 9 },
        { conviction: 5 },
      ],
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
});
