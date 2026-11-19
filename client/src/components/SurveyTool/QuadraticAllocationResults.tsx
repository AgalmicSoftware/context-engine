import styles from './QuadraticAllocationInput.module.scss';
import { summarizeQuadraticAllocations } from '../../../../shared/questions/quadraticAllocation.mjs';

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

// Each option's votes as two bars around a zero line, oppose to the left and support to the right, with the
// net at the end: the same reading as the report's quadratic section.
export default function QuadraticAllocationResults({
  responses,
  question,
}: {
  responses: unknown[];
  question: { options?: unknown; voiceCredits?: unknown };
}) {
  const summary = summarizeQuadraticAllocations(responses, question);
  const largest = Math.max(1, ...summary.options.flatMap((option) => [option.positive, -option.negative]));
  const share = (votes: number) => `${(Math.abs(votes) / largest) * 100}%`;
  // Most supported first; options with the same net keep the question's own order.
  const ranked = [...summary.options].sort((a, b) => b.net - a.net);
  const tone = (value: number) => (value > 0 ? styles.positiveVotes : value < 0 ? styles.negativeVotes : undefined);
  return (
    <div className={styles.results} data-testid="ce-quadratic-results">
      {summary.excludedResponses > 0 && <p>{summary.excludedResponses} encrypted or invalid responses excluded.</p>}
      <div className={styles.resultsLegend} aria-hidden="true">
        <span className={styles.negativeVotes}>− Oppose</span>
        <span className={styles.positiveVotes}>+ Support</span>
        <span>Net</span>
      </div>
      <ul aria-label="Quadratic allocation results">
        {ranked.map((option, index) => (
          <li key={index}>
            {/* Read out as one sentence; the name, bars and numbers beside it are for the eye. */}
            <span className={styles.resultsSpoken}>
              {`${option.label}: support ${option.positive}, oppose ${Math.abs(option.negative)}, net ${signed(option.net)}`}
            </span>
            <span className={styles.resultsOption} aria-hidden="true">
              {option.label}
            </span>
            <div className={styles.resultsBars} aria-hidden="true">
              <div className={styles.resultsOppose}>
                <span className={styles.negativeVotes}>{signed(option.negative)}</span>
                <i style={{ width: share(option.negative) }} />
              </div>
              <div className={styles.resultsSupport}>
                <i style={{ width: share(option.positive) }} />
                <span className={styles.positiveVotes}>{signed(option.positive)}</span>
              </div>
            </div>
            <strong className={`${styles.resultsNet} ${tone(option.net) || ''}`} aria-hidden="true">
              {signed(option.net)}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
