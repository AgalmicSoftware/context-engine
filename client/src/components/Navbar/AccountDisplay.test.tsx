import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AccountDisplayTorus } from './AccountDisplay';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

describe('AccountDisplayTorus', () => {
  it('renders the shortened wallet address and opens account settings', () => {
    const launchAccountSettings = jest.fn();

    render(
      <AccountDisplayTorus
        account="0x1111111111111111111111111111111111111111"
        launchAccountSettings={launchAccountSettings}
        avatarUrl="data:image/png;base64,blockie"
      />,
    );

    const button = screen.getByTestId(E2E_TESTIDS.WALLET_DISPLAY);
    expect(button).toHaveTextContent('0x11...1111');
    expect(button).toHaveAttribute('data-ce-wallet-address', '0x1111111111111111111111111111111111111111');

    fireEvent.click(button);

    expect(launchAccountSettings).toHaveBeenCalledTimes(1);
  });

  it('prefers the user profile image while keeping the blockie fallback visible', () => {
    const { container } = render(
      <AccountDisplayTorus
        account="0x2222222222222222222222222222222222222222"
        launchAccountSettings={() => {}}
        userImageURL="https://example.invalid/avatar.png"
        avatarUrl="data:image/png;base64,blockie"
      />,
    );

    const images = Array.from(container.querySelectorAll('img'));

    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', 'https://example.invalid/avatar.png');
    expect(images[1]).toHaveAttribute('src', 'data:image/png;base64,blockie');
  });
});
