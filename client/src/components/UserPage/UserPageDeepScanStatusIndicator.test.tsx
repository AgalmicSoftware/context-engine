import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageDeepScanStatusIndicator from './UserPageDeepScanStatusIndicator';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({
    autohide,
    children,
    target,
    trigger,
  }: {
    autohide?: boolean;
    children: React.ReactNode;
    target: string;
    trigger?: string;
  }) => (
    <div data-testid="deep-scan-tooltip" data-autohide={String(autohide)} data-target={target} data-trigger={trigger}>
      {children}
    </div>
  ),
}));

const progressRow = {
  chainId: 84532,
  displayLastBlock: 123,
  isDeterminate: true,
  label: 'Alpha session',
  lastBlockScanned: 123,
  latestBlock: 223,
  percentComplete: 50,
  remainingBlocks: 100,
  slug: 'alpha',
  startBlock: 23,
};

describe('UserPageDeepScanStatusIndicator', () => {
  it('renders spinner, tooltip progress panel, and spinner event boundaries', () => {
    const onSpinnerEvent = jest.fn((event: React.MouseEvent<HTMLElement>) => event.stopPropagation());
    const { container } = render(
      <UserPageDeepScanStatusIndicator
        onSpinnerEvent={onSpinnerEvent}
        progressRows={[progressRow]}
        targetId="deepScanTarget"
        titleText="Scanning profile"
        tooltipLines={['Fallback line']}
      />,
    );

    const spinner = container.querySelector('#deepScanTarget') as SVGElement;
    expect(spinner).toBeInTheDocument();
    expect(spinner.querySelector('title')).toHaveTextContent('Scanning profile');
    expect(screen.getByTestId('deep-scan-tooltip')).toHaveAttribute('data-target', 'deepScanTarget');
    expect(screen.getByTestId('deep-scan-tooltip')).toHaveAttribute('data-trigger', 'hover focus click');
    expect(screen.getByTestId('deep-scan-tooltip')).toHaveAttribute('data-autohide', 'false');
    expect(screen.getByText('Deep scan in progress')).toBeInTheDocument();
    expect(screen.getByText('Alpha session')).toBeInTheDocument();

    fireEvent.mouseDown(spinner);
    fireEvent.click(spinner);
    expect(onSpinnerEvent).toHaveBeenCalledTimes(2);
  });

  it('renders tooltip text lines when progress rows are unavailable', () => {
    render(
      <UserPageDeepScanStatusIndicator
        progressRows={[]}
        targetId="deepScanTextTarget"
        titleText=""
        tooltipLines={['Checking cache', 'Scanning chain']}
      />,
    );

    expect(screen.getByTestId('deep-scan-tooltip')).toHaveAttribute('data-target', 'deepScanTextTarget');
    expect(screen.getByText('Checking cache')).toBeInTheDocument();
    expect(screen.getByText('Scanning chain')).toBeInTheDocument();
  });

  it('omits the tooltip when there is no tooltip content', () => {
    render(
      <UserPageDeepScanStatusIndicator
        progressRows={[]}
        targetId="deepScanEmptyTarget"
        titleText=""
        tooltipLines={[]}
      />,
    );

    expect(screen.queryByTestId('deep-scan-tooltip')).toBeNull();
  });
});
