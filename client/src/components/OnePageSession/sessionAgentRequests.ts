/** @file sessionAgentRequests.ts: the session page's calls to its Session Worker's Session Agent. */
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { defaultStrictAllowDemoFallback } from '../../utilities/worker/workerSessionResolution.js';
import { toStr } from '../../utilities/shared/primitives.js';

export type SessionAgentStyle = 'general' | 'detailed';

/** How the Worker would answer this person: no style when it doesn't admit them. */
export type SessionAgentStatus = {
  /** False once an admin has turned it off. */
  on: boolean;
  answers: SessionAgentStyle | null;
  /** The audience that admits them, by position, or 'admin'. */
  audience: number | 'admin' | null;
  optedOut: boolean;
  /** Their address is left off exported items; null when they have no such switch. */
  unattributed: boolean | null;
  /** Why it answers no one, when the session has ended or its AI is off. */
  closed: 'session_ended' | 'ai_disabled' | null;
  /** The session lets an asker have a chat stored. */
  recording: boolean;
  /** Asked for without signing in: answers are General at most, and there are no switches. */
  signedOut: boolean;
};

/** What to keep of one chat: with the asker's address or without, and a name if they gave one; null keeps nothing. */
export type SessionAgentKeep = { attribution: 'address' | 'anonymous'; name: string } | null;

export type SessionAgentReply = {
  answer: string;
  answers: SessionAgentStyle;
  /** How much the answer drew on: items of context, the results, members' answers. */
  read: { context: number; results: boolean; answers: number };
  note: string;
  /** Whether this chat was stored; null when the session stores none. */
  stored: boolean | null;
};

export type SessionAgentRequestOptions = { sessionSlug: string; sessionConfig: unknown; account: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const styleOf = (value: unknown): SessionAgentStyle | null =>
  value === 'general' || value === 'detailed' ? value : null;

/** The Worker asks for a sign-in: thrown for someone not signed in whom it won't answer as they are. */
export class SignInToAsk extends Error {}

// Each route takes a JSON POST: a signed-in person's with their sign-in, anyone else's with no sign-in and the
// session named in the query, and it never asks for a signature. The Worker's errors are plain sentences.
const post = async (path: string, body: Record<string, unknown>, options: SessionAgentRequestOptions) => {
  const session = {
    sessionSlug: options.sessionSlug,
    sessionConfig: options.sessionConfig,
    context: { account: options.account },
    allowDemoFallback: defaultStrictAllowDemoFallback(),
  };
  const base = toStr(await getCorsProxyUrlOrThrow(session))
    .trim()
    .replace(/\/+$/, '');
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = options.account
    ? await fetchWorkerWithAuth(`${base}${path}`, init, { ...session, workerUrl: base })
    : await fetch(`${base}${path}?slug=${encodeURIComponent(options.sessionSlug)}`, {
        ...init,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
  const result = asRecord(await response.json().catch(() => ({})));
  // A Session Worker from before signed-out asking answers 401 too.
  if (!options.account && response.status === 401) throw new SignInToAsk('Sign in to ask the Session Agent.');
  if (!response.ok) {
    throw new Error(toStr(result.error) || `The Session Worker couldn’t answer (${response.status}). Try again.`);
  }
  return result;
};

// Not signed in and not answered as they are, the Session Agent is on but closed to them until they sign in.
const SIGN_IN_FIRST: SessionAgentStatus = {
  on: true,
  answers: null,
  audience: null,
  optedOut: false,
  unattributed: null,
  closed: null,
  recording: false,
  signedOut: true,
};

export const readSessionAgentStatus = async (options: SessionAgentRequestOptions): Promise<SessionAgentStatus> => {
  let result: Record<string, unknown>;
  try {
    result = await post('/session-agent/status', {}, options);
  } catch (error) {
    if (error instanceof SignInToAsk) return SIGN_IN_FIRST;
    throw error;
  }
  const audience = result.audience === 'admin' || typeof result.audience === 'number' ? result.audience : null;
  return {
    on: result.on === true,
    answers: styleOf(result.answers),
    audience,
    optedOut: result.optedOut === true,
    // Absent from a Session Worker without the switch, and for someone signed in without an address.
    unattributed: typeof result.unattributed === 'boolean' ? result.unattributed : null,
    closed: result.closed === 'session_ended' || result.closed === 'ai_disabled' ? result.closed : null,
    recording: result.recording === true,
    signedOut: !options.account,
  };
};

// `keep` is sent only where the session stores chats: without it the Worker keeps nothing.
export const askSessionAgent = async (
  question: string,
  options: SessionAgentRequestOptions,
  keep?: SessionAgentKeep,
): Promise<SessionAgentReply> => {
  const stored =
    keep === undefined
      ? {}
      : keep
        ? { store: true, attribution: keep.attribution, ...(keep.name ? { name: keep.name } : {}) }
        : { store: false };
  const result = await post('/session-agent/ask', { question, ...stored }, options);
  const read = asRecord(result.read);
  return {
    answer: toStr(result.answer),
    answers: styleOf(result.answers) || 'general',
    read: { context: Number(read.context) || 0, results: read.results === true, answers: Number(read.answers) || 0 },
    note: toStr(result.note),
    stored: typeof result.stored === 'boolean' ? result.stored : null,
  };
};

/** Turns the agent's use of this person's answers and files off (true) or back on. */
export const setSessionAgentOptOut = async (optedOut: boolean, options: SessionAgentRequestOptions): Promise<boolean> =>
  (await post('/session-agent/opt-out', { optedOut }, options)).optedOut === true;

/** Leaves this person's address off what an admin exports (true), or puts it back. */
export const setSessionAgentUnattributed = async (
  unattributed: boolean,
  options: SessionAgentRequestOptions,
): Promise<boolean> => (await post('/session-agent/attribution', { unattributed }, options)).unattributed === true;
