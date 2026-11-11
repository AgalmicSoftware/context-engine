import React, { useState } from 'react';
import { act, render } from '@testing-library/react';
import {
  addsToInterviewComment,
  interviewCommentChoices,
  startingInterviewComment,
  useStartingInterviewComments,
} from './sessionInterviewComments';
import type { InterviewDraftResponse } from './sessionInterview';

describe('a draft comment beside the person’s own', () => {
  it('adds only what their comment doesn’t already say, ignoring case and spacing', () => {
    expect(addsToInterviewComment('Cost', 'Cost, and people')).toBe(true);
    expect(addsToInterviewComment('Cost, and people', ' cost ')).toBe(false);
    expect(addsToInterviewComment('Cost', '')).toBe(false);
    expect(addsToInterviewComment('', 'New')).toBe(true);
  });

  it('starts from their comment followed by the AI’s, never dropping theirs', () => {
    expect(startingInterviewComment('With a small rota', 'Mine first ')).toBe('Mine first\n\nWith a small rota');
    expect(startingInterviewComment('', 'Mine first')).toBe('Mine first');
    expect(startingInterviewComment('AI only', undefined)).toBe('AI only');
    // A proposal that already holds theirs, or says nothing new, isn't doubled.
    expect(startingInterviewComment('Cost, and people', 'Cost')).toBe('Cost, and people');
    expect(startingInterviewComment('cost', 'Cost, and people')).toBe('Cost, and people');
    // A locked comment can't be read, so it stays until they choose otherwise.
    expect(startingInterviewComment('AI only', '*')).toBe('');
  });

  it.each([
    ['Agree', 'I disagree with the cost.'],
    ['No', 'Not sure the budget covers it.'],
    ['Yes', 'My eyes are on transit.'],
    ['ok', 'Look at the housing numbers.'],
  ])('keeps "%s" when the AI’s comment holds it only inside a word: %s', (own, proposed) => {
    const joined = `${own}\n\n${proposed}`;
    expect(addsToInterviewComment(own, proposed)).toBe(true);
    expect(startingInterviewComment(proposed, own)).toBe(joined);
    expect(interviewCommentChoices(proposed, own)).toEqual([
      { label: 'Both', value: joined },
      { label: 'Mine', value: own },
      { label: 'AI’s', value: proposed },
    ]);
    // Their own comment holding the AI's only inside a word still gets it added.
    expect(addsToInterviewComment(proposed, own)).toBe(true);
  });

  it('offers distinct quick choices only when both comments exist and differ', () => {
    expect(interviewCommentChoices('With a rota', 'Mine')).toEqual([
      { label: 'Both', value: 'Mine\n\nWith a rota' },
      { label: 'Mine', value: 'Mine' },
      { label: 'AI’s', value: 'With a rota' },
    ]);
    expect(interviewCommentChoices('Cost, and people', 'Cost')).toEqual([
      { label: 'Both', value: 'Cost, and people' },
      { label: 'Mine', value: 'Cost' },
    ]);
    expect(interviewCommentChoices('With a rota', '*')).toEqual([
      { label: 'Mine', value: '' },
      { label: 'AI’s', value: 'With a rota' },
    ]);
    expect(interviewCommentChoices('With a rota', '')).toEqual([]);
    expect(interviewCommentChoices('', 'Mine')).toEqual([]);
    expect(interviewCommentChoices('Mine', 'Mine')).toEqual([]);
  });
});

describe('keeping untouched comments joined', () => {
  const Review = ({
    drafts,
    responses,
    initial,
    onEdited,
  }: {
    drafts: InterviewDraftResponse[];
    responses: Record<string, unknown> | null;
    initial: Record<string, InterviewDraftResponse>;
    onEdited: (edited: Record<string, InterviewDraftResponse>) => void;
  }) => {
    const [edited, setEdited] = useState(initial);
    useStartingInterviewComments(drafts, responses, setEdited);
    onEdited(edited);
    return null;
  };
  const comments = (values: Record<string, string>) => ({
    additionalComments: Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value }])),
  });

  it('joins a comment that loads after the drafts, but leaves a comment the person changed', () => {
    const drafts = [
      { questionId: 'q1', answer: 'Yes', additionalComments: 'With a rota' },
      { questionId: 'q2', answer: 'No', additionalComments: 'Too costly' },
    ];
    const initial = {
      q1: { ...drafts[0] },
      q2: { ...drafts[1], additionalComments: 'My own words', userEditedFields: ['additionalComments' as const] },
    };
    let latest: Record<string, InterviewDraftResponse> = {};
    const onEdited = (edited: Record<string, InterviewDraftResponse>) => (latest = edited);
    const view = render(React.createElement(Review, { drafts, responses: null, initial, onEdited }));
    expect(latest.q1.additionalComments).toBe('With a rota');

    act(() => {
      view.rerender(
        React.createElement(Review, {
          drafts,
          responses: comments({ q1: 'Saved first', q2: 'Saved too' }),
          initial,
          onEdited,
        }),
      );
    });
    expect(latest.q1.additionalComments).toBe('Saved first\n\nWith a rota');
    expect(latest.q2.additionalComments).toBe('My own words');
  });
});
