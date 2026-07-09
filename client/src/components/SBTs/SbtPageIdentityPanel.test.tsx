import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SbtPageIdentityPanel from './SbtPageIdentityPanel';

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageIdentityPanel>> = {}) => ({
  addressDisplay: '0x000...00f1',
  bookmarkIconStyle: { color: '#FFD700' },
  contractCopyIconState: {
    shouldRenderCopiedIcon: false,
    shouldRenderDefaultIcon: true,
  },
  descriptionLockIconStyle: { marginRight: '6px' },
  descriptionText: 'Credential for the access lane.',
  explorerUrl: 'https://explorer.example.test/token',
  imageAlt: 'Access Badge',
  imageUrl: 'https://cdn.example.test/badge.png',
  nameText: 'Access Badge',
  onBookmark: jest.fn(),
  onContractCopy: jest.fn(),
  onImageError: jest.fn(),
  onImageOpen: jest.fn(),
  showDescriptionLockIcon: true,
  tokenUriHref: 'https://arweave.example.test/metadata',
  ...overrides,
});

describe('SbtPageIdentityPanel', () => {
  it('renders SBT identity, media, contract, and metadata links from explicit props', () => {
    render(<SbtPageIdentityPanel {...createProps()} />);

    expect(screen.getByTestId(E2E_TESTIDS.SBT_PAGE_NAME)).toHaveTextContent('Access Badge');
    expect(screen.getByTestId(E2E_TESTIDS.SBT_PAGE_DESCRIPTION)).toHaveTextContent('Credential for the access lane.');
    expect(screen.getByTestId(E2E_TESTIDS.SBT_PAGE_IMAGE)).toHaveAttribute('src', 'https://cdn.example.test/badge.png');
    expect(screen.getByRole('link', { name: '0x000...00f1' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/token',
    );
    expect(screen.getByRole('link', { name: '0x000...00f1' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByTitle('Open token metadata')).toHaveAttribute('href', 'https://arweave.example.test/metadata');
    expect(screen.getByTitle('Open token metadata')).toHaveAttribute('target', '_blank');
  });

  it('preserves handler wiring for passive identity controls', () => {
    const onBookmark = jest.fn();
    const onContractCopy = jest.fn();
    const onImageError = jest.fn();
    const onImageOpen = jest.fn();
    render(
      <SbtPageIdentityPanel
        {...createProps({
          onBookmark,
          onContractCopy,
          onImageError,
          onImageOpen,
        })}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getAllByRole('button')[1]);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SBT_PAGE_IMAGE).parentElement as HTMLElement);
    fireEvent.error(screen.getByTestId(E2E_TESTIDS.SBT_PAGE_IMAGE));

    expect(onBookmark).toHaveBeenCalledTimes(1);
    expect(onContractCopy).toHaveBeenCalledTimes(1);
    expect(onImageError).toHaveBeenCalledTimes(1);
    expect(onImageOpen).toHaveBeenCalledTimes(1);
  });

  it('omits optional description and token metadata link when absent', () => {
    render(
      <SbtPageIdentityPanel
        {...createProps({
          descriptionText: '',
          tokenUriHref: '',
        })}
      />,
    );

    expect(screen.queryByTestId(E2E_TESTIDS.SBT_PAGE_DESCRIPTION)).toBeNull();
    expect(screen.queryByTitle('Open token metadata')).toBeNull();
  });
});
