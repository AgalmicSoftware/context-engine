import {
  addsToSavedAnswer,
  describeLeftOutDrafts,
  loadOwnContextForMapping,
  readAnswersThatStillFit,
  readAnswersToReconsider,
} from './sessionInterviewReconsideration';
import { loadContextSourcesForAi, type ContextSource } from '../../utilities/docLibrary/contextSources';

jest.mock('../../utilities/docLibrary/contextSources', () => ({
  loadContextSourcesForAi: jest.fn(async (sources: ContextSource[]) =>
    sources.map(({ title }) => ({ title, kind: 'file', url: '', text: `${title} text`, readByAi: false })),
  ),
}));

const question = (id: string) => ({ id, prompt: id, type: 'freeform', options: [] });
const source = (title: string, addedBy: string) => ({ id: title, title, addedBy }) as ContextSource;

describe('what a claim reconsiders', () => {
  it('offers saved answers with their comments, but not locked or empty ones', () => {
    const slice = {
      answers: { q1: { value: 'Yes' }, q2: { value: '*' }, q3: { value: '' } },
      additionalComments: { q1: { value: 'Because of cost' } },
    };
    expect(readAnswersToReconsider([question('q1'), question('q2'), question('q3'), question('q4')], slice)).toEqual([
      { questionId: 'q1', answer: 'Yes', additionalComments: 'Because of cost' },
    ]);
    expect(readAnswersToReconsider([question('q1')], null)).toEqual([]);
  });

  it('keeps answers someone encrypted out of the AI’s prompt, even once they’ve unlocked them here', () => {
    const slice = {
      answers: { q1: { value: 'Secret', encrypted: true }, q2: { value: 'Open' }, q3: { value: 'Open' } },
      additionalComments: {
        q1: { value: 'Secret reason' },
        q2: { value: 'Secret comment', encrypted: true },
        q3: { value: 'Open comment' },
      },
    };
    expect(readAnswersToReconsider([question('q1'), question('q2'), question('q3')], slice)).toEqual([
      { questionId: 'q2', answer: 'Open' },
      { questionId: 'q3', answer: 'Open', additionalComments: 'Open comment' },
    ]);
  });

  it('lists the fields someone has on the page but hasn’t submitted', () => {
    const slice = {
      answers: { q1: { value: 'No', unsubmitted: true }, q2: { value: 'Yes' }, q3: { value: 'Yes' } },
      additionalComments: {
        q2: { value: 'Typed just now', unsubmitted: true },
        // A comment that doesn't go to the AI isn't listed either.
        q3: { value: 'Secret', encrypted: true, unsubmitted: true },
      },
    };
    expect(readAnswersToReconsider([question('q1'), question('q2'), question('q3')], slice)).toEqual([
      { questionId: 'q1', answer: 'No', unsubmitted: ['answer'] },
      { questionId: 'q2', answer: 'Yes', additionalComments: 'Typed just now', unsubmitted: ['additionalComments'] },
      { questionId: 'q3', answer: 'Yes' },
    ]);
  });

  it('notices a comment that adds to a saved answer or sits beside a locked comment, but not a repeat or a locked answer', () => {
    const slice = {
      answers: { q1: { value: 'Yes' }, q2: { value: '*' }, q3: { value: 'Yes' }, q4: { value: 'Yes' } },
      additionalComments: { q1: { value: 'Cost' }, q3: { value: '*' }, q4: { value: 'Cost, and people' } },
    };
    const draft = (questionId: string, additionalComments?: string) => ({
      questionId,
      answer: 'Yes',
      additionalComments,
    });
    expect(addsToSavedAnswer(draft('q1', 'Cost, and people'), slice)).toBe(true);
    expect(addsToSavedAnswer(draft('q1', ' Cost '), slice)).toBe(false);
    expect(addsToSavedAnswer(draft('q1'), slice)).toBe(false);
    expect(addsToSavedAnswer(draft('q2', 'More'), slice)).toBe(false);
    expect(addsToSavedAnswer(undefined, slice)).toBe(false);
    // A locked comment can't be compared, so any comment is offered beside it; part of a comment adds nothing.
    expect(addsToSavedAnswer(draft('q3', 'More'), slice)).toBe(true);
    expect(addsToSavedAnswer(draft('q3'), slice)).toBe(false);
    expect(addsToSavedAnswer(draft('q4', 'cost'), slice)).toBe(false);
  });

  it('counts as still fitting only the answers the AI was given and repeated', () => {
    const questions = [question('q1'), question('q2'), question('q3'), { ...question('q4'), type: 'rating' }];
    const reconsidered = [
      { questionId: 'q1', answer: 'Yes' },
      { questionId: 'q2', answer: 'Yes' },
      { questionId: 'q4', answer: '7' },
    ];
    const drafts = [
      // Left out without repeating it: an AI prefill's prediction can't overrule an answer.
      { questionId: 'q2', answer: 'No' },
      // A locked answer never reached the AI.
      { questionId: 'q3', answer: 'Yes' },
      { questionId: 'q1', answer: 'Yes' },
      { questionId: 'q4', answer: 7 },
    ];
    expect(readAnswersThatStillFit(['q1', 'q2', 'q3', 'q4'], drafts, reconsidered, questions)).toEqual(['q1', 'q4']);
  });

  it('says which answers still fit and which drafts were left out for answered questions', () => {
    expect(describeLeftOutDrafts(['q1'], ['q1'], false)).toBe('One of your answers still fits, so it stays as it is.');
    expect(describeLeftOutDrafts(['q1', 'q2', 'q3'], ['q1', 'q2'], false)).toBe(
      '2 of your answers still fit, so they stay as they are. Left out 1 draft for a question you’ve already answered.',
    );
    expect(describeLeftOutDrafts(['q3'], ['q1'], false)).toBe(
      'You’ve already answered the question this draft covers.',
    );
    expect(describeLeftOutDrafts(['q3', 'q4'], [], false)).toBe(
      'You’ve already answered every question these drafts cover.',
    );
    expect(describeLeftOutDrafts(['q3', 'q4'], [], true)).toBe(
      'Left out 2 drafts for questions you’ve already answered.',
    );
    expect(describeLeftOutDrafts([], ['q1'], true)).toBe('');
  });

  it('reads only the files this person added', async () => {
    const options = { sessionSlug: 's', sessionConfig: {}, context: { account: '0xAAA' } };
    const text = await loadOwnContextForMapping([source('mine.txt', '0xaaa'), source('theirs.txt', '0xbbb')], options);
    expect(text).toContain('mine.txt text');
    expect(text).not.toContain('theirs.txt');
    jest.mocked(loadContextSourcesForAi).mockClear();
    expect(await loadOwnContextForMapping([source('theirs.txt', '0xbbb')], options)).toBe('');
    expect(await loadOwnContextForMapping([source('mine.txt', '0xaaa')], { ...options, context: {} })).toBe('');
    expect(loadContextSourcesForAi).not.toHaveBeenCalled();
  });
});
