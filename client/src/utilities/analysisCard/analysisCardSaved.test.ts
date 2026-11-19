import { normalizeSavedAnalysisCard } from '@ce-shared/analysisCardSaved.mjs';

import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { readWorkerCapabilities } from '../worker/workerCapabilities';
import { buildAnalysisCard, normalizeAnalysisCard } from './analysisCardModel';
import {
  SAVED_CARD_READ_TIMEOUT_MS,
  analysisCardAvailableFor,
  SAVED_CARD_SAVE_TIMEOUT_MS,
  publishSavedAnalysisCard,
  readSavedAnalysisCard,
  subscribeSavedAnalysisCards,
} from './analysisCardSaved';

jest.mock('../worker/corsProxy.js', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));
jest.mock('../worker/workerCapabilities', () => ({ readWorkerCapabilities: jest.fn() }));

const mockedProxy = jest.mocked(getCorsProxyUrlOrThrow);
const mockedFetch = jest.mocked(fetchWorkerWithAuth);
const mockedCapabilities = jest.mocked(readWorkerCapabilities);
const PERSON = '0x00000000000000000000000000000000000000AA';
const CARD = normalizeSavedAnalysisCard({
  title: 'Keeps the commons in common hands',
  figure: 'Elinor Ostrom (1933–2012)',
});
const reply = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => body }) as unknown as Response;
const bodyOf = (call: number): unknown => JSON.parse(String(mockedFetch.mock.calls[call][1]?.body));
const VIEWER = '0x00000000000000000000000000000000000000bb';
let session = 0;
const options = (viewer = VIEWER) => ({ sessionSlug: `saved-card-${++session}`, context: { account: viewer } });

beforeEach(() => {
  jest.clearAllMocks();
  mockedProxy.mockResolvedValue('https://worker.example/ai');
});

it("reads a person's saved card once a visit, signed in and without a sign-in prompt", async () => {
  mockedFetch.mockResolvedValue(reply({ published: true, card: CARD, savedAt: 1763460000000 }));
  const opts = options();

  const state = await readSavedAnalysisCard(PERSON, opts);

  expect(state).toEqual({ status: 'ready', card: CARD, savedAt: 1763460000000 });
  const [url, , auth] = mockedFetch.mock.calls[0];
  expect(url).toBe('https://worker.example/analysis-card/published');
  expect(bodyOf(0)).toEqual({ account: PERSON });
  expect(auth).toMatchObject({ sessionSlug: opts.sessionSlug, workerUrl: 'https://worker.example', prompt: false });
  await expect(readSavedAnalysisCard(PERSON.toLowerCase(), opts)).resolves.toBe(state);
  expect(mockedFetch).toHaveBeenCalledTimes(1);
});

it.each([
  [{ published: false }, { status: 'withdrawn' }],
  [{ published: null }, { status: 'none' }],
])('says when a card was withdrawn or never saved', async (body, state) => {
  mockedFetch.mockResolvedValue(reply(body));
  await expect(readSavedAnalysisCard(PERSON, options())).resolves.toEqual(state);
});

it('reads as unknown, and asks again next time, when the card cannot be read', async () => {
  const opts = options();
  for (const answer of [
    reply({ error: 'Token missing ai scope.' }, false),
    reply({ published: true, card: { title: 'x' } }),
  ]) {
    mockedFetch.mockResolvedValueOnce(answer);
    await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toBeNull();
  }
  mockedFetch.mockRejectedValueOnce(new Error('Failed to fetch'));
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toBeNull();
  expect(mockedFetch).toHaveBeenCalledTimes(3);
});

it('says when the session has turned the card off, and asks again next time', async () => {
  mockedFetch.mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ error: 'analysis_card_off' }),
  } as unknown as Response);
  const opts = options();

  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'off' });
  // Not kept: an admin may turn the card back on.
  mockedFetch.mockResolvedValue(reply({ published: null }));
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'none' });
});

it("asks the Worker again, not the visit's memory, when the page needs a fresh answer", async () => {
  const opts = options();
  mockedFetch.mockResolvedValue(reply({ published: null }));
  // As the page's own section reads the card when the page opens.
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'none' });
  // An admin turns the card off. The remembered answer does not know.
  mockedFetch.mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ error: 'analysis_card_off' }),
  } as unknown as Response);
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'none' });
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  // Analyze asks afresh before it pays for a card, and what it learns replaces what was remembered.
  await expect(readSavedAnalysisCard(PERSON, opts, { fresh: true })).resolves.toEqual({ status: 'off' });
  expect(mockedFetch).toHaveBeenCalledTimes(2);
  mockedFetch.mockResolvedValue(reply({ published: false }));
  await expect(readSavedAnalysisCard(PERSON, opts, { fresh: true })).resolves.toEqual({ status: 'withdrawn' });
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'withdrawn' });
  expect(mockedFetch).toHaveBeenCalledTimes(3);
});

it("saves only the card's words, and tells the page at once", async () => {
  const opts = options();
  const shown = normalizeAnalysisCard({ ...CARD, own: true, link: 'contextengine.sh/session/x', account: PERSON });
  mockedFetch.mockResolvedValue(reply({ published: true, card: CARD, savedAt: 5 }));
  const heard = jest.fn();
  const stop = subscribeSavedAnalysisCards(heard);

  await publishSavedAnalysisCard(PERSON, true, shown, opts);

  expect(mockedFetch.mock.calls[0][0]).toBe('https://worker.example/analysis-card/publish');
  expect(bodyOf(0)).toEqual({ published: true, card: CARD });
  // Sent only under the account the card belongs to, never whoever is signed in by then.
  expect(mockedFetch.mock.calls[0][2]).toMatchObject({ requireAccount: PERSON, prompt: false });
  expect(heard).toHaveBeenCalledTimes(1);
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'ready', card: CARD, savedAt: 5 });
  expect(mockedFetch).toHaveBeenCalledTimes(1);

  mockedFetch.mockResolvedValue(reply({ published: false }));
  await publishSavedAnalysisCard(PERSON, false, shown, opts);
  expect(bodyOf(1)).toEqual({ published: false });
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'withdrawn' });
  stop();
  await publishSavedAnalysisCard(PERSON, false, shown, opts);
  expect(heard).toHaveBeenCalledTimes(2);
});

it('what one sign-in read is not shown to another, or after signing out', async () => {
  const opts = options();
  mockedFetch.mockResolvedValueOnce(reply({ published: true, card: CARD, savedAt: 5 }));
  await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toMatchObject({ status: 'ready' });
  mockedFetch.mockResolvedValueOnce(reply({ error: 'Token missing ai scope.' }, false));
  const other = { ...opts, context: { account: '0x00000000000000000000000000000000000000cc' } };
  await expect(readSavedAnalysisCard(PERSON, other)).resolves.toBeNull();
  mockedFetch.mockRejectedValueOnce(new Error('Worker sign-in needed'));
  await expect(readSavedAnalysisCard(PERSON, { ...opts, context: { account: '' } })).resolves.toBeNull();
  expect(mockedFetch).toHaveBeenCalledTimes(3);
});

it('gives up on a read that gets no answer, and asks again next time', async () => {
  jest.useFakeTimers();
  try {
    const opts = options();
    mockedFetch.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        ),
    );
    const read = readSavedAnalysisCard(PERSON, opts);
    await jest.advanceTimersByTimeAsync(SAVED_CARD_READ_TIMEOUT_MS);
    await expect(read).resolves.toBeNull();
    mockedFetch.mockResolvedValueOnce(reply({ published: null }));
    await expect(readSavedAnalysisCard(PERSON, opts)).resolves.toEqual({ status: 'none' });

    // The clock covers the whole request, finding the Worker included, and a save or withdrawal too.
    mockedProxy.mockReturnValue(new Promise(() => {}));
    const stuck = readSavedAnalysisCard(PERSON, options());
    await jest.advanceTimersByTimeAsync(SAVED_CARD_READ_TIMEOUT_MS);
    await expect(stuck).resolves.toBeNull();
    const saving = publishSavedAnalysisCard(PERSON, false, null, options());
    const failed = expect(saving).rejects.toThrow('saved_card_timeout');
    await jest.advanceTimersByTimeAsync(SAVED_CARD_SAVE_TIMEOUT_MS);
    await failed;
  } finally {
    jest.useRealTimers();
  }
});

it('refuses to send what is not a card, and throws what the Worker refused', async () => {
  await expect(publishSavedAnalysisCard(PERSON, true, { title: 'No figure' }, options())).rejects.toThrow(
    'invalid_card',
  );
  expect(mockedFetch).not.toHaveBeenCalled();
  mockedFetch.mockResolvedValue(reply({ error: 'card_store_unavailable' }, false));
  await expect(publishSavedAnalysisCard(PERSON, true, CARD, options())).rejects.toThrow('card_store_unavailable');
});

it('a card the page builds is a card the Worker keeps, and reads back the same', () => {
  const questions = [
    { id: 'q1', type: 'binary', prompt: 'Should towns run their own water?', answer: 'Agree' },
    {
      id: 'q2',
      type: 'freeform',
      prompt: 'What makes a rule fair?',
      answer: 'People who live with it get a say in it.',
    },
    {
      id: 'q3',
      type: 'quadratic',
      prompt: 'Which matter most?',
      options: ['Trust', 'Time', 'Money'],
      answer: [3, 1, 3],
    },
  ];
  const place = { own: true, link: 'contextengine.sh/session/salon', account: PERSON };
  const built = buildAnalysisCard(
    {
      historicalAlignment: { figure: 'Elinor Ostrom (1933–2012)' },
      card: {
        title: 'Keeps the commons in common hands',
        matchNote: 'Both trust neighbours to set the rules.',
        tastes: {
          book: { title: 'Governing the Commons', by: 'Elinor Ostrom, 1990' },
          song: { title: 'Common People' },
        },
        answers: { ownWords: { questionId: 'q2', quote: 'People who live with it get a say' } },
      },
    },
    questions,
    place,
  );
  const saved = normalizeSavedAnalysisCard(built);
  expect(saved).not.toBeNull();
  expect(normalizeAnalysisCard({ ...saved, ...place })).toEqual(built);
});

it('is on unless the session turned it off, and only where its Worker has the card', async () => {
  const available = (sessionConfig: unknown) => analysisCardAvailableFor({ sessionSlug: 's', sessionConfig });
  const has = (features: string[]) => mockedCapabilities.mockResolvedValue({ legacy: false, features });
  has(['analysis_card_v1']);
  // A session that never saved the setting, as every session from before it, has the card on.
  for (const sessionConfig of [{}, { analysisCardEnabled: true }, null, undefined]) {
    await expect(available(sessionConfig)).resolves.toBe(true);
  }
  expect(mockedCapabilities).toHaveBeenLastCalledWith('https://worker.example', 's');
  // Turned off, the Worker is not even asked.
  mockedCapabilities.mockClear();
  await expect(available({ analysisCardEnabled: false })).resolves.toBe(false);
  expect(mockedCapabilities).not.toHaveBeenCalled();
  // A Worker from before the card, one that can't be asked, or none found: nothing of the card shows.
  has(['worker_groups']);
  await expect(available({})).resolves.toBe(false);
  mockedCapabilities.mockResolvedValue({ legacy: false, features: [], unavailable: true });
  await expect(available({})).resolves.toBe(false);
  has(['analysis_card_v1']);
  mockedProxy.mockRejectedValueOnce(new Error('no worker'));
  await expect(available({})).resolves.toBe(false);
});
