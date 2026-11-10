import { workerCanonicalAuthoringPort } from '../../../domains/surveys/workerCanonicalAuthoringPort';
import { generateQuestionId } from '../../../utilities/shared/questionUtils.mjs';
import { text, type SetupQuestion } from './setupSectionTypes';

// Standalone questions belong to no survey, as the question editor marks them.
const NO_SURVEY = `0x${'0'.repeat(64)}`;
const DEFAULT_VOICE_CREDITS = 99;

/** A template's question as the question editor publishes it, with its derived ID. */
export const buildSetupQuestionRecord = (
  question: SetupQuestion,
  { creator, sessionName, sessionSlug }: { creator: string; sessionName: string; sessionSlug: string },
): Record<string, unknown> => {
  const type = question.type;
  const prompt = text(question.prompt).trim();
  const options =
    type === 'multichoice' || type === 'quadratic'
      ? (question.options || []).map((option) => text(option).trim()).filter(Boolean)
      : undefined;
  const singleSelect = type === 'multichoice' ? !!question.singleSelect : undefined;
  const voiceCredits = type === 'quadratic' ? (question.voiceCredits ?? DEFAULT_VOICE_CREDITS) : undefined;
  return {
    id: generateQuestionId(type, prompt, options || [], !!singleSelect, voiceCredits ?? DEFAULT_VOICE_CREDITS),
    type,
    prompt,
    ...(options ? { options } : {}),
    ...(singleSelect === undefined ? {} : { singleSelect }),
    ...(voiceCredits === undefined ? {} : { voiceCredits }),
    ...(type === 'rating' && question.scale ? { scale: { ...question.scale } } : {}),
    tags: (question.tags || []).map((tag) => text(tag).trim()).filter(Boolean),
    creator,
    associatedSurveyId: NO_SURVEY,
    sessionName,
    sessionSlug,
  };
};

type PublishSetupQuestionsInput = {
  questions: SetupQuestion[];
  /** The created session's public config (Worker-canonical). */
  sessionConfig: Record<string, unknown>;
  sessionSlug: string;
  account: string;
  provider?: unknown;
};

// Adds a template's questions to a Worker-hosted session through the question
// editor's own upload path, so they appear like questions added by hand.
export const publishSetupQuestions = async ({
  questions,
  sessionConfig,
  sessionSlug,
  account,
  provider,
}: PublishSetupQuestionsInput): Promise<number> => {
  const records = questions.map((question) =>
    buildSetupQuestionRecord(question, {
      creator: account,
      sessionName: text(sessionConfig.sessionName),
      sessionSlug,
    }),
  );
  const result = await workerCanonicalAuthoringPort.publishQuestions({
    account,
    providerLike: provider,
    questions: records,
    sessionConfig,
    sessionSlug,
  });
  return result.uploadedQuestions.length;
};
