import { act, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import CreateSBTGroup from './CreateSBTGroup';
import styles from './CreateSBTGroup.module.scss';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockFetchImageFromURL = jest.fn();

jest.mock('../../utilities/ui/imageScripts.js', () => {
  const actual = jest.requireActual('../../utilities/ui/imageScripts.js');
  return {
    __esModule: true,
    ...actual,
    fetchImageFromURL: (...args) => mockFetchImageFromURL(...args),
  };
});

const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

describe('CreateSBTGroup render and image authoring', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetchImageFromURL.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
    delete window.__litHooks;
    delete window.litHooks;
  });

  it('uses a solid background surface in deferred deploy modal mode', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    render(instance.render());

    const panel = document.querySelector(`.${styles.createGroupExpanded}`);
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveStyle('--ce-create-group-surface-bg: #11182c');
    expect(screen.getByRole('heading', { name: 'Add to Session' })).toBeInTheDocument();
  });

  it('keeps the create title and learn-more tooltip in the same header cluster', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    render(instance.render());

    const heading = screen.getByRole('heading', { name: 'Create' });
    const titleCluster = heading.parentElement;
    const titleTooltip = titleCluster?.querySelector('#learnMoreTooltip');

    expect(titleCluster).toHaveClass(styles.titleCluster);
    expect(titleTooltip).toBeInTheDocument();
    expect(titleTooltip).toHaveClass(styles.createGroupTitleTooltip);
  });

  it('auto-expands all sections in deferred deploy modal mode', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    render(instance.render());

    const tokenInfoHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="tokenInfoCollapsed"]`,
    );
    const mintOptionsHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="mintOptionsCollapsed"]`,
    );
    const distributionHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="distributionOptionsCollapsed"]`,
    );

    expect(tokenInfoHeader).toHaveAttribute('aria-expanded', 'true');
    expect(mintOptionsHeader).toHaveAttribute('aria-expanded', 'true');
    expect(distributionHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTABLE_TOGGLE)).toBeInTheDocument();
    expect(screen.getByText('One-use URLs')).toBeInTheDocument();
  });

  it('opens the first section by default and hides open section titles', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    render(instance.render());

    const tokenInfoHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="tokenInfoCollapsed"]`,
    );
    const mintOptionsHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="mintOptionsCollapsed"]`,
    );

    expect(tokenInfoHeader).toHaveAttribute('aria-expanded', 'true');
    expect(within(tokenInfoHeader).queryByText('Info')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_INPUT)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(mintOptionsHeader).toHaveAttribute('aria-expanded', 'false');
    expect(within(mintOptionsHeader).getByText('Create Options')).toBeInTheDocument();
  });

  it('groups the compact token info controls into shared desktop rows', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    const { container } = render(instance.render());

    const topGrid = container.querySelector(`.${styles.tokenInfoTopGrid}`);
    const metaGrid = container.querySelector(`.${styles.tokenInfoMetaGrid}`);

    expect(topGrid).toBeInTheDocument();
    expect(metaGrid).toBeInTheDocument();
    expect(topGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW));
    expect(topGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW));
    expect(topGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW));
    expect(metaGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DOCS_LOCK_ROW));
    expect(metaGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_TAGS_LOCK_ROW));
  });

  it('removes redundant docs and tags headings while keeping a compact image chooser surface', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    render(instance.render());

    const imageRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW);
    const docsRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DOCS_LOCK_ROW);
    const tagsRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_TAGS_LOCK_ROW);

    expect(screen.queryByText(/^Document URLs$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Tags$/)).not.toBeInTheDocument();
    expect(within(imageRow).getByRole('button', { name: /^URL$/i })).toBeInTheDocument();
    expect(within(imageRow).getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_PASTE)).toBeInTheDocument();
    expect(within(imageRow).getByRole('button', { name: /Upload image/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Document URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Add tag')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'SBT artwork preview' })).not.toBeInTheDocument();
    expect(docsRow.querySelector(`.${styles.inlineFieldLockControl}`)).toBeInTheDocument();
    expect(tagsRow.querySelector(`.${styles.tagsInlineRow}`)).toBeInTheDocument();
  });

  it('pastes an image blob into upload mode and shows the compact preview with the file name', async () => {
    const originalClipboard = navigator.clipboard;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const clipboardBlob = new Blob(['clipboard-image'], { type: 'image/png' });
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;
    URL.createObjectURL = jest.fn(() => 'blob:sbt-clipboard-preview');
    URL.revokeObjectURL = jest.fn();

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: jest.fn().mockResolvedValue([
            {
              types: ['image/png'],
              getType: jest.fn().mockResolvedValue(clipboardBlob),
            },
          ]),
          readText: jest.fn().mockResolvedValue(''),
        },
      });

      const view = render(instance.render());

      await act(async () => {
        await instance.handlePasteImage();
      });

      view.rerender(instance.render());

      expect(instance.state.useImageUrl).toBe(false);
      expect(instance.state.sbtImageFile?.name).toBe('clipboard-sbt-image.png');
      expect(screen.getByText('clipboard-sbt-image.png')).toBeInTheDocument();
      expect(screen.queryByText('Image too large (>10MB)')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('img', { name: 'SBT artwork preview' })).toHaveAttribute(
          'src',
          'blob:sbt-clipboard-preview',
        );
      });
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('pastes an image URL through the existing CreateSBT image-url flow', async () => {
    const originalClipboard = navigator.clipboard;
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;
    const fetchedFile = new File(['remote-image'], 'remote.png', { type: 'image/png' });
    mockFetchImageFromURL.mockResolvedValue(fetchedFile);

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: jest.fn().mockResolvedValue([]),
          readText: jest.fn().mockResolvedValue('https://example.com/sbt-image.png'),
        },
      });

      const view = render(instance.render());

      await act(async () => {
        await instance.handlePasteImage();
      });

      await waitFor(() => {
        expect(mockFetchImageFromURL).toHaveBeenCalledWith('https://example.com/sbt-image.png');
        expect(instance.state.sbtImageFile).toBe(fetchedFile);
      });

      view.rerender(instance.render());

      expect(instance.state.useImageUrl).toBe(true);
      expect(instance.state.sbtImageUrl).toBe('https://example.com/sbt-image.png');
      expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_URL_INPUT)).toHaveValue(
        'https://example.com/sbt-image.png',
      );
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('re-fetches pasted Arweave refs when the image URL field is edited later', async () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    const arweaveRef = `ar://${'a'.repeat(43)}`;
    const normalizedArweaveUrl = normalizeArweaveUrl(arweaveRef);
    const fetchedFile = new File(['remote-image'], 'remote.png', { type: 'image/png' });
    mockFetchImageFromURL.mockResolvedValue(fetchedFile);
    instance.state.tokenInfoCollapsed = false;
    instance.state.useImageUrl = true;

    const view = render(instance.render());

    await act(async () => {
      instance.handleInputChange({
        target: {
          name: 'sbtImageUrl',
          type: 'text',
          value: arweaveRef,
        },
      });
    });

    await waitFor(() => {
      expect(mockFetchImageFromURL).toHaveBeenCalledWith(normalizedArweaveUrl);
      expect(instance.state.sbtImageFile).toBe(fetchedFile);
    });

    view.rerender(instance.render());

    expect(instance.state.sbtImageUrl).toBe(arweaveRef);
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_URL_INPUT)).toHaveValue(arweaveRef);
  });

  it('re-fetches missing preview bytes from Arweave refs before minting', async () => {
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
      toggleLoginModal: jest.fn(),
    });
    const arweaveRef = `ar://${'b'.repeat(43)}`;
    const normalizedArweaveUrl = normalizeArweaveUrl(arweaveRef);
    const fetchedFile = new File(['remote-image'], 'remote.png', { type: 'image/png' });
    mockFetchImageFromURL.mockResolvedValue(fetchedFile);
    instance.commitPendingDocumentUrl = jest.fn(async () => false);
    instance.uploadImageToArweave = jest.fn(async () => null);
    instance.uploadTokenUriToArweave = jest.fn(async () => null);
    instance.mintSBT = jest.fn(async () => null);
    instance.state.sbtName = 'Arweave Group';
    instance.state.useImageUrl = true;
    instance.state.sbtImageUrl = arweaveRef;
    instance.state.sbtImageFile = null;

    await act(async () => {
      await instance.handleMintClick();
    });

    expect(mockFetchImageFromURL).toHaveBeenCalledWith(normalizedArweaveUrl);
    expect(instance.state.sbtImageFile).toBe(fetchedFile);
    expect(instance.uploadImageToArweave).toHaveBeenCalledTimes(1);
    expect(instance.uploadTokenUriToArweave).toHaveBeenCalledTimes(1);
    expect(instance.mintSBT).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing uploaded image when a pasted clipboard image blob is too large', async () => {
    const originalClipboard = navigator.clipboard;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const existingFile = new File(['existing-image'], 'existing.png', { type: 'image/png' });
    const oversizedBlob = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' });
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;
    instance.state.sbtImageFile = existingFile;
    instance.state.useImageUrl = false;
    instance.state.sbtMinted = true;
    instance.state.sbtAddress = '0x9999999999999999999999999999999999999999';
    instance.state.currentStep = 4;
    instance.state.shareableUrl = 'https://contextengine.xyz/sbt/0x9999';
    instance.state.autoJoinUrl = 'https://contextengine.xyz/session/test?sbt=0x9999&auto=1';
    instance.state.imageUploaded = true;
    instance.state.tokenUriUploaded = true;
    URL.createObjectURL = jest.fn(() => 'blob:existing-sbt-preview');
    URL.revokeObjectURL = jest.fn();

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: jest.fn().mockResolvedValue([
            {
              types: ['image/png'],
              getType: jest.fn().mockResolvedValue(oversizedBlob),
            },
          ]),
          readText: jest.fn().mockResolvedValue(''),
        },
      });

      const view = render(instance.render());

      await act(async () => {
        await instance.handlePasteImage();
      });

      view.rerender(instance.render());

      expect(instance.state.useImageUrl).toBe(false);
      expect(instance.state.sbtImageFile).toBe(existingFile);
      expect(screen.getByText('existing.png')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'SBT artwork preview' })).toHaveAttribute(
        'src',
        'blob:existing-sbt-preview',
      );
      expect(screen.getByText('Image too large (>10MB)')).toBeInTheDocument();
      expect(instance.state.sbtMinted).toBe(true);
      expect(instance.state.sbtAddress).toBe('0x9999999999999999999999999999999999999999');
      expect(instance.state.currentStep).toBe(4);
      expect(instance.state.shareableUrl).toBe('https://contextengine.xyz/sbt/0x9999');
      expect(instance.state.autoJoinUrl).toBe('https://contextengine.xyz/session/test?sbt=0x9999&auto=1');
      expect(instance.state.imageUploaded).toBe(true);
      expect(instance.state.tokenUriUploaded).toBe(true);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('keeps the existing uploaded image when a pasted image URL fails validation', async () => {
    const originalClipboard = navigator.clipboard;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const existingFile = new File(['existing-image'], 'existing.png', { type: 'image/png' });
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;
    instance.state.sbtImageFile = existingFile;
    instance.state.useImageUrl = false;
    URL.createObjectURL = jest.fn(() => 'blob:existing-sbt-preview');
    URL.revokeObjectURL = jest.fn();
    mockFetchImageFromURL.mockRejectedValue(new Error('Invalid image type'));

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: jest.fn().mockResolvedValue([]),
          readText: jest.fn().mockResolvedValue('https://example.com/not-an-image'),
        },
      });

      const view = render(instance.render());

      await act(async () => {
        await instance.handlePasteImage();
      });

      view.rerender(instance.render());

      expect(mockFetchImageFromURL).toHaveBeenCalledWith('https://example.com/not-an-image');
      expect(instance.state.useImageUrl).toBe(false);
      expect(instance.state.sbtImageFile).toBe(existingFile);
      expect(screen.queryByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_URL_INPUT)).not.toBeInTheDocument();
      expect(screen.getByText('existing.png')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'SBT artwork preview' })).toHaveAttribute(
        'src',
        'blob:existing-sbt-preview',
      );
      expect(screen.getByText('Invalid image type')).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[sbt]',
        'Failed to fetch pasted image via worker:',
        expect.any(Error),
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

  it('shows inline clipboard errors for unavailable and unsupported image paste states', async () => {
    const originalClipboard = navigator.clipboard;
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;
    const view = render(instance.render());

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: undefined,
      });

      await act(async () => {
        await instance.handlePasteImage();
      });

      view.rerender(instance.render());

      expect(screen.getByText('Clipboard does not contain a supported image or URL.')).toBeInTheDocument();

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: jest.fn().mockResolvedValue([]),
          readText: jest.fn().mockResolvedValue(''),
        },
      });

      await act(async () => {
        await instance.handlePasteImage();
      });

      view.rerender(instance.render());

      expect(screen.getByText('Clipboard does not contain a supported image or URL.')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('keeps the existing uploaded image when pasted clipboard text is not a supported URL', async () => {
    const originalClipboard = navigator.clipboard;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const existingFile = new File(['existing-image'], 'existing.png', { type: 'image/png' });
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;
    instance.state.sbtImageFile = existingFile;
    instance.state.useImageUrl = false;
    URL.createObjectURL = jest.fn(() => 'blob:existing-sbt-preview');
    URL.revokeObjectURL = jest.fn();

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          read: jest.fn().mockResolvedValue([]),
          readText: jest.fn().mockResolvedValue('copied wallet address'),
        },
      });

      const view = render(instance.render());

      await act(async () => {
        await instance.handlePasteImage();
      });

      view.rerender(instance.render());

      expect(instance.state.useImageUrl).toBe(false);
      expect(instance.state.sbtImageFile).toBe(existingFile);
      expect(screen.getByText('existing.png')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'SBT artwork preview' })).toHaveAttribute(
        'src',
        'blob:existing-sbt-preview',
      );
      expect(screen.getByText('Clipboard does not contain a supported image or URL.')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('keeps docs and tags rows visually flat without extra nested card backgrounds', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(
      /\.tokenInfoMetaCard\s*{[\s\S]*?padding:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;/,
    );
    expect(scss).toMatch(
      /\.tagsContainer\s*{[\s\S]*?padding:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;/,
    );
  });

  it('adds a narrow-panel stack while keeping lock controls inline on narrow and mobile views', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(
      /\.createGroupExpanded\s*{[\s\S]*?container-type:\s*inline-size;[\s\S]*?container-name:\s*create-sbt-panel;/,
    );
    expect(scss).toMatch(
      /@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?\.tokenInfoTopGrid,[\s\S]*?grid-template-columns:\s*1fr;/,
    );
    expect(scss).toMatch(
      /@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?\.fieldLockRow\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?align-items:\s*flex-start;/,
    );
    expect(scss).toMatch(
      /@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?\.imageUploadHeader\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?align-items:\s*center;/,
    );
    expect(scss).toMatch(
      /@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?\.tagsInlineRow\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?align-items:\s*center;/,
    );
    expect(scss).toMatch(
      /@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?\.addDocUrlSection\s*{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?>\s*\.inlineFieldLockControl\s*{[\s\S]*?order:\s*2;/,
    );
    expect(scss).not.toMatch(
      /@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?\.fieldLockRow,\s*\.imageUploadHeader,\s*\.tagsInlineRow,\s*\.addDocUrlSection\s*{[\s\S]*?flex-direction:\s*column;/,
    );
    expect(scss).toMatch(
      /@media\s*\(max-width:\s*600px\)\s*{[\s\S]*?\.addDocUrlSection\s*{[\s\S]*?>\s*\.inlineFieldLockControl\s*{[\s\S]*?order:\s*2;/,
    );
    expect(scss).toMatch(
      /@media\s*\(max-width:\s*600px\)\s*{[\s\S]*?\.addDocUrlSection\s*{[\s\S]*?>\s*\.addDocUrlActionButton\s*{[\s\S]*?order:\s*3;[\s\S]*?width:\s*100%;/,
    );
    expect(scss).toMatch(
      /@container\s+create-sbt-panel\s*\(max-width:\s*820px\)\s*{\s*@include\s+tokenInfoNarrowLayout;/,
    );
  });

  it('keeps the create header tooltip large and pinned beside the title', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(
      /\.headerContainer\s*{[\s\S]*?\.titleCluster\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*14px;/,
    );
    expect(scss).toMatch(/\.createGroupTitle\s*{[\s\S]*?margin:\s*0;/);
    expect(scss).toMatch(
      /\.createGroupTitleTooltip\s*{[\s\S]*?width:\s*1\.12em;[\s\S]*?height:\s*1\.12em;[\s\S]*?font-size:\s*clamp\(1\.9rem,\s*4\.7vw,\s*2\.45rem\);/,
    );
    expect(scss).toMatch(
      /@media\s*\(max-width:\s*900px\)\s*{[\s\S]*?\.titleCluster\s*{[\s\S]*?align-self:\s*flex-start;/,
    );
    expect(scss).toMatch(
      /@media\s*\(max-width:\s*600px\)\s*{[\s\S]*?\.createGroupTitle\s*{[\s\S]*?padding-right:\s*0;/,
    );
    expect(scss).toMatch(
      /@media\s*\(max-width:\s*600px\)\s*{[\s\S]*?\.createGroupTitleTooltip\s*{[\s\S]*?font-size:\s*clamp\(1\.9rem,\s*9vw,\s*2\.35rem\);/,
    );
  });

  it('uses muted large section header titles and collapses open headers to chevrons only', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.sectionHeaderButton\s*{[\s\S]*?font-family:\s*var\(--ce-font-body\);/);
    expect(scss).toMatch(/\.sectionHeaderButtonOpen\s*{[\s\S]*?justify-content:\s*flex-end;/);
    expect(scss).toMatch(
      /\.sectionHeaderTitleText\s*{[\s\S]*?font-size:\s*1\.62rem;[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.5\);/,
    );
  });
});
