import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageActionsSection from './SbtPageActionsSection';

const mintTxHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
const burnTxHash = '0x2222222222222222222222222222222222222222222222222222222222222222';
const errorTxHash = '0x3333333333333333333333333333333333333333333333333333333333333333';

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageActionsSection>> = {}) => ({
  actionFeedbackState: {
    showBurnSuccess: false,
    showErrorTransactionHash: false,
    showMintSuccess: false,
    showTransactionError: false,
  },
  burnButton: <button type="button">Burn Action</button>,
  burnLabel: 'Burn',
  burnedLowerLabel: 'burned',
  copyErrorButtonStyle: { marginLeft: '8px' },
  errorCopyIconState: {
    shouldRenderCopiedIcon: false,
    shouldRenderDefaultIcon: true,
  },
  errorMessage: 'wallet rejected transaction',
  getExplorerLink: (hash: unknown) => `https://explorer.example.test/tx/${String(hash || '')}`,
  mintButton: <button type="button">Mint Action</button>,
  mintLabel: 'Mint',
  mintedLowerLabel: 'minted',
  onCopyError: jest.fn(),
  onToggle: jest.fn(),
  sbtLabel: 'SBT',
  sectionHeaderClassName: 'section-header',
  toggleState: {
    isOpen: true,
    shouldRenderClosedIcon: false,
    shouldRenderOpenIcon: true,
  },
  transactionState: {
    lastBurnTxHash: burnTxHash,
    lastMintTxHash: mintTxHash,
    transactionHash: errorTxHash,
  },
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
      />,
    );

    expect(screen.getByRole('button', { name: 'Mint Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Burn Action' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('ACTIONS'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders mint and burn success links from the transaction display state', () => {
    render(
      <SbtPageActionsSection
        {...createProps({
          actionFeedbackState: {
            showBurnSuccess: true,
            showMintSuccess: true,
          },
        })}
      />,
    );

    expect(screen.getByText(/SBT successfully minted!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0x1111...111111' })).toHaveAttribute(
      'href',
      `https://explorer.example.test/tx/${mintTxHash}`,
    );
    expect(screen.getByRole('link', { name: '0x1111...111111' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '0x1111...111111' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/SBT successfully burned!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0x2222...222222' })).toHaveAttribute(
      'href',
      `https://explorer.example.test/tx/${burnTxHash}`,
    );
    expect(screen.getByRole('link', { name: '0x2222...222222' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '0x2222...222222' })).toHaveAttribute('rel', 'noopener noreferrer');
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
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Transaction Failed: wallet rejected transaction');
    expect(screen.getByRole('link', { name: '0x3333...333333' })).toHaveAttribute(
      'href',
      `https://explorer.example.test/tx/${errorTxHash}`,
    );
    expect(screen.getByRole('link', { name: '0x3333...333333' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '0x3333...333333' })).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Copy error message' }));
    expect(onCopyError).toHaveBeenCalledTimes(1);
  });

  it('hides the actions body when the parent-derived section state is closed', () => {
    render(
      <SbtPageActionsSection
        {...createProps({
          toggleState: {
            isOpen: false,
            shouldRenderClosedIcon: true,
            shouldRenderOpenIcon: false,
          },
        })}
      />,
    );

    expect(screen.getByText('ACTIONS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mint Action' })).toBeNull();
    expect(screen.queryByText(/Transaction Failed:/)).toBeNull();
  });
});
