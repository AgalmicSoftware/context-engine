import React from 'react';
import { render, screen } from '@testing-library/react';

import { UserPageDeepScanProgressPanel } from './UserPageDeepScanProgressPanel';

const styles = {
  deepScanIndeterminate: 'deepScanIndeterminate',
  deepScanProgressBar: 'deepScanProgressBar',
  deepScanProgressFill: 'deepScanProgressFill',
  deepScanProgressHeader: 'deepScanProgressHeader',
  deepScanProgressLabel: 'deepScanProgressLabel',
  deepScanProgressPanel: 'deepScanProgressPanel',
  deepScanProgressRow: 'deepScanProgressRow',
  deepScanProgressStats: 'deepScanProgressStats',
};

describe('UserPageDeepScanProgressPanel', () => {
  it('renders determinate and indeterminate deep-scan rows', () => {
    render(
      <UserPageDeepScanProgressPanel
        progressRows={[
          {
            chainId: 84532,
            displayLastBlock: 1600,
            isDeterminate: true,
            label: 'Alpha Session',
            lastBlockScanned: 1600,
            latestBlock: 2000,
            percentComplete: 60,
            remainingBlocks: 400,
            slug: 'alpha',
            startBlock: 1000,
          },
          {
            chainId: 84532,
            displayLastBlock: 0,
            isDeterminate: false,
            label: 'Beta Session',
            lastBlockScanned: 0,
            latestBlock: null,
            percentComplete: null,
            remainingBlocks: null,
            slug: 'beta',
            startBlock: null,
          },
        ]}
        styles={styles}
      />,
    );

    expect(screen.getByText('Deep scan in progress')).toBeInTheDocument();
    expect(screen.getByText('Alpha Session')).toBeInTheDocument();
    expect(screen.getByText('400 blocks remaining')).toBeInTheDocument();
    expect(screen.getByText('1,600 / 2,000 scanned')).toBeInTheDocument();
    expect(screen.getByText('Beta Session')).toBeInTheDocument();
    expect(screen.getByText('0 scanned')).toBeInTheDocument();
  });

  it('can omit header and scanned block text for compact contexts', () => {
    render(
      <UserPageDeepScanProgressPanel
        headerText=""
        progressRows={[
          {
            chainId: 84532,
            displayLastBlock: 1600,
            isDeterminate: true,
            label: 'Alpha Session',
            lastBlockScanned: 1600,
            latestBlock: 2000,
            percentComplete: 60,
            remainingBlocks: 400,
            slug: 'alpha',
            startBlock: 1000,
          },
        ]}
        showScannedText={false}
        styles={styles}
      />,
    );

    expect(screen.queryByText('Deep scan in progress')).not.toBeInTheDocument();
    expect(screen.getByText('400 blocks remaining')).toBeInTheDocument();
    expect(screen.queryByText('1,600 / 2,000 scanned')).not.toBeInTheDocument();
  });
});
