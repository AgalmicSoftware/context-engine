import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';

const mockDownloadDataFromArweave = jest.fn();
const mockDecryptWithPassword = jest.fn();
const mockUploadDataToArweave = jest.fn();
const mockRegisterSessionOnChain = jest.fn();
const mockSessionExists = jest.fn(async () => false);
const TEST_ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const defaultNormalizeWorkerUrl = (value = '') => String(value || '').trim();
const testWebCrypto = require('crypto').webcrypto;
const originalCrypto = global.crypto;
const originalFetch = global.fetch;
const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

jest.setTimeout(20000);

jest.mock('../SBTs/SBTSelector', () => () => <div data-testid="mock-wizard-sbt-selector" />);
jest.mock('../SBTs/CreateSBTGroup', () => () => null);
jest.mock('../Gates/GateMultiSelectLock', () => () => <div data-testid="mock-wizard-gate-lock" />);
jest.mock('../Shared/Json/JsonControls', () => ({
  JsonToggleButton: () => null,
  JsonPanel: () => null,
  JsonButtonRow: () => null,
}));
jest.mock('../ContractPage/contractViewerUtils.js', () => ({
  buildContractViewerContracts: jest.fn(),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: jest.fn(() => []),
  createLitHooks: jest.fn(() => ({ saveKey: jest.fn(), getKey: jest.fn(), litNetwork: 'chipotle' })),
  resolveLitChain: jest.fn(() => 'baseSepolia'),
  getGlobalLitHooks: jest.fn(() => null),
  setGlobalLitHooks: jest.fn(),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => ({})),
    decryptWithPassword: (...args) => mockDecryptWithPassword(...args),
  },
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    uploadDataToArweave: (...args) => mockUploadDataToArweave(...args),
    downloadDataFromArweave: (...args) => mockDownloadDataFromArweave(...args),
    buildArweaveGatewayUrl: jest.fn((txId) => `https://arweave.example.test/${txId}`),
  },
}));

jest.mock('../../utilities/session/resourceKeys.js', () => ({
  getEffectiveArweaveKey: jest.fn(() => ''),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  registerSessionOnChain: (...args) => mockRegisterSessionOnChain(...args),
  sessionRegistryUtils: {
    normalizeSlug: jest.fn((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
    formatSessionId: jest.fn((value = '') => String(value || '').trim()),
    normalizeSessionIdHex: jest.fn((value = '') => String(value || '').trim()),
    toRegistrySlug: jest.fn((value = '') => String(value || '').trim()),
    getRegistryContract: jest.fn(() => ({
      sessionExists: (...args) => mockSessionExists(...args),
    })),
  },
}));

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  default: {},
  getSessionConfigBySlugOrDefault: jest.fn((slug = '') => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    if (normalized && normalized !== 'general') return null;
    return {
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA',
          chainId: 84532,
        },
      },
      blockLimits: {
        start: 30297069,
        end: null,
      },
    };
  }),
  getDemoSessionConfigBySlug: jest.fn((slug = '') => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    if (normalized && normalized !== 'general') return null;
    return {
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA',
          chainId: 84532,
        },
      },
      blockLimits: {
        start: 30297069,
        end: null,
      },
    };
  }),
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  buildSiweMessage: jest.fn(() => 'siwe-message'),
  buildSignedBootstrapAdminAuth: jest.fn(async ({ slug }) => ({
    address: '0x00000000000000000000000000000000000000aa',
    message: 'bootstrap-siwe-message',
    signature: '0xbootstrap-admin-auth',
    sessionSlug: slug,
  })),
  buildSignedAdminActionAuth: jest.fn(async ({ action, slug, body }) => ({
    address: '0x00000000000000000000000000000000000000aa',
    signature: '0xadmin-action-signature',
    action,
    slug,
    bodyHash: '0xadmin-body-hash',
    nonce: 'wizard-admin-nonce',
    audience: 'http://localhost',
    expiration: 4102444800,
    __body: body,
  })),
  normalizeWorkerUrl: jest.fn((value = '') => defaultNormalizeWorkerUrl(value)),
}));

jest.mock('../../utilities/web3/rpcReadCache.js', () => ({
  wrapEthersJsonRpcSend: jest.fn((provider) => provider),
}));

jest.mock('../../variables/appConfig.js', () => {
  const actual = jest.requireActual('../../variables/appConfig.js');
  return {
    ...actual,
  };
});

import SessionWizard, { __test__resetSessionWizardSponsoredBundleCacheKey } from './SessionWizard';
import { SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY } from '../../utilities/session/sponsoredBootstrapFunding.js';
import {
  SPONSORED_DEPLOY_NOTICE,
  SPONSORED_FAUCET_NOTICE,
  configureAdvancedUseUrlDeploy,
  continueNewSessionEntry,
  enableAdvancedMode,
  expectSponsoredStatus,
  getFieldInputByLabel,
  getToggleCheckbox,
  openWorkerPanel,
  selectNormalModeCard,
  setCloudflareTokenValue,
} from './SessionWizard.sponsoredBundleDom.testUtils';
import {
  buildDecryptedSponsoredBundle,
  buildEnvelope,
  buildMockContractViewerContracts,
  createDefaultFetchMock,
  createDeferred,
  seedWizardCache,
} from './SessionWizard.sponsoredBundleFixtures.testUtils';
import { createIndexedDbMock } from './SessionWizard.sponsoredBundleIndexedDb.testUtils';

const renderSessionWizard = (props = {}) => render(<SessionWizard network={{ id: 84532 }} {...props} />);
const renderLoggedInSessionWizard = (props = {}) =>
  renderSessionWizard({
    account: TEST_ADMIN_ADDRESS,
    loginComplete: true,
    toggleLoginModal: jest.fn(),
    ...props,
  });

describe('SessionWizard sponsored bundle flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __test__resetSessionWizardSponsoredBundleCacheKey();
    global.crypto = global.crypto?.subtle ? global.crypto : testWebCrypto;
    global.fetch = createDefaultFetchMock();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock(),
      configurable: true,
    });
    mockDownloadDataFromArweave.mockResolvedValue(buildEnvelope());
    mockUploadDataToArweave.mockResolvedValue('a'.repeat(43));
    mockRegisterSessionOnChain.mockResolvedValue({ txs: [] });
    buildContractViewerContracts.mockImplementation(buildMockContractViewerContracts);
    mockDecryptWithPassword.mockResolvedValue(buildDecryptedSponsoredBundle());
  });

  afterAll(() => {
    global.fetch = originalFetch;
    global.crypto = originalCrypto;
    if (originalIndexedDbDescriptor) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDbDescriptor);
    } else {
      delete globalThis.indexedDB;
    }
  });

  it('auto-applies sponsored bundle secrets, re-enables worker secrets, and disables secret persistence', async () => {
    seedWizardCache({
      workerSecretsEnabled: false,
      persistWorkerSecrets: true,
      workerSecrets: {
        openaiKey: 'cached-openai',
        customRpcKey: 'keep-me',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('sponsored-openai');
    expect(screen.queryByText('Anthropic key *')).not.toBeInTheDocument();
    expect(screen.queryByText('OpenRouter key')).not.toBeInTheDocument();
    expect(getFieldInputByLabel('Arweave JWK *')).toHaveValue('{"kty":"RSA"}');
    expect(getFieldInputByLabel('Faucet private key')).toHaveValue('0xsponsoredfaucet');
    expect(getFieldInputByLabel('Lit API key')).toHaveValue('lit-account-secret');
    expect(screen.queryByText('Lit usage API key')).not.toBeInTheDocument();
    expect(getFieldInputByLabel('Custom RPC URL')).toHaveValue('https://sponsored-rpc.example.test');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('');
    expect(getToggleCheckbox('Dev: keep secrets on refresh')).not.toBeChecked();
    expect(getToggleCheckbox('Require users to pay for usage')).not.toBeChecked();
    expect(JSON.parse(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY) || '{}')).toEqual({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example.test',
      targetSessionSlug: '',
    });

    await waitFor(() => {
      const cachedRaw = localStorage.getItem('ce:sessionWizardDraft:v1') || '{}';
      expect(cachedRaw).not.toContain('sponsored-openai');
      expect(cachedRaw).not.toContain('sponsored-rpc.example.test');
      expect(JSON.parse(cachedRaw)).toEqual(
        expect.objectContaining({
          persistWorkerSecrets: false,
          workerSecretsEnabled: true,
        }),
      );
    });
  }, 15000);

  it('keeps the sponsored bootstrap funding target slug aligned with the current draft slug', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
      target: { value: 'fresh-sponsored-target' },
    });

    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY) || '{}')).toEqual({
        sessionSlug: 'source-session',
        workerUrl: 'https://source-worker.example.test',
        targetSessionSlug: 'fresh-sponsored-target',
      });
    });
  }, 15000);

  it('persists faucet grant tokens in the sponsored bootstrap funding context', async () => {
    mockDecryptWithPassword.mockResolvedValueOnce({
      openaiKey: 'sponsored-openai',
      anthropicKey: 'sponsored-anthropic',
      openrouterKey: 'sponsored-openrouter',
      arweaveJwk: '{"kty":"RSA"}',
      faucetGrantToken: 'faucet-grant-token',
      bootstrapWorkerUrl: 'https://source-worker.example.test',
      meta: {
        label: 'Grant Flow',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2099-03-21T12:00:00.000Z',
        sourceSessionSlug: 'source-session',
        sourceWorkerUrl: 'https://source-worker.example.test',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    expect(JSON.parse(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY) || '{}')).toEqual({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example.test',
      targetSessionSlug: '',
      faucetGrantToken: 'faucet-grant-token',
    });
  }, 15000);

  it('clears stale deployed worker state from a previous session when a sponsored bundle is applied', async () => {
    const previousWorkerUrl = 'https://old-session-worker.example.test';
    seedWizardCache({
      deployComplete: true,
      deployWorkerUrl: previousWorkerUrl,
      draft: {
        corsWorkerUrl: previousWorkerUrl,
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    await waitFor(() => {
      const cachedRaw = localStorage.getItem('ce:sessionWizardDraft:v1') || '{}';
      expect(JSON.parse(cachedRaw)).toEqual(
        expect.objectContaining({
          deployComplete: false,
          deployWorkerUrl: '',
          draft: expect.objectContaining({
            corsWorkerUrl: '',
          }),
        }),
      );
    });
  }, 15000);

  it('skips the normal-mode worker step once the sponsored auto-deploy path is ready', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Sponsored Launch Session' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO), {
      target: { value: 'Deploy this with the sponsored worker.' },
    });

    const rail = document.querySelector('[aria-label="Normal mode sections"]');
    expect(rail).not.toBeNull();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /step 3: worker/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /step 3: deploy session/i })).toBeInTheDocument();
    });
    expect(rail).toHaveStyle('--session-wizard-card-count: 3');
  }, 15000);

  it('checks duplicate slugs before sponsored publish can auto-deploy a worker', async () => {
    let publishClicked = false;
    mockSessionExists.mockImplementation(async () => publishClicked);
    mockDecryptWithPassword.mockResolvedValueOnce(
      buildDecryptedSponsoredBundle({
        deployGrantToken: 'deploy-grant-token',
      }),
    );

    renderLoggedInSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Sponsored Duplicate Session' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO), {
      target: { value: 'This publish should stop before sponsored worker deployment.' },
    });

    selectNormalModeCard('Deploy Session');
    const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);

    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    publishClicked = true;
    fireEvent.click(publishButton);

    expect(
      await screen.findByText('Session slug already exists on-chain: sponsored-duplicate-session'),
    ).toBeInTheDocument();
    expect(mockSessionExists).toHaveBeenCalledWith('sponsored-duplicate-session');
    expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/deploy'))).toBe(false);
    expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/sponsored/redeem-deploy'))).toBe(false);
    expect(mockUploadDataToArweave).not.toHaveBeenCalled();
    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
  }, 15000);

  it('keeps advanced-mode file upload controls available for sponsored worker testing', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Sponsored Launch Session' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO), {
      target: { value: 'Deploy this with the sponsored worker.' },
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(await screen.findByText('Worker bundle source')).toBeInTheDocument();
    expect(screen.getAllByText('Upload file').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Use URL').length).toBeGreaterThan(0);
  }, 15000);

  it('removes the sponsored bundle hash secret after applying the bundle', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor_tx_id#k=bundle-secret&preview=1');

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    continueNewSessionEntry();
    await expectSponsoredStatus('Sponsored resources applied.');
    expect(window.location.hash).toBe('#preview=1');
  });

  it('keeps the prior sponsored status when the parent rerenders after hash scrubbing', async () => {
    const { rerender } = renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(1);

    rerender(
      <SessionWizard network={{ id: 84532 }} initialSponsoredBundleId="sponsor_tx_id" initialSponsoredBundleKey="" />,
    );

    await expectSponsoredStatus('Sponsored resources applied.');
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(1);
  });

  it('restores the pre-sponsored secrets and deploy token when the route is no longer sponsored', async () => {
    seedWizardCache({
      workerSecretsEnabled: false,
      persistWorkerSecrets: true,
      workerSecrets: {
        openaiKey: 'cached-openai',
        customRpcKey: 'keep-me',
      },
    });

    const { rerender } = renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('sponsored-openai');
    expect(getFieldInputByLabel('Custom RPC URL')).toHaveValue('https://sponsored-rpc.example.test');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('');
    expect(getToggleCheckbox('Dev: keep secrets on refresh')).not.toBeChecked();
    expect(getToggleCheckbox('Require users to pay for usage')).not.toBeChecked();

    rerender(<SessionWizard network={{ id: 84532 }} initialSponsoredBundleId="" initialSponsoredBundleKey="" />);

    await waitFor(() => {
      expect(screen.queryByTestId('ce-wizard-sponsored-status')).not.toBeInTheDocument();
    });
    expect(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY)).toBeNull();
    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('cached-openai');
    expect(getFieldInputByLabel('Custom RPC URL')).toHaveValue('');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('');
    expect(getToggleCheckbox('Dev: keep secrets on refresh')).toBeChecked();
    expect(getToggleCheckbox('Require users to pay for usage')).toBeChecked();
  });

  it('restores the latest local deploy and toggle edits after an in-flight sponsored bundle finishes', async () => {
    const deferredBundle = createDeferred();
    seedWizardCache({
      workerSecretsEnabled: true,
      persistWorkerSecrets: false,
      workerSecrets: {
        openaiKey: 'cached-openai',
      },
    });
    mockDownloadDataFromArweave.mockReturnValueOnce(deferredBundle.promise);

    const { rerender } = renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Loading sponsored bundle…');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    fireEvent.change(getFieldInputByLabel('OpenAI key *'), {
      target: { value: 'edited-openai' },
    });
    fireEvent.click(getToggleCheckbox('Dev: keep secrets on refresh'));
    fireEvent.click(getToggleCheckbox('Require users to pay for usage'));

    rerender(
      <SessionWizard
        network={{ id: 84532 }}
        account="0x00000000000000000000000000000000000000cc"
        initialSponsoredBundleId="sponsor_tx_id"
        initialSponsoredBundleKey="bundle-secret"
      />,
    );

    await waitFor(() => {
      expect(getFieldInputByLabel('Admin address')).toHaveValue('0x00000000000000000000000000000000000000cc');
    });

    rerender(
      <SessionWizard
        network={{ id: 84532 }}
        initialSponsoredBundleId="sponsor_tx_id"
        initialSponsoredBundleKey="bundle-secret"
      />,
    );

    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('edited-openai');
    expect(getToggleCheckbox('Dev: keep secrets on refresh')).toBeChecked();
    expect(getToggleCheckbox('Require users to pay for usage')).toBeChecked();

    await act(async () => {
      deferredBundle.resolve(buildEnvelope());
      await deferredBundle.promise;
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('sponsored-openai');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('');
    expect(getFieldInputByLabel('Admin address')).toHaveValue('0x00000000000000000000000000000000000000cc');
    expect(getToggleCheckbox('Dev: keep secrets on refresh')).not.toBeChecked();
    expect(getToggleCheckbox('Require users to pay for usage')).not.toBeChecked();

    rerender(<SessionWizard network={{ id: 84532 }} initialSponsoredBundleId="" initialSponsoredBundleKey="" />);

    await waitFor(() => {
      expect(screen.queryByTestId('ce-wizard-sponsored-status')).not.toBeInTheDocument();
    });
    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('edited-openai');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('');
    expect(getFieldInputByLabel('Admin address')).toHaveValue('0x00000000000000000000000000000000000000cc');
    expect(getToggleCheckbox('Dev: keep secrets on refresh')).toBeChecked();
    expect(getToggleCheckbox('Require users to pay for usage')).toBeChecked();
  });

  it('restores sponsored resources after the hash key is scrubbed within the same tab', async () => {
    const firstRender = renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const cachedRaw = sessionStorage.getItem('ce:sessionWizardSponsoredBundle:v1') || '';
      expect(cachedRaw).toContain('"ciphertext"');
      expect(cachedRaw).not.toContain('sponsored-openai');
      expect(cachedRaw).not.toContain('https://sponsored-rpc.example.test');
      expect(sessionStorage.getItem('ce:sessionWizardSponsoredBundle:ek:v1')).toBeNull();
    });

    firstRender.unmount();

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: '',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('sponsored-openai');
    expect(getFieldInputByLabel('Custom RPC URL')).toHaveValue('https://sponsored-rpc.example.test');
    expect(getFieldInputByLabel('Lit API key')).toHaveValue('lit-account-secret');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('');
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(1);
  });

  it('falls back to memory-only sponsored bundle cache storage when IndexedDB is unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
    });
    __test__resetSessionWizardSponsoredBundleCacheKey();

    const firstRender = renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    await waitFor(() => {
      const cachedRaw = sessionStorage.getItem('ce:sessionWizardSponsoredBundle:v1') || '';
      expect(cachedRaw).toContain('"ciphertext"');
      expect(sessionStorage.getItem('ce:sessionWizardSponsoredBundle:ek:v1')).toBeNull();
    });

    firstRender.unmount();
    __test__resetSessionWizardSponsoredBundleCacheKey();

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: '',
    });

    await expectSponsoredStatus('Malformed sponsored link.');
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(1);
  });

  it('preserves existing worker secrets when the sponsored bundle only provides a subset of fields', async () => {
    seedWizardCache({
      workerSecretsEnabled: true,
      persistWorkerSecrets: true,
      workerSecrets: {
        openaiKey: 'cached-openai',
        arweaveJwk: '{"kty":"cached"}',
        faucetPrivateKey: '0xcachedfaucet',
      },
    });
    mockDecryptWithPassword.mockResolvedValue({
      openaiKey: 'sponsored-openai',
      meta: {
        label: 'Partial bundle',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2099-03-21T12:00:00.000Z',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('sponsored-openai');
    expect(getFieldInputByLabel('Arweave JWK *')).toHaveValue('{"kty":"cached"}');
    expect(getFieldInputByLabel('Faucet private key')).toHaveValue('0xcachedfaucet');
  });

  it('shows advanced faucet provenance for sponsored raw faucet keys and hides it after manual edits', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    enableAdvancedMode();
    openWorkerPanel();

    expect(screen.getByText(SPONSORED_FAUCET_NOTICE)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_FAUCET_PRIVATE_KEY), {
      target: { value: '0xmanualfaucetoverride' },
    });

    expect(screen.queryByText(SPONSORED_FAUCET_NOTICE)).not.toBeInTheDocument();
  });

  it('shows advanced faucet provenance when faucet funding comes from a sponsored grant token', async () => {
    mockDecryptWithPassword.mockResolvedValueOnce(
      buildDecryptedSponsoredBundle({
        faucetPrivateKey: '',
        faucetGrantToken: 'faucet-grant-token',
      }),
    );

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    enableAdvancedMode();
    openWorkerPanel();

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_FAUCET_PRIVATE_KEY)).toHaveValue('');
    expect(screen.getByText(SPONSORED_FAUCET_NOTICE)).toBeInTheDocument();
  });

  it('shows advanced deploy provenance with a blank Cloudflare token field and hides it after manual edits', async () => {
    mockDecryptWithPassword.mockResolvedValueOnce(
      buildDecryptedSponsoredBundle({
        deployGrantToken: 'deploy-grant-token',
      }),
    );

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    enableAdvancedMode();
    openWorkerPanel();

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('');
    expect(screen.getByText(SPONSORED_DEPLOY_NOTICE)).toBeInTheDocument();

    setCloudflareTokenValue('cf-manual-token');

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('cf-manual-token');
    });
    expect(screen.queryByText(SPONSORED_DEPLOY_NOTICE)).not.toBeInTheDocument();
  });

  it('keeps advanced provenance notices scoped to the live sponsored bundle state', async () => {
    mockDecryptWithPassword.mockResolvedValue(
      buildDecryptedSponsoredBundle({
        deployGrantToken: 'deploy-grant-token',
      }),
    );

    const { rerender } = renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored resources applied.');
    enableAdvancedMode();
    openWorkerPanel();

    expect(screen.getByText(SPONSORED_FAUCET_NOTICE)).toBeInTheDocument();
    expect(screen.getByText(SPONSORED_DEPLOY_NOTICE)).toBeInTheDocument();

    rerender(<SessionWizard network={{ id: 84532 }} initialSponsoredBundleId="" initialSponsoredBundleKey="" />);

    await waitFor(() => {
      expect(screen.queryByTestId('ce-wizard-sponsored-status')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(SPONSORED_FAUCET_NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByText(SPONSORED_DEPLOY_NOTICE)).not.toBeInTheDocument();

    rerender(
      <SessionWizard
        network={{ id: 84532 }}
        initialSponsoredBundleId="sponsor_tx_id"
        initialSponsoredBundleKey="bundle-secret"
      />,
    );

    await expectSponsoredStatus('Sponsored resources applied.');
    expect(screen.getByText(SPONSORED_FAUCET_NOTICE)).toBeInTheDocument();
    expect(screen.getByText(SPONSORED_DEPLOY_NOTICE)).toBeInTheDocument();
  });

  it('surfaces advanced URL deploy failures without retrying a client-served local bundle', async () => {
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    seedWizardCache({
      draft: {
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-4o-mini' },
            thinking: { provider: 'openai', model: 'gpt-4.1-mini' },
          },
        },
      },
    });
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle: getaddrinfo ENOTFOUND bundles.example.test' }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();
      const bundleUrl = 'https://bundles.example.test/sessionCorsWorker.bundle.js';
      const { bundleModeUrlInput, bundleUrlInput } = await configureAdvancedUseUrlDeploy({ bundleUrl });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          'Failed to fetch bundle: getaddrinfo ENOTFOUND bundles.example.test',
        );
      });

      const deployCalls = global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/deploy'));
      expect(deployCalls).toHaveLength(1);

      const firstPayload = JSON.parse(deployCalls[0][1].body);
      expect(firstPayload.bundleUrl).toBe(bundleUrl);
      expect(firstPayload.bundleText).toBeUndefined();

      expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/worker/sessionCorsWorker.bundle.js'))).toBe(
        false,
      );
      expect(bundleModeUrlInput).toBeChecked();
      expect(bundleUrlInput).toHaveValue(bundleUrl);
    } finally {
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl || defaultNormalizeWorkerUrl);
    }
  });

  it('rejects expired bundles without mutating existing worker secret fields', async () => {
    seedWizardCache({
      workerSecretsEnabled: false,
      persistWorkerSecrets: true,
      workerSecrets: {
        openaiKey: 'cached-openai',
      },
    });
    mockDecryptWithPassword.mockResolvedValue({
      openaiKey: 'expired-openai',
      meta: {
        label: 'Expired',
        createdAt: '2000-03-20T11:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2000-03-20T11:30:00.000Z',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Sponsored bundle expired.');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('cached-openai');
    expect(getToggleCheckbox('Dev: keep secrets on refresh')).toBeChecked();
    expect(getToggleCheckbox('Require users to pay for usage')).toBeChecked();
  });

  it('removes the sponsored bundle hash secret after a terminal sponsored-bundle failure', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor_tx_id#k=bundle-secret&preview=1');
    mockDecryptWithPassword.mockResolvedValue({
      openaiKey: 'expired-openai',
      meta: {
        label: 'Expired',
        createdAt: '2000-03-20T11:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2000-03-20T11:30:00.000Z',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    continueNewSessionEntry();
    await expectSponsoredStatus('Sponsored bundle expired.');
    expect(window.location.hash).toBe('#preview=1');
  });

  it('rejects malformed envelopes without mutating existing worker secret fields', async () => {
    seedWizardCache({
      workerSecrets: {
        openaiKey: 'cached-openai',
      },
    });
    mockDownloadDataFromArweave.mockResolvedValue(
      JSON.stringify({
        type: 'not-a-sponsored-bundle',
        version: 1,
        cipher: 'password-aes-gcm',
        encryptedData: 'encrypted-base64',
      }),
    );

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Invalid sponsored bundle.');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(getFieldInputByLabel('OpenAI key *')).toHaveValue('cached-openai');
  });

  it('surfaces malformed sponsored links before any bundle download runs', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: '',
    });

    await expectSponsoredStatus('Malformed sponsored link.');
    expect(mockDownloadDataFromArweave).not.toHaveBeenCalled();
  });

  it('lets the user retry transient sponsored bundle load failures in place', async () => {
    mockDownloadDataFromArweave
      .mockRejectedValueOnce(new Error('gateway timeout'))
      .mockResolvedValueOnce(buildEnvelope());

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
      initialSponsoredBundleKey: 'bundle-secret',
    });

    await expectSponsoredStatus('Failed to load sponsored bundle.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await expectSponsoredStatus('Sponsored resources applied.');
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(2);
    expect(mockDownloadDataFromArweave.mock.calls[1]).toEqual([
      'sponsor_tx_id',
      expect.objectContaining({
        debugContext: expect.objectContaining({
          caller: 'SessionWizard.sponsoredBundle',
          source: 'session_wizard',
        }),
        bypassFailureCache: true,
      }),
    ]);
  });
});
