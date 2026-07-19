// SessionWizard deploy render coverage owns worker deploy, post-deploy sync, and Lit provisioning.
import fs from 'fs';
import React from 'react';
import { ethers } from 'ethers';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  getContractViewerCardTestId,
  getContractViewerSourceTestId,
  getSessionWizardContractModalTriggerTestId,
  getSessionWizardContractTooltipTestId,
  WIZARD_CONTRACT_MODAL_TESTID,
} from '../ContractPage/contractMetadata.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

const mockRegisterSessionOnChain = jest.fn();
const mockFetchSessionFromRegistry = jest.fn();
const mockUpsertSessionRegistryCache = jest.fn();
const mockSessionExists = jest.fn(async () => false);
const mockCreateSBT = jest.fn();
const mockFinalizeDeferredCreateSbtDraftUpload = jest.fn();
const mockDownloadDataFromArweave = jest.fn();
const mockDecryptWithPassword = jest.fn();
const mockPendingSbtAddress = ethers.utils.getAddress('0x5fbdb2315678afecb367f032d93f642f64180aa3');
const mockSecondPendingSbtAddress = ethers.utils.getAddress('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
const mockReplacementSbtAddress = ethers.utils.getAddress('0x8ba1f109551bd432803012645ac136ddd64dba72');
const mockTestAdminAddress = '0x00000000000000000000000000000000000000aa';
const TEST_ADMIN_ADDRESS = mockTestAdminAddress;
const NEW_SESSION_BANNER_DISMISSED_KEY = 'ce_new_session_banner_dismissed';
const ORIGINAL_PUBLIC_URL = process.env.PUBLIC_URL;
const mockSelectorSourceFactory = '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA';
const mockSelectorSourceStartBlock = 30297069;
const buildMockSponsoredBundleEnvelope = () =>
  JSON.stringify({
    type: 'contextengine-sponsored-bundle',
    version: 1,
    cipher: 'password-aes-gcm',
    encryptedData: 'encrypted-base64',
  });
const buildMockSponsoredBundle = () => ({
  openaiKey: 'sponsored-openai',
  arweaveJwk: '{"kty":"RSA","n":"sponsored"}',
  litAccountApiKey: 'sponsored-lit-account-key',
  faucetGrantToken: 'sponsored-faucet-grant',
  deployGrantToken: 'sponsored-deploy-grant',
  meta: {
    label: 'Launch Week',
    createdAt: '2099-03-20T12:00:00.000Z',
    createdBy: '0xadmin',
    expiresAt: '2099-03-21T12:00:00.000Z',
    sourceSessionSlug: 'source-session',
    sourceWorkerUrl: 'https://source-worker.example.test',
  },
});
const buildMockPendingSbtDraft = ({
  predictedAddress = mockPendingSbtAddress,
  displayName = 'Pending SBT',
  contractName = displayName,
  symbol = 'CE-SBT-PEND',
  create2Salt = 'test/pending',
  tokenURI = 'ar://pending',
  metadataPreview = {},
  authoringPayload = { sbtName: displayName, _sessionSlug: 'general' },
  passwordList = ['claim-code-1'],
  groupPassword = 'shared-secret',
  usesInviteCodes = false,
  deployed = false,
} = {}) => ({
  id: `pending-${predictedAddress.toLowerCase()}`,
  predictedAddress,
  displayName,
  contractName,
  symbol,
  create2Salt,
  limitedNumber: 0,
  adminAddress: '0xCreator',
  mintingEndTimeUnix: 0,
  hasPasswordMintOnChain: false,
  burnAuthEnum: 0,
  hashedPasswords: [],
  tokenURI,
  metadataUploadStatus: 'ready',
  finalGroupPasswordHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
  metadataPreview,
  authoringPayload,
  passwordList,
  groupPassword,
  usesInviteCodes,
  deployed,
});
let mockCreateSbtDraftQueue = [];

jest.mock('../SBTs/SBTSelector', () => (props) => {
  const selectedEntries = Array.isArray(props.selectedSBTs) ? props.selectedSBTs : [];
  return (
    <div
      data-testid="mock-wizard-sbt-selector"
      data-selector-id={props.id || ''}
      data-session-slug={props.sessionSlug || ''}
      data-session-config-slug={props.sessionConfig?.slug || ''}
      data-session-config-start={props.sessionConfig?.blockLimits?.start ?? ''}
      data-session-config-factory={props.sessionConfig?.contracts?.sbtFactory?.address || ''}
      data-chain-id={props.chainId ?? ''}
      data-selected-addresses={selectedEntries
        .map((entry) => (typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress || ''))
        .filter(Boolean)
        .join(',')}
    >
      <button
        type="button"
        onClick={() =>
          props.onAddSBT?.({
            address: mockReplacementSbtAddress,
            name: 'Replacement SBT',
          })
        }
      >
        {`Mock add ${props.id || 'selector'} SBT`}
      </button>
      {selectedEntries.map((entry) => {
        const address = typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress || '';
        if (!address) return null;
        return (
          <button key={address} type="button" onClick={() => props.onRemoveSBT?.(address)}>
            {`Mock remove ${address} from ${props.id || 'selector'}`}
          </button>
        );
      })}
    </div>
  );
});
jest.mock('../SBTs/CreateSBTGroup', () => ({
  __esModule: true,
  default: (props) => (
    <div
      data-testid="mock-create-sbt-group"
      data-session-slug={props.sessionSlug || ''}
      data-session-config-slug={props.sessionConfigOverride?.slug || ''}
      data-arweave-jwk={props.arweaveJwkOverride || ''}
    >
      <button
        type="button"
        onClick={() => {
          const nextDraft = mockCreateSbtDraftQueue.length
            ? mockCreateSbtDraftQueue.shift()
            : buildMockPendingSbtDraft();
          props.onSaveDraft?.(JSON.parse(JSON.stringify(nextDraft)));
        }}
      >
        Save pending SBT
      </button>
    </div>
  ),
  finalizeDeferredCreateSbtDraftUpload: (...args) => mockFinalizeDeferredCreateSbtDraftUpload(...args),
}));
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

jest.mock('../../utilities/arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: jest.fn(),
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
    fetchSessionFromRegistry: (...args) => mockFetchSessionFromRegistry(...args),
    upsertSessionRegistryCache: (...args) => mockUpsertSessionRegistryCache(...args),
  },
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    createSBT: (...args) => mockCreateSBT(...args),
    getSbtMetadata: jest.fn(async () => ({})),
  },
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
          address: mockSelectorSourceFactory,
          chainId: 84532,
        },
      },
      blockLimits: {
        start: mockSelectorSourceStartBlock,
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
          address: mockSelectorSourceFactory,
          chainId: 84532,
        },
      },
      blockLimits: {
        start: mockSelectorSourceStartBlock,
        end: null,
      },
    };
  }),
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  buildSiweMessage: jest.fn(() => 'siwe-message'),
  buildSignedBootstrapAdminAuth: jest.fn(async ({ slug }) => ({
    address: mockTestAdminAddress,
    message: 'bootstrap-siwe-message',
    signature: '0xbootstrap-admin-auth',
    sessionSlug: slug,
  })),
  buildSignedAdminActionAuth: jest.fn(async ({ action, slug, body }) => ({
    address: mockTestAdminAddress,
    signature: '0xadmin-action-signature',
    action,
    slug,
    bodyHash: '0xadmin-body-hash',
    nonce: 'wizard-admin-nonce',
    audience: 'http://localhost',
    expiration: 4102444800,
    __body: body,
  })),
  normalizeWorkerUrl: jest.fn((value = '') => String(value || '').trim()),
}));

jest.mock('../../utilities/web3/rpcReadCache.js', () => ({
  wrapEthersJsonRpcSend: jest.fn((provider) => provider),
}));

jest.mock('../../variables/appConfig.js', () => {
  const actual = jest.requireActual('../../variables/appConfig.js');
  return { ...actual };
});

import SessionWizard, {
  buildPublishedPendingSbtLinks,
  getSessionWizardPublishProgressPercent,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  persistSessionWizardSbtRecoveryCodes,
  promotePendingSbtSelectionsAfterDeploy,
  resolveSessionWizardSelectorSourceConfig,
  resolveSessionWizardWorkerBaseUrl,
} from './SessionWizard';
import { resolveSessionWizardChipotleHookConfig } from './sessionWizardWorkerSecretSupport';

const renderSessionWizard = (props = {}) => render(<SessionWizard network={{ id: 84532 }} {...props} />);
const createTooltipStore = (tooltipsEnabled = true) =>
  createStore((state = { sessionState: { tooltipsEnabled } }, action) => {
    if (action.type === 'SET_TOOLTIPS') {
      return {
        sessionState: {
          tooltipsEnabled: action.payload,
        },
      };
    }
    return state;
  });
const renderSessionWizardWithTooltipStore = ({ tooltipsEnabled = true, props = {} } = {}) => {
  const store = createTooltipStore(tooltipsEnabled);
  const view = render(
    <Provider store={store}>
      <SessionWizard network={{ id: 84532 }} {...props} />
    </Provider>,
  );
  return { store, ...view };
};
const renderLoggedInSessionWizard = (props = {}) =>
  renderSessionWizard({
    account: TEST_ADMIN_ADDRESS,
    loginComplete: true,
    toggleLoginModal: jest.fn(),
    ...props,
  });
const getWizardResourceCard = (resourceKey) =>
  screen
    .getAllByTestId(E2E_TESTIDS.WIZARD_RESOURCE_CARD)
    .find((card) => card.getAttribute('data-ce-resource-key') === resourceKey);
const enableAdvancedMode = () => {
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
};
const selectNormalModeCard = (label) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
};
const getMockSelectorById = (selectorId) =>
  screen
    .queryAllByTestId('mock-wizard-sbt-selector')
    .find((node) => node.getAttribute('data-selector-id') === selectorId);
const expectSelectorAddresses = async (selectorId, expectedAddresses) => {
  await waitFor(() => {
    const selector = getMockSelectorById(selectorId);
    expect(selector).toBeTruthy();
    expect(selector).toHaveAttribute('data-selected-addresses', expectedAddresses.join(','));
  });
};
const openAdvancedMoreOptions = async () => {
  enableAdvancedMode();
  fireEvent.click(screen.getByRole('button', { name: /more options/i }));
};
const getFeaturedCreateButton = async () =>
  await waitFor(() => {
    const button = screen
      .getAllByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT)
      .find((node) => node.getAttribute('data-ce-sbt-target') === 'defaultFeaturedSBTs');
    expect(button).toBeTruthy();
    return button;
  });
const ensureGateASelectorVisible = async () => {
  if (!getMockSelectorById('encryption-gate-gate-1')) {
    fireEvent.click(screen.getByRole('button', { name: /groups allowed to decrypt locked fields/i }));
  }
  await waitFor(() => {
    expect(getMockSelectorById('encryption-gate-gate-1')).toBeTruthy();
  });
};
const createPendingFeaturedDraft = async () => {
  await openAdvancedMoreOptions();
  fireEvent.click(await getFeaturedCreateButton());
  fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));
  await waitFor(() => {
    expect(screen.queryByTestId('mock-create-sbt-group')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toContain(mockPendingSbtAddress);
  });
};

describe('SessionWizard deploy render validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSbtDraftQueue = [];
    mockCreateSBT.mockReset();
    mockFinalizeDeferredCreateSbtDraftUpload.mockReset();
    mockDownloadDataFromArweave.mockReset();
    mockDecryptWithPassword.mockReset();
    mockDownloadDataFromArweave.mockResolvedValue(buildMockSponsoredBundleEnvelope());
    mockDecryptWithPassword.mockResolvedValue(buildMockSponsoredBundle());
    if (typeof ORIGINAL_PUBLIC_URL === 'undefined') {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = ORIGINAL_PUBLIC_URL;
    }
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    sessionStorage.clear();
    buildContractViewerContracts.mockImplementation(({ sessionContracts = {} } = {}) =>
      Object.keys(sessionContracts).map((contractKey) => ({
        key: contractKey,
        name:
          contractKey === 'surveys'
            ? 'Questions and Surveys'
            : contractKey === 'sbtFactory'
              ? 'SBT Factory'
              : contractKey === 'sessionRegistry'
                ? 'Session Registry'
                : contractKey,
        explainer: `Explainer for ${contractKey}`,
        sourceFile:
          contractKey === 'surveys'
            ? 'Surveys.sol'
            : contractKey === 'sbtFactory'
              ? 'SBTFactory.sol'
              : contractKey === 'sessionRegistry'
                ? 'SessionRegistry.sol'
                : 'Contract.sol',
        source: `contract ${contractKey} {}`,
        addresses: sessionContracts[contractKey]?.address
          ? [
              {
                address: sessionContracts[contractKey].address,
                id: sessionContracts[contractKey].chainId || 84532,
                testnet: true,
                explorerUrl: `https://example.example.test/${contractKey}`,
              },
            ]
          : [],
      })),
    );
  });

  it('excludes cached legacy Lit payer secrets from deploy payloads', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        getAddress: jest.fn().mockResolvedValue(TEST_ADMIN_ADDRESS),
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
    const verifyMessageSpy = jest.spyOn(ethers.utils, 'verifyMessage').mockReturnValue(TEST_ADMIN_ADDRESS);
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        workerSecretsEnabled: true,
        workerSecrets: {
          litPayerPrivateKey: '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5',
          litPayerAddress: '0x3AC823CA9AcDA550244C6fF4927b5e1478E70Ff7',
        },
        provisionedSponsoredContext: {
          sessionSlug: 'hidden-lit-session',
          workerUrl: 'https://deployed.example.test',
          fields: {
            sponsored_lit: '1',
          },
        },
      }),
    );

    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
    global.fetch = jest.fn(async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/account')) {
        return { ok: true, json: async () => ({ accountId: 'cf-account-1', accountName: 'Test Account' }) };
      }
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
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
      renderSessionWizard({
        account: TEST_ADMIN_ADDRESS,
        toggleLoginModal: jest.fn(),
      });
      enableAdvancedMode();

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Hidden Lit Deploy Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'hidden-lit-deploy-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const deployHelperInput = screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL);
      fireEvent.change(deployHelperInput, {
        target: { value: 'https://deploy-helper.example.test' },
      });
      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-latest' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"abc"}' },
      });

      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY)).toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_API_BASE)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_PRIVATE_KEY)).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      let deployCall;
      await waitFor(() => {
        deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
        expect(deployCall).toBeTruthy();
      });

      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.secrets).toEqual(
        expect.objectContaining({
          openaiKey: 'sk-latest',
          arweaveJwk: '{"kty":"RSA","n":"abc"}',
        }),
      );
      expect(deployPayload.secrets.litPayerPrivateKey).toBeUndefined();
      expect(deployPayload.secrets.litPayerAddress).toBeUndefined();

      await waitFor(() => {
        const cached = JSON.parse(sessionStorage.getItem('ce:sessionWizardDraft:v1') || '{}');
        expect(cached.provisionedSponsoredContext?.fields?.sponsored_lit).toBe('0');
      });
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });

  it('sends the latest worker secret snapshot in the deploy payload from advanced mode', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        getAddress: jest.fn().mockResolvedValue(TEST_ADMIN_ADDRESS),
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
    const verifyMessageSpy = jest.spyOn(ethers.utils, 'verifyMessage').mockReturnValue(TEST_ADMIN_ADDRESS);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
    global.fetch = jest.fn(async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/account')) {
        return { ok: true, json: async () => ({ accountId: 'cf-account-1', accountName: 'Test Account' }) };
      }
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
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
      renderSessionWizard({
        account: TEST_ADMIN_ADDRESS,
        toggleLoginModal: jest.fn(),
      });
      enableAdvancedMode();
      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: '84532' },
      });

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Timing Regression Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'timing-regression-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_NAME)).toHaveTextContent('timing-regression-session');
      });
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).not.toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED)).toBeChecked();

      const deployHelperInput = screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL);
      fireEvent.change(deployHelperInput, {
        target: { value: 'https://deploy-helper.example.test' },
      });
      await waitFor(() => {
        expect(deployHelperInput).toHaveValue('https://deploy-helper.example.test');
      });
      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      expect(reactPropsKey).toBeTruthy();
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('cf-test-token');
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-older' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-latest' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '  {"kty":"RSA","n":"abc"}  ' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY), {
        target: { value: ' account-secret ' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      let deployCall;
      await waitFor(() => {
        deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
        if (!deployCall) {
          const deployStatus = screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)?.textContent || '<none>';
          throw new Error(`Deploy call not found. Status: ${deployStatus}`);
        }
      });

      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.embeddedDeployHelperEnabled).toBe(true);
      expect(deployPayload.secrets).toEqual(
        expect.objectContaining({
          openaiKey: 'sk-latest',
          arweaveJwk: '{"kty":"RSA","n":"abc"}',
          litAccountApiKey: 'account-secret',
        }),
      );

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue('https://deployed.example.test');

      expect(workerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'set-secrets',
          body: expect.objectContaining({
            secrets: expect.objectContaining({
              openaiKey: 'sk-latest',
              arweaveJwk: '{"kty":"RSA","n":"abc"}',
              litAccountApiKey: 'account-secret',
            }),
          }),
        }),
      );
      const secretsSyncCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
      const secretsSyncPayload = JSON.parse(secretsSyncCall[1].body);
      expect(secretsSyncPayload.secrets).toEqual(
        expect.objectContaining({
          openaiKey: 'sk-latest',
          arweaveJwk: '{"kty":"RSA","n":"abc"}',
          litAccountApiKey: 'account-secret',
        }),
      );

      await waitFor(() => {
        const cachedRaw = sessionStorage.getItem('ce:sessionWizardDraft:v1') || '{}';
        expect(JSON.parse(cachedRaw)).toEqual(
          expect.objectContaining({
            provisionedSponsoredContext: expect.objectContaining({
              workerUrl: 'https://deployed.example.test',
              fields: expect.objectContaining({
                sponsored_lit: '1',
              }),
            }),
          }),
        );
      });
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/account'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });

  it('auto-provisions the default Chipotle Lit action after deploy when the wizard has group and PKP config', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        getAddress: jest.fn().mockResolvedValue(TEST_ADMIN_ADDRESS),
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
    const verifyMessageSpy = jest.spyOn(ethers.utils, 'verifyMessage').mockReturnValue(TEST_ADMIN_ADDRESS);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
    global.fetch = jest.fn(async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      if (normalizedUrl.endsWith('/admin/lit-chipotle-provision')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            litActionCid: 'QmZPKjGtD4qLZhr17juP8XgUKV1A34Y9GtUUpeJNJ7f2vL',
            litGroupId: '7',
          }),
        };
      }
      if (normalizedUrl.endsWith('/admin/set-config')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          workerSecretsEnabled: true,
          workerSecrets: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: 'ce-session-content-prod',
            litPkpId: '0x1e5ed88b177bde881bb5e68b338c26c675e8f142',
            litUsageApiKey: 'lit-usage-key',
          },
        }),
      );
      renderSessionWizard({
        account: TEST_ADMIN_ADDRESS,
        toggleLoginModal: jest.fn(),
      });
      enableAdvancedMode();
      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: '84532' },
      });

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Chipotle Provision Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'chipotle-provision-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const deployHelperInput = screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL);
      fireEvent.change(deployHelperInput, {
        target: { value: 'https://deploy-helper.example.test' },
      });
      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-latest' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"abc"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          'Lit provisioning note: Lit action auto-provisioned.',
        );
      });

      expect(workerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'lit-chipotle-provision',
          body: expect.objectContaining({
            litGroupId: 'ce-session-content-prod',
            litPkpId: '0x1e5ed88b177bde881bb5e68b338c26c675e8f142',
          }),
        }),
      );

      const provisionCall = global.fetch.mock.calls.find(([url]) =>
        String(url).endsWith('/admin/lit-chipotle-provision'),
      );
      const provisionPayload = JSON.parse(provisionCall[1].body);
      expect(provisionPayload.actionName).toBe('ce-sbt-gated-crypto-v3');

      const configSyncCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-config'));
      const configSyncPayload = JSON.parse(configSyncCall[1].body);
      expect(configSyncPayload.config.litCredentials).toEqual(
        expect.objectContaining({
          litActionCid: 'QmZPKjGtD4qLZhr17juP8XgUKV1A34Y9GtUUpeJNJ7f2vL',
          litGroupId: '7',
        }),
      );
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });

  it('auto-bootstraps Lit runtime from the Lit API key and ignores stale hidden runtime fields', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const litProtocol = require('../../utilities/crypto/litProtocol.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    litProtocol.createLitHooks.mockClear();
    const web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        getAddress: jest.fn().mockResolvedValue(TEST_ADMIN_ADDRESS),
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
    const verifyMessageSpy = jest.spyOn(ethers.utils, 'verifyMessage').mockReturnValue(TEST_ADMIN_ADDRESS);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
    global.fetch = jest.fn(async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      if (normalizedUrl.endsWith('/admin/lit-chipotle-bootstrap-session')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            apiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: 'QmBootstrapAction123',
            litGroupId: '7',
            litPkpId: '0x1e5ed88b177bde881bb5e68b338c26c675e8f142',
          }),
        };
      }
      if (normalizedUrl.endsWith('/admin/set-config')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          workerSecretsEnabled: true,
          workerSecrets: {
            litApiBase: 'https://stale-chipotle.example.test',
            litGroupId: 'stale-group',
            litPkpId: 'stale-pkp',
            litActionCid: 'stale-cid',
            litUsageApiKey: 'stale-usage-key',
          },
        }),
      );
      renderSessionWizard({
        account: TEST_ADMIN_ADDRESS,
        toggleLoginModal: jest.fn(),
      });
      enableAdvancedMode();
      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: '84532' },
      });

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Chipotle Bootstrap Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'chipotle-bootstrap-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const deployHelperInput = screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL);
      fireEvent.change(deployHelperInput, {
        target: { value: 'https://deploy-helper.example.test' },
      });
      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-latest' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"abc"}' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY), {
        target: { value: 'lit-account-key' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          'Lit bootstrap note: Lit session account auto-created.',
        );
      });

      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.secrets).toEqual(
        expect.objectContaining({
          litAccountApiKey: 'lit-account-key',
        }),
      );
      expect(deployPayload.secrets.litUsageApiKey).toBeUndefined();
      expect(deployPayload.secrets.litApiBase).toBeUndefined();

      expect(workerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'lit-chipotle-bootstrap-session',
          body: expect.objectContaining({
            litAccountApiKey: 'lit-account-key',
            sessionName: 'Chipotle Bootstrap Session',
          }),
        }),
      );
      const bootstrapAuthCall = workerAuth.buildSignedAdminActionAuth.mock.calls.find(
        ([arg]) => arg?.action === 'lit-chipotle-bootstrap-session',
      );
      expect(bootstrapAuthCall[0].body.litApiBase).toBeUndefined();
      expect(bootstrapAuthCall[0].body.litUsageApiKey).toBeUndefined();
      const bootstrapCall = global.fetch.mock.calls.find(([url]) =>
        String(url).endsWith('/admin/lit-chipotle-bootstrap-session'),
      );
      const bootstrapPayload = JSON.parse(bootstrapCall[1].body);
      expect(bootstrapPayload.litAccountApiKey).toBe('lit-account-key');
      expect(bootstrapPayload.litUsageApiKey).toBeUndefined();
      expect(bootstrapPayload.litGroupId).toBeUndefined();
      await waitFor(() => {
        expect(litProtocol.createLitHooks).toHaveBeenCalledWith(
          expect.objectContaining({
            chipotle: expect.objectContaining({
              litCredentials: expect.objectContaining({
                litApiBase: 'https://api.chipotle.litprotocol.com',
                litGroupId: '7',
                litPkpId: '0x1e5ed88b177bde881bb5e68b338c26c675e8f142',
                litActionCid: 'QmBootstrapAction123',
              }),
            }),
          }),
        );
      });
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/admin/lit-chipotle-provision'))).toBe(
        false,
      );
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });

  it('skips browser secret sync when the deploy helper confirms it already wrote worker secrets', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        getAddress: jest.fn().mockResolvedValue(TEST_ADMIN_ADDRESS),
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
    const verifyMessageSpy = jest.spyOn(ethers.utils, 'verifyMessage').mockReturnValue(TEST_ADMIN_ADDRESS);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
    global.fetch = jest.fn(async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/account')) {
        return { ok: true, json: async () => ({ accountId: 'cf-account-1', accountName: 'Test Account' }) };
      }
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: true,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        throw new Error('browser secret sync should be skipped when helper writes secrets');
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderSessionWizard({
        account: TEST_ADMIN_ADDRESS,
        toggleLoginModal: jest.fn(),
      });
      enableAdvancedMode();
      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: '84532' },
      });

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Helper Secret Sync Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'helper-secret-sync-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const deployHelperInput = screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL);
      fireEvent.change(deployHelperInput, {
        target: { value: 'https://deploy-helper.example.test' },
      });
      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-latest' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"abc"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          'Secrets sync note: Deploy helper already wrote secrets; skipped browser post-deploy secret sync.',
        );
      });
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/account'))).toBe(false);
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/admin/set-secrets'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });

  it('backfills the deploy admin address from the connected wallet provider when account props lag behind', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const originalGetProvider = cryptoUtils._getProvider.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
    const providerRequest = jest.fn(async ({ method }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        return [TEST_ADMIN_ADDRESS];
      }
      return [];
    });
    cryptoUtils._getProvider.mockImplementation(() => ({
      request: providerRequest,
    }));
    global.fetch = jest.fn(async (url) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/account')) {
        return { ok: true, json: async () => ({ accountId: 'cf-account-1', accountName: 'Test Account' }) };
      }
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
        };
      }
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true, nonce: 'wizard-admin-nonce' }) };
    });

    try {
      renderSessionWizard({
        account: '',
        loginComplete: true,
        toggleLoginModal: jest.fn(),
      });
      enableAdvancedMode();
      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: '84532' },
      });

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Wallet Race Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'wallet-race-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-race' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"race"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      let deployCall;
      await waitFor(() => {
        deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
        expect(deployCall).toBeTruthy();
      });

      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.adminAddress).toBe(TEST_ADMIN_ADDRESS);
      expect(providerRequest.mock.calls.map(([payload]) => payload?.method)).not.toContain('eth_requestAccounts');
      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/account'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      cryptoUtils._getProvider.mockImplementation(originalGetProvider);
    }
  });
});
