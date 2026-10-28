import {
  getUsableSessionWorkerUrl,
  resolveConfiguredSessionWorkerUrlFromConfig,
} from '../../utilities/session/sessionWorkerAvailability';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { resolveSessionContractRef } from '../../utilities/session/sessionNaming.js';
import {
  loadSessionInterviewSavedAnswers,
  mergeInterviewSavedAnswerBaseline,
  type InterviewSavedSlice,
} from './sessionInterviewSavedAnswers';
import type { SurveyQuestionsRuntimeEngine } from './surveyQuestionsTypes';
import { hasMeaningfulFieldValue } from './surveyToolDraftState';
import { buildRatingEnvelopeQidSetFromUserAnswers } from './surveyToolResponseState';
import { resolveEffectiveSlug } from './surveyToolScope';
import { normalizeQuestionIdKey } from './surveyToolSignatures';

type RecordValue = Record<string, unknown>;

const readPlainRecord = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};

/** The session and Worker an upload belongs to; any change makes an in-flight read stale. */
export const buildSessionInterviewSubmitContextToken = (props: RecordValue = {}) => {
  const sessionConfig = readPlainRecord(props.sessionConfig);
  const sessionModeProfile = readPlainRecord(sessionConfig.sessionModeProfile);
  const sessionAuthority = readPlainRecord(sessionModeProfile.authority);
  const sessionStorage = readPlainRecord(sessionModeProfile.storage);
  const storageProfile = readPlainRecord(sessionConfig.storageProfile);
  const storageResources = readPlainRecord(storageProfile.resources);
  const slug = String(resolveEffectiveSlug(props) || sessionConfig.slug || '').trim();
  const network = readPlainRecord(props.network);
  const networkId = String(network.id || network.chainId || sessionConfig.networkChainId || '').trim();
  const workerUrl =
    getUsableSessionWorkerUrl({
      slug,
      sessionConfig,
      allowSharedFallback: false,
      requireExactWorkerSession: true,
    }) ||
    getUsableSessionWorkerUrl({
      slug,
      sessionConfig,
      allowSharedFallback: false,
    }) ||
    resolveConfiguredSessionWorkerUrlFromConfig(sessionConfig);
  const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
  const responseContract = resolveSessionContractRef({ sessionConfig, contractKey: 'surveys' });
  const identityParts = [
    slug,
    networkId,
    sessionId,
    workerUrl,
    String(sessionConfig.metadataURI || ''),
    String(sessionModeProfile.preset || ''),
    String(sessionAuthority.mode || ''),
    String(sessionStorage.backend || storageProfile.backend || ''),
    String(storageResources.questions || ''),
    String(storageResources.surveys || ''),
    String(storageResources.responses || ''),
    String(responseContract.address || '').toLowerCase(),
    String(responseContract.chainId || ''),
  ];
  return identityParts.join('|');
};

/** The session identity plus the signed-in account. */
export const buildSessionInterviewActiveSubmitContextToken = (
  engine: SurveyQuestionsRuntimeEngine,
  baseToken: string,
) =>
  [
    baseToken,
    String(engine.props.account || '')
      .trim()
      .toLowerCase(),
    String(Boolean(engine.props.loginComplete)),
  ].join('|');

const readActiveSubmitContextToken = (engine: SurveyQuestionsRuntimeEngine) =>
  buildSessionInterviewActiveSubmitContextToken(engine, buildSessionInterviewSubmitContextToken(engine.props));

const mergeSavedAnswersIntoForm = async (
  engine: SurveyQuestionsRuntimeEngine,
  questionIds: string[],
  saved: InterviewSavedSlice,
  isCurrent: () => boolean,
  userAnswers?: SurveyQuestionsRuntimeEngine['state']['userAnswers'],
) => {
  const props = engine.props;
  const sliceIndex = props.isStandalone || props.singleQuestionMode ? 0 : Number(props.surveyIndex || 0);
  await new Promise<void>((resolve) =>
    engine.setState((previous: SurveyQuestionsRuntimeEngine['state']) => {
      if (!isCurrent()) return null;
      const merged = mergeInterviewSavedAnswerBaseline(
        previous.surveysResponseState?.[sliceIndex],
        previous.editBaseline,
        saved,
        questionIds,
        {
          normalizeQuestionIdKey,
          valuesEqual: engine.valuesEqual,
          ratingEnvelopeQids: buildRatingEnvelopeQidSetFromUserAnswers(previous.userAnswers),
          getDefaultResponseEncryptionAudience: engine.getDefaultResponseEncryptionAudience,
          normalizeResponseEncryptionAudience: engine.normalizeResponseEncryptionAudience,
          getDefaultResponseEncryptionAudienceForQid: engine.getDefaultResponseEncryptionAudienceForQid,
          resolveFieldEncryptionGateId: engine.resolveFieldEncryptionGateId,
          normalizeFieldAudienceMode: engine.normalizeFieldAudienceMode,
        },
      );
      const surveysResponseState = [...(previous.surveysResponseState || [])];
      surveysResponseState[sliceIndex] = merged.slice;
      return { ...(userAnswers ? { userAnswers } : {}), editBaseline: merged.baseline, surveysResponseState };
    }, resolve),
  );
  if (!isCurrent()) throw new Error('The signed-in account or session changed.');
  questionIds.forEach((id) => engine._savedAnswersLoadedQids?.add(normalizeQuestionIdKey(id)));
};

const savedInterviewAnswers = new WeakMap<object, { key: string; userAnswers: unknown; slice: RecordValue }>();

// The person's saved answers and comments for these questions: their own saved-answer reads
// over the response cache. Rebuilt only when either changes.
const readSavedInterviewAnswers = (engine: SurveyQuestionsRuntimeEngine, questionIds: string[]) => {
  const { props, state } = engine;
  const key = JSON.stringify([
    props.account,
    resolveEffectiveSlug(props),
    props.questionsCacheNonce,
    props.questionResponsesNonce,
    questionIds,
  ]);
  const memo = savedInterviewAnswers.get(engine);
  if (memo && memo.key === key && memo.userAnswers === state.userAnswers) return memo.slice;
  const cached = readPlainRecord(engine.buildSliceFromLocalCache?.(questionIds));
  const own = readPlainRecord(state.userAnswers ? engine.buildSliceFromUserAnswers(state.userAnswers) : null);
  const slice = Object.fromEntries(
    ['answers', 'additionalComments'].map((field) => [
      field,
      { ...readPlainRecord(cached[field]), ...readPlainRecord(own[field]) },
    ]),
  );
  savedInterviewAnswers.set(engine, { key, userAnswers: state.userAnswers, slice });
  return slice;
};

/**
 * The person's answers as the interview reads them. The form holds only the pile's card window,
 * so a question with no answer there takes the saved one. Comments are only shown, so one the
 * person cleared stays cleared.
 */
export const buildSessionInterviewResponseSlice = (engine: SurveyQuestionsRuntimeEngine, questionIds: string[]) => {
  const form = readPlainRecord(engine.state.surveysResponseState?.[0]);
  const saved = readSavedInterviewAnswers(engine, questionIds);
  const answers = { ...readPlainRecord(form.answers) };
  for (const [id, entry] of Object.entries(readPlainRecord(saved.answers))) {
    if (!hasMeaningfulFieldValue(readPlainRecord(answers[id]))) answers[id] = entry;
  }
  return {
    ...form,
    answers,
    additionalComments: { ...readPlainRecord(saved.additionalComments), ...readPlainRecord(form.additionalComments) },
  };
};

/** Imported questions can sit outside the pile's hydrated card window. */
export const ensureSessionInterviewCachedAnswers = async (
  engine: SurveyQuestionsRuntimeEngine,
  questionIds: string[],
) => {
  if (!engine.props.isResponsesCacheReady || !engine.buildSliceFromLocalCache) return;
  const unloaded = questionIds.filter((id) => !engine._savedAnswersLoadedQids?.has(normalizeQuestionIdKey(id)));
  if (!unloaded.length) return;
  const token = readActiveSubmitContextToken(engine);
  const saved = engine.buildSliceFromLocalCache(unloaded);
  if (!saved) return;
  // Load before the draft marks an answer as edited. The merge keeps deliberate
  // pending field edits (including clears), while restoring omitted saved fields.
  await mergeSavedAnswersIntoForm(engine, unloaded, saved, () => token === readActiveSubmitContextToken(engine));
};

export const loadSessionInterviewOwnAnswers = async (
  engine: SurveyQuestionsRuntimeEngine,
  questionIds: string[],
  signal: AbortSignal,
): Promise<InterviewSavedSlice | null> => {
  const props = engine.props;
  const token = readActiveSubmitContextToken(engine);
  const isCurrent = () => !signal.aborted && token === readActiveSubmitContextToken(engine);
  const responses = await loadSessionInterviewSavedAnswers({
    questionIds,
    account: String(props.account || '')
      .trim()
      .toLowerCase(),
    provider: props.provider,
    sessionSlug: resolveEffectiveSlug(props),
    sessionConfig: props.sessionConfig || {},
    signal,
  });
  if (!isCurrent()) throw new Error('The signed-in account or session changed.');
  if (responses === null) return null;
  const userAnswers = { responses };
  const saved = engine.buildSliceFromUserAnswers(userAnswers);
  await mergeSavedAnswersIntoForm(engine, questionIds, saved, isCurrent, userAnswers);
  return saved || { answers: {}, additionalComments: {}, importance: {}, conviction: {} };
};

export type OwnAnswerReadOutcome =
  { status: 'ready' } | { status: 'pending' | 'failed'; message: string } | { status: 'stale' };

/**
 * The pre-upload gate shared by the pile and the full editor. While a session's
 * response listing is incomplete, an upload must first read the responder's own
 * saved answers, so an edit can never replace saved fields this browser has not seen.
 */
export const readOwnAnswersBeforeUpload = async (
  engine: SurveyQuestionsRuntimeEngine,
  listQuestionIds: () => string[],
  signal: AbortSignal,
): Promise<OwnAnswerReadOutcome> => {
  const token = readActiveSubmitContextToken(engine);
  const isCurrent = () =>
    engine._isMounted !== false && !signal.aborted && token === readActiveSubmitContextToken(engine);
  const questionIds = listQuestionIds();
  try {
    // A capped public listing cannot prove that a blank answer is new. The
    // strict own read covers all submitted fields and preserves edits.
    const saved = await loadSessionInterviewOwnAnswers(engine, questionIds, signal);
    if (!isCurrent()) return { status: 'stale' };
    if (saved === null || listQuestionIds().some((id) => !questionIds.includes(id))) {
      return {
        status: 'pending',
        message: 'Your saved answers are still loading. Try Submit again when the sync completes.',
      };
    }
    return { status: 'ready' };
  } catch {
    if (!isCurrent()) return { status: 'stale' };
    return { status: 'failed', message: 'Could not load your saved answers. Try Submit again to retry.' };
  }
};

/** Question ids an upload can touch: the listed questions plus every edited slice key. */
export const collectSubmitQuestionIds = (
  questions: Array<{ id?: unknown }> | null | undefined,
  slice: RecordValue | null | undefined,
) => [
  ...new Set(
    [
      ...(Array.isArray(questions) ? questions.map((question) => question?.id) : []),
      ...['answers', 'additionalComments', 'importance', 'conviction', 'interviewProvenance'].flatMap((key) =>
        Object.keys(readPlainRecord(readPlainRecord(slice)[key])),
      ),
    ]
      .map((id) => normalizeQuestionIdKey(id))
      .filter(Boolean),
  ),
];
