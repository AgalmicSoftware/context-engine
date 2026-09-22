import { webcrypto } from 'crypto';
import { __test__interviewQuestionCatalog as workerCatalog } from '../../../../workers/sessionCorsWorker/interviewQuestionCatalog';
import { hashInterviewQuestions, normalizeInterviewQuestions, type InterviewPrefillPacket } from './sessionInterview';
import {
  resolveInterviewPrefillQuestions,
  scopeInterviewPrefillToQuestions,
} from './sessionInterviewCatalogValidation';

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
beforeAll(() => Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto }));
afterAll(() => {
  if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
});
const pool = Array.from({ length: 101 }, (_, index) => ({
  id: `q${index}`,
  prompt: `Question ${index}?`,
  type: index === 20 ? 'multichoice' : 'freeform',
  ...(index === 20 ? { options: ['A', 'B'], singleSelect: false } : {}),
}));
const questions = normalizeInterviewQuestions(pool);
const publicQuestions = workerCatalog.dedupeQuestions(pool.slice(1));
async function setup(promptVersion = 'ce-interview-brief-v5') {
  const questionSetHash = await hashInterviewQuestions(publicQuestions, promptVersion);
  const packet: InterviewPrefillPacket = {
    version: 1,
    sessionSlug: 'demo',
    questionSetHash,
    promptVersion,
    source: { platform: 'other', modelId: 'synthetic', verification: 'self_reported' },
    responderContext: {},
  };
  const catalog = {
    type: 'context-engine.interview-question-catalog',
    version: 1,
    sessionSlug: 'demo',
    prefillPromptVersion: promptVersion,
    questionSetHash,
    questions:
      promptVersion === 'ce-interview-brief-v4'
        ? publicQuestions.map(({ singleSelect: _singleSelect, ...question }) => question)
        : publicQuestions,
  };
  const fetchImpl = jest.fn(async () => new Response(JSON.stringify(catalog)));
  const args = {
    packet,
    questions,
    sessionSlug: 'demo',
    sessionUrl: 'https://client.example.test/session/demo',
    loadWorkerUrl: async () => 'https://worker.example.test',
    fetchImpl,
  };
  return { args, catalog, fetchImpl };
}

it.each(['ce-interview-brief-v4', 'ce-interview-brief-v5'])(
  'accepts real %s hashes at the Worker 100/local 101 boundary',
  async (version) => {
    const { args, fetchImpl } = await setup(version);
    expect(await resolveInterviewPrefillQuestions(args)).toEqual(publicQuestions);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const matching = { ...args, questions: normalizeInterviewQuestions(pool.slice(1)) };
    fetchImpl.mockClear();
    expect(await resolveInterviewPrefillQuestions(matching)).toEqual(publicQuestions);
    expect(fetchImpl).not.toHaveBeenCalled();
  },
);

it.each(['session', 'version', 'question', 'hash', 'duplicate', 'oversized'])(
  'rejects a mismatched %s catalog instead of trusting a prefix',
  async (kind) => {
    const { args, catalog } = await setup();
    const bad = JSON.parse(JSON.stringify(catalog));
    if (kind === 'session') bad.sessionSlug = 'other';
    if (kind === 'version') bad.version = 2;
    if (kind === 'question') bad.questions[0].prompt = 'Changed wording';
    if (kind === 'hash') bad.questionSetHash = '0'.repeat(64);
    if (kind === 'duplicate') bad.questions[1] = bad.questions[0];
    if (kind === 'oversized') bad.questions.push(questions[0]);
    await expect(
      resolveInterviewPrefillQuestions({ ...args, fetchImpl: async () => new Response(JSON.stringify(bad)) }),
    ).rejects.toThrow('older or different');
  },
);

it('rejects stale local metadata even when a returned catalog is internally valid', async () => {
  const { args } = await setup();
  await expect(
    resolveInterviewPrefillQuestions({
      ...args,
      questions: questions.map((question, index) =>
        index === 50 ? { ...question, prompt: 'Changed locally' } : question,
      ),
    }),
  ).rejects.toThrow('older or different');
});

it('rejects cross-session packets before discovery and reports network errors as retryable', async () => {
  const { args, fetchImpl } = await setup();
  await expect(resolveInterviewPrefillQuestions({ ...args, sessionSlug: 'other' })).rejects.toThrow(
    'older or different',
  );
  expect(fetchImpl).not.toHaveBeenCalled();
  await expect(
    resolveInterviewPrefillQuestions({
      ...args,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    }),
  ).rejects.toThrow('connection and retry');
});

it('bounds a stalled catalog request and aborts its fetch', async () => {
  const { args, catalog } = await setup();
  let signal: AbortSignal | null | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    signal = init?.signal;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return new Response(JSON.stringify(catalog));
  };
  await expect(resolveInterviewPrefillQuestions({ ...args, fetchImpl, timeoutMs: 5 })).rejects.toThrow('retry');
  expect(signal?.aborted).toBe(true);
});

it('cancels catalog work when its modal is disposed', async () => {
  const { args, catalog } = await setup();
  const controller = new AbortController();
  const fetchImpl: typeof fetch = async () => {
    controller.abort();
    return new Response(JSON.stringify(catalog));
  };
  await expect(resolveInterviewPrefillQuestions({ ...args, fetchImpl, signal: controller.signal })).rejects.toThrow();
});

it('does not relabel a v4 selection hash as v5', async () => {
  const { args } = await setup('ce-interview-brief-v4');
  await expect(
    resolveInterviewPrefillQuestions({ ...args, packet: { ...args.packet, promptVersion: 'ce-interview-brief-v5' } }),
  ).rejects.toThrow('older or different');
});

it('scopes imported predictions before AI consumption without mutating the original packet', async () => {
  const { args } = await setup();
  const packet = {
    ...args.packet,
    responses: [
      { questionId: 'q0', answer: 'Outside catalog' },
      { questionId: 'q20', answer: ['A', 'B'] },
    ],
  };
  const scoped = scopeInterviewPrefillToQuestions(packet, publicQuestions);
  expect(scoped.responses).toEqual([{ questionId: 'q20', answer: ['A', 'B'] }]);
  expect(packet.responses).toHaveLength(2);
});

it('also binds local selection metadata to the current v5 catalog when importing a v4 packet', async () => {
  const { args, catalog } = await setup('ce-interview-brief-v4');
  const currentQuestions = publicQuestions.map((question) =>
    question.id === 'q20' ? { ...question, singleSelect: true } : question,
  );
  const currentCatalog = {
    ...catalog,
    prefillPromptVersion: 'ce-interview-brief-v5',
    questions: currentQuestions,
    questionSetHash: await hashInterviewQuestions(currentQuestions),
  };
  const fetchImpl = async () => new Response(JSON.stringify(currentCatalog));
  await expect(resolveInterviewPrefillQuestions({ ...args, fetchImpl })).rejects.toThrow('older or different');
  const refreshedLocal = questions.map((question) =>
    question.id === 'q20' ? { ...question, singleSelect: true } : question,
  );
  expect(await resolveInterviewPrefillQuestions({ ...args, questions: refreshedLocal, fetchImpl })).toEqual(
    currentQuestions,
  );
});
