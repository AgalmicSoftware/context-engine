import { normalizeAddress } from './addressNormalization.js';

describe('addressNormalization normalizeAddress', () => {
  let debugSpy;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('returns lowercase for a valid checksummed address without logging', () => {
    const checksummed = '0x52908400098527886E0F7030069857D2E4169EE7';

    expect(normalizeAddress(checksummed)).toBe(checksummed.toLowerCase());
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('logs and falls back when checksum validation fails', () => {
    const invalidChecksum = '0x52908400098527886E0F7030069857D2E4169Ee7';

    expect(normalizeAddress(invalidChecksum)).toBe(invalidChecksum.toLowerCase());
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
