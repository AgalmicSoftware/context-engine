import { buildWorkerAllowOrigins, DEFAULT_WORKER_ALLOWED_ORIGINS } from './workerCorsOrigins';

describe('workerCorsOrigins helpers', () => {
  it('defaults to the site\'s own .sh origins only, without the retired .xyz site or local dev servers', () => {
    expect(DEFAULT_WORKER_ALLOWED_ORIGINS).toEqual(['https://contextengine.sh', 'https://www.contextengine.sh']);
  });

  it('buildWorkerAllowOrigins normalizes, de-dupes, and prepends the current origin', () => {
    const out = buildWorkerAllowOrigins({
      currentOrigin: 'http://localhost:3001',
      extraOrigins: ['http://localhost:3001', 'https://contextengine.example.test/'],
    });
    expect(out[0]).toBe('http://localhost:3001');
    expect(out).toEqual(
      expect.arrayContaining(['https://contextengine.example.test', 'https://contextengine.sh']),
    );
    expect(out.filter((x: string) => x === 'http://localhost:3001')).toHaveLength(1);
  });

  it('buildWorkerAllowOrigins treats legacy string allowOrigins inputs as lists', () => {
    const out = buildWorkerAllowOrigins({
      currentOrigin: 'http://localhost:3001',
      extraOrigins: 'https://example.com,\nhttp://127.0.0.1:3999',
    });
    expect(out).toEqual(expect.arrayContaining(['https://example.com', 'http://127.0.0.1:3999']));
  });
});
