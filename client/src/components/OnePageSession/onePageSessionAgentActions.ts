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
  AgentAnswerInput,
  AgentResultsDataset,
} from '../../utilities/session/agentSessionBackend';
import type { isAgentAuthFailure, AgentQuestion } from '../../utilities/session/agentSessionData';
import type { AgentSessionMeta } from '../../utilities/session/sessionBackendKind';
import {
  buildAgentAuthFailureState,
  buildAgentDataResetState,
  clearAgentEnvelopeMemoryCache,
  getAgentClientLoginEnvelopeMemoryKey,
  resolveAgentClientLoginIdentityTarget,
  resolveAgentClientLoginEnvelopeFromEvent,
  resolveAgentResultsAuthFailureReason,
} from './onePageSessionAgentController';

export type OnePageSessionAgentState = {
  agentAnswerState: unknown;
  agentQuestions: AgentQuestion[];
  agentQuestionsStatus: string;
  agentResults: AgentResultsDataset | null;
  agentResultsStatus: string;
  agentClientEnvelope: AgentClientLoginEnvelope | null;
  agentPolisDataset: AgentResultsDataset['polisDataset'] | null;
  agentQuestionPileIndex: number;
  agentQuestionSubmitError: string;
  agentSessionMeta: AgentSessionMeta | null;
  agentSessionMetaStatus: string;
  agentSubmittedQuestionIds: string[];
  agentSubmittingQuestionId: string;
};

type AgentStatePatch = Partial<OnePageSessionAgentState>;

export type OnePageSessionAgentSetState = (
  patch: AgentStatePatch | ((prev: Readonly<OnePageSessionAgentState>) => AgentStatePatch),
  callback?: () => void,
) => void;

export type OnePageSessionAgentActionPorts = {
  clearStoredEnvelope: typeof clearAgentClientLoginEnvelope;
  envelopeAllowsSubmit: typeof envelopeAllowsSubmit;
  fetchImpl: typeof fetch;
  isAuthFailure: typeof isAgentAuthFailure;
  loadQuestions: typeof loadQuestions;
  loadResultsDataset: typeof loadResultsDataset;
  readStoredEnvelope: typeof readAgentClientLoginEnvelope;
  submitAnswer: typeof submitAnswer;
};

export type OnePageSessionAgentActionDeps = {
  getState: () => OnePageSessionAgentState;
  isAgentBackendMode: (sessionConfig?: unknown) => boolean;
  ports: OnePageSessionAgentActionPorts;
  resolveCurrentSessionConfig: () => unknown;
  resolveCurrentSessionSlug: () => string;
  resolveSessionAgentBridgeUrl: (sessionConfig?: unknown) => string;
  setState: OnePageSessionAgentSetState;
};

export type OnePageSessionAgentActions = {
  bootstrapAgentSession: () => void;
  clearAgentEnvelopeMemoryCache: (sessionSlug?: unknown) => void;
  disposeAgentActions: () => void;
  handleAgentClientLoginEvent: (event: CustomEvent<unknown>) => void;
  handleAgentAuthFailure: (reason?: unknown) => void;
  handleAgentComponentDidUpdate: (args: { loginJustCompleted: boolean; slugChanged: boolean }) => void;
  handleAgentLogout: () => void;
  handleAgentQuestionSubmit: (question: AgentQuestion, answer: AgentAnswerInput) => Promise<void>;
  loadAgentData: (force?: boolean) => Promise<unknown[]>;
  loadAgentQuestions: (force?: boolean) => Promise<unknown>;
  loadAgentResults: (force?: boolean) => Promise<AgentResultsDataset | null>;
  loadAgentSessionMeta: () => Promise<AgentSessionMeta | null>;
  restoreAgentEnvelopeFromStorage: () => AgentClientLoginEnvelope | null;
};

export const buildInitialAgentState = (
  sessionSlug: unknown,
  readStoredEnvelope: typeof readAgentClientLoginEnvelope,
): OnePageSessionAgentState => ({
  agentClientEnvelope: readStoredEnvelope(sessionSlug),
  agentSessionMeta: null,
  agentSessionMetaStatus: 'idle',
  agentQuestionsStatus: 'idle',
  agentQuestions: [],
  agentAnswerState: null,
  agentQuestionPileIndex: 0,
  agentSubmittingQuestionId: '',
  agentSubmittedQuestionIds: [],
  agentQuestionSubmitError: '',
  agentResultsStatus: 'idle',
  agentResults: null,
  agentPolisDataset: null,
});

export const createOnePageSessionAgentActions = ({
  getState,
  isAgentBackendMode,
  ports,
  resolveCurrentSessionConfig,
  resolveCurrentSessionSlug,
  resolveSessionAgentBridgeUrl,
  setState,
}: OnePageSessionAgentActionDeps): OnePageSessionAgentActions => {
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
  const invalidateAgentRequests = (): void => {
    (Object.keys(requestGenerations) as RequestChannel[]).forEach((channel) => {
      requestGenerations[channel] += 1;
    });
  };
  const disposeAgentActions = (): void => {
    disposed = true;
    invalidateAgentRequests();
  };

  const restoreAgentEnvelopeFromStorage = (): AgentClientLoginEnvelope | null => {
    if (disposed) return null;
    const envelope = ports.readStoredEnvelope(resolveCurrentIdentityTarget());
    const state = getState();
    const currentToken = state.agentClientEnvelope?.bridgeCredential?.token || '';
    const nextToken = envelope?.bridgeCredential?.token || '';
    if (currentToken !== nextToken || state.agentClientEnvelope?.sessionSlug !== envelope?.sessionSlug) {
      setState({ agentClientEnvelope: envelope });
    }
    return envelope;
  };

  const loadAgentSessionMeta = async (): Promise<AgentSessionMeta | null> => {
    if (disposed) return null;
    const sessionSlug = resolveCurrentSessionSlug();
    const sessionConfig = resolveCurrentSessionConfig();
    const agentBridgeUrl = resolveSessionAgentBridgeUrl(sessionConfig);
    if (!sessionSlug || !agentBridgeUrl) return null;
    const requestSnapshot = beginRequest('meta');
    setState({ agentSessionMetaStatus: 'loading' });
    try {
      const url = new URL(`${agentBridgeUrl}/api/agent/session-meta`);
      url.searchParams.set('sessionSlug', sessionSlug);
      // Native browser fetch rejects the ports object as its receiver.
      const fetchImpl = ports.fetchImpl;
      const response = await fetchImpl(url.toString(), { method: 'GET', cache: 'no-store' });
      const body = (await response.json().catch(() => null)) as AgentSessionMeta | null;
      if (!isRequestCurrent(requestSnapshot)) return null;
      if (!response.ok || !body || body.ok === false) {
        setState({ agentSessionMetaStatus: 'error' });
        return null;
      }
      setState({
        agentSessionMeta: body,
        agentSessionMetaStatus: 'ready',
      });
      return body;
    } catch (_) {
      if (!isRequestCurrent(requestSnapshot)) return null;
      setState({ agentSessionMetaStatus: 'error' });
      return null;
    }
  };

  const handleAgentAuthFailure = (reason: unknown = ''): void => {
    if (disposed) return;
    invalidateAgentRequests();
    const sessionSlug = resolveCurrentSessionSlug();
    ports.clearStoredEnvelope(resolveCurrentIdentityTarget());
    clearAgentEnvelopeMemoryCache(sessionSlug);
    setState(buildAgentAuthFailureState(reason));
  };

  const handleAgentClientLoginEvent = (event: CustomEvent<unknown>): void => {
    if (disposed) return;
    const envelope = resolveAgentClientLoginEnvelopeFromEvent(event, resolveCurrentIdentityTarget());
    if (!envelope) return;
    invalidateAgentRequests();
    setState({ agentClientEnvelope: envelope }, () => {
      void loadAgentData(true);
    });
  };

  const loadAgentQuestions = async (force = false): Promise<unknown> => {
    if (disposed) return null;
    const sessionConfig = resolveCurrentSessionConfig();
    if (!isAgentBackendMode(sessionConfig)) return null;
    const state = getState();
    const envelope = state.agentClientEnvelope || restoreAgentEnvelopeFromStorage();
    if (!envelope) return null;
    if (!force && state.agentQuestionsStatus === 'loading') return null;
    const requestSnapshot = beginRequest('questions');
    setState({ agentQuestionsStatus: 'loading', agentQuestionSubmitError: '' });
    const result = await ports.loadQuestions({
      envelope,
      agentBridgeUrl: resolveSessionAgentBridgeUrl(sessionConfig),
    });
    if (!isRequestCurrent(requestSnapshot)) return result;
    if (!result.ok) {
      if (ports.isAuthFailure({ status: result.status, reason: result.reason })) {
        handleAgentAuthFailure(result.reason);
      } else {
        setState({
          agentQuestionsStatus: 'error',
          agentQuestionSubmitError: result.reason || 'Could not load Agent questions.',
        });
      }
      return result;
    }
    setState({
      agentQuestionsStatus: 'ready',
      agentQuestions: result.questions || [],
      agentAnswerState: result.answerState || null,
      agentQuestionPileIndex: 0,
    });
    return result;
  };

  const loadAgentResults = async (force = false): Promise<AgentResultsDataset | null> => {
    if (disposed) return null;
    const sessionConfig = resolveCurrentSessionConfig();
    if (!isAgentBackendMode(sessionConfig)) return null;
    const state = getState();
    const envelope = state.agentClientEnvelope || restoreAgentEnvelopeFromStorage();
    if (!envelope) return null;
    if (!force && state.agentResultsStatus === 'loading') return null;
    const requestSnapshot = beginRequest('results');
    setState({ agentResultsStatus: 'loading' });
    const result = await ports.loadResultsDataset({
      envelope,
      agentBridgeUrl: resolveSessionAgentBridgeUrl(sessionConfig),
    });
    if (!isRequestCurrent(requestSnapshot)) return result;
    const authFailureReason = resolveAgentResultsAuthFailureReason(result);
    if (authFailureReason !== null) {
      handleAgentAuthFailure(authFailureReason);
      return result;
    }
    setState({
      agentResultsStatus: 'ready',
      agentResults: result,
      agentPolisDataset: result.polisDataset,
    });
    return result;
  };

  const loadAgentData = (force = false): Promise<unknown[]> => {
    if (disposed) return Promise.resolve([]);
    void loadAgentSessionMeta();
    return Promise.all([loadAgentQuestions(force), loadAgentResults(force)]);
  };

  const handleAgentQuestionSubmit = async (question: AgentQuestion, answer: AgentAnswerInput): Promise<void> => {
    if (disposed) return;
    const state = getState();
    const envelope = state.agentClientEnvelope;
    if (!ports.envelopeAllowsSubmit(envelope, state.agentSessionMeta)) {
      setState({ agentQuestionSubmitError: 'Submitting from the client is not enabled for this deployment yet.' });
      return;
    }
    const requestSnapshot = beginRequest('submit');
    setState({ agentSubmittingQuestionId: question.questionId, agentQuestionSubmitError: '' });
    const result = await ports.submitAnswer({
      envelope,
      agentBridgeUrl: resolveSessionAgentBridgeUrl(),
      question,
      answer,
    });
    if (!isRequestCurrent(requestSnapshot)) return;
    if (!result.ok) {
      if (ports.isAuthFailure({ status: result.status, reason: result.reason })) {
        handleAgentAuthFailure(result.reason);
      } else {
        setState({
          agentSubmittingQuestionId: '',
          agentQuestionSubmitError: result.reason || 'Could not submit this answer.',
        });
      }
      return;
    }
    setState((prev: Readonly<OnePageSessionAgentState>) => ({
      agentSubmittingQuestionId: '',
      agentSubmittedQuestionIds: Array.from(new Set([...(prev.agentSubmittedQuestionIds || []), question.questionId])),
    }));
    void loadAgentData(true);
  };

  const handleAgentLogout = (): void => {
    if (disposed) return;
    invalidateAgentRequests();
    const sessionSlug = resolveCurrentSessionSlug();
    ports.clearStoredEnvelope(resolveCurrentIdentityTarget());
    clearAgentEnvelopeMemoryCache(sessionSlug);
    setState({
      ...buildAgentDataResetState(),
      agentClientEnvelope: null,
    });
  };

  const bootstrapAgentSession = (): void => {
    if (disposed) return;
    if (!isAgentBackendMode(resolveCurrentSessionConfig())) return;
    const envelope = restoreAgentEnvelopeFromStorage();
    if (envelope) {
      void loadAgentData(true);
    } else {
      void loadAgentSessionMeta();
    }
  };

  const handleAgentComponentDidUpdate = ({
    loginJustCompleted,
    slugChanged,
  }: {
    loginJustCompleted: boolean;
    slugChanged: boolean;
  }): void => {
    if (disposed) return;
    const agentMode = isAgentBackendMode(resolveCurrentSessionConfig());
    if (slugChanged) {
      invalidateAgentRequests();
      const envelope = agentMode ? ports.readStoredEnvelope(resolveCurrentIdentityTarget()) : null;
      setState(
        {
          ...buildAgentDataResetState(),
          agentClientEnvelope: envelope,
          agentSessionMeta: null,
          agentSessionMetaStatus: 'idle',
        },
        () => {
          if (!agentMode || disposed) return;
          if (envelope) void loadAgentData(true);
          else void loadAgentSessionMeta();
        },
      );
    } else if (agentMode && loginJustCompleted) {
      const envelope = restoreAgentEnvelopeFromStorage();
      if (envelope) void loadAgentData(true);
    } else if (agentMode && getState().agentSessionMetaStatus === 'idle') {
      void loadAgentSessionMeta();
    }
  };

  return {
    bootstrapAgentSession,
    clearAgentEnvelopeMemoryCache,
    disposeAgentActions,
    handleAgentClientLoginEvent,
    handleAgentAuthFailure,
    handleAgentComponentDidUpdate,
    handleAgentLogout,
    handleAgentQuestionSubmit,
    loadAgentData,
    loadAgentQuestions,
    loadAgentResults,
    loadAgentSessionMeta,
    restoreAgentEnvelopeFromStorage,
  };
};
