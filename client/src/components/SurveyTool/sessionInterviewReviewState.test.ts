import {
  appendInterviewTranscript,
  changesEarlierAnswer,
  mergeInterviewReview,
  overrulesSavedAnswer,
} from './sessionInterviewReviewState';

const noAnswers = () => undefined;

it('updates untouched AI fields, preserves edits and exclusions, and retains unmatched drafts', () => {
  const first = { questionId: 'q1', answer: 'Old answer', additionalComments: 'Old comment', confidence: 0.5 };
  const retained = { questionId: 'q2', answer: 4 };
  const result = mergeInterviewReview(
    [first, retained],
    {
      q1: { ...first, answer: 'My edited answer', additionalComments: '' },
      q2: retained,
    },
    { q1: false, q2: true },
    [
      { questionId: 'q1', answer: 'New prediction', additionalComments: 'New comment', confidence: 0.9 },
      { questionId: 'q3', answer: 'New match' },
    ],
    noAnswers,
  );
  expect(result.drafts.map((draft) => draft.questionId)).toEqual(['q1', 'q2', 'q3']);
  expect(result.edited.q1).toMatchObject({ answer: 'My edited answer', additionalComments: '', confidence: 0.9 });
  expect(result.edited.q2).toEqual(retained);
  expect(result.drafts[0].revisions?.map(({ answer }) => answer)).toEqual(['Old answer', 'New prediction']);
  expect(
    mergeInterviewReview(result.drafts, result.edited, result.selected, [result.drafts[0]], noAnswers).drafts[0]
      .revisions,
  ).toHaveLength(2);
  expect(result.selected).toEqual({ q1: false, q2: true, q3: true });
  expect(
    mergeInterviewReview(
      [first],
      { q1: first },
      { q1: true },
      [{ ...first, answer: 'More complete answer' }],
      noAnswers,
    ).edited.q1.answer,
  ).toBe('More complete answer');
});

it('leaves out new drafts for answered questions but keeps updating drafts already under review', () => {
  const submitted = { questionId: 'q1', answer: 'First prediction' };
  const answers: Record<string, unknown> = { q1: 'First prediction', q2: 'Already answered' };
  const result = mergeInterviewReview(
    [submitted],
    { q1: submitted },
    { q1: true },
    [
      { questionId: 'q1', answer: 'Refined prediction' },
      { questionId: 'q2', answer: 'Something else' },
      { questionId: 'q3', answer: 'New match' },
    ],
    // q1 was answered by submitting its draft; q2 was answered before. An AI prefill never overrules.
    (id) => answers[id],
  );
  expect(result.drafts.map(({ questionId, answer }) => [questionId, answer])).toEqual([
    ['q1', 'Refined prediction'],
    ['q3', 'New match'],
  ]);
  expect(result.edited.q1.answer).toBe('Refined prediction');
  expect(result.selected).toEqual({ q1: true, q3: true });
  expect(result.edited).not.toHaveProperty('q2');
  expect(result.leftOut).toEqual(['q2']);
});

it('adds the person’s own differing answer and leaves out one that repeats their answer', () => {
  const answers: Record<string, unknown> = {
    same: 'Agree',
    sameNumber: '7',
    sameChoices: ['Parks', 'Transit'],
    changed: 'Agree',
    changedVotes: [3, -4],
    locked: '*',
  };
  const result = mergeInterviewReview(
    [],
    {},
    {},
    [
      { questionId: 'same', answer: 'Agree' },
      { questionId: 'sameNumber', answer: 7 },
      { questionId: 'sameChoices', answer: ['Parks', 'Transit'] },
      { questionId: 'changed', answer: 'Disagree' },
      { questionId: 'changedVotes', answer: [3, -2] },
      { questionId: 'locked', answer: 'Disagree' },
      { questionId: 'open', answer: 'New' },
    ],
    (id) => answers[id],
    undefined,
    undefined,
    () => true,
  );
  expect(result.drafts.map(({ questionId }) => questionId)).toEqual(['changed', 'changedVotes', 'open']);
  expect(result.selected).toEqual({ changed: true, changedVotes: true, open: true });
  expect(result.leftOut).toEqual(['same', 'sameNumber', 'sameChoices', 'locked']);
});

it('lets only drafts from the person’s own words overrule an answer', () => {
  const result = mergeInterviewReview(
    [],
    {},
    {},
    [
      { questionId: 'spoken', answer: 'Disagree' },
      { questionId: 'echoed', answer: 'Disagree' },
    ],
    () => 'Agree',
    undefined,
    undefined,
    // An AI prefill's prediction handed back by the mapper is not the person's evidence.
    (draft) => draft.questionId === 'spoken',
  );
  expect(result.drafts.map(({ questionId }) => questionId)).toEqual(['spoken']);
  expect(result.selected).toEqual({ spoken: true });
  expect(result.leftOut).toEqual(['echoed']);
});

it('says when submitting an answer would change an earlier one', () => {
  expect(changesEarlierAnswer('Disagree', 'Agree')).toBe(true);
  expect(changesEarlierAnswer(['Transit', 'Parks'], ['Parks', 'Transit'])).toBe(false);
  expect(changesEarlierAnswer('Agree', undefined)).toBe(false);
  expect(changesEarlierAnswer('Agree', '')).toBe(false);
  // A locked earlier answer can't be read, so it might change.
  expect(changesEarlierAnswer('Agree', '*')).toBe(true);
});

it('compares answers the way the form does, and never against a locked answer', () => {
  expect(overrulesSavedAnswer('Disagree', 'Agree')).toBe(true);
  expect(overrulesSavedAnswer(7, '7')).toBe(false);
  expect(overrulesSavedAnswer(['Parks'], ['Parks', 'Transit'])).toBe(true);
  expect(overrulesSavedAnswer([1, -1], [1, -1])).toBe(false);
  // The same choices in another order are the same answer; votes are per option, so order counts.
  expect(overrulesSavedAnswer(['Transit', 'Parks'], ['Parks', 'Transit'])).toBe(false);
  expect(overrulesSavedAnswer([-1, 1], [1, -1])).toBe(true);
  expect(overrulesSavedAnswer('Disagree', '*')).toBe(false);
});

it('keeps transcript text intact and separates interview rounds without empty duplicates', () => {
  expect(appendInterviewTranscript('Responder: First.', 'Responder: Second.')).toBe(
    'Responder: First.\n\nResponder: Second.',
  );
  expect(appendInterviewTranscript('Responder: First.', '')).toBe('Responder: First.');
});

it('keeps a user edit across later predictions that first agree and then diverge', () => {
  const first = { questionId: 'q1', answer: 'First prediction' };
  const agreeing = mergeInterviewReview(
    [first],
    { q1: { ...first, answer: 'My answer' } },
    { q1: true },
    [{ ...first, answer: 'My answer' }],
    noAnswers,
  );
  const diverging = mergeInterviewReview(
    agreeing.drafts,
    agreeing.edited,
    agreeing.selected,
    [{ ...first, answer: 'Later prediction' }],
    noAnswers,
  );
  expect(diverging.edited.q1.answer).toBe('My answer');
  expect(diverging.drafts[0].answer).toBe('Later prediction');
  expect(diverging.drafts[0].revisions?.map(({ answer }) => answer)).toEqual([
    'First prediction',
    'My answer',
    'Later prediction',
  ]);
});

it('treats an untouched empty comment as the AI draft without one', () => {
  // The modal seeds '' as the comment for drafts that arrive without one.
  const first = { questionId: 'q1', answer: 'First prediction' };
  const result = mergeInterviewReview(
    [first],
    { q1: { ...first, additionalComments: '' } },
    { q1: true },
    [{ ...first, additionalComments: 'New AI note' }],
    noAnswers,
  );
  expect(result.edited.q1.additionalComments).toBe('New AI note');
  expect(result.edited.q1.userEditedFields).toBeUndefined();
});
