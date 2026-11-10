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
      onClear={() => {}}
      {...props}
    />,
  );

describe('SessionHeaderField', () => {
  it('preserves compact header test IDs and mode callbacks', () => {
    const onToggleCompactUrlMode = jest.fn();
    const onPaste = jest.fn();
    const onCompactUploadClick = jest.fn();
    renderSessionHeaderField({
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
      compactSessionHeaderMode: 'url',
      value: null,
      sessionHeaderPreviewSrc: '',
    });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue('');
    expect(screen.queryByRole('img', { name: 'Session header preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove session header image' })).not.toBeInTheDocument();
  });

  it('calls onClear when the preview clear button is clicked', () => {
    const onClear = jest.fn();
    renderSessionHeaderField({ onClear });

    fireEvent.click(screen.getByRole('button', { name: 'Remove session header image' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders URL-only controls when file upload is unavailable', () => {
    const compact = renderSessionHeaderField({
      allowFileUpload: false,
      compactSessionHeaderMode: 'url',
      sessionHeaderMode: 'upload',
    });

    expect(screen.getByRole('button', { name: 'URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).not.toBeInTheDocument();
    expect(compact.container.querySelector('input[type="file"]')).toBeNull();
  });

  it('offers only header image types that publishing can upload', () => {
    const accepted = 'image/png,image/jpeg,image/jpg,image/gif';
    const { container } = renderSessionHeaderField({ sessionHeaderMode: 'upload' });
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', accepted);
  });
});
