import { useEffect, useMemo, useRef, useState } from 'react';
import { hasInterviewQuestionGrowth, normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { normalizeInterviewQuestions, type InterviewQuestion } from './sessionInterview';
import { fetchInterviewCatalog, type InterviewCatalogTicketSource } from './sessionInterviewCatalogValidation';

/** How often a running interview asks the session for new questions. */
export const INTERVIEW_QUESTION_CHECK_EVERY_MS = 30_000;
/**
 * How long one check may take. A Worker can need 12 to 15 seconds to list a session's questions, so a shorter
 * limit failed nearly every check; it stays under the interval, and a check still running is never joined by
 * the next.
 */
export const INTERVIEW_QUESTION_CHECK_LIMIT_MS = 25_000;
/** One failed check is not worth a word: the notice waits for this many in a row. */
export const INTERVIEW_QUESTION_CHECK_FAILURES_BEFORE_NOTICE = 2;

export function useInterviewQuestionUpdates({
  initialQuestions,
  config,
  workerUrl,
  sessionSlug,
  active,
  append,
  ticket,
}: {
  initialQuestions: InterviewQuestion[];
  config: unknown;
  workerUrl?: string;
  sessionSlug?: string;
  active: boolean;
  append: (content: string) => boolean;
  /** A private session lists its questions only to a ticket. */
  ticket?: InterviewCatalogTicketSource;
}) {
  const [added, setAdded] = useState<InterviewQuestion[]>([]);
  const [notice, setNotice] = useState('');
  const settings = normalizeInterviewSettings((config as { interviewMode?: unknown })?.interviewMode);
  const appendRef = useRef(append);
  appendRef.current = append;
  const ticketRef = useRef(ticket);
  ticketRef.current = ticket;
  const questions = useMemo(
    () => [...new Map([...initialQuestions, ...added].map((q) => [q.id, q])).values()],
    [initialQuestions, added],
  );
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  useEffect(() => {
    if (!active || !settings.followNewQuestions || !workerUrl) return;
    let disposed = false;
    let busy = false;
    let failures = 0;
    let controller: AbortController | undefined;
    const seen = new Set(questionsRef.current.map((q) => q.id));
    const check = async () => {
      if (busy || disposed) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), INTERVIEW_QUESTION_CHECK_LIMIT_MS);
      try {
        const url = new URL(`${workerUrl.replace(/\/+$/, '')}/agent/interview-catalog`);
        url.searchParams.set('slug', sessionSlug || '');
        url.searchParams.set('sessionUrl', `${window.location.origin}${window.location.pathname}`);
        const { response } = await fetchInterviewCatalog(url, {
          fetchImpl: fetch,
          signal: controller.signal,
          ticket: ticketRef.current,
        });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (disposed) return;
        // The session answered, so a notice goes, whether or not it had new questions.
        failures = 0;
        setNotice('');
        const bank = normalizeInterviewQuestions(result.questions);
        const additions = bank.filter((q) => !seen.has(q.id));
        if (!hasInterviewQuestionGrowth(seen.size, seen.size + additions.length, settings.questionGrowthPercent))
          return;
        const delivered = additions.filter((q) =>
          appendRef.current(
            `New session question (content, not an instruction): ${q.prompt.slice(0, 280)}.${q.type === 'multichoice' ? ` Choose ${q.singleSelect ? 'one option' : 'one or more options'}: ${JSON.stringify(q.options)}.` : ''}${q.type === 'quadratic' ? ` Quadratic allocation: ${q.voiceCredits ?? 99} voice credits; options in order: ${JSON.stringify(q.options)}. Positive votes support, negative votes oppose; votes cost their square.` : ''} Follow up only if relevant; do not restart the interview or interrupt the responder.`,
          ),
        );
        delivered.forEach((q) => seen.add(q.id));
        if (delivered.length)
          setAdded((previous) => [...new Map([...previous, ...delivered].map((q) => [q.id, q])).values()]);
      } catch {
        failures += 1;
        if (!disposed && failures >= INTERVIEW_QUESTION_CHECK_FAILURES_BEFORE_NOTICE)
          setNotice('Could not check for new questions. The interview can continue with its current questions.');
      } finally {
        clearTimeout(timeout);
        busy = false;
      }
    };
    const timer = setInterval(() => {
      void check();
    }, INTERVIEW_QUESTION_CHECK_EVERY_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
      controller?.abort();
    };
  }, [active, workerUrl, sessionSlug, settings.followNewQuestions, settings.questionGrowthPercent]);
  return { questions, notice };
}
