import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import QuestionDecryptControl from './QuestionDecryptControl';

describe('QuestionDecryptControl', () => {
  it('renders the manual decrypt action when auto-decrypt is off', () => {
    const onClick = jest.fn();
    render(
      <QuestionDecryptControl
        actionLabel="Decrypt Answer"
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decrypt Answer' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the spinner-only state when auto-decrypt owns the field', () => {
    render(
      <QuestionDecryptControl
        autoDecryptEnabled
        showBusySpinnerWhenAutoDecryptEnabled
        busy
        actionLabel="Decrypt Comments"
      />
    );

    expect(screen.getByText('Decrypting...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decrypt Comments' })).not.toBeInTheDocument();
  });

  it('renders nothing for auto-decrypt-only full-mode fields when no spinner should be shown', () => {
    const { container } = render(
      <QuestionDecryptControl
        autoDecryptEnabled
        actionLabel="Decrypt Answer"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
