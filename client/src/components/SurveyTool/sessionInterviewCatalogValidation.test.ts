import {
  normalizeInterviewQuestions,
  readImportedInterviewDraftResponses,
  type InterviewPrefillPacket,
} from './sessionInterview';
import {
  checkInterviewPrefillPacket,
  InterviewCatalogSignInError,
  scopeInterviewPrefillToQuestions,
  verifyInterviewKickoffCatalog,
} from './sessionInterviewCatalogValidation';

const questions = normalizeInterviewQuestions([
  { id: 'q1', prompt: 'Shared rules?', type: 'binary', options: ['Agree', 'Unsure', 'Disagree'] },
  { id: 'q2', prompt: 'What first?', type: 'freeform' },
  { id: 'q3', prompt: 'Which matter?', type: 'multichoice', options: ['A', 'B'], singleSelect: false },
]);
// A packet as an AI made it from a question list this page no longer has: its fingerprint matches nothing.
const packetWith = (responses: Array<{ questionId: string; answer: unknown }>): InterviewPrefillPacket => ({
  version: 1,
  sessionSlug: 'demo',
  questionSetHash: 'a'.repeat(64),
  promptVersion: 'ce-interview-brief-v6',
  source: { platform: 'other', modelId: 'synthetic', verification: 'self_reported' },
  responderContext: {},
  responses: responses.map((response) => ({ ...response, confidence: 0.5, evidence: 'said so' })),
});
const applied = (packet: InterviewPrefillPacket) =>
  (readImportedInterviewDraftResponses(packet, questions) || []).map(({ questionId, answer }) => [questionId, answer]);

describe('a packet of drafts made for an older question set', () => {
  it('is taken whatever its fingerprint, and its drafts that still fit are applied', () => {
    const packet = packetWith([
      { questionId: 'q1', answer: 'Agree' },
      { questionId: 'q2', answer: 'Bus lanes.' },
      { questionId: 'q3', answer: ['B'] },
    ]);
    expect(() => checkInterviewPrefillPacket({ packet, sessionSlug: 'demo' })).not.toThrow();
    // A session's slug is matched whatever its case, as the page's own address is.
    expect(() => checkInterviewPrefillPacket({ packet, sessionSlug: 'Demo' })).not.toThrow();
    expect(applied(packet)).toEqual([
      ['q1', 'Agree'],
      ['q2', 'Bus lanes.'],
      ['q3', ['B']],
    ]);
  });

  it('leaves out the drafts for questions that were removed, and only those, wherever they come', () => {
    // More drafts than the session now has questions, with one that still fits last.
    const packet = packetWith([
      { questionId: 'gone', answer: 'Agree' },
      { questionId: 'gone-too', answer: 'Agree' },
      { questionId: 'q2', answer: 'Bus lanes.' },
      { questionId: 'gone-as-well', answer: 'Agree' },
      { questionId: 'q1', answer: 'Disagree' },
    ]);
    expect(applied(packet)).toEqual([
      ['q2', 'Bus lanes.'],
      ['q1', 'Disagree'],
    ]);
    expect(packet.responses).toHaveLength(5);
  });

  it('leaves out the draft whose answer is no longer one of its question’s options, and only that one', () => {
    const packet = packetWith([
      // The question had an option "C" when the AI read it.
      { questionId: 'q3', answer: ['C'] },
      { questionId: 'q1', answer: 'Strongly agree' },
      { questionId: 'q2', answer: 'Bus lanes.' },
    ]);
    expect(applied(packet)).toEqual([['q2', 'Bus lanes.']]);
  });

  it('is refused when it names another session, or a form this page no longer reads', () => {
    const packet = packetWith([{ questionId: 'q1', answer: 'Agree' }]);
    expect(() => checkInterviewPrefillPacket({ packet, sessionSlug: 'other' })).toThrow(
      'These draft answers are for another session. Ask the AI for a link to this one.',
    );
    expect(() =>
      checkInterviewPrefillPacket({
        packet: { ...packet, promptVersion: 'ce-interview-brief-v99' },
        sessionSlug: 'demo',
      }),
    ).toThrow('in a form this page no longer reads');
  });
});

it('scopes imported predictions before AI consumption without mutating the original packet', () => {
  const packet = packetWith([
    { questionId: 'q0', answer: 'Outside the questions' },
    { questionId: 'q3', answer: ['A', 'B'] },
  ]);
  const scoped = scopeInterviewPrefillToQuestions(packet, questions, '');
  expect(scoped.responses?.map(({ questionId }) => questionId)).toEqual(['q3']);
  expect(packet.responses).toHaveLength(2);
});

it('replaces the imported responder context with the reviewed text', () => {
  const packet = {
    ...packetWith([]),
    responderContext: {
      name: 'Fixture Person',
      summary: 'Imported summary',
      facts: [{ fact: 'Removed fact', evidence: 'inferred' }],
    },
  };
  expect(scopeInterviewPrefillToQuestions(packet, questions, ' Reviewed text ').responderContext).toEqual({
    summary: 'Reviewed text',
  });
  expect(scopeInterviewPrefillToQuestions(packet, questions, '').responderContext).toEqual({});
  expect(packet.responderContext.name).toBe('Fixture Person');
});

describe('verifyInterviewKickoffCatalog', () => {
  const catalog = {
    type: 'context-engine.interview-question-catalog',
    version: 1,
    sessionSlug: 'demo',
    prefillPromptVersion: 'ce-interview-brief-v6',
    questionSetHash: 'f'.repeat(64),
    questions: [{ id: 'listed', prompt: 'Listed?', type: 'freeform' }],
  };
  const verify = (
    fetchImpl: typeof fetch,
    ticket?: (request: { fresh: boolean }) => Promise<string>,
    questionIds?: string[],
  ) =>
    verifyInterviewKickoffCatalog({
      workerUrl: 'https://worker.example.test/',
      sessionSlug: 'demo',
      sessionUrl: 'https://client.example.test/session/demo',
      fetchImpl,
      ticket,
      questionIds,
    });
  const refusal = (status: number, reason: string) => new Response(JSON.stringify({ error: 'No', reason }), { status });
  const ticketIn = (fetchImpl: { mock: { calls: unknown[][] } }, call: number) =>
    new URL(String(fetchImpl.mock.calls[call][0])).searchParams.get('ticket');
  const listing = (...ids: string[]) =>
    new Response(JSON.stringify({ ...catalog, questions: ids.map((id) => ({ id, prompt: id, type: 'freeform' })) }));
  // A private session: refused without a ticket, read with one.
  const privateWorker = () =>
    jest.fn(async (input: RequestInfo | URL) =>
      new URL(String(input)).searchParams.get('ticket')
        ? new Response(JSON.stringify(catalog))
        : refusal(403, 'private_session_invite_required'),
    );

  it('gives a signed-in person on a public session a prompt with no ticket, without asking them to sign in', async () => {
    const fetchImpl = jest.fn(async () => listing('q1', 'q2'));
    const ticket = jest.fn(async () => 'ic1.mine');
    await expect(verify(fetchImpl, ticket, ['q1', 'q2'])).resolves.toBe('');
    await expect(verify(fetchImpl, ticket)).resolves.toBe('');
    expect(ticket).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect([ticketIn(fetchImpl, 0), ticketIn(fetchImpl, 1)]).toEqual([null, null]);
  });

  it('uses a ticket where the read without one leaves the person short', async () => {
    // A private session refuses the read without one.
    const closed = privateWorker();
    await expect(verify(closed, async () => 'ic1.mine')).resolves.toBe('ic1.mine');
    expect([ticketIn(closed, 0), ticketIn(closed, 1)]).toEqual([null, 'ic1.mine']);
    const signInFirst = jest
      .fn()
      .mockResolvedValueOnce(refusal(404, 'sign_in_required'))
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog)));
    await expect(verify(signInFirst, async () => 'ic1.mine')).resolves.toBe('ic1.mine');
    // A public session that lists fewer questions than this page shows them, such as their group's.
    const partial = jest.fn(async (input: RequestInfo | URL) =>
      new URL(String(input)).searchParams.get('ticket') ? listing('q1', 'q2') : listing('q1'),
    );
    await expect(verify(partial, async () => 'ic1.mine', ['q1', 'q2'])).resolves.toBe('ic1.mine');
    // A person whose ticket couldn't be had is checked as a signed-out visitor.
    await expect(verify(partial, async () => '', ['q1', 'q2'])).resolves.toBe('');
    // A Worker that is down or busy is not a reason to ask anyone to sign in.
    const ticket = jest.fn(async () => 'ic1.mine');
    await expect(
      verify(
        jest.fn(async () => refusal(503, '')),
        ticket,
      ),
    ).rejects.toThrow('Could not check this session’s Worker');
    await expect(
      verify(
        jest.fn(async () => new Response('{}', { status: 429 })),
        ticket,
      ),
    ).rejects.toThrow('Could not check this session’s Worker');
    expect(ticket).not.toHaveBeenCalled();
  });

  it('keeps the short address wherever a ticket would add nothing', async () => {
    const ticket = jest.fn(async () => 'ic1.mine');
    // The Worker serves q2 to no one, as past its cap or hidden: the ticket adds nothing.
    const neverServed = jest.fn(async () => listing('q1'));
    await expect(verify(neverServed, ticket, ['q1', 'q2'])).resolves.toBe('');
    expect(neverServed).toHaveBeenCalledTimes(2);
    // A ticketed read that fails leaves the good read without one.
    const busy = jest.fn(async (input: RequestInfo | URL) =>
      new URL(String(input)).searchParams.get('ticket') ? refusal(503, '') : listing('q1'),
    );
    await expect(verify(busy, ticket, ['q1', 'q2'])).resolves.toBe('');
    // A refusal for another reason, such as an origin the session doesn't allow, asks no one to sign in.
    ticket.mockClear();
    await expect(
      verify(
        jest.fn(async () => new Response('{}', { status: 403 })),
        ticket,
      ),
    ).rejects.toThrow('Could not check this session’s Worker');
    expect(ticket).not.toHaveBeenCalled();
    // Without a ticket to be had, the catalog is read only once.
    const once = jest.fn(async () => listing('q1'));
    await expect(verify(once, async () => '', ['q1', 'q2'])).resolves.toBe('');
    expect(once).toHaveBeenCalledTimes(1);
  });

  it('swaps a ticket the Worker refused for a fresh one, once', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(refusal(403, 'private_session_invite_required'))
      .mockResolvedValueOnce(refusal(401, 'catalog_ticket_invalid'))
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog)));
    const ticket = jest.fn(async ({ fresh }: { fresh: boolean }) => (fresh ? 'ic1.fresh' : 'ic1.held'));
    await expect(verify(fetchImpl, ticket)).resolves.toBe('ic1.fresh');
    expect(ticket.mock.calls).toEqual([[{ fresh: false }], [{ fresh: true }]]);
    expect([1, 2].map((call) => ticketIn(fetchImpl, call))).toEqual(['ic1.held', 'ic1.fresh']);

    const refusedTwice = jest.fn(async (input: RequestInfo | URL) =>
      new URL(String(input)).searchParams.get('ticket')
        ? refusal(401, 'catalog_ticket_invalid')
        : refusal(403, 'private_session_invite_required'),
    );
    await expect(verify(refusedTwice, ticket)).rejects.toThrow('Could not check this session’s Worker');
    expect(refusedTwice).toHaveBeenCalledTimes(3);
  });

  it('times only the Worker, never someone signing in for a ticket', async () => {
    jest.useFakeTimers();
    try {
      // As a real fetch does, it fails at once on an aborted signal.
      const closed = privateWorker();
      const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) throw new Error('aborted');
        return closed(input);
      });
      let issue: (ticket: string) => void = () => {};
      const signingIn = verify(fetchImpl, () => new Promise<string>((resolve) => (issue = resolve)));
      await jest.advanceTimersByTimeAsync(30_000);
      issue('ic1.slow');
      await expect(signingIn).resolves.toBe('ic1.slow');
      // The Worker itself still gets ten seconds.
      const stalled = verify(
        jest.fn(
          (_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        ),
        async () => 'ic1.mine',
      );
      const outcome = expect(stalled).rejects.toThrow('Could not check this session’s Worker');
      await jest.advanceTimersByTimeAsync(10_000);
      await outcome;
    } finally {
      jest.useRealTimers();
    }
  });

  it('says a session closed to signed-out visitors needs a sign-in, and only then', async () => {
    await expect(verify(jest.fn(async () => refusal(401, 'sign_in_required')))).rejects.toBeInstanceOf(
      InterviewCatalogSignInError,
    );
    await expect(verify(jest.fn(async () => refusal(404, 'sign_in_required')))).rejects.toThrow(
      'Use Log in at the top of the page',
    );
    await expect(verify(jest.fn(async () => refusal(503, '')))).rejects.not.toBeInstanceOf(InterviewCatalogSignInError);
    // With a ticket, the refusal is about the ticket, not a missing sign-in.
    const withTicket = jest.fn(async () => refusal(404, 'sign_in_required'));
    await expect(verify(withTicket, async () => 'ic1.mine')).rejects.not.toBeInstanceOf(InterviewCatalogSignInError);
  });

  it('never passes a catalog that would give a prompt without its question ids', async () => {
    const served = (body: Record<string, unknown>) => verify(jest.fn(async () => new Response(JSON.stringify(body))));
    const whole = { ...catalog, questions: [{ id: 'q1', prompt: 'One?', type: 'freeform' }] };
    await expect(served(whole)).resolves.toBe('');
    // A session with nothing to answer says so; there is nothing for an AI to draft.
    await expect(served({ ...whole, questions: [] })).rejects.toThrow(
      'This session has no questions yet for an AI to draft answers to.',
    );
    // No fingerprint, or an id that could be mistaken for something else: an error with Retry, never a prompt.
    await expect(served({ ...whole, questionSetHash: '' })).rejects.toThrow('incompatible interview versions');
    await expect(served({ ...whole, questions: [{ id: 'q1, 2 q2', type: 'freeform' }] })).rejects.toThrow(
      'incompatible interview versions',
    );
  });
});
