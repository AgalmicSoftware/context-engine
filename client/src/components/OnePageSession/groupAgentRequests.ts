/** @file groupAgentRequests.ts: the session page's calls to its Session Worker's Group Agent. */
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { defaultStrictAllowDemoFallback } from '../../utilities/worker/workerSessionResolution.js';
import { toStr } from '../../utilities/shared/primitives.js';

export type GroupAgentStyle = 'general' | 'detailed';

/** How the Worker would answer this person: no style when it doesn't admit them. */
export type GroupAgentStatus = {
  /** False once an admin has turned it off. */
  on: boolean;
  answers: GroupAgentStyle | null;
  /** The audience that admits them, by position, or 'admin'. */
  audience: number | 'admin' | null;
  optedOut: boolean;
};

export type GroupAgentReply = {
  answer: string;
  answers: GroupAgentStyle;
  /** How much the answer drew on: items of context, the results, members' answers. */
  read: { context: number; results: boolean; answers: number };
  note: string;
};

export type GroupAgentRequestOptions = { sessionSlug: string; sessionConfig: unknown; account: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const styleOf = (value: unknown): GroupAgentStyle | null =>
  value === 'general' || value === 'detailed' ? value : null;

// Every route takes a signed-in person's JSON POST; the Worker's errors are plain sentences.
const post = async (path: string, body: Record<string, unknown>, options: GroupAgentRequestOptions) => {
  const session = {
    sessionSlug: options.sessionSlug,
    sessionConfig: options.sessionConfig,
    context: { account: options.account },
    allowDemoFallback: defaultStrictAllowDemoFallback(),
  };
  const base = toStr(await getCorsProxyUrlOrThrow(session))
    .trim()
    .replace(/\/+$/, '');
  const response = await fetchWorkerWithAuth(
    `${base}${path}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { ...session, workerUrl: base },
  );
  const result = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(toStr(result.error) || `The Session Worker couldn’t answer (${response.status}). Try again.`);
  }
  return result;
};

export const readGroupAgentStatus = async (options: GroupAgentRequestOptions): Promise<GroupAgentStatus> => {
  const result = await post('/group-agent/status', {}, options);
  const audience = result.audience === 'admin' || typeof result.audience === 'number' ? result.audience : null;
  return { on: result.on === true, answers: styleOf(result.answers), audience, optedOut: result.optedOut === true };
};

export const askGroupAgent = async (question: string, options: GroupAgentRequestOptions): Promise<GroupAgentReply> => {
  const result = await post('/group-agent/ask', { question }, options);
  const read = asRecord(result.read);
  return {
    answer: toStr(result.answer),
    answers: styleOf(result.answers) || 'general',
    read: { context: Number(read.context) || 0, results: read.results === true, answers: Number(read.answers) || 0 },
    note: toStr(result.note),
  };
};

/** Turns the agent's use of this person's answers and files off (true) or back on. */
export const setGroupAgentOptOut = async (optedOut: boolean, options: GroupAgentRequestOptions): Promise<boolean> =>
  (await post('/group-agent/opt-out', { optedOut }, options)).optedOut === true;
