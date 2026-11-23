import { buildAgentKeyHandover } from '../../utilities/session/agentHandoff';
import { splitPromptByVariables } from '../Shared/aiPromptPieces';
import { findPromptVariables } from './aiPromptVariables';
import { buildExternalInterviewKickoff } from './sessionInterview';

const key = {
  token: 'ceagt_abcdefghijklmnopqrstuvwx',
  expiresAt: '2030-01-01T12:00:00.000Z',
  sessionSlug: 'demo',
  workerUrl: 'https://worker.example',
  submitAnswers: true,
};
const ticket = `ic1.0x${'ab'.repeat(20)}.b6a3c1f2-0d4e-4a8b-9c7d-1e2f3a4b5c6d.1800003600.${'A'.repeat(43)}`;
const full = buildExternalInterviewKickoff({
  workerUrl: 'https://worker.example',
  sessionSlug: 'demo',
  sessionUrl: 'https://app.example/session/demo',
  sessionName: 'Salon "two"',
  catalogTicket: ticket,
  hasAccount: true,
  agentKey: { key },
  questionPriority: { order: 'newest', unansweredQuestionIds: ['q2', 'q1'], answeredQuestionIds: ['q0'] },
});
const shownText = (prompt: string) =>
  splitPromptByVariables(prompt, findPromptVariables(prompt))
    .map(({ text }) => text)
    .join('');

it('finds each value a full prompt carries and gives it a name', () => {
  const byName = Object.fromEntries(findPromptVariables(full).map(({ name, value }) => [name, value]));
  expect(byName.AIKey).toBe(key.token);
  expect(byName.KeyEnds).toBe(key.expiresAt);
  expect(byName.WorkerAddress).toBe('https://worker.example');
  expect(byName.SessionSlug).toBe('"demo"');
  expect(byName.SessionName).toBe('"Salon \\"two\\""');
  expect(byName.QuestionsAddress).toContain(`&ticket=${encodeURIComponent(ticket)}`);
  expect(byName.UnansweredQuestions).toBe('["q2","q1"]');
  expect(byName.AnsweredQuestions).toBe('["q0"]');
  expect(
    findPromptVariables(full)
      .filter(({ name }) => name === 'SessionLink')
      .map(({ value }) => value),
  ).toEqual(expect.arrayContaining(['https://app.example/session/demo', '"https://app.example/session/demo"']));
});

it('shows a stand-in in place of every value, and no key, ticket or address', () => {
  const shown = shownText(full);
  expect(shown).toContain(
    'The key is <AIKey>; it works only for the session with slug <SessionSlug>, at <WorkerAddress>, until <KeyEnds>.',
  );
  expect(shown).toContain('Follow <WorkerAddress>/api/agent/skill.');
  expect(shown).toContain('It is only for the session <SessionName> at <SessionLink>.');
  expect(shown).toContain('To draft, fetch this URL with a plain HTTP GET:\n<QuestionsAddress>\n');
  expect(shown).toContain('Unanswered question IDs, newest first: <UnansweredQuestions>');
  expect(shown).toContain('only if reviewUrl starts with exactly <SessionLink>;');
  for (const secret of [key.token, ticket, 'worker.example', key.expiresAt]) expect(shown).not.toContain(secret);
  // Only the values change: put back, it is the prompt that is copied.
  const pieces = splitPromptByVariables(full, findPromptVariables(full));
  const values = findPromptVariables(full);
  const rebuilt = pieces.reduce((text, piece) => text + (piece.variable ? '\u0000' : piece.text), '');
  expect(rebuilt.split('\u0000').join('').length).toBeLessThan(full.length);
  expect(values.every(({ value }) => full.includes(value))).toBe(true);
});

it('does the same for the short prompt that hands a key over', () => {
  const short = buildAgentKeyHandover({ key, sessionName: 'Salon', sessionUrl: 'https://app.example/session/demo' });
  const shown = shownText(short);
  expect(shown).toContain('Here is my AI key for the Context Engine session <SessionName> (<SessionLink>).');
  expect(shown).toContain('The key is <AIKey>;');
  expect(shown).not.toContain(key.token);
  expect(shown).not.toContain('app.example');
});

it('leaves a prompt with nothing personal as it is', () => {
  const plain = 'Help me take part in a Context Engine session.';
  expect(findPromptVariables(plain)).toEqual([]);
  expect(splitPromptByVariables(plain, [])).toEqual([{ text: plain }]);
  // An empty list of questions is not a value to hide.
  expect(findPromptVariables('Already answered IDs, only for changes I request: []')).toEqual([]);
});
