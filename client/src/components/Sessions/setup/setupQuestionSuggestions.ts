/** @file setupQuestionSuggestions.ts: question drafts on /new from its context, before any Worker exists. */
import { DEFAULT_AI_MODELS } from '@ce-shared/aiDefaults.mjs';
import { fitReasoningEffort, inferAiProviderFromModel, isOpenAiReasoningModel } from '@ce-shared/aiModelFamily.mjs';
import { CONTEXT_FILE_TYPES, resolveContextFileType } from '@ce-shared/sessionContextSources.mjs';
import { buildSessionContextPrompt } from '@ce-shared/sessionContextText.mjs';
import { GENERATED_QUESTIONS_RESPONSE_FORMAT, seedGenPrompt } from '../../../prompts/seedGenPrompt.js';
import {
  buildGeneratedSurveyStatements,
  buildSingleGenerationPrompt,
} from '../../SurveyTool/SurveyGenerator/surveyGeneratorHelpers';
import type { PendingContextFiles } from './SetupContextSources';
import { SETUP_QUESTION_TYPES, asRecord, text, type SetupDraft, type SetupQuestion } from './setupSectionTypes';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
export const SUGGESTED_QUESTION_COUNT = 5;
// The PDFs one request carries, within what OpenAI takes in one request.
const MAX_PDF_BYTES = 32 * 1024 * 1024;
const QUESTION_TYPES = SETUP_QUESTION_TYPES.map((entry) => entry.value);

type PdfPart = { name: string; data: string };

/** True when the page holds context the AI can draft from. */
export const hasSuggestionContext = (draft: SetupDraft, pending: PendingContextFiles): boolean =>
  !!buildSessionContextPrompt({ sessionContext: draft.sessionContext }).text ||
  Object.values(pending.files).some(({ file }) => !!resolveContextFileType(file));

// FileReader, as the client's other uploads use.
const readFile = (file: File, as: 'readAsText' | 'readAsDataURL') =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('The file could not be read.'));
    reader[as](file);
  });

// Text files go into the context block; PDFs the session's AI may analyze go
// to OpenAI as files, while they fit in one request. Files left out are named.
const readPendingFiles = async (pending: PendingContextFiles) => {
  const texts: Array<{ title: string; kind: 'file'; text: string }> = [];
  const pdfs: PdfPart[] = [];
  const skipped: string[] = [];
  let pdfBytes = 0;
  for (const [name, { file, analyze }] of Object.entries(pending.files)) {
    const type = resolveContextFileType(file);
    if (!type || (type === CONTEXT_FILE_TYPES.pdf && !analyze)) continue;
    try {
      if (type !== CONTEXT_FILE_TYPES.pdf) {
        texts.push({ title: name, kind: 'file', text: await readFile(file, 'readAsText') });
      } else if (pdfBytes + file.size > MAX_PDF_BYTES) {
        skipped.push(name);
      } else {
        const dataUrl = await readFile(file, 'readAsDataURL');
        pdfBytes += file.size;
        pdfs.push({ name, data: dataUrl.slice(dataUrl.indexOf(',') + 1) });
      }
    } catch {
      skipped.push(name);
    }
  }
  return { texts, pdfs, skipped };
};

/** The prompt the session page's generator uses, with the page's context as untrusted source material. */
export const buildSuggestionPrompt = (
  draft: SetupDraft,
  contextBlock: string,
  pdfNames: string[] = [],
  count: number = SUGGESTED_QUESTION_COUNT,
): string => {
  const drafted = (Array.isArray(draft.questions) ? draft.questions : [])
    .map((question) => text(asRecord(question).prompt).trim())
    .filter(Boolean)
    .slice(0, 50);
  const source = [
    text(draft.sessionName).trim() && `Session name: ${text(draft.sessionName).trim()}`,
    text(draft.sessionInfo).trim() && `Session description: ${text(draft.sessionInfo).trim()}`,
    contextBlock,
    pdfNames.length && `Attached PDF files, part of this context: ${pdfNames.join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const instructions = [
    text(draft.questionsGenPrompt).trim(),
    drafted.length &&
      [
        'Questions already drafted, which the new ones must not repeat:',
        ...drafted.map((prompt) => `- ${prompt}`),
      ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
  return buildSingleGenerationPrompt({
    promptTemplate: seedGenPrompt,
    sourceDocContent: source,
    count,
    selectedTypes: QUESTION_TYPES,
    defaultTags: text(draft.defaultTags),
    sessionInstructions: instructions,
  });
};

// The page's thinking model when it is OpenAI's, else the default one.
const suggestionModel = (draft: SetupDraft): string => {
  const chosen = text(asRecord(asRecord(asRecord(draft.ai).models).thinking).model).trim();
  return chosen && inferAiProviderFromModel(chosen) === 'openai' ? chosen : DEFAULT_AI_MODELS.thinking;
};

/** The Responses API request for these drafts. */
export const buildSuggestionRequest = (draft: SetupDraft, prompt: string, pdfs: PdfPart[] = []) => {
  const model = suggestionModel(draft);
  const { name, schema, strict } = GENERATED_QUESTIONS_RESPONSE_FORMAT.json_schema;
  return {
    model,
    store: false,
    input: [
      {
        role: 'user',
        content: [
          ...pdfs.map((pdf) => ({
            type: 'input_file',
            filename: pdf.name,
            file_data: `data:application/pdf;base64,${pdf.data}`,
          })),
          { type: 'input_text', text: prompt },
        ],
      },
    ],
    text: { format: { type: 'json_schema', name, schema, strict } },
    ...(isOpenAiReasoningModel(model)
      ? { reasoning: { effort: fitReasoningEffort(model, text(asRecord(draft.ai).reasoningEffort) || 'low') } }
      : {}),
    max_output_tokens: 16000,
  };
};

const outputText = (data: Record<string, unknown>): string =>
  typeof data.output_text === 'string'
    ? data.output_text
    : (Array.isArray(data.output) ? data.output : [])
        .flatMap((item) => {
          const content = asRecord(item).content;
          return Array.isArray(content) ? content : [];
        })
        .map((part) => text(asRecord(part).text))
        .join('');

/** Drafts as the Questions section lists them: only the session's types, with usable options. */
export const readSuggestedQuestions = (
  data: Record<string, unknown>,
  count: number = SUGGESTED_QUESTION_COUNT,
): SetupQuestion[] => {
  const match = outputText(data).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The AI sent no questions. Try again.');
  const aiData = JSON.parse(match[0]);
  const { statements } = buildGeneratedSurveyStatements({ aiData, selectedTypes: QUESTION_TYPES, count });
  // None is an answer, as the AI writes only what the context supports; only unusable ones are an error.
  if (!statements.length && Array.isArray(aiData?.questions) && aiData.questions.length) {
    throw new Error('The AI sent no usable questions. Try again.');
  }
  return statements.map(({ type, prompt, options, voiceCredits, tags }) => ({
    prompt,
    type,
    tags,
    ...(options ? { options } : {}),
    ...(voiceCredits === undefined ? {} : { voiceCredits }),
  }));
};

export type SuggestionResult = { questions: SetupQuestion[]; skipped: string[] };

// The key goes only to OpenAI, from this browser, and never into an error.
export const suggestSetupQuestions = async ({
  draft,
  pending,
  apiKey,
  fetchImpl = globalThis.fetch,
}: {
  draft: SetupDraft;
  pending: PendingContextFiles;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<SuggestionResult> => {
  const { texts, pdfs, skipped } = await readPendingFiles(pending);
  const contextBlock = buildSessionContextPrompt({ sessionContext: draft.sessionContext, sources: texts }).text;
  const prompt = buildSuggestionPrompt(
    draft,
    contextBlock,
    pdfs.map((pdf) => pdf.name),
  );
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify(buildSuggestionRequest(draft, prompt, pdfs)),
  });
  const data = asRecord(await response.json().catch(() => ({})));
  // OpenAI's message for a bad key quotes part of it, so that one is replaced.
  if (response.status === 401) throw new Error('OpenAI didn’t accept the key. Check the OpenAI key under AI.');
  if (!response.ok) {
    const message = text(asRecord(data.error).message).trim();
    throw new Error(`OpenAI couldn’t draft questions (${response.status})${message ? `: ${message}` : '.'}`);
  }
  return { questions: readSuggestedQuestions(data), skipped };
};
