import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LoginAndSettingsModal } from './LoginAndSettingsModal';
import {
  loadLoginSettingsSponsoredAccess,
  type LoginSettingsSponsoredAccessResult,
} from './loginSettingsSponsoredAccessRuntime';
import { getSessionConfigBySlugOrDefault } from '../../utilities/web3/chainGateway';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

jest.mock('@rainbow-me/rainbowkit', () => ({ ConnectButton: () => null }));
jest.mock('../HooksHOC/withWagmiBridge', () => ({ WagmiHooksHOC: (component: unknown) => component }));
jest.mock('./LoginSettingsAiConfigContent', () => ({ __esModule: true, default: () => null }));
jest.mock('./LoginSettingsResourceKeysContent', () => ({ __esModule: true, default: () => null }));
jest.mock('../../wallet/passkeyWallet', () => ({
  restorePasskeyWalletSession: jest.fn(async () => null),
  getPasskeyWalletChain: jest.fn(() => null),
  setPasskeyWalletChain: jest.fn(),
}));
jest.mock('../../utilities/web3/chainGateway', () => {
  const getConfig = jest.fn((_slug?: unknown) => ({}));
  return {
    __esModule: true,
    default: {},
    getSessionConfigBySlugOrDefault: getConfig,
    getSessionConfigBySlug: getConfig,
    getDemoSessionConfigBySlug: jest.fn(() => null),
    getSessionNetwork: jest.fn(() => ({ id: 11155420, name: 'OP Sepolia' })),
    getAllSessionSlugs: jest.fn(() => ['edge', 'other']),
    getAllSessionEntries: jest.fn(() => ['edge', 'other'].map((slug) => [slug, getConfig(slug)])),
  };
});
jest.mock('./loginSettingsSponsoredAccessRuntime', () => ({ loadLoginSettingsSponsoredAccess: jest.fn() }));

const propsFor = (overrides: Partial<React.ComponentProps<typeof LoginAndSettingsModal>> = {}) => ({
  account: '',
  activeSessionSlug: 'edge',
  primarySessionSlug: 'edge',
  changeAccount: jest.fn(),
  changeActiveSessionSlug: jest.fn(),
  changeFocusedTab: jest.fn(),
  demoMode: {},
  demoSurfaceMode: true,
  focusedTab: 0,
  loginComplete: false,
  loginInProgress: false,
  loginModalToggled: true,
  loginModalFocus: '',
  network: null,
  provider: '',
  primarySessionExplicit: true,
  selectedSessionScope: 'active',
  selectedSessionSlugs: [],
  setDemoSurfaceMode: jest.fn(),
  toggleDemoMode: jest.fn(),
  toggleLoginModal: jest.fn(),
  toggleTooltips: jest.fn(),
  tooltipsEnabled: true,
  updateLoginInfo: jest.fn(),
  updateGlobalSessionSelection: jest.fn(),
  ...overrides,
});
const registryConfig = {
  slug: 'edge',
  sessionName: 'Edge session',
  networkChainId: 11155420,
  sponsoredKeys: { ai: true },
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
};
const resultFor = (sessionConfig: Record<string, unknown>): LoginSettingsSponsoredAccessResult => ({
  accessMap: { ai: { status: 'no-gate' }, arweave: null, rpc: null, txGas: null },
  workerResourcePresence: { ai: true, arweave: false, rpc: false, txGas: false },
  sessionConfig,
});
const loadAccess = jest.mocked(loadLoginSettingsSponsoredAccess);
const openSettings = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Toggle pre-login settings' }));
  return screen.findByTestId('ce-settings-resource-ai');
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  jest
    .mocked(getSessionConfigBySlugOrDefault)
    .mockImplementation((slug) => (slug === 'edge' ? registryConfig : { slug: String(slug || '') }));
  loadAccess.mockImplementation(async ({ sessionConfig }) => resultFor(sessionConfig));
});
afterEach(() => window.history.replaceState({}, '', '/'));

describe('Settings sponsorship through mounted updates', () => {
  it('finishes one registry read when equivalent parent configs are rebuilt while the read is pending', async () => {
    let finish: (result: LoginSettingsSponsoredAccessResult) => void = () => undefined;
    loadAccess.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const props = propsFor({ sessionConfig: registryConfig });
    const view = render(<LoginAndSettingsModal {...props} />);
    await openSettings();
    await waitFor(() => expect(loadAccess).toHaveBeenCalledTimes(1));
    for (let index = 0; index < 3; index += 1) {
      view.rerender(<LoginAndSettingsModal {...props} sessionConfig={{ ...registryConfig }} />);
      await act(async () => {
        await Promise.resolve();
      });
    }
    await act(async () => {
      finish(resultFor(registryConfig));
    });
    expect(loadAccess).toHaveBeenCalledTimes(1);
    expect(within(screen.getByTestId('ce-settings-resource-ai')).getByText('Sponsored', { exact: true })).toBeVisible();
  });

  it('refreshes for an account change, session change, reopening Settings and verified Worker revision change', async () => {
    const config = {
      ...registryConfig,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      corsWorkerUrl: 'https://worker.example.test',
      configRevision: 'v1',
    };
    let props = propsFor({ sessionConfig: config });
    const view = render(<LoginAndSettingsModal {...props} />);
    await openSettings();
    await waitFor(() => expect(loadAccess).toHaveBeenCalledTimes(1));
    for (const patch of [
      { account: '0x1111111111111111111111111111111111111111' },
      { sessionConfig: { ...config, slug: 'other' }, activeSessionSlug: 'other' },
      { loginModalToggled: false },
      { loginModalToggled: true },
      { sessionConfig: { ...config, slug: 'other', configRevision: 'v2' } },
    ]) {
      props = { ...props, ...patch };
      view.rerender(<LoginAndSettingsModal {...props} />);
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(loadAccess).toHaveBeenCalledTimes(5);
    expect(loadAccess).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionConfig: expect.objectContaining({ configRevision: 'v2' }) }),
    );
  });

  it('keeps General in the other sponsors after an empty active config finishes loading', async () => {
    jest
      .mocked(getSessionConfigBySlugOrDefault)
      .mockImplementation((slug) =>
        slug === '' ? { slug: '', sessionName: 'General', sponsoredKeys: { ai: true } } : {},
      );
    loadAccess.mockResolvedValue({ ...resultFor({}), workerResourcePresence: null });
    render(<LoginAndSettingsModal {...propsFor()} />);
    await openSettings();
    await waitFor(() => expect(loadAccess).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(
      within(screen.getByTestId('ce-settings-resource-ai')).getByRole('button', {
        name: 'Show other AI sponsor sessions',
      }),
    );
    expect(within(screen.getByTestId('ce-settings-resource-ai')).getByText('General')).toBeVisible();
  });
});

describe('Settings session context', () => {
  it.each(['active', 'all', 'list'])(
    'keeps the route session visible with a different global %s selection',
    async (scope) => {
      window.history.replaceState({}, '', '/session/edge?worker=https%3A%2F%2Fworker.example.test');
      const props = propsFor({
        primarySessionSlug: 'other',
        selectedSessionScope: scope,
        selectedSessionSlugs: ['other'],
      });
      render(<LoginAndSettingsModal {...props} />);
      await openSettings();
      const summary = screen.getByLabelText('Active session: Edge session');
      expect(summary).toHaveTextContent('Edge session');
      expect(within(summary).getByRole('link')).toHaveAttribute(
        'href',
        '/session/edge?worker=https%3A%2F%2Fworker.example.test',
      );
      expect(screen.queryByRole('combobox', { name: 'Session' })).not.toBeInTheDocument();
      expect(props.updateGlobalSessionSelection).not.toHaveBeenCalled();
    },
  );

  it('keeps the global selection editable away from a session route', async () => {
    const props = propsFor({ selectedSessionScope: 'all' });
    render(<LoginAndSettingsModal {...props} />);
    await openSettings();
    fireEvent.change(screen.getByRole('combobox', { name: 'Session' }), { target: { value: 'other' } });
    expect(props.updateGlobalSessionSelection).toHaveBeenCalledWith({
      primarySessionSlug: 'other',
      selectedSessionScope: 'active',
    });
  });
});
