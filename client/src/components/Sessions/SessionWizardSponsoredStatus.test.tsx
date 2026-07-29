import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionWizardSponsoredStatus, { getSponsoredBundleStatusToneClassName } from './SessionWizardSponsoredStatus';

describe('SessionWizardSponsoredStatus', () => {
  it('renders nothing without a status', () => {
    const { container } = render(<SessionWizardSponsoredStatus onRetry={jest.fn()} status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders status text, tone class, and retry callback', () => {
    const onRetry = jest.fn();

    render(
      <SessionWizardSponsoredStatus
        onRetry={onRetry}
        status={{
          message: 'Malformed sponsored link.',
          retryable: true,
          tone: 'error',
        }}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent('Malformed sponsored link.');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveClass('sponsoredBundleStatusError');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('accepts a decryption key through an explicit password input', () => {
    const onDecryptionKeyChange = jest.fn();
    const onSubmitDecryptionKey = jest.fn();

    render(
      <SessionWizardSponsoredStatus
        decryptionKey="memory-only-key"
        onDecryptionKeyChange={onDecryptionKeyChange}
        onRetry={jest.fn()}
        onSubmitDecryptionKey={onSubmitDecryptionKey}
        status={{
          message: 'Enter the sponsored bundle decryption key to continue.',
          requiresKey: true,
          tone: 'info',
        }}
      />,
    );

    const input = screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_KEY_INPUT);
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');
    fireEvent.change(input, { target: { value: 'next-memory-only-key' } });
    expect(onDecryptionKeyChange).toHaveBeenCalledWith('next-memory-only-key');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_KEY_APPLY));
    expect(onSubmitDecryptionKey).toHaveBeenCalledTimes(1);
  });

  it('maps status tones to the existing classes', () => {
    expect(getSponsoredBundleStatusToneClassName('success')).toBe('sponsoredBundleStatusSuccess');
    expect(getSponsoredBundleStatusToneClassName('error')).toBe('sponsoredBundleStatusError');
    expect(getSponsoredBundleStatusToneClassName('info')).toBe('sponsoredBundleStatusInfo');
  });
});
