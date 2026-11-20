import { ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES, normalizeAnalysisCardDrawing } from '@ce-shared/analysisCardSaved.mjs';

import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { readWorkerCapabilities } from '../worker/workerCapabilities';
import {
  __test__analysisCardDrawn,
  forgetAnalysisCardSaved,
  noteAnalysisCardDrawn,
  noteAnalysisCardSaved,
} from './analysisCardDrawn';

jest.mock('../worker/corsProxy.js', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));
jest.mock('../worker/workerCapabilities', () => ({ readWorkerCapabilities: jest.fn() }));

const mockedProxy = jest.mocked(getCorsProxyUrlOrThrow);
const mockedFetch = jest.mocked(fetchWorkerWithAuth);
const mockedCapabilities = jest.mocked(readWorkerCapabilities);
const PERSON = '0x00000000000000000000000000000000000000aa';
const CARD = { title: 'Keeps the commons in common hands', figure: 'Elinor Ostrom (1933–2012)' };
const OPTS = { sessionSlug: 'drawn-card', context: { account: PERSON } };
const SAVED_AT = 1763460000000;

// A canvas whose JPEG is `size` bytes at the first quality tried, and a fifth smaller at each one after.
const canvas = (size: number, qualities: number[] = []) =>
  ({
    toBlob: (done: (blob: Blob | null) => void, type: string, quality: number) => {
      qualities.push(quality);
      const bytes = new Uint8Array(Math.round(size * (quality / 0.9) ** 3));
      bytes.set([0xff, 0xd8, 0xff, 0xe0]);
      bytes.set([0xff, 0xd9], bytes.length - 2);
      done(new Blob([bytes], { type }));
    },
  }) as unknown as HTMLCanvasElement;
const pages = (size = 2000) => ({ page1: canvas(size), page2: canvas(size) });
const sentBody = (call = 0) => JSON.parse(String(mockedFetch.mock.calls[call][1]?.body));
const withFeature = (on: boolean) =>
  mockedCapabilities.mockResolvedValue({
    features: on ? ['analysis_card_v1', 'analysis_card_drawing_v1'] : ['analysis_card_v1'],
  } as never);

beforeEach(() => {
  jest.clearAllMocks();
  __test__analysisCardDrawn.reset();
  mockedProxy.mockResolvedValue('https://worker.example/ai');
  mockedFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
  withFeature(true);
});

it('sends the drawn pages once the card saved in this visit has been drawn in full', async () => {
  noteAnalysisCardDrawn(CARD, pages());
  await __test__analysisCardDrawn.settle();
  // Drawn, but not saved: nothing is sent.
  expect(mockedFetch).not.toHaveBeenCalled();

  noteAnalysisCardSaved(PERSON, CARD, OPTS, SAVED_AT);
  await __test__analysisCardDrawn.settle();
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  const [url, init, auth] = mockedFetch.mock.calls[0];
  expect(url).toBe('https://worker.example/analysis-card/drawing/save');
  expect(init?.method).toBe('POST');
  expect(auth).toMatchObject({ prompt: false, requireAccount: PERSON, sessionSlug: 'drawn-card' });
  // What is sent is what the Worker keeps: two JPEG pages it would accept.
  expect(normalizeAnalysisCardDrawing(sentBody().pages)).toEqual(sentBody().pages);
  expect(sentBody().pages.map((page: { mime: string }) => page.mime)).toEqual(['image/jpeg', 'image/jpeg']);
  // With the save they were drawn for.
  expect(sentBody().savedAt).toBe(SAVED_AT);
});

it('sends again when the card is drawn differently, as when its picture arrives; not for the same picture or another card', async () => {
  noteAnalysisCardSaved(PERSON, CARD, OPTS, SAVED_AT);
  noteAnalysisCardDrawn({ ...CARD, title: 'Another card' }, pages());
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch).not.toHaveBeenCalled();
  noteAnalysisCardDrawn(CARD, pages());
  await __test__analysisCardDrawn.settle();
  // Drawn again with nothing changed, as each time the card is shown: the same picture is not sent twice.
  noteAnalysisCardDrawn(CARD, pages());
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  noteAnalysisCardDrawn(CARD, pages(2400));
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch).toHaveBeenCalledTimes(2);
});

it('never sends the pages to a Worker that does not keep drawn cards, or after a withdrawal', async () => {
  withFeature(false);
  noteAnalysisCardSaved(PERSON, CARD, OPTS, SAVED_AT);
  noteAnalysisCardDrawn(CARD, pages());
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch).not.toHaveBeenCalled();

  withFeature(true);
  forgetAnalysisCardSaved();
  noteAnalysisCardDrawn(CARD, pages());
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch).not.toHaveBeenCalled();
});

it('makes a page smaller until it fits, and sends nothing when it never does', async () => {
  const tried: number[] = [];
  noteAnalysisCardSaved(PERSON, CARD, OPTS, SAVED_AT);
  noteAnalysisCardDrawn(CARD, {
    page1: canvas(ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES * 1.2, tried),
    page2: canvas(2000),
  });
  await __test__analysisCardDrawn.settle();
  expect(tried).toEqual([0.9, 0.8]);
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  expect(normalizeAnalysisCardDrawing(sentBody().pages)).not.toBeNull();

  mockedFetch.mockClear();
  noteAnalysisCardDrawn(CARD, { page1: canvas(ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES * 20), page2: canvas(2000) });
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch).not.toHaveBeenCalled();
});

it('a failed send never throws, and the same pages can be sent again', async () => {
  mockedFetch.mockRejectedValueOnce(new Error('offline'));
  const drawnPages = pages();
  noteAnalysisCardSaved(PERSON, CARD, OPTS, SAVED_AT);
  noteAnalysisCardDrawn(CARD, drawnPages);
  await __test__analysisCardDrawn.settle();
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
  noteAnalysisCardDrawn(CARD, drawnPages);
  await __test__analysisCardDrawn.settle();
  expect(mockedFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
});
