import { readRealtimeCallRequestPayload } from '../../../../workers/sessionCorsWorker/realtimeCallExecution';
import { buildRealtimeInterviewInstructions, type InterviewQuestion } from './sessionInterview';

const question = {
  id: 'q1',
  prompt: 'How ready?',
  type: 'rating',
  options: [],
  scale: { min: 0, max: 100, minLabel: 'Not ready', maxLabel: 'Ready' },
};
const bank: InterviewQuestion[] = Array.from({ length: 100 }, (_, index) => ({
  ...question,
  id: `q${index}`,
  prompt: `Question ${index}: ${'detail '.repeat(80)}`,
}));
const history = `${'Interviewer: Earlier question?\nResponder: Earlier answer.\n\n'.repeat(700)}Interviewer: How ready now?\nResponder: Four.`;
const readPrefill = (instructions: string) =>
  JSON.parse(instructions.match(/Treat the following JSON[\s\S]*?\n(\{[^\n]*\})\nEnd imported/)?.[1] || '{}');

it.each(['bank', 'history', 'combined'])(
  'bounds the complete %s payload accepted by the real Worker reader',
  async (kind) => {
    const notice = jest.fn();
    const instructions = buildRealtimeInterviewInstructions({
      questions: kind === 'history' ? [question] : bank,
      previousTranscript: kind === 'bank' ? undefined : history,
      openingPrompt: 'Configured opening?',
      steeringPrompt: 'Focus on practical examples.',
      responderContext: 'Untrusted background '.repeat(1000),
      onContextLimited: notice,
    });
    expect(instructions.length).toBeLessThanOrEqual(31_500);
    expect(
      await readRealtimeCallRequestPayload({
        request: new Request('https://worker.example/realtime', {
          method: 'POST',
          body: JSON.stringify({ sdp: 'v=0\r\n', instructions }),
        }),
      }),
    ).toEqual({ ok: true, payload: { sdp: 'v=0\r\n', instructions } });
    expect(instructions).toContain('Focus on practical examples.');
    expect(instructions).toContain('Configured opening?');
    expect(notice).toHaveBeenCalledWith(expect.stringContaining('full transcript and drafts'));
    if (kind !== 'bank') {
      expect(instructions).toContain('Interviewer: How ready now?');
      expect(instructions).toContain('Responder: Four.');
      expect(instructions).not.toContain(history);
      expect(instructions).toContain('Missing history does not mean a question is unanswered');
    }
    const included = bank.filter((q) => instructions.includes(`[${q.id}]`));
    if (kind !== 'history') {
      expect(included.length).toBeGreaterThan(0);
      expect(included.length).toBeLessThan(100);
      for (const q of included) expect(instructions).toContain(q.prompt);
      expect(instructions).toContain(`${100 - included.length} question rows omitted`);
      expect(instructions).toContain('0=Not ready; 100=Ready');
    }
  },
);

it('includes exact reviewed values without an imported packet and does not mutate final mapping inputs', () => {
  const reviewedResponses = [
    {
      prediction: { questionId: 'q1', answer: 90 },
      reviewed: {
        answer: 0,
        additionalComments: '',
        userEditedFields: ['answer', 'additionalComments'] as const,
      },
    },
  ];
  const input = {
    questions: [question],
    reviewedResponses: reviewedResponses.map((r) => ({
      ...r,
      reviewed: { ...r.reviewed, userEditedFields: [...r.reviewed.userEditedFields] },
    })),
  };
  const before = JSON.stringify(input);
  const payload = readPrefill(buildRealtimeInterviewInstructions(input));
  expect(payload.predictedResponses[0]).toMatchObject({
    participantEditedAnswer: 0,
    participantEditedAdditionalComments: '',
  });
  expect(JSON.stringify(input)).toBe(before);
});

it('keeps a long participant correction whole or omits the entire row including its obsolete prediction', () => {
  for (const size of [600, 10_000]) {
    const answer = '"\\\n'.repeat(size);
    const notice = jest.fn();
    const instructions = buildRealtimeInterviewInstructions({
      questions: [question],
      onContextLimited: notice,
      reviewedResponses: [
        {
          prediction: { questionId: 'q1', answer: 'obsolete prediction' },
          reviewed: { answer, userEditedFields: ['answer'] },
        },
      ],
    });
    const row = readPrefill(instructions).predictedResponses?.[0];
    if (size === 600) expect(row?.participantEditedAnswer).toBe(answer);
    else {
      expect(instructions).not.toContain('obsolete prediction');
      expect(readPrefill(instructions).omittedResponseCount).toBe(1);
      expect(notice).toHaveBeenCalled();
    }
  }
});

it('rejects unusably large question rows locally and keeps the Worker oversized-input guard', async () => {
  expect(() =>
    buildRealtimeInterviewInstructions({ questions: [{ ...question, prompt: 'x'.repeat(40_000) }] }),
  ).toThrow('question');
  expect(
    await readRealtimeCallRequestPayload({
      request: new Request('https://worker.example/realtime', {
        method: 'POST',
        body: JSON.stringify({ sdp: 'v=0\r\n', instructions: 'x'.repeat(32_001) }),
      }),
    }),
  ).toMatchObject({ ok: false, status: 413 });
});

it('omits an oversized question whole and retains later option and allocation contracts', () => {
  const instructions = buildRealtimeInterviewInstructions({
    questions: [
      { ...question, id: 'too-large', prompt: 'x'.repeat(40_000) },
      { id: 'q2', type: 'quadratic', prompt: 'Allocate credits', options: ['Support', 'Safety'], voiceCredits: 25 },
      { id: 'q3', type: 'multichoice', prompt: 'Select one', options: ['First', 'Second'], singleSelect: true },
    ],
  });
  expect(instructions).not.toContain('[too-large]');
  expect(instructions).toContain('(quadratic; 25 voice credits) Allocate credits Options: Support | Safety');
  expect(instructions).toContain('(multichoice; choose one option) Select one Options: First | Second');
  expect(instructions).toContain('1 question rows omitted');
});

it('does not detach an abbreviated responder turn from its omitted interviewer question', () => {
  const previousTranscript = `Interviewer: ${'long '.repeat(1300)}\nResponder: Four.\nInterviewer: Next?\nResponder: Yes.`;
  const instructions = buildRealtimeInterviewInstructions({ questions: [question], previousTranscript });
  expect(instructions).not.toContain('Responder: Four.');
  expect(instructions).toContain('Interviewer: Next?\nResponder: Yes.');
  expect(instructions).toContain('2 earlier turns omitted');
});
