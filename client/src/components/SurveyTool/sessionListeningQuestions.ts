import { callAI } from '../../utilities/ai/aiScripts.js';
import { seedGenPrompt } from '../../prompts/seedGenPrompt.js';
import { generateQuestionId as generateSharedQuestionId } from '../../utilities/shared/questionUtils.mjs';
import {
  buildGeneratedSurveyStatements,
  buildSingleGenerationPrompt,
  GeneratedAiQuestionPayload,
  GeneratedSurveyStatement,
  QuestionTypeSelection,
} from './SurveyGenerator/surveyGeneratorHelpers';

export const LISTENING_QUESTION_COUNT = 5;

export const LISTENING_TRANSCRIPT_FOCUS_INSTRUCTIONS = [
  'For listening transcripts, read the entire transcript before selecting questions.',
  'Do not overweight the opening topic; compare early, middle, and late sections and choose the most interesting, contentious, or debate-worthy claims across the full conversation.',
  'Prefer statements that expose disagreement, trade-offs, decision criteria, evidence gaps, or questions that would produce useful debate among informed participants.',
].join(' ');

export const LISTENING_QUESTION_TYPES: QuestionTypeSelection = Object.freeze({
  binary: true,
  multichoice: true,
  rating: true,
  freeform: true,
});

export type ListeningQuestionGenerationOptions = {
  count?: number;
  defaultTags?: string | string[] | null;
  questionTypes?: QuestionTypeSelection;
  sessionInstructions?: unknown;
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  sourceTypeOverride?: string;
  multiSpeakerHintOverride?: string;
};

export type ListeningQuestionGenerationResult = {
  statements: GeneratedSurveyStatement[];
  surveyTitle: string;
  raw: GeneratedAiQuestionPayload;
};

export const buildListeningQuestionPrompt = (
  transcript: unknown,
  {
    count = LISTENING_QUESTION_COUNT,
    defaultTags = null,
    questionTypes = LISTENING_QUESTION_TYPES,
    sessionInstructions = '',
    sourceTypeOverride = 'transcript',
    multiSpeakerHintOverride = 'likely_multiple_speakers',
  }: ListeningQuestionGenerationOptions = {},
) => {
  const listeningInstructions = [LISTENING_TRANSCRIPT_FOCUS_INSTRUCTIONS, String(sessionInstructions || '').trim()]
    .filter(Boolean)
    .join('\n\n');

  return buildSingleGenerationPrompt({
    promptTemplate: seedGenPrompt,
    sourceDocContent: transcript,
    count,
    questionTypes,
    defaultTags,
    transcriptMode: true,
    overrides: {
      sourceTypeOverride,
      multiSpeakerHintOverride,
    },
    sessionInstructions: listeningInstructions,
  });
};

export const parseListeningQuestionResponse = (raw: unknown): GeneratedAiQuestionPayload => {
  const text = String(raw || '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in AI response');
  const parsed = JSON.parse(match[0]) as GeneratedAiQuestionPayload;
  if (!Array.isArray(parsed.questions)) {
    throw new Error('AI response missing "questions" array');
  }
  return parsed;
};

export const generateListeningQuestionId = (type: string, prompt: string, options: string[] = []) =>
  generateSharedQuestionId(type, prompt, options);

export const buildListeningQuestionStatements = (
  payload: GeneratedAiQuestionPayload,
  {
    count = LISTENING_QUESTION_COUNT,
    questionTypes = LISTENING_QUESTION_TYPES,
  }: ListeningQuestionGenerationOptions = {},
) =>
  buildGeneratedSurveyStatements({
    aiData: payload,
    questionTypes,
    count,
    fallbackTitle: 'Listening Session Questions',
    generateQuestionId: generateListeningQuestionId,
  });

export const generateQuestionsFromListeningTranscript = async (
  transcript: unknown,
  opts: ListeningQuestionGenerationOptions = {},
): Promise<ListeningQuestionGenerationResult> => {
  const text = String(transcript || '').trim();
  if (text.length < 50) {
    throw new Error('Transcript is too short to generate questions.');
  }

  const prompt = buildListeningQuestionPrompt(text, opts);
  const rawOutput = await callAI(prompt, {
    sessionSlug: opts.sessionSlug,
    sessionConfig: opts.sessionConfig,
    context: opts.context,
    workerUrl: opts.workerUrl,
    taskType: 'generate',
  });
  const raw = parseListeningQuestionResponse(rawOutput);
  const { statements, surveyTitle } = buildListeningQuestionStatements(raw, opts);
  return { statements, surveyTitle, raw };
};
