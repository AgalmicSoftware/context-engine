import type { ComparePoint, CompareSummary } from '../../utilities/ai/aiCompareContracts';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { ParticipantDot, joinNames, participantIndex, participantName } from './CompareParticipantDot';
import styles from './CompareResult.module.scss';

/** Without the AI's sentence, a plain count from answers the page holds; never a made-up line. */
export const compareCountLine = (people: number, sharedQuestions: number) =>
  sharedQuestions > 0 ? `${people} people, ${sharedQuestions} shared question${sharedQuestions === 1 ? '' : 's'}` : '';

function PointCard({ point, nameOf }: { point: ComparePoint; nameOf: (index: number) => string }) {
  return (
    <li className={styles.card}>
      {point.title && <h4 className={styles.cardTitle}>{point.title}</h4>}
      {point.sides ? (
        <ul className={styles.sides}>
          {point.sides.map((side) => {
            const people = side.who.map(participantIndex);
            return (
              <li key={side.who.join('')} className={styles.side}>
                <span className={styles.chips}>
                  {people.map((index) => (
                    <ParticipantDot key={index} index={index} title={nameOf(index)} />
                  ))}
                </span>
                <span>
                  <span className={styles.srOnly}>{joinNames(people.map(nameOf))}: </span>
                  {side.view}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.cardText}>{point.text}</p>
      )}
    </li>
  );
}

function PointList({
  points,
  empty,
  nameOf,
}: {
  points: ComparePoint[];
  empty: string;
  nameOf: (i: number) => string;
}) {
  return points.length ? (
    <ul className={styles.cards}>
      {points.map((point, index) => (
        <PointCard key={index} point={point} nameOf={nameOf} />
      ))}
    </ul>
  ) : (
    <p>{empty}</p>
  );
}

type Props = {
  summary: CompareSummary | null;
  labels: string[];
  people: number;
  sharedQuestions: number;
};

/** The headline, then similarities and differences as small titled cards. */
export default function CompareSummaryCards({ summary, labels, people, sharedQuestions }: Props) {
  const nameOf = (index: number) => participantName(labels, index);
  const counts = summary?.headline ? '' : compareCountLine(people, sharedQuestions);
  return (
    <>
      {summary?.headline ? (
        <p className={styles.headline}>{summary.headline}</p>
      ) : (
        counts && <p className={styles.counts}>{counts}</p>
      )}
      <div className={styles.columns}>
        <section data-testid={E2E_TESTIDS.COMPARE_AGREEMENTS}>
          <h3>Similarities</h3>
          <PointList
            points={summary?.agreements || []}
            empty="No clear similarities in the visible answers."
            nameOf={nameOf}
          />
        </section>
        <section data-testid={E2E_TESTIDS.COMPARE_DISAGREEMENTS}>
          <h3>Key differences</h3>
          <PointList
            points={summary?.disagreements || []}
            empty="No clear differences in the visible answers."
            nameOf={nameOf}
          />
        </section>
      </div>
    </>
  );
}
