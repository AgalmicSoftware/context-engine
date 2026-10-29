import store from '../../store';
import { changeAccount } from '../../actions/accountActions';
import { updateLoginInfo } from '../../actions/sessionStateActions';
import { logoutClientAuth } from './clientAuthLogout';
import {
  readAgentClientLoginEnvelope,
  writeAgentClientLoginEnvelope,
  clearAgentClientLoginEnvelope,
  exchangeAgentClientLogin,
  type AgentClientLoginEnvelope,
} from './agentClientLogin';
import {
  buildInitialAgentState,
  createOnePageSessionAgentActions,
  type OnePageSessionAgentState,
} from '../../components/OnePageSession/onePageSessionAgentActions';
import { cacheAgentClientLoginEnvelope } from '../../components/OnePageSession/onePageSessionAgentController';
import {
  loadQuestions,
  loadResultsDataset,
  envelopeAllowsSubmit,
  isAgentAuthFailure,
  submitAnswer,
} from './agentSessionBackend';
import { readTokenCache, writeTokenCache } from '../worker/workerAuthTokenCache';
import { logoutPasskeyWallet } from '../../wallet/passkeyWallet';

jest.mock('../../wallet/passkeyWallet', () => ({ logoutPasskeyWallet: jest.fn(async () => {}) }));

const origin = 'https://worker.example';
const expiry = '2035-01-01T00:00:00.000Z';
const envelope = (sessionSlug = 'alpha'): AgentClientLoginEnvelope => ({
  v: 3,
  sessionSlug,
  workerUrl: origin,
  agentWorkerUrl: origin,
  address: '0x1111111111111111111111111111111111111111',
  expiresAt: expiry,
  capabilities: { readQuestions: true },
  agentCredential: { kind: 'session_agent_browser_token', token: `agent-${sessionSlug}`, expiresAt: expiry },
  workerCredential: { kind: 'session_worker_jwt', token: `worker-${sessionSlug}`, expiresAt: expiry },
});
const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const response = () => jsonResponse({ ok: true, questions: [], total: 0, hasMore: false });
const settle = async () => {
  for (let index = 0; index < 50; index++) await Promise.resolve();
};
const disposals: Array<() => void> = [];
const mount = (fetchImpl: typeof fetch, slug = 'alpha') => {
  const config = { slug, corsWorkerUrl: origin };
  const target = { sessionSlug: slug, workerUrl: origin, agentWorkerUrl: origin };
  let state: OnePageSessionAgentState = buildInitialAgentState(target, readAgentClientLoginEnvelope);
  const actions = createOnePageSessionAgentActions({
    getState: () => state,
    isAgentBackendMode: () => true,
    resolveCurrentSessionConfig: () => config,
    resolveCurrentSessionSlug: () => slug,
    resolveSessionAgentWorkerUrl: () => origin,
    setState: (patch, callback) => {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      callback?.();
    },
    ports: {
      clearStoredEnvelope: clearAgentClientLoginEnvelope,
      readStoredEnvelope: readAgentClientLoginEnvelope,
      envelopeAllowsSubmit,
      isAuthFailure: isAgentAuthFailure,
      fetchImpl,
      submitAnswer,
      loadQuestions: (args) => loadQuestions({ ...args, fetchImpl }),
      loadResultsDataset: (args) => loadResultsDataset({ ...args, fetchImpl }),
    },
  });
  disposals.push(actions.disposeAgentActions);
  actions.bootstrapAgentSession();
  return { actions, state: () => state };
};
const authenticatedCalls = (fetchImpl: { mock: { calls: unknown[][] } }) =>
  fetchImpl.mock.calls.filter(([, init]) =>
    new Headers((init as RequestInit | undefined)?.headers).has('Authorization'),
  );

beforeEach(async () => {
  await logoutClientAuth();
  jest.clearAllMocks();
});
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose());
});

test('global and agent logout reset all mounted sessions and a return visit makes zero authenticated requests', async () => {
  changeAccount({ account: envelope().address, provider: 'agent_token' })(store.dispatch);
  updateLoginInfo({ loginComplete: true, loginInProgress: false, provider: 'agent_token' })(store.dispatch);
  const fetchImpl = jest.fn(async () => response());
  for (const slug of ['alpha', 'beta']) {
    writeAgentClientLoginEnvelope(envelope(slug));
    cacheAgentClientLoginEnvelope(envelope(slug));
  }
  writeTokenCache('ce:workerToken:v1:fixture', { token: 'fixture' });
  sessionStorage.setItem('ce:agentClientLogin:v3:fixture', 'credential');
  localStorage.setItem('ce:agentClientLogin:v3:fixture', 'credential');
  const first = mount(fetchImpl);
  const second = mount(fetchImpl, 'beta');
  await settle();
  expect(authenticatedCalls(fetchImpl)).toHaveLength(12);
  await logoutClientAuth();
  for (const mounted of [first, second]) {
    expect(mounted.state().agentClientEnvelope).toBeNull();
    expect(mounted.state().agentQuestions).toEqual([]);
    expect(mounted.state().agentResults).toBeNull();
    mounted.actions.disposeAgentActions();
  }
  expect(store.getState().profile.account).toBeFalsy();
  expect(store.getState().sessionState.loginComplete).toBe(false);
  expect(readTokenCache('ce:workerToken:v1:fixture')).toBeNull();
  expect(sessionStorage.getItem('ce:agentClientLogin:v3:fixture')).toBeNull();
  expect(localStorage.getItem('ce:agentClientLogin:v3:fixture')).toBeNull();
  fetchImpl.mockClear();
  const returned = mount(fetchImpl);
  await settle();
  expect(authenticatedCalls(fetchImpl)).toHaveLength(0);
  const loginFetch = jest.fn(async (url: RequestInfo | URL) =>
    jsonResponse(
      String(url).includes('/capabilities?')
        ? { features: ['agent_http_v1'], agentHttp: { ready: true }, agentSessionWrapped: { origin } }
        : envelope(),
    ),
  );
  const fresh = await exchangeAgentClientLogin({
    sessionSlug: 'alpha',
    agentWorkerUrl: origin,
    workerUrl: origin,
    tokenOrLink: 'ceagt_local_fixture_token_123456',
    fetchImpl: loginFetch,
  });
  returned.actions.handleAgentClientLoginEvent(
    new CustomEvent('ce-agent-client-login', { detail: { envelope: fresh } }),
  );
  await settle();
  expect(authenticatedCalls(fetchImpl)).toHaveLength(6);
  returned.actions.handleAgentLogout();
  await settle();
  expect(returned.state().agentClientEnvelope).toBeNull();
  fetchImpl.mockClear();
  returned.actions.disposeAgentActions();
  mount(fetchImpl);
  await settle();
  expect(authenticatedCalls(fetchImpl)).toHaveLength(0);
  expect(logoutPasskeyWallet).toHaveBeenCalledTimes(2);
});

test('logout cancels pending agent pagination before any next authenticated request', async () => {
  writeAgentClientLoginEnvelope(envelope());
  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fetchImpl = jest.fn(async (url: RequestInfo | URL) =>
    String(url).includes('/questions') ? pending : response(),
  );
  const mounted = mount(fetchImpl);
  await settle();
  const before = authenticatedCalls(fetchImpl).length;
  await logoutClientAuth();
  release(
    jsonResponse({
      ok: true,
      questions: [{ questionId: 'first', prompt: 'First' }],
      total: 2,
      hasMore: true,
      nextCursor: 'page-two',
    }),
  );
  await settle();
  expect(authenticatedCalls(fetchImpl)).toHaveLength(before);
  expect(mounted.state().agentQuestions).toEqual([]);
  expect(mounted.state().agentClientEnvelope).toBeNull();
});
