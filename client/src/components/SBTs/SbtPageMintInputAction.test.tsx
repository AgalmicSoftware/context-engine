import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageMintInputAction from './SbtPageMintInputAction';

describe('SbtPageMintInputAction', () => {
  it('renders the input/button shell and routes interactions through parent callbacks', () => {
    const onAction = jest.fn();
    const onInputChange = jest.fn();

    render(
      <SbtPageMintInputAction
        buttonClassName="mint-button"
        contentState={{ label: 'Join', shouldRenderLabel: true, shouldRenderPendingIcon: false }}
        inputType="password"
        inputValue="secret"
        onAction={onAction}
        onInputChange={onInputChange}
        placeholder="Group Password"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Group Password'), { target: { value: 'next-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(screen.getByPlaceholderText('Group Password')).toHaveValue('secret');
    expect(onInputChange).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('honors disabled pending state without owning mint execution', () => {
    render(
      <SbtPageMintInputAction
        buttonClassName="mint-button"
        contentState={{ label: 'Start Claim', shouldRenderLabel: true, shouldRenderPendingIcon: true }}
        disabled
        inputType="text"
        inputValue=""
        onAction={jest.fn()}
        onInputChange={jest.fn()}
        placeholder="Claim Code"
      />,
    );

    expect(screen.getByPlaceholderText('Claim Code')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Start Claim' })).toBeDisabled();
  });
});
