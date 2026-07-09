import {
  deserializeFilterState,
  deserializeFilterStateStrict,
  serializeFilterState,
  type SurveyFilterState,
} from './filterStateUtils';

type SurveyFilterStateInput = Partial<SurveyFilterState> & Record<string, unknown>;

const defaultState: SurveyFilterState = {
  topQuestions: null,
  questionTypes: [],
  sbtFilter: null,
  aiFilter: null,
  aiTopN: null,
  aiCombine: false,
  selectedTags: [],
  responseStatus: null,
};

describe('filterStateUtils', () => {
  it('returns empty string for null or effectively empty input', () => {
    expect(serializeFilterState(null)).toBe('');
    expect(serializeFilterState(undefined)).toBe('');
    expect(serializeFilterState({})).toBe('');
  });

  it('round-trips a populated filter state', () => {
    const state = {
      topQuestions: 5,
      questionTypes: ['binary', 'rating'],
      sbtFilter: { mode: 'include', addresses: ['0x1'] },
      aiFilter: 'education policy',
      aiTopN: 7,
      aiCombine: true,
      selectedTags: ['testing'],
      responseStatus: null,
    };

    const encoded = serializeFilterState(state);
    expect(encoded).not.toBe('');

    const decoded = deserializeFilterState(encoded);
    expect(decoded).toEqual(state);
  });

  it('normalizes aiTopN to a positive integer and drops invalid values', () => {
    const activeAi = {
      ...defaultState,
      aiFilter: 'climate',
      aiTopN: '12',
    };
    const decodedActiveAi = deserializeFilterState(serializeFilterState(activeAi));
    expect(decodedActiveAi.aiFilter).toBe('climate');
    expect(decodedActiveAi.aiTopN).toBe(12);
    expect(decodedActiveAi.aiCombine).toBe(false);

    const invalidAiTopN = {
      ...defaultState,
      aiFilter: 'climate',
      aiTopN: 'not-a-number',
    };
    const decodedInvalidAiTopN = deserializeFilterState(serializeFilterState(invalidAiTopN));
    expect(decodedInvalidAiTopN.aiTopN).toBeNull();

    const inactiveAi = {
      ...defaultState,
      aiFilter: '',
      aiTopN: 9,
    };
    const decodedInactiveAi = deserializeFilterState(serializeFilterState(inactiveAi));
    expect(decodedInactiveAi.aiFilter).toBe('');
    expect(decodedInactiveAi.aiTopN).toBeNull();
    expect(decodedInactiveAi.aiCombine).toBe(false);
  });

  it('preserves aiCombine only when aiFilter is active', () => {
    const activeCombined = deserializeFilterState(
      serializeFilterState({
        ...defaultState,
        aiFilter: 'energy',
        aiTopN: 5,
        aiCombine: true,
      }),
    );
    expect(activeCombined.aiCombine).toBe(true);

    const inactiveCombined = deserializeFilterState(
      serializeFilterState({
        ...defaultState,
        aiFilter: '',
        aiTopN: 5,
        aiCombine: true,
      }),
    );
    expect(inactiveCombined.aiCombine).toBe(false);
  });

  it('round-trips responseStatus with canonical normalization', () => {
    const normalizeResponseStatus = (
      responseStatus: { responded?: boolean; notResponded?: boolean } | null | undefined,
    ): SurveyFilterState['responseStatus'] => {
      const responded = responseStatus?.responded === true;
      const notResponded = responseStatus?.notResponded === true;
      if ((responded && notResponded) || (!responded && !notResponded)) {
        return null;
      }
      return { responded, notResponded };
    };
    const roundTripResponseStatus = (
      responseStatus: { responded?: boolean; notResponded?: boolean } | null | undefined,
    ): SurveyFilterState['responseStatus'] => {
      const encoded = serializeFilterState({
        ...defaultState,
        responseStatus: normalizeResponseStatus(responseStatus),
      });
      return deserializeFilterState(encoded).responseStatus;
    };

    expect(roundTripResponseStatus({ responded: true, notResponded: false })).toEqual({
      responded: true,
      notResponded: false,
    });
    expect(roundTripResponseStatus({ responded: true, notResponded: true })).toBeNull();
    expect(roundTripResponseStatus({ responded: false, notResponded: false })).toBeNull();
  });

  it('drops extraneous keys during deserialization', () => {
    const withExtra: SurveyFilterStateInput = {
      ...defaultState,
      extra: 'ignore-me',
    };

    const encoded = serializeFilterState(withExtra);
    const decoded = deserializeFilterState(encoded);

    expect(decoded).toEqual(defaultState);
    expect((decoded as SurveyFilterStateInput).extra).toBeUndefined();
  });

  it('falls back to defaults for invalid input', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const decoded = deserializeFilterState('not-valid-base64');
    expect(decoded).toEqual(defaultState);
    spy.mockRestore();
  });

  it('strict deserialization throws on malformed input', () => {
    expect(() => deserializeFilterStateStrict('not-valid-base64')).toThrow();
  });

  it('strict deserialization preserves valid filter state normalization', () => {
    const encoded = serializeFilterState({
      ...defaultState,
      aiFilter: 'climate',
      aiTopN: '5',
      aiCombine: true,
    });

    expect(deserializeFilterStateStrict(encoded)).toEqual({
      ...defaultState,
      aiFilter: 'climate',
      aiTopN: 5,
      aiCombine: true,
    });
  });
});
