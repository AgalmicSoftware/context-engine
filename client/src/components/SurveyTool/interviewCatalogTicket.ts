import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';

/** A ticket is renewed while it has this long left, so a copied prompt's link keeps working a while. */
export const INTERVIEW_CATALOG_TICKET_RENEW_MS = 10 * 60 * 1000;
const TICKET_PATTERN = /^ic1\.[A-Za-z0-9_.-]{1,200}$/;

export type InterviewCatalogTicket = { ticket: string; expiresAtMs: number };

const held = new Map<string, InterviewCatalogTicket>();

/** A ticket that lets the signed-in person's own AI read the session's interview catalog as them, for an hour
 *  at most. One is held per Worker, session and account, and renewed when little of it is left. */
export const getInterviewCatalogTicket = async ({
  workerUrl,
  sessionSlug,
  sessionConfig,
  context,
  prompt,
  fresh = false,
}: {
  workerUrl: string;
  sessionSlug: string;
  sessionConfig?: unknown;
  context?: unknown;
  /** false: sign in only if that asks the person for nothing. */
  prompt?: boolean;
  /** Skip the held ticket, as after the Worker refused it. */
  fresh?: boolean;
}): Promise<InterviewCatalogTicket> => {
  const base = workerUrl.replace(/\/+$/, '').replace(/\/ai$/i, '');
  const account = String((context as { account?: unknown } | null | undefined)?.account || '').toLowerCase();
  const key = [base, sessionSlug.toLowerCase(), account].join('\n');
  const current = held.get(key);
  if (!fresh && current && current.expiresAtMs - Date.now() > INTERVIEW_CATALOG_TICKET_RENEW_MS) return current;
  const response = await fetchWorkerWithAuth(
    `${base}/agent/interview-catalog-ticket`,
    { method: 'POST', cache: 'no-store' },
    { sessionSlug, sessionConfig, context, workerUrl: base, prompt },
  );
  const body = response.ok ? await response.json().catch(() => null) : null;
  const ticket = typeof body?.ticket === 'string' && TICKET_PATTERN.test(body.ticket) ? body.ticket : '';
  const expiresAtMs = Number(body?.expiresAt) * 1000;
  if (!ticket || !(expiresAtMs > Date.now())) throw new Error('Could not get a private catalog link for your AI.');
  const issued = { ticket, expiresAtMs };
  held.set(key, issued);
  return issued;
};
