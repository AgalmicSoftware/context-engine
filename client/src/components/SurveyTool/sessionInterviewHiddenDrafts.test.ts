import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import {
  describeInterviewGuess,
  hideableInterviewDraftIds,
  pickHiddenInterviewDrafts,
  revealsOnAnswer,
  withoutAiDraft,
} from './sessionInterviewHiddenDrafts';
import type { InterviewPrefillPacket, InterviewQuestion } from './sessionInterview';

const question = (id: string, type: string, extra: Partial<InterviewQuestion> = {}): InterviewQuestion => ({
  id,
  prompt: id,
  type,
  options: [],
  ...extra,
});
const ids = Array.from({ length: 10 }, (_, index) => `q${index}`);

describe('pickHiddenInterviewDrafts', () => {
  it('hides the same drafts for a person every time, and different ones for others', () => {
    const first = pickHiddenInterviewDrafts(ids, 0.2, 'demo|alice');
    expect(first).toHaveLength(2);
    expect(pickHiddenInterviewDrafts(ids, 0.2, 'demo|alice')).toEqual(first);
    const others = new Set(
      Array.from({ length: 20 }, (_, index) => pickHiddenInterviewDrafts(ids, 0.2, `demo|p${index}`).join()),
    );
    expect(others.size).toBeGreaterThan(10);
  });

  it('gives every draft about the same chance of being hidden', () => {
    const counts = Object.fromEntries(ids.map((id) => [id, 0]));
    for (let index = 0; index < 2000; index += 1) {
      for (const id of pickHiddenInterviewDrafts(ids, 0.2, `demo|p${index}`)) counts[id] += 1;
    }
    // Each is hidden for 1 in 5 people: 400 of 2000, give or take sampling noise.
    for (const count of Object.values(counts)) expect(Math.abs(count - 400)).toBeLessThan(80);
  });

  it('rounds the share and hides at least one of three or more', () => {
    expect(pickHiddenInterviewDrafts(ids.slice(0, 3), 0.2, 'demo|a')).toHaveLength(1);
    expect(pickHiddenInterviewDrafts(ids.slice(0, 2), 0.2, 'demo|a')).toHaveLength(0);
    expect(pickHiddenInterviewDrafts(ids.slice(0, 8), 0.5, 'demo|a')).toHaveLength(4);
    expect(pickHiddenInterviewDrafts(ids, 0, 'demo|a')).toEqual([]);
  });
});

describe('hideableInterviewDraftIds', () => {
  const packet = {
    version: 1,
    sessionSlug: 'demo',
    source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
    responderContext: {},
  } as InterviewPrefillPacket;
  const questions = [
    question('b', 'binary'),
    question('r', 'rating'),
    question('f', 'freeform'),
    question('s', 'binary'),
  ];
  const prefilled = (questionId: string, answer: unknown = 'Agree') => ({
    questionId,
    answer,
    revisions: [{ revision: 1, modelId: 'claude-test', answer }],
  });

  it('keeps structured AI prefill drafts for questions the person has not answered', () => {
    const drafts = [prefilled('b'), prefilled('r', 7), prefilled('f', 'Text'), prefilled('s'), prefilled('b2')];
    expect(hideableInterviewDraftIds(drafts, questions, packet, (id) => id === 's')).toEqual(['b', 'r']);
  });

  it('never hides voice, typed-context or empty drafts', () => {
    const voice = {
      questionId: 'b',
      answer: 'Agree',
      revisions: [{ revision: 1, modelId: DEFAULT_AI_MODEL, answer: 'Agree' }],
    };
    expect(hideableInterviewDraftIds([voice], questions, packet, () => false)).toEqual([]);
    expect(hideableInterviewDraftIds([prefilled('b')], questions, null, () => false)).toEqual([]);
    const typed = { ...packet, source: { ...packet.source, modelId: 'direct-user-context' } };
    expect(hideableInterviewDraftIds([prefilled('b')], questions, typed, () => false)).toEqual([]);
    expect(hideableInterviewDraftIds([prefilled('b', '')], questions, packet, () => false)).toEqual([]);
  });
});

it('reveals one-click answers at once and the rest once the person moves on', () => {
  expect(revealsOnAnswer(question('b', 'binary'))).toBe(true);
  expect(revealsOnAnswer(question('s', 'multichoice', { singleSelect: true }))).toBe(true);
  expect(revealsOnAnswer(question('m', 'multichoice'))).toBe(false);
  expect(revealsOnAnswer(question('r', 'rating'))).toBe(false);
  expect(revealsOnAnswer(question('q', 'quadratic'))).toBe(false);
});

it('shows a hidden draft with only the fields the person set', () => {
  const edited = {
    questionId: 'b',
    answer: 'Disagree',
    additionalComments: 'AI comment',
    importance: 8,
    conviction: 6,
    evidence: 'Private notes',
    confidence: 0.9,
  };
  expect(withoutAiDraft(edited, 'Saved note')).toEqual({
    questionId: 'b',
    answer: undefined,
    additionalComments: 'Saved note',
  });
  expect(withoutAiDraft({ ...edited, userEditedFields: ['answer', 'conviction'] })).toEqual({
    questionId: 'b',
    answer: 'Disagree',
    additionalComments: '',
    conviction: 6,
    userEditedFields: ['answer', 'conviction'],
  });
});

it('describes the hidden guess for each question type', () => {
  const guess = (type: string, answer: unknown, extra: Partial<InterviewQuestion> = {}, confidence?: number) =>
    describeInterviewGuess({ questionId: 'q', answer, confidence }, question('q', type, extra));
  expect(guess('binary', 'Agree', {}, 0.7)).toBe('Your AI guessed: Agree · 70% sure');
  expect(guess('multichoice', ['A', 'C'])).toBe('Your AI guessed: A, C');
  expect(guess('rating', 7, { scale: { min: 0, max: 10 } } as Partial<InterviewQuestion>, 0.55)).toBe(
    'Your AI guessed: 7 of 10 · 55% sure',
  );
  expect(guess('quadratic', [1, -3, 0], { options: ['P', 'Q', 'R'] })).toBe('Your AI guessed: Q -3, P +1');
  // A later revision doesn't change what was hidden.
  expect(
    describeInterviewGuess(
      {
        questionId: 'q',
        answer: 'Disagree',
        confidence: 0.4,
        revisions: [{ revision: 1, modelId: 'm', answer: 'Agree', confidence: 0.8 }],
      },
      question('q', 'binary'),
    ),
  ).toBe('Your AI guessed: Agree · 80% sure');
});
