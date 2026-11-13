import { callAI } from '../../utilities/ai/aiClient.js';
import { GENERATED_QUESTIONS_RESPONSE_FORMAT, seedGenPrompt } from '../../prompts/seedGenPrompt.js';
import { generateQuestionId as generateSharedQuestionId } from '../../utilities/shared/questionUtils.mjs';
import {
  buildGeneratedSurveyStatements,
  buildSingleGenerationPrompt,
  getSelectedQuestionTypes,
  GeneratedAiQuestionPayload,
  GeneratedSurveyStatement,
  QuestionTypeSelection,
} from './SurveyGenerator/surveyGeneratorHelpers';

export const LISTENING_QUESTION_COUNT = 5;
// About 30,000 tokens, two hours or more of talk; a longer discussion is drafted in parts, then once over those.
export const LISTENING_TRANSCRIPT_PART_CHARS = 120_000;
const COMBINE_PARTS_INSTRUCTIONS =
  'The source lists candidate questions drafted from each part of one long discussion, in order. Choose and merge them into the strongest questions for the whole discussion, drawing only on these candidates.';

export const LISTENING_TRANSCRIPT_FOCUS_INSTRUCTIONS = [
  'Weigh the whole recorded conversation, its early, middle and late parts alike, and choose its most contested or debate-worthy claims.',
  'Prefer statements that expose disagreement, trade-offs, decision criteria or evidence gaps.',
  'Where the group discussed what to do, include statements about concrete next steps it proposed or could take, so participants can back or reject each one.',
].join(' ');

export const LISTENING_QUESTION_TYPES: QuestionTypeSelection = Object.freeze({
  binary: true,
  multichoice: true,
  quadratic: true,
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
  existingQuestionPrompts?: unknown[];
  combineParts?: boolean;
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
    existingQuestionPrompts = [],
    combineParts = false,
  }: ListeningQuestionGenerationOptions = {},
) => {
  const existingPrompts = Array.isArray(existingQuestionPrompts)
    ? existingQuestionPrompts
        .map((prompt) => String(prompt || '').trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const duplicateAvoidanceInstructions = existingPrompts.length
    ? [
        'Already drafted questions from this conversation:',
        ...existingPrompts.map((prompt, index) => `${index + 1}. ${prompt}`),
        'Generate genuinely new drafts. Do not repeat these prompts or restate the same concept with cosmetic wording changes.',
      ].join('\n')
    : '';
  const listeningInstructions = [
    LISTENING_TRANSCRIPT_FOCUS_INSTRUCTIONS,
    combineParts ? COMBINE_PARTS_INSTRUCTIONS : '',
    duplicateAvoidanceInstructions,
    String(sessionInstructions || '').trim(),
  ]
    .filter(Boolean)
    .join('\n\n');

  return buildSingleGenerationPrompt({
    promptTemplate: seedGenPrompt,
    sourceDocContent: transcript,
    count,
    selectedTypes: getSelectedQuestionTypes(questionTypes),
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

export const generateListeningQuestionId = (
  type: string,
  prompt: string,
  options: string[] = [],
  singleSelect = false,
  voiceCredits = 99,
) => generateSharedQuestionId(type, prompt, options, singleSelect, voiceCredits);

export const buildListeningQuestionStatements = (
  payload: GeneratedAiQuestionPayload,
  {
    count = LISTENING_QUESTION_COUNT,
    questionTypes = LISTENING_QUESTION_TYPES,
  }: ListeningQuestionGenerationOptions = {},
) =>
  buildGeneratedSurveyStatements({
    aiData: payload,
    selectedTypes: getSelectedQuestionTypes(questionTypes),
    count,
    fallbackTitle: 'Listening Session Questions',
    generateQuestionId: generateListeningQuestionId,
  });

const draftListeningQuestions = async (
  source: string,
  opts: ListeningQuestionGenerationOptions,
): Promise<ListeningQuestionGenerationResult> => {
  const rawOutput = await callAI(buildListeningQuestionPrompt(source, opts), {
    sessionSlug: opts.sessionSlug,
    sessionConfig: opts.sessionConfig,
    context: opts.context,
    workerUrl: opts.workerUrl,
    taskType: 'generate',
    thinking: true,
    response_format: GENERATED_QUESTIONS_RESPONSE_FORMAT,
  });
  const raw = parseListeningQuestionResponse(rawOutput);
  const { statements, surveyTitle } = buildListeningQuestionStatements(raw, opts);
  return { statements, surveyTitle, raw };
};

// Whole lines, each part at most `limit` characters; a longer line is cut.
const transcriptParts = (text: string, limit: number) => {
  const parts: string[] = [];
  let part = '';
  for (const line of text.split('\n')) {
    for (let start = 0; start < Math.max(line.length, 1); start += limit) {
      const piece = line.slice(start, start + limit);
      if (part && part.length + piece.length + 1 > limit) {
        parts.push(part);
        part = '';
      }
      part = part ? `${part}\n${piece}` : piece;
    }
  }
  return part ? [...parts, part] : parts;
};

export const generateQuestionsFromListeningTranscript = async (
  transcript: unknown,
  opts: ListeningQuestionGenerationOptions = {},
): Promise<ListeningQuestionGenerationResult> => {
  const text = String(transcript || '').trim();
  if (text.length < 50) {
    throw new Error('Transcript is too short to generate questions.');
  }
  const parts = transcriptParts(text, LISTENING_TRANSCRIPT_PART_CHARS);
  if (parts.length === 1) return draftListeningQuestions(text, opts);
  // Each part offers candidates, and one last pass picks from all of them, so the whole discussion counts.
  const drafts = await Promise.all(
    parts.map((part, index) =>
      draftListeningQuestions(part, {
        ...opts,
        sourceTypeOverride: `transcript, part ${index + 1} of ${parts.length} of one discussion`,
      }),
    ),
  );
  const candidates = drafts
    .flatMap((draft) => draft.statements)
    .map(
      (statement, index) =>
        `${index + 1}. (${statement.type}${statement.options?.length ? `: ${statement.options.join(' / ')}` : ''}) ${statement.prompt}`,
    )
    .join('\n');
  return draftListeningQuestions(candidates, {
    ...opts,
    sourceTypeOverride: 'candidate questions from one recorded discussion',
    combineParts: true,
  });
};
