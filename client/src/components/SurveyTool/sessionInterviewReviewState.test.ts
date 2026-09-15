import { appendInterviewTranscript, mergeInterviewReview } from './sessionInterviewReviewState';

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
    () => true,
  );
  expect(result.drafts.map((draft) => draft.questionId)).toEqual(['q1', 'q2', 'q3']);
  expect(result.edited.q1).toMatchObject({ answer: 'My edited answer', additionalComments: '', confidence: 0.9 });
  expect(result.edited.q2).toEqual(retained);
  expect(result.drafts[0].revisions?.map(({ answer }) => answer)).toEqual(['Old answer', 'New prediction']);
  expect(mergeInterviewReview(result.drafts, result.edited, result.selected, [result.drafts[0]], () => true).drafts[0].revisions).toHaveLength(2);
  expect(result.selected).toEqual({ q1: false, q2: true, q3: true });
  expect(
    mergeInterviewReview(
      [first],
      { q1: first },
      { q1: true },
      [{ ...first, answer: 'More complete answer' }],
      () => true,
    ).edited.q1.answer,
  ).toBe('More complete answer');
});

it('keeps transcript text intact and separates interview rounds without empty duplicates', () => {
  expect(appendInterviewTranscript('Responder: First.', 'Responder: Second.')).toBe(
    'Responder: First.\n\nResponder: Second.',
  );
  expect(appendInterviewTranscript('Responder: First.', '')).toBe('Responder: First.');
});
