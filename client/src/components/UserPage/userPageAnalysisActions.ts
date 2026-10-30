import type UserPage from './UserPage';
import { analyzeUserOpinions } from 'utilities/ai/aiClient.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { getGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import { createLogger } from 'utilities/logging.js';
import {
  buildUserPageAnalysisSbts,
  buildUserPageAnalysisQuestions,
  buildUserPageAnalysisSurveys,
  buildUserPageAnalysisCreatedQuestions,
  readUserPageAnalysisCreatedSurveyCachesThroughPort,
  buildUserPageAnalysisCreatedSurveys,
  buildUserPageAnalysisCacheReadDescriptor,
  buildUserPageAnalysisResetStatePatch,
  buildUserPageAnalysisAiOptions,
  getUserPageErrorMessage,
  normalizeUserAnalysisResult,
  buildUserPageAnalysisResultStatePatch,
  buildUserPageAnalysisErrorStatePatch,
  buildUserPageAnalysisErrorPresentation,
} from './userPageHelpers';

const accountLog = createLogger('account');
type CacheContext = Awaited<ReturnType<UserPage['_buildAnalysisCacheContext']>>;
type ProfileRecord = Record<string, unknown>;
export const analysisProfileKey = (props: ProfileRecord): string => {
  const network = props.network as { id?: unknown; chainId?: unknown } | undefined;
  const config = props.sessionConfig as { sessionId?: unknown; corsWorkerUrl?: unknown } | undefined;
  return JSON.stringify([
    String(props.viewAddress || '')
      .trim()
      .toLowerCase(),
    props.activeSessionSlug ?? '',
    props.sessionSlug ?? '',
    props.onChainProfileEnabled === false ? 'worker' : (network?.id ?? network?.chainId ?? props.networkChainId ?? ''),
    config?.sessionId ?? '',
    config?.corsWorkerUrl ?? '',
  ]);
};
export const analysisInputSignature = (state: ProfileRecord): string =>
  JSON.stringify([
    state.username,
    state.sbtList,
    state.questionResponseInfo,
    state.detailedQuestionResponses,
    state.surveyResponseInfo,
    state.detailedSurveyResponses,
    state.questionCreationInfo,
    state.surveyCreationInfo,
  ]);
type AnalysisOwner = {
  profileKey: string;
  inputSignature: string;
  fingerprint: string;
  sessionSlug: string;
  addressLower: string;
  networkId: string;
  generation: number;
};
const owners = new WeakMap<UserPage, AnalysisOwner>();
let requestGeneration = 0;
export const invalidateUserAnalysis = (page: UserPage, closeModal: boolean): void => {
  const hadOwner = owners.delete(page);
  if (!hadOwner && !closeModal) return;
  page.clearAnalysisTimer();
  if (page._isMounted) {
    page.setState({ ...buildUserPageAnalysisResetStatePatch(), ...(closeModal ? { showAnalysisModal: false } : {}) });
  }
};

export async function analyzeUser(this: UserPage, forceRefresh = false): Promise<void> {
  if (!this._isMounted) return;

  const owner: AnalysisOwner = {
    profileKey: analysisProfileKey(this.props),
    inputSignature: analysisInputSignature(this.state),
    fingerprint: '',
    sessionSlug: '',
    addressLower: '',
    networkId: '',
    generation: ++requestGeneration,
  };
  owners.set(this, owner);
  const isCurrent = (): boolean =>
    this._isMounted &&
    owners.get(this)?.generation === owner.generation &&
    analysisProfileKey(this.props) === owner.profileKey &&
    analysisInputSignature(this.state) === owner.inputSignature;
  this.clearAnalysisTimer();

  // --- Assemble inputs strictly from current state (already hydrated from other caches) ---
  const sbts = buildUserPageAnalysisSbts({
    getSbtDisplayName,
    sbtList: this.state.sbtList,
  });

  // Question-level responses (all types; only visible)
  const questions = buildUserPageAnalysisQuestions({
    detailedQuestionResponses: this.state.detailedQuestionResponses,
    questionResponseInfo: this.state.questionResponseInfo,
  });

  // Survey-level summaries + samples of answered items (with types & additional comments)
  const surveys = buildUserPageAnalysisSurveys({
    detailedSurveyResponses: this.state.detailedSurveyResponses,
    surveyResponseInfo: this.state.surveyResponseInfo,
  });

  // Created content (counts + actual items)
  const questionsCreated = buildUserPageAnalysisCreatedQuestions(this.state.questionCreationInfo);

  // For surveys the user created, include title + a small sample of question prompts/types
  let surveysCreated: unknown[] = [];
  try {
    const networkID = this.props.network?.id?.toString();
    const slug = this.props.activeSessionSlug == null ? '' : this.props.activeSessionSlug;
    const createdSurveyCacheRead = readUserPageAnalysisCreatedSurveyCachesThroughPort({
      networkID,
      peekCache: peekCacheSync,
      sessionSlug: slug,
    });
    if (createdSurveyCacheRead.status === 'error') {
      throw createdSurveyCacheRead.error;
    }
    surveysCreated = buildUserPageAnalysisCreatedSurveys({
      networkID: createdSurveyCacheRead.networkID,
      questionsCache: createdSurveyCacheRead.questionsCache,
      surveyCreationInfo: this.state.surveyCreationInfo,
      surveysCache: createdSurveyCacheRead.surveysCache,
    });
  } catch (e) {
    accountLog.warn('UserPage: fallback', e);
  }

  const createdCounts = {
    questionsCreated: questionsCreated.length,
    surveysCreated: surveysCreated.length,
  };

  const userData = {
    address: this.props.viewAddress,
    username: this.state.username || null,
    sbts,
    questions,
    surveys,
    // NEW: created content + explicit counts
    questionsCreated,
    surveysCreated,
    createdCounts,
  };
  const addressLower = String(this.props.viewAddress || '')
    .trim()
    .toLowerCase();
  // Hosted profiles have no chain ID; keep their cache independent of the connected wallet's network.
  const networkId =
    this.props.onChainProfileEnabled === false
      ? 'worker'
      : String(this.props.network?.id ?? this.props.network?.chainId ?? '');
  owner.addressLower = addressLower;
  owner.networkId = networkId;
  const hydrateAnalysisCacheIfPresent = (cacheContextToRead: CacheContext): boolean => {
    const cacheReadDescriptor = buildUserPageAnalysisCacheReadDescriptor({
      sessionSlug: cacheContextToRead.sessionSlug,
      networkId,
      addressLower,
      fingerprint: cacheContextToRead.fingerprint,
      forceRefresh,
    });
    if (cacheReadDescriptor.action !== 'read') return false;
    const cachedEntry = this._readAnalysisCacheEntry(cacheReadDescriptor);
    if (!cachedEntry) return false;
    if (!isCurrent()) return true;
    this._hydrateAnalysisFromCache(cachedEntry, isCurrent);
    return true;
  };

  try {
    this.setState(buildUserPageAnalysisResetStatePatch());

    const analysisSession = await this.resolveAnalysisSessionContext();
    if (!isCurrent()) return;
    if (!analysisSession?.sessionConfig) {
      throw new Error('No valid AI session configuration available for this profile context.');
    }
    let cacheContext = await this._buildAnalysisCacheContext({
      userData,
      analysisSession,
      addressLower,
      networkId,
    });
    if (!isCurrent()) return;
    owner.fingerprint = cacheContext.fingerprint;
    owner.sessionSlug = cacheContext.sessionSlug;
    if (hydrateAnalysisCacheIfPresent(cacheContext)) return;

    if (!isCurrent()) return;
    this.setState(() => (isCurrent() ? buildUserPageAnalysisResetStatePatch({ analyzing: true }) : null));
    this.startAnalysisTimer(isCurrent);

    const analysisAiContext = {
      account: String(this.props.account || ''),
      providerLike: this.props.provider,
      chainId: this.props.network?.id ?? this.props.networkChainId ?? null,
      lit: getGlobalLitHooks(),
    };
    const aiOptions = buildUserPageAnalysisAiOptions({
      analysisSession,
      context: analysisAiContext,
    });
    let result;
    try {
      result = await analyzeUserOpinions(userData, aiOptions);
    } catch (err: unknown) {
      if (!isCurrent()) return;
      const isGateUnavailable = /on-chain gate data unavailable/i.test(getUserPageErrorMessage(err, ''));
      if (!isGateUnavailable) throw err;
      accountLog.warn('[UserPage] gate data unavailable for session, trying fallback', {
        failedSlug: analysisSession.slug,
        gateStatus: analysisSession.status,
      });
      const fallbackSession = await this.resolveAnalysisSessionContext([analysisSession.slug]);
      if (!isCurrent()) return;
      if (!fallbackSession?.sessionConfig) throw err;
      cacheContext = await this._buildAnalysisCacheContext({
        userData,
        analysisSession: fallbackSession,
        addressLower,
        networkId,
      });
      if (!isCurrent()) return;
      owner.fingerprint = cacheContext.fingerprint;
      owner.sessionSlug = cacheContext.sessionSlug;
      if (hydrateAnalysisCacheIfPresent(cacheContext)) return;
      const fallbackOpts = buildUserPageAnalysisAiOptions({
        analysisSession: fallbackSession,
        context: analysisAiContext,
        defaultReason: 'fallback-gate-unavailable',
      });
      result = await analyzeUserOpinions(userData, fallbackOpts);
    }
    // Cache writes retain the captured owner even after its view is gone.
    // Update UI
    const normalizedResult = normalizeUserAnalysisResult(result);
    if (isCurrent()) {
      this.setState(() =>
        isCurrent()
          ? buildUserPageAnalysisResultStatePatch({
              result: normalizedResult,
              servedFromCache: false,
            })
          : null,
      );
      this.clearAnalysisTimer();
    }
    try {
      await this._writeAnalysisCacheEntry({
        sessionSlug: cacheContext.sessionSlug,
        networkId,
        addressLower,
        fingerprint: cacheContext.fingerprint,
        aiContext: cacheContext.aiContext,
        result: normalizedResult,
      });
    } catch (cacheError) {
      accountLog.warn('[UserPage] analysis cache write failed:', cacheError);
    }
  } catch (e) {
    accountLog.error('[UserPage] analyzeUser failed:', e);
    if (!isCurrent()) return;
    this.setState(() =>
      isCurrent()
        ? buildUserPageAnalysisErrorStatePatch({
            ...buildUserPageAnalysisErrorPresentation(e),
          })
        : null,
    );
    this.clearAnalysisTimer();
  }
}
