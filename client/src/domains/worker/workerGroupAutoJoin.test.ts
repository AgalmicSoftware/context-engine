import {
  buildWorkerGroupAutoJoinPath,
  finishWorkerGroupAutoJoin,
  readLinkedWorkerGroupId,
  readLinkedWorkerGroupToken,
  readWorkerGroupAutoJoinId,
} from './workerGroupAutoJoin';

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
  const credentialedWorker = new URL('https://worker.example');
  credentialedWorker.username = 'fixture';
  for (const worker of [
    credentialedWorker.href,
    'https://worker.example/private',
    'https://worker.example?token=secret',
  ]) {
    expect(() => buildWorkerGroupAutoJoinPath('alpha', 'participants', worker)).toThrow();
  }
});

it('composes auto-join with same-session workflow links without copying private query or hash data', () => {
  expect(
    buildWorkerGroupAutoJoinPath(
      'alpha',
      'participants',
      'https://worker.example/',
      '/session/alpha?mode=interview&src=partner&groups=EDDY-2026&agentToken=private&worker=https%3A%2F%2Fold.example#prefill=abc&secret=hidden',
    ),
  ).toBe('/session/alpha?mode=interview&src=partner&joinGroup=participants&worker=https%3A%2F%2Fworker.example');

  expect(
    buildWorkerGroupAutoJoinPath(
      'alpha',
      'participants',
      'https://worker.example/',
      '/session/alpha?mode=interview#secret',
    ),
  ).toBe('/session/alpha?mode=interview&joinGroup=participants&worker=https%3A%2F%2Fworker.example');

  expect(
    buildWorkerGroupAutoJoinPath(
      'alpha',
      'participants',
      'https://worker.example/',
      '/session/beta?mode=interview&src=partner#prefill=abc',
    ),
  ).toBe('/session/alpha?joinGroup=participants&worker=https%3A%2F%2Fworker.example');
});

it('reuses a valid same-session Worker hint from the base path when no explicit Worker URL is supplied', () => {
  expect(
    buildWorkerGroupAutoJoinPath(
      'alpha',
      'participants',
      undefined,
      '/session/alpha?mode=interview&worker=https%3A%2F%2Fworker.example#prefill=abc',
    ),
  ).toBe('/session/alpha?mode=interview&joinGroup=participants&worker=https%3A%2F%2Fworker.example');

  expect(
    buildWorkerGroupAutoJoinPath(
      'alpha',
      'participants',
      undefined,
      '/session/alpha?mode=interview&worker=https%3A%2F%2Fworker.example%2Fprivate#prefill=abc',
    ),
  ).toBe('/session/alpha?mode=interview&joinGroup=participants');
});

it('remembers the group a link joined through a reload of that page, for that session only', async () => {
  window.history.replaceState({}, '', '/session/salon?joinGroup=table-3');
  expect(readLinkedWorkerGroupId('salon')).toBe('table-3');
  finishWorkerGroupAutoJoin('salon', 'table-3', undefined, 'gp:river-stone-lamp');
  expect(window.location.search).toBe('');
  // The invite stays in this page's memory only, for that group.
  expect(readLinkedWorkerGroupToken('salon', 'table-3')).toBe('gp:river-stone-lamp');
  expect(readLinkedWorkerGroupToken('salon', 'table-4')).toBe('');
  expect(JSON.stringify(window.history.state)).not.toContain('river');
  // A reload starts the page's memory afresh; the page's history entry still knows the group.
  jest.resetModules();
  const reloaded = await import('./workerGroupAutoJoin');
  expect(reloaded.readLinkedWorkerGroupId('salon')).toBe('table-3');
  expect(reloaded.readLinkedWorkerGroupId('other')).toBe('');
  expect(reloaded.readLinkedWorkerGroupToken('salon', 'table-3')).toBe('');
  // A newer link in the address wins.
  window.history.replaceState({ ...window.history.state }, '', '/session/salon?joinGroup=table-4');
  expect(reloaded.readLinkedWorkerGroupId('salon')).toBe('table-4');
  // Opening the plain session link, as for the plenary, carries no table's group.
  window.history.pushState(null, '', '/session/salon');
  jest.resetModules();
  const plain = await import('./workerGroupAutoJoin');
  expect(plain.readLinkedWorkerGroupId('salon')).toBe('');
});
