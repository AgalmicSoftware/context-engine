import { readCompactImageClipboard } from './compactImageClipboard.js';

describe('readCompactImageClipboard', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('returns kind=text for supported http image URLs', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: jest.fn().mockResolvedValue([]),
        readText: jest.fn().mockResolvedValue('https://example.com/image.png'),
      },
    });

    await expect(readCompactImageClipboard()).resolves.toEqual({
      kind: 'text',
      text: 'https://example.com/image.png',
    });
  });

  it('returns kind=text for supported arweave references', async () => {
    const arweaveTxId = 'a'.repeat(43);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: jest.fn().mockResolvedValue([]),
        readText: jest.fn().mockResolvedValue(`ar://${arweaveTxId}`),
      },
    });

    await expect(readCompactImageClipboard()).resolves.toEqual({
      kind: 'text',
      text: `ar://${arweaveTxId}`,
    });
  });

  it('returns kind=text for supported relative asset paths', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: jest.fn().mockResolvedValue([]),
        readText: jest.fn().mockResolvedValue('assets/img/header.webp'),
      },
    });

    await expect(readCompactImageClipboard()).resolves.toEqual({
      kind: 'text',
      text: 'assets/img/header.webp',
    });
  });

  it('rejects arbitrary clipboard text that is not a supported image URL', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: jest.fn().mockResolvedValue([]),
        readText: jest.fn().mockResolvedValue('this is not an image URL'),
      },
    });

    await expect(readCompactImageClipboard()).resolves.toEqual({
      error: 'Clipboard does not contain a supported image or URL.',
    });
  });
});
