import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import type { AgentResultsDataset } from '../../utilities/session/agentSessionBackend';
import {
  buildCurrentSessionConfigRequest,
  buildAgentAuthFailureState,
  cacheAgentClientLoginEnvelope,
  clearAgentEnvelopeMemoryCache,
  DEFAULT_AGENT_BRIDGE_URL,
  getAgentClientLoginEnvelopeMemoryKey,
  normalizeOnePageSessionSlug,
  isOnePageAgentShellMode,
  resolveAgentClientLoginEnvelopeFromEvent,
  resolveCurrentSessionSlugForProps,
  resolveSessionAgentBridgeUrl,
  resolveAgentResultsAuthFailureReason,
  type AgentClientLoginEnvelopeMemoryGlobal,
} from './onePageSessionAgentController';

const buildEnvelope = (sessionSlug: string): AgentClientLoginEnvelope => ({
  v: 2,
  sessionId: '0x11111111111111111111111111111111',
  sessionSlug,
  address: '0x0000000000000000000000000000000000000001',
  bridgeCredential: { kind: 'agent_bridge_browser_token', token: 'ceagt_bridge_test' },
  workerCredential: { kind: 'session_worker_jwt', token: 'jwt-worker-test' },
  agentBridgeUrl: 'https://bridge.example',
  workerUrl: 'https://session-worker.example',
  capabilities: { submitAnswers: true, readGroups: true },
  expiresAt: '2026-01-01T00:00:00.000Z',
});

describe('onePageSessionAgentController', () => {
  it.each(['wagmi', 'passkey', ''])('keeps web participation for %s even with a cached agent envelope', (provider) => {
    const envelope = { ...buildEnvelope('alpha'), expiresAt: '2099-01-01T00:00:00.000Z' };
    expect(
      isOnePageAgentShellMode({
        sessionConfig: {
          sessionModeProfile: { authority: { mode: 'worker_canonical' }, surfaces: { agentHttp: true } },
        },
        sessionSlug: 'alpha',
        agentSessionMeta: null,
        agentClientEnvelope: envelope,
        provider,
      }),
    ).toBe(false);
  });

  it.each(['valid', 'expired', 'wrong session', 'wrong worker', 'HTTP disabled'])(
    'selects the agent shell only for a valid current token: %s',
    (kind) => {
      const envelope = {
        ...buildEnvelope('alpha'),
        expiresAt: kind === 'expired' ? '2000-01-01T00:00:00.000Z' : '2099-01-01T00:00:00.000Z',
      };
      expect(
        isOnePageAgentShellMode({
          sessionConfig: {
            sessionModeProfile: {
              authority: { mode: 'worker_canonical' },
              surfaces: { agentHttp: kind !== 'HTTP disabled' },
            },
            sessionId: envelope.sessionId,
            corsWorkerUrl: kind === 'wrong worker' ? 'https://other-worker.example' : envelope.workerUrl,
            agentBridgeUrl: envelope.agentBridgeUrl,
          },
          sessionSlug: kind === 'wrong session' ? 'beta' : 'alpha',
          agentSessionMeta: null,
          agentClientEnvelope: envelope,
          provider: 'agent_token',
        }),
      ).toBe(kind === 'valid');
    },
  );

  it('normalizes session slugs and resolves the current slug from route props first', () => {
    expect(normalizeOnePageSessionSlug(' General ')).toBe('');

    const props = {
      slug: 'fallback',
      sessionConfig: { slug: 'config-slug' },
      sessionName: 'Session',
    };

    expect(resolveCurrentSessionSlugForProps(props, () => 'Route-Slug')).toBe('route-slug');
    expect(resolveCurrentSessionSlugForProps(props, () => '')).toBe('config-slug');
  });

  it('builds the resolved-session request without changing source fields', () => {
    const request = buildCurrentSessionConfigRequest(
      {
        slug: 'fallback',
        sessionConfig: { slug: 'Config' },
        sessionName: 'Name',
        questionsGenPrompt: 'Prompt',
        contracts: { sessionRegistry: '0xregistry' },
      },
      () => '',
    );

    expect(request).toEqual({
      slug: 'config',
      sessionName: 'Name',
      questionsGenPrompt: 'Prompt',
      autoFeatureSBTsBySessionSlug: undefined,
      autoFeatureSBTsWithFeaturedSbtTags: undefined,
      incomingSessionConfig: { slug: 'Config' },
      contracts: { sessionRegistry: '0xregistry' },
    });
  });

  it('resolves agent bridge URL precedence and trims trailing slashes', () => {
    expect(
      resolveSessionAgentBridgeUrl({
        agentBridgeUrl: 'https://primary.example///',
        telegram: { workerUrl: 'https://telegram.example' },
      }),
    ).toBe('https://primary.example');

    expect(
      resolveSessionAgentBridgeUrl({
        telegram: { workerUrl: 'https://telegram.example/' },
      }),
    ).toBe('https://telegram.example');

    expect(resolveSessionAgentBridgeUrl({})).toBe(DEFAULT_AGENT_BRIDGE_URL);
  });

  it('builds auth failure state with the current fallback message', () => {
    expect(buildAgentAuthFailureState('').agentQuestionSubmitError).toBe(
      'Agent session expired. Paste a fresh agent token.',
    );
    expect(buildAgentAuthFailureState('scope_denied').agentQuestionSubmitError).toBe('scope_denied');
  });

  it('uses normalized envelope cache keys for cache writes and clears', () => {
    const globalTarget: AgentClientLoginEnvelopeMemoryGlobal = {
      __CE_AGENT_CLIENT_LOGIN_ENVELOPES__: {
        alpha: buildEnvelope('alpha'),
        general: buildEnvelope('general'),
      },
    };

    expect(getAgentClientLoginEnvelopeMemoryKey(' General ')).toBe(
      'general\nno-session-id\nno-worker-origin\nno-bridge-origin',
    );
    const betaKey = cacheAgentClientLoginEnvelope(buildEnvelope(' Beta '), globalTarget);
    expect(betaKey).toContain('beta\n0x11111111111111111111111111111111');
    expect(globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__?.[betaKey]).toMatchObject({ sessionSlug: ' Beta ' });

    clearAgentEnvelopeMemoryCache(' Alpha ', globalTarget);
    clearAgentEnvelopeMemoryCache('', globalTarget);

    expect(globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__).toEqual({
      [betaKey]: expect.objectContaining({ sessionSlug: ' Beta ' }),
    });
  });

  it('extracts auth failure reasons from Agent results views', () => {
    const dataset: AgentResultsDataset = {
      ok: true,
      views: {
        polis: { status: 'ready' },
        consensus: { status: 'auth', reason: 'expired' },
        difference: { status: 'ready' },
        groups: { status: 'disabled' },
        topicMap: { status: 'ready' },
      },
      polisDataset: {
        synthesized: false,
        aggregator: {},
        participantCount: 0,
        questionCount: 0,
        responseCount: 0,
        hasData: false,
      },
      approximate: false,
    };

    expect(resolveAgentResultsAuthFailureReason(dataset)).toBe('expired');
  });

  it('accepts only matching agent-login envelopes from events', () => {
    const envelope = buildEnvelope('alpha');
    const matching = new CustomEvent('ce-agent-client-login', {
      detail: { envelope },
    });
    const mismatch = new CustomEvent('ce-agent-client-login', {
      detail: { envelope: buildEnvelope('beta') },
    });
    const missingToken = new CustomEvent('ce-agent-client-login', {
      detail: {
        envelope: {
          sessionSlug: 'alpha',
          bridgeCredential: {},
          workerCredential: { token: 'jwt-worker-test' },
        },
      },
    });

    const target = {
      sessionSlug: 'alpha',
      sessionId: envelope.sessionId,
      workerUrl: envelope.workerUrl,
      agentBridgeUrl: envelope.agentBridgeUrl,
    };
    expect(resolveAgentClientLoginEnvelopeFromEvent(matching, target)).toBe(envelope);
    expect(resolveAgentClientLoginEnvelopeFromEvent(mismatch, target)).toBeNull();
    expect(
      resolveAgentClientLoginEnvelopeFromEvent(matching, {
        ...target,
        sessionId: '0x22222222222222222222222222222222',
      }),
    ).toBeNull();
    expect(resolveAgentClientLoginEnvelopeFromEvent(missingToken, target)).toBeNull();
  });
});
