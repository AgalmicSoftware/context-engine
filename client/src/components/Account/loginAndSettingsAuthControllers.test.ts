import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { buildPasskeyWalletNetwork, createLoginPasskeyActions } from './loginAndSettingsPasskeyActions';
import { createLoginAgentActions, formatAgentTokenError } from './loginAndSettingsAgentTokenActions';

const envelope: AgentClientLoginEnvelope = {
  sessionSlug: 'alpha',
  address: '0x0000000000000000000000000000000000000001',
  credential: { token: 'ceagt_test' },
  capabilities: { submitAnswers: true },
  expiresAt: '2026-01-01T00:00:00.000Z',
};

describe('loginAndSettings auth controllers', () => {
  it('normalizes passkey wallet network labels without mutating chain ids', () => {
    expect(buildPasskeyWalletNetwork({ id: '11155420', name: 'OP Sepolia' })).toEqual({
      id: 11155420,
      chainId: 11155420,
      name: 'OP Sepolia (Passkey)',
    });
    expect(buildPasskeyWalletNetwork({ id: 1, chainId: 1, name: 'Mainnet (Passkey)' })).toMatchObject({
      id: 1,
      chainId: 1,
      name: 'Mainnet (Passkey)',
    });
  });

  it('finalizes passkey login and clears worker tokens only on account switches', () => {
    const clearAllWorkerSessionTokens = jest.fn();
    const notifyInfo = jest.fn();
    const changeAccount = jest.fn();
    const updateLoginInfo = jest.fn();
    const setActionMode = jest.fn();
    const actions = createLoginPasskeyActions({
      accountLogError: jest.fn(),
      changeAccount,
      clearAllWorkerSessionTokens,
      getAccount: () => '0xaaa',
      getErrorMessage: () => '',
      getProvider: () => 'passkey_eoa',
      getTargetNetwork: () => ({ id: 11155420, name: 'OP Sepolia' }),
      isCurrentAction: () => true,
      normalizeAccountForComparison: (account) => String(account || '').toLowerCase(),
      notifyInfo,
      passkeyWallet: {
        createPasskeyWallet: async () => '0xbbb',
        setPasskeyWalletChain: jest.fn(),
        unlockPasskeyWallet: async () => '0xbbb',
      },
      setActionMode,
      setStatus: jest.fn(),
      startAction: () => 1,
      updateLoginInfo,
    });

    actions._finalizePasskeyWalletLogin('0xbbb', { id: 11155420, name: 'OP Sepolia' });

    expect(clearAllWorkerSessionTokens).toHaveBeenCalledTimes(1);
    expect(notifyInfo).toHaveBeenCalledWith('Passkey account switched.');
    expect(changeAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account: '0xbbb',
        provider: 'passkey_eoa',
      }),
    );
    expect(updateLoginInfo).toHaveBeenCalledWith({
      loginInProgress: false,
      loginComplete: true,
      provider: 'passkey_eoa',
    });
  });

  it('keeps passkey creation distinct from sign-in while the action is running', async () => {
    const setActionMode = jest.fn();
    const createPasskeyWallet = jest.fn(async () => '0xbbb');
    const unlockPasskeyWallet = jest.fn(async () => '0xbbb');
    const actions = createLoginPasskeyActions({
      accountLogError: jest.fn(),
      changeAccount: jest.fn(),
      clearAllWorkerSessionTokens: jest.fn(),
      getAccount: () => '',
      getErrorMessage: () => '',
      getProvider: () => '',
      getTargetNetwork: () => ({ id: 11155420, name: 'OP Sepolia' }),
      isCurrentAction: () => true,
      normalizeAccountForComparison: (account) => String(account || '').toLowerCase(),
      notifyInfo: jest.fn(),
      passkeyWallet: {
        createPasskeyWallet,
        setPasskeyWalletChain: jest.fn(),
        unlockPasskeyWallet,
      },
      setActionMode,
      setStatus: jest.fn(),
      startAction: () => 1,
      updateLoginInfo: jest.fn(),
    });

    await actions.handlePasskeyWalletCreate();

    expect(createPasskeyWallet).toHaveBeenCalledTimes(1);
    expect(unlockPasskeyWallet).not.toHaveBeenCalled();
    expect(setActionMode.mock.calls).toEqual([['create'], ['']]);
  });

  it('formats agent-token errors with current user-facing copy', () => {
    expect(formatAgentTokenError(new Error('expired'))).toBe(
      'This token is expired. Create a fresh agent token in Telegram and paste it again.',
    );
    expect(formatAgentTokenError('unsupported_format')).toBe('Paste the raw ceagt_ token, not a link.');
    expect(formatAgentTokenError('unknown')).toBe(
      'Agent token login failed. Create a fresh token in Telegram and try again.',
    );
  });

  it('resolves agent-token session context from prop config before fallbacks', () => {
    const actions = createLoginAgentActions({
      changeAccount: jest.fn(),
      exchangeAgentClientLogin: async () => envelope,
      extractAgentClientToken: () => ({ ok: true }),
      getActiveSessionSlug: () => 'alpha',
      getAgentTokenInput: () => '',
      getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
      getPropSessionConfig: () => ({ slug: 'alpha', agentBridgeUrl: 'https://bridge.example/' }),
      getSessionConfigBySlugOrDefault: () => ({ slug: 'fallback' }),
      getTargetNetwork: () => ({ id: 11155420 }),
      isTelegramFirstSessionConfig: () => true,
      normalizeSettingsSessionSlug: (slug) =>
        String(slug || '')
          .trim()
          .toLowerCase(),
      setState: jest.fn(),
      setStateIfMounted: jest.fn(),
      updateLoginInfo: jest.fn(),
      windowTarget: null,
    });

    expect(actions.getAgentTokenLoginSessionContext()).toEqual({
      sessionSlug: 'alpha',
      sessionConfig: {
        slug: 'alpha',
        agentBridgeUrl: 'https://registry-bridge.example/',
        sponsoredKeys: { ai: true },
        contracts: {},
      },
      agentBridgeUrl: 'https://registry-bridge.example',
      sessionId: '',
      workerCanonical: false,
      workerUrl: '',
    });
    expect(actions.shouldShowAgentTokenLogin()).toBe(true);
  });

  it('keeps an exact worker-canonical prop authoritative during a same-slug registry collision', () => {
    const workerConfig = {
      slug: 'alpha',
      sessionId: '0x00112233445566778899aabbccddeeff',
      configRevision: 'route-revision-1',
      corsWorkerUrl: 'https://route-worker.example',
      agentBridgeUrl: 'https://route-bridge.example',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    const actions = createLoginAgentActions({
      changeAccount: jest.fn(),
      exchangeAgentClientLogin: async () => envelope,
      extractAgentClientToken: () => ({ ok: true }),
      getActiveSessionSlug: () => 'alpha',
      getAgentTokenInput: () => '',
      getDemoSessionConfigBySlug: () => ({
        slug: 'alpha',
        corsWorkerUrl: 'https://demo-worker.example',
      }),
      getPropSessionConfig: () => workerConfig,
      getSessionConfigBySlugOrDefault: () => ({
        slug: 'alpha',
        sessionId: '0xffeeddccbbaa99887766554433221100',
        corsWorkerUrl: 'https://registry-worker.example',
        agentBridgeUrl: 'https://registry-bridge.example',
      }),
      getTargetNetwork: () => ({ id: 11155420 }),
      isTelegramFirstSessionConfig: () => true,
      normalizeSettingsSessionSlug: (slug) =>
        String(slug || '')
          .trim()
          .toLowerCase(),
      setState: jest.fn(),
      setStateIfMounted: jest.fn(),
      updateLoginInfo: jest.fn(),
      windowTarget: null,
    });

    const context = actions.getAgentTokenLoginSessionContext();

    expect(context.sessionConfig).toBe(workerConfig);
    expect(context).toMatchObject({
      sessionSlug: 'alpha',
      agentBridgeUrl: 'https://route-bridge.example',
      sessionId: '0x00112233445566778899aabbccddeeff',
      workerCanonical: true,
      workerUrl: 'https://route-worker.example',
    });
  });
});
