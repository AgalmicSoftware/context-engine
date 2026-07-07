import {
  CreateSBTGroup,
  getScopedCreateSbtFormCacheKey,
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
  makeInstance,
  setupCreateSBTGroupTestLifecycle,
} from './CreateSBTGroup.testUtils';
import { notify } from '../../utilities/ui/notify.js';

describe('CreateSBTGroup cache helpers', () => {
  setupCreateSBTGroupTestLifecycle();

  it('initializes a blank authoring form with open mint defaults', () => {
    const instance = makeInstance({ account: '0xAdmin' });

    expect(instance.state).toEqual(
      expect.objectContaining({
        sbtName: '',
        sbtDescription: '',
        sbtImageFile: null,
        sbtImageUrl: '',
        useImageUrl: false,
        tags: [],
        currentTagInput: '',
        documentURLs: [],
        documentUrl: '',
        groupPassword: '',
        metadataLockGateIds: {
          name: [],
          description: [],
          tags: [],
          documentURLs: [],
          image: [],
        },
        sbtCodes: [],
        groupSubmitted: false,
        predictableAddressEnabled: false,
        mintOptionsCollapsed: true,
        distributionOptionsCollapsed: true,
        numInviteLinks: 10,
        exportFormat: 'json',
      }),
    );
    expect(instance.state.sbtDistribution).toEqual(
      expect.objectContaining({
        distributionOption: 'anyoneCanMint',
        adminAddress: '0xAdmin',
        burnAdmin: '0xAdmin',
        isLimited: false,
        isTimeLimited: false,
        unlisted: false,
        network: 'not connected',
      }),
    );
    expect(instance.state.network).toBe('');
  });

  it('buildCachePayload normalizes dates and network metadata', () => {
    const instance = makeInstance({ network: { id: 5, name: 'Goerli' } });
    instance.state.sbtName = 'Alpha';
    instance.state.sbtDescription = 'Desc';
    instance.state.sbtImageUrl = 'https://img.test/logo.png';
    instance.state.useImageUrl = true;
    instance.state.tags = ['tag1', 'tag2'];
    instance.state.documentURLs = ['https://doc.test'];
    instance.state.documentUrl = 'https://doc.test/pending';
    instance.state.metadataLockGateIds = {
      ...instance.state.metadataLockGateIds,
      description: ['gate-description'],
    };
    instance.state.sbtDistribution = {
      ...instance.state.sbtDistribution,
      mintingEndTime: new Date('2024-01-01T00:00:00.000Z'),
      isLimited: true,
    };

    const payload = instance.buildCachePayload();

    expect(payload.sbtName).toBe('Alpha');
    expect(payload.tags).toEqual(['tag1', 'tag2']);
    expect(payload.documentURLs).toEqual(['https://doc.test']);
    expect(payload.documentUrl).toBe('https://doc.test/pending');
    expect(payload.metadataLockGateIds).toEqual(
      expect.objectContaining({
        description: ['gate-description'],
      }),
    );
    expect(payload.sbtDistribution.mintingEndTime).toBe('2024-01-01T00:00:00.000Z');
    expect(payload.sbtDistribution.network).toBe(instance.getSelectedAuthoringChainId());
  });

  it('persistFormCache writes once for unchanged data', () => {
    const instance = makeInstance({ network: { id: 1 } });
    const spy = jest.spyOn(Storage.prototype, 'setItem');

    instance.persistFormCache();
    instance.persistFormCache();

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('persistFormCache writes to the scoped cache key and clears legacy cache', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    sessionStorage.setItem('createSbtFormCache', JSON.stringify({ sbtName: 'Legacy Draft' }));

    instance.state.sbtName = 'Scoped Draft';
    instance.persistFormCache();

    expect(sessionStorage.getItem('createSbtFormCache')).toBeNull();
    expect(sessionStorage.getItem(getScopedCreateSbtFormCacheKey('test'))).toContain('"Scoped Draft"');
  });

  it('keeps generated password codes export-only without writing browser recovery storage', () => {
    localStorage.clear();
    const sbtAddress = '0xABC0000000000000000000000000000000000000';
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    instance.persistCreatedSbtCodes({
      sbtAddress,
      hasPasswordMintOnChain: true,
      codesToStore: ['code-one', 'code-two'],
    });

    const recoveryStore = JSON.parse(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY));
    expect(recoveryStore.entries[`84532:${sbtAddress.toLowerCase()}`]).toEqual(
      expect.objectContaining({
        chainId: 84532,
        sbtAddress: sbtAddress.toLowerCase(),
        passwords: ['code-one', 'code-two'],
      }),
    );
  });

  it('skips recovery-code persistence when the SBT has no password mint path', () => {
    localStorage.clear();
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    const result = instance.persistCreatedSbtCodes({
      sbtAddress: '0xABC0000000000000000000000000000000000000',
      hasPasswordMintOnChain: false,
      codesToStore: ['unused-code'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'empty-recovery-payload',
      }),
    );
    expect(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it('renders a QR SVG into a PNG blob for download and copy helpers', async () => {
    const instance = makeInstance();
    document.body.innerHTML = '<svg id="hidden-page-qr" xmlns="http://www.w3.org/2000/svg"></svg>';
    const qrBlob = new Blob(['qr'], { type: 'image/png' });
    const originalCreateElement = document.createElement.bind(document);
    const originalImage = global.Image;
    const canvasContext = {
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (String(tagName).toLowerCase() === 'canvas') {
        element.getContext = jest.fn(() => canvasContext);
        element.toBlob = jest.fn((callback) => callback(qrBlob));
      }
      return element;
    });
    class MockImage {
      constructor() {
        this.width = 24;
        this.height = 24;
        this.onload = null;
      }

      set src(_value) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }

    global.Image = MockImage;
    try {
      await expect(instance.processQrImage('hidden-page-qr')).resolves.toBe(qrBlob);
      expect(canvasContext.fillRect).toHaveBeenCalledWith(0, 0, 24, 24);
      expect(canvasContext.drawImage).toHaveBeenCalled();
    } finally {
      createElementSpy.mockRestore();
      global.Image = originalImage;
      document.body.innerHTML = '';
    }
  });

  it('rejects QR image processing when canvas export primitives are unavailable', async () => {
    const instance = makeInstance();
    document.body.innerHTML = '<svg id="hidden-page-qr" xmlns="http://www.w3.org/2000/svg"></svg>';
    const originalCreateElement = document.createElement.bind(document);
    const originalImage = global.Image;
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (String(tagName).toLowerCase() === 'canvas') {
        element.getContext = jest.fn(() => null);
      }
      return element;
    });
    class MockImage {
      constructor() {
        this.width = 24;
        this.height = 24;
        this.onload = null;
      }

      set src(_value) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }

    global.Image = MockImage;
    try {
      await expect(instance.processQrImage('hidden-page-qr')).rejects.toThrow('QR canvas context unavailable');
    } finally {
      createElementSpy.mockRestore();
      global.Image = originalImage;
      document.body.innerHTML = '';
    }
  });

  it('rejects QR image processing when canvas returns no PNG blob', async () => {
    const instance = makeInstance();
    document.body.innerHTML = '<svg id="hidden-page-qr" xmlns="http://www.w3.org/2000/svg"></svg>';
    const originalCreateElement = document.createElement.bind(document);
    const originalImage = global.Image;
    const canvasContext = {
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (String(tagName).toLowerCase() === 'canvas') {
        element.getContext = jest.fn(() => canvasContext);
        element.toBlob = jest.fn((callback) => callback(null));
      }
      return element;
    });
    class MockImage {
      constructor() {
        this.width = 24;
        this.height = 24;
        this.onload = null;
      }

      set src(_value) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }

    global.Image = MockImage;
    try {
      await expect(instance.processQrImage('hidden-page-qr')).rejects.toThrow('QR image export failed');
    } finally {
      createElementSpy.mockRestore();
      global.Image = originalImage;
      document.body.innerHTML = '';
    }
  });

  it('warns when QR download receives an invalid export blob', async () => {
    const instance = makeInstance();
    instance.processQrImage = jest.fn().mockResolvedValue(null);
    const warnSpy = jest.spyOn(notify, 'warn').mockImplementation(() => undefined);

    await instance.downloadQR('hidden-page-qr', 'qr.png');

    expect(warnSpy).toHaveBeenCalledWith('QR download failed');
  });

  it('warns and does not mark QR image copied when clipboard write rejects', async () => {
    const instance = makeInstance();
    instance._isMounted = true;
    instance.processQrImage = jest.fn().mockResolvedValue(new Blob(['qr'], { type: 'image/png' }));
    const warnSpy = jest.spyOn(notify, 'warn').mockImplementation(() => undefined);
    const originalClipboardItem = global.ClipboardItem;
    const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const write = jest.fn().mockRejectedValue(new Error('clipboard denied'));
    global.ClipboardItem = class ClipboardItem {
      constructor(items) {
        this.items = items;
      }
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });

    try {
      await instance.copyQRImage('hidden-page-qr', 'copy-key');
      expect(write).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('QR copy failed');
      expect(instance.state.copiedLinkIndex).not.toBe('copy-key');
    } finally {
      if (originalClipboardItem) {
        global.ClipboardItem = originalClipboardItem;
      } else {
        delete global.ClipboardItem;
      }
      if (originalClipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it('loadFormCache restores tags and dates, then updates hash', () => {
    const instance = makeInstance({ network: { id: 84532, name: 'Base Sepolia' }, sessionSlug: 'test' });
    instance.updateGroupHash = jest.fn();

    sessionStorage.setItem(
      getScopedCreateSbtFormCacheKey('test'),
      JSON.stringify({
        sbtName: 'Cached',
        sbtDescription: 'Cached desc',
        tags: 'alpha, beta',
        documentURLs: ['https://doc.test'],
        metadataLockGateIds: {
          name: ['test-sbt'],
          description: ['test-sbt'],
          tags: [],
          documentURLs: [],
          image: [],
        },
        _sessionSlug: 'test',
        sbtDistribution: {
          mintingEndTime: '2024-02-02T00:00:00.000Z',
          hasAdmin: true,
        },
      }),
    );

    const loaded = instance.loadFormCache();

    expect(loaded).toBe(true);
    expect(instance.state.tags).toEqual(['alpha', 'beta']);
    expect(instance.state.metadataLockGateIds).toEqual(
      expect.objectContaining({
        name: ['test-sbt'],
        description: ['test-sbt'],
      }),
    );
    expect(instance.state.sbtDistribution.mintingEndTime).toBeInstanceOf(Date);
    expect(instance.state.tokenInfoCollapsed).toBe(false);
    expect(instance.updateGroupHash).toHaveBeenCalled();
  });

  it('loadFormCache restores a pending document URL draft and expands the authoring sections', () => {
    const instance = makeInstance({ network: { id: 84532, name: 'Base Sepolia' }, sessionSlug: 'test' });
    instance.updateGroupHash = jest.fn();

    sessionStorage.setItem(
      getScopedCreateSbtFormCacheKey('test'),
      JSON.stringify({
        sbtName: 'Cached',
        documentUrl: 'https://doc.test/pending',
        _sessionSlug: 'test',
        sbtDistribution: {
          network: 84532,
        },
      }),
    );

    const loaded = instance.loadFormCache();

    expect(loaded).toBe(true);
    expect(instance.state.documentURLs).toEqual([]);
    expect(instance.state.documentUrl).toBe('https://doc.test/pending');
    expect(instance.state.tokenInfoCollapsed).toBe(false);
    expect(instance.state.mintOptionsCollapsed).toBe(false);
    expect(instance.state.distributionOptionsCollapsed).toBe(false);
    expect(instance.updateGroupHash).toHaveBeenCalled();
  });

  it('keeps only the first section open for name-only cached drafts', () => {
    const instance = makeInstance({ network: { id: 84532, name: 'Base Sepolia' }, sessionSlug: 'test' });
    instance.updateGroupHash = jest.fn();

    sessionStorage.setItem(
      getScopedCreateSbtFormCacheKey('test'),
      JSON.stringify({
        sbtName: 'Cached',
        _sessionSlug: 'test',
        sbtDistribution: {
          distributionOption: 'anyoneCanMint',
          burnAuth: 'AdminOnly',
          network: 84532,
        },
      }),
    );

    const loaded = instance.loadFormCache();

    expect(loaded).toBe(true);
    expect(instance.state.tokenInfoCollapsed).toBe(false);
    expect(instance.state.mintOptionsCollapsed).toBe(true);
    expect(instance.state.distributionOptionsCollapsed).toBe(true);
    expect(instance.updateGroupHash).toHaveBeenCalled();
  });

  it('persists deferred draft salts in the cache for deferred deploy mode', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.deferredCreate2Salt = 'draft/private-seed';

    const payload = instance.buildCachePayload();

    expect(payload.deferredCreate2Salt).toBe('draft/private-seed');
  });
});
