import React from 'react';

import type { DebateSplit, DebateSplitSide } from './debateMapTypes';
import styles from './DebateMap.module.scss';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function Side({ side }: { side: DebateSplitSide }) {
  return (
    <div className={styles.splitSide}>
      <h4 className={styles.generatedSummaryPositionHeader}>{side.label}</h4>
      <ul className={styles.generatedSummaryPositions}>
        {side.positions.map((position, index) => {
          const count = Number(position.participantCount) || 0;
          const total = Number(position.participantTotal) || 0;
          return (
            <li key={String(position.id || index)} className={styles.generatedSummaryPosition}>
              <div className={styles.generatedSummaryPositionHeader}>
                <strong>{String(position.label)}</strong>
                <span className={styles.generatedSummaryCount}>
                  {total > 0 ? `${count} of ${plural(total, 'participant')}` : plural(count, 'participant')}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Where people split on a node: the positions at each end of its compass's first axis, side by side, under the
// axis's own end labels. Each position's reasoning is in the Positions list just above, so it is not repeated. They are not headed "For" and "Against": the ends are the main disagreement the AI
// found, which need not be for and against the node's title.
export default function DebateMapSplit({ split }: { split: DebateSplit }) {
  return (
    <section className={styles.generatedSummarySection} aria-label="Where people split">
      <div className={styles.generatedSummaryHeading}>Where people split</div>
      {split.axis && <p className={styles.splitAxis}>{split.axis}</p>}
      <div className={styles.splitColumns}>
        <Side side={split.left} />
        <Side side={split.right} />
      </div>
    </section>
  );
}
