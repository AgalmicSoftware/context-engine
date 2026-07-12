// Remaining broad SessionWizard render coverage owns section visibility, metadata details, slug validation, tooltips, and login guards.
import fs from 'fs';
import React from 'react';
import { ethers } from 'ethers';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  getContractViewerCardTestId,
  getContractViewerSourceTestId,
  getSessionWizardContractModalTriggerTestId,
  getSessionWizardContractTooltipTestId,
  WIZARD_CONTRACT_MODAL_TESTID,
} from '../ContractPage/contractMetadata.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import {
  clearSessionWizardPendingSbtDraftsCache,
  readSessionWizardPendingSbtDraftsCache,
} from './hooks/usePendingSbtDrafts.js';

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
    buildArweaveGatewayUrl: jest.fn((txId) => `https://arweave.net/${txId}`),
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

import SessionWizard, { REQUIRED_SESSION_SLUG_ERROR, RESERVED_SESSION_SLUG_ERROR } from './SessionWizard';

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
const enableAdvancedMode = () => {
  const customizeButton = screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED);
  if (customizeButton.getAttribute('aria-pressed') !== 'true') {
    fireEvent.click(customizeButton);
  }
};
const selectNormalModeCard = (label) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
};
const selectCloudflarePreset = () => {
  fireEvent.click(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare'));
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
  });
  expect(readSessionWizardPendingSbtDraftsCache()).toEqual([
    expect.objectContaining({ predictedAddress: mockPendingSbtAddress }),
  ]);
  await ensureGateASelectorVisible();
  await waitFor(() => {
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
      'data-ce-sbt-address',
      mockPendingSbtAddress.toLowerCase(),
    );
    expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
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
    selectDecentralizedPreset();
    enableAdvancedMode();

    const defaultChainId = require('../../variables/appConfig.js').DEFAULT_CHAIN_ID;
    const defaultChain = require('../../variables/chains.js').getChainById(defaultChainId);
    const defaultChainLabel = `${defaultChain?.name || `Chain ${defaultChainId}`} (${defaultChainId})`;
    const chainSelectorWrap = screen.getByText('Network:').parentElement;
    expect(chainSelectorWrap).toBeTruthy();
    expect(within(chainSelectorWrap).getByRole('combobox')).toHaveValue(String(defaultChainId));
    expect(screen.getByDisplayValue(defaultChainLabel)).toBeInTheDocument();
  });

  it('defaults auto-feature session groups to enabled for fresh /new drafts', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();

    expect(screen.getByRole('checkbox', { name: /Auto-feature Session/i })).toBeChecked();
  });

  it('hides the mode toggle behind a cog when a sponsored link is present', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByRole('button', { name: 'Session wizard display settings' })).not.toBeInTheDocument();
    const customizeButton = screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED);
    expect(customizeButton).toBeVisible();
    expect(customizeButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(customizeButton);

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

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Session wizard display settings' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('checkbox', { name: /Auto-feature Session/i })).toBeChecked();
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
      '/contracts?contract=sessionRegistry&session=session-alpha',
    );
    expect(within(modal).getByTestId('ce-wizard-contract-modal-full-link')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('uses noopener noreferrer on every blank-target anchor in the source', () => {
    const sourceFiles = [
      './SessionWizard',
      './SessionPublishSummary',
      './SessionPublishResultLinks',
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

    expect(await screen.findByDisplayValue('group, event, idea, demographic, location')).toBeInTheDocument();
  });

  it('keeps block limits inside optional details in normal mode when the draft contains them', async () => {
    localStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          blockLimits: {
            start: 987654,
            end: 988000,
          },
        },
      }),
    );

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
    localStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          sponsoredSbtAddress,
        },
      }),
    );

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
    selectDecentralizedPreset();
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
        screen.getByTitle('Private URL mode enabled (uses session ID). Click to restore manual URL.'),
      ).toBeInTheDocument();
    });
  });

  it('pins the slug after a pending SBT draft is queued', async () => {
    renderLoggedInSessionWizard();
    selectDecentralizedPreset();

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
    expect(
      screen.getByText(
        'Queued Group drafts pinned this slug so their uploaded metadata stays aligned with the final session URL.',
      ),
    ).toBeInTheDocument();
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
    selectCloudflarePreset();
    enableAdvancedMode();
    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    fireEvent.change(slugInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('Publish').closest('button'));
    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH));

    expect(await screen.findByText(REQUIRED_SESSION_SLUG_ERROR)).toBeInTheDocument();
  });

  it.each(['/new', '/session/new'])(
    'shows only session mode on %s until a preset reveals the prefilled setup',
    async (pathname) => {
      localStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          draft: {
            sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
            storageProfile: { backend: 'cloudflare' },
          },
        }),
      );
      window.history.replaceState({}, '', pathname);
      renderSessionWizard();

      expect(screen.queryByTestId('ce-new-preset-continue')).not.toBeInTheDocument();
      expect(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('ce-new-preset-trustless_public_decentralized')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.queryByText('Custom')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /advanced options/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED)).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).not.toBeInTheDocument();
      expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('ce-new-preset-trustless_public_decentralized'));
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toBeInTheDocument();
      expect(screen.queryByTestId('ce-new-preset-continue')).not.toBeInTheDocument();
      expect(screen.getByTestId('ce-new-preset-trustless_public_decentralized')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /advanced options/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();

      enableAdvancedMode();
      fireEvent.click(screen.getByRole('button', { name: 'Session Storage expand' }));
      expect(screen.getByRole('radio', { name: 'Arweave' })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: 'Cloudflare' })).toHaveAttribute('aria-checked', 'false');
    },
  );

  it('checks session slug collisions before publish upload or register side effects', async () => {
    const { arweaveScripts } = require('../../utilities/arweave/arweaveScripts.js');
    let publishClicked = false;
    mockSessionExists.mockImplementation(async () => publishClicked);

    renderLoggedInSessionWizard();
    selectCloudflarePreset();
    enableAdvancedMode();
    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    fireEvent.change(sessionNameInput, {
      target: { value: 'Duplicate Session' },
    });
    fireEvent.change(slugInput, {
      target: { value: 'duplicate-session' },
    });
    await createPendingFeaturedDraft();

    fireEvent.click(screen.getByText('Publish').closest('button'));
    const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
    fireEvent.click(screen.getByLabelText('Advanced publish settings'));
    fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
      target: { value: `ar://${'a'.repeat(43)}` },
    });
    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });
    publishClicked = true;
    fireEvent.click(publishButton);

    expect(await screen.findByText('Session slug already exists on-chain: duplicate-session')).toBeInTheDocument();
    expect(mockSessionExists).toHaveBeenCalledWith('duplicate-session');
    expect(mockCreateSBT).not.toHaveBeenCalled();
    expect(arweaveScripts.uploadDataToArweave).not.toHaveBeenCalled();
    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
  });

  it('shows and clears the reserved slug error in the rendered form', async () => {
    renderSessionWizard();
    enableAdvancedMode();

    const slugInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG);

    fireEvent.change(slugInput, { target: { value: 'general' } });
    expect(screen.getByText(RESERVED_SESSION_SLUG_ERROR)).toBeInTheDocument();

    fireEvent.change(slugInput, { target: { value: 'edge-custom' } });
    expect(screen.queryByText(RESERVED_SESSION_SLUG_ERROR)).not.toBeInTheDocument();
  });
});
