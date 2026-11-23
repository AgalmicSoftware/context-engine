import { useEffect, useRef, useState } from 'react';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy.js';
import { orderInterviewQuestionPool, buildInterviewQuestionPriority } from './sessionInterviewQuestionOrder';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { buildExternalInterviewKickoff, normalizeInterviewQuestions, type KickoffAgentKey } from './sessionInterview';
import { InterviewCatalogSignInError, readInterviewKickoffCatalog } from './sessionInterviewCatalogValidation';
import { getInterviewCatalogTicket, INTERVIEW_CATALOG_TICKET_RENEW_MS } from './interviewCatalogTicket';
import { buildInterviewReturnSessionUrl } from './sessionInterviewReturnUrl';
import type { ValidatedKickoff } from './SessionInterviewMemoryKickoffCard';

// Who has been asked to sign in for a private catalog link, so only Retry asks them again. It outlives the
// cards that use it, which come and go with their dialogs.
const askedForTicket = new Set<string>();

export type SessionPrefillKickoffInput = {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  questionPool?: unknown[];
  existingResponseSlice?: Record<string, unknown> | null;
  /** The session page the drafts come back to; this page's own when not given. */
  sessionUrl?: string;
  /** Names the session in the prompt. */
  sessionName?: string;
  /** The session gives a signed-in person an AI key, so a prompt without one says how they get it. */
  agentKeysOffered?: boolean;
  /** The person's AI key, which lets their AI submit as them. */
  agentKey?: KickoffAgentKey | null;
};

export type SessionPrefillKickoff = {
  /** The person this prompt is for, so another account gets its own check. */
  accountKey: string;
  kickoff: string;
  validateKickoff: (request: { retry: boolean }) => Promise<ValidatedKickoff>;
};

/**
 * The prompt that has someone's own AI draft their answers and hand back a link to review them. `ready` is
 * false while the session's Worker is looked up; `kickoff` is null when the session has none.
 */
export const useSessionPrefillKickoff = ({
  sessionSlug = '',
  sessionConfig,
  context,
  workerUrl,
  questionPool,
  existingResponseSlice,
  sessionUrl: givenSessionUrl,
  sessionName,
  agentKeysOffered,
  agentKey,
}: SessionPrefillKickoffInput): {
  ready: boolean;
  kickoff: SessionPrefillKickoff | null;
  /** The session's Worker, once found. */
  workerUrl: string;
} => {
  const [resolved, setResolved] = useState({ key: '', workerUrl: '' });
  const activeWorkerUrl = workerUrl || (resolved.key === sessionSlug ? resolved.workerUrl : '');
  // The pile rebuilds `context` on every render, so the lookup keys on its values
  // and reads the latest objects, rather than restarting each render.
  const lookupInputs = useRef({ sessionConfig, context });
  lookupInputs.current = { sessionConfig, context };
  const { account, providerLike, chainId } = (context || {}) as Record<string, unknown>;
  const hasSessionConfig = Boolean(sessionConfig);

  useEffect(() => {
    if (activeWorkerUrl) return undefined;
    let active = true;
    void getCorsProxyUrlOrThrow({ sessionSlug, ...lookupInputs.current, allowDemoFallback: false })
      .then((value: string) => {
        if (active) setResolved({ key: sessionSlug, workerUrl: value });
      })
      // Without a session Worker there is no prompt to offer.
      .catch(() => {
        if (active) setResolved({ key: sessionSlug, workerUrl: '' });
      });
    return () => {
      active = false;
    };
  }, [activeWorkerUrl, sessionSlug, hasSessionConfig, account, providerLike, chainId]);

  if (!activeWorkerUrl)
    return { ready: Boolean(workerUrl) || resolved.key === sessionSlug, kickoff: null, workerUrl: '' };
  const sessionUrl = givenSessionUrl || buildInterviewReturnSessionUrl();
  const { questionOrder } = normalizeInterviewSettings(sessionConfig?.interviewMode);
  const questions = questionPool
    ? normalizeInterviewQuestions(orderInterviewQuestionPool(questionPool, questionOrder))
    : [];
  const questionPriority = questionPool
    ? buildInterviewQuestionPriority(questions, existingResponseSlice, questionOrder)
    : undefined;
  // Once the session's catalog has been read, as this person may read it, the prompt carries its fingerprint
  // and its questions' ids in its own order. They come from the session, not from what this page happens to
  // have loaded, so the list is never empty for a session that has questions.
  const buildKickoff = (catalogTicket = '', catalog?: Record<string, unknown>) =>
    buildExternalInterviewKickoff({
      workerUrl: activeWorkerUrl,
      sessionSlug,
      sessionUrl,
      questionPriority,
      catalogTicket,
      catalog,
      sessionName,
      hasAccount: Boolean(account),
      agentKeysOffered,
      agentKey,
    });
  const accountKey = String(account || '').toLowerCase();
  // Someone signed in gets a ticket in their prompt only when the catalog without one leaves out questions they
  // may see, as on a private session. They're asked to sign in to the session once; declining still offers what
  // a signed-out visitor's AI may read.
  const validateKickoff = async ({ retry }: { retry: boolean }) => {
    const askKey = [activeWorkerUrl, sessionSlug, accountKey].join('\n');
    const prompt = retry || !askedForTicket.has(askKey);
    let ticketFailed = false;
    let renewAtMs = 0;
    const ticket = account
      ? async ({ fresh }: { fresh: boolean }) => {
          askedForTicket.add(askKey);
          try {
            const issued = await getInterviewCatalogTicket({
              workerUrl: activeWorkerUrl,
              sessionSlug,
              sessionConfig,
              context,
              prompt,
              fresh,
            });
            // A ticket cut short by the end of its sign-in is renewed as it runs out, by a new sign-in;
            // renewing sooner would only get the same short ticket again.
            const renewAt = issued.expiresAtMs - INTERVIEW_CATALOG_TICKET_RENEW_MS;
            renewAtMs = renewAt > Date.now() ? renewAt : issued.expiresAtMs;
            return issued.ticket;
          } catch {
            ticketFailed = true;
            return '';
          }
        }
      : undefined;
    try {
      const { ticket: catalogTicket, catalog } = await readInterviewKickoffCatalog({
        workerUrl: activeWorkerUrl,
        sessionSlug,
        sessionUrl,
        ticket,
        questionIds: questions.map((question) => question.id),
      });
      return { prompt: buildKickoff(catalogTicket, catalog), renewAtMs: catalogTicket ? renewAtMs : 0 };
    } catch (error) {
      if (error instanceof InterviewCatalogSignInError && ticketFailed) {
        throw new Error('This session’s questions need a sign-in. Press Retry to sign in, then copy the prompt.');
      }
      throw error;
    }
  };
  return { ready: true, kickoff: { accountKey, kickoff: buildKickoff(), validateKickoff }, workerUrl: activeWorkerUrl };
};
