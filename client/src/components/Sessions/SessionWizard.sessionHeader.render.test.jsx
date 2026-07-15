import {
  E2E_TESTIDS,
  act,
  fireEvent,
  renderSessionWizard,
  screen,
  waitFor,
  within,
  resetSessionWizardWorkerPanelTestState,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard session header image controls', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps the image URL field hidden in normal mode until URL is clicked', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL_TOGGLE));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toBeInTheDocument();
  });

  it('keeps the image title row outside the stylized image control section in normal mode', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    const imageBar = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR);
    const imageGroup = imageBar.parentElement;

    if (!imageGroup) {
      throw new Error('Expected the compact image bar to stay within its form group.');
    }

    expect(within(imageGroup).getByText('Image')).toBeInTheDocument();
    expect(imageGroup.querySelector('svg[data-icon="question-circle"]')).not.toBeNull();
    expect(within(imageGroup).getByTestId('mock-wizard-gate-lock')).toBeInTheDocument();
    expect(within(imageBar).queryByText('Image')).not.toBeInTheDocument();
    expect(imageBar.querySelector('svg[data-icon="question-circle"]')).toBeNull();
    expect(within(imageBar).queryByTestId('mock-wizard-gate-lock')).not.toBeInTheDocument();
    expect(within(imageBar).getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL_TOGGLE)).toBeInTheDocument();
    expect(within(imageBar).getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE)).toBeInTheDocument();
    expect(within(imageBar).getByRole('button', { name: 'Upload image' })).toBeInTheDocument();
  });

  it('keeps the image area minimal until a clipboard URL is pasted, then expands it on click', async () => {
    const originalClipboard = navigator.clipboard;
    const read = jest.fn().mockResolvedValue([]);
    const readText = jest.fn().mockResolvedValue('https://example.example.test/session-header.png');

    try {
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          draft: {
            sessionHeader: '',
          },
        }),
      );
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read, readText },
      });

      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      expect(screen.queryByRole('img', { name: 'Session header preview' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Expand session header image' })).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE));
      });

      await waitFor(() => {
        expect(read).toHaveBeenCalledTimes(1);
        expect(readText).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue(
        'https://example.example.test/session-header.png',
      );
      expect(screen.queryByText('Pasted image from clipboard.')).not.toBeInTheDocument();
      expect(screen.queryByText('Pasted image URL from clipboard.')).not.toBeInTheDocument();

      const previewImage = await screen.findByRole('img', { name: 'Session header preview' });
      expect(previewImage).toHaveAttribute('src', 'https://example.example.test/session-header.png');
      expect(screen.getByRole('button', { name: 'Remove session header image' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Remove session header image' }));

      await waitFor(() => {
        expect(screen.queryByRole('img', { name: 'Session header preview' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove session header image' })).not.toBeInTheDocument();
        expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).not.toBeInTheDocument();
      });
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('accepts supported relative asset paths from the clipboard for session headers', async () => {
    const originalClipboard = navigator.clipboard;
    const read = jest.fn().mockResolvedValue([]);
    const readText = jest.fn().mockResolvedValue('assets/img/header.webp');

    try {
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          draft: {
            sessionHeader: '',
          },
        }),
      );
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read, readText },
      });

      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE));
      });

      await waitFor(() => {
        expect(read).toHaveBeenCalledTimes(1);
        expect(readText).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).toHaveValue('assets/img/header.webp');
      expect(screen.queryByText('Clipboard does not contain a supported image or URL.')).not.toBeInTheDocument();

      const previewImage = await screen.findByRole('img', { name: 'Session header preview' });
      expect(previewImage).toHaveAttribute('src', 'assets/img/header.webp');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('pastes an image blob from the clipboard into the normal-mode image preview area', async () => {
    const originalClipboard = navigator.clipboard;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const clipboardBlob = new Blob(['clipboard-image'], { type: 'image/png' });
    const read = jest.fn().mockResolvedValue([
      {
        types: ['image/png'],
        getType: jest.fn().mockResolvedValue(clipboardBlob),
      },
    ]);
    const readText = jest.fn().mockResolvedValue('');
    URL.createObjectURL = jest.fn(() => 'blob:clipboard-session-header-preview');
    URL.revokeObjectURL = jest.fn();

    try {
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          draft: {
            sessionHeader: '',
          },
        }),
      );
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read, readText },
      });

      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE));
      });

      await waitFor(() => {
        expect(read).toHaveBeenCalledTimes(1);
        expect(readText).not.toHaveBeenCalled();
      });
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_URL)).not.toBeInTheDocument();
      expect(screen.queryByText('Pasted image from clipboard.')).not.toBeInTheDocument();

      const previewImage = await screen.findByRole('img', { name: 'Session header preview' });
      expect(previewImage).toHaveAttribute('src', 'blob:clipboard-session-header-preview');

      fireEvent.click(screen.getByRole('button', { name: 'Expand session header image' }));
      expect(await screen.findByRole('img', { name: 'Expanded session header preview' })).toHaveAttribute(
        'src',
        'blob:clipboard-session-header-preview',
      );
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('renders uploaded files inside the normal-mode image preview area', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:session-header-preview');
    URL.revokeObjectURL = jest.fn();

    try {
      renderSessionWizard();

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      const imageBar = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR);
      fireEvent.click(within(imageBar).getByRole('button', { name: 'Upload image' }));

      const fileInput = imageBar.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();

      const file = new File(['header-image'], 'header.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('img', { name: 'Session header preview' })).toHaveAttribute(
          'src',
          'blob:session-header-preview',
        );
      });
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
