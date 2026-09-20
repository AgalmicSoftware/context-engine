import { buildWorkerGroupAutoJoinPath, readWorkerGroupAutoJoinId } from './workerGroupAutoJoin';

it('normalizes exactly one valid Worker group ID and rejects malformed or ambiguous targets', () => {
  expect(readWorkerGroupAutoJoinId('?joinGroup=PARTICIPANTS-2026')).toBe('participants-2026');
  for (const search of [
    '?joinGroup=',
    '?joinGroup=a&joinGroup=b',
    '?joinGroup=../bad',
    `?joinGroup=${'a'.repeat(81)}`,
  ]) {
    expect(readWorkerGroupAutoJoinId(search)).toBe('');
  }
});

it('builds a clean session route respecting the public base path', () => {
  const original = process.env.PUBLIC_URL;
  process.env.PUBLIC_URL = '/ce/';
  try {
    expect(buildWorkerGroupAutoJoinPath('alpha', 'participants-2026')).toBe(
      '/ce/session/alpha?joinGroup=participants-2026',
    );
    expect(() => buildWorkerGroupAutoJoinPath('', 'participants')).toThrow();
  } finally {
    if (original === undefined) delete process.env.PUBLIC_URL;
    else process.env.PUBLIC_URL = original;
  }
});

it('includes the validated Worker origin for first-time visitors without accepting credentials or paths', () => {
  expect(buildWorkerGroupAutoJoinPath('alpha', 'participants', 'https://worker.example/')).toBe(
    '/session/alpha?joinGroup=participants&worker=https%3A%2F%2Fworker.example',
  );
  for (const worker of [
    'https://[redacted-email]',
    'https://worker.example/private',
    'https://worker.example?token=secret',
  ]) {
    expect(() => buildWorkerGroupAutoJoinPath('alpha', 'participants', worker)).toThrow();
  }
});
