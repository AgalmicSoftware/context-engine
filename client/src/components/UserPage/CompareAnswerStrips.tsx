import { useId, useMemo, useState } from 'react';
import {
  BINARY_STANCES,
  binaryAnswerLabel,
  groupAnswersByQuestion,
  normalizeQuestionType,
  unwrapAnswer,
  type BinaryStance,
  type ComparisonUser,
} from './compareAnswers';
import { ParticipantDot, joinNames, participantName } from './CompareParticipantDot';
import styles from './CompareResult.module.scss';

export type AnswerStrip = {
  id: string;
  prompt: string;
  stances: Array<{ index: number; stance: BinaryStance }>;
  split: boolean;
  /** "split", "agree" or "all unsure", with how many answered where not everyone did. */
  tag: string;
};

const SHOWN_AT_FIRST = 8;

/**
 * One strip per yes/no statement, read from the same answers "Explore answers" shows. Ratings are
 * left out: their scales are not agree or disagree, and cutting them into three would invent stances.
 */
export const buildAnswerStrips = (users: ComparisonUser[]): AnswerStrip[] => {
  const strips = groupAnswersByQuestion(users).flatMap(([id, { question, answers }]): AnswerStrip[] => {
    if (normalizeQuestionType(question.type) !== 'binary') return [];
    // A person with no readable answer has no dot, and a lone answer has nothing to agree or split with.
    const stances = users.flatMap((_, index) => {
      const stance = binaryAnswerLabel(unwrapAnswer(answers.get(index)?.answer)) as BinaryStance;
      return BINARY_STANCES.includes(stance) ? [{ index, stance }] : [];
    });
    if (stances.length < 2) return [];
    const split = new Set(stances.map(({ stance }) => stance)).size > 1;
    // Everyone unsure is not agreement on the statement; and where only some answered, the tag says how many.
    const shared = stances[0].stance === 'Unsure' ? 'all unsure' : 'agree';
    const some = stances.length < users.length ? `, ${stances.length} of ${users.length} answered` : '';
    return [{ id, prompt: question.prompt || 'Question', stances, split, tag: `${split ? 'split' : shared}${some}` }];
  });
  // Splits first; the sort is stable, so each group keeps the questions' own order.
  return strips.sort((a, b) => Number(b.split) - Number(a.split));
};

type Props = { users: ComparisonUser[]; labels: string[]; viewerCompared?: boolean };

/** Where the people compared agree and split, statement by statement, with no AI involved. */
export default function CompareAnswerStrips({ users, labels, viewerCompared = false }: Props) {
  const headingId = useId();
  const strips = useMemo(() => buildAnswerStrips(users), [users]);
  const [showAll, setShowAll] = useState(false);
  if (!strips.length) return null;
  const who = viewerCompared ? 'you' : 'they';
  const nameOf = (index: number) => participantName(labels, index);
  return (
    <section className={styles.block} aria-labelledby={headingId}>
      <h3 id={headingId}>
        Where {who} agree, where {who} split
      </h3>
      <ul className={styles.strips}>
        {(showAll ? strips : strips.slice(0, SHOWN_AT_FIRST)).map((strip) => (
          <li key={strip.id} className={styles.strip} data-split={strip.split}>
            <div className={styles.stripHead}>
              <span className={styles.stripPrompt}>{strip.prompt}</span>
              <span className={styles.stripTag}>{strip.tag}</span>
            </div>
            <div className={styles.stops} aria-hidden="true">
              {BINARY_STANCES.map((stance) => (
                <div key={stance} className={styles.stop}>
                  <span className={styles.stopName}>{stance}</span>
                  <span className={styles.stopDots}>
                    {strip.stances
                      .filter((entry) => entry.stance === stance)
                      .map(({ index }) => (
                        <ParticipantDot key={index} index={index} title={nameOf(index)} />
                      ))}
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.srOnly}>
              {BINARY_STANCES.flatMap((stance) => {
                const people = strip.stances
                  .filter((entry) => entry.stance === stance)
                  .map(({ index }) => nameOf(index));
                return people.length ? [`${stance}: ${joinNames(people)}.`] : [];
              }).join(' ')}
            </p>
          </li>
        ))}
      </ul>
      {strips.length > SHOWN_AT_FIRST && (
        <button type="button" className={styles.showAll} aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${strips.length}`}
        </button>
      )}
    </section>
  );
}
