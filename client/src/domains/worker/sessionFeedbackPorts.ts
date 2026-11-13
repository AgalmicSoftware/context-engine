/** @file sessionFeedbackPorts.ts: sending feedback about the app to a session's Worker, and an admin's reading of it. */
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { buildSignedAdminActionAuth, fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { readWorkerCapabilities } from '../../utilities/worker/workerCapabilities';
import { defaultStrictAllowDemoFallback } from '../../utilities/worker/workerSessionResolution.js';
import { toStr } from '../../utilities/shared/primitives.js';

export const FEEDBACK_FEATURE = 'session_feedback';
export const FEEDBACK_TEXT_MAX = 2000;
export const FEEDBACK_REACH_MAX = 200;

export type FeedbackOptions = { sessionSlug: string; sessionConfig: unknown; account: string };

/** What goes with the text: where they were, never the page's address, which can carry invites. */
export type FeedbackDraft = {
  text: string;
  view: string;
  theme: string;
  screen: 'phone' | 'tablet' | 'desktop';
  /** Left out when the app was built without one. */
  appRelease?: string;
  /** Only when they ticked "You may contact me". */
  reachMe?: string;
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
  contact: { address: string; displayName: string; reachMe: string } | null;
};

export type FeedbackAdmin = {
  workerOrigin: string;
  sessionSlug: string;
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

/** True when the session's admins left the Feedback box on and its Worker takes feedback (from 0.9.8). */
export const feedbackOffered = async (options: FeedbackOptions): Promise<boolean> => {
  if (asRecord(options.sessionConfig).feedbackEnabled === false) return false;
  try {
    const capabilities = await readWorkerCapabilities(await workerBase(options), options.sessionSlug);
    return capabilities.features.includes(FEEDBACK_FEATURE);
  } catch {
    return false;
  }
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
  const { reachMe, ...message } = draft;
  // No referrer: the page's address can carry a group or an invite.
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reachMe ? { ...message, contact: { reachMe } } : message),
    referrerPolicy: 'no-referrer',
  };
  const answer = async (): Promise<Response> => {
    const base = await workerBase(options);
    if (options.account) {
      const signedIn = await fetchWorkerWithAuth(`${base}/feedback`, init, {
        ...session(options),
        workerUrl: base,
        prompt: false,
      }).catch(() => null);
      // Anything but a sign-in the Worker didn't take is the answer; that one is sent again as a visitor's.
      if (signedIn && signedIn.status !== 401) return signedIn;
    }
    return fetch(`${base}/feedback?slug=${encodeURIComponent(options.sessionSlug)}`, { ...init, credentials: 'omit' });
  };
  const response = await answer().catch(() => null);
  if (!response?.ok) throw new Error((response && (await refusal(response))) || NOT_SENT);
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
  const contact = row.contact ? asRecord(row.contact) : null;
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
    contact: contact && {
      address: toStr(contact.address),
      displayName: toStr(contact.displayName),
      reachMe: toStr(contact.reachMe),
    },
  };
};

// The Worker stores 2,000 at most and gives 100 a page.
const PAGE = 100;
const LIST_PAGES_MAX = 20;

/** Every stored message, newest first. Only a full admin's signature is accepted. */
export const listFeedback = async (admin: FeedbackAdmin): Promise<FeedbackMessage[]> => {
  const messages: FeedbackMessage[] = [];
  let cursor = '';
  for (let page = 0; page < LIST_PAGES_MAX; page += 1) {
    const result = await adminPost(admin, 'feedback/list', cursor ? { limit: PAGE, cursor } : { limit: PAGE });
    if (Array.isArray(result.messages))
      messages.push(...result.messages.map(messageOf).filter((message) => message.id));
    cursor = toStr(result.cursor);
    if (!cursor) break;
  }
  return messages;
};

/** Deletes the named messages, and only those: one that arrived since they were listed stays to be read. */
export const deleteFeedback = async (admin: FeedbackAdmin, ids: string[]): Promise<void> => {
  for (let start = 0; start < ids.length; start += PAGE) {
    await adminPost(admin, 'feedback/delete', { ids: ids.slice(start, start + PAGE) });
  }
};

// A spreadsheet runs a cell that starts with one of these as a formula; feedback is strangers' text.
const csvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const feedbackCsv = (messages: FeedbackMessage[]): string =>
  [
    [
      'Sent',
      'Feedback',
      'View',
      'Theme',
      'Screen',
      'App release',
      'Worker release',
      'Signed in',
      'Reach me',
      'Address',
      'Name',
    ],
    ...messages.map((message) => [
      message.createdAt,
      message.text,
      message.view,
      message.theme,
      message.screen,
      message.appRelease,
      message.workerRelease,
      message.signedIn ? 'yes' : 'no',
      message.contact?.reachMe || '',
      message.contact?.address || '',
      message.contact?.displayName || '',
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
    .concat('\r\n');
