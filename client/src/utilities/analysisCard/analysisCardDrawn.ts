// The card as this page drew it, sent to the Session Worker beside the card its owner saved, so a reader who is
// given the saved card (an AI agent the session lets read it, say) can be given its picture too. The Worker keeps
// it under the saved card's own rule. It is sent only for a card saved in this visit, once that card has been
// drawn in full, and only to a Worker that says it keeps drawn cards. Nothing here ever fails a save: a picture
// that can't be made or sent is simply not kept.
import {
  ANALYSIS_CARD_DRAWING_FEATURE,
  ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES,
  normalizeSavedAnalysisCard,
} from '@ce-shared/analysisCardSaved.mjs';

import { resolveAiSessionOptions } from '../ai/aiClientRequestOptions';
import { resolveAiWorkerEndpoint } from '../ai/aiClientWorkerTransport';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { readWorkerCapabilities } from '../worker/workerCapabilities';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';

type DrawnPages = { page1: HTMLCanvasElement; page2: HTMLCanvasElement };

// A photograph-like page is far smaller as a JPEG; each step down is tried only if the last was too large.
const JPEG_QUALITIES = [0.9, 0.8, 0.68, 0.55];
const SEND_TIMEOUT_MS = 30_000;

const keyOf = (card: unknown): string => {
  const saved = normalizeSavedAnalysisCard(card);
  return saved ? JSON.stringify(saved) : '';
};

// The last card drawn in full on this page, and the card saved in this visit.
let drawn: { key: string; pages: DrawnPages } | null = null;
let saved: {
  key: string;
  account: string;
  opts: unknown;
  savedAt: number;
  sentPages: DrawnPages | null;
  // What was last kept for this save, so the same picture drawn again is not sent again.
  sentPicture: string;
} | null = null;
// Sends go one at a time, so a later drawing is never overtaken by an earlier one.
let queue: Promise<void> = Promise.resolve();
const later = (): void => {
  queue = queue.then(sendWhenBoth, sendWhenBoth);
};

const jpegOf = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });

const base64Of = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The picture could not be read.'));
    // "data:image/jpeg;base64,<the picture>"
    reader.onload = () => resolve(String(reader.result || '').replace(/^[^,]*,/, ''));
    reader.readAsDataURL(blob);
  });

const pageOf = async (canvas: HTMLCanvasElement): Promise<{ mime: string; base64: string } | null> => {
  for (const quality of JPEG_QUALITIES) {
    const blob = await jpegOf(canvas, quality);
    if (!blob || blob.type !== 'image/jpeg') return null;
    if (blob.size <= ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES) return { mime: 'image/jpeg', base64: await base64Of(blob) };
  }
  return null;
};

const send = async (want: NonNullable<typeof saved>, pages: DrawnPages): Promise<boolean> => {
  const { account, opts } = want;
  const { context, sessionConfig, sessionSlug } = resolveAiSessionOptions(opts);
  const allowDemoFallback = defaultStrictAllowDemoFallback();
  const corsWorkerUrl = await getCorsProxyUrlOrThrow({ sessionSlug, sessionConfig, context, allowDemoFallback });
  const { baseUrl } = resolveAiWorkerEndpoint(corsWorkerUrl);
  // An older Worker has no such route: it is never sent the pages.
  const { features } = await readWorkerCapabilities(baseUrl, sessionSlug);
  if (!features.includes(ANALYSIS_CARD_DRAWING_FEATURE)) return false;
  const made = [await pageOf(pages.page1), await pageOf(pages.page2)];
  if (made.some((page) => !page)) return false;
  // The same picture as the one already kept: a redraw of the same card, not a new one.
  const picture = made.map((page) => `${page?.base64.length}:${page?.base64.slice(-96)}`).join('|');
  if (picture === want.sentPicture) return true;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetchWorkerWithAuth(
      `${baseUrl}/analysis-card/drawing/save`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The save these pages were drawn for: the Worker refuses them beside any other.
        body: JSON.stringify({ savedAt: want.savedAt, pages: made }),
        signal: timeout.signal,
      },
      // The page's own doing, never a sign-in prompt; and only while the saver is still the one signed in.
      {
        sessionSlug,
        sessionConfig,
        context,
        workerUrl: baseUrl,
        allowDemoFallback,
        prompt: false,
        requireAccount: account,
      },
    );
    if (response.ok) want.sentPicture = picture;
    return response.ok;
  } finally {
    clearTimeout(timer);
  }
};

async function sendWhenBoth(): Promise<void> {
  const want = saved;
  const have = drawn;
  if (!want || !have || want.key !== have.key || want.sentPages === have.pages) return;
  want.sentPages = have.pages;
  try {
    // A refusal or failure is left: the card's words are saved, and its picture is an extra.
    if (!(await send(want, have.pages)) && saved === want && want.sentPages === have.pages) {
      want.sentPages = null;
    }
  } catch {
    if (saved === want && want.sentPages === have.pages) want.sentPages = null;
  }
}

/** The card was drawn in full, with its picture or the knowledge that it has none. */
export const noteAnalysisCardDrawn = (card: unknown, pages: DrawnPages): void => {
  const key = keyOf(card);
  if (!key) return;
  drawn = { key, pages };
  later();
};

/** The signed-in person saved this card on their page just now. */
export const noteAnalysisCardSaved = (account: string, card: unknown, opts: unknown, savedAt: number): void => {
  const key = keyOf(card);
  saved = key ? { key, account, opts, savedAt, sentPages: null, sentPicture: '' } : null;
  later();
};

/** The card was withdrawn, or the person is no longer the one signed in: nothing more is sent for it. */
export const forgetAnalysisCardSaved = (): void => {
  saved = null;
};

export const __test__analysisCardDrawn = {
  reset: (): void => {
    drawn = null;
    saved = null;
    queue = Promise.resolve();
  },
  settle: (): Promise<void> => queue,
};
