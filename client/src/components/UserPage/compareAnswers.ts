// How the compare result reads each person's visible answers, shared by "Explore answers" and the
// agree/split strips so the strips can only ever show answers the details also show.

export type CompareQuestion = {
  id?: string;
  questionID?: string;
  questionId?: string;
  qId?: string;
  prompt?: string;
  type?: string;
  answer?: unknown;
  options?: unknown;
  scale?: unknown;
  ratingScale?: unknown;
  voiceCredits?: unknown;
  additionalComment?: string;
};
export type ComparisonUser = { address?: string; questions?: CompareQuestion[] };
export type QuestionAnswers = { question: CompareQuestion; answers: Map<number, CompareQuestion> };

export const normalizeQuestionType = (type = '') =>
  ({
    text: 'freeform',
    open: 'freeform',
    'open-ended': 'freeform',
    scale: 'rating',
    likert: 'rating',
    multi: 'multichoice',
    multiple: 'multichoice',
    'multi-choice': 'multichoice',
    multi_choice: 'multichoice',
    multi_select: 'multichoice',
    'multi-select': 'multichoice',
  })[type.toLowerCase()] || type.toLowerCase();

export const unwrapAnswer = (answer: unknown): unknown =>
  answer && typeof answer === 'object' && !Array.isArray(answer) && 'value' in answer ? answer.value : answer;
export const isMissingAnswer = (answer: unknown) => answer == null || answer === '*' || answer === '';
export const answerText = (answer: unknown) =>
  ['string', 'number', 'boolean'].includes(typeof answer) ? String(answer) : '';

export type BinaryStance = 'Agree' | 'Disagree' | 'Unsure';
export const BINARY_STANCES: BinaryStance[] = ['Disagree', 'Unsure', 'Agree'];
/** A yes/no answer as one of the three stances, or its own text when it is none of them. */
export const binaryAnswerLabel = (answer: unknown): string => {
  const value = answerText(answer).toLowerCase();
  if (['1', 'agree', 'yes', 'true', 'strongly agree'].includes(value)) return 'Agree';
  if (['-1', 'disagree', 'no', 'false', 'strongly disagree'].includes(value)) return 'Disagree';
  if (['0', 'neutral', 'unsure'].includes(value)) return 'Unsure';
  return answerText(answer) || 'No visible answer';
};

/** Every question anyone answered, in first-seen order, with each person's answer by their index. */
export const groupAnswersByQuestion = (users: ComparisonUser[]): Array<[string, QuestionAnswers]> => {
  const map = new Map<string, QuestionAnswers>();
  users.forEach((user, index) =>
    user.questions?.forEach((question) => {
      const id = String(question.id || question.questionID || question.questionId || question.qId || '').toLowerCase();
      if (!id) return;
      const entry = map.get(id) || { question, answers: new Map<number, CompareQuestion>() };
      entry.answers.set(index, question);
      map.set(id, entry);
    }),
  );
  return [...map.entries()];
};
