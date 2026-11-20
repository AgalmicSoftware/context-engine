import { analysisCardAnswersArePrivate, analysisCardOn } from '@ce-shared/analysisCardSaved.mjs';

import type UserPage from './UserPage';
import { analyzeUserCard, analyzeUserOpinions, fetchAnalysisCardPicture } from 'utilities/ai/aiClient.js';
import { analyzeUserFirstRead } from 'utilities/ai/userFirstRead';
import {
  buildAnalysisCard,
  normalizeAnalysisCard,
  type AnalysisCard,
  type AnalysisCardPlace,
} from 'utilities/analysisCard/analysisCardModel';
import {
  analysisCardAvailableFor,
  publishSavedAnalysisCard,
  readSavedAnalysisCard,
  type SavedAnalysisCardState,
} from 'utilities/analysisCard/analysisCardSaved';
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
import { buildUserPageAnalysisFirstReadStatePatch } from './userPageAnalysisStateHelpers';

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

// A saved card belongs to the session the page is about. A page with no session of its own, or an AI that would
// answer from another one (a fallback), reads and saves no card, so every visitor sees the same one.
const isPageSession = (page: UserPage, aiOptions: ProfileRecord): boolean => {
  const pageSession = String(page.props.activeSessionSlug || page.props.sessionSlug || '').trim();
  return !!pageSession && String(aiOptions.sessionSlug || '').trim() === pageSession;
};

// The options a saved card is read with: the session the Analyze window would use, with the viewer's sign-in.
export async function resolveSavedAnalysisCardOptions(this: UserPage): Promise<ProfileRecord | null> {
  const session = await this.resolveAnalysisSessionContext();
  if (!session?.sessionConfig) return null;
  const options = buildUserPageAnalysisAiOptions({ analysisSession: session, context: analysisAiContextOf(this) });
  return isPageSession(this, options) && (await analysisCardAvailableFor(options)) ? options : null;
}

// What the "Show this card on my page" box needs to save or withdraw my card, set when the card is shown. `stored`
// is what the Worker holds now, so a change that fails puts the box back to the truth.
type CardPublishContext = {
  account: string;
  aiOptions: ProfileRecord;
  isCurrent: () => boolean;
  stored: SavedAnalysisCardState['status'];
};
const publishContexts = new WeakMap<UserPage, CardPublishContext>();

const publishCard = async (
  page: UserPage,
  context: CardPublishContext,
  published: boolean,
  card: unknown,
): Promise<void> => {
  const { account, aiOptions, isCurrent } = context;
  // Only ever my card, while I am still the one signed in and still looking at it.
  const mine = (): boolean => isCurrent() && analysisAiContextOf(page).account.trim().toLowerCase() === account;
  if (!mine()) {
    // Someone else is signed in now: the box was for the account that was, so it goes.
    if (publishContexts.get(page) === context) publishContexts.delete(page);
    page.setState(() => (isCurrent() ? { analysisCardPublish: null } : null));
    return;
  }
  const update = (patch: ProfileRecord): void =>
    page.setState((previous: ProfileRecord) =>
      isCurrent() && previous.analysisCardPublish
        ? { analysisCardPublish: { ...(previous.analysisCardPublish as ProfileRecord), ...patch } }
        : null,
    );
  update({ shown: published, saving: true, note: '' });
  try {
    const state = await publishSavedAnalysisCard(account, published, card, aiOptions);
    context.stored = state.status;
    update({ shown: state.status === 'ready', saving: false });
  } catch (error: unknown) {
    const message = getUserPageErrorMessage(error, '');
    accountLog.warn('[UserPage] saved analysis card not changed:', message);
    let note = published
      ? 'The card could not be saved to your page. Try again.'
      : 'The card could not be taken off your page. Try again.';
    if (message === 'invalid_card') note = 'This card cannot be saved to your page.';
    // The session now keeps answers to their author and its admins, which this page had not heard: no card is
    // saved there, so there is nothing to tick or to try again.
    if (message === 'analysis_card_answers_private') {
      publishContexts.delete(page);
      page.setState(() => (context.isCurrent() ? { analysisCardPublish: null } : null));
      return;
    }
    update({ shown: context.stored === 'ready', saving: false, note });
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
  // Only the page's own session, read from that session's stores alone: the page's lists merge every session
  // this browser holds for the person, and none of the others may reach this session's AI, the analysis or the card.
  const readOwn = (): ReturnType<UserPage['deriveSessionSources']> | null => {
    try {
      return this.deriveSessionSources(this.props.activeSessionSlug || this.props.sessionSlug || '');
    } catch (error) {
      // A store that cannot be read is reported below as nothing to analyze, never by falling back to the page's lists.
      accountLog.error('[UserPage] session sources unreadable:', error);
      return null;
    }
  };
  const own = readOwn() || {
    sbtList: [],
    questionResponseInfo: [],
    detailedQuestionResponses: {},
    surveyResponseInfo: [],
    detailedSurveyResponses: {},
    questionCreationInfo: [],
    surveyCreationInfo: [],
  };
  const sbts = buildUserPageAnalysisSbts({
    getSbtDisplayName,
    sbtList: own.sbtList,
  });

  // Question-level responses (all types; only visible)
  const questions = buildUserPageAnalysisQuestions({
    detailedQuestionResponses: own.detailedQuestionResponses,
    questionResponseInfo: own.questionResponseInfo,
  });

  // Survey-level summaries + samples of answered items (with types & additional comments)
  const surveys = buildUserPageAnalysisSurveys({
    detailedSurveyResponses: own.detailedSurveyResponses,
    surveyResponseInfo: own.surveyResponseInfo,
  });

  // Created content (counts + actual items)
  const questionsCreated = buildUserPageAnalysisCreatedQuestions(own.questionCreationInfo);

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
      surveyCreationInfo: own.surveyCreationInfo,
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
  // A card is made only on my own page, signed in, for my own address. First the person's saved card is looked
  // up: on someone else's page it is the only card there can be, and where they saved none, or withdrew theirs,
  // there is none; on my own page it decides the "Show this card on my page" box.
  // No card is written, drawn, read, saved or shown, not even one kept with an earlier analysis.
  const leaveCardOut = (): void => {
    publishContexts.delete(this);
    this.setState(() =>
      isCurrent()
        ? {
            analysisCard: null,
            analysisCardPending: false,
            analysisCardPicture: null,
            analysisCardPublish: null,
            analysisCardSavedAt: null,
          }
        : null,
    );
  };
  // The card is left out where an admin turned it off, in the session the AI answers from or the page's own, and
  // where that session's Worker is from before the card.
  const showAnalysisCard = (result: ProfileRecord, aiOptions: ProfileRecord, cardCache: CacheContext): void => {
    // A page with no session of its own has no switch of its own: the session the AI answers from decides.
    if (pageSlug && !analysisCardOn(this._getSessionConfigForSlugExact(pageSlug))) return leaveCardOut();
    void analysisCardAvailableFor(aiOptions).then((available) => {
      if (!isCurrent()) return;
      if (available) makeAnalysisCard(result, aiOptions, cardCache);
      else leaveCardOut();
    });
  };
  const makeAnalysisCard = (result: ProfileRecord, aiOptions: ProfileRecord, cardCache: CacheContext): void => {
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
    // Set once the Worker says an admin turned the card off: nothing more of the card is then shown or saved.
    let turnedOff = false;
    const showPicture = (pictureFigure: string): void => {
      fetchAnalysisCardPicture(pictureFigure, aiOptions)
        .then((picture) =>
          this.setState(() =>
            isCurrent() && !turnedOff ? { analysisCardPicture: { status: 'ready', ...picture } } : null,
          ),
        )
        .catch((pictureError: unknown) => {
          const reason = getUserPageErrorMessage(pictureError, '');
          accountLog.warn('[UserPage] analysis card picture unavailable:', reason);
          if (reason === 'analysis_card_off') {
            turnedOff = true;
            if (isCurrent()) leaveCardOut();
            return;
          }
          this.setState(() => (isCurrent() && !turnedOff ? { analysisCardPicture: { status: 'none' } } : null));
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
    // Where the session keeps each person's answers to them and its admins, my card is made for me alone: it
    // quotes those answers, so it is not saved on my page and no box offers to (the Worker refuses it too).
    const keptToMe = ownProfile && analysisCardAnswersArePrivate(this._getSessionConfigForSlugExact(pageSlug));
    // The Worker is asked before anything is paid for. This page's copy of the session may be from before an
    // admin turned the card off, and the card's words are an ordinary AI call the Worker cannot tell from any
    // other: so when it answers that the card is off, the card is left out, words and picture unasked. It is
    // asked afresh, as what this visit remembers of the saved card may be just as old. The same request reads
    // the saved card, which counts only in the page's own session.
    void readSavedAnalysisCard(addressLower, aiOptions, { fresh: true }).then(async (answer) => {
      if (!isCurrent()) return;
      if (answer?.status === 'off') return leaveCardOut();
      const saved = isPageSession(this, aiOptions) ? answer : null;
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
      // A card is made only by its own person, signed in, for their own address. On anyone else's page there
      // is the card that person saved, shown above, or none: not one made from what this visitor can see, and
      // not one kept with an earlier analysis.
      if (!ownProfile) return leaveCardOut();
      showPicture(figure);
      // The box is ticked unless I withdrew my card. When the saved card could not be read the box is left out
      // and nothing is saved, so a "no" given on another device is never overridden.
      const publish: CardPublishContext | null =
        ownProfile && saved && !keptToMe ? { account: addressLower, aiOptions, isCurrent, stored: saved.status } : null;
      if (publish) publishContexts.set(this, publish);
      else publishContexts.delete(this);
      const shown = saved?.status !== 'withdrawn';
      this.setState(() =>
        isCurrent() ? { analysisCardPublish: publish ? { shown, saving: false, note: '' } : null } : null,
      );
      const card = kept ? normalizeAnalysisCard({ ...kept, ...place }) : await writeCard();
      if (turnedOff) return;
      this.setState(() => (isCurrent() ? { analysisCard: card, analysisCardPending: false } : null));
      if (!card) return;
      // Kept with the analysis, so reopening it does not write the card again. Started now and awaited after the
      // save: the save starts in the same moment the card appears (so the box is never ticked and idle meanwhile),
      // and a slow save never holds up the cache.
      const caching = kept
        ? null
        : (async () => {
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
          })();
      // A new card replaces the saved one; a card kept with the analysis is saved only where none is.
      if (publish && shown && (!kept || saved?.status === 'none')) await publishCard(this, publish, true, card);
      await caching;
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
    // The Analyze button counts what the page lists, which may all be from other sessions: nothing is asked of
    // the AI about a person with nothing in this one.
    if (![sbts, questions, surveys, questionsCreated, surveysCreated].some((list) => list.length > 0)) {
      throw new Error('There is nothing from this session to analyze for this account.');
    }

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
    // A quick first read from the fast model, asked beside the analysis and shown until the analysis arrives.
    // The analysis takes its place, so the two cannot contradict each other on screen. It is not kept with the
    // analysis, and when it fails or comes late there is simply none.
    void analyzeUserFirstRead(userData, aiOptions).then(
      (firstRead) =>
        this.setState((previous: ProfileRecord) =>
          isCurrent() && previous.analyzing ? buildUserPageAnalysisFirstReadStatePatch(firstRead) : null,
        ),
      (firstReadError: unknown) =>
        accountLog.warn('[UserPage] first read not shown:', getUserPageErrorMessage(firstReadError, '')),
    );
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
