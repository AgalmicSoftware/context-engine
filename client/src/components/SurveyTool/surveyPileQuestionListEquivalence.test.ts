import {
  arePileQuestionListsEquivalent,
} from './surveyPileQuestionListEquivalence.js';

const getQuestionObjectSignature = (question: any): string => (
  `${String(question?.id || '').trim().toLowerCase()}|${String(question?.prompt || '')}`
);

describe('surveyPileQuestionListEquivalence', () => {
  it('accepts the same list reference without reading signatures', () => {
    const list = [{ id: 'q1', prompt: 'One' }];
    const signatureSpy = jest.fn(getQuestionObjectSignature);

    expect(arePileQuestionListsEquivalent({
      getQuestionObjectSignature: signatureSpy,
      left: list,
      right: list,
    })).toBe(true);
    expect(signatureSpy).not.toHaveBeenCalled();
  });

  it('rejects non-list, length, id, and signature mismatches', () => {
    expect(arePileQuestionListsEquivalent({
      getQuestionObjectSignature,
      left: null,
      right: [],
    })).toBe(false);

    expect(arePileQuestionListsEquivalent({
      getQuestionObjectSignature,
      left: [{ id: 'q1' }],
      right: [{ id: 'q1' }, { id: 'q2' }],
    })).toBe(false);

    expect(arePileQuestionListsEquivalent({
      getQuestionObjectSignature,
      left: [{ id: 'q1', prompt: 'One' }],
      right: [{ id: 'q2', prompt: 'One' }],
    })).toBe(false);

    expect(arePileQuestionListsEquivalent({
      getQuestionObjectSignature,
      left: [{ id: 'q1', prompt: 'One' }],
      right: [{ id: 'Q1', prompt: 'Two' }],
    })).toBe(false);
  });

  it('accepts equivalent ids and signatures', () => {
    expect(arePileQuestionListsEquivalent({
      getQuestionObjectSignature,
      left: [{ id: 'q1', prompt: 'One' }, { id: 'Q2', prompt: 'Two' }],
      right: [{ id: 'Q1', prompt: 'One' }, { id: 'q2', prompt: 'Two' }],
    })).toBe(true);
  });
});
