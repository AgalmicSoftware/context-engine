import {
  addsToSavedAnswer,
  loadOwnContextForMapping,
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

  it('notices a comment that adds to a saved answer, but not a repeat or a locked answer', () => {
    const slice = {
      answers: { q1: { value: 'Yes' }, q2: { value: '*' } },
      additionalComments: { q1: { value: 'Cost' } },
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
