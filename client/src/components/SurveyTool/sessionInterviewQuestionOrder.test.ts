import { webcrypto } from 'crypto';
import {
  buildExternalInterviewKickoff,
  buildRealtimeInterviewInstructions,
  hashInterviewQuestions,
  normalizeInterviewQuestions,
  INTERVIEW_PROMPT_VERSION,
} from './sessionInterview';
import { sortInterviewQuestionPoolNewestFirst, buildInterviewQuestionPriority } from './sessionInterviewQuestionOrder';

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
  const sorted = normalizeInterviewQuestions(sortInterviewQuestionPoolNewestFirst(pool));
  const priority = buildInterviewQuestionPriority(sorted, saved);
  expect(priority).toEqual({ unansweredQuestionIds: ['room-newest', 'room-first'], answeredQuestionIds: ['opening'] });
  const instructions = buildRealtimeInterviewInstructions({
    questions: sorted.filter((q) => priority.unansweredQuestionIds.includes(q.id)),
  });
  expect(instructions.indexOf('[room-newest]')).toBeLessThan(instructions.indexOf('[room-first]'));
  expect(instructions).not.toContain('[opening]');
  const kickoff = buildExternalInterviewKickoff({
    workerUrl: 'https://worker.example',
    sessionSlug: 'workshop',
    questionPriority: priority,
  });
  expect(kickoff).toContain('Unanswered question IDs, newest first: ["room-newest","room-first"]');
  expect(kickoff).toContain('Already answered IDs, only for changes I request: ["opening"]');
  expect(kickoff).not.toContain('Private prior answer');
  expect(kickoff.split('Fetch this URL:\n')[1].split('\n')[0]).toBe(
    'https://worker.example/agent/interview-catalog?slug=workshop',
  );
  expect(await hashInterviewQuestions(sorted)).toBe(await hashInterviewQuestions(normalizeInterviewQuestions(pool)));
  expect(INTERVIEW_PROMPT_VERSION).toBe('ce-interview-brief-v6');
  expect(pool[0].id).toBe('opening');
});

it('keeps unknown dates in their existing order and treats zero or locked answers as answered', () => {
  const unknown = [
    { id: 'one', prompt: 'One', type: 'rating' },
    { id: 'two', prompt: 'Two', type: 'freeform' },
  ];
  expect(sortInterviewQuestionPoolNewestFirst(unknown)).toEqual(unknown);
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

it('preserves the original eligible duplicate selection before sorting', async () => {
  const duplicatePool = [
    ...pool,
    {
      ...pool[0],
      prompt: 'A later duplicate must not replace the catalog entry',
      storageRef: { createdAt: '2026-10-30T12:00:00Z' },
    },
  ];
  expect(
    await hashInterviewQuestions(normalizeInterviewQuestions(sortInterviewQuestionPoolNewestFirst(duplicatePool))),
  ).toBe(await hashInterviewQuestions(normalizeInterviewQuestions(duplicatePool)));
});
