import { notify } from './notify.js';
import { copyJsonToClipboard, formatJsonForDisplay } from './jsonFunctions.js';

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
});
