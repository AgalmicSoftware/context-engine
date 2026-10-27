import { useEffect, useRef } from 'react';
import {
  fidelityPairsFromReview,
  summarizeParticipantFidelity,
  type ParticipantFidelitySummary,
} from '../../../../shared/agentFidelity.mjs';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
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

const percent = (value: number) => `${Math.round(value * 100)}%`;

// "agree with", "pick Parks, Transit for": what the AI expected the person to do.
const expectedChoice = (prediction: unknown) => {
  if (prediction === 'Agree') return 'agree with';
  if (prediction === 'Disagree') return 'disagree with';
  if (prediction === 'Unsure') return 'be unsure about';
  return `pick ${Array.isArray(prediction) ? prediction.join(', ') : String(prediction)} for`;
};

type Props = { summary: ParticipantFidelitySummary; questions: InterviewQuestion[] };

/** After submitting: how well the person's AI predicted them. Private to this browser. */
export default function SessionInterviewFidelityScore({ summary, questions }: Props) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  // The drafts and the disabled Submit button leave focus nowhere; land it on the score.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const promptFor = (questionId: string) =>
    questions.find((question) => question.id.toLowerCase() === questionId.toLowerCase())?.prompt || questionId;
  return (
    <section
      className={styles.score}
      aria-labelledby="ce-interview-fidelity-title"
      data-testid={E2E_TESTIDS.SESSION_INTERVIEW_FIDELITY_SCORE}
    >
      <h4 id="ce-interview-fidelity-title" className={styles.title} ref={titleRef} tabIndex={-1}>
        How well your AI knew you
      </h4>
      <p>
        {summary.choicePredictions
          ? `Your AI matched ${summary.choiceMatches} of ${summary.choicePredictions} of your answers. `
          : ''}
        Mirror Score {percent(summary.mirrorScore)}
        {summary.predictions > summary.choicePredictions ? ', which also credits close ratings and allocations.' : '.'}
      </p>
      {summary.hiddenPredictions ? (
        <p>
          It guessed {summary.hiddenMatches} of the {summary.hiddenPredictions} it couldn’t show you.
        </p>
      ) : null}
      {summary.confidentMisses.length ? (
        <ul className={styles.misses}>
          {summary.confidentMisses.map((miss) => (
            <li key={miss.questionId}>
              It was {percent(miss.confidence)} sure you’d {expectedChoice(miss.prediction)}:{' '}
              {promptFor(miss.questionId)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.privacy}>Only you can see this. It’s worked out in this browser and isn’t saved or sent.</p>
    </section>
  );
}
