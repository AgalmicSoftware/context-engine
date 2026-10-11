import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { uploadDataToSessionStorage } from '../../utilities/storage/storageClient';
import {
  STORAGE_BACKENDS,
  STORAGE_RESOURCE_KEYS,
  normalizeStorageRef,
  type StorageRef,
} from '../../utilities/storage/storageRefs';
import { usesCloudflareSessionStorage } from '../../utilities/storage/sessionStorageConfig';

type UnknownRecord = Record<string, unknown>;

export type WorkerCanonicalAuthoringTarget = {
  sessionConfig: UnknownRecord;
  sessionId: string;
  sessionSlug: string;
  workerUrl: string;
};

type WorkerCanonicalAuthoringInput = {
  account?: unknown;
  providerLike?: unknown;
  questions?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
};

type WorkerCanonicalSurveyAuthoringInput = WorkerCanonicalAuthoringInput & {
  survey?: unknown;
};

type UploadData = typeof uploadDataToSessionStorage;

// Returns a check for whether readers already see a question under its id
// with the same content (the metadata hydration port provides it).
type LoadPublishedQuestionMatcher = (
  input: WorkerCanonicalAuthoringInput,
) => Promise<(question: UnknownRecord) => boolean>;

type WorkerCanonicalAuthoringDeps = {
  loadPublishedQuestionMatcher?: LoadPublishedQuestionMatcher;
  uploadData?: UploadData;
};

type UploadedWorkerQuestion = {
  questionId: string;
  resource: typeof STORAGE_RESOURCE_KEYS.QUESTIONS;
  // Absent when another author already published this exact question.
  storageRef?: StorageRef;
  alreadyPublished?: true;
};

export type WorkerCanonicalQuestionsAuthoringResult = WorkerCanonicalAuthoringTarget & {
  uploadedQuestions: UploadedWorkerQuestion[];
  workerCanonicalSubmission: true;
};

export type WorkerCanonicalSurveyAuthoringResult = WorkerCanonicalQuestionsAuthoringResult & {
  surveyStorageRef: StorageRef;
};

type WorkerCanonicalStorageTargetOptions = {
  requirePureWorkerCanonical?: boolean;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// Session Workers let only an id's first author or a session admin upload it
// again, and refuse ids a session admin hid.
const STORAGE_ID_OWNED = 'storage_resource_id_owned';
const STORAGE_ID_HIDDEN = 'storage_resource_id_hidden';

const readUploadRejectionReason = (error: unknown): string =>
  isRecord(error) && typeof error.reason === 'string' ? error.reason : '';

const describeQuestionPrompt = (question: UnknownRecord): string => {
  const prompt = typeof question.prompt === 'string' ? question.prompt.trim() : '';
  if (!prompt || prompt === '[encrypted]') return '';
  return `: "${prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt}"`;
};

const requireRecord = (value: unknown, error: string): UnknownRecord => {
  if (!isRecord(value)) throw new Error(error);
  return value;
};

const requireStorageRef = (value: unknown, resource: string): StorageRef => {
  const source = isRecord(value) ? value : {};
  const storageRef = normalizeStorageRef(source.storageRef || source, {
    fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE,
    resource,
  });
  if (!storageRef || storageRef.backend !== STORAGE_BACKENDS.CLOUDFLARE) {
    throw new Error(`worker_authoring_${resource}_storage_ref_missing`);
  }
  return storageRef;
};

const buildStorageTags = ({
  resource,
  resourceId,
  sessionId,
  sessionSlug,
}: {
  resource: string;
  resourceId: string;
  sessionId: string;
  sessionSlug: string;
}) => [
  { name: 'CE-SessionId', value: sessionId },
  { name: 'CE-SessionSlug', value: sessionSlug },
  { name: 'CE-Resource', value: resource },
  { name: 'CE-ResourceId', value: resourceId },
];

export const resolveWorkerCanonicalStorageTarget = (
  { sessionConfig, sessionSlug }: Pick<WorkerCanonicalAuthoringInput, 'sessionConfig' | 'sessionSlug'> = {},
  { requirePureWorkerCanonical = false }: WorkerCanonicalStorageTargetOptions = {},
): WorkerCanonicalAuthoringTarget => {
  const config = requireRecord(sessionConfig, 'worker_authoring_session_config_missing');
  const requestedSlug = canonicalizeSessionSlug(sessionSlug);
  const configuredSlug = canonicalizeSessionSlug(config.slug);
  const projection = resolveSessionCapabilityProjection(config);
  if (!projection.profileValid || !projection.isWorkerCanonical) {
    throw new Error('worker_storage_requires_valid_worker_canonical_session');
  }
  if (requirePureWorkerCanonical && !projection.isPureWorkerCanonical) {
    throw new Error('worker_authoring_requires_pure_worker_canonical_session');
  }
  if (!requestedSlug || configuredSlug !== requestedSlug) {
    throw new Error('worker_authoring_exact_session_slug_required');
  }
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  if (!sessionId) throw new Error('worker_authoring_exact_session_identity_required');
  if (
    !usesCloudflareSessionStorage(config, { resource: STORAGE_RESOURCE_KEYS.QUESTIONS }) ||
    !usesCloudflareSessionStorage(config, { resource: STORAGE_RESOURCE_KEYS.SURVEYS })
  ) {
    throw new Error('worker_authoring_cloudflare_question_and_survey_storage_required');
  }
  const workerUrl = getUsableSessionWorkerUrl({
    slug: requestedSlug,
    sessionConfig: config,
    allowSharedFallback: false,
    requireExactWorkerSession: true,
  });
  if (!workerUrl) throw new Error('worker_authoring_exact_worker_origin_required');
  return {
    sessionConfig: config,
    sessionId,
    sessionSlug: requestedSlug,
    workerUrl,
  };
};

export const resolveWorkerCanonicalAuthoringTarget = (
  input: Pick<WorkerCanonicalAuthoringInput, 'sessionConfig' | 'sessionSlug'> = {},
): WorkerCanonicalAuthoringTarget => resolveWorkerCanonicalStorageTarget(input);

const uploadQuestions = async ({
  account,
  deps,
  providerLike,
  questions,
  target,
}: {
  account?: unknown;
  deps: WorkerCanonicalAuthoringDeps;
  providerLike?: unknown;
  questions?: unknown;
  target: WorkerCanonicalAuthoringTarget;
}): Promise<UploadedWorkerQuestion[]> => {
  const rows = Array.isArray(questions) ? questions : [];
  if (!rows.length) throw new Error('worker_authoring_questions_missing');
  const uploadData = deps.uploadData || uploadDataToSessionStorage;
  const uploadedQuestions: UploadedWorkerQuestion[] = [];
  // Read the session's questions at most once, on the first id another author owns.
  let publishedQuestionMatcher: Promise<((question: UnknownRecord) => boolean) | null> | null = null;
  const isAlreadyPublished = async (payload: UnknownRecord): Promise<boolean> => {
    const loadMatcher = deps.loadPublishedQuestionMatcher;
    if (!loadMatcher) return false;
    publishedQuestionMatcher ??= loadMatcher({
      account,
      providerLike,
      sessionConfig: target.sessionConfig,
      sessionSlug: target.sessionSlug,
    }).catch(() => null);
    const matches = await publishedQuestionMatcher;
    return !!matches && matches(payload);
  };
  for (const value of rows) {
    const question = requireRecord(value, 'worker_authoring_question_invalid');
    const questionId = String(question.id || question.questionId || '').trim();
    if (!questionId) throw new Error('worker_authoring_question_id_missing');
    const payload = {
      ...question,
      id: questionId,
      sessionId: target.sessionId,
      sessionSlug: target.sessionSlug,
    };
    let uploaded: unknown;
    try {
      uploaded = await uploadData(payload, 'json', {
        sessionSlug: target.sessionSlug,
        sessionConfig: target.sessionConfig,
        context: {
          account,
          providerLike,
        },
        workerUrl: target.workerUrl,
        tags: buildStorageTags({
          resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
          resourceId: questionId,
          sessionId: target.sessionId,
          sessionSlug: target.sessionSlug,
        }),
        contentType: 'application/json',
        resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
      });
    } catch (error) {
      const reason = readUploadRejectionReason(error);
      // Another author owns this id. It counts as already published only when
      // the stored question readers see has this same content; otherwise the
      // Worker's refusal stands.
      if (reason === STORAGE_ID_OWNED && (await isAlreadyPublished(payload))) {
        uploadedQuestions.push({ questionId, resource: STORAGE_RESOURCE_KEYS.QUESTIONS, alreadyPublished: true });
        continue;
      }
      if (reason === STORAGE_ID_HIDDEN) {
        throw new Error(
          `This question was hidden by the session admin and can't be published again${describeQuestionPrompt(question)}.`,
        );
      }
      throw error;
    }
    uploadedQuestions.push({
      questionId,
      resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
      storageRef: requireStorageRef(uploaded, STORAGE_RESOURCE_KEYS.QUESTIONS),
    });
  }
  return uploadedQuestions;
};

export const publishWorkerCanonicalQuestions = async (
  input: WorkerCanonicalAuthoringInput = {},
  deps: WorkerCanonicalAuthoringDeps = {},
): Promise<WorkerCanonicalQuestionsAuthoringResult> => {
  const target = resolveWorkerCanonicalAuthoringTarget(input);
  const uploadedQuestions = await uploadQuestions({
    account: input.account,
    deps,
    providerLike: input.providerLike,
    questions: input.questions,
    target,
  });
  return {
    ...target,
    uploadedQuestions,
    workerCanonicalSubmission: true,
  };
};

export const publishWorkerCanonicalSurvey = async (
  input: WorkerCanonicalSurveyAuthoringInput = {},
  deps: WorkerCanonicalAuthoringDeps = {},
): Promise<WorkerCanonicalSurveyAuthoringResult> => {
  const target = resolveWorkerCanonicalAuthoringTarget(input);
  const survey = requireRecord(input.survey, 'worker_authoring_survey_invalid');
  const surveyId = String(survey.surveyID || survey.id || '').trim();
  if (!surveyId) throw new Error('worker_authoring_survey_id_missing');
  const uploadedQuestions = await uploadQuestions({
    account: input.account,
    deps,
    providerLike: input.providerLike,
    questions: input.questions,
    target,
  });
  const uploadData = deps.uploadData || uploadDataToSessionStorage;
  const uploadedSurvey = await uploadData(
    {
      ...survey,
      surveyID: surveyId,
      sessionId: target.sessionId,
      sessionSlug: target.sessionSlug,
    },
    'json',
    {
      sessionSlug: target.sessionSlug,
      sessionConfig: target.sessionConfig,
      context: {
        account: input.account,
        providerLike: input.providerLike,
      },
      workerUrl: target.workerUrl,
      tags: buildStorageTags({
        resource: STORAGE_RESOURCE_KEYS.SURVEYS,
        resourceId: surveyId,
        sessionId: target.sessionId,
        sessionSlug: target.sessionSlug,
      }),
      contentType: 'application/json',
      resource: STORAGE_RESOURCE_KEYS.SURVEYS,
    },
  ).catch((error: unknown) => {
    if (readUploadRejectionReason(error) === STORAGE_ID_HIDDEN) {
      throw new Error("This survey was hidden by the session admin and can't be published again.");
    }
    throw error;
  });
  return {
    ...target,
    uploadedQuestions,
    surveyStorageRef: requireStorageRef(uploadedSurvey, STORAGE_RESOURCE_KEYS.SURVEYS),
    workerCanonicalSubmission: true,
  };
};

export const workerCanonicalAuthoringPort = {
  publishQuestions: publishWorkerCanonicalQuestions,
  publishSurvey: publishWorkerCanonicalSurvey,
  resolveTarget: resolveWorkerCanonicalAuthoringTarget,
};
