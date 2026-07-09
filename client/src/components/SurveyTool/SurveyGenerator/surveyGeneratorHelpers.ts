import type { CSSProperties } from 'react';
import { toStr } from '../../../utilities/shared/primitives.js';
import { generateQuestionId as generateSharedQuestionId } from '../../../utilities/shared/questionUtils.mjs';

export const MIN_QUESTION_COUNT = 5;
export const MAX_QUESTION_COUNT = 50;
export const SUPPORTED_SOURCE_FILE_EXTENSIONS = /\.(pdf|md|txt|csv|ppt|pptx|json)$/i;
export const SUPPORTED_SOURCE_FILE_ACCEPT = '.pdf,.md,.txt,.csv,.ppt,.pptx,.json';
export const SUPPORTED_PHOTO_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;
export const SUPPORTED_PHOTO_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif';
export const SUPPORTED_SOURCE_UPLOAD_ACCEPT = `${SUPPORTED_SOURCE_FILE_ACCEPT},${SUPPORTED_PHOTO_ACCEPT}`;

export const PHOTO_ANALYSIS_STATUS_LABELS: Record<string, string> = Object.freeze({
  queued: 'Queued for analysis',
  loading: 'Analyzing photo...',
  ready: 'Analysis complete',
  error: 'Analysis failed',
});

export const SURVEY_GENERATOR_TEXT_INPUT_STYLE: CSSProperties = {
  resize: 'both',
  minHeight: '100px',
  overflow: 'auto',
};

export const SURVEY_GENERATOR_ERROR_STYLE: CSSProperties = {
  marginTop: '10px',
};

export const SURVEY_GENERATOR_AI_PROMPT_ICON_STYLE: CSSProperties = {
  marginLeft: '6px',
};

export const buildSurveyGeneratorTranscriptToggleClassName = (
  styleMap: Record<string, string>,
  active: unknown,
): string => `${styleMap.transcriptToggleBtn} ${active ? styleMap.active : ''}`;

export const buildSurveyGeneratorAiPromptCopyClassName = (
  styleMap: Record<string, string>,
  copySuccess: unknown,
): string => `${styleMap.aiPromptCopyCorner} ${copySuccess ? styleMap.aiPromptCopyCornerSuccess : ''}`;

export const buildSurveyGeneratorPhotoStatusToggleClassName = (styleMap: Record<string, string>): string =>
  `${styleMap.photoStatusChip} ${styleMap.photoStatusToggle}`;

export const buildSurveyGeneratorPhotoStatusChipClassName = (
  styleMap: Record<string, string>,
  statusKey: unknown,
): string => {
  const raw = toStr(statusKey || 'queued')
    .trim()
    .toLowerCase();
  const statusClassName = styleMap[`photoStatusChip${raw.charAt(0).toUpperCase()}${raw.slice(1)}`] || '';
  return `${styleMap.photoStatusChip} ${statusClassName}`;
};

export const buildSurveyGeneratorDocSaveAudienceOptionClassName = (
  styleMap: Record<string, string>,
  active: unknown,
): string => `${styleMap.docSaveAudienceOption} ${active ? styleMap.active : ''}`;

export const buildSurveyGeneratorTypeButtonClassName = (styleMap: Record<string, string>, active: unknown): string =>
  `${styleMap.typeButton} ${active ? styleMap.active : ''}`;

export const buildSurveyGeneratorTypePillClassName = (
  styleMap: Record<string, string>,
  variant: 'agree' | 'unsure' | 'disagree',
): string => {
  const variantClassName =
    variant === 'agree' ? styleMap.pillAgree : variant === 'unsure' ? styleMap.pillUnsure : styleMap.pillDisagree;
  return `${styleMap.pill} ${variantClassName}`;
};

const AI_PROVIDER_LABELS: Record<string, string> = Object.freeze({
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  custom: 'Custom',
  local: 'Local',
});

export type AdditionalSourceIdRef = {
  current: number;
};

export type SourceFileLike = {
  name?: string;
  type?: string;
};

export type PhotoPreviewUrlApi =
  | {
      createObjectURL?: (file: Blob | MediaSource) => string;
      revokeObjectURL?: (url: string) => void;
    }
  | null
  | undefined;

export type QueuedFileSource<TFile extends SourceFileLike = SourceFileLike> = {
  id: string;
  type: 'file';
  value: TFile;
  name: TFile['name'];
};

export type QueuedPhotoSource<TFile extends SourceFileLike = SourceFileLike> = {
  id: string;
  type: 'photo';
  value: TFile;
  name: TFile['name'];
  analysisStatus: 'queued';
  analysisError: '';
  analysisText: '';
  analysisExpanded: false;
};

export type QueuedUrlSource = {
  id: string;
  type: 'url';
  value: string;
  name: string;
};

export type QueuedAdditionalSource<TFile extends SourceFileLike = SourceFileLike> =
  | QueuedFileSource<TFile>
  | (Omit<QueuedPhotoSource<TFile>, 'analysisStatus' | 'analysisError' | 'analysisText' | 'analysisExpanded'> & {
      analysisStatus?: unknown;
      analysisError?: unknown;
      analysisText?: unknown;
      analysisExpanded?: unknown;
    })
  | QueuedUrlSource;

export type QueuedPhotoSourceBatch<TFile extends SourceFileLike = SourceFileLike> = {
  invalidCount: number;
  nextSources: QueuedPhotoSource<TFile>[];
  validFiles: TFile[];
};

export type QueuedUploadedSourceBatch<TFile extends SourceFileLike = SourceFileLike> = {
  invalidCount: number;
  nextSources: Array<QueuedFileSource<TFile> | QueuedPhotoSource<TFile>>;
};

export type EffectiveAdditionalSourceListArgs = {
  additionalSources?: unknown;
  additionalUrlInput?: unknown;
  ref: AdditionalSourceIdRef;
};

export type EffectiveAdditionalSourceList = {
  effectiveSources: QueuedAdditionalSource[];
  queuedAdditionalSources: QueuedAdditionalSource[];
};

export type PhotoStatusSource = {
  analysisStatus?: unknown;
  analysisError?: unknown;
};

export type PhotoAnalysisMarkdownInput = {
  photoName?: unknown;
  analysisText?: unknown;
};

export type UploadFilenameInput = {
  title?: unknown;
  originalName?: unknown;
  fallbackBase?: string;
  fallbackExtension?: unknown;
};

export type ManualLibraryTextFileInput = {
  title?: unknown;
  text?: unknown;
};

export type LibraryContentInput = {
  pastedText?: unknown;
  additionalUrlInput?: unknown;
  additionalSources?: unknown;
};

export type DatabaseToolInputContent = LibraryContentInput & {
  audioFile?: unknown;
};

export type AiPromptModelConfig = {
  provider?: unknown;
  model?: unknown;
};

export type QuestionTypeSelection = Record<string, unknown>;

export type GeneratedAiQuestion = {
  questionType: string;
  prompt: string;
  options?: string[];
  tags?: string[];
};

export type GeneratedAiQuestionPayload = {
  questions: GeneratedAiQuestion[];
  surveyTitle?: unknown;
};

export type GeneratedSurveyStatement = {
  id: string;
  type: string;
  prompt: string;
  options?: string[];
  tags: string[];
};

export type GeneratedSurveyStatementsInput = {
  aiData: GeneratedAiQuestionPayload;
  questionTypes: QuestionTypeSelection;
  count: number;
  fallbackTitle?: unknown;
  generateQuestionId?: (type: string, prompt: string, options?: string[]) => string;
};

export type GeneratedSurveyStatementsResult = {
  statements: GeneratedSurveyStatement[];
  surveyTitle: string;
};

export type GenerationPromptOverrides = {
  sourceTypeOverride?: unknown;
  multiSpeakerHintOverride?: unknown;
};

export type BuildSingleGenerationPromptInput = {
  promptTemplate: string;
  sourceDocContent: unknown;
  count: number;
  questionTypes: QuestionTypeSelection;
  defaultTags?: string | Array<string | null | undefined | false | ''> | null;
  transcriptMode?: boolean;
  overrides?: GenerationPromptOverrides;
  sessionInstructions?: unknown;
};

export const clampQuestionCount = (value: number) => Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, value));

export const buildAdditionalSourceId = (ref: AdditionalSourceIdRef) => {
  ref.current += 1;
  return `database-source-${ref.current}`;
};

export const isSupportedPhotoFile = (file: SourceFileLike | null | undefined) =>
  Boolean(file) &&
  (/^image\/(png|jpeg|webp|gif)$/i.test(String(file?.type || '').trim()) ||
    SUPPORTED_PHOTO_EXTENSIONS.test(String(file?.name || '').trim()));

export const isSupportedAdditionalFile = (file: SourceFileLike | null | undefined) =>
  Boolean(file) &&
  (/^(application\/pdf|text\/markdown|text\/plain|text\/csv|application\/json|application\/vnd\.ms-powerpoint|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)$/i.test(
    String(file?.type || '').trim(),
  ) ||
    SUPPORTED_SOURCE_FILE_EXTENSIONS.test(String(file?.name || '').trim()));

export const buildQueuedFileSource = <TFile extends SourceFileLike>(
  file: TFile,
  ref: AdditionalSourceIdRef,
): QueuedFileSource<TFile> => ({
  id: buildAdditionalSourceId(ref),
  type: 'file',
  value: file,
  name: file.name,
});

export const isLikelyImageUrl = (value: unknown = '') => {
  const raw = toStr(value).trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    const pathname = toStr(parsed.pathname).trim();
    return SUPPORTED_PHOTO_EXTENSIONS.test(pathname);
  } catch (_) {
    return false;
  }
};

export const buildQueuedPhotoSource = <TFile extends SourceFileLike>(
  file: TFile,
  ref: AdditionalSourceIdRef,
): QueuedPhotoSource<TFile> => ({
  id: buildAdditionalSourceId(ref),
  type: 'photo',
  value: file,
  name: file.name,
  analysisStatus: 'queued',
  analysisError: '',
  analysisText: '',
  analysisExpanded: false,
});

export const buildQueuedPhotoSourceBatch = <TFile extends SourceFileLike>(
  files: TFile | TFile[] = [],
  ref: AdditionalSourceIdRef,
): QueuedPhotoSourceBatch<TFile> => {
  const selectedFiles = Array.isArray(files) ? files : [files];
  const validFiles = selectedFiles.filter(isSupportedPhotoFile) as TFile[];
  return {
    invalidCount: selectedFiles.length - validFiles.length,
    nextSources: validFiles.map((file) => buildQueuedPhotoSource(file, ref)),
    validFiles,
  };
};

export const buildQueuedUploadedSourceBatch = <TFile extends SourceFileLike>(
  files: TFile | TFile[] = [],
  ref: AdditionalSourceIdRef,
): QueuedUploadedSourceBatch<TFile> => {
  const selectedFiles = Array.isArray(files) ? files : [files];
  const nextSources: Array<QueuedFileSource<TFile> | QueuedPhotoSource<TFile>> = [];
  let invalidCount = 0;

  selectedFiles.forEach((file) => {
    if (isSupportedPhotoFile(file)) {
      nextSources.push(buildQueuedPhotoSource(file, ref));
      return;
    }
    if (isSupportedAdditionalFile(file)) {
      nextSources.push(buildQueuedFileSource(file, ref));
      return;
    }
    invalidCount += 1;
  });

  return { nextSources, invalidCount };
};

export const buildEffectiveAdditionalSourceList = ({
  additionalSources = [],
  additionalUrlInput = '',
  ref,
}: EffectiveAdditionalSourceListArgs): EffectiveAdditionalSourceList => {
  const queuedAdditionalSources = (
    Array.isArray(additionalSources) ? [...additionalSources] : []
  ) as QueuedAdditionalSource[];
  const pendingUrl = toStr(additionalUrlInput).trim();
  const effectiveSources = pendingUrl
    ? [
        ...queuedAdditionalSources,
        {
          id: buildAdditionalSourceId(ref),
          type: 'url',
          value: pendingUrl,
          name: pendingUrl,
        } satisfies QueuedUrlSource,
      ]
    : [...queuedAdditionalSources];
  return { queuedAdditionalSources, effectiveSources };
};

export const buildPhotoPreviewUrl = (file: unknown, urlApi: PhotoPreviewUrlApi = globalThis.URL): string => {
  if (!file || !urlApi || typeof urlApi.createObjectURL !== 'function') {
    return '';
  }
  return urlApi.createObjectURL(file as Blob | MediaSource);
};

export const revokePhotoPreviewUrl = (previewSrc: unknown, urlApi: PhotoPreviewUrlApi = globalThis.URL): boolean => {
  const src = toStr(previewSrc);
  if (!src || !urlApi || typeof urlApi.revokeObjectURL !== 'function') {
    return false;
  }
  urlApi.revokeObjectURL(src);
  return true;
};

export const getSurveyGeneratorErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  const message =
    error && typeof error === 'object' && 'message' in error ? (error as { message?: unknown }).message : '';
  return typeof message === 'string' && message.trim() ? message : fallback;
};

export const buildUnsupportedPhotoMessage = (count = 0) =>
  `Skipped ${count} unsupported photo${count === 1 ? '' : 's'}. Use png, jpg, jpeg, webp, or gif.`;

export const buildUnsupportedSourceMessage = (count = 0) =>
  `Skipped ${count} unsupported file${count === 1 ? '' : 's'}. Use pdf, md, txt, csv, ppt, pptx, json, png, jpg, jpeg, webp, or gif.`;

export const getPhotoStatusLabel = (source: PhotoStatusSource = {}) => {
  const status = toStr(source?.analysisStatus || 'queued')
    .trim()
    .toLowerCase();
  if (status === 'error') {
    return toStr(source?.analysisError).trim() || PHOTO_ANALYSIS_STATUS_LABELS.error;
  }
  return PHOTO_ANALYSIS_STATUS_LABELS[status] || PHOTO_ANALYSIS_STATUS_LABELS.queued;
};

export const isSingleHttpUrlInput = (value: unknown = '') => /^https?:\/\/\S+$/.test(String(value).trim());

export const buildPhotoAnalysisMarkdown = ({ photoName, analysisText }: PhotoAnalysisMarkdownInput = {}) => {
  const safeName = toStr(photoName).trim() || 'uploaded photo';
  const body = toStr(analysisText).trim();
  return ['# Photo Analysis', '', `Source photo: ${safeName}`, '', body].join('\n');
};

export const buildPhotoAnalysisFilename = (photoName: unknown = '') => {
  const safeName = toStr(photoName).trim() || 'photo';
  const withoutExtension = safeName.replace(/\.(png|jpe?g|webp|gif)$/i, '') || safeName;
  return `${withoutExtension}.analysis.md`;
};

export const sanitizeFileBaseName = (value: unknown, fallback = 'context') => {
  const trimmed = toStr(value).trim();
  if (!trimmed) return fallback;
  const normalized = trimmed
    .replace(/\.[A-Za-z0-9]{1,12}$/g, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
};

export const getFileExtension = (name: unknown = '') => {
  const raw = toStr(name).trim();
  const dot = raw.lastIndexOf('.');
  if (dot <= 0 || dot >= raw.length - 1) return '';
  return raw.slice(dot + 1);
};

export const buildUploadFilename = ({
  title,
  originalName,
  fallbackBase = 'context',
  fallbackExtension = '',
}: UploadFilenameInput = {}) => {
  const base = sanitizeFileBaseName(title, sanitizeFileBaseName(originalName, fallbackBase));
  const extension = getFileExtension(originalName) || toStr(fallbackExtension).trim();
  return extension ? `${base}.${extension}` : base;
};

export const renameFileForLibraryUpload = (file: unknown, title: unknown) => {
  if (!(file instanceof File)) return file;
  const trimmedTitle = toStr(title).trim();
  if (!trimmedTitle) return file;
  const nextName = buildUploadFilename({
    title: trimmedTitle,
    originalName: file.name,
    fallbackBase: 'context',
  });
  if (!nextName || nextName === file.name) return file;
  return new File([file], nextName, {
    type: file.type,
    lastModified: Number(file.lastModified || Date.now()),
  });
};

export const buildManualLibraryTextFile = ({ title, text }: ManualLibraryTextFileInput = {}) => {
  const body = toStr(text);
  const looksLikeMarkdown = /(^|\n)\s*(#|\* |- |\d+\.)/.test(body);
  const extension = looksLikeMarkdown ? 'md' : 'txt';
  const filename = buildUploadFilename({
    title,
    originalName: '',
    fallbackBase: 'context-note',
    fallbackExtension: extension,
  });
  return new File([body], filename, {
    type: looksLikeMarkdown ? 'text/markdown' : 'text/plain',
  });
};

export const isManualLibraryUploadableContent = ({
  pastedText = '',
  additionalUrlInput = '',
  additionalSources = [],
}: LibraryContentInput = {}) =>
  Boolean(toStr(pastedText).trim()) ||
  Boolean(toStr(additionalUrlInput).trim()) ||
  (Array.isArray(additionalSources) && additionalSources.length > 0);

export const hasDatabaseToolInputContent = ({
  pastedText = '',
  additionalUrlInput = '',
  additionalSources = [],
  audioFile = null,
}: DatabaseToolInputContent = {}) => {
  if (toStr(pastedText).trim()) return true;
  if (toStr(additionalUrlInput).trim()) return true;
  if (Array.isArray(additionalSources) && additionalSources.length > 0) return true;
  return Boolean(audioFile);
};

export const formatAiPromptModelLabel = (config: AiPromptModelConfig = {}) => {
  const providerKey = toStr(config?.provider).trim().toLowerCase();
  const model = toStr(config?.model).trim();
  const provider =
    AI_PROVIDER_LABELS[providerKey] ||
    (providerKey ? `${providerKey.charAt(0).toUpperCase()}${providerKey.slice(1)}` : '');
  if (provider && model) return `${provider} ${model}`;
  return model || provider || 'Configured model';
};

export const normalizeTags = (dTags?: string | Array<string | null | undefined | false | ''> | null) => {
  if (!dTags) return [];
  if (Array.isArray(dTags)) return (dTags.filter(Boolean) as string[]).map((tag) => tag.trim());
  if (typeof dTags === 'string') {
    return dTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

export const getSelectedQuestionTypes = (questionTypes: QuestionTypeSelection = {}) =>
  Object.keys(questionTypes).filter((type) => questionTypes[type]);

export const buildGeneratedSurveyStatements = ({
  aiData,
  questionTypes,
  count,
  fallbackTitle = '',
  generateQuestionId = generateSharedQuestionId,
}: GeneratedSurveyStatementsInput): GeneratedSurveyStatementsResult => {
  const wantedTypes = getSelectedQuestionTypes(questionTypes);
  const questions = aiData.questions.filter((question) => wantedTypes.includes(question.questionType)).slice(0, count);

  questions.forEach((question) => {
    question.tags = question.tags || [];
  });

  const statements = questions.map((question) => ({
    id: generateQuestionId(question.questionType, question.prompt, question.options || []),
    type: question.questionType,
    prompt: question.prompt,
    options: question.questionType === 'multichoice' ? question.options : undefined,
    tags: question.tags || [],
  }));

  return {
    statements,
    surveyTitle: toStr(aiData?.surveyTitle).trim() || toStr(fallbackTitle).trim(),
  };
};

export const buildSingleGenerationPrompt = ({
  promptTemplate,
  sourceDocContent,
  count,
  questionTypes,
  defaultTags,
  transcriptMode = false,
  overrides = {},
  sessionInstructions = '',
}: BuildSingleGenerationPromptInput) => {
  const allowed = normalizeTags(defaultTags);
  const defaultTagsStr = allowed.length > 0 ? allowed.join(', ') : '';

  const selectedTypes = getSelectedQuestionTypes(questionTypes);
  const typesStr = selectedTypes.length > 0 ? selectedTypes.join(',') : 'binary,rating,freeform,multichoice';

  const sourceType = overrides.sourceTypeOverride || (transcriptMode ? 'transcript' : 'text');

  const multiSpeakerHint = overrides.multiSpeakerHintOverride || 'unknown';
  const literalReplacement = (value: unknown) => () => toStr(value);

  return promptTemplate
    .replace('<SourceDocContent>', literalReplacement(sourceDocContent))
    .replace('<NumSeedStatements>', String(count))
    .replace('<Types>', typesStr)
    .replace(/<DefaultTags>/g, literalReplacement(defaultTagsStr))
    .replace(/<SourceType>/g, literalReplacement(sourceType))
    .replace('<MultiSpeakerHint>', toStr(multiSpeakerHint))
    .replace('<GroupCustomInstructions>', literalReplacement(sessionInstructions))
    .replace('<ClipDurationMinutes>', '');
};
