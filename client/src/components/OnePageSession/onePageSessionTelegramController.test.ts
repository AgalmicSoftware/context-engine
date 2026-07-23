import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import type { TelegramResultsDataset } from '../../utilities/session/telegramSessionBackend';
import {
  buildCurrentSessionConfigRequest,
  buildTelegramAuthFailureState,
  cacheAgentClientLoginEnvelope,
  clearTelegramEnvelopeMemoryCache,
  DEFAULT_AGENT_BRIDGE_URL,
  getAgentClientLoginEnvelopeMemoryKey,
  normalizeOnePageSessionSlug,
  resolveAgentClientLoginEnvelopeFromEvent,
  resolveCurrentSessionSlugForProps,
  resolveTelegramAgentBridgeUrl,
  resolveTelegramResultsAuthFailureReason,
  type AgentClientLoginEnvelopeMemoryGlobal,
} from './onePageSessionTelegramController';

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

describe('onePageSessionTelegramController', () => {
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
      resolveTelegramAgentBridgeUrl({
        agentBridgeUrl: 'https://primary.example///',
        telegram: { workerUrl: 'https://telegram.example' },
      }),
    ).toBe('https://primary.example');

    expect(
      resolveTelegramAgentBridgeUrl({
        telegram: { workerUrl: 'https://telegram.example/' },
      }),
    ).toBe('https://telegram.example');

    expect(resolveTelegramAgentBridgeUrl({})).toBe(DEFAULT_AGENT_BRIDGE_URL);
  });

  it('builds auth failure state with the current fallback message', () => {
    expect(buildTelegramAuthFailureState('').telegramQuestionSubmitError).toBe(
      'Telegram session expired. Paste a fresh agent token.',
    );
    expect(buildTelegramAuthFailureState('scope_denied').telegramQuestionSubmitError).toBe('scope_denied');
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

    clearTelegramEnvelopeMemoryCache(' Alpha ', globalTarget);
    clearTelegramEnvelopeMemoryCache('', globalTarget);

    expect(globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__).toEqual({
      [betaKey]: expect.objectContaining({ sessionSlug: ' Beta ' }),
    });
  });

  it('extracts auth failure reasons from Telegram results views', () => {
    const dataset = {
      ok: true,
      views: {
        public: { status: 'ready' },
        private: { status: 'auth', reason: 'expired' },
      },
      polisDataset: { synthesized: false, aggregator: {} },
      approximate: false,
    } as TelegramResultsDataset;

    expect(resolveTelegramResultsAuthFailureReason(dataset)).toBe('expired');
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
