/* eslint-disable import/first */
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

const mockRegisterSessionOnChain = jest.fn();
const mockFetchSessionFromRegistry = jest.fn();
const mockUpsertSessionRegistryCache = jest.fn();
const mockSessionExists = jest.fn(async () => false);
const mockCreateSBT = jest.fn();
const mockFinalizeDeferredCreateSbtDraftUpload = jest.fn();
const mockDownloadDataFromArweave = jest.fn();
const mockDecryptWithPassword = jest.fn();
const mockPendingSbtAddress = ethers.utils.getAddress('0x5fbdb2315678afecb367f032d93f642f64180aa3');
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
    buildArweaveGatewayUrl: jest.fn((txId) => `https://arweave.example.test/${txId}`),
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
    address: TEST_ADMIN_ADDRESS,
    message: 'bootstrap-siwe-message',
    signature: '0xbootstrap-admin-auth',
    sessionSlug: slug,
  })),
  buildSignedAdminActionAuth: jest.fn(async ({ action, slug, body }) => ({
    address: TEST_ADMIN_ADDRESS,
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
  getSessionWizardPublishProgressPercent,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  resolveSessionWizardChipotleHookConfig,
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
const getWizardResourceCard = (resourceKey) => (
  screen.getAllByTestId(E2E_TESTIDS.WIZARD_RESOURCE_CARD)
    .find((card) => card.getAttribute('data-ce-resource-key') === resourceKey)
);
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

describe('SessionWizard pending SBT rendering', () => {
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

    expect(toggleLoginModal).toHaveBeenNthCalledWith(1, true);
    expect(screen.queryByTestId('mock-create-sbt-group')).not.toBeInTheDocument();

    view.rerender(
      <SessionWizard
        network={{ id: 84532 }}
        account={TEST_ADMIN_ADDRESS}
        loginComplete={true}
        toggleLoginModal={toggleLoginModal}
      />
    );

    await waitFor(() => {
      expect(toggleLoginModal).toHaveBeenNthCalledWith(2, false);
    });
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

});
