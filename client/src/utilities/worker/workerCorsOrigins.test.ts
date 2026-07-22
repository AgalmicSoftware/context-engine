import { buildWorkerAllowOrigins, DEFAULT_WORKER_ALLOWED_ORIGINS } from './workerCorsOrigins';

describe('workerCorsOrigins helpers', () => {
  it('keeps the canonical .sh site and the redirecting .xyz site in the hosted defaults', () => {
    expect(DEFAULT_WORKER_ALLOWED_ORIGINS.slice(0, 4)).toEqual([
      'https://contextengine.sh',
      'https://www.contextengine.sh',
      'https://contextengine.xyz',
      'https://www.contextengine.xyz',
    ]);
  });

  it('includes common dev origins (localhost/127.0.0.1 ports 3000, 3001, and 7391)', () => {
    expect(DEFAULT_WORKER_ALLOWED_ORIGINS).toEqual(
      expect.arrayContaining([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:7391',
        'http://127.0.0.1:7391',
      ]),
    );
  });

  it('buildWorkerAllowOrigins normalizes, de-dupes, and prepends the current origin', () => {
    const out = buildWorkerAllowOrigins({
      currentOrigin: 'http://localhost:3001',
      extraOrigins: ['http://localhost:3001', 'https://contextengine.example.test/'],
    });
    expect(out[0]).toBe('http://localhost:3001');
    expect(out).toEqual(
      expect.arrayContaining(['https://contextengine.example.test', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']),
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
