/** @file QuestionAnalysisNote.tsx: the AI's saved reading of a question's answers, where its topic lists it alone. */
import React from 'react';

import DebateMapGeneratedSummary from './DebateMapGeneratedSummary';
import { analysisComments } from './analysisComments';
import type { DebateQuestionAnalysis } from './debateMapTypes';

/**
 * Above the card of a topic's only question, which has no circle of its own: the summary and, in short, each
 * category with how many of those who answered fall in it. Nothing for a question the build did not analyse, as in
 * every older build. A region named by its label, as the topic's own summary is, so it can be found the same way.
 */
export const QuestionAnalysisNote = ({ analysis }: { analysis?: DebateQuestionAnalysis }) => {
  if (!analysis || !String(analysis.summary || '').trim()) return null;
  const total = Number(analysis.answered) || 0;
  const answers = total === 1 ? ' of 1 participant’s answer' : ` of ${total} participants’ answers`;
  return (
    <div data-testid="ce-atlas-question-analysis">
      <DebateMapGeneratedSummary
        entries={analysisComments('lone-question', analysis)}
        label={`AI summary${total > 0 ? answers : ''}`}
      />
    </div>
  );
};

export default QuestionAnalysisNote;
