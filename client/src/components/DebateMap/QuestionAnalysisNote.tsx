/** @file QuestionAnalysisNote.tsx: the AI's saved reading of a question's answers, on the question's atlas card. */
import React from 'react';

import styles from './QuestionAnalysisNote.module.scss';

import type { DebateQuestionAnalysis } from './debateMapTypes';

/**
 * Under a question's preview, where its topic lists it: the summary and, in short, each category with how many
 * of those who answered fall in it. Nothing for a question the build did not analyse, as in every older build.
 * `id` lets the card's link name it as its description, since the link's own name is the question.
 */
export const QuestionAnalysisNote = ({ analysis, id }: { analysis?: DebateQuestionAnalysis; id?: string }) => {
  if (!analysis?.summary) return null;
  const { summary, categories } = analysis;
  const total = Number(analysis.answered) || 0;
  const answers = total === 1 ? ' of 1 participant\u2019s answer' : ` of ${total} participants\u2019 answers`;
  return (
    <div className={styles.note} id={id} data-testid="ce-atlas-question-analysis">
      <div className={styles.eyebrow}>AI summary{total > 0 ? answers : ''}</div>
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
    </div>
  );
};

export default QuestionAnalysisNote;
