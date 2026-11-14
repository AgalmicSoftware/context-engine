/** @file sessionFeedbackPorts.ts: sending feedback about the app to a session's Worker, and an admin's reading of it. */
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { buildSignedAdminActionAuth, fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { readWorkerCapabilities } from '../../utilities/worker/workerCapabilities';
import { readWorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';
import { defaultStrictAllowDemoFallback } from '../../utilities/worker/workerSessionResolution.js';
import { toStr } from '../../utilities/shared/primitives.js';

export const FEEDBACK_FEATURE = 'session_feedback';
export const FEEDBACK_TEXT_MAX = 2000;

export type FeedbackOptions = { sessionSlug: string; sessionConfig: unknown; account: string };

/** What goes with the text: where they were, never the page's address, which can carry invites. */
export type FeedbackDraft = {
  text: string;
  view: string;
  theme: string;
  screen: 'phone' | 'tablet' | 'desktop';
  /** Left out when the app was built without one. */
  appRelease?: string;
};

export type FeedbackMessage = {
  id: string;
  text: string;
  createdAt: string;
  view: string;
  theme: string;
  screen: string;
  appRelease: string;
  workerRelease: string;
  signedIn: boolean;
};

export type FeedbackAdmin = {
  workerOrigin: string;
  sessionSlug: string;
  sessionConfig: unknown;
  sessionIdHex: string;
  account: string;
  provider?: unknown;
  chainId: number;
  fetchImpl?: typeof fetch;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const session = (options: FeedbackOptions) => ({
  sessionSlug: options.sessionSlug,
  sessionConfig: options.sessionConfig,
  context: { account: options.account },
  allowDemoFallback: defaultStrictAllowDemoFallback(),
});

const workerBase = async (options: FeedbackOptions): Promise<string> =>
  toStr(await getCorsProxyUrlOrThrow(session(options)))
    .trim()
    .replace(/\/+$/, '');

/** The open part of the page as a short name. Never an address: links carry group ids, invites and prefills. */
export const feedbackView = (view: string): string => view.replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 80) || 'session';

/**
 * True when the session is run by its Worker, its admins left the Feedback box on, and the Worker takes
 * feedback (from 0.9.8). An on-chain session has no place for its admins to read it, so it is never offered.
 */
export const feedbackOffered = async (options: FeedbackOptions): Promise<boolean> => {
  const config = asRecord(options.sessionConfig);
  // The Worker's own test of a session it runs, so the page and the Worker never disagree.
  const workerRun = asRecord(asRecord(config.sessionModeProfile).authority).mode === 'worker_canonical';
  if (config.feedbackEnabled === false || !workerRun) return false;
  try {
    const capabilities = await readWorkerCapabilities(await workerBase(options), options.sessionSlug);
    return capabilities.features.includes(FEEDBACK_FEATURE);
  } catch {
    return false;
  }
};

/**
 * True when the session's Worker holds an AI key the session pays for, so speech can be written down there as
 * for an answer. Asked when the form first opens; the Worker's reply is kept for half a minute.
 */
export const dictationOffered = async (options: FeedbackOptions): Promise<boolean> => {
  const { sessionSlug, sessionConfig, account } = options;
  const presence = await readWorkerResourcePresence({ sessionSlug, sessionConfig, context: { account } }).catch(
    () => null,
  );
  return presence?.ai === true;
};

// The feedback route's own refusals are plain sentences for the sender; any other error's text may hold anything.
const refusal = async (response: Response): Promise<string> => {
  const { error, reason } = asRecord(await response.json().catch(() => ({})));
  return toStr(reason).startsWith('feedback_') ? toStr(error) : '';
};

const NOT_SENT = 'Not sent. Try again.';

/**
 * Sends one message. A signed-in person's goes with their sign-in when the page already holds one; it never
 * asks for a signature, and otherwise goes as a visitor's, since sign-in trouble is feedback too. An error's
 * message is the Worker's own sentence for a refusal, or a plain one.
 */
export const sendFeedback = async (draft: FeedbackDraft, options: FeedbackOptions): Promise<void> => {
  // No referrer: the page's address can carry a group or an invite.
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
    referrerPolicy: 'no-referrer',
  };
  // A send's outcome: taken, or the feedback route's own reason for refusing it.
  const read = async (response: Response) => ({ ok: response.ok, why: response.ok ? '' : await refusal(response) });
  const answer = async () => {
    const base = await workerBase(options);
    if (options.account) {
      const signedIn = await fetchWorkerWithAuth(`${base}/feedback`, init, {
        ...session(options),
        workerUrl: base,
        prompt: false,
      }).then(read, () => null);
      // Taken, or refused by the feedback route itself, is the answer. Anything else is a sign-in the
      // Worker didn't take, and the message goes again as a visitor's.
      if (signedIn && (signedIn.ok || signedIn.why)) return signedIn;
    }
    return read(
      await fetch(`${base}/feedback?slug=${encodeURIComponent(options.sessionSlug)}`, { ...init, credentials: 'omit' }),
    );
  };
  const result = await answer().catch(() => null);
  if (!result?.ok) throw new Error(result?.why || NOT_SENT);
};

const adminPost = async (admin: FeedbackAdmin, action: string, body: Record<string, unknown>) => {
  const { data } = await postSignedAdminWorkerRequest({
    action,
    path: `/admin/${action}`,
    workerUrl: admin.workerOrigin,
    body: { ...body, sessionId: admin.sessionIdHex },
    ...(admin.fetchImpl ? { fetchImpl: admin.fetchImpl } : {}),
    signAdminAction: ({ action: signed, body: signedBody, workerUrl }) =>
      buildSignedAdminActionAuth({
        action: signed,
        slug: admin.sessionSlug,
        sessionId: admin.sessionIdHex || undefined,
        sessionAuthorityMode: 'worker_canonical',
        body: signedBody,
        workerUrl,
        context: {
          account: admin.account,
          chainId: admin.chainId,
          providerLike: typeof admin.provider === 'string' ? admin.provider : undefined,
        },
      }),
  });
  return asRecord(data);
};

const messageOf = (value: unknown): FeedbackMessage => {
  const row = asRecord(value);
  return {
    id: toStr(row.id),
    text: toStr(row.text),
    createdAt: toStr(row.createdAt),
    view: toStr(row.view),
    theme: toStr(row.theme),
    screen: toStr(row.screen),
    appRelease: toStr(row.appRelease),
    workerRelease: toStr(row.workerRelease),
    signedIn: row.signedIn === true,
  };
};

// The Worker stores 2,000 at most and gives 100 a page.
const PAGE = 100;
const LIST_PAGES_MAX = 20;

/**
 * Every stored message, newest first. Read with the admin's sign-in, which the Worker checks; no page takes a
 * signature, of which a person may make only a few a minute.
 */
export const listFeedback = async (admin: FeedbackAdmin): Promise<FeedbackMessage[]> => {
  const base = admin.workerOrigin.replace(/\/+$/, '');
  const messages: FeedbackMessage[] = [];
  let cursor = '';
  for (let page = 0; page < LIST_PAGES_MAX; page += 1) {
    const query = new URLSearchParams({ slug: admin.sessionSlug, limit: String(PAGE), ...(cursor ? { cursor } : {}) });
    const response = await fetchWorkerWithAuth(
      `${base}/admin/feedback?${query}`,
      { method: 'GET' },
      {
        ...session({ sessionSlug: admin.sessionSlug, sessionConfig: admin.sessionConfig, account: admin.account }),
        workerUrl: base,
      },
    );
    const result = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw new Error(toStr(result.error) || `The Session Worker couldn’t list the feedback (${response.status}).`);
    }
    if (Array.isArray(result.messages))
      messages.push(...result.messages.map(messageOf).filter((message) => message.id));
    cursor = toStr(result.cursor);
    if (!cursor) break;
  }
  return messages;
};

/**
 * Deletes the named messages (100 at most), or every message up to and including one: the newest listed, so
 * "all" is one signature and a message that arrived since stays to be read.
 */
export const deleteFeedback = async (
  admin: FeedbackAdmin,
  what: { ids: string[] } | { through: string },
): Promise<void> => {
  await adminPost(admin, 'feedback/delete', what);
};

// A spreadsheet runs a cell that starts with one of these as a formula; feedback is strangers' text.
const csvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const feedbackCsv = (messages: FeedbackMessage[]): string =>
  [
    ['Sent', 'Feedback', 'View', 'Theme', 'Screen', 'App release', 'Worker release', 'Signed in'],
    ...messages.map((message) => [
      message.createdAt,
      message.text,
      message.view,
      message.theme,
      message.screen,
      message.appRelease,
      message.workerRelease,
      message.signedIn ? 'yes' : 'no',
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
    .concat('\r\n');
