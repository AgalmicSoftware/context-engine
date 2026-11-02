import fs from 'fs';
import path from 'path';
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

  it('keeps the confirm fills under the global .btn hover and press reset', () => {
    // contextEngine.scss clears every `.btn` fill on hover and press with `!important` (up to
    // `.btn:active:hover`); a label drawn for its fill must keep it, so these rules need !important and more
    // than three classes or pseudo-classes.
    const scss = fs.readFileSync(path.join(__dirname, 'CEConfirmDialog.module.scss'), 'utf8');
    expect(scss).toMatch(
      /\.footer \.confirmButton:is\(:hover, :active\):not\(:disabled\) \{\s*background-color: var\(--ce-action-accent-hover\) !important;/,
    );
    expect(scss).toMatch(
      /\.footer \.dangerButton:is\(:hover, :active\):not\(:disabled\) \{\s*background-color: var\(--ce-status-error\) !important;/,
    );
  });

  it("rings the title-bar close button in the bar's text colour", () => {
    // The theme's focus ring can match a title bar (black on Classic 95's navy).
    const scss = fs.readFileSync(path.join(__dirname, 'CEConfirmDialog.module.scss'), 'utf8');
    expect(scss).toMatch(
      /\.content \.header :global\(\.btn-close\) \{[^}]*&:hover \{[^}]*\}\s*[^}]*&:focus-visible \{\s*outline-color: currentColor;/,
    );
  });

  it('stays out of the DOM while closed', () => {
    render(<CEConfirmDialog isOpen={false} title="Hidden" body="Closed dialog body" />);

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed dialog body')).not.toBeInTheDocument();
  });
});
