import { webcrypto } from 'crypto';
import {
  buildExternalInterviewKickoff,
  buildRealtimeInterviewInstructions,
  hashInterviewQuestions,
  normalizeInterviewQuestions,
  INTERVIEW_PROMPT_VERSION,
} from './sessionInterview';
import { orderInterviewQuestionPool, buildInterviewQuestionPriority } from './sessionInterviewQuestionOrder';
import { sortPileQuestionsByPriority } from './surveyPileQuestionFlow';

const pool = [
  { id: 'opening', type: 'freeform', prompt: 'Opening question', storageRef: { createdAt: '2026-10-28T10:00:00Z' } },
  {
    id: 'room-first',
    type: 'freeform',
    prompt: 'First breakout question',
    storageRef: { createdAt: '2026-10-29T10:00:00Z' },
  },
  {
    id: 'room-newest',
    type: 'freeform',
    prompt: 'Newest breakout question',
    storageRef: { createdAt: '2026-10-29T11:00:00Z' },
  },
];
const saved = { answers: { opening: { value: 'Private prior answer' } } };
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
});
afterAll(() => {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
});

it('leads the voice brief and personal AI prompt with newest unanswered questions without changing catalog hashes', async () => {
  const sorted = normalizeInterviewQuestions(orderInterviewQuestionPool(pool));
  const priority = buildInterviewQuestionPriority(sorted, saved);
  expect(priority).toEqual({
    unansweredQuestionIds: ['room-newest', 'room-first'],
    answeredQuestionIds: ['opening'],
    order: 'newest',
  });
  const instructions = buildRealtimeInterviewInstructions({
    questions: sorted.filter((q) => priority.unansweredQuestionIds.includes(q.id)),
  });
  expect(instructions).toContain('1. (freeform) Newest breakout question\n2. (freeform) First breakout question');
  expect(instructions).not.toContain(pool[0].prompt);
  const kickoff = buildExternalInterviewKickoff({
    workerUrl: 'https://worker.example',
    sessionSlug: 'workshop',
    sessionUrl: 'https://app.example/session/workshop',
    questionPriority: priority,
  });
  expect(kickoff).toContain('Unanswered question IDs, newest first: ["room-newest","room-first"]');
  expect(kickoff).toContain('"promptRevision":"ce-prefill-prompt-5",');
  expect(kickoff).toContain('Already answered IDs, only for changes I request: ["opening"]');
  expect(kickoff).not.toContain('Private prior answer');
  expect(kickoff.split('never a summary:\n')[1].split('\n')[0]).toBe(
    'https://worker.example/agent/interview-catalog?slug=workshop&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fworkshop',
  );
  expect(await hashInterviewQuestions(sorted)).toBe(await hashInterviewQuestions(normalizeInterviewQuestions(pool)));
  expect(INTERVIEW_PROMPT_VERSION).toBe('ce-interview-brief-v6');
  expect(pool[0].id).toBe('opening');
});

it('keeps the order the session lists its questions in when the session asks for it, dropping repeats, and says so to the AI', () => {
  const arranged = orderInterviewQuestionPool([...pool, pool[2]], 'arranged');
  expect(arranged.map((question) => (question as { id: string }).id)).toEqual(['opening', 'room-first', 'room-newest']);
  const priority = buildInterviewQuestionPriority(normalizeInterviewQuestions(arranged), saved, 'arranged');
  expect(priority).toEqual({
    unansweredQuestionIds: ['room-first', 'room-newest'],
    answeredQuestionIds: ['opening'],
    order: 'arranged',
  });
  const kickoff = buildExternalInterviewKickoff({
    workerUrl: 'https://worker.example',
    sessionSlug: 'workshop',
    sessionUrl: 'https://app.example/session/workshop',
    questionPriority: priority,
  });
  expect(kickoff).toContain('Unanswered question IDs, in the session’s order: ["room-first","room-newest"]');
  expect(kickoff).not.toContain('newest first');
  // Drafts made from this wording say so, as the voice's do.
  expect(kickoff).toContain('"promptRevision":"ce-prefill-prompt-5+arranged",');
});

it('takes the question pile’s own order when arranged: highlighted first, then the most answered', () => {
  // The voice and the prefill are given the pile's list, which the pile sorts by highlight and answer count.
  const pile = sortPileQuestionsByPriority({
    questions: pool,
    responseCounts: { 'room-first': 1, 'room-newest': 5 },
    highlightedQuestionIds: new Set(['opening']),
  });
  const ids = (list: unknown[]) => list.map((question) => (question as { id: string }).id);
  expect(ids(orderInterviewQuestionPool(pile, 'arranged'))).toEqual(['opening', 'room-newest', 'room-first']);
  expect(ids(orderInterviewQuestionPool(pile, 'newest'))).toEqual(['room-newest', 'room-first', 'opening']);
});

it('keeps unknown dates in their existing order and treats zero or locked answers as answered', () => {
  const unknown = [
    { id: 'one', prompt: 'One', type: 'rating' },
    { id: 'two', prompt: 'Two', type: 'freeform' },
  ];
  expect(orderInterviewQuestionPool(unknown)).toEqual(unknown);
  expect(
    buildInterviewQuestionPriority(normalizeInterviewQuestions(unknown), {
      answers: { one: { value: 0 }, two: { value: '*' } },
    }).answeredQuestionIds,
  ).toEqual(['one', 'two']);
});

it('only invites requested revisions when all questions are already answered', () => {
  const instructions = buildRealtimeInterviewInstructions({
    questions: normalizeInterviewQuestions(pool),
    onlyRevisions: true,
    openingPrompt: 'Repeat the opening',
  });
  expect(instructions).toContain('Ask which earlier answer, if any, the responder wants to change');
  expect(instructions).not.toContain('Ask this opening question immediately');
});

it('invites revisions when every question is answered, and otherwise lists answered prompts within a bound', () => {
  const all = normalizeInterviewQuestions(pool);
  expect(buildRealtimeInterviewInstructions({ questions: all, answeredQuestions: all })).toContain(
    'Ask which earlier answer, if any, the responder wants to change',
  );
  const many = normalizeInterviewQuestions(
    Array.from({ length: 60 }, (_, index) => ({
      id: `a${index}`,
      prompt: `${'Long answered prompt '.repeat(12)}${index}?`,
      type: 'freeform',
    })),
  );
  const instructions = buildRealtimeInterviewInstructions({ questions: all.slice(0, 1), answeredQuestions: many });
  expect(instructions).not.toContain('Ask which earlier answer');
  const list = instructions.slice(instructions.indexOf('Already answered (reference only'));
  expect(list.split('\n\n')[0].length).toBeLessThanOrEqual(4000);
  expect(instructions).toContain(`1. (freeform) ${all[0].prompt}`);
});

it('gives the answered list only the room the open questions leave', () => {
  const rows = (prefix: string, length: number) =>
    normalizeInterviewQuestions(
      Array.from({ length }, (_, index) => ({
        id: `${prefix}${index}`,
        prompt: `${'A long open question about council budgets '.repeat(6)}${index}?`,
        type: 'freeform',
      })),
    );
  const full = {
    questions: rows('o', 120),
    steeringPrompt: 's'.repeat(3000),
    sessionContext: 'c'.repeat(6000),
    previousTranscript: 'Interviewer: Why?\nResponder: Because.\n'.repeat(400),
  };
  const omitted = (text: string) => Number(/(\d+) question rows omitted/.exec(text)?.[1]);
  const without = buildRealtimeInterviewInstructions(full);
  const withAnswered = buildRealtimeInterviewInstructions({ ...full, answeredQuestions: rows('a', 60) });
  // Only the one-sentence steer costs room; the list itself takes what is left, so at most one row more is omitted.
  expect(omitted(withAnswered)).toBeLessThanOrEqual(omitted(without) + 1);
  expect(withAnswered.length).toBeLessThanOrEqual(31_500);
});

it('preserves the original eligible duplicate selection before sorting', async () => {
  const duplicatePool = [
    ...pool,
    {
      ...pool[0],
      prompt: 'A later duplicate must not replace the catalog entry',
      storageRef: { createdAt: '2026-10-30T12:00:00Z' },
    },
  ];
  expect(await hashInterviewQuestions(normalizeInterviewQuestions(orderInterviewQuestionPool(duplicatePool)))).toBe(
    await hashInterviewQuestions(normalizeInterviewQuestions(duplicatePool)),
  );
});
