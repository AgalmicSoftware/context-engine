import { hasAutoFlag, manageAutoHashPersistence, type AutoHashPersistenceDeps } from './autoHashPersistence';

const createDeps = (overrides: Partial<AutoHashPersistenceDeps> = {}): AutoHashPersistenceDeps => ({
  getActiveSlug: () => 'alpha',
  getLocationSearch: () => '',
  getLocationPathname: () => '/session/alpha',
  sessionStorageGet: jest.fn(() => null),
  sessionStorageSet: jest.fn(),
  replaceState: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  ...overrides,
});

describe('hasAutoFlag', () => {
  it('returns true for ?auto=1', () => {
    expect(hasAutoFlag('?auto=1')).toBe(true);
  });

  it('returns true for ?auto2=1', () => {
    expect(hasAutoFlag('?auto2=1')).toBe(true);
  });

  it('returns false for ?auto=0', () => {
    expect(hasAutoFlag('?auto=0')).toBe(false);
  });

  it.each(['', null, undefined])('returns false for emptyish value %p', (value) => {
    expect(hasAutoFlag(value)).toBe(false);
  });

  it('returns false for ?mode=auto', () => {
    expect(hasAutoFlag('?mode=auto')).toBe(false);
  });
});

describe('manageAutoHashPersistence', () => {
  it('saves the query when an auto flag is present', () => {
    const deps = createDeps({
      getLocationSearch: () => '?auto=1&ref=abc',
    });

    manageAutoHashPersistence(deps);

    expect(deps.sessionStorageSet).toHaveBeenCalledWith('dg:autoHash:alpha', 'auto=1&ref=abc');
    expect(deps.sessionStorageGet).not.toHaveBeenCalled();
    expect(deps.replaceState).not.toHaveBeenCalled();
  });

  it('strips claim credentials before saving an auto query', () => {
    const deps = createDeps({
      getLocationSearch: () => '?auto=1&sbt=0xabc&gp=group-secret&inv=invite-secret&ref=abc',
    });

    manageAutoHashPersistence(deps);

    expect(deps.sessionStorageSet).toHaveBeenCalledWith('dg:autoHash:alpha', 'auto=1&sbt=0xabc&ref=abc');
    expect(JSON.stringify((deps.sessionStorageSet as jest.Mock).mock.calls)).not.toContain('group-secret');
    expect(JSON.stringify((deps.sessionStorageSet as jest.Mock).mock.calls)).not.toContain('invite-secret');
  });

  it('restores the saved query when the current query is empty', () => {
    const deps = createDeps({
      sessionStorageGet: jest.fn(() => 'auto2=1&ref=abc'),
    });

    manageAutoHashPersistence(deps);

    expect(deps.sessionStorageGet).toHaveBeenCalledWith('dg:autoHash:alpha');
    expect(deps.replaceState).toHaveBeenCalledWith('/session/alpha?auto2=1&ref=abc');
    expect(deps.log).toHaveBeenCalledWith('[MainSite] Restoring persisted auto-query:', 'auto2=1&ref=abc');
  });

  it('sanitizes a legacy saved credential query before restoring or logging it', () => {
    const deps = createDeps({
      sessionStorageGet: jest.fn(() => 'auto=1&sbt=0xabc&gp=legacy-secret&ref=abc'),
    });

    manageAutoHashPersistence(deps);

    expect(deps.sessionStorageSet).toHaveBeenCalledWith('dg:autoHash:alpha', 'auto=1&sbt=0xabc&ref=abc');
    expect(deps.replaceState).toHaveBeenCalledWith('/session/alpha?auto=1&sbt=0xabc&ref=abc');
    expect(JSON.stringify((deps.log as jest.Mock).mock.calls)).not.toContain('legacy-secret');
  });

  it('does not restore when the saved value does not have an auto flag', () => {
    const deps = createDeps({
      sessionStorageGet: jest.fn(() => 'mode=edit'),
    });

    manageAutoHashPersistence(deps);

    expect(deps.replaceState).not.toHaveBeenCalled();
    expect(deps.log).not.toHaveBeenCalled();
  });

  it('does not restore when the current query exists without an auto flag', () => {
    const deps = createDeps({
      getLocationSearch: () => '?mode=edit',
      sessionStorageGet: jest.fn(() => 'auto=1'),
    });

    manageAutoHashPersistence(deps);

    expect(deps.sessionStorageGet).not.toHaveBeenCalled();
    expect(deps.sessionStorageSet).not.toHaveBeenCalled();
    expect(deps.replaceState).not.toHaveBeenCalled();
  });

  it('uses the active slug in the storage key', () => {
    const deps = createDeps({
      getActiveSlug: () => 'custom-slug',
      getLocationSearch: () => '?auto1=1',
    });

    manageAutoHashPersistence(deps);

    expect(deps.sessionStorageSet).toHaveBeenCalledWith('dg:autoHash:custom-slug', 'auto1=1');
  });
});

describe('sanitizeAutoQueryForPersistence', () => {
  it('removes base and indexed registry claim credentials while preserving identity', () => {
    expect(
      sanitizeAutoQueryForPersistence(
        '?auto=1&sbt=0xabc&gp=secret&inv=invite&sbt2=0xdef&gp2=secret-2&inv2=invite-2&password3=pw',
      ),
    ).toBe('auto=1&sbt=0xabc&sbt2=0xdef');
  });
});
