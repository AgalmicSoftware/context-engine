import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageActionFeedbackDisplay from './SbtPageActionFeedbackDisplay';

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageActionFeedbackDisplay>> = {}) => ({
  burnSuccess: {
    message: 'SBT successfully burned!',
    show: false,
    txLabel: 'Burn Tx Hash:',
    txLink: {
      href: 'https://explorer.example.test/tx/0xburn',
      text: '0xburn',
    },
  },
  copyErrorButtonStyle: { marginLeft: '8px' },
  errorCopyIconState: {
    shouldRenderCopiedIcon: false,
    shouldRenderDefaultIcon: true,
  },
  mintSuccess: {
    message: 'SBT successfully minted!',
    show: false,
    txLabel: 'Mint Tx Hash:',
    txLink: {
      href: 'https://explorer.example.test/tx/0xmint',
      text: '0xmint',
    },
  },
  onCopyError: jest.fn(),
  transactionError: {
    errorMessage: 'wallet rejected transaction',
    show: false,
    txLink: null,
  },
  ...overrides,
});

describe('SbtPageActionFeedbackDisplay', () => {
  it('renders success transaction descriptors as external links', () => {
    render(
      <SbtPageActionFeedbackDisplay
        {...createProps({
          burnSuccess: {
            message: 'SBT successfully burned!',
            show: true,
            txLabel: 'Burn Tx Hash:',
            txLink: {
              href: 'https://explorer.example.test/tx/0xburn',
              text: '0xburn',
            },
          },
          mintSuccess: {
            message: 'SBT successfully minted!',
            show: true,
            txLabel: 'Mint Tx Hash:',
            txLink: {
              href: 'https://explorer.example.test/tx/0xmint',
              text: '0xmint',
            },
          },
        })}
      />,
    );

    expect(screen.getByText(/SBT successfully minted!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xmint' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/tx/0xmint',
    );
    expect(screen.getByRole('link', { name: '0xmint' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '0xmint' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/SBT successfully burned!/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xburn' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/tx/0xburn',
    );
  });

  it('renders transaction errors and preserves copy handler ownership', () => {
    const onCopyError = jest.fn();

    render(
      <SbtPageActionFeedbackDisplay
        {...createProps({
          onCopyError,
          transactionError: {
            errorMessage: 'wallet rejected transaction',
            show: true,
            txLink: {
              href: 'https://explorer.example.test/tx/0xerr',
              text: '0xerr',
            },
          },
        })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Transaction Failed: wallet rejected transaction');
    expect(screen.getByRole('link', { name: '0xerr' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/tx/0xerr',
    );
    expect(onCopyError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Copy error message' }));
    expect(onCopyError).toHaveBeenCalledTimes(1);
  });
});
