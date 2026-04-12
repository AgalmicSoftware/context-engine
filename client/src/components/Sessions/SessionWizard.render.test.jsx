/* eslint-disable import/first */
// Remaining broad SessionWizard render coverage owns section visibility, metadata details, slug validation, tooltips, and login guards.
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

    expect(screen.getByText('An AI API key (OpenAI, Anthropic, or OpenRouter)')).toBeInTheDocument();
    expect(screen.getByText('An Arweave wallet (JWK) for permanent storage')).toBeInTheDocument();
    expect(screen.getByText('OP Sepolia ETH for on-chain registration')).toBeInTheDocument();
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
      'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, deploy access.'
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
      'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding.'
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

  it('keeps the normal-mode worker step focused on bring-your-own worker setup while defaulting to the release bundle URL', async () => {
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(await screen.findByText('Bring your own worker')).toBeInTheDocument();
    expect(await screen.findByText('Cloudflare API token')).toBeInTheDocument();
    expect(screen.queryByText('Upload bundle file')).not.toBeInTheDocument();
    expect(screen.queryByText('Using Default Worker')).not.toBeInTheDocument();
    expect(screen.queryByText('Use My Own')).not.toBeInTheDocument();
    expect(screen.queryByText('Most sessions can stay on the shared default worker. Only switch to your own worker if you want to manage the infrastructure yourself.')).not.toBeInTheDocument();
    expect(screen.queryByText('How should this session run?')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared hosted worker')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker secrets')).not.toBeInTheDocument();
    expect(screen.queryByText('Dev: keep secrets on refresh')).not.toBeInTheDocument();
    expect(screen.queryByText('Require users to pay for usage')).not.toBeInTheDocument();
    expect(screen.queryByText('Resource gates (on-chain)')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
    expect(screen.getByText('Worker URL appears here after a successful custom worker deploy.')).toBeInTheDocument();
    expect(screen.getByText('Deploy-helper URL')).toBeInTheDocument();
    expect(screen.getByText('Worker bundle URL (release asset)')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');
    expect(screen.getByText('Normal mode deploys use the GitHub-hosted worker bundle automatically.')).toBeInTheDocument();
    expect(screen.queryByText('Worker name')).not.toBeInTheDocument();
    expect(screen.queryByText('Passing a Cloudflare API token to a deploy-helper requires trust.')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
  });

  it('defaults advanced custom-worker deploys to the configured release bundle URL', async () => {
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_URL)).toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_UPLOAD)).not.toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
  });

  it('restores the configured release bundle URL after returning from advanced mode to normal mode', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
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
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Bundle Reset' },
      });

      enableAdvancedMode();
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const advancedBundleUrlInput = screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL);
      fireEvent.change(advancedBundleUrlInput, {
        target: { value: 'https://bundles.example.test/custom-sessionCorsWorker.bundle.js' },
      });
      await waitFor(() => {
        expect(advancedBundleUrlInput).toHaveValue('https://bundles.example.test/custom-sessionCorsWorker.bundle.js');
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL));
      selectNormalModeCard('Worker');

      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-reset' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal-reset"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayload.bundleUrl).not.toBe('https://bundles.example.test/custom-sessionCorsWorker.bundle.js');
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('keeps the embedded deploy-helper toggle out of Step 1 in normal /new mode', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED)).not.toBeInTheDocument();
    expect(screen.queryByText('Enable embedded deploy-helper on this worker')).not.toBeInTheDocument();
  });

  it('shows the embedded deploy-helper toggle in the normal-mode worker step and lets the user disable it', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    const embeddedToggle = await screen.findByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED);
    expect(embeddedToggle).toBeChecked();

    fireEvent.click(embeddedToggle);
    expect(embeddedToggle).not.toBeChecked();
  });

  it('reveals the manual bundle upload fallback in normal mode after a release-asset deploy failure', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Release Bundle Retry' },
      });

      selectNormalModeCard('Worker');
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-failure' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal-failure"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();
      expect(screen.getByText('Choose /dist/sessionCorsWorker.bundle.js to retry this worker deploy.')).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('clears the one-off manual bundle retry after a successful normal-mode fallback deploy', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const bundleFile = {
      name: 'sessionCorsWorker.bundle.js',
      type: 'text/javascript',
      text: async () => 'export default { async fetch() { return new Response("ok"); } };',
    };
    let deployCallCount = 0;

    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        deployCallCount += 1;
        const payload = JSON.parse(options.body);
        if (deployCallCount === 2) {
          expect(payload.bundleUrl).toBeUndefined();
          expect(payload.bundleText).toContain('new Response("ok")');
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
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Retry Reset' },
      });

      selectNormalModeCard('Worker');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-retry-reset' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal-retry-reset"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT), {
        target: { files: [bundleFile] },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();
      expect(deployCallCount).toBe(3);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('keeps sponsored publish auto-deploy on the local bundle path after a prior normal-mode fetch failure', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const { arweaveScripts } = require('../../utilities/arweave/arweaveScripts.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalUploadDataToArweave = arweaveScripts.uploadDataToArweave.getMockImplementation();
    const originalRegisterSessionOnChain = mockRegisterSessionOnChain.getMockImplementation();
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const localSponsoredBundleText = 'export default { async fetch() { return new Response("sponsored-ok"); } };';
    let resolveSponsoredBundle;
    const sponsoredBundleReady = new Promise((resolve) => {
      resolveSponsoredBundle = resolve;
    });

    mockRegisterSessionOnChain.mockResolvedValue({ txs: [] });
    arweaveScripts.uploadDataToArweave.mockResolvedValue('a'.repeat(43));
    mockDecryptWithPassword.mockReturnValueOnce(sponsoredBundleReady);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());

    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.includes('/worker/sessionCorsWorker.bundle.js')) {
        return {
          ok: true,
          status: 200,
          text: async () => localSponsoredBundleText,
          headers: {
            get: (name) => (String(name || '').toLowerCase() === 'content-type' ? 'text/javascript' : ''),
          },
        };
      }
      if (normalizedUrl.endsWith('/sponsored/redeem-deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.deployPayload.bundleUrl).toBeUndefined();
        expect(payload.deployPayload.bundleText).toContain('sponsored-ok');
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://sponsored-deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      if (normalizedUrl.endsWith('/admin/set-config') || normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id#k=sponsor-secret');
      localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
        draft: {
          networkChainId: 84532,
          blockLimits: {
            start: mockSelectorSourceStartBlock,
            end: null,
          },
          contracts: {
            sbtFactory: {
              address: mockSelectorSourceFactory,
              chainId: 84532,
            },
          },
          __registry: {
            chainId: 84532,
            registryChainId: 84532,
          },
        },
      }));
      renderLoggedInSessionWizard({
        initialSponsoredBundleId: 'sponsor-tx-id',
        initialSponsoredBundleKey: 'sponsor-secret',
      });

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Sponsored Publish Retry Session' },
      });

      selectNormalModeCard('Worker');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-sponsored-normal-failure' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"sponsored-normal-failure"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();

      await act(async () => {
        resolveSponsoredBundle(buildMockSponsoredBundle());
        await sponsoredBundleReady;
      });

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
          'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, deploy access.'
        );
      });

      selectNormalModeCard('Deploy Session');

      const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });

      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(
          global.fetch.mock.calls.some(([url]) => String(url).includes('/worker/sessionCorsWorker.bundle.js'))
        ).toBe(true);
        expect(
          global.fetch.mock.calls.some(([url]) => String(url).endsWith('/sponsored/redeem-deploy'))
        ).toBe(true);
      });
      expect(screen.queryByText('Upload a worker bundle file before deploy.')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      if (originalUploadDataToArweave) {
        arweaveScripts.uploadDataToArweave.mockImplementation(originalUploadDataToArweave);
      } else {
        arweaveScripts.uploadDataToArweave.mockReset();
      }
      if (originalRegisterSessionOnChain) {
        mockRegisterSessionOnChain.mockImplementation(originalRegisterSessionOnChain);
      } else {
        mockRegisterSessionOnChain.mockReset();
      }
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('keeps the privacy panel usable in advanced mode after queuing an SBT draft in normal mode', async () => {
    renderLoggedInSessionWizard({
      initialSessionId: '0x11111111111111111111111111111111',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();

    enableAdvancedMode();

    const privacyToggle = await screen.findByRole('button', { name: /groups allowed to decrypt locked fields/i });
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();

    fireEvent.click(privacyToggle);
    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
    });

    fireEvent.click(privacyToggle);
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();
  });

  it('shows the embedded deploy-helper toggle in advanced custom-worker mode and lets the user disable it', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

    const embeddedToggle = await screen.findByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED);
    expect(embeddedToggle).toBeChecked();

    fireEvent.click(embeddedToggle);
    expect(embeddedToggle).not.toBeChecked();
  });

  it('hydrates the embedded deploy-helper toggle from the default-session source config', async () => {
    const contractScriptsModule = require('../../utilities/web3/contractScripts.js');
    const originalStrictConfig = contractScriptsModule.getSessionConfigBySlugOrDefault.getMockImplementation();

    contractScriptsModule.getSessionConfigBySlugOrDefault.mockImplementation((slug = '') => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized) return null;
      return {
        slug: '',
        sessionName: 'Context Engine',
        networkChainId: 84532,
        contracts: {},
        embeddedDeployHelperEnabled: false,
      };
    });

    try {
      renderSessionWizard({ activeSessionSlug: '' });

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      selectNormalModeCard('Worker');

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED)).not.toBeChecked();
      });
    } finally {
      contractScriptsModule.getSessionConfigBySlugOrDefault.mockImplementation(originalStrictConfig);
    }
  });

  it('does not refetch default sponsored SBT metadata after unrelated draft edits once seeded', async () => {
    const contractScriptsModule = require('../../utilities/web3/contractScripts.js');
    const sponsoredAddress = ethers.utils.getAddress('0x1111111111111111111111111111111111111111');
    const getSbtMetadataMock = contractScriptsModule.default.getSbtMetadata;
    getSbtMetadataMock.mockResolvedValue({
      address: sponsoredAddress,
      name: 'Loop Guard SBT',
      symbol: 'LGSBT',
      admin: TEST_ADMIN_ADDRESS,
    });

    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        slug: 'guard-session',
        sessionName: 'Guard Session',
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: mockSelectorSourceFactory,
            chainId: 84532,
          },
        },
        __registry: {
          chainId: 84532,
          registryChainId: 84532,
        },
        sponsored: {
          defaultGateId: 'gate-1',
          gates: {
            'gate-1': {
              sbtAddress: sponsoredAddress,
              sbtAddresses: [sponsoredAddress],
              chainId: 84532,
              mode: 'any',
            },
          },
        },
      },
    }));

    renderSessionWizard({ activeSessionSlug: 'guard-session' });

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await waitFor(() => {
      expect(getSbtMetadataMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(sessionNameInput, { target: { value: 'Guard Session Updated' } });
    await waitFor(() => {
      expect(sessionNameInput).toHaveValue('Guard Session Updated');
    });
    await waitFor(() => {
      expect(getSbtMetadataMock).toHaveBeenCalledTimes(1);
    });
  });

  it('hides an empty cached worker URL in normal mode until a real worker exists', async () => {
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        corsWorkerUrl: '',
      },
      deployComplete: false,
      deployWorkerUrl: '',
    }));

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).not.toBeInTheDocument();
    expect(screen.getByText('Worker URL appears here after a successful custom worker deploy.')).toBeInTheDocument();
    await waitFor(() => {
      const cachedRaw = localStorage.getItem('ce:sessionWizardDraft:v1') || '{}';
      expect(JSON.parse(cachedRaw).draft.corsWorkerUrl).toBe('');
    });
  });

  it('does not resurrect a stale cached deploy URL after deploy verification was cleared', async () => {
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        corsWorkerUrl: '',
      },
      deployComplete: false,
      deployWorkerUrl: 'https://deployed.example.test',
    }));

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).not.toBeInTheDocument();
    expect(screen.getByText('Worker URL appears here after a successful custom worker deploy.')).toBeInTheDocument();
  });

  it('shows the worker URL in normal mode after a worker has been deployed', async () => {
    const deployedWorkerUrl = 'https://deployed.example.test';
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      draft: {
        corsWorkerUrl: deployedWorkerUrl,
      },
      deployComplete: true,
      deployWorkerUrl: deployedWorkerUrl,
    }));

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue(deployedWorkerUrl);
    expect(screen.queryByRole('button', { name: 'I already have a worker URL' })).not.toBeInTheDocument();
  });

  it('keeps the verified worker URL and publish readiness after a normal-mode deploy in /new', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed;
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
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      fireEvent.change(sessionNameInput, {
        target: { value: 'Normal Mode Deploy Session' },
      });

      selectNormalModeCard('Worker');
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();

      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL)).not.toBeInTheDocument();

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      expect(reactPropsKey).toBeTruthy();
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayload.bundleText).toBeUndefined();
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue(
        'https://deployed.example.test'
      );

      selectNormalModeCard('Deploy Session');

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).not.toBeDisabled();
      });
      expect(
        screen.queryByText('Custom worker mode requires a successful deploy in this run before metadata upload.')
      ).not.toBeInTheDocument();

      selectNormalModeCard('Worker');
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue(
        'https://deployed.example.test'
      );
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('surfaces workers.dev activation details after deploy-helper succeeds', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
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
            subdomain: 'tenant-subdomain',
            subdomainStatus: 'active',
            scriptSubdomainEnabled: true,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      fireEvent.change(sessionNameInput, {
        target: { value: 'Workers Dev Status Session' },
      });

      selectNormalModeCard('Worker');
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL)).not.toBeInTheDocument();

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-workers-dev-status' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"workers-dev"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          'Worker deployed. workers.dev status: account active (tenant-subdomain); script enabled.'
        );
      });
      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayload.bundleText).toBeUndefined();
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue(
        'https://deployed.example.test'
      );
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('only falls back to the shared worker URL when the wizard is explicitly in default mode', () => {
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());

    expect(resolveSessionWizardWorkerBaseUrl({
      configuredWorkerUrl: '',
      deployWorkerUrl: '',
      fallbackWorkerUrl: 'https://shared.example',
      workerMode: 'custom',
    })).toBe('');

    expect(resolveSessionWizardWorkerBaseUrl({
      configuredWorkerUrl: '',
      deployWorkerUrl: '',
      fallbackWorkerUrl: 'https://shared.example',
      workerMode: 'default',
    })).toBe('https://shared.example');
  });

  it('fills publish progress gradually within an active step and completes at 100 after done', () => {
    expect(getSessionWizardPublishProgressPercent({
      publishStep: 2,
      publishBusy: true,
      totalSteps: 5,
      elapsedMs: 0,
    })).toBeGreaterThan(20);
    expect(getSessionWizardPublishProgressPercent({
      publishStep: 2,
      publishBusy: true,
      totalSteps: 5,
      elapsedMs: 2600,
    })).toBeGreaterThan(35);
    expect(getSessionWizardPublishProgressPercent({
      publishStep: 5,
      publishBusy: false,
      totalSteps: 5,
      elapsedMs: 0,
    })).toBe(100);
  });

  it('opens the inline create-SBT modal and records a pending draft', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    expect(await screen.findByText('Add Group to Session')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
      'data-ce-sbt-address',
      mockPendingSbtAddress.toLowerCase()
    );
    await waitFor(() => {
      expect(screen.queryByTestId('mock-create-sbt-group')).not.toBeInTheDocument();
    });
  });

  it('prompts for login before opening create-SBT and auto-resumes once the wallet account is available', async () => {
    const toggleLoginModal = jest.fn();
    const view = renderSessionWizard({
      account: '',
      loginComplete: false,
      toggleLoginModal,
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('mock-create-sbt-group')).not.toBeInTheDocument();

    view.rerender(
      <SessionWizard
        network={{ id: 84532 }}
        account={TEST_ADMIN_ADDRESS}
        loginComplete={true}
        toggleLoginModal={toggleLoginModal}
      />
    );

    expect(await screen.findByTestId('mock-create-sbt-group')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
      'data-ce-sbt-address',
      mockPendingSbtAddress.toLowerCase()
    );
  });

  it('clears pending SBT drafts when the deploy network changes', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();
    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const gateOneSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-1'
      );
      expect(gateOneSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });

    enableAdvancedMode();

    const chainSelect = screen.getByRole('combobox');
    const alternateOption = Array.from(chainSelect.querySelectorAll('option')).find(
      (option) => option.value && option.value !== chainSelect.value
    );
    expect(alternateOption).toBeTruthy();

    fireEvent.change(chainSelect, { target: { value: alternateOption.value } });

    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
    });
  });

  it('keeps pending privacy-gate SBT drafts selected when session scope is list mode', async () => {
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['general', 'edge']));

    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const gateOneSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-1'
      );
      expect(gateOneSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });
  });

  it('finalizes pending-upload SBT drafts before deterministic deploy during publish', async () => {
    const finalizeDeferredDraftUpload = jest.fn(async () => ({
      tokenURI: 'ar://finalized-pending-sbt',
      metadataPreview: { name: 'Pending SBT' },
      authoringPayload: { sbtName: 'Pending SBT', _sessionSlug: 'publish-test' },
    }));
    mockCreateSBT.mockResolvedValue({
      events: [
        {
          event: 'SBTCreatedDeterministic',
          args: { sbtAddress: mockPendingSbtAddress },
        },
      ],
      transactionHash: '0xdeploy-pending-sbt',
    });

    const pendingDraft = {
      id: 'pending-sbt-1',
      predictedAddress: mockPendingSbtAddress,
      displayName: 'Pending SBT',
      contractName: 'Pending SBT',
      symbol: 'CE-SBT-PEND',
      create2Salt: 'draft/test',
      limitedNumber: 0,
      adminAddress: '0xCreator',
      mintingEndTimeUnix: 0,
      hasPasswordMintOnChain: false,
      burnAuthEnum: 0,
      hashedPasswords: [],
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
      finalGroupPasswordHash: ethers.constants.HashZero,
      createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
      authoringPayload: { sbtName: 'Pending SBT', _sessionSlug: 'publish-test' },
      passwordList: [],
      groupPassword: '',
      usesInviteCodes: false,
    };

    const finalizedDraft = await finalizeSessionWizardPendingSbtDraft({
      draftEntry: pendingDraft,
      workerUrlOverride: 'https://deployed.example.test',
      createSbtComponentProps: {
        account: TEST_ADMIN_ADDRESS,
        sessionConfigOverride: {
          slug: 'publish-test',
        },
      },
      finalizeDeferredDraftUpload,
    });
    const finalizePendingDraftMock = jest.fn(async () => finalizedDraft);

    const result = await deploySessionWizardPendingSbtDraft({
      sbtDraft: pendingDraft,
      providerLike: 'mock-provider',
      sessionConfigForDeploy: {
        slug: 'publish-test',
        contracts: {},
      },
      finalizePendingDraft: finalizePendingDraftMock,
      createSBT: mockCreateSBT,
    });

    expect(finalizeDeferredDraftUpload).toHaveBeenCalledWith(expect.objectContaining({
      authoringPayload: pendingDraft.authoringPayload,
      componentProps: expect.objectContaining({
        account: TEST_ADMIN_ADDRESS,
        sessionConfigOverride: expect.objectContaining({
          slug: 'publish-test',
        }),
      }),
    }));
    expect(finalizePendingDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateSBT.mock.invocationCallOrder[0]
    );
    expect(result.finalizedDraft.tokenURI).toBe('ar://finalized-pending-sbt');
    expect(mockCreateSBT).toHaveBeenCalledWith(
      'mock-provider',
      'Pending SBT',
      'CE-SBT-PEND',
      0,
      '0xCreator',
      0,
      false,
      0,
      [],
      'ar://finalized-pending-sbt',
      ethers.constants.HashZero,
      {
        slug: 'publish-test',
        contracts: {},
      },
      'draft/test',
      { useConfiguredDeterministic: true, initializeGroupPasswordHash: false }
    );
    expect(result.finalizedDraft).toEqual(expect.objectContaining({
      tokenURI: 'ar://finalized-pending-sbt',
      metadataUploadStatus: 'ready',
    }));
  });

  it('promotes pending SBT selections to deployed entries before pending-draft cleanup', () => {
    const promoted = promotePendingSbtSelectionsAfterDeploy({
      selections: [{
        address: mockPendingSbtAddress,
        name: 'Pending SBT (Pending)',
        pending: true,
        metadataPreview: { phase: 'pending' },
      }],
      deployedDrafts: [{
        predictedAddress: mockPendingSbtAddress,
        deployedAddress: mockPendingSbtAddress,
        displayName: 'Pending SBT',
        metadataPreview: { phase: 'deployed' },
        deployed: true,
      }],
    });

    expect(promoted).toEqual([{
      address: mockPendingSbtAddress,
      name: 'Pending SBT',
      metadataPreview: { phase: 'deployed' },
    }]);
  });

  it('resolves demo selector discovery from the source session config instead of the auto-seeded draft block window', () => {
    const latestBlock = 39316304;
    const selectorConfig = resolveSessionWizardSelectorSourceConfig({
      activeSessionSlug: 'demo',
      registryChainId: 84532,
      draftNetworkChainId: 84532,
      network: { id: 84532 },
      normalizeSlug: (value = '') => String(value || '').trim().toLowerCase(),
      resolveStrictConfig: (slug = '') => {
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
      },
      resolveDisplayConfig: () => null,
    });

    expect(selectorConfig).toEqual(expect.objectContaining({
      slug: 'demo',
      networkChainId: 84532,
      contracts: expect.objectContaining({
        sbtFactory: expect.objectContaining({
          address: mockSelectorSourceFactory,
          chainId: 84532,
        }),
      }),
      blockLimits: expect.objectContaining({
        start: mockSelectorSourceStartBlock,
      }),
    }));
    expect(selectorConfig?.blockLimits?.start).not.toBe(latestBlock);
  });

  it('keeps pending SBT drafts out of localStorage while persisting them in sessionStorage for refresh recovery', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const cachedRaw = localStorage.getItem('ce:sessionWizardDraft:v1') || '';
      expect(cachedRaw).not.toContain('claim-code-1');
      expect(cachedRaw).not.toContain('shared-secret');
      expect(JSON.parse(cachedRaw).pendingSbtDrafts).toEqual([]);
      const sessionRaw = sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1') || '';
      expect(sessionRaw).toContain('claim-code-1');
      expect(sessionRaw).toContain('shared-secret');
      expect(JSON.parse(sessionRaw)).toEqual([
        expect.objectContaining({
          predictedAddress: mockPendingSbtAddress,
          displayName: 'Pending SBT',
        }),
      ]);
    });
  });

  it('does not restore cached pending SBT drafts from localStorage', async () => {
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
      pendingSbtDrafts: [{
        predictedAddress: mockPendingSbtAddress,
        displayName: 'Cached Pending SBT',
        passwordList: ['claim-code-1'],
        groupPassword: 'shared-secret',
      }],
    }));

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    expect(screen.queryByText('Cached Pending SBT')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
  });

  it('restores pending SBT drafts from sessionStorage after a refresh', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();
    await waitFor(() => {
      expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toContain(mockPendingSbtAddress);
    });

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
      'data-ce-sbt-address',
      mockPendingSbtAddress.toLowerCase()
    );
    expect(screen.getByText(mockPendingSbtAddress)).toBeInTheDocument();
  });

  it('auto-links a featured pending SBT draft into Gate A when created from the step-1 featured button', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();

    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
    await ensureGateASelectorVisible();
    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress]);
  });

  it('restores the auto-linked Gate A pending draft after a refresh while the pending draft still exists', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();

    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
    await ensureGateASelectorVisible();
    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress]);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();

    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
    await ensureGateASelectorVisible();
    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress]);
  });

  it('stops re-adding the auto-linked Gate A draft after the user removes it from Gate A', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    fireEvent.click(screen.getByRole('button', {
      name: `Mock remove ${mockPendingSbtAddress} from encryption-gate-gate-1`,
    }));

    await expectSelectorAddresses('encryption-gate-gate-1', []);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('encryption-gate-gate-1', []);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
  });

  it('removing the featured pending draft from Step 1 also clears the auto-linked Gate A selector', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    fireEvent.click(screen.getByRole('button', {
      name: `Mock remove ${mockPendingSbtAddress} from default-featured-sbts`,
    }));

    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);
  });

  it('disables the Gate A auto-link after the user replaces it with another SBT', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Mock add encryption-gate-gate-1 SBT' }));

    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress, mockReplacementSbtAddress]);

    fireEvent.click(screen.getByRole('button', {
      name: `Mock remove ${mockPendingSbtAddress} from encryption-gate-gate-1`,
    }));

    await expectSelectorAddresses('encryption-gate-gate-1', [mockReplacementSbtAddress]);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('encryption-gate-gate-1', [mockReplacementSbtAddress]);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
  });

  it('clears the pending featured draft, Gate A auto-link, and selectors when the pending draft is deleted', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    const pendingCard = await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT);
    fireEvent.click(within(pendingCard).getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
    });
    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);
  });

  it('prunes pending featured SBT selections after a refresh when no live sessionStorage draft exists', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    const featuredCreateButton = await waitFor(() => {
      const button = screen.getAllByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT).find(
        (node) => node.getAttribute('data-ce-sbt-target') === 'defaultFeaturedSBTs'
      );
      expect(button).toBeTruthy();
      return button;
    });

    fireEvent.click(featuredCreateButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const featuredSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'default-featured-sbts'
      );
      expect(featuredSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });

    firstRender.unmount();
    sessionStorage.removeItem('ce:sessionWizardPendingSbtDrafts:v1');
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const featuredSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'default-featured-sbts'
      );
      expect(featuredSelector).toHaveAttribute('data-selected-addresses', '');
    });
  });

  it('retargets the shared create-SBT button to the gate currently being edited', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    const createButton = screen.getByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT);
    expect(createButton).toHaveAttribute('data-ce-sbt-target', 'gate-1');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_ADD_GATE));
    const secondGateAllButton = screen.getAllByRole('button', { name: 'ALL' })[1];
    fireEvent.mouseDown(secondGateAllButton);
    fireEvent.click(secondGateAllButton);

    await waitFor(() => {
      expect(createButton).toHaveAttribute('data-ce-sbt-target', 'gate-2');
    });

    fireEvent.click(createButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const gateOneSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-1'
      );
      const gateTwoSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-2'
      );

      expect(gateOneSelector).toHaveAttribute('data-selected-addresses', '');
      expect(gateTwoSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });
  });

  it('passes the latest slug and Arweave JWK into the inline create-SBT modal', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SLUG), {
      target: { value: 'inline-proof' },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
      target: { value: '{"kty":"RSA"}' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    const modal = await screen.findByTestId('mock-create-sbt-group');
    expect(modal).toHaveAttribute('data-session-slug', 'inline-proof');
    expect(modal).toHaveAttribute('data-session-config-slug', 'inline-proof');
    expect(modal).toHaveAttribute('data-arweave-jwk', '{"kty":"RSA"}');
  });

  it('prefers the draft slug over a stale active session slug in the inline create-SBT modal', async () => {
    renderLoggedInSessionWizard({ activeSessionSlug: 'previous-session' });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SLUG), {
      target: { value: 'draft-session-slug' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    const modal = await screen.findByTestId('mock-create-sbt-group');
    expect(modal).toHaveAttribute('data-session-slug', 'draft-session-slug');
    expect(modal).toHaveAttribute('data-session-config-slug', 'draft-session-slug');
  });

  it('drops the worker Arweave JWK override from the inline create-SBT modal when require-pay is enabled', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SLUG), {
      target: { value: 'inline-proof-user-paid' },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
      target: { value: '{"kty":"RSA"}' },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_SECRETS_REQUIRE_PAY));

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    const modal = await screen.findByTestId('mock-create-sbt-group');
    expect(modal).toHaveAttribute('data-session-slug', 'inline-proof-user-paid');
    expect(modal).toHaveAttribute('data-session-config-slug', 'inline-proof-user-paid');
    expect(modal).toHaveAttribute('data-arweave-jwk', '');
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
