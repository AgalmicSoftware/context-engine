/** @file QuestionAnalysisNote.tsx: the AI's saved reading of a question's answers, where its topic lists it alone. */
import React, { useId } from 'react';

import styles from './QuestionAnalysisNote.module.scss';

import type { DebateQuestionAnalysis } from './debateMapTypes';

/**
 * Above the card of a topic's only question, which has no circle of its own: the summary and, in short, each
 * category with how many of those who answered fall in it. Nothing for a question the build did not analyse, as in
 * every older build. A region named by its label, as the topic's own summary is, so it can be found the same way.
 */
export const QuestionAnalysisNote = ({ analysis }: { analysis?: DebateQuestionAnalysis }) => {
  const labelId = useId();
  if (!analysis?.summary) return null;
  const { summary, categories } = analysis;
  const total = Number(analysis.answered) || 0;
  const answers = total === 1 ? ' of 1 participant’s answer' : ` of ${total} participants’ answers`;
  return (
    <section className={styles.note} aria-labelledby={labelId} data-testid="ce-atlas-question-analysis">
      <div className={styles.eyebrow} id={labelId}>
        AI summary{total > 0 ? answers : ''}
      </div>
      <p>{summary}</p>
      {Array.isArray(categories) && categories.length > 0 && (
        <ul>
          {categories.map((category, index) => (
            <li key={`${index}-${category.label}`}>
              <span>{category.label}</span>
              <span className={styles.count}>
                {Number(category.participantCount) || 0}
                {total > 0 ? ` of ${total}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default QuestionAnalysisNote;
