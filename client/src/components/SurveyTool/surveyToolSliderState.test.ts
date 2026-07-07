import {
  buildSliderModeStatePatch,
  buildSliderPersistOptions,
  getQuestionConvictionSliderValue,
  getQuestionImportanceSliderValue,
  getQuestionSliderMode,
  normalizeSliderMode,
  shouldExpandSliderToggle,
} from './surveyToolSliderState.js';

describe('surveyToolSliderState', () => {
  it('normalizes slider modes and preserves existing question state when toggled open', () => {
    expect(normalizeSliderMode('importance')).toBe('importance');
    expect(normalizeSliderMode('anything-else')).toBe('conviction');

    expect(
      buildSliderModeStatePatch(
        {
          sliderModeByQuestion: { q1: 'conviction' },
          sliderToggleExpandedByQuestion: { q1: true },
        },
        'q2',
        'importance',
      ),
    ).toEqual({
      sliderModeByQuestion: {
        q1: 'conviction',
        q2: 'importance',
      },
      sliderToggleExpandedByQuestion: {
        q1: true,
        q2: true,
      },
    });
  });

  it('derives slider mode from explicit state first and from importance responses otherwise', () => {
    expect(
      getQuestionSliderMode({
        explicitMode: 'importance',
        questionId: 'q1',
        surveysResponseState: {
          0: {
            importance: { q1: 7 },
          },
        },
      }),
    ).toBe('importance');

    expect(
      getQuestionSliderMode({
        questionId: 'q1',
        surveysResponseState: {
          0: {
            importance: { q1: 7 },
          },
        },
        isStandalone: true,
      }),
    ).toBe('importance');

    expect(
      getQuestionSliderMode({
        questionId: 'q1',
        surveysResponseState: {
          2: {
            importance: { q1: 7 },
          },
        },
        surveyIndex: 2,
      }),
    ).toBe('importance');

    expect(
      getQuestionSliderMode({
        questionId: 'q1',
        surveysResponseState: {
          0: {
            conviction: { q1: 4 },
          },
        },
      }),
    ).toBe('conviction');
  });

  it('expands the toggle when the question was opened or when importance mode is active', () => {
    expect(
      shouldExpandSliderToggle({
        sliderToggleExpandedByQuestion: { q1: true },
        questionId: 'q1',
        sliderMode: 'conviction',
      }),
    ).toBe(true);

    expect(
      shouldExpandSliderToggle({
        sliderToggleExpandedByQuestion: {},
        questionId: 'q1',
        sliderMode: 'importance',
      }),
    ).toBe(true);

    expect(
      shouldExpandSliderToggle({
        sliderToggleExpandedByQuestion: {},
        questionId: 'q1',
        sliderMode: 'conviction',
      }),
    ).toBe(false);
  });

  it('keeps slider draft persistence and numeric response fallbacks stable', () => {
    expect(buildSliderPersistOptions({ type: 'keydown' })).toEqual({ persistDraft: true });
    expect(buildSliderPersistOptions({ type: 'mousemove' })).toEqual({ persistDraft: false });

    const slice = {
      conviction: { q1: '5' },
      importance: { q2: '7' },
    };

    expect(getQuestionConvictionSliderValue(slice, 'q1')).toBe(5);
    expect(getQuestionConvictionSliderValue(slice, 'q2')).toBe(0);
    expect(getQuestionImportanceSliderValue(slice, 'q2')).toBe(7);
    expect(getQuestionImportanceSliderValue(slice, 'q1')).toBe(0);
  });
});
