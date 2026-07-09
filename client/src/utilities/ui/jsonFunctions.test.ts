import { notify } from './notify.js';
import { copyJsonToClipboard, downloadJson, formatJsonForDisplay } from './jsonFunctions.js';

jest.mock('./notify.js', () => ({
  notify: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('jsonFunctions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('copies formatted JSON to the clipboard and shows success feedback', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyJsonToClipboard({ alpha: 1 });

    expect(writeText).toHaveBeenCalledWith('{\n  "alpha": 1\n}');
    expect(notify.success).toHaveBeenCalledWith('JSON copied to clipboard');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('shows an error when clipboard writes fail', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('nope'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await expect(copyJsonToClipboard({ alpha: 1 })).rejects.toThrow('nope');
    expect(notify.error).toHaveBeenCalledWith('Failed to copy JSON');
  });

  it('formats JSON for display and falls back to an empty string on errors', () => {
    expect(formatJsonForDisplay({ alpha: 1 })).toBe('{\n  "alpha": 1\n}');

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatJsonForDisplay(circular)).toBe('');
  });

  it('downloads formatted JSON via a temporary anchor element', () => {
    const createObjectURL = jest.fn(() => 'blob:test-json');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    const anchor = document.createElement('a');
    const clickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const originalCreateElement = document.createElement.bind(document);
    const createElement = ((tagName: string, options?: ElementCreationOptions) =>
      tagName === 'a' ? anchor : originalCreateElement(tagName, options)) as typeof document.createElement;
    jest.spyOn(document, 'createElement').mockImplementation(createElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    downloadJson({ alpha: 1 }, 'preview.json');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor.href).toBe('blob:test-json');
    expect(anchor.download).toBe('preview.json');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-json');
  });
});
