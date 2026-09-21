import { useEffect, useMemo, useRef, useState } from 'react';
import { hasInterviewQuestionGrowth, normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { normalizeInterviewQuestions, type InterviewQuestion } from './sessionInterview';

export function useInterviewQuestionUpdates({
  initialQuestions,
  config,
  workerUrl,
  sessionSlug,
  active,
  append,
}: {
  initialQuestions: InterviewQuestion[];
  config: unknown;
  workerUrl?: string;
  sessionSlug?: string;
  active: boolean;
  append: (content: string) => boolean;
}) {
  const [added, setAdded] = useState<InterviewQuestion[]>([]);
  const [notice, setNotice] = useState('');
  const settings = normalizeInterviewSettings((config as { interviewMode?: unknown })?.interviewMode);
  const appendRef = useRef(append);
  appendRef.current = append;
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
    let controller: AbortController | undefined;
    const seen = new Set(questionsRef.current.map((q) => q.id));
    const check = async () => {
      if (busy || disposed) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const sessionUrl = `${window.location.origin}${window.location.pathname}`;
        const response = await fetch(
          `${workerUrl.replace(/\/+$/, '')}/agent/interview-catalog?slug=${encodeURIComponent(sessionSlug || '')}&sessionUrl=${encodeURIComponent(sessionUrl)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (disposed) return;
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
        setNotice('');
      } catch {
        if (!disposed)
          setNotice('Could not check for new questions. The interview can continue with its current questions.');
      } finally {
        clearTimeout(timeout);
        busy = false;
      }
    };
    const timer = setInterval(() => {
      void check();
    }, 30000);
    return () => {
      disposed = true;
      clearInterval(timer);
      controller?.abort();
    };
  }, [active, workerUrl, sessionSlug, settings.followNewQuestions, settings.questionGrowthPercent]);
  return { questions, notice };
}
