import React from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { WagmiHooksHOC } from './withWagmiBridge';
import type { WagmiInjectedProps } from './withWagmiBridge';
import { getSessionNetwork } from '../../utilities/web3/chainGateway.js';
import { clearUserExplicitlyDisconnected } from '../../utilities/web3/wagmiDisconnectState.js';

const mockUseAccount = jest.fn();
const mockUseBalance = jest.fn();
const mockUseBlockNumber = jest.fn();
const mockUseNetwork = jest.fn();
const mockUseProvider = jest.fn();
const mockUseDisconnect = jest.fn();

jest.mock('wagmi', () => ({
  useAccount: (...args: any[]) => mockUseAccount(...args),
  useBalance: (...args: any[]) => mockUseBalance(...args),
  useBlockNumber: (...args: any[]) => mockUseBlockNumber(...args),
  useNetwork: (...args: any[]) => mockUseNetwork(...args),
  useProvider: (...args: any[]) => mockUseProvider(...args),
  useDisconnect: (...args: any[]) => mockUseDisconnect(...args),
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: jest.fn() }),
  useAccountModal: () => ({ openAccountModal: jest.fn() }),
  useChainModal: () => ({ openChainModal: jest.fn() }),
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  getSessionNetwork: jest.fn(() => null),
}));

jest.mock('../../utilities/web3/wagmiDisconnectState.js', () => ({
  clearUserExplicitlyDisconnected: jest.fn(),
}));

jest.mock('utilities/logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockGetSessionNetwork = getSessionNetwork as jest.Mock;
const mockClearUserExplicitlyDisconnected = clearUserExplicitlyDisconnected as jest.Mock;

type TypedProbeOwnProps = {
  label: string;
  urlExtension?: string;
};

const TypedProbe = (_props: TypedProbeOwnProps & WagmiInjectedProps) => null;
const TypedWrapped = WagmiHooksHOC(TypedProbe);
const typedWrappedProps: React.ComponentProps<typeof TypedWrapped> = {
  label: 'typed-probe',
  urlExtension: 'session/demo',
};
void typedWrappedProps;
// @ts-expect-error injected wagmi props are supplied by the HOC
const typedWrappedPropsWithInjected: React.ComponentProps<typeof TypedWrapped> = {
  label: 'typed-probe',
  wagmiAddress: '0xabc',
};
void typedWrappedPropsWithInjected;

const buildProps = (overrides: Record<string, any> = {}): any => ({
  changeAccount: jest.fn(),
  updateLoginInfo: jest.fn(),
  provider: null,
  account: '',
  loginComplete: false,
  activeSessionSlug: 'edge',
  ...overrides,
});

const configureWagmiMocks = ({
  address = undefined,
  chain = null,
  chains = null,
}: {
  address?: string;
  chain?: any;
  chains?: any[] | null;
} = {}) => {
  const resolvedChain = chain || { id: 84532, chainId: 84532, name: 'Base Sepolia' };
  const resolvedChains = chains || [resolvedChain];
  mockUseAccount.mockReturnValue({
    address,
    isConnecting: false,
    isDisconnected: !address,
  });
  mockUseBalance.mockReturnValue({
    data: { value: 0n },
  });
  mockUseBlockNumber.mockReturnValue({ data: undefined });
  mockUseNetwork.mockReturnValue({
    chain: resolvedChain,
    chains: resolvedChains,
  });
  mockUseProvider.mockReturnValue({});
  mockUseDisconnect.mockReturnValue({ disconnect: jest.fn() });
};

describe('WagmiHooksHOC explicit disconnect flag handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.__wagmiReduxBridgeOwner;
  });

  afterEach(() => {
    cleanup();
    delete window.__wagmiReduxBridgeOwner;
  });

  it('clears the explicit disconnect flag only when wallet address transitions to connected', async () => {
    configureWagmiMocks({ address: undefined });

    const Wrapped = WagmiHooksHOC(() => null);
    const props = buildProps();
    const { rerender } = render(<Wrapped {...props} />);

    await act(async () => {});
    expect(mockClearUserExplicitlyDisconnected).not.toHaveBeenCalled();

    configureWagmiMocks({ address: '0x0000000000000000000000000000000000000001' });
    rerender(<Wrapped {...props} />);

    await waitFor(() => {
      expect(mockClearUserExplicitlyDisconnected).toHaveBeenCalledTimes(1);
    });

    rerender(<Wrapped {...props} />);
    await act(async () => {});
    expect(mockClearUserExplicitlyDisconnected).toHaveBeenCalledTimes(1);
  });

  it('does not clear the explicit disconnect flag when no wallet is connected', async () => {
    configureWagmiMocks({ address: undefined });

    const Wrapped = WagmiHooksHOC(() => null);
    render(<Wrapped {...buildProps()} />);

    await act(async () => {});
    expect(mockClearUserExplicitlyDisconnected).not.toHaveBeenCalled();
  });

  it('clears the explicit disconnect flag on reconnect even without redux dispatch props', async () => {
    configureWagmiMocks({ address: undefined });

    const Wrapped = WagmiHooksHOC(() => null);
    const { rerender } = render(<Wrapped provider={null} account="" loginComplete={false} activeSessionSlug="edge" />);

    await act(async () => {});
    expect(mockClearUserExplicitlyDisconnected).not.toHaveBeenCalled();

    configureWagmiMocks({ address: '0x0000000000000000000000000000000000000002' });
    rerender(<Wrapped provider={null} account="" loginComplete={false} activeSessionSlug="edge" />);

    await waitFor(() => {
      expect(mockClearUserExplicitlyDisconnected).toHaveBeenCalledTimes(1);
    });
  });

  it('hydrates wagmi login without legacy balance fields in the Redux payload', async () => {
    configureWagmiMocks({ address: '0x0000000000000000000000000000000000000003' });

    const props = buildProps();
    const Wrapped = WagmiHooksHOC(() => null);
    render(<Wrapped {...props} />);

    await waitFor(() => {
      expect(props.changeAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          account: '0x0000000000000000000000000000000000000003',
          provider: 'wagmi',
          network: expect.objectContaining({ id: 84532 }),
        }),
      );
    });

    const payload = props.changeAccount.mock.calls[0][0];
    expect(payload).not.toHaveProperty('availableETH');
    expect(payload).not.toHaveProperty('ETHBalance');
  });

  it('rehydrates Redux when the wallet chain changes under a fixed session network', async () => {
    const address = '0x0000000000000000000000000000000000000004';
    const fixedSessionNetwork = { id: 84532, chainId: 84532, name: 'Base Sepolia' };
    const baseMainnet = { id: 8453, chainId: 8453, name: 'Base' };
    mockGetSessionNetwork.mockReturnValue(fixedSessionNetwork);
    configureWagmiMocks({
      address,
      chain: fixedSessionNetwork,
      chains: [fixedSessionNetwork, baseMainnet],
    });

    const props = buildProps({
      provider: 'wagmi',
      account: address,
      loginComplete: true,
    });
    const Wrapped = WagmiHooksHOC(() => null);
    const { rerender } = render(<Wrapped {...props} />);

    await waitFor(() => {
      expect(props.changeAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          account: address,
          network: expect.objectContaining({ id: 84532 }),
        }),
      );
    });

    props.changeAccount.mockClear();
    configureWagmiMocks({
      address,
      chain: baseMainnet,
      chains: [fixedSessionNetwork, baseMainnet],
    });
    rerender(<Wrapped {...props} />);

    await waitFor(() => {
      expect(props.changeAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          account: address,
          network: expect.objectContaining({ id: 8453 }),
        }),
      );
    });
  });

  it('reuses the read provider for the websocket prop instead of opening a second wagmi provider subscription', async () => {
    const fixedSessionNetwork = { id: 11155420, chainId: 11155420, name: 'OP Sepolia' };
    const provider = { send: jest.fn() };
    const probe = jest.fn((_props: any) => null);
    mockGetSessionNetwork.mockReturnValue(fixedSessionNetwork);
    configureWagmiMocks({
      address: '0x0000000000000000000000000000000000000006',
      chain: fixedSessionNetwork,
      chains: [fixedSessionNetwork],
    });
    mockUseProvider.mockReturnValue(provider);

    const Wrapped = WagmiHooksHOC(probe);
    render(<Wrapped {...buildProps()} />);

    await waitFor(() => {
      expect(probe).toHaveBeenCalled();
    });
    const injectedProps = probe.mock.calls[0]?.[0] as WagmiInjectedProps;
    expect(mockUseProvider).toHaveBeenCalledTimes(1);
    expect(mockUseProvider).toHaveBeenCalledWith({ chainId: 11155420 });
    expect(injectedProps.wagmiProvider).toBe(provider);
    expect(injectedProps.wagmiWsProvider).toBe(provider);
  });

  it('reclaims bridge ownership after the original owner unmounts', async () => {
    const address = '0x0000000000000000000000000000000000000005';
    const baseSepolia = { id: 84532, chainId: 84532, name: 'Base Sepolia' };
    const baseMainnet = { id: 8453, chainId: 8453, name: 'Base' };

    configureWagmiMocks({
      address,
      chain: baseSepolia,
      chains: [baseSepolia, baseMainnet],
    });

    const firstProps = buildProps({
      provider: 'wagmi',
      account: address,
      loginComplete: true,
    });
    const secondProps = buildProps({
      provider: 'wagmi',
      account: address,
      loginComplete: true,
    });
    const Wrapped = WagmiHooksHOC(() => null);
    const Harness = ({ showFirst = true }: { showFirst?: boolean }) => (
      <>
        {showFirst ? <Wrapped {...firstProps} /> : null}
        <Wrapped {...secondProps} />
      </>
    );

    const { rerender } = render(<Harness showFirst={true} />);

    await waitFor(() => {
      expect(firstProps.changeAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          account: address,
          network: expect.objectContaining({ id: 84532 }),
        }),
      );
    });
    expect(secondProps.changeAccount).not.toHaveBeenCalled();

    firstProps.changeAccount.mockClear();
    secondProps.changeAccount.mockClear();

    rerender(<Harness showFirst={false} />);

    configureWagmiMocks({
      address,
      chain: baseMainnet,
      chains: [baseSepolia, baseMainnet],
    });
    rerender(<Harness showFirst={false} />);

    await waitFor(() => {
      expect(secondProps.changeAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          account: address,
          network: expect.objectContaining({ id: 8453 }),
        }),
      );
    });
    expect(firstProps.changeAccount).not.toHaveBeenCalled();
  });

  it('keeps provider selection strict when active session slug is unresolved', async () => {
    configureWagmiMocks({ address: undefined });
    mockGetSessionNetwork.mockImplementation((slug: string) => {
      if (slug === 'missing-session-slug') return null;
      if (slug === '') {
        return { id: 8453, chainId: 8453, name: 'Base' };
      }
      return null;
    });

    const Probe = jest.fn((_props: any) => null);
    (Probe as React.ComponentType<any>).displayName = 'Probe';
    const Wrapped = WagmiHooksHOC(Probe as React.ComponentType<any>);
    render(<Wrapped {...buildProps({ activeSessionSlug: 'missing-session-slug' })} />);

    await act(async () => {});

    expect(mockGetSessionNetwork).toHaveBeenCalledWith('missing-session-slug');
    expect(mockGetSessionNetwork).not.toHaveBeenCalledWith('');
    expect(mockUseProvider).toHaveBeenCalledWith({ chainId: undefined });
    expect(Probe).toHaveBeenCalled();
    expect((Probe.mock.calls[0]?.[0] as any).network).toMatchObject({
      id: 84532,
      chainId: 84532,
      name: 'Base Sepolia',
    });
  });
});
