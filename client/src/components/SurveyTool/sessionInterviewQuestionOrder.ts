import { normalizePublicInterviewQuestions } from '../../../../shared/interviewQuestionCatalog.mjs';
import type { InterviewQuestion } from './sessionInterview';
import { hasDraftValue, responseFieldValue, type SessionInterviewModalRecord } from './sessionInterviewModalState';

export type InterviewQuestionPriority = {
  unansweredQuestionIds: string[];
  answeredQuestionIds: string[];
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const createdAt = (question: unknown): number => {
  const item = record(question);
  const storageDate = record(item.storageRef).createdAt;
  if (typeof storageDate === 'string') {
    const date = Date.parse(storageDate);
    if (Number.isFinite(date) && date > 0) return date;
  }
  const milliseconds = Number(item.createdAtMs);
  if (Number.isFinite(milliseconds) && milliseconds > 0) return milliseconds;
  const value = item.createdAt ?? item.timeStamp;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 1e12 ? numeric * 1000 : numeric;
  const date = typeof value === 'string' ? Date.parse(value) : 0;
  return Number.isFinite(date) && date > 0 ? date : 0;
};

/** Keep eligibility and first-duplicate selection unchanged; dates never enter the hashed question shape. */
export const sortInterviewQuestionPoolNewestFirst = (pool: unknown[] = []): unknown[] => {
  const seen = new Set<string>();
  return pool
    .flatMap((question, index) => {
      const [normalized] = normalizePublicInterviewQuestions([question]);
      if (!normalized || seen.has(normalized.id)) return [];
      seen.add(normalized.id);
      return [{ question, index, date: createdAt(question) }];
    })
    .sort((a, b) => b.date - a.date || a.index - b.index)
    .map(({ question }) => question);
};

export const buildInterviewQuestionPriority = (
  questions: InterviewQuestion[],
  ownResponses?: SessionInterviewModalRecord | null,
): InterviewQuestionPriority => {
  const priority: InterviewQuestionPriority = { unansweredQuestionIds: [], answeredQuestionIds: [] };
  for (const question of questions) {
    const answered = hasDraftValue(responseFieldValue(ownResponses, 'answers', question.id));
    priority[answered ? 'answeredQuestionIds' : 'unansweredQuestionIds'].push(question.id);
  }
  return priority;
};
