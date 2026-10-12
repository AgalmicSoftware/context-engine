import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import CompactImageChooser from './CompactImageChooser';

describe('CompactImageChooser', () => {
  it('renders URL controls, status, help, preview, and clear action', () => {
    const onUrlChange = jest.fn();
    const onToggleUrlMode = jest.fn();
    const onPaste = jest.fn();
    const onUploadClick = jest.fn();
    const onClear = jest.fn();

    render(
      <CompactImageChooser
        isUrlMode
        showUrlInput
        urlValue="https://example.test/image.png"
        onUrlChange={onUrlChange}
        onToggleUrlMode={onToggleUrlMode}
        onPaste={onPaste}
        onUploadClick={onUploadClick}
        onClear={onClear}
        previewSrc="https://example.test/preview.png"
        statusText="Upload ready"
        helpText="Images can be encrypted."
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'URL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Image URL' }), {
      target: { value: 'https://example.test/next.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));

    expect(onToggleUrlMode).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onUploadClick).toHaveBeenCalledTimes(1);
    expect(onUrlChange).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Upload ready')).toBeInTheDocument();
    expect(screen.getByText('Images can be encrypted.')).toBeInTheDocument();
    expect(screen.getByAltText('Image preview')).toHaveAttribute('src', 'https://example.test/preview.png');
  });

  it('previews a chosen file as a blob only when it is a raster image', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = jest.fn(() => 'blob:image-preview');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    try {
      // A fetched image URL can return SVG; its blob preview would run as the app if opened in a tab.
      const svg = render(
        <CompactImageChooser previewFile={new Blob(['<svg onload="alert(1)"/>'], { type: 'image/svg+xml' })} />,
      );
      expect(screen.queryByAltText('Image preview')).toBeNull();
      expect(createObjectURL).not.toHaveBeenCalled();
      svg.unmount();

      render(<CompactImageChooser previewFile={new Blob(['png'], { type: 'image/png' })} />);
      expect(screen.getByAltText('Image preview')).toHaveAttribute('src', 'blob:image-preview');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    }
  });

  it('keeps URL and paste controls while hiding file controls', () => {
    const { container } = render(
      <CompactImageChooser showUploadControl={false} showUrlInput onToggleUrlMode={() => {}} onPaste={() => {}} />,
    );

    expect(screen.getByRole('button', { name: 'URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
