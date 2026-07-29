import { isBrowserOriginAllowedBySessionWorkerConfig } from './sessionWorkerCorsPolicy';

describe('sessionWorkerCorsPolicy', () => {
  it('allows configs without an explicit allowlist and explicit open allowlists', () => {
    expect(isBrowserOriginAllowedBySessionWorkerConfig({}, 'http://127.0.0.1:3000')).toBe(true);
    expect(isBrowserOriginAllowedBySessionWorkerConfig({ allowOrigins: [] }, 'http://127.0.0.1:3000')).toBe(true);
  });

  it('accepts only normalized browser origins in a configured allowlist', () => {
    const config = { allowOrigins: ['https://contextengine.sh/path', 'http://localhost:3000/'] };

    expect(isBrowserOriginAllowedBySessionWorkerConfig(config, 'https://contextengine.sh/about')).toBe(true);
    expect(isBrowserOriginAllowedBySessionWorkerConfig(config, 'http://localhost:3000')).toBe(true);
    expect(isBrowserOriginAllowedBySessionWorkerConfig(config, 'http://127.0.0.1:3000')).toBe(false);
  });

  it('supports legacy comma/newline-delimited allowlists', () => {
    const config = { allowOrigins: 'https://one.example,\nhttps://two.example' };

    expect(isBrowserOriginAllowedBySessionWorkerConfig(config, 'https://two.example/path')).toBe(true);
  });

  it('fails closed for a non-empty malformed allowlist or missing browser origin', () => {
    expect(isBrowserOriginAllowedBySessionWorkerConfig({ allowOrigins: [true] }, 'https://app.example')).toBe(false);
    expect(isBrowserOriginAllowedBySessionWorkerConfig({ allowOrigins: ['https://app.example'] }, '')).toBe(false);
  });
});
