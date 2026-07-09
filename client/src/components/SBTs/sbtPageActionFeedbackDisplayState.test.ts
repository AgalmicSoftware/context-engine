import { resolveSbtPageActionFeedbackDisplayDescriptor } from './sbtPageActionFeedbackDisplayState';

const mintTxHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
const burnTxHash = '0x2222222222222222222222222222222222222222222222222222222222222222';
const errorTxHash = '0x3333333333333333333333333333333333333333333333333333333333333333';

const labels = {
  burnLabel: 'Burn',
  burnedLowerLabel: 'burned',
  mintLabel: 'Mint',
  mintedLowerLabel: 'minted',
  sbtLabel: 'SBT',
};

describe('resolveSbtPageActionFeedbackDisplayDescriptor', () => {
  it('describes mint, burn, and error transaction links from parent-provided hashes', () => {
    const getExplorerLink = jest.fn((hash: unknown) => `https://explorer.example.test/tx/${String(hash || '')}`);

    const descriptor = resolveSbtPageActionFeedbackDisplayDescriptor({
      actionFeedbackState: {
        showBurnSuccess: true,
        showErrorTransactionHash: true,
        showMintSuccess: true,
        showTransactionError: true,
      },
      errorMessage: 'wallet rejected transaction',
      getExplorerLink,
      labels,
      transactionState: {
        lastBurnTxHash: burnTxHash,
        lastMintTxHash: mintTxHash,
        transactionHash: errorTxHash,
      },
    });

    expect(descriptor).toEqual({
      burnSuccess: {
        message: 'SBT successfully burned!',
        show: true,
        txLabel: 'Burn Tx Hash:',
        txLink: {
          href: `https://explorer.example.test/tx/${burnTxHash}`,
          text: '0x2222...222222',
        },
      },
      mintSuccess: {
        message: 'SBT successfully minted!',
        show: true,
        txLabel: 'Mint Tx Hash:',
        txLink: {
          href: `https://explorer.example.test/tx/${mintTxHash}`,
          text: '0x1111...111111',
        },
      },
      transactionError: {
        errorMessage: 'wallet rejected transaction',
        show: true,
        txLink: {
          href: `https://explorer.example.test/tx/${errorTxHash}`,
          text: '0x3333...333333',
        },
      },
    });
    expect(getExplorerLink).toHaveBeenCalledTimes(3);
    expect(getExplorerLink).toHaveBeenNthCalledWith(1, mintTxHash);
    expect(getExplorerLink).toHaveBeenNthCalledWith(2, burnTxHash);
    expect(getExplorerLink).toHaveBeenNthCalledWith(3, errorTxHash);
  });

  it('keeps hidden feedback inert and does not format hidden transaction links', () => {
    const getExplorerLink = jest.fn((hash: unknown) => `https://explorer.example.test/tx/${String(hash || '')}`);

    const descriptor = resolveSbtPageActionFeedbackDisplayDescriptor({
      actionFeedbackState: {},
      errorMessage: 'wallet rejected transaction',
      getExplorerLink,
      labels,
      transactionState: {
        lastBurnTxHash: burnTxHash,
        lastMintTxHash: mintTxHash,
        transactionHash: errorTxHash,
      },
    });

    expect(descriptor).toEqual({
      burnSuccess: {
        message: 'SBT successfully burned!',
        show: undefined,
        txLabel: 'Burn Tx Hash:',
        txLink: {
          href: '',
          text: '',
        },
      },
      mintSuccess: {
        message: 'SBT successfully minted!',
        show: undefined,
        txLabel: 'Mint Tx Hash:',
        txLink: {
          href: '',
          text: '',
        },
      },
      transactionError: {
        errorMessage: 'wallet rejected transaction',
        show: undefined,
        txLink: null,
      },
    });
    expect(getExplorerLink).not.toHaveBeenCalled();
  });

  it('preserves an error transaction link descriptor independently from error visibility', () => {
    const getExplorerLink = jest.fn((hash: unknown) => `https://explorer.example.test/tx/${String(hash || '')}`);

    expect(
      resolveSbtPageActionFeedbackDisplayDescriptor({
        actionFeedbackState: {
          showErrorTransactionHash: true,
          showTransactionError: false,
        },
        errorMessage: 'wallet rejected transaction',
        getExplorerLink,
        labels,
        transactionState: {
          transactionHash: errorTxHash,
        },
      }).transactionError,
    ).toEqual({
      errorMessage: 'wallet rejected transaction',
      show: false,
      txLink: {
        href: `https://explorer.example.test/tx/${errorTxHash}`,
        text: '0x3333...333333',
      },
    });
  });
});
