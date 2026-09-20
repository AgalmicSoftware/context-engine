import React from 'react';
import { getVoiceCredits, validateQuadraticAllocation } from '../../../../shared/questions/quadraticAllocation.mjs';
import styles from './QuadraticAllocationResponse.module.scss';

export default function QuadraticAllocationResponse({
  value,
  question,
}: {
  value: unknown;
  question: { options?: unknown; voiceCredits?: unknown };
}) {
  const options =
    Array.isArray(question.options) && question.options.length
      ? question.options
      : Array.isArray(value)
        ? value.map((_, index) => `Option ${index + 1}`)
        : [];
  if (validateQuadraticAllocation(value, { ...question, options })) {
    return <p className={styles.summary}>Allocation unavailable.</p>;
  }
  const votes = value as number[];
  const maxVotes = Math.floor(Math.sqrt(getVoiceCredits(question)));
  return (
    <div className={styles.response} data-testid="ce-quadratic-response">
      <dl className={styles.options} aria-label="Quadratic allocation">
        {votes.map((vote, index) => (
          <div className={styles.option} key={index}>
            <dt>{options[index]}</dt>
            <dd>
              <span className={`${styles.vote} ${vote > 0 ? styles.positive : vote < 0 ? styles.negative : ''}`}>
                {vote > 0 ? `+${vote}` : vote < 0 ? `−${Math.abs(vote)}` : '0'}
              </span>
              <div className={styles.track} aria-hidden="true">
                <span
                  className={`${styles.bar} ${vote > 0 ? styles.positive : styles.negative}`}
                  style={{
                    left: `${vote < 0 ? 50 - (Math.abs(vote) / maxVotes) * 50 : 50}%`,
                    width: `${(Math.abs(vote) / maxVotes) * 50}%`,
                  }}
                />
              </div>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
