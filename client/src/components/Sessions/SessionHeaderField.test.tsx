import React from 'react';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionHeaderField from './SessionHeaderField';
import type { SessionHeaderFieldProps } from './SessionHeaderField';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const renderSessionHeaderField = (props: Partial<SessionHeaderFieldProps> = {}) =>
  render(
    <SessionHeaderField
      value="https://example.test/header.png"
      sessionHeaderMode="url"
      compactSessionHeaderMode="idle"
      sessionHeaderPreviewSrc="https://example.test/header.png"
      sessionHeaderUploadStatus=""
      sessionHeaderUploadStatusTone="default"
      compactSessionHeaderInputRef={createRef()}
      onUrlChange={() => {}}
      onCompactUrlChange={() => {}}
      onToggleCompactUrlMode={() => {}}
      onPaste={() => {}}
      onCompactUploadClick={() => {}}
      onCompactFileChange={() => {}}
      onUseUrlMode={() => {}}
      onUseUploadMode={() => {}}
      onAdvancedFileChange={() => {}}
      onClear={() => {}}
      onExpandPreview={() => {}}
      {...props}
    />,
  );

describe('SessionHeaderField', () => {
  it('renders the advanced URL mode controls and preview surface', () => {
    renderSessionHeaderField();

    expect(screen.getByLabelText('Use URL')).toBeChecked();
    expect(screen.getByLabelText('Upload file')).not.toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue('https://example.test/header.png');
    expect(screen.getByRole('img', { name: 'Session header preview' })).toHaveAttribute(
      'src',
      'https://example.test/header.png',
    );
  });

  it('forwards advanced mode callbacks with their original event objects', () => {
    const onUrlChange = jest.fn();
    const onUseUploadMode = jest.fn();
    const onExpandPreview = jest.fn();
    renderSessionHeaderField({ onUrlChange, onUseUploadMode, onExpandPreview });

    const urlInput = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL);
    fireEvent.change(urlInput, {
      target: { value: 'https://example.test/next.png' },
    });
    fireEvent.click(screen.getByLabelText('Upload file'));
    fireEvent.click(screen.getByRole('button', { name: 'Expand session header image' }));

    expect(onUrlChange).toHaveBeenCalledTimes(1);
    expect(onUrlChange.mock.calls[0][0].target).toBe(urlInput);
    expect(onUseUploadMode).toHaveBeenCalledTimes(1);
    expect(onExpandPreview).toHaveBeenCalledTimes(1);
  });

  it('preserves compact header test IDs and mode callbacks', () => {
    const onToggleCompactUrlMode = jest.fn();
    const onPaste = jest.fn();
    const onCompactUploadClick = jest.fn();
    renderSessionHeaderField({
      compact: true,
      compactSessionHeaderMode: 'url',
      onToggleCompactUrlMode,
      onPaste,
      onCompactUploadClick,
    });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL_TOGGLE));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE));
    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue('https://example.test/header.png');
    expect(onToggleCompactUrlMode).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onCompactUploadClick).toHaveBeenCalledTimes(1);
  });

  it('renders an empty URL field without preview controls when value and preview are empty', () => {
    renderSessionHeaderField({
      value: null,
      sessionHeaderPreviewSrc: '',
    });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue('');
    expect(screen.queryByRole('img', { name: 'Session header preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove session header image' })).not.toBeInTheDocument();
  });

  it('calls onClear when the advanced preview clear button is clicked', () => {
    const onClear = jest.fn();
    renderSessionHeaderField({ onClear });

    fireEvent.click(screen.getByRole('button', { name: 'Remove session header image' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders URL-only controls when file upload is unavailable', () => {
    const advanced = renderSessionHeaderField({
      allowFileUpload: false,
      sessionHeaderMode: 'upload',
    });

    expect(screen.queryByLabelText('Upload file')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue(
      'https://example.test/header.png',
    );
    expect(advanced.container.querySelector('input[type="file"]')).toBeNull();
    advanced.unmount();

    const compact = renderSessionHeaderField({
      allowFileUpload: false,
      compact: true,
      compactSessionHeaderMode: 'url',
      sessionHeaderMode: 'upload',
    });

    expect(screen.getByRole('button', { name: 'URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).not.toBeInTheDocument();
    expect(compact.container.querySelector('input[type="file"]')).toBeNull();
  });
});
