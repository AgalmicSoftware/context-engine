import fs from 'fs';
import path from 'path';
import {
  mergeSessionContractMaps,
  normalizeRegistrySessionSlugForWrite,
  normalizeSessionSlug,
  resolveSessionConfigAliases,
  resolveSessionContractRef,
  resolveSessionSlugFromPathname,
  validateRegistrySessionSlugForWrite,
} from './sessionNaming.js';

const collectSourceFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });

describe('sessionNaming helpers', () => {
  it('keeps SBT leaf slug normalization session-owned', () => {
    const sourceRoots = [
      path.resolve(__dirname, '../sbt'),
      path.resolve(__dirname, '../../components/SBTs'),
    ];
    const web3SlugImports = sourceRoots
      .flatMap(collectSourceFiles)
      .filter((filePath) =>
        /import[^;]*\bnormalizeSessionSlug\b[^;]*from ['"][^'"]*web3\/chainGateway(?:\.js)?['"]/.test(
          fs.readFileSync(filePath, 'utf8'),
        ),
      )
      .map((filePath) => path.relative(path.resolve(__dirname, '../..'), filePath))
      .sort();

    expect(web3SlugImports).toEqual([]);
  });

  it('resolves canonical session aliases from legacy group inputs', () => {
    const cfg = {
      slug: 'test-72',
      contracts: {
        surveys: { address: '0x1111111111111111111111111111111111111111', chainId: 84532 },
      },
    };
    const resolved = resolveSessionConfigAliases({
      sessionSlug: 'test-72',
      sessionConfig: cfg,
    });

    expect(resolved.sessionSlug).toBe('test-72');
    expect(resolved.sessionSlug).toBe('test-72');
    expect(resolved.sessionConfig).toEqual(cfg);
    expect(resolved.sessionConfig).toEqual(cfg);
  });

  it('resolves surveys contract from canonical contracts.surveys.address', () => {
    const ref = resolveSessionContractRef({
      sessionConfig: {
        slug: 'test-72',
        networkChainId: 84532,
        contracts: {
          surveys: { address: '0x2222222222222222222222222222222222222222', chainId: 84533 },
        },
      },
      contractKey: 'surveys',
    });

    expect(ref.sessionSlug).toBe('test-72');
    expect(ref.address).toBe('0x2222222222222222222222222222222222222222');
    expect(ref.chainId).toBe(84533);
  });

  it('resolves surveys contract from legacy top-level fallback keys', () => {
    const ref = resolveSessionContractRef({
      sessionSlug: 'test-72',
      sessionConfig: {
        slug: 'test-72',
        networkChainId: 84532,
        surveysContractAddress: '0x3333333333333333333333333333333333333333',
      },
      contractKey: 'surveys',
    });

    expect(ref.sessionSlug).toBe('test-72');
    expect(ref.address).toBe('0x3333333333333333333333333333333333333333');
    expect(ref.chainId).toBe(84532);
  });

  it('does not resolve removed release-one XP contract aliases', () => {
    const ref = resolveSessionContractRef({
      sessionConfig: {
        slug: 'test-72',
        networkChainId: 84532,
        contracts: {
          xp: { address: '0x9999999999999999999999999999999999999999', chainId: 84532 },
        },
        xpAddress: '0x8888888888888888888888888888888888888888',
      },
      contractKey: 'xp',
    });

    expect(ref.sessionSlug).toBe('test-72');
    expect(ref.address).toBe('');
    expect(ref.chainId).toBeUndefined();
  });

  it('merges contract maps while preserving string and object entries', () => {
    const merged = mergeSessionContractMaps(
      { surveys: '0x4444444444444444444444444444444444444444' },
      { surveys: { chainId: 84532 } },
    );

    expect(merged).toEqual({
      surveys: {
        address: '0x4444444444444444444444444444444444444444',
        chainId: 84532,
      },
    });
  });

  it('preserves exact session slugs while canonicalizing reserved aliases', () => {
    expect(normalizeSessionSlug('TeamA')).toBe('TeamA');
    expect(normalizeSessionSlug('Team_A-1')).toBe('Team_A-1');
    expect(normalizeSessionSlug('Team A!')).toBe('Team A!');
    expect(normalizeSessionSlug('General')).toBe('');
    expect(normalizeSessionSlug('DEBATE')).toBe('DEBATE');
  });

  it('normalizes registry slugs for new writes without changing legacy read normalization', () => {
    expect(normalizeRegistrySessionSlugForWrite(' Team_A-1 ')).toBe('team_a-1');
    expect(normalizeRegistrySessionSlugForWrite('')).toBe('general');
    expect(normalizeRegistrySessionSlugForWrite('General')).toBe('general');
    expect(normalizeSessionSlug('TeamA')).toBe('TeamA');
  });

  it('validates registry slugs before new SessionRegistry writes', () => {
    expect(validateRegistrySessionSlugForWrite(' Team_A-1 ')).toEqual({
      ok: true,
      slug: 'team_a-1',
      changed: true,
      reason: '',
      error: '',
    });

    expect(validateRegistrySessionSlugForWrite('Team A!')).toEqual(
      expect.objectContaining({
        ok: false,
        slug: 'team a!',
        reason: 'invalid-format',
      }),
    );

    expect(validateRegistrySessionSlugForWrite('__proto__')).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'reserved',
      }),
    );

    expect(validateRegistrySessionSlugForWrite('', { allowDefault: false })).toEqual(
      expect.objectContaining({
        ok: false,
        slug: 'general',
        reason: 'default-disallowed',
      }),
    );
  });

  it('keeps an explicit general slug when active-session defaults are present', () => {
    const resolved = resolveSessionConfigAliases(
      {
        sessionSlug: '',
      },
      {
        defaults: { activeSessionSlug: 'alpha' },
        resolveBySlug: (slug) => {
          if (slug === '') return { slug: '', sessionName: 'General' };
          if (slug === 'alpha') return { slug: 'alpha', sessionName: 'Alpha' };
          return null;
        },
      },
    );

    expect(resolved.sessionSlug).toBe('');
    expect(resolved.sessionConfig).toEqual({ slug: '', sessionName: 'General' });
  });

  it('parses PUBLIC_URL-prefixed session routes', () => {
    const priorPublicUrl = process.env.PUBLIC_URL;
    // '/ce/' is a test-only example of serving the SPA from a subpath.
    process.env.PUBLIC_URL = '/ce/';

    try {
      expect(resolveSessionSlugFromPathname('/ce/session/edge')).toBe('edge');
      expect(resolveSessionSlugFromPathname('/ce/session')).toBe('');
    } finally {
      process.env.PUBLIC_URL = priorPublicUrl;
    }
  });
});
