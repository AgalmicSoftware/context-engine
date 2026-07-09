import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SbtPageMiniCardDisplay from './SbtPageMiniCardDisplay';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe('SbtPageMiniCardDisplay', () => {
  it('renders passive identity, image, address, lock, and live status descriptors', () => {
    const onImageError = jest.fn();

    render(
      <SbtPageMiniCardDisplay
        imageUrl="https://example.test/badge.png"
        isMintingActive={true}
        mintStatusId="mint-status"
        mintingLabel="Minting"
        onImageError={onImageError}
        sbtAddress="0x00000000000000000000000000000000000000f1"
        sbtName="Access Badge"
        shouldRenderLiveIndicator={true}
        showLockIcon={true}
        showMiniSbtAddress={true}
      />,
    );

    const image = screen.getByTestId(E2E_TESTIDS.SBT_PAGE_IMAGE);
    expect(image).toHaveAttribute('src', 'https://example.test/badge.png');
    expect(image).toHaveAttribute('alt', 'Access Badge');
    expect(screen.getByText('Access Badge')).toBeInTheDocument();
    expect(screen.getByText('0x000...00f1')).toBeInTheDocument();
    expect(screen.getByLabelText('Minting Live')).toBeInTheDocument();
    expect(screen.getByText('Minting Live')).toBeInTheDocument();

    fireEvent.error(image);
    expect(onImageError).toHaveBeenCalledTimes(1);
  });

  it('renders ended status and hides address when descriptors request it', () => {
    render(
      <SbtPageMiniCardDisplay
        imageUrl="https://example.test/badge.png"
        isMintingActive={false}
        mintStatusId="mint-status-ended"
        mintingLabel="Minting"
        sbtAddress="0x00000000000000000000000000000000000000f1"
        sbtName="Ended Badge"
        shouldRenderEndedIndicator={true}
      />,
    );

    expect(screen.getByText('Ended Badge')).toBeInTheDocument();
    expect(screen.getByLabelText('Minting Ended')).toBeInTheDocument();
    expect(screen.getByText('Minting Ended')).toBeInTheDocument();
    expect(screen.queryByText('0x000...00f1')).not.toBeInTheDocument();
  });
});
