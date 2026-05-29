import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageActionsSection from './SbtPageActionsSection';

const createProps = (
  overrides: Partial<React.ComponentProps<typeof SbtPageActionsSection>> = {}
) => ({
  actionFeedbackState: {
    showBurnSuccess: false,
    showErrorTransactionHash: false,
    showMintSuccess: false,
    showTransactionError: false,
  },
  burnButton: <button type="button">Burn Action</button>,
  burnLabel: 'Burn',
  burnSuccessHref: 'https://explorer.example.test/burn',
  burnSuccessText: '0xburn',
  burnedLowerLabel: 'burned',
  copyErrorButtonStyle: { marginLeft: '8px' },
  errorCopyIconState: {
    shouldRenderCopiedIcon: false,
    shouldRenderDefaultIcon: true,
  },
  errorMessage: 'wallet rejected transaction',
  isOpen: true,
  mintButton: <button type="button">Mint Action</button>,
  mintLabel: 'Mint',
  mintSuccessHref: 'https://explorer.example.test/mint',
  mintSuccessText: '0xmint',
  mintedLowerLabel: 'minted',
  onCopyError: jest.fn(),
  onToggle: jest.fn(),
  sbtLabel: 'SBT',
  sectionHeaderClassName: 'section-header',
  shouldRenderClosedIcon: false,
  shouldRenderOpenIcon: true,
  transactionErrorHref: 'https://explorer.example.test/error',
  transactionErrorText: '0xerror',
  ...overrides,
});

describe('SbtPageActionsSection', () => {
  it('renders parent-owned action buttons and preserves the section toggle handler', () => {
    const onToggle = jest.fn();
    render(
      <SbtPageActionsSection
        {...createProps({
          onToggle,
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Mint Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Burn Action' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('ACTIONS'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders mint and burn success links from explicit transaction props', () => {
    render(
      <SbtPageActionsSection
        {...createProps({
          actionFeedbackState: {
            showBurnSuccess: true,
            showMintSuccess: true,
          },
        })}
      />
    );

    expect(screen.getByText(/SBT successfully minted!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xmint' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/mint'
    );
    expect(screen.getByRole('link', { name: '0xmint' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '0xmint' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/SBT successfully burned!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xburn' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/burn'
    );
    expect(screen.getByRole('link', { name: '0xburn' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '0xburn' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders transaction error copy controls and optional transaction link', () => {
    const onCopyError = jest.fn();
    render(
      <SbtPageActionsSection
        {...createProps({
          actionFeedbackState: {
            showErrorTransactionHash: true,
            showTransactionError: true,
          },
          onCopyError,
        })}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Transaction Failed: wallet rejected transaction');
    expect(screen.getByRole('link', { name: '0xerror' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/error'
    );
    expect(screen.getByRole('link', { name: '0xerror' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '0xerror' })).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Copy error message' }));
    expect(onCopyError).toHaveBeenCalledTimes(1);
  });

  it('hides the actions body when the parent-derived section state is closed', () => {
    render(
      <SbtPageActionsSection
        {...createProps({
          isOpen: false,
          shouldRenderClosedIcon: true,
          shouldRenderOpenIcon: false,
        })}
      />
    );

    expect(screen.getByText('ACTIONS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mint Action' })).toBeNull();
    expect(screen.queryByText(/Transaction Failed:/)).toBeNull();
  });
});
