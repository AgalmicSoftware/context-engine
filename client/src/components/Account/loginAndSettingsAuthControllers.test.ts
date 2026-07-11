import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
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

  it('formats agent-token errors with current user-facing copy', () => {
    expect(formatAgentTokenError(new Error('expired'))).toBe(
      'This token is expired. Create a fresh agent token in Telegram and paste it again.',
    );
    expect(formatAgentTokenError('unsupported_format')).toBe('Paste a ceagt_ token or a Context Engine token link.');
    expect(formatAgentTokenError('unknown')).toBe(
      'Agent token login failed. Create a fresh token in Telegram and try again.',
    );
  });

  it('keeps canonical agent-token operational fields authoritative over a matching prop overlay', () => {
    const actions = createLoginAgentActions({
      changeAccount: jest.fn(),
      exchangeAgentClientLogin: async () => envelope,
      extractAgentClientToken: () => ({ ok: true }),
      getActiveSessionSlug: () => 'alpha',
      getAgentTokenInput: () => '',
      getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
      getPropSessionConfig: () => ({ slug: 'alpha', agentBridgeUrl: 'https://bridge.example/' }),
      getSessionConfigBySlugOrDefault: () => ({
        slug: 'alpha',
        agentBridgeUrl: 'https://registry-bridge.example/',
        sponsoredKeys: { ai: true },
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

    expect(actions.getAgentTokenLoginSessionContext()).toEqual({
      sessionSlug: 'alpha',
      sessionConfig: {
        slug: 'alpha',
        agentBridgeUrl: 'https://registry-bridge.example/',
        sponsoredKeys: { ai: true },
        contracts: {},
      },
      agentBridgeUrl: 'https://registry-bridge.example',
    });
    expect(actions.shouldShowAgentTokenLogin()).toBe(true);
  });
});
