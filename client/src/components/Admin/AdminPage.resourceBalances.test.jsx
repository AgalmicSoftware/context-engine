/** @file AdminPage.resourceBalances.test.jsx */
import React, { act } from 'react';
import { ethers } from 'ethers';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_REGISTRY_CACHE_UPDATED_EVENT = 'ce:session-registry-cache-updated';
const MOCK_ARWEAVE_ADDRESS = 'arweave-address-for-resource-balance-test-01';
const MOCK_ARWEAVE_JWK = { mocked: 'arweave-jwk' };

const buildSessionConfig = (overrides = {}) => ({
  slug: 'edge',
  sessionName: 'Edge Session',
  corsWorkerUrl: 'https://worker.example.test',
  networkChainId: 84532,
  __registry: {
    registryChainId: 84532,
    chainId: 84532,
    adminAddress: ADMIN_ADDRESS,
    ...(overrides.__registry || {}),
  },
  ...overrides,
});

const mockResolveCorsProxyUrl = jest.fn();
const mockLoadSessionRegistryCache = jest.fn();
const mockGetAllSessionEntries = jest.fn();
const mockBuildSignedAdminActionAuth = jest.fn();
const mockSetSessionFieldsOnChain = jest.fn();
const mockUploadSessionMetadata = jest.fn();
const mockUpdateSessionMetadataOnChain = jest.fn();
const mockUpsertSessionRegistryCache = jest.fn();
const mockReadArweaveWalletBalance = jest.fn();
const mockFormatWinstonToAr = jest.fn();
const mockReadProvider = {
  getBalance: jest.fn(),
  getBlockNumber: jest.fn(),
};
const mockGetReadProviderForChain = jest.fn(() => mockReadProvider);

jest.mock('../../utilities/worker/corsProxy.js', () => ({
  corsProxyUtils: {
    resolveCorsProxyUrl: (...args) => mockResolveCorsProxyUrl(...args),
  },
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  buildSiweMessage: jest.fn(() => 'siwe-message'),
  buildSignedAdminActionAuth: (...args) => mockBuildSignedAdminActionAuth(...args),
  fetchWorkerWithAuth: jest.fn(),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => ({})),
  },
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: jest.fn(),
    readArweaveWalletBalance: (...args) => mockReadArweaveWalletBalance(...args),
    formatWinstonToAr: (...args) => mockFormatWinstonToAr(...args),
  },
}));

jest.mock('../../utilities/crypto/encryptedFields.js', () => ({
  encryptedFieldsUtils: {
    resolveEncryptedValue: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/rpcProviders.js', () => ({
  getReadProviderForChain: (...args) => mockGetReadProviderForChain(...args),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  loadSessionRegistryCache: (...args) => mockLoadSessionRegistryCache(...args),
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  sessionRegistryStore: {
    getAllSessionEntries: (...args) => mockGetAllSessionEntries(...args),
  },
  setSessionFieldsOnChain: (...args) => mockSetSessionFieldsOnChain(...args),
  setResourceGatesOnChain: jest.fn(),
  fetchSessionFromRegistry: jest.fn(),
  upsertSessionRegistryCache: (...args) => mockUpsertSessionRegistryCache(...args),
  uploadSessionMetadata: (...args) => mockUploadSessionMetadata(...args),
  updateSessionMetadataOnChain: (...args) => mockUpdateSessionMetadataOnChain(...args),
  sessionRegistryUtils: {
    normalizeSessionIdHex: jest.fn(() => ''),
  },
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: jest.fn(() => []),
  getGlobalLitHooks: jest.fn(() => null),
  resolveLitChain: jest.fn(() => 'baseSepolia'),
  resolveLitNetwork: jest.fn(() => 'datil-dev'),
}));

jest.mock('../Shared/AudioInput/AudioInput', () => () => <div data-testid="mock-admin-audio-input" />);
jest.mock('../SBTs/SBTSelector', () => () => <div data-testid="mock-admin-sbt-selector" />);

const AdminPage = require('./AdminPage').default;

const renderAdminPage = async ({
  account = ADMIN_ADDRESS,
  initialSessionId,
  initialRegistryChainId,
} = {}) => {
  let utils;
  await act(async () => {
    utils = render(
      <AdminPage
        account={account}
        network={{ id: 84532 }}
        loginComplete={true}
        toggleLoginModal={jest.fn()}
        initialSessionId={initialSessionId}
        initialRegistryChainId={initialRegistryChainId}
      />
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return utils;
};

const getWorkerSecretsPanel = () => screen.getByText('Worker secrets').closest('section');
const getSecretInputByLabel = (labelText) => (
  screen.getByText(labelText).parentElement.querySelector('input,textarea')
);
const clickAndSettle = async (element) => {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
};
const waitForResolvedWorkerUrl = () => screen.findByDisplayValue('https://worker.example.test');
const openWorkerSecretsPanel = async () => {
  const panel = getWorkerSecretsPanel();
  if (!within(panel).queryByRole('button', { name: 'Arweave' })) {
    await clickAndSettle(within(panel).getByRole('button', { name: 'Toggle Worker secrets section' }));
  }
  await within(panel).findByRole('button', { name: 'Arweave' });
  return panel;
};

describe('AdminPage resource balance previews', () => {
  const originalFetch = global.fetch;
  let web3ProviderSpy;
  let sessionEntries;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url) => Promise.resolve(
      String(url).endsWith('/auth/nonce')
        ? { ok: true, json: async () => ({ nonce: 'test-admin-nonce' }) }
        : { ok: true, json: async () => ({ ok: true }) }
    ));
    mockFormatWinstonToAr.mockImplementation((winston) => {
      if (String(winston) === '12345678000000') return '12.345678';
      if (String(winston) === '5') return '0.000000';
      return '0.000000';
    });
    mockGetReadProviderForChain.mockImplementation(() => mockReadProvider);
    mockReadProvider.getBalance.mockResolvedValue(ethers.constants.Zero);
    mockReadProvider.getBlockNumber.mockResolvedValue(12345678);
    sessionEntries = [['edge', buildSessionConfig()]];
    mockLoadSessionRegistryCache.mockResolvedValue(undefined);
    mockGetAllSessionEntries.mockImplementation(() => sessionEntries);
    mockResolveCorsProxyUrl.mockResolvedValue({
      url: 'https://worker.example.test',
      source: 'session-config',
      status: 'ok',
    });
    mockUploadSessionMetadata.mockResolvedValue({
      txId: 'metadata_tx_id',
      metadataUri: 'ar://metadata_tx_id',
    });
    mockUpdateSessionMetadataOnChain.mockResolvedValue({
      ok: true,
      txHash: '0xmetadatahash',
    });
    mockBuildSignedAdminActionAuth.mockImplementation(async ({ action, slug }) => ({
      address: ADMIN_ADDRESS,
      signature: '0xtyped-admin-request',
      action,
      slug,
      bodyHash: '0xbodyhash',
      nonce: 'typed-admin-nonce',
      audience: 'http://localhost:3000',
      expiration: 1700000000,
    }));
    web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    web3ProviderSpy?.mockRestore();
  });

  it('shows Arweave and faucet balances inline with worker secrets and refreshes both cards', async () => {
    const arweaveAddress = MOCK_ARWEAVE_ADDRESS;
    const arweaveShort = `${arweaveAddress.slice(0, 6)}…${arweaveAddress.slice(-4)}`;
    const faucetWallet = ethers.Wallet.createRandom();
    const faucetPrivateKey = faucetWallet.privateKey;
    const faucetAddress = faucetWallet.address;
    const faucetShort = `${faucetAddress.slice(0, 6)}…${faucetAddress.slice(-4)}`;
    mockReadProvider.getBalance.mockResolvedValue(ethers.utils.parseEther('0.1842'));
    mockReadArweaveWalletBalance.mockResolvedValue({
      address: arweaveAddress,
      balanceUrl: `https://arweave.example.test/wallet/${arweaveAddress}/balance`,
      gatewayBase: 'https://arweave.example.test',
      winston: '12345678000000',
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Arweave' }));
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

    fireEvent.change(getSecretInputByLabel('Arweave JWK (JSON)'), {
      target: { value: JSON.stringify(MOCK_ARWEAVE_JWK) },
    });
    fireEvent.change(getSecretInputByLabel('Faucet private key'), {
      target: { value: faucetPrivateKey },
    });

    await waitFor(() => {
      expect(mockReadArweaveWalletBalance).toHaveBeenCalledTimes(1);
      expect(mockReadProvider.getBalance).toHaveBeenCalledTimes(1);
    });
    expect(await within(workerSecretsPanel).findByText('12.345678 AR')).toBeInTheDocument();
    expect(within(workerSecretsPanel).getByText('0.1842 ETH')).toBeInTheDocument();
    expect(within(workerSecretsPanel).getByText(arweaveShort)).toBeInTheDocument();
    expect(within(workerSecretsPanel).getByText(`${faucetShort} • Base Sepolia (84532)`)).toBeInTheDocument();
    expect(screen.queryByText('Resources')).not.toBeInTheDocument();

    expect(workerSecretsPanel).not.toHaveTextContent(faucetPrivateKey);

    await clickAndSettle(screen.getByRole('button', { name: 'Refresh Arweave balance' }));
    await clickAndSettle(screen.getByRole('button', { name: 'Refresh faucet balance' }));

    await waitFor(() => {
      expect(mockReadArweaveWalletBalance).toHaveBeenCalledTimes(2);
      expect(mockReadProvider.getBalance).toHaveBeenCalledTimes(2);
    });
  });

  it('accepts bare hex faucet private keys when previewing faucet balance', async () => {
    const faucetWallet = ethers.Wallet.createRandom();
    const faucetPrivateKey = faucetWallet.privateKey.slice(2);
    const faucetAddress = faucetWallet.address;
    const faucetShort = `${faucetAddress.slice(0, 6)}…${faucetAddress.slice(-4)}`;
    mockReadProvider.getBalance.mockResolvedValue(ethers.utils.parseEther('0.1842'));

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

    fireEvent.change(getSecretInputByLabel('Faucet private key'), {
      target: { value: faucetPrivateKey },
    });

    await waitFor(() => {
      expect(mockReadProvider.getBalance).toHaveBeenCalledTimes(1);
    });
    expect(await within(workerSecretsPanel).findByText('0.1842 ETH')).toBeInTheDocument();
    expect(within(workerSecretsPanel).getByText(`${faucetShort} • Base Sepolia (84532)`)).toBeInTheDocument();
    expect(within(workerSecretsPanel).queryByText('Invalid key')).not.toBeInTheDocument();
  });

  it('hides zero-balance resource summaries in worker secrets', async () => {
    const faucetWallet = ethers.Wallet.createRandom();
    mockReadProvider.getBalance.mockResolvedValue(ethers.constants.Zero);
    mockReadArweaveWalletBalance.mockResolvedValue({
      address: MOCK_ARWEAVE_ADDRESS,
      balanceUrl: 'https://arweave.example.test/wallet/test/balance',
      gatewayBase: 'https://arweave.example.test',
      winston: '5',
    });

    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Arweave' }));
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

    fireEvent.change(getSecretInputByLabel('Arweave JWK (JSON)'), {
      target: { value: JSON.stringify(MOCK_ARWEAVE_JWK) },
    });
    fireEvent.change(getSecretInputByLabel('Faucet private key'), {
      target: { value: faucetWallet.privateKey },
    });

    await waitFor(() => {
      expect(mockReadArweaveWalletBalance).toHaveBeenCalledTimes(1);
      expect(mockReadProvider.getBalance).toHaveBeenCalledTimes(1);
      expect(within(workerSecretsPanel).queryByText('Arweave balance')).not.toBeInTheDocument();
      expect(within(workerSecretsPanel).queryByText('Faucet balance')).not.toBeInTheDocument();
      expect(within(workerSecretsPanel).queryByText('0.000000 AR')).not.toBeInTheDocument();
      expect(within(workerSecretsPanel).queryByText('0.0000 ETH')).not.toBeInTheDocument();
    });
  }, 15000);

  it('shows invalid resource states when the Arweave JWK or faucet key cannot be parsed', async () => {
    await renderAdminPage();
    await waitForResolvedWorkerUrl();

    const workerSecretsPanel = await openWorkerSecretsPanel();
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Arweave' }));
    fireEvent.click(within(workerSecretsPanel).getByRole('button', { name: 'Faucet' }));

    fireEvent.change(getSecretInputByLabel('Arweave JWK (JSON)'), {
      target: { value: '{' },
    });
    fireEvent.change(getSecretInputByLabel('Faucet private key'), {
      target: { value: 'not-a-private-key' },
    });

    expect(await within(workerSecretsPanel).findByText('Invalid JWK')).toBeInTheDocument();
    expect(await within(workerSecretsPanel).findByText('Invalid key')).toBeInTheDocument();
    expect(mockReadArweaveWalletBalance).not.toHaveBeenCalled();
    expect(mockReadProvider.getBalance).not.toHaveBeenCalled();
  });
});
