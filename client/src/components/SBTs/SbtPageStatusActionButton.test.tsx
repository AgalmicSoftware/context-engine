import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageStatusActionButton from './SbtPageStatusActionButton';
import type { SbtPageStatusActionButtonContentState } from './SbtPageStatusActionButton';

const buildContentState = (
  overrides: Partial<SbtPageStatusActionButtonContentState> = {},
): SbtPageStatusActionButtonContentState => ({
  failureLabel: 'Failed',
  idleLabel: 'Join',
  shouldRenderFailure: false,
  shouldRenderIdleLabel: false,
  shouldRenderPendingIcon: false,
  shouldRenderSuccess: false,
  successLabel: 'Done',
  ...overrides,
});

describe('SbtPageStatusActionButton', () => {
  it('renders the idle label and routes clicks through the parent callback', () => {
    const onClick = jest.fn();

    render(
      <SbtPageStatusActionButton
        className="mint-button"
        contentState={buildContentState({ shouldRenderIdleLabel: true })}
        onClick={onClick}
        title="View transaction"
      />,
    );

    const button = screen.getByRole('button', { name: 'Join' });

    expect(button).toHaveClass('mint-button');
    expect(button).toHaveAttribute('title', 'View transaction');

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders pending spinner state and honors disabled without owning action state', () => {
    const { container } = render(
      <SbtPageStatusActionButton
        className="mint-button"
        contentState={buildContentState({ shouldRenderPendingIcon: true })}
        disabled
        onClick={jest.fn()}
      />,
    );

    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('title');
    expect(container.querySelector('svg[data-icon="spinner"]')).not.toBeNull();
  });

  it('renders success label and check icon', () => {
    const { container } = render(
      <SbtPageStatusActionButton
        className="mint-button"
        contentState={buildContentState({ shouldRenderSuccess: true })}
        onClick={jest.fn()}
      />,
    );

    expect(screen.getByRole('button')).toHaveTextContent('Done');
    expect(container.querySelector('svg[data-icon="check"]')).not.toBeNull();
  });

  it('renders failure label and times icon', () => {
    const { container } = render(
      <SbtPageStatusActionButton
        className="mint-button"
        contentState={buildContentState({ shouldRenderFailure: true })}
        onClick={jest.fn()}
      />,
    );

    expect(screen.getByRole('button')).toHaveTextContent('Failed');
    expect(container.querySelector('svg[data-icon="times"]')).not.toBeNull();
  });
});
