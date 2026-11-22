import type { DebateComment, DebateQuestionAnalysis } from './debateMapTypes';

// A question's saved analysis as the entries its generated-summary view draws: the summary first, then each
// category with how many of those who answered fall in it.
export const analysisComments = (id: string, analysis: DebateQuestionAnalysis): DebateComment[] => [
  { id: `${id}:analysis`, comment: analysis.summary },
  ...(Array.isArray(analysis.categories) ? analysis.categories : []).map((category, index) => ({
    id: `${id}:category:${index}`,
    kind: 'category',
    comment: category.summary,
    label: category.label,
    participantCount: category.participantCount,
    ...(analysis.answered ? { participantTotal: analysis.answered } : {}),
  })),
];
