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
} from './onePageSessionTelegramController';

const buildEnvelope = (sessionSlug: string): AgentClientLoginEnvelope => ({
  sessionSlug,
  address: '0x0000000000000000000000000000000000000001',
  credential: { token: 'ceagt_test' },
  agentBridgeUrl: 'https://bridge.example',
  capabilities: { submitAnswers: true },
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
    const globalTarget = {
      __CE_AGENT_CLIENT_LOGIN_ENVELOPES__: {
        alpha: buildEnvelope('alpha'),
        general: buildEnvelope('general'),
      },
    };

    expect(getAgentClientLoginEnvelopeMemoryKey(' General ')).toBe('general');
    expect(cacheAgentClientLoginEnvelope(buildEnvelope(' Beta '), globalTarget)).toBe('beta');
    expect(globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__.beta).toMatchObject({ sessionSlug: ' Beta ' });

    clearTelegramEnvelopeMemoryCache(' Alpha ', globalTarget);
    clearTelegramEnvelopeMemoryCache('', globalTarget);

    expect(globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__).toEqual({
      beta: expect.objectContaining({ sessionSlug: ' Beta ' }),
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
      detail: { envelope: { sessionSlug: 'alpha', credential: {} } },
    });

    expect(resolveAgentClientLoginEnvelopeFromEvent(matching, 'alpha')).toBe(envelope);
    expect(resolveAgentClientLoginEnvelopeFromEvent(mismatch, 'alpha')).toBeNull();
    expect(resolveAgentClientLoginEnvelopeFromEvent(missingToken, 'alpha')).toBeNull();
  });
});
