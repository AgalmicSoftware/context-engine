import React from 'react';
import styles from './QuadraticAllocationInput.module.scss';
import { summarizeQuadraticAllocations } from '../../../../shared/questions/quadraticAllocation.mjs';

export default function QuadraticAllocationResults({
  responses,
  question,
}: {
  responses: unknown[];
  question: { options?: unknown; voiceCredits?: unknown };
}) {
  const summary = summarizeQuadraticAllocations(responses, question);
  const voteClass = (value: number) =>
    value > 0 ? styles.positiveVotes : value < 0 ? styles.negativeVotes : undefined;
  return (
    <div className={styles.results} data-testid="ce-quadratic-results">
      {summary.excludedResponses > 0 && <p>{summary.excludedResponses} encrypted or invalid responses excluded.</p>}
      <table aria-label="Quadratic allocation results">
        <thead>
          <tr>
            <th scope="col">Option</th>
            <th scope="col" className={styles.positiveVotes}>
              Positive
            </th>
            <th scope="col" className={styles.negativeVotes}>
              Negative
            </th>
            <th scope="col">Net</th>
          </tr>
        </thead>
        <tbody>
          {summary.options.map((option, index) => (
            <tr key={index}>
              <th scope="row">{option.label}</th>
              <td className={voteClass(option.positive)}>{option.positive}</td>
              <td className={voteClass(option.negative)}>{option.negative}</td>
              <td className={voteClass(option.net)}>{option.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
