import { useEffect, useRef } from 'react';
import {
  fidelityPairsFromReview,
  summarizeParticipantFidelity,
  type ParticipantFidelitySummary,
} from '../../../../shared/agentFidelity.mjs';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { describeInterviewAnswer, describeInterviewGuess } from './sessionInterviewHiddenDrafts';
import { resolveInterviewDraftOrigin } from './sessionInterviewResearch';
import type { InterviewDraftResponse, InterviewPrefillPacket, InterviewQuestion } from './sessionInterview';
import styles from './SessionInterviewFidelityScore.module.scss';

/**
 * The person's own score from the AI prefill drafts they submitted, or null without any.
 * Voice drafts restate what the person just said, so they aren't scored.
 */
export const summarizeOwnInterviewFidelity = ({
  drafts,
  editedDrafts,
  selected,
  questions,
  packet,
}: {
  drafts: InterviewDraftResponse[];
  editedDrafts: Record<string, InterviewDraftResponse>;
  selected: Record<string, boolean>;
  questions: InterviewQuestion[];
  packet: InterviewPrefillPacket | null;
}): ParticipantFidelitySummary | null => {
  const reviewed = drafts
    .filter(
      (draft) =>
        selected[draft.questionId] &&
        resolveInterviewDraftOrigin(draft, packet, packet?.source || null) === 'external_prefill',
    )
    .map((draft) => {
      const first = draft.revisions?.[0] || draft;
      const edited = editedDrafts[draft.questionId] || draft;
      // A hidden draft is scored on the answer given before its guess was shown.
      const blind = edited.predictionCondition === 'blind';
      return {
        questionId: draft.questionId,
        predicted: first.answer,
        answered: blind ? edited.blindAnswer : edited.answer,
        confidence: first.confidence,
        condition: blind ? ('blind' as const) : ('shown' as const),
      };
    });
  if (!reviewed.length) return null;
  return summarizeParticipantFidelity({ questions, pairs: fidelityPairsFromReview({ questions, reviewed }) });
};

const percent = (value: number) => Math.round(value * 100);

// "2 of 3 answers matched", over a bar filled to match.
function Stat({ matched, total, label }: { matched: number; total: number; label: string }) {
  return (
    <div className={styles.stat}>
      <strong>
        {matched} of {total}
      </strong>{' '}
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${(matched / total) * 100}%` }} />
      </span>
    </div>
  );
}

type Props = { summary: ParticipantFidelitySummary; questions: InterviewQuestion[] };

/** After submitting: how well the person's AI predicted them. Private to this browser. */
export default function SessionInterviewFidelityScore({ summary, questions }: Props) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  // The drafts and the disabled Submit button leave focus nowhere; land it on the score.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const questionFor = (questionId: string) =>
    questions.find((question) => question.id.toLowerCase() === questionId.toLowerCase());
  const score = percent(summary.mirrorScore);
  return (
    <section
      className={styles.score}
      aria-labelledby="ce-interview-fidelity-title"
      data-testid={E2E_TESTIDS.SESSION_INTERVIEW_FIDELITY_SCORE}
    >
      <div className={styles.header}>
        <div className={styles.intro}>
          <h4 id="ce-interview-fidelity-title" className={styles.title} ref={titleRef} tabIndex={-1}>
            How well your AI knew you
          </h4>
          <p>
            How close its drafts came to your answers
            {summary.predictions > summary.choicePredictions
              ? ', with partial credit for close ratings and allocations.'
              : '.'}
          </p>
        </div>
        <div className={styles.mirror}>
          <div className={styles.ring}>
            <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
              <circle className={styles.ringTrack} cx="18" cy="18" r="15.5" />
              {score ? (
                <circle
                  className={styles.ringValue}
                  cx="18"
                  cy="18"
                  r="15.5"
                  pathLength={100}
                  strokeDasharray={`${score} 100`}
                />
              ) : null}
            </svg>
            <strong>{score}%</strong>
          </div>{' '}
          <span>Mirror Score</span>
        </div>
      </div>
      {summary.choicePredictions || summary.hiddenPredictions ? (
        <div className={styles.stats}>
          {summary.choicePredictions ? (
            <Stat matched={summary.choiceMatches} total={summary.choicePredictions} label="answers matched" />
          ) : null}
          {summary.hiddenPredictions ? (
            <Stat matched={summary.hiddenMatches} total={summary.hiddenPredictions} label="hidden guesses matched" />
          ) : null}
        </div>
      ) : null}
      {summary.confidentMisses.length ? (
        <div className={styles.misses}>
          <p className={styles.kicker}>Its most confident misses</p>
          <ul>
            {summary.confidentMisses.map((miss) => {
              const question = questionFor(miss.questionId);
              const guess = { questionId: miss.questionId, answer: miss.prediction, confidence: miss.confidence };
              return (
                <li key={miss.questionId}>
                  <span className={styles.prompt}>{question?.prompt || miss.questionId}</span>{' '}
                  <span className={styles.guess}>{describeInterviewGuess(guess, question)}</span>{' '}
                  <span className={styles.answer}>You: {describeInterviewAnswer(miss.actual, question)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
