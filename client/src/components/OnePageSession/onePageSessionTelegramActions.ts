import type {
  AgentClientLoginEnvelope,
  clearAgentClientLoginEnvelope,
  readAgentClientLoginEnvelope,
} from '../../utilities/session/agentClientLogin';
import type {
  envelopeAllowsSubmit,
  loadQuestions,
  loadResultsDataset,
  submitAnswer,
  TelegramAnswerInput,
  TelegramResultsDataset,
} from '../../utilities/session/telegramSessionBackend';
import type { isTelegramAgentAuthFailure, TelegramAgentQuestion } from '../../utilities/session/telegramAgentData';
import type { TelegramSessionMeta } from '../../utilities/session/sessionBackendKind';
import {
  buildTelegramAuthFailureState,
  buildTelegramDataResetState,
  clearTelegramEnvelopeMemoryCache,
  getAgentClientLoginEnvelopeMemoryKey,
  resolveAgentClientLoginIdentityTarget,
  resolveAgentClientLoginEnvelopeFromEvent,
  resolveTelegramResultsAuthFailureReason,
} from './onePageSessionTelegramController';

export type OnePageSessionTelegramState = {
  telegramAgentAnswerState: unknown;
  telegramAgentQuestions: TelegramAgentQuestion[];
  telegramAgentQuestionsStatus: string;
  telegramAgentResults: TelegramResultsDataset | null;
  telegramAgentResultsStatus: string;
  telegramClientEnvelope: AgentClientLoginEnvelope | null;
  telegramPolisDataset: TelegramResultsDataset['polisDataset'] | null;
  telegramQuestionPileIndex: number;
  telegramQuestionSubmitError: string;
  telegramSessionMeta: TelegramSessionMeta | null;
  telegramSessionMetaStatus: string;
  telegramSubmittedQuestionIds: string[];
  telegramSubmittingQuestionId: string;
};

type TelegramStatePatch = Partial<OnePageSessionTelegramState>;

export type OnePageSessionTelegramSetState = (
  patch: TelegramStatePatch | ((prev: Readonly<OnePageSessionTelegramState>) => TelegramStatePatch),
  callback?: () => void,
) => void;

export type OnePageSessionTelegramActionPorts = {
  clearStoredEnvelope: typeof clearAgentClientLoginEnvelope;
  envelopeAllowsSubmit: typeof envelopeAllowsSubmit;
  fetchImpl: typeof fetch;
  isAuthFailure: typeof isTelegramAgentAuthFailure;
  loadQuestions: typeof loadQuestions;
  loadResultsDataset: typeof loadResultsDataset;
  readStoredEnvelope: typeof readAgentClientLoginEnvelope;
  submitAnswer: typeof submitAnswer;
};

export type OnePageSessionTelegramActionDeps = {
  getState: () => OnePageSessionTelegramState;
  isTelegramBackendMode: (sessionConfig?: unknown) => boolean;
  ports: OnePageSessionTelegramActionPorts;
  resolveCurrentSessionConfig: () => unknown;
  resolveCurrentSessionSlug: () => string;
  resolveTelegramAgentBridgeUrl: (sessionConfig?: unknown) => string;
  setState: OnePageSessionTelegramSetState;
};

export type OnePageSessionTelegramActions = {
  bootstrapTelegramSession: () => void;
  clearTelegramEnvelopeMemoryCache: (sessionSlug?: unknown) => void;
  disposeTelegramActions: () => void;
  handleAgentClientLoginEvent: (event: CustomEvent<unknown>) => void;
  handleTelegramAuthFailure: (reason?: unknown) => void;
  handleTelegramComponentDidUpdate: (args: { loginJustCompleted: boolean; slugChanged: boolean }) => void;
  handleTelegramLogout: () => void;
  handleTelegramQuestionSubmit: (question: TelegramAgentQuestion, answer: TelegramAnswerInput) => Promise<void>;
  loadTelegramAgentData: (force?: boolean) => Promise<unknown[]>;
  loadTelegramAgentQuestions: (force?: boolean) => Promise<unknown>;
  loadTelegramAgentResults: (force?: boolean) => Promise<TelegramResultsDataset | null>;
  loadTelegramSessionMeta: () => Promise<TelegramSessionMeta | null>;
  restoreTelegramEnvelopeFromStorage: () => AgentClientLoginEnvelope | null;
};

export const buildInitialTelegramState = (
  sessionSlug: unknown,
  readStoredEnvelope: typeof readAgentClientLoginEnvelope,
): OnePageSessionTelegramState => ({
  telegramClientEnvelope: readStoredEnvelope(sessionSlug),
  telegramSessionMeta: null,
  telegramSessionMetaStatus: 'idle',
  telegramAgentQuestionsStatus: 'idle',
  telegramAgentQuestions: [],
  telegramAgentAnswerState: null,
  telegramQuestionPileIndex: 0,
  telegramSubmittingQuestionId: '',
  telegramSubmittedQuestionIds: [],
  telegramQuestionSubmitError: '',
  telegramAgentResultsStatus: 'idle',
  telegramAgentResults: null,
  telegramPolisDataset: null,
});

export const createOnePageSessionTelegramActions = ({
  getState,
  isTelegramBackendMode,
  ports,
  resolveCurrentSessionConfig,
  resolveCurrentSessionSlug,
  resolveTelegramAgentBridgeUrl,
  setState,
}: OnePageSessionTelegramActionDeps): OnePageSessionTelegramActions => {
  const resolveCurrentIdentityTarget = () =>
    resolveAgentClientLoginIdentityTarget({
      sessionConfig: resolveCurrentSessionConfig(),
      sessionSlug: resolveCurrentSessionSlug(),
    });

  type RequestChannel = 'meta' | 'questions' | 'results' | 'submit';
  type RequestSnapshot = { channel: RequestChannel; generation: number; identityKey: string };
  const requestGenerations: Record<RequestChannel, number> = {
    meta: 0,
    questions: 0,
    results: 0,
    submit: 0,
  };
  let disposed = false;
  const resolveCurrentIdentityKey = () => getAgentClientLoginEnvelopeMemoryKey(resolveCurrentIdentityTarget());
  const beginRequest = (channel: RequestChannel): RequestSnapshot => ({
    channel,
    generation: ++requestGenerations[channel],
    identityKey: resolveCurrentIdentityKey(),
  });
  const isRequestCurrent = (snapshot: RequestSnapshot): boolean =>
    !disposed &&
    requestGenerations[snapshot.channel] === snapshot.generation &&
    resolveCurrentIdentityKey() === snapshot.identityKey;
  const invalidateTelegramRequests = (): void => {
    (Object.keys(requestGenerations) as RequestChannel[]).forEach((channel) => {
      requestGenerations[channel] += 1;
    });
  };
  const disposeTelegramActions = (): void => {
    disposed = true;
    invalidateTelegramRequests();
  };

  const restoreTelegramEnvelopeFromStorage = (): AgentClientLoginEnvelope | null => {
    if (disposed) return null;
    const envelope = ports.readStoredEnvelope(resolveCurrentIdentityTarget());
    const state = getState();
    const currentToken = state.telegramClientEnvelope?.bridgeCredential?.token || '';
    const nextToken = envelope?.bridgeCredential?.token || '';
    if (currentToken !== nextToken || state.telegramClientEnvelope?.sessionSlug !== envelope?.sessionSlug) {
      setState({ telegramClientEnvelope: envelope });
    }
    return envelope;
  };

  const loadTelegramSessionMeta = async (): Promise<TelegramSessionMeta | null> => {
    if (disposed) return null;
    const sessionSlug = resolveCurrentSessionSlug();
    const sessionConfig = resolveCurrentSessionConfig();
    const agentBridgeUrl = resolveTelegramAgentBridgeUrl(sessionConfig);
    if (!sessionSlug || !agentBridgeUrl) return null;
    const requestSnapshot = beginRequest('meta');
    setState({ telegramSessionMetaStatus: 'loading' });
    try {
      const url = new URL(`${agentBridgeUrl}/api/agent/session-meta`);
      url.searchParams.set('sessionSlug', sessionSlug);
      const response = await ports.fetchImpl(url.toString(), { method: 'GET', cache: 'no-store' });
      const body = (await response.json().catch(() => null)) as TelegramSessionMeta | null;
      if (!isRequestCurrent(requestSnapshot)) return null;
      if (!response.ok || !body || body.ok === false) {
        setState({ telegramSessionMetaStatus: 'error' });
        return null;
      }
      setState({
        telegramSessionMeta: body,
        telegramSessionMetaStatus: 'ready',
      });
      return body;
    } catch (_) {
      if (!isRequestCurrent(requestSnapshot)) return null;
      setState({ telegramSessionMetaStatus: 'error' });
      return null;
    }
  };

  const handleTelegramAuthFailure = (reason: unknown = ''): void => {
    if (disposed) return;
    invalidateTelegramRequests();
    const sessionSlug = resolveCurrentSessionSlug();
    ports.clearStoredEnvelope(resolveCurrentIdentityTarget());
    clearTelegramEnvelopeMemoryCache(sessionSlug);
    setState(buildTelegramAuthFailureState(reason));
  };

  const handleAgentClientLoginEvent = (event: CustomEvent<unknown>): void => {
    if (disposed) return;
    const envelope = resolveAgentClientLoginEnvelopeFromEvent(event, resolveCurrentIdentityTarget());
    if (!envelope) return;
    invalidateTelegramRequests();
    setState({ telegramClientEnvelope: envelope }, () => {
      void loadTelegramAgentData(true);
    });
  };

  const loadTelegramAgentQuestions = async (force = false): Promise<unknown> => {
    if (disposed) return null;
    const sessionConfig = resolveCurrentSessionConfig();
    if (!isTelegramBackendMode(sessionConfig)) return null;
    const state = getState();
    const envelope = state.telegramClientEnvelope || restoreTelegramEnvelopeFromStorage();
    if (!envelope) return null;
    if (!force && state.telegramAgentQuestionsStatus === 'loading') return null;
    const requestSnapshot = beginRequest('questions');
    setState({ telegramAgentQuestionsStatus: 'loading', telegramQuestionSubmitError: '' });
    const result = await ports.loadQuestions({
      envelope,
      agentBridgeUrl: resolveTelegramAgentBridgeUrl(sessionConfig),
    });
    if (!isRequestCurrent(requestSnapshot)) return result;
    if (!result.ok) {
      if (ports.isAuthFailure({ status: result.status, reason: result.reason })) {
        handleTelegramAuthFailure(result.reason);
      } else {
        setState({
          telegramAgentQuestionsStatus: 'error',
          telegramQuestionSubmitError: result.reason || 'Could not load Telegram questions.',
        });
      }
      return result;
    }
    setState({
      telegramAgentQuestionsStatus: 'ready',
      telegramAgentQuestions: result.questions || [],
      telegramAgentAnswerState: result.answerState || null,
      telegramQuestionPileIndex: 0,
    });
    return result;
  };

  const loadTelegramAgentResults = async (force = false): Promise<TelegramResultsDataset | null> => {
    if (disposed) return null;
    const sessionConfig = resolveCurrentSessionConfig();
    if (!isTelegramBackendMode(sessionConfig)) return null;
    const state = getState();
    const envelope = state.telegramClientEnvelope || restoreTelegramEnvelopeFromStorage();
    if (!envelope) return null;
    if (!force && state.telegramAgentResultsStatus === 'loading') return null;
    const requestSnapshot = beginRequest('results');
    setState({ telegramAgentResultsStatus: 'loading' });
    const result = await ports.loadResultsDataset({
      envelope,
      agentBridgeUrl: resolveTelegramAgentBridgeUrl(sessionConfig),
    });
    if (!isRequestCurrent(requestSnapshot)) return result;
    const authFailureReason = resolveTelegramResultsAuthFailureReason(result);
    if (authFailureReason !== null) {
      handleTelegramAuthFailure(authFailureReason);
      return result;
    }
    setState({
      telegramAgentResultsStatus: 'ready',
      telegramAgentResults: result,
      telegramPolisDataset: result.polisDataset,
    });
    return result;
  };

  const loadTelegramAgentData = (force = false): Promise<unknown[]> => {
    if (disposed) return Promise.resolve([]);
    void loadTelegramSessionMeta();
    return Promise.all([loadTelegramAgentQuestions(force), loadTelegramAgentResults(force)]);
  };

  const handleTelegramQuestionSubmit = async (
    question: TelegramAgentQuestion,
    answer: TelegramAnswerInput,
  ): Promise<void> => {
    if (disposed) return;
    const state = getState();
    const envelope = state.telegramClientEnvelope;
    if (!ports.envelopeAllowsSubmit(envelope, state.telegramSessionMeta)) {
      setState({ telegramQuestionSubmitError: 'Submitting from the client is not enabled for this deployment yet.' });
      return;
    }
    const requestSnapshot = beginRequest('submit');
    setState({ telegramSubmittingQuestionId: question.questionId, telegramQuestionSubmitError: '' });
    const result = await ports.submitAnswer({
      envelope,
      agentBridgeUrl: resolveTelegramAgentBridgeUrl(),
      question,
      answer,
    });
    if (!isRequestCurrent(requestSnapshot)) return;
    if (!result.ok) {
      if (ports.isAuthFailure({ status: result.status, reason: result.reason })) {
        handleTelegramAuthFailure(result.reason);
      } else {
        setState({
          telegramSubmittingQuestionId: '',
          telegramQuestionSubmitError: result.reason || 'Could not submit this answer.',
        });
      }
      return;
    }
    setState((prev: Readonly<OnePageSessionTelegramState>) => ({
      telegramSubmittingQuestionId: '',
      telegramSubmittedQuestionIds: Array.from(
        new Set([...(prev.telegramSubmittedQuestionIds || []), question.questionId]),
      ),
    }));
    void loadTelegramAgentData(true);
  };

  const handleTelegramLogout = (): void => {
    if (disposed) return;
    invalidateTelegramRequests();
    const sessionSlug = resolveCurrentSessionSlug();
    ports.clearStoredEnvelope(resolveCurrentIdentityTarget());
    clearTelegramEnvelopeMemoryCache(sessionSlug);
    setState({
      ...buildTelegramDataResetState(),
      telegramClientEnvelope: null,
    });
  };

  const bootstrapTelegramSession = (): void => {
    if (disposed) return;
    if (!isTelegramBackendMode(resolveCurrentSessionConfig())) return;
    const envelope = restoreTelegramEnvelopeFromStorage();
    if (envelope) {
      void loadTelegramAgentData(true);
    } else {
      void loadTelegramSessionMeta();
    }
  };

  const handleTelegramComponentDidUpdate = ({
    loginJustCompleted,
    slugChanged,
  }: {
    loginJustCompleted: boolean;
    slugChanged: boolean;
  }): void => {
    if (disposed) return;
    const telegramMode = isTelegramBackendMode(resolveCurrentSessionConfig());
    if (slugChanged) {
      invalidateTelegramRequests();
      const envelope = telegramMode ? ports.readStoredEnvelope(resolveCurrentIdentityTarget()) : null;
      setState(
        {
          ...buildTelegramDataResetState(),
          telegramClientEnvelope: envelope,
          telegramSessionMeta: null,
          telegramSessionMetaStatus: 'idle',
        },
        () => {
          if (!telegramMode || disposed) return;
          if (envelope) void loadTelegramAgentData(true);
          else void loadTelegramSessionMeta();
        },
      );
    } else if (telegramMode && loginJustCompleted) {
      const envelope = restoreTelegramEnvelopeFromStorage();
      if (envelope) void loadTelegramAgentData(true);
    } else if (telegramMode && getState().telegramSessionMetaStatus === 'idle') {
      void loadTelegramSessionMeta();
    }
  };

  return {
    bootstrapTelegramSession,
    clearTelegramEnvelopeMemoryCache,
    disposeTelegramActions,
    handleAgentClientLoginEvent,
    handleTelegramAuthFailure,
    handleTelegramComponentDidUpdate,
    handleTelegramLogout,
    handleTelegramQuestionSubmit,
    loadTelegramAgentData,
    loadTelegramAgentQuestions,
    loadTelegramAgentResults,
    loadTelegramSessionMeta,
    restoreTelegramEnvelopeFromStorage,
  };
};
