import { normalizeUserAnalysisBreakdown } from './userAnalysisBreakdown';

const COMMENT =
  "If people can't see  how a decision was made, they won't trust it. It would be wrong to say we should ban AI.";
const userData = {
  address: '0x00000000000000000000000000000000000000aa',
  sbts: [{ name: 'Riverside residents group', address: '0x00000000000000000000000000000000000000cc' }],
  questions: [
    { type: 'binary', prompt: 'Local councils should set the budget.', answer: 'Agree', additionalComment: COMMENT },
    {
      type: 'freeform',
      prompt: 'What else should we know?',
      answer: 'Keep hearings public.\nPublish the minutes too!',
    },
    { type: 'multichoice', prompt: 'Pick the options you back.', answer: 'A long option label someone else wrote' },
    { type: 'quadratic', prompt: 'Spend your credits.', options: ['Night buses for everyone'], answer: [3] },
  ],
  surveys: [
    {
      title: 'A survey title somebody else wrote',
      sample: [
        {
          type: 'rating',
          prompt: 'Rate the plan from one to ten.',
          answer: 7,
          additionalComment: 'Seven, because it is untested.',
        },
      ],
      additionalCommentsSample: ['Trials first, then a vote.'],
    },
  ],
  questionsCreated: [{ type: 'binary', prompt: 'A question this person created themselves.' }],
};
const quoted = (ownWords: unknown) => normalizeUserAnalysisBreakdown({ holds: 'h', ownWords }, userData)?.ownWords;

describe('normalizeUserAnalysisBreakdown', () => {
  it('keeps each line as one short line', () => {
    const breakdown = normalizeUserAnalysisBreakdown(
      { holds: '  Local councils\n should decide. ', openTo: 'x'.repeat(400), unsure: 7, ownWords: '' },
      userData,
    );
    expect(breakdown).toEqual({
      holds: 'Local councils should decide.',
      openTo: 'x'.repeat(160),
      unsure: '',
      ownWords: '',
    });
  });

  it('shows the sentence as the person wrote it, whatever case, spacing or quote marks the model used', () => {
    expect(quoted('“IF people can’t see how a decision was made, they won’t trust it”')).toBe(
      "If people can't see how a decision was made, they won't trust it.",
    );
    expect(quoted('Publish the minutes too')).toBe('Publish the minutes too!');
    expect(quoted('Seven, because it is untested.')).toBe('Seven, because it is untested.');
    expect(quoted('trials first, then a vote.')).toBe('Trials first, then a vote.');
    // A whole free-text answer of two sentences is theirs too.
    expect(quoted('Keep hearings public. Publish the minutes too!')).toBe(
      'Keep hearings public. Publish the minutes too!',
    );
  });

  it('never quotes words the person did not write', () => {
    // The question they agreed with, an option, a title, a group name, a question they created, the address.
    expect(quoted('Local councils should set the budget.')).toBe('');
    expect(quoted('A long option label someone else wrote')).toBe('');
    expect(quoted('Night buses for everyone')).toBe('');
    expect(quoted('A survey title somebody else wrote')).toBe('');
    expect(quoted('Riverside residents group')).toBe('');
    expect(quoted('A question this person created themselves.')).toBe('');
    expect(quoted('0x00000000000000000000000000000000000000aa')).toBe('');
    // A paraphrase, and words that are not text at all.
    expect(quoted('People only trust decisions they can see being made.')).toBe('');
    expect(quoted({ text: 'Keep hearings public.' })).toBe('');
  });

  it('never quotes a clause cut out of a sentence, which can say the opposite', () => {
    expect(quoted('we should ban AI')).toBe('');
    expect(quoted('they won’t trust it.')).toBe('');
    expect(quoted('It would be wrong to say we should ban AI.')).toBe('It would be wrong to say we should ban AI.');
    // Too short to be told from chance.
    expect(
      normalizeUserAnalysisBreakdown(
        { ownWords: 'Yes, agreed.' },
        { questions: [{ type: 'freeform', answer: 'Yes, agreed.' }] },
      ),
    ).toBeNull();
  });

  it('keeps a quote stored with an earlier analysis, which was found when it was made', () => {
    expect(normalizeUserAnalysisBreakdown({ ownWords: 'A sentence kept from before.' })?.ownWords).toBe(
      'A sentence kept from before.',
    );
  });

  it('gives nothing where the reply had no breakdown', () => {
    expect(normalizeUserAnalysisBreakdown(undefined, userData)).toBeNull();
    expect(normalizeUserAnalysisBreakdown(['holds'], userData)).toBeNull();
    expect(
      normalizeUserAnalysisBreakdown({ holds: ' ', ownWords: 'Never written by them at all.' }, userData),
    ).toBeNull();
  });
});
