import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CEConfirmDialog from './CEConfirmDialog';

describe('CEConfirmDialog', () => {
  it('renders app-native confirmation copy with stable test ids', () => {
    render(
      <CEConfirmDialog
        isOpen
        title="Clear draft?"
        body="This removes unsaved survey changes."
        confirmLabel="Clear"
        cancelLabel="Keep editing"
        testId="ce-survey-clear-confirm"
      />,
    );

    expect(screen.getByTestId('ce-survey-clear-confirm-title')).toHaveTextContent('Clear draft?');
    expect(screen.getByTestId('ce-survey-clear-confirm-body')).toHaveTextContent(
      'This removes unsaved survey changes.',
    );
    expect(screen.getByTestId('ce-survey-clear-confirm-cancel')).toHaveTextContent('Keep editing');
    expect(screen.getByTestId('ce-survey-clear-confirm-confirm')).toHaveTextContent('Clear');
  });

  it('calls cancel and confirm callbacks from the modal controls', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    render(
      <CEConfirmDialog
        isOpen
        title="Clear draft?"
        body="This removes unsaved survey changes."
        confirmLabel="Clear"
        cancelLabel="Keep editing"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId('ce-confirm-dialog-cancel'));
    fireEvent.click(screen.getByTestId('ce-confirm-dialog-confirm'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('stays out of the DOM while closed', () => {
    render(<CEConfirmDialog isOpen={false} title="Hidden" body="Closed dialog body" />);

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed dialog body')).not.toBeInTheDocument();
  });
});
