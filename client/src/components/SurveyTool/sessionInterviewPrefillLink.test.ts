// The copied AI prompt has to end in a review link the site takes. Two readers stand in for an AI here, each
// doing only what the prompt says: one is given a summary of the catalog, so it has only what the prompt
// carries (the fingerprint, the version and the ids by position); the other reads the catalog whole. Each
// link is then read by the site's own code and its drafts fitted to the session's questions.
import { webcrypto } from 'crypto';
import { __test__interviewQuestionCatalog as workerCatalog } from '../../../../workers/sessionCorsWorker/interviewQuestionCatalog';
import {
  buildExternalInterviewKickoff,
  hashInterviewQuestions,
  KICKOFF_QUESTION_IDS_LABEL,
  normalizeInterviewQuestions,
  readImportedInterviewDraftResponses,
  readInterviewPrefillFromHash,
} from './sessionInterview';
import { checkInterviewPrefillPacket } from './sessionInterviewCatalogValidation';

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
});
afterAll(() => {
  if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
});

const SLUG = 'workshop';
const WORKER = 'https://worker.example.test';
const SESSION_URL = `https://client.example.test/session/${SLUG}?worker=${encodeURIComponent(WORKER)}`;
const VERSION = 'ce-interview-brief-v6';
const pool = [
  {
    id: '0xq1',
    prompt: 'Cities should run on shared rules?',
    type: 'binary',
    options: ['Agree', 'Unsure', 'Disagree'],
  },
  { id: '0xq2', prompt: 'What would you change first?', type: 'freeform' },
  {
    id: '0xq3',
    prompt: 'Which of these matter?',
    type: 'multichoice',
    options: ['Housing', 'Transit'],
    singleSelect: false,
  },
  { id: '0xq4', prompt: 'Votes should be public?', type: 'binary', options: ['Agree', 'Unsure', 'Disagree'] },
];
const served = workerCatalog.dedupeQuestions(pool);

const setup = async () => {
  const catalog = {
    type: 'context-engine.interview-question-catalog',
    version: 1,
    sessionSlug: SLUG,
    prefillPromptVersion: VERSION,
    questionSetHash: await hashInterviewQuestions(served, VERSION),
    questions: served,
  };
  const prompt = buildExternalInterviewKickoff({
    workerUrl: WORKER,
    sessionSlug: SLUG,
    sessionUrl: SESSION_URL,
    catalog,
  });
  return { catalog, prompt };
};

const said = (prompt: string, pattern: RegExp) => {
  const found = prompt.match(pattern);
  if (!found) throw new Error(`The prompt no longer says ${pattern}`);
  return found[1];
};

// Step 3's packet and step 4's link, as the prompt words them.
const reviewLink = (prompt: string, packet: Record<string, unknown>) => {
  const address = said(prompt, /put it after #prefill= on this address, not the catalog's reviewUrl:\n(\S+)\n/);
  const encoded = Buffer.from(JSON.stringify(packet), 'utf8').toString('base64url');
  return `${address}#prefill=${encoded}`;
};
const packetFor = (
  values: { sessionSlug: string; questionSetHash: string; promptVersion: string },
  responses: Array<{ questionId: string; answer: unknown }>,
) => ({
  version: 1,
  ...values,
  promptRevision: said(
    buildExternalInterviewKickoff({ workerUrl: WORKER, sessionSlug: SLUG, sessionUrl: SESSION_URL }),
    /"promptRevision":"([^"]+)"/,
  ),
  source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
  responderContext: { summary: 'A scripted reader.' },
  responses: responses.map((response) => ({ ...response, confidence: 0.35, evidence: 'inferred from one remark' })),
});

// The site's side: read the link as the session page does, check whose drafts they are, then fit each draft
// to the session's questions as they are now.
const openOnSite = (link: string, current: unknown[] = pool) => {
  const url = new URL(link);
  expect(`${url.origin}${url.pathname}`).toBe(`https://client.example.test/session/${SLUG}`);
  expect(url.searchParams.get('mode')).toBe('interview');
  const read = readInterviewPrefillFromHash(url.hash);
  expect(read).toMatchObject({ error: '', notice: '' });
  checkInterviewPrefillPacket({ packet: read.packet!, sessionSlug: SLUG });
  return readImportedInterviewDraftResponses(read.packet, normalizeInterviewQuestions(current)) || [];
};

it('a reader given only a summary makes, from the prompt alone, a review link the site takes', async () => {
  const { catalog, prompt } = await setup();
  // Everything it puts in the packet is in the prompt: nothing here reads the catalog.
  const listed = said(prompt, new RegExp(`\\n${KICKOFF_QUESTION_IDS_LABEL}([^\\n]+)\\n`))
    .split(', ')
    .map((entry) => entry.split(' '))
    .map(([position, id, type]) => ({ position: Number(position), id, type }));
  expect(listed.map(({ position }) => position)).toEqual([1, 2, 3, 4]);
  // From a summary it drafts what needs no option text, as the prompt says: agree-or-disagree and free text.
  expect(prompt).toContain('binary ones take exactly "Agree", "Unsure", "Disagree"; freeform ones take text');
  const responses = listed
    .filter(({ type }) => type === 'binary' || type === 'freeform')
    .map(({ id, type }) => ({ questionId: id, answer: type === 'binary' ? 'Agree' : 'Start with the bus lanes.' }));
  const link = reviewLink(
    prompt,
    packetFor(
      {
        sessionSlug: said(prompt, /My browser read this catalog when I copied this: sessionSlug "([^"]+)"/),
        questionSetHash: said(prompt, /questionSetHash "([^"]+)", prefillPromptVersion/),
        promptVersion: said(prompt, /prefillPromptVersion "([^"]+)", 4 questions/),
      },
      responses,
    ),
  );
  const drafts = openOnSite(link);
  expect(drafts.map(({ questionId, answer }) => [questionId, answer])).toEqual([
    ['0xq1', 'Agree'],
    ['0xq2', 'Start with the bus lanes.'],
    ['0xq4', 'Agree'],
  ]);
});

it('a reader that gets the catalog whole makes a review link the site takes, options included', async () => {
  const { catalog, prompt } = await setup();
  const responses = catalog.questions.map((question: { id: string; type: string; options?: string[] }) => ({
    questionId: question.id,
    answer:
      question.type === 'freeform'
        ? 'Start with the bus lanes.'
        : question.type === 'binary'
          ? 'Disagree'
          : [question.options![1]],
  }));
  const link = reviewLink(
    prompt,
    packetFor(
      {
        sessionSlug: catalog.sessionSlug,
        questionSetHash: catalog.questionSetHash,
        promptVersion: catalog.prefillPromptVersion,
      },
      responses,
    ),
  );
  const drafts = openOnSite(link);
  expect(drafts.map(({ questionId }) => questionId)).toEqual(['0xq1', '0xq2', '0xq3', '0xq4']);
  expect(drafts[2].answer).toEqual(['Transit']);
});

it('a link made before the questions changed still opens, without the drafts that no longer fit', async () => {
  const { catalog, prompt } = await setup();
  const link = reviewLink(
    prompt,
    packetFor({ sessionSlug: SLUG, questionSetHash: catalog.questionSetHash, promptVersion: VERSION }, [
      { questionId: '0xq1', answer: 'Agree' },
      { questionId: '0xq3', answer: ['Transit'] },
      { questionId: '0xq4', answer: 'Disagree' },
    ]),
  );
  // Since the AI read them: one question was removed, one lost the option it chose, and one was added.
  const changed = [
    pool[0],
    pool[1],
    { ...pool[2], options: ['Housing', 'Parks'] },
    { id: '0xq5', prompt: 'A new question?', type: 'freeform' },
  ];
  expect(openOnSite(link, changed).map(({ questionId, answer }) => [questionId, answer])).toEqual([['0xq1', 'Agree']]);
});

it('a link for another session is refused', async () => {
  const { catalog, prompt } = await setup();
  const link = reviewLink(
    prompt,
    packetFor({ sessionSlug: 'elsewhere', questionSetHash: catalog.questionSetHash, promptVersion: VERSION }, [
      { questionId: '0xq1', answer: 'Agree' },
    ]),
  );
  expect(() => openOnSite(link)).toThrow('These draft answers are for another session.');
});
