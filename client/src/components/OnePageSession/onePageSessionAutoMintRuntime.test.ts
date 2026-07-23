jest.mock('./onePageSessionSbtGroupRuntime', () => ({
  sessionSupportsOnChainSbt: jest.fn(() => true),
}));

import {
  buildSbtAutoMintCredentialCleanPath,
  clearUnsupportedSbtAutoMintState,
  initializeSbtAutoMintRuntime,
  sanitizeSbtAutoMintQueryForStorage,
} from './onePageSessionAutoMintRuntime';

const buildHost = () => ({
  _autoMintLegacyCredentialQuery: '',
  _autoMintParseCachedTargets: [],
  _autoMintParseSourceSig: '',
  state: {
    autoMintTargets: [],
    autoMintStatuses: {},
    autoMintCountdown: null,
    autoMintingMode: false,
    needsLoginForAutoMint: false,
  },
  setState: jest.fn(),
  getAutoHashStorageKey: jest.fn(() => 'dg:autoHash:alpha'),
  resolveCurrentSessionConfig: jest.fn(() => ({ slug: 'alpha' })),
  parseAutoMintFragment: jest.fn(() => [{ sbt: '0xabc', gp: 'group-secret', inv: '' }]),
  primeAutoMintTargets: jest.fn(),
  clearUnsupportedAutoMintState: jest.fn(),
});

describe('onePageSessionAutoMintRuntime credential handling', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/session/alpha');
  });

  it('keeps legacy credentials in memory while storing and displaying only identity fields', () => {
    window.history.replaceState({}, '', '/session/alpha?auto=1&sbt=0xabc&gp=group-secret&inv=invite-secret&ref=abc');
    const host = buildHost();

    initializeSbtAutoMintRuntime(host);

    expect(host._autoMintLegacyCredentialQuery).toContain('gp=group-secret');
    expect(host.parseAutoMintFragment).toHaveBeenCalledTimes(1);
    expect(host.primeAutoMintTargets).toHaveBeenCalledWith([{ sbt: '0xabc', gp: 'group-secret', inv: '' }]);
    expect(sessionStorage.getItem('dg:autoHash:alpha')).toBe('auto=1&sbt=0xabc&ref=abc');
    expect(window.location.search).toBe('?auto=1&sbt=0xabc&ref=abc');
    expect(window.location.href).not.toContain('group-secret');
    expect(window.location.href).not.toContain('invite-secret');
  });

  it('purges in-memory and persisted auto-mint intent when the session no longer supports SBTs', () => {
    const host = buildHost();
    host._autoMintLegacyCredentialQuery = '?auto=1&sbt=0xabc&gp=group-secret';
    sessionStorage.setItem('dg:autoHash:alpha', 'auto=1&sbt=0xabc');

    clearUnsupportedSbtAutoMintState(host, false);

    expect(host._autoMintLegacyCredentialQuery).toBe('');
    expect(sessionStorage.getItem('dg:autoHash:alpha')).toBeNull();
  });

  it('sanitizes base and indexed credentials without removing SBT identity', () => {
    expect(
      sanitizeSbtAutoMintQueryForStorage(
        '?auto=1&sbt=0xabc&gp=secret&inv=invite&sbt2=0xdef&gp2=secret-2&inv2=invite-2',
      ),
    ).toBe('auto=1&sbt=0xabc&sbt2=0xdef');
    expect(
      buildSbtAutoMintCredentialCleanPath(
        'https://app.example/session/alpha?auto=1&sbt=0xabc&gp=secret&keep=yes#groups',
      ),
    ).toBe('/session/alpha?auto=1&sbt=0xabc&keep=yes#groups');
  });
});
