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

  it('keeps each confirm label on its fill under the global .btn hover, focus and press rules', () => {
    // contextEngine.scss repaints `.btn` on hover, focus and press with `!important` (up to
    // `.btn:active:hover`, three classes or pseudo-classes) and whitens `.btn-primary`'s label when pressed;
    // these rules need !important and four.
    const scss = fs.readFileSync(path.join(__dirname, 'CEConfirmDialog.module.scss'), 'utf8');
    for (const [button, fill, label] of [
      ['confirmButton', 'action-accent-hover', 'action-accent-text'],
      ['dangerButton', 'status-error', 'status-error-contrast'],
    ]) {
      expect(scss).toContain(
        `.footer .${button}:is(:hover, :focus, :active):not(:disabled) {\n` +
          `  border-color: var(--ce-${fill}) !important;\n` +
          `  background: var(--ce-${fill}) !important;\n` +
          `  color: var(--ce-${label}) !important;\n}`,
      );
    }
  });

  it('keeps the cancel label in the control text colour when pressed', () => {
    // Pressing `.btn-outline-secondary` paints a dark label while the global rule clears the fill.
    const scss = fs.readFileSync(path.join(__dirname, 'CEConfirmDialog.module.scss'), 'utf8');
    expect(scss).toContain(
      '.footer .cancelButton:is(:hover, :focus, :active):not(:disabled) {\n  color: var(--ce-control-text) !important;\n}',
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
