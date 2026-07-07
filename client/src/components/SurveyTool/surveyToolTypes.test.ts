import { buildEmptyResponseSlice, isSurveyToolRecord } from './surveyToolTypes.js';

describe('surveyToolTypes', () => {
  it('builds fresh empty response slices', () => {
    const first = buildEmptyResponseSlice();
    const second = buildEmptyResponseSlice();

    expect(first).toEqual({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.answers).not.toBe(first.answers);
    expect(second.importance).not.toBe(first.importance);
    expect(second.conviction).not.toBe(first.conviction);
    expect(second.additionalComments).not.toBe(first.additionalComments);
  });

  it('detects plain record-like values', () => {
    expect(isSurveyToolRecord({ q1: true })).toBe(true);
    expect(isSurveyToolRecord(Object.create(null))).toBe(true);
    expect(isSurveyToolRecord(null)).toBe(false);
    expect(isSurveyToolRecord([])).toBe(false);
    expect(isSurveyToolRecord('value')).toBe(false);
    expect(isSurveyToolRecord(0)).toBe(false);
  });
});
