import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';

import { renderSbtPageFullView } from './SbtPageFullView';

jest.mock('reactstrap', () => ({
  Alert: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div role="alert" className={className}>
      {children}
    </div>
  ),
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
    isOpen ? <div data-testid="mock-modal">{children}</div> : null,
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalHeader: ({ children, close }: { children: React.ReactNode; close?: React.ReactNode }) => (
    <div>
      {children}
      {close}
    </div>
  ),
}));

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('./SBTFilter', () => ({
  __esModule: true,
  default: ({ onFilter }: { onFilter: (filtered: unknown[]) => void }) => (
    <button type="button" onClick={() => onFilter(['filtered-holder'])}>
      Apply holder filter
    </button>
  ),
}));

const sbtAddress = '0x00000000000000000000000000000000000000a1';
const holderAddress = '0x00000000000000000000000000000000000000b1';

type FullViewArgs = Parameters<typeof renderSbtPageFullView>[0];
type FullViewArgsOverrides = Partial<
  Omit<FullViewArgs, 'actionLabels' | 'callbacks' | 'identityPanelDisplayState' | 'state'>
> & {
  actionLabels?: Partial<FullViewArgs['actionLabels']>;
  callbacks?: Partial<FullViewArgs['callbacks']>;
  identityPanelDisplayState?: Partial<FullViewArgs['identityPanelDisplayState']>;
  state?: Partial<FullViewArgs['state']>;
};

const createArgs = (overrides: FullViewArgsOverrides = {}): FullViewArgs => {
  const base: FullViewArgs = {
    actionLabels: {
      burn: 'Burn',
      burnedLower: 'burned',
      mint: 'Mint',
      mintedLower: 'minted',
      minting: 'Minting',
    },
    actionSurfaces: {
      burnButton: <button type="button">Burn Action</button>,
      mintButton: <button type="button">Mint Action</button>,
    },
    adminActions: <button type="button">Admin action</button>,
    callbacks: {
      bookmarkSBT: jest.fn(),
      closeDocModal: jest.fn(),
      closeModal: jest.fn(),
      copyErrorToClipboard: jest.fn(),
      copyToClipboard: jest.fn(),
      getExplorerLink: (hash) => `https://explorer.example.test/tx/${hash || ''}`,
      getExplorerUrl: (address) => `https://explorer.example.test/address/${address || ''}`,
      handleModalFilteredMintedUsers: jest.fn(),
      onBackToList: jest.fn(),
      openMintedModal: jest.fn(),
      renderAddressLink: (address, key) => (
        <span data-testid={`address-${key || 'contract'}`}>{String(address || 'N/A')}</span>
      ),
      toggleActions: jest.fn(),
      toggleAdminSection: jest.fn(),
      toggleFullImage: jest.fn(),
      toggleMoreDetails: jest.fn(),
      toggleStats: jest.fn(),
    },
    defaultFeaturedSBTs: [sbtAddress],
    filterNetwork: { id: 84532 },
    identityPanelDisplayState: {
      descriptionText: 'Badge description',
      imageAlt: 'Badge',
      nameText: 'Badge',
      showDescriptionLockIcon: false,
    },
    imageUrl: 'https://example.test/badge.png',
    isHolderScanActive: false,
    isSBTCacheReady: true,
    mintedLabel: 'Minted',
    netHolders: [holderAddress],
    networkId: 84532,
    provider: 'provider',
    relevantInfo: <div>Relevant passive info</div>,
    resolveScanProgressSessionLabel: () => 'Demo session',
    sbtAddressForDisplay: sbtAddress,
    sbtCacheRevision: 1,
    sbtInfo: {
      admin: '0x00000000000000000000000000000000000000a2',
      burnAuth: 0,
      chainID: 84532,
      creator: '0x00000000000000000000000000000000000000a3',
      image: 'https://example.test/badge.png',
      maxTokens: '10',
      mintingEndTime: 0,
      name: 'Badge',
      tokenURI: 'https://example.test/metadata.json',
    },
    sbtLabel: 'SBT',
    sbtMintPassword: '',
    scanProgress: null,
    sessionSlug: 'demo',
    state: {
      bookmarked: false,
      burnedAddresses: [],
      burningStatus: 'idle',
      copiedAddress: '',
      copiedError: false,
      countsLoaded: true,
      docModalBlobUrl: '',
      docModalContent: '',
      docModalError: '',
      docModalLoading: false,
      docModalName: '',
      docModalOpen: false,
      error: '',
      filteredMintedUsers: [holderAddress],
      lastBurnTxHash: '',
      lastMintTxHash: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      mintCountdown: '1 day',
      mintedAddresses: [holderAddress],
      mintedTokensOverride: null,
      mintingStatus: 'idle',
      mintPassword: '',
      showActions: true,
      showAdminSection: true,
      showFullImage: false,
      showModal: false,
      showMoreDetails: true,
      showPasswordAlert: false,
      showStats: true,
      transactionHash: '',
      userIsSbtAdmin: true,
    },
    workerScanInProgress: false,
    workerScanPending: false,
  };

  return {
    ...base,
    ...overrides,
    actionLabels: {
      ...base.actionLabels,
      ...overrides.actionLabels,
    },
    callbacks: {
      ...base.callbacks,
      ...overrides.callbacks,
    },
    identityPanelDisplayState: {
      ...base.identityPanelDisplayState,
      ...overrides.identityPanelDisplayState,
    },
    state: {
      ...base.state,
      ...overrides.state,
    },
  };
};

describe('renderSbtPageFullView', () => {
  it('renders the passive full-view panels in the expected order', () => {
    const { container } = render(renderSbtPageFullView(createArgs()));
    const text = container.textContent || '';

    expect(text.indexOf('STATS')).toBeLessThan(text.indexOf('ACTIONS'));
    expect(text.indexOf('ACTIONS')).toBeLessThan(text.indexOf('ADMIN'));
    expect(text.indexOf('ADMIN')).toBeLessThan(text.indexOf('MORE'));
    expect(screen.getByText('Relevant passive info')).toBeInTheDocument();
  });

  it('preserves the loading fallback without rendering the full shell controls', () => {
    render(
      renderSbtPageFullView(
        createArgs({
          netHolders: [],
          sbtInfo: null,
          state: {
            error: '',
            filteredMintedUsers: [],
            mintedAddresses: [],
          },
        }),
      ),
    );

    expect(screen.getByText('Loading SBT Details')).toBeInTheDocument();
    expect(screen.queryByText('SBT list')).toBeNull();
  });

  it('keeps the loading title readable on the Minimal white page', () => {
    const stylesheet = fs.readFileSync(path.join(__dirname, 'SBTPage.module.scss'), 'utf8');

    expect(stylesheet).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*minimal-app\)\s*{[\s\S]*?\.loadingTitle,[\s\S]*?color:\s*var\(--ce-document-text\);/,
    );
  });

  it('keeps the group page, mini cards, and modals readable on Minimal light surfaces', () => {
    const stylesheet = fs.readFileSync(path.join(__dirname, 'SBTPage.module.scss'), 'utf8');
    const minimalStart = stylesheet.indexOf('@container ce-theme style(--ce-layout-profile: minimal-app)');
    const minimal = stylesheet.slice(minimalStart);
    const colorAfter = (selector: string) => {
      const index = minimal.indexOf(selector);
      expect(index).toBeGreaterThan(-1);
      return minimal.slice(index).match(/(?:^|[\s;{])color:\s*([^;]+);/)?.[1];
    };

    expect(minimalStart).toBeGreaterThan(-1);
    // White text meant for dark cards becomes theme document or overlay text.
    for (const selector of [
      '.sbtPage .sbtInfo .rightColumn .sectionHeader',
      '.sbtPage .sbtInfo .rightColumn .stats p,',
      '.sbtPage .adminContainer .adminActions .autoMintUrlText',
      '.relevantInfo,',
    ]) {
      expect(colorAfter(selector)).toBe('var(--ce-document-text)');
    }
    expect(colorAfter('.sbtPage .sbtInfo .leftColumn .description p')).toBe('var(--ce-document-text-muted)');
    expect(colorAfter('.backButton,')).toBe('var(--ce-control-text)');
    expect(colorAfter('.modalHeader .modalTitle,')).toBe('var(--ce-overlay-text)');
    expect(colorAfter('.modalBody button:not(.userItemActions button)')).toBe('var(--ce-action-accent-text)');
    expect(minimal).toMatch(
      /\.sbtPage \.sbtInfo \.leftColumn,\s*\.sbtPage \.adminContainer\s*{\s*background:\s*var\(--ce-surface-alt\);/,
    );
    // Only theme tokens: no inverse text and no color literals in the Minimal block.
    expect(minimal).not.toContain('--ce-text-inverse');
    expect(minimal).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(/i);
  });

  it('wires full-view section handlers without owning side effects', () => {
    const onBackToList = jest.fn();
    const toggleStats = jest.fn();
    const toggleActions = jest.fn();
    const toggleAdminSection = jest.fn();
    const toggleMoreDetails = jest.fn();
    render(
      renderSbtPageFullView(
        createArgs({
          callbacks: {
            onBackToList,
            toggleStats,
            toggleActions,
            toggleAdminSection,
            toggleMoreDetails,
          },
          sbtMintPassword: 'detected-password',
          state: {
            showPasswordAlert: true,
          },
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /SBT list/ }));
    fireEvent.click(screen.getByText('STATS'));
    fireEvent.click(screen.getByText('ACTIONS'));
    fireEvent.click(screen.getByText('ADMIN'));
    fireEvent.click(screen.getByText('MORE'));

    expect(screen.getByRole('alert')).toHaveTextContent('Password detected');
    expect(onBackToList).toHaveBeenCalledTimes(1);
    expect(toggleStats).toHaveBeenCalledTimes(1);
    expect(toggleActions).toHaveBeenCalledTimes(1);
    expect(toggleAdminSection).toHaveBeenCalledTimes(1);
    expect(toggleMoreDetails).toHaveBeenCalledTimes(1);
  });

  it('passes holder modal fallback copy and filter handler through explicit props', () => {
    const handleModalFilteredMintedUsers = jest.fn();
    render(
      renderSbtPageFullView(
        createArgs({
          callbacks: {
            handleModalFilteredMintedUsers,
          },
          netHolders: [],
          state: {
            filteredMintedUsers: [],
            mintedAddresses: [],
            showModal: true,
          },
        }),
      ),
    );

    expect(screen.getByText('Holders')).toBeInTheDocument();
    expect(screen.getByText('No holders found.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply holder filter' }));
    expect(handleModalFilteredMintedUsers).toHaveBeenCalledWith(['filtered-holder']);
  });
});
