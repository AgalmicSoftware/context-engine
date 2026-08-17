import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DecryptActionChip, { resolveDecryptActionChipSpinnerStyle } from './DecryptActionChip';

describe('DecryptActionChip', () => {
  it('renders a button chip and forwards clicks', () => {
    const onClick = jest.fn();
    render(<DecryptActionChip onClick={onClick} actionLabel="Decrypt Answer" />);

    const button = screen.getByRole('button', { name: 'Decrypt Answer' });
    expect(button).toHaveClass('decryptQuestionButton');

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the spinner-only variant only while busy', () => {
    const { rerender } = render(<DecryptActionChip spinnerOnly busy actionLabel="Decrypt Answer" />);

    expect(screen.getByText('Decrypting...')).toBeInTheDocument();

    rerender(<DecryptActionChip spinnerOnly busy={false} actionLabel="Decrypt Answer" />);

    expect(screen.queryByText('Decrypting...')).not.toBeInTheDocument();
  });

  it('resolves spinner spacing style', () => {
    expect(resolveDecryptActionChipSpinnerStyle()).toEqual({ marginRight: 8 });
  });
});
