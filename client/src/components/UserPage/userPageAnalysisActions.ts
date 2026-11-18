import type UserPage from './UserPage';
import { analyzeUserCard, analyzeUserOpinions, fetchAnalysisCardPicture } from 'utilities/ai/aiClient.js';
import {
  buildAnalysisCard,
  normalizeAnalysisCard,
  type AnalysisCard,
  type AnalysisCardPlace,
} from 'utilities/analysisCard/analysisCardModel';
import { publishSavedAnalysisCard, readSavedAnalysisCard } from 'utilities/analysisCard/analysisCardSaved';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';
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
    page.setState((previous: { showAnalysisModal: boolean }) => ({
      ...buildUserPageAnalysisResetStatePatch(),
      showAnalysisModal: closeModal ? false : previous.showAnalysisModal,
    }));
  }
};

const analysisAiContextOf = (page: UserPage) => ({
  account: String(page.props.account || ''),
  providerLike: page.props.provider,
  chainId: page.props.network?.id ?? page.props.networkChainId ?? null,
  lit: getGlobalLitHooks(),
});

// The card's foot names the account, this site and the session's page, as an address someone could type.
export const buildAnalysisCardPlace = ({
  own,
  account,
  sessionSlug,
}: {
  own: boolean;
  account: string;
  sessionSlug: unknown;
}): AnalysisCardPlace => {
  const slug = String(sessionSlug || '').trim();
  const host = typeof window === 'undefined' ? '' : window.location.host;
  const link = host && slug ? `${host}${buildPublicRoute(`/session/${encodeURIComponent(slug)}`)}` : host;
  return { own, link, account };
};

// The options a saved card is read with: the session the Analyze window would use, with the viewer's sign-in.
export async function resolveSavedAnalysisCardOptions(this: UserPage): Promise<ProfileRecord | null> {
  const session = await this.resolveAnalysisSessionContext();
  return session?.sessionConfig
    ? buildUserPageAnalysisAiOptions({ analysisSession: session, context: analysisAiContextOf(this) })
    : null;
}

// What the "Show this card on my page" box needs to save or withdraw my card, set when the card is shown.
type CardPublishContext = { account: string; aiOptions: ProfileRecord; isCurrent: () => boolean };
const publishContexts = new WeakMap<UserPage, CardPublishContext>();

const publishCard = async (
  page: UserPage,
  { account, aiOptions, isCurrent }: CardPublishContext,
  published: boolean,
  card: unknown,
): Promise<void> => {
  const before = page.state.analysisCardPublish?.shown !== false;
  const update = (patch: ProfileRecord): void =>
    page.setState((previous: ProfileRecord) =>
      isCurrent() && previous.analysisCardPublish
        ? { analysisCardPublish: { ...(previous.analysisCardPublish as ProfileRecord), ...patch } }
        : null,
    );
  update({ shown: published, saving: true, note: '' });
  try {
    await publishSavedAnalysisCard(account, published, card, aiOptions);
    update({ saving: false });
  } catch (error: unknown) {
    accountLog.warn('[UserPage] saved analysis card not changed:', getUserPageErrorMessage(error, ''));
    update({
      shown: before,
      saving: false,
      note: published
        ? 'The card could not be saved to your page. Try again.'
        : 'The card could not be taken off your page. Try again.',
    });
  }
};

// The box's change: save the card now shown, or withdraw my saved card.
export function setAnalysisCardShown(this: UserPage, shown: boolean): void {
  const context = publishContexts.get(this);
  const card = this.state.analysisCard;
  if (!context?.isCurrent() || this.state.analysisCardPublish?.saving || (shown && !card)) return;
  void publishCard(this, context, shown, card);
}

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
    // The name a person chose is not sent to the AI: it says nothing about their views, and is free text they control.
    address: this.props.viewAddress,
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
  const analysisAiContext = analysisAiContextOf(this);
  // The card says "my answers" on the viewer's own page and "their answers" on anyone else's. That, and what
  // its foot shows, follow who is looking now, not who first cached the analysis.
  const ownProfile = !!addressLower && analysisAiContext.account.trim().toLowerCase() === addressLower;
  const pageSlug = String(this.props.activeSessionSlug || this.props.sessionSlug || '').trim();
  const cardPlace = (sessionSlug: unknown): AnalysisCardPlace =>
    buildAnalysisCardPlace({ own: ownProfile, account: addressLower, sessionSlug: pageSlug || sessionSlug });
  // The card is made once the analysis is on screen, by two requests that run side by side: its words (from the
  // answers and the analysis) and its picture (from the figure's name alone). Neither holds the analysis up, and
  // neither failing is an error of the analysis: the card is then left out, or shown without its picture.
  // First the person's saved card is looked up: on someone else's page it is shown in place of a new one, and a
  // card they withdrew is not replaced by another; on my own page it decides the "Show this card on my page" box.
  const showAnalysisCard = (result: ProfileRecord, aiOptions: ProfileRecord, cardCache: CacheContext): void => {
    const alignment = (result.historicalAlignment || {}) as ProfileRecord;
    const figure = String(alignment.figure || '').trim();
    if (!figure || !isCurrent()) return;
    const place = cardPlace(aiOptions.sessionSlug);
    const kept = normalizeAnalysisCard(result.card);
    this.setState(() =>
      isCurrent()
        ? {
            analysisCard: null,
            analysisCardPending: true,
            analysisCardPicture: { status: 'loading' },
            analysisCardPublish: null,
            analysisCardSavedAt: null,
          }
        : null,
    );
    const showPicture = (pictureFigure: string): void => {
      fetchAnalysisCardPicture(pictureFigure, aiOptions)
        .then((picture) =>
          this.setState(() => (isCurrent() ? { analysisCardPicture: { status: 'ready', ...picture } } : null)),
        )
        .catch((pictureError: unknown) => {
          accountLog.warn('[UserPage] analysis card picture unavailable:', getUserPageErrorMessage(pictureError, ''));
          this.setState(() => (isCurrent() ? { analysisCardPicture: { status: 'none' } } : null));
        });
    };
    const writeCard = async (): Promise<AnalysisCard | null> => {
      try {
        const reply = await analyzeUserCard(
          userData,
          {
            name: result.name,
            summary: result.summary,
            details: result.details,
            figure,
            reasoning: alignment.reasoning,
          },
          aiOptions,
        );
        return buildAnalysisCard({ card: reply, historicalAlignment: alignment }, questions, place);
      } catch (cardError: unknown) {
        accountLog.warn('[UserPage] analysis card unavailable:', getUserPageErrorMessage(cardError, ''));
        return null;
      }
    };
    void readSavedAnalysisCard(addressLower, aiOptions).then(async (saved) => {
      if (!isCurrent()) return;
      if (!ownProfile && saved?.status === 'ready') {
        const card = normalizeAnalysisCard({ ...saved.card, ...place });
        if (card) showPicture(card.figure);
        this.setState(() =>
          isCurrent()
            ? {
                analysisCard: card,
                analysisCardPending: false,
                analysisCardPicture: card ? { status: 'loading' } : null,
                analysisCardSavedAt: saved.savedAt,
              }
            : null,
        );
        return;
      }
      if (!ownProfile && saved?.status === 'withdrawn') {
        this.setState(() => (isCurrent() ? { analysisCardPending: false, analysisCardPicture: null } : null));
        return;
      }
      showPicture(figure);
      // The box is ticked unless I withdrew my card. When the saved card could not be read the box is left out
      // and nothing is saved, so a "no" given on another device is never overridden.
      const publish = ownProfile && saved ? { account: addressLower, aiOptions, isCurrent } : null;
      if (publish) publishContexts.set(this, publish);
      const shown = saved?.status !== 'withdrawn';
      this.setState(() =>
        isCurrent() ? { analysisCardPublish: publish ? { shown, saving: false, note: '' } : null } : null,
      );
      const card = kept ? normalizeAnalysisCard({ ...kept, ...place }) : await writeCard();
      this.setState(() => (isCurrent() ? { analysisCard: card, analysisCardPending: false } : null));
      if (!card) return;
      // A new card replaces the saved one; a card kept with the analysis is saved only where none is.
      if (publish && shown && (!kept || saved?.status === 'none')) await publishCard(this, publish, true, card);
      if (kept) return;
      // Kept with the analysis, so reopening it does not write the card again.
      try {
        await this._writeAnalysisCacheEntry({
          sessionSlug: cardCache.sessionSlug,
          networkId,
          addressLower,
          fingerprint: cardCache.fingerprint,
          aiContext: cardCache.aiContext,
          result: { ...result, card },
        });
      } catch (cacheError: unknown) {
        accountLog.warn('[UserPage] analysis card cache write failed:', getUserPageErrorMessage(cacheError, ''));
      }
    });
  };
  const hydrateAnalysisCacheIfPresent = (cacheContextToRead: CacheContext, session: unknown): boolean => {
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
    showAnalysisCard(
      (cachedEntry.result || {}) as ProfileRecord,
      buildUserPageAnalysisAiOptions({ analysisSession: session, context: analysisAiContext }),
      cacheContextToRead,
    );
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
    if (hydrateAnalysisCacheIfPresent(cacheContext, analysisSession)) return;

    if (!isCurrent()) return;
    this.setState(() => (isCurrent() ? buildUserPageAnalysisResetStatePatch({ analyzing: true }) : null));
    this.startAnalysisTimer(isCurrent);

    let aiOptions = buildUserPageAnalysisAiOptions({
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
      if (hydrateAnalysisCacheIfPresent(cacheContext, fallbackSession)) return;
      const fallbackOpts = buildUserPageAnalysisAiOptions({
        analysisSession: fallbackSession,
        context: analysisAiContext,
        defaultReason: 'fallback-gate-unavailable',
      });
      result = await analyzeUserOpinions(userData, fallbackOpts);
      aiOptions = fallbackOpts;
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
      showAnalysisCard(normalizedResult, aiOptions, cacheContext);
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
