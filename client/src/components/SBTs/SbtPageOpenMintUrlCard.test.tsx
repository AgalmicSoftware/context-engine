import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SbtPageOpenMintUrlCard from './SbtPageOpenMintUrlCard';

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageOpenMintUrlCard>> = {}) => ({
  copyIconState: {
    shouldRenderCopiedIcon: false,
    shouldRenderDefaultIcon: true,
  },
  onCopy: jest.fn(),
  openMintAutoJoinUrl: 'https://context.example.test/session/edge?sbt=0xabc&autoMint=1',
  ...overrides,
});

describe('SbtPageOpenMintUrlCard', () => {
  it('renders the open-mint URL card with the preserved test id, label, and external link', () => {
    render(<SbtPageOpenMintUrlCard {...createProps()} />);

    expect(screen.getByTestId(E2E_TESTIDS.SBT_PAGE_OPEN_MINT_URL)).toHaveTextContent('URL Where Anyone Can Join');
    expect(screen.getByTitle('https://context.example.test/session/edge?sbt=0xabc&autoMint=1')).toHaveTextContent(
      'https://context.example.test/session/edge?sbt=0xabc&autoMint=1',
    );
    expect(screen.getByRole('link', { name: 'Open open mint URL' })).toHaveAttribute(
      'href',
      'https://context.example.test/session/edge?sbt=0xabc&autoMint=1',
    );
  });

  it('wires the copy button to the parent-owned copy handler', () => {
    const onCopy = jest.fn();
    render(
      <SbtPageOpenMintUrlCard
        {...createProps({
          onCopy,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy open mint URL' }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
