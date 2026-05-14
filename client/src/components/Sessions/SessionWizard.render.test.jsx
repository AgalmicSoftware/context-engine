/* eslint-disable import/first */
// Remaining broad SessionWizard render coverage owns section visibility, sponsored requirements, metadata details, slug validation, tooltips, and login guards.
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
const TEST_ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const NEW_SESSION_BANNER_DISMISSED_KEY = 'ce_new_session_banner_dismissed';
const ORIGINAL_PUBLIC_URL = process.env.PUBLIC_URL;
const mockSelectorSourceFactory = '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA';
const mockSelectorSourceStartBlock = 30297069;
const buildMockSponsoredBundleEnvelope = () => JSON.stringify({
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
    sourceWorkerUrl: 'https://source-worker.example',
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
        onClick={() => props.onAddSBT?.({
          address: mockReplacementSbtAddress,
          name: 'Replacement SBT',
        })}
      >
        {`Mock add ${props.id || 'selector'} SBT`}
      </button>
      {selectedEntries.map((entry) => {
        const address = typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress || '';
        if (!address) return null;
        return (
          <button
            key={address}
            type="button"
            onClick={() => props.onRemoveSBT?.(address)}
          >
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

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: (...args) => mockDownloadDataFromArweave(...args),
    buildArweaveGatewayUrl: jest.fn((txId) => `https://arweave.net/${txId}`),
  },
}));

jest.mock('../../utilities/session/resourceKeys.js', () => ({
  getEffectiveArweaveKey: jest.fn(() => ''),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  registerSessionOnChain: (...args) => mockRegisterSessionOnChain(...args),
  sessionRegistryUtils: {
    normalizeSlug: jest.fn((value = '') => String(value || '').trim().toLowerCase()),
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

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  default: {
    createSBT: (...args) => mockCreateSBT(...args),
    getSbtMetadata: jest.fn(async () => ({})),
  },
  getSessionConfigBySlugOrDefault: jest.fn((slug = '') => {
    const normalized = String(slug || '').trim().toLowerCase();
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
    const normalized = String(slug || '').trim().toLowerCase();
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
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  persistSessionWizardSbtRecoveryCodes,
  promotePendingSbtSelectionsAfterDeploy,
  resolveSessionWizardChipotleHookConfig,
  resolveSessionWizardSelectorSourceConfig,
  resolveSessionWizardWorkerBaseUrl,
} from './SessionWizard';

const renderSessionWizard = (props = {}) => render(<SessionWizard network={{ id: 84532 }} {...props} />);
const createTooltipStore = (tooltipsEnabled = true) => createStore(
  (state = { sessionState: { tooltipsEnabled } }, action) => {
    if (action.type === 'SET_TOOLTIPS') {
      return {
        sessionState: {
          tooltipsEnabled: action.payload,
        },
      };
    }
    return state;
  }
);
const renderSessionWizardWithTooltipStore = ({ tooltipsEnabled = true, props = {} } = {}) => {
  const store = createTooltipStore(tooltipsEnabled);
  const view = render(
    <Provider store={store}>
      <SessionWizard network={{ id: 84532 }} {...props} />
    </Provider>
  );
  return { store, ...view };
};
const renderLoggedInSessionWizard = (props = {}) => renderSessionWizard({
  account: TEST_ADMIN_ADDRESS,
  loginComplete: true,
  toggleLoginModal: jest.fn(),
  ...props,
});
const enableAdvancedMode = () => {
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
};
const selectNormalModeCard = (label) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
};
const getMockSelectorById = (selectorId) => (
  screen.queryAllByTestId('mock-wizard-sbt-selector')
    .find((node) => node.getAttribute('data-selector-id') === selectorId)
);
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
const getFeaturedCreateButton = async () => await waitFor(() => {
  const button = screen.getAllByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT).find(
    (node) => node.getAttribute('data-ce-sbt-target') === 'defaultFeaturedSBTs'
  );
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

describe('SessionWizard rendered validation', () => {
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
    buildContractViewerContracts.mockImplementation(({ sessionContracts = {} } = {}) => (
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
          ? [{
              address: sessionContracts[contractKey].address,
              id: sessionContracts[contractKey].chainId || 84532,
              testnet: true,
              explorerUrl: `https://example.example.test/${contractKey}`,
            }]
          : [],
      }))
    ));
  });

  it('shows only the selected section in default normal mode', async () => {
    renderSessionWizard({
      account: TEST_ADMIN_ADDRESS,
      toggleLoginModal: jest.fn(),
    });

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
    expect(sessionNameInput).toBeInTheDocument();
    expect(screen.queryByText('Session Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Privacy & Access')).not.toBeInTheDocument();
    expect(screen.queryByText('view .json')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)).not.toBeInTheDocument();

    selectNormalModeCard('Privacy');

    expect(await screen.findByText('Privacy & Access')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).not.toBeInTheDocument();
  });

  it('prefers the configured default registry chain on a fresh wizard with no wallet network', async () => {
    renderSessionWizard({ network: null });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();

    const defaultChainId = require('../../variables/appConfig.js').DEFAULT_CHAIN_ID;
    const defaultChain = require('../../variables/chains.js').getChainById(defaultChainId);
    const defaultChainLabel = `${defaultChain?.name || `Chain ${defaultChainId}`} (${defaultChainId})`;
    const chainSelectorWrap = screen.getByText('Network:').parentElement;
    expect(chainSelectorWrap).toBeTruthy();
    expect(within(chainSelectorWrap).getByRole('combobox')).toHaveValue(String(defaultChainId));
    expect(screen.getByDisplayValue(defaultChainLabel)).toBeInTheDocument();
  });

  it.each(['/new', '/session/new'])(
    'shows the new-session requirements banner on %s',
    async (pathname) => {
      window.history.replaceState({}, '', pathname);

      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
    }
  );

  it('shows the new-session requirements banner on PUBLIC_URL-prefixed new-session routes', async () => {
    process.env.PUBLIC_URL = '/ce/';
    window.history.replaceState({}, '', '/ce/session/new');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('renders the new-session requirements copy and contact link on /session/new', async () => {
    window.history.replaceState({}, '', '/session/new');

    renderSessionWizard({ network: null });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.getByRole('link', { name: 'OpenAI API key' })).toHaveAttribute(
      'href',
      'https://platform.openai.com/api-keys'
    );
    expect(screen.getByText(/for text and transcription/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lit account API key' })).toHaveAttribute(
      'href',
      'https://developer.litprotocol.com/management/api_keys'
    );
    expect(screen.getByRole('link', { name: 'Arweave wallet (JWK)' })).toHaveAttribute(
      'href',
      'https://docs.arweave.org/developers/wallets/arweave-wallet'
    );
    expect(screen.getByRole('link', { name: 'OP Sepolia ETH for on-chain registration' })).toHaveAttribute(
      'href',
      'https://console.optimism.io/faucet'
    );
    expect(screen.getByText('(Optional) A faucet private key for sponsoring user gas')).toBeInTheDocument();
    expect(screen.getByText('A turnkey tool for bundling these resources is in development.')).toBeInTheDocument();
    expect(
      screen.getByText(/in the meantime, you can get a sponsored session url by contacting/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contextengine@protonmail.com' })).toHaveAttribute(
      'href',
      'mailto:contextengine@protonmail.com'
    );
  });

  it('updates the new-session requirements chain label when the selected deploy chain changes', async () => {
    window.history.replaceState({}, '', '/session/new');

    renderSessionWizard({ network: null });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.getByText('OP Sepolia ETH for on-chain registration')).toBeInTheDocument();

    enableAdvancedMode();

    const chainSelectorWrap = screen.getByText('Network:').parentElement;
    expect(chainSelectorWrap).toBeTruthy();
    fireEvent.change(within(chainSelectorWrap).getByRole('combobox'), {
      target: { value: '31337' },
    });

    await waitFor(() => {
      expect(screen.getByText('Anvil ETH for on-chain registration')).toBeInTheDocument();
    });
    expect(screen.queryByText('OP Sepolia ETH for on-chain registration')).not.toBeInTheDocument();
  });

  it('does not show the new-session requirements banner when a sponsored bundle covers setup requirements', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id#k=sponsor-secret');

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
      'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, Lit account key, deploy access.'
    );
    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
  });

  it('keeps the new-session requirements banner visible when sponsored setup is missing deploy access', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id#k=sponsor-secret');
    const sponsoredBundleWithoutDeployAccess = buildMockSponsoredBundle();
    delete sponsoredBundleWithoutDeployAccess.deployGrantToken;
    mockDecryptWithPassword.mockResolvedValueOnce(sponsoredBundleWithoutDeployAccess);

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
      'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, Lit account key.'
    );
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('keeps the new-session requirements banner visible for partial sponsored bundles', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id#k=sponsor-secret');
    mockDecryptWithPassword.mockResolvedValueOnce({
      openaiKey: 'sponsored-openai',
      meta: {
        label: 'Partial bundle',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2099-03-21T12:00:00.000Z',
        sourceSessionSlug: 'source-session',
        sourceWorkerUrl: 'https://source-worker.example',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
      'Sponsored resources applied: OpenAI key.'
    );
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('shows the new-session requirements banner again when a sponsored link falls back to manual setup', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: '',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
      'Malformed sponsored link.'
    );
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('dismisses the new-session requirements banner and keeps it hidden after remount', async () => {
    window.history.replaceState({}, '', '/session/new');

    const firstRender = renderSessionWizard();

    await screen.findByRole('heading', { name: /to create a session you'll need:/i });

    fireEvent.click(screen.getByRole('button', { name: /dismiss session setup requirements/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(NEW_SESSION_BANNER_DISMISSED_KEY)).toBe('true');

    firstRender.unmount();
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
  });

  it('shows the requirements banner for manual sponsored fallback even after plain /new was dismissed', async () => {
    window.history.replaceState({}, '', '/session/new');

    const firstRender = renderSessionWizard();

    await screen.findByRole('heading', { name: /to create a session you'll need:/i });
    fireEvent.click(screen.getByRole('button', { name: /dismiss session setup requirements/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(NEW_SESSION_BANNER_DISMISSED_KEY)).toBe('true');

    firstRender.unmount();
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id#k=sponsor-secret');
    mockDecryptWithPassword.mockResolvedValueOnce({
      openaiKey: 'sponsored-openai',
      meta: {
        label: 'Partial bundle',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2099-03-21T12:00:00.000Z',
        sourceSessionSlug: 'source-session',
        sourceWorkerUrl: 'https://source-worker.example',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
      'Sponsored resources applied: OpenAI key.'
    );
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('does not show the new-session requirements banner outside the new-session routes', async () => {
    window.history.replaceState({}, '', '/');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
  });

  it('defaults auto-feature session groups to enabled for fresh /new drafts', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();

    expect(screen.getByRole('checkbox', { name: /Auto-feature Session/i })).toBeChecked();
  });

  it('keeps the image title row outside the stylized image control section in normal mode', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    const imageBar = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR);
    const imageGroup = imageBar.parentElement;

    if (!imageGroup) {
      throw new Error('Expected the compact image bar to stay within its form group.');
    }

    expect(within(imageGroup).getByText('Image')).toBeInTheDocument();
    expect(imageGroup.querySelector('svg[data-icon="question-circle"]')).not.toBeNull();
    expect(within(imageGroup).getByTestId('mock-wizard-gate-lock')).toBeInTheDocument();
    expect(within(imageBar).queryByText('Image')).not.toBeInTheDocument();
    expect(imageBar.querySelector('svg[data-icon="question-circle"]')).toBeNull();
    expect(within(imageBar).queryByTestId('mock-wizard-gate-lock')).not.toBeInTheDocument();
    expect(within(imageBar).getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL_TOGGLE)).toBeInTheDocument();
    expect(within(imageBar).getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE)).toBeInTheDocument();
    expect(within(imageBar).getByRole('button', { name: 'Upload image' })).toBeInTheDocument();
  });

  it('keeps the image area minimal until a clipboard URL is pasted, then expands it on click', async () => {
    const originalClipboard = navigator.clipboard;
    const read = jest.fn().mockResolvedValue([]);
    const readText = jest.fn().mockResolvedValue('https://example.com/session-header.png');

    try {
      localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
        draft: {
          sessionHeader: '',
        },
      }));
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read, readText },
      });

      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      expect(screen.queryByRole('img', { name: 'Session header preview' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Expand session header image' })).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE));
      });

      await waitFor(() => {
        expect(read).toHaveBeenCalledTimes(1);
        expect(readText).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue(
        'https://example.com/session-header.png'
      );
      expect(screen.queryByText('Pasted image from clipboard.')).not.toBeInTheDocument();
      expect(screen.queryByText('Pasted image URL from clipboard.')).not.toBeInTheDocument();

      const previewImage = await screen.findByRole('img', { name: 'Session header preview' });
      expect(previewImage).toHaveAttribute('src', 'https://example.com/session-header.png');
      expect(screen.getByRole('button', { name: 'Remove session header image' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Remove session header image' }));

      await waitFor(() => {
        expect(screen.queryByRole('img', { name: 'Session header preview' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove session header image' })).not.toBeInTheDocument();
        expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).not.toBeInTheDocument();
      });
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('accepts supported relative asset paths from the clipboard for session headers', async () => {
    const originalClipboard = navigator.clipboard;
    const read = jest.fn().mockResolvedValue([]);
    const readText = jest.fn().mockResolvedValue('assets/img/header.webp');

    try {
      localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
        draft: {
          sessionHeader: '',
        },
      }));
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read, readText },
      });

      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE));
      });

      await waitFor(() => {
        expect(read).toHaveBeenCalledTimes(1);
        expect(readText).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue(
        'assets/img/header.webp'
      );
      expect(screen.queryByText('Clipboard does not contain a supported image or URL.')).not.toBeInTheDocument();

      const previewImage = await screen.findByRole('img', { name: 'Session header preview' });
      expect(previewImage).toHaveAttribute('src', 'assets/img/header.webp');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('hides the mode toggle behind a cog when a sponsored link is present', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    const settingsButton = screen.getByRole('button', { name: 'Session wizard display settings' });
    const normalModeButton = screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL);
    const advancedModeButton = screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED);

    expect(settingsButton).toHaveAttribute('aria-expanded', 'false');
    expect(normalModeButton).not.toBeVisible();
    expect(advancedModeButton).not.toBeVisible();

    fireEvent.click(settingsButton);

    expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
    expect(normalModeButton).toBeVisible();
    expect(advancedModeButton).toBeVisible();

    fireEvent.click(advancedModeButton);

    await waitFor(() => {
      expect(settingsButton).toHaveAttribute('aria-expanded', 'false');
    });
    expect(screen.getByText('Advanced mode shows the full session configuration.')).toBeInTheDocument();
  });

  it('keeps session storage profile selection in advanced mode and defaults to Arweave', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByText('Session Storage')).not.toBeInTheDocument();

    enableAdvancedMode();

    expect(await screen.findByText('Session Storage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Session Storage expand' }));

    const arweaveOption = screen.getByRole('radio', { name: 'Arweave' });
    const cloudflareOption = screen.getByRole('radio', { name: 'Cloudflare' });
    expect(arweaveOption).toHaveAttribute('aria-checked', 'true');
    expect(cloudflareOption).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(cloudflareOption);

    await waitFor(() => {
      expect(arweaveOption).toHaveAttribute('aria-checked', 'false');
      expect(cloudflareOption).toHaveAttribute('aria-checked', 'true');
    });
    expect(screen.getByText(/R2 for blobs, D1 or KV for metadata\/indexes/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Worker SBT gate' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Lit encrypted' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/worker-enforced access control, not end-to-end encryption/i)).toBeInTheDocument();
  });

  it('hides Lit worker inputs for Cloudflare worker SBT gate mode and restores them for Lit encrypted mode', async () => {
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        storageProfile: {
          backend: 'cloudflare',
          payloadAccessControl: { mode: 'worker_sbt_gate' },
        },
      },
      workerSecretsEnabled: true,
    }));

    const firstRender = renderLoggedInSessionWizard();
    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');
    await waitFor(() => {
      expect(getWizardResourceCard('lit')).toBeUndefined();
    });
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY)).not.toBeInTheDocument();

    firstRender.unmount();
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        storageProfile: {
          backend: 'cloudflare',
          payloadAccessControl: { mode: 'lit_encrypted' },
        },
      },
      workerSecretsEnabled: true,
    }));

    renderLoggedInSessionWizard();
    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    const litCard = await waitFor(() => getWizardResourceCard('lit'));
    expect(litCard).toBeTruthy();
    expect(within(litCard).getByText('Lit account API key')).toBeInTheDocument();
  });

  it('defaults auto-feature session groups to enabled for sponsored /new drafts', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    fireEvent.click(screen.getByRole('button', { name: 'Session wizard display settings' }));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Session wizard display settings' })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('checkbox', { name: /Auto-feature Session/i })).toBeChecked();
  });

  it('pastes an image blob from the clipboard into the normal-mode image preview area', async () => {
    const originalClipboard = navigator.clipboard;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const clipboardBlob = new Blob(['clipboard-image'], { type: 'image/png' });
    const read = jest.fn().mockResolvedValue([{
      types: ['image/png'],
      getType: jest.fn().mockResolvedValue(clipboardBlob),
    }]);
    const readText = jest.fn().mockResolvedValue('');
    URL.createObjectURL = jest.fn(() => 'blob:clipboard-session-header-preview');
    URL.revokeObjectURL = jest.fn();

    try {
      localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
        draft: {
          sessionHeader: '',
        },
      }));
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read, readText },
      });

      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE));
      });

      await waitFor(() => {
        expect(read).toHaveBeenCalledTimes(1);
        expect(readText).not.toHaveBeenCalled();
      });
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).not.toBeInTheDocument();
      expect(screen.queryByText('Pasted image from clipboard.')).not.toBeInTheDocument();

      const previewImage = await screen.findByRole('img', { name: 'Session header preview' });
      expect(previewImage).toHaveAttribute('src', 'blob:clipboard-session-header-preview');

      fireEvent.click(screen.getByRole('button', { name: 'Expand session header image' }));
      expect(await screen.findByRole('img', { name: 'Expanded session header preview' })).toHaveAttribute(
        'src',
        'blob:clipboard-session-header-preview'
      );
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('renders uploaded files inside the normal-mode image preview area', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:session-header-preview');
    URL.revokeObjectURL = jest.fn();

    try {
      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      const imageBar = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR);
      fireEvent.click(within(imageBar).getByRole('button', { name: 'Upload image' }));

      const fileInput = imageBar.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();

      const file = new File(['header-image'], 'header.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('img', { name: 'Session header preview' })).toHaveAttribute(
          'src',
          'blob:session-header-preview'
        );
      });
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('reveals advanced metadata fields after opening Session Information', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();

    const metadataToggle = await screen.findByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE);
    if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
      fireEvent.click(metadataToggle);
    }

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG)).toBeInTheDocument();
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toBeInTheDocument();
  });

  it('keeps the Telegram-only session checkbox hidden in public session setup', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByRole('checkbox', { name: /telegram-only session/i })).not.toBeInTheDocument();
  });

  it('shows contract tooltip and modal triggers in advanced metadata, then opens a compact reader for the selected contract', async () => {
    renderSessionWizard({ activeSessionSlug: 'session-alpha' });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();

    const metadataToggle = await screen.findByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE);
    if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
      fireEvent.click(metadataToggle);
    }

    fireEvent.click(screen.getByRole('button', { name: /smart contracts expand/i }));

    ['surveys', 'sbtFactory', 'sessionRegistry'].forEach((contractKey) => {
      expect(screen.getByTestId(getSessionWizardContractTooltipTestId(contractKey))).toBeInTheDocument();
      expect(screen.getByTestId(getSessionWizardContractModalTriggerTestId(contractKey))).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(getSessionWizardContractModalTriggerTestId('sessionRegistry')));

    const modal = await screen.findByTestId(WIZARD_CONTRACT_MODAL_TESTID);
    expect(within(modal).getByTestId(getContractViewerCardTestId('sessionRegistry'))).toBeInTheDocument();
    expect(within(modal).getByTestId(getContractViewerSourceTestId('sessionRegistry'))).toBeInTheDocument();
    expect(within(modal).queryByTestId(getContractViewerCardTestId('surveys'))).not.toBeInTheDocument();
    expect(within(modal).queryByTestId(getContractViewerCardTestId('sbtFactory'))).not.toBeInTheDocument();

    expect(within(modal).getByTestId('ce-wizard-contract-modal-full-link')).toHaveAttribute(
      'href',
      '/contracts?contract=sessionRegistry&session=session-alpha'
    );
    expect(within(modal).getByTestId('ce-wizard-contract-modal-full-link')).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
  });

  it('shows GitHub worker links instead of raw source in advanced mode', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(await screen.findByText('Worker Deployment')).toBeInTheDocument();
    expect(screen.getByText('Sessions use a Cloudflare Worker for CORS proxy, AI, and faucet services.')).toBeInTheDocument();
    expect(
      screen.getByText('The default hosted worker is used automatically unless a custom worker URL is configured.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /worker source/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/tree/main/workers/sessionCorsWorker')
    );
    expect(screen.getByRole('link', { name: /worker source/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
    expect(screen.getByRole('link', { name: /deploy helper/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/tree/main/workers/deploy-helper')
    );
    expect(screen.getByRole('link', { name: /deploy helper/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
    expect(screen.getByRole('link', { name: /worker docs/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/blob/main/docs/session-cors-worker.md')
    );
    expect(screen.getByRole('link', { name: /worker docs/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy worker code/i })).not.toBeInTheDocument();
  });

  it('uses noopener noreferrer on every blank-target anchor in the source', () => {
    const sourceFiles = [
      './SessionWizard',
      './SessionPublishSummary',
      './SessionWizardModals',
    ];
    const anchors = sourceFiles.flatMap((ref) => {
      const source = fs.readFileSync(require.resolve(ref), 'utf8');
      return source.match(/<a[\s\S]*?<\/a>/g) || [];
    });
    const blankTargetAnchors = anchors.filter((anchor) => anchor.includes('target="_blank"'));

    expect(blankTargetAnchors.length).toBeGreaterThan(0);
    blankTargetAnchors.forEach((anchor) => {
      expect(anchor).toContain('rel="noopener noreferrer"');
    });
  });

  it('seeds default SBT tags in advanced mode for new session drafts', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: /More options/i }));

    expect(
      await screen.findByDisplayValue('group, event, idea, demographic, location')
    ).toBeInTheDocument();
  });

  it('keeps block limits inside optional details in normal mode when the draft contains them', async () => {
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        blockLimits: {
          start: 987654,
          end: 988000,
        },
      },
    }));

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByText('Start block')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('987654')).not.toBeInTheDocument();
    expect(screen.queryByText('Ends at block 988,000.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Optional details/i }));

    expect(await screen.findByText('Start block')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('987654')).toBeInTheDocument();
    expect(screen.getByText('Ends at block 988,000.')).toBeInTheDocument();
  });

  it('keeps legacy sponsoredSbtAddress inside optional details in normal mode', async () => {
    const sponsoredSbtAddress = '0x00000000000000000000000000000000000000f1';
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        sponsoredSbtAddress,
      },
    }));

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByDisplayValue(sponsoredSbtAddress)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Optional details/i }));

    expect(await screen.findByDisplayValue(sponsoredSbtAddress)).toBeInTheDocument();
  });

  it('keeps session details open after filling both fields in normal mode', async () => {
    renderSessionWizard();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const sessionInfoInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO);

    jest.useFakeTimers();

    try {
      fireEvent.change(sessionNameInput, {
        target: { value: 'Edge Cases & Signals' },
      });
      fireEvent.change(sessionInfoInput, {
        target: { value: 'A short description for the session.' },
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toBeInTheDocument();
      expect(screen.queryByText('Privacy & Access')).not.toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO)).toBeInTheDocument();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('switches the gate add affordance from ghost card to full-width rail after adding a second gate', async () => {
    renderSessionWizard();
    selectNormalModeCard('Privacy');

    const addGateButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_ADD_GATE);
    expect(addGateButton).toHaveAttribute('data-ce-gate-add-kind', 'ghost');

    fireEvent.click(addGateButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Access Rule B')).toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_ADD_GATE)).toHaveAttribute('data-ce-gate-add-kind', 'rail');
    });
  });

  it('auto-generates the slug from the session name in advanced mode', async () => {
    renderSessionWizard();
    enableAdvancedMode();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    fireEvent.change(sessionNameInput, {
      target: { value: 'Edge Cases & Signals' },
    });

    await waitFor(() => {
      expect(slugInput).toHaveValue('edge-cases--signals');
    });
  });

  it('preserves a manually edited slug in advanced mode', async () => {
    renderSessionWizard();
    enableAdvancedMode();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    fireEvent.change(sessionNameInput, {
      target: { value: 'Edge Cases & Signals' },
    });

    await waitFor(() => {
      expect(slugInput).toHaveValue('edge-cases--signals');
    });

    fireEvent.change(slugInput, {
      target: { value: 'ai-custom-override' },
    });

    fireEvent.change(sessionNameInput, {
      target: { value: 'Edge Cases & Signals Updated' },
    });

    await waitFor(() => {
      expect(slugInput).toHaveValue('ai-custom-override');
    });
  });

  it('locks the slug field when private URL mode is enabled', async () => {
    renderSessionWizard();
    enableAdvancedMode();

    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);
    fireEvent.change(slugInput, { target: { value: 'manual-session-slug' } });

    fireEvent.click(screen.getByTitle('Use session ID as the URL (private mode). This does not encrypt the URL.'));

    await waitFor(() => {
      expect(slugInput).toBeDisabled();
      expect(
        screen.getByTitle('Private URL mode enabled (uses session ID). Click to restore manual URL.')
      ).toBeInTheDocument();
    });
  });

  it('pins the slug after a pending SBT draft is queued', async () => {
    renderLoggedInSessionWizard();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    fireEvent.change(sessionNameInput, {
      target: { value: 'Queued Session' },
    });

    selectNormalModeCard('Privacy');
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();

    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: /Session Information/i }));

    const advancedSessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    await waitFor(() => {
      expect(slugInput).toHaveValue('queued-session');
      expect(slugInput).toBeDisabled();
    });

    fireEvent.change(advancedSessionNameInput, {
      target: { value: 'Queued Session Updated' },
    });

    await waitFor(() => {
      expect(slugInput).toHaveValue('queued-session');
    });
    expect(screen.getByText(
      'Queued Group drafts pinned this slug so their uploaded metadata stays aligned with the final session URL.'
    )).toBeInTheDocument();
  });

  it('disables worker secret inputs when user-paid mode is enabled and restores them when turned off in advanced mode', async () => {
    renderSessionWizard();
    enableAdvancedMode();
    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    const openAiKeyInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY);
    const requirePayToggle = screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_SECRETS_REQUIRE_PAY);

    expect(openAiKeyInput).toBeEnabled();
    expect(requirePayToggle).not.toBeChecked();

    fireEvent.change(openAiKeyInput, { target: { value: 'sk-test' } });
    fireEvent.click(requirePayToggle);

    await waitFor(() => {
      expect(requirePayToggle).toBeChecked();
      expect(openAiKeyInput).toBeDisabled();
    });

    fireEvent.click(requirePayToggle);

    await waitFor(() => {
      expect(requirePayToggle).not.toBeChecked();
      expect(openAiKeyInput).toBeEnabled();
    });
  });

  it('renders only the Chipotle Lit account key in the normal-mode worker secret view', async () => {
    renderSessionWizard();

    selectNormalModeCard('Worker');
    const litCard = (await screen.findByText('LIT')).closest(`[data-testid="${E2E_TESTIDS.WIZARD_RESOURCE_CARD}"]`);

    expect(litCard).not.toBeNull();
    expect(within(litCard).getByText('Lit account API key')).toBeInTheDocument();
    expect(within(litCard).queryByText('Lit API base')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit group ID')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit PKP ID')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit Action CID')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit usage API key')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Private key')).not.toBeInTheDocument();
  });

  it('does not enable Chipotle wizard hooks while only bootstrap authority fields are present', async () => {
    const litProtocol = require('../../utilities/crypto/litProtocol.js');
    litProtocol.createLitHooks.mockClear();
    renderSessionWizard();
    selectNormalModeCard('Worker');

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY), {
      target: { value: 'account-secret' },
    });

    await waitFor(() => {
      expect(litProtocol.createLitHooks).not.toHaveBeenCalled();
    });
  });

  it('waits for a worker URL before enabling Chipotle wizard hooks', async () => {
    const litProtocol = require('../../utilities/crypto/litProtocol.js');
    litProtocol.createLitHooks.mockClear();
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      workerSecretsEnabled: true,
      workerSecrets: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litPkpId: 'pkp_123',
        litActionCid: 'bafy123',
      },
    }));

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY)).toBeInTheDocument();

    await waitFor(() => {
      expect(litProtocol.createLitHooks).not.toHaveBeenCalled();
    });
  });

  it('uses the current Chipotle Lit tooltip copy in the worker panel', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      renderSessionWizard();
      selectNormalModeCard('Worker');

      const trigger = await screen.findByTestId('ce-wizard-resource-tooltip-lit');
      fireEvent.mouseOver(trigger);
      expect(await screen.findByText(
        'Worker-mediated Lit Chipotle setup. Paste one Lit account API key; the worker derives the scoped group, PKP, usage key, and CE action after deploy.'
      )).toBeInTheDocument();
      fireEvent.mouseOut(trigger);
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('renders worker resource tooltips for each visible secret section', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      renderSessionWizard();
      selectNormalModeCard('Worker');

      const tooltipCases = [
        ['ai', 'Session-funded OpenAI key used for text generation and transcription.'],
        ['rpc', 'Authenticated RPC endpoint used by the worker for chain reads and related operations.'],
        ['arweave', 'Account used to pay for Arweave uploads and storage.'],
        ['txGas', 'Faucet signer used to send small testnet funding grants.'],
        ['lit', 'Worker-mediated Lit Chipotle setup. Paste one Lit account API key; the worker derives the scoped group, PKP, usage key, and CE action after deploy.'],
      ];

      for (const [resourceKey, copy] of tooltipCases) {
        const trigger = await screen.findByTestId(`ce-wizard-resource-tooltip-${resourceKey}`);
        fireEvent.mouseOver(trigger);
        expect(await screen.findByText(copy)).toBeInTheDocument();
        fireEvent.mouseOut(trigger);
      }
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('hides and restores worker step tooltip triggers when explainers are toggled', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      const { store } = renderSessionWizardWithTooltipStore();
      selectNormalModeCard('Worker');

      const rpcTooltipTrigger = await screen.findByTestId('ce-wizard-resource-tooltip-rpc');
      const allowedOriginsTrigger = await screen.findByTestId('ce-wizard-worker-tooltip-gw-allowed-origins');

      fireEvent.mouseOver(rpcTooltipTrigger);
      expect(await screen.findByText('Authenticated RPC endpoint used by the worker for chain reads and related operations.')).toBeInTheDocument();
      fireEvent.mouseOut(rpcTooltipTrigger);

      expect(allowedOriginsTrigger).toBeInTheDocument();

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: false });
      });

      await waitFor(() => {
        expect(screen.queryByTestId('ce-wizard-resource-tooltip-rpc')).not.toBeInTheDocument();
        expect(screen.queryByTestId('ce-wizard-worker-tooltip-gw-allowed-origins')).not.toBeInTheDocument();
      });

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: true });
      });

      const restoredTrigger = await screen.findByTestId('ce-wizard-resource-tooltip-rpc');
      expect(await screen.findByTestId('ce-wizard-worker-tooltip-gw-allowed-origins')).toBeInTheDocument();

      fireEvent.click(restoredTrigger);
      expect(await screen.findByText('Authenticated RPC endpoint used by the worker for chain reads and related operations.')).toBeInTheDocument();
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('shows the effective default worker RPC URL as the RPC field placeholder without extra helper copy', async () => {
    const defaultPocketRpcUrl = 'https://op-sepolia-testnet.api.pocket.network'; // intentional: production default worker RPC placeholder
    renderSessionWizard();
    selectNormalModeCard('Worker');

    const rpcCard = await waitFor(() => {
      const card = getWizardResourceCard('rpc');
      expect(card).toBeTruthy();
      return card;
    });
    const rpcInput = within(rpcCard).getByRole('textbox');

    expect(rpcInput).toHaveValue('');
    expect(rpcInput).toHaveAttribute('placeholder', defaultPocketRpcUrl);
    expect(within(rpcCard).queryByText(`Default worker RPC: ${defaultPocketRpcUrl}`)).not.toBeInTheDocument();
  });

  it('renders non-worker session wizard tooltips through the same explainer toggle path', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      const { store } = renderSessionWizardWithTooltipStore();
      selectNormalModeCard('Privacy');

      const encryptionTooltipTrigger = await screen.findByTestId('ce-wizard-tooltip-gw-encryption-visibility');
      fireEvent.mouseOver(encryptionTooltipTrigger);
      expect(await screen.findByText(/control who can decrypt locked fields/i)).toBeInTheDocument();
      fireEvent.mouseOut(encryptionTooltipTrigger);

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: false });
      });

      await waitFor(() => {
        expect(screen.queryByTestId('ce-wizard-tooltip-gw-encryption-visibility')).not.toBeInTheDocument();
      });

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: true });
      });

      expect(await screen.findByTestId('ce-wizard-tooltip-gw-encryption-visibility')).toBeInTheDocument();
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('keeps Chipotle Lit UI visible while stripping cached legacy payer secrets from saved drafts', async () => {
    const litProtocol = require('../../utilities/crypto/litProtocol.js');
    const cachedLitKey = '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5';
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      workerSecretsEnabled: true,
      workerSecrets: {
        litPayerPrivateKey: cachedLitKey,
        litPayerAddress: ethers.utils.computeAddress(cachedLitKey),
      },
      provisionedSponsoredContext: {
        sessionSlug: 'edge',
        workerUrl: 'https://deployed.example.test',
        fields: {
          sponsored_lit: '1',
        },
      },
    }));

    renderSessionWizard();
    selectNormalModeCard('Worker');

    expect(screen.getByText('LIT')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_API_BASE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_PRIVATE_KEY)).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-resource-tooltip-lit')).toBeInTheDocument();

    await waitFor(() => {
      expect(litProtocol.createLitHooks).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      const cached = JSON.parse(localStorage.getItem('ce:sessionWizardDraft:v1') || '{}');
      expect(cached.workerSecrets?.litPayerPrivateKey).toBeUndefined();
      expect(cached.workerSecrets?.litPayerAddress).toBeUndefined();
      expect(cached.provisionedSponsoredContext?.fields?.sponsored_lit).toBe('1');
    });
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
    const verifyMessageSpy = jest
      .spyOn(ethers.utils, 'verifyMessage')
      .mockReturnValue(TEST_ADMIN_ADDRESS);
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
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
    }));

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
      expect(deployPayload.secrets).toEqual(expect.objectContaining({
        openaiKey: 'sk-latest',
        arweaveJwk: '{"kty":"RSA","n":"abc"}',
      }));
      expect(deployPayload.secrets.litPayerPrivateKey).toBeUndefined();
      expect(deployPayload.secrets.litPayerAddress).toBeUndefined();

      await waitFor(() => {
        const cached = JSON.parse(localStorage.getItem('ce:sessionWizardDraft:v1') || '{}');
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
    const verifyMessageSpy = jest
      .spyOn(ethers.utils, 'verifyMessage')
      .mockReturnValue(TEST_ADMIN_ADDRESS);
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
      expect(deployPayload.secrets).toEqual(expect.objectContaining({
        openaiKey: 'sk-latest',
        arweaveJwk: '{"kty":"RSA","n":"abc"}',
        litAccountApiKey: 'account-secret',
      }));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue('https://deployed.example.test');

      expect(workerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
        action: 'set-secrets',
        body: expect.objectContaining({
          secrets: expect.objectContaining({
            openaiKey: 'sk-latest',
            arweaveJwk: '{"kty":"RSA","n":"abc"}',
            litAccountApiKey: 'account-secret',
          }),
        }),
      }));
      const secretsSyncCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
      const secretsSyncPayload = JSON.parse(secretsSyncCall[1].body);
      expect(secretsSyncPayload.secrets).toEqual(expect.objectContaining({
        openaiKey: 'sk-latest',
        arweaveJwk: '{"kty":"RSA","n":"abc"}',
        litAccountApiKey: 'account-secret',
      }));

      await waitFor(() => {
        const cachedRaw = localStorage.getItem('ce:sessionWizardDraft:v1') || '{}';
        expect(JSON.parse(cachedRaw)).toEqual(expect.objectContaining({
          provisionedSponsoredContext: expect.objectContaining({
            workerUrl: 'https://deployed.example.test',
            fields: expect.objectContaining({
              sponsored_lit: '1',
            }),
          }),
        }));
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
    const verifyMessageSpy = jest
      .spyOn(ethers.utils, 'verifyMessage')
      .mockReturnValue(TEST_ADMIN_ADDRESS);
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
      localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
        workerSecretsEnabled: true,
        workerSecrets: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litGroupId: 'ce-session-content-prod',
          litPkpId: '0x1e5ed88b177bde881bb5e68b338c26c675e8f142',
          litUsageApiKey: 'lit-usage-key',
        },
      }));
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
          'Lit provisioning note: Lit action auto-provisioned.'
        );
      });

      expect(workerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
        action: 'lit-chipotle-provision',
        body: expect.objectContaining({
          litGroupId: 'ce-session-content-prod',
          litPkpId: '0x1e5ed88b177bde881bb5e68b338c26c675e8f142',
        }),
      }));

      const provisionCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/lit-chipotle-provision'));
      const provisionPayload = JSON.parse(provisionCall[1].body);
      expect(provisionPayload.actionName).toBe('ce-sbt-gated-crypto-v3');

      const configSyncCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/set-config'));
      const configSyncPayload = JSON.parse(configSyncCall[1].body);
      expect(configSyncPayload.config.litCredentials).toEqual(expect.objectContaining({
        litActionCid: 'QmZPKjGtD4qLZhr17juP8XgUKV1A34Y9GtUUpeJNJ7f2vL',
        litGroupId: '7',
      }));
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });

  it('auto-bootstraps Lit runtime from the Lit account API key and ignores stale hidden runtime fields', async () => {
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
    const verifyMessageSpy = jest
      .spyOn(ethers.utils, 'verifyMessage')
      .mockReturnValue(TEST_ADMIN_ADDRESS);
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
      localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
        workerSecretsEnabled: true,
        workerSecrets: {
          litApiBase: 'https://stale-chipotle.example.test',
          litGroupId: 'stale-group',
          litPkpId: 'stale-pkp',
          litActionCid: 'stale-cid',
          litUsageApiKey: 'stale-usage-key',
        },
      }));
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
          'Lit bootstrap note: Lit session account auto-created.'
        );
      });

      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.secrets).toEqual(expect.objectContaining({
        litAccountApiKey: 'lit-account-key',
      }));
      expect(deployPayload.secrets.litUsageApiKey).toBeUndefined();
      expect(deployPayload.secrets.litApiBase).toBeUndefined();

      expect(workerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(expect.objectContaining({
        action: 'lit-chipotle-bootstrap-session',
        body: expect.objectContaining({
          litAccountApiKey: 'lit-account-key',
          sessionName: 'Chipotle Bootstrap Session',
        }),
      }));
      const bootstrapAuthCall = workerAuth.buildSignedAdminActionAuth.mock.calls.find(
        ([arg]) => arg?.action === 'lit-chipotle-bootstrap-session'
      );
      expect(bootstrapAuthCall[0].body.litApiBase).toBeUndefined();
      expect(bootstrapAuthCall[0].body.litUsageApiKey).toBeUndefined();
      const bootstrapCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/lit-chipotle-bootstrap-session'));
      const bootstrapPayload = JSON.parse(bootstrapCall[1].body);
      expect(bootstrapPayload.litAccountApiKey).toBe('lit-account-key');
      expect(bootstrapPayload.litUsageApiKey).toBeUndefined();
      expect(bootstrapPayload.litGroupId).toBeUndefined();
      await waitFor(() => {
        expect(litProtocol.createLitHooks).toHaveBeenCalledWith(expect.objectContaining({
          chipotle: expect.objectContaining({
            litCredentials: expect.objectContaining({
              litApiBase: 'https://api.chipotle.litprotocol.com',
              litGroupId: '7',
              litPkpId: '0x1e5ed88b177bde881bb5e68b338c26c675e8f142',
              litActionCid: 'QmBootstrapAction123',
            }),
          }),
        }));
      });
      expect(
        global.fetch.mock.calls.some(([url]) => String(url).endsWith('/admin/lit-chipotle-provision'))
      ).toBe(false);
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
    const verifyMessageSpy = jest
      .spyOn(ethers.utils, 'verifyMessage')
      .mockReturnValue(TEST_ADMIN_ADDRESS);
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
          'Secrets sync note: Deploy helper already wrote secrets; skipped browser post-deploy secret sync.'
        );
      });
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/account'))).toBe(false);
      expect(
        global.fetch.mock.calls.some(([url]) => String(url).endsWith('/admin/set-secrets'))
      ).toBe(false);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });

  it('includes a cached Cloudflare account id in the deploy-helper payload', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        getAddress: jest.fn().mockResolvedValue(TEST_ADMIN_ADDRESS),
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
    const verifyMessageSpy = jest
      .spyOn(ethers.utils, 'verifyMessage')
      .mockReturnValue(TEST_ADMIN_ADDRESS);
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      deployForm: {
        accountId: 'cf-account-1',
      },
    }));
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
        target: { value: 'Deploy Account Id Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'deploy-account-id-session' },
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

      let deployCall;
      await waitFor(() => {
        deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
        expect(deployCall).toBeTruthy();
      });

      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.accountId).toBe('cf-account-1');
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/account'))).toBe(false);
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

  it('prompts for login instead of attempting publish when publish is available but no wallet is connected', async () => {
    const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
    const originalGetProvider = cryptoUtils._getProvider.getMockImplementation();
    const providerRequest = jest.fn(async ({ method }) => {
      if (method === 'eth_accounts') return [];
      if (method === 'eth_chainId') return '0x14a34';
      if (method === 'net_version') return '84532';
      if (method === 'eth_requestAccounts') {
        throw new Error('publish should open the login modal instead of requesting wallet accounts');
      }
      return [];
    });
    cryptoUtils._getProvider.mockImplementation(() => ({
      request: providerRequest,
    }));
    const toggleLoginModal = jest.fn();
    try {
      renderSessionWizard({
        account: '',
        loginComplete: false,
        toggleLoginModal,
      });
      enableAdvancedMode();

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      fireEvent.change(sessionNameInput, {
        target: { value: 'Login Required Publish Session' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));
      fireEvent.click(screen.getByLabelText('Advanced publish settings'));
      fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
        target: { value: 'ar://'.concat('a'.repeat(43)) },
      });

      const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });

      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(toggleLoginModal).toHaveBeenCalledWith(true);
        expect(screen.getByText('Connect your wallet to publish this session.')).toBeInTheDocument();
      });
      expect(providerRequest.mock.calls.map(([payload]) => payload?.method)).not.toContain('eth_requestAccounts');
    } finally {
      cryptoUtils._getProvider.mockImplementation(originalGetProvider);
    }
  });

  it('prompts for login before direct worker deploy starts when no wallet session is active', async () => {
    const toggleLoginModal = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));

    try {
      renderSessionWizard({
        account: '',
        loginComplete: false,
        toggleLoginModal,
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
        target: { value: 'Login Before Deploy Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'login-before-deploy-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(toggleLoginModal).toHaveBeenCalledWith(true);
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          'Connect your wallet to set the admin address.'
        );
      });
      expect(global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'))).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('keeps the custom AI RPC field empty until the admin sets it', async () => {
    renderSessionWizard();
    selectNormalModeCard('Worker');

    const customRpcLabel = await screen.findByText('Custom RPC URL');
    const customRpcGroup = customRpcLabel.closest('.resourceInput') || customRpcLabel.parentElement?.parentElement;
    const customRpcInput = within(customRpcGroup).getByRole('textbox');

    expect(customRpcInput).toHaveValue('');
  });

  it('blocks publish with a required-slug status message when the slug is blank', async () => {
    renderSessionWizard();
    enableAdvancedMode();
    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    fireEvent.change(slugInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('Publish').closest('button'));
    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH));

    expect(await screen.findByText(REQUIRED_SESSION_SLUG_ERROR)).toBeInTheDocument();
  });

  it('shows and clears the reserved slug error in the rendered form', async () => {
    renderSessionWizard();
    enableAdvancedMode();

    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    fireEvent.change(slugInput, { target: { value: 'general' } });
    expect(screen.getByText(RESERVED_SESSION_SLUG_ERROR)).toBeInTheDocument();

    fireEvent.change(slugInput, { target: { value: 'edge-custom' } });
    expect(screen.queryByText(RESERVED_SESSION_SLUG_ERROR)).not.toBeInTheDocument();
  });});
