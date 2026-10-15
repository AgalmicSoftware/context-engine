import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { fetchWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerDiscovery';
import {
  getVerifiedWorkerCanonicalSessionBootstrap,
  markWorkerCanonicalSessionBootstrapVerified,
  upsertWorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerConfigCache';
import { readKnownSessionCatalog } from '../../utilities/session/sessionCatalog';
import { resolveLoginSettingsSessionConfig } from './loginSettingsSessionConfig';

jest.mock('../../utilities/session/sessionWorkerDiscovery', () => ({
  ...jest.requireActual<typeof import('../../utilities/session/sessionWorkerDiscovery')>(
    '../../utilities/session/sessionWorkerDiscovery',
  ),
  fetchWorkerCanonicalSessionBootstrap: jest.fn(),
}));
jest.mock('../../utilities/session/sessionWorkerConfigCache', () => ({
  getVerifiedWorkerCanonicalSessionBootstrap: jest.fn(() => null),
  markWorkerCanonicalSessionBootstrapVerified: jest.fn(() => true),
  upsertWorkerCanonicalSessionBootstrap: jest.fn(() => ({ status: 'cached' })),
}));
jest.mock('../../utilities/session/sessionCatalog', () => ({ readKnownSessionCatalog: jest.fn(() => []) }));

const slug = 'worker-session';
const workerOrigin = 'https://session.example';
const sessionId = '0x00112233445566778899aabbccddeeff';
const config = {
  slug,
  sessionId,
  corsWorkerUrl: workerOrigin,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
const hint = { slug, sessionId, corsWorkerUrl: workerOrigin, workerCanonicalCleanRoute: true };
const bootstrap = { sessionSlug: slug, sessionId, workerOrigin, configRevision: 'v1', config };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockResolvedValue(bootstrap);
});

it('loads a directory hint through canonical validation and pin verification before using it', async () => {
  expect(await resolveLoginSettingsSessionConfig(slug, hint)).toEqual(config);
  expect(fetchWorkerCanonicalSessionBootstrap).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionSlug: slug,
      workerQueryValue: workerOrigin,
    }),
  );
  expect(upsertWorkerCanonicalSessionBootstrap).toHaveBeenCalledWith(
    expect.objectContaining({
      slug,
      sessionIdHex: sessionId,
      workerOrigin,
      allowRepin: false,
    }),
  );
  expect(markWorkerCanonicalSessionBootstrapVerified).toHaveBeenCalled();
});

it('uses the exact verified cache without fetching another session', async () => {
  jest.mocked(getVerifiedWorkerCanonicalSessionBootstrap).mockReturnValueOnce(config);
  expect(await resolveLoginSettingsSessionConfig(slug, hint)).toEqual(config);
  expect(fetchWorkerCanonicalSessionBootstrap).not.toHaveBeenCalled();
});

it('discovers catalog-only selections and leaves registry configs unchanged', async () => {
  jest.mocked(readKnownSessionCatalog).mockReturnValueOnce([
    {
      slug,
      name: 'Synthetic session',
      kind: 'centralized',
      href: `/session/${slug}?worker=${encodeURIComponent(workerOrigin)}`,
      createdAt: null,
      lastActivityAt: null,
      adminAddresses: [],
    },
  ]);
  expect(await resolveLoginSettingsSessionConfig(slug, {})).toEqual(config);
  const registry = { slug, networkChainId: 11155420 };
  expect(await resolveLoginSettingsSessionConfig(slug, registry)).toBe(registry);
});

it('rejects identity changes without silently replacing the pinned session', async () => {
  jest.mocked(upsertWorkerCanonicalSessionBootstrap).mockReturnValueOnce({
    status: 'conflict',
    cacheKey: 'synthetic-conflict',
    config: null,
    existingSessionIdHex: `0x${'ff'.repeat(16)}`,
    sessionIdHex: sessionId,
    existingWorkerOrigin: workerOrigin,
    workerOrigin,
  });
  await expect(resolveLoginSettingsSessionConfig(slug, hint)).rejects.toThrow(/identity/i);
  expect(markWorkerCanonicalSessionBootstrapVerified).not.toHaveBeenCalled();
});

it('rejects a bootstrap whose identity differs from the directory hint', async () => {
  await expect(resolveLoginSettingsSessionConfig(slug, { ...hint, sessionId: `0x${'ff'.repeat(16)}` })).rejects.toThrow(
    /identity/i,
  );
  expect(upsertWorkerCanonicalSessionBootstrap).not.toHaveBeenCalled();
});

it('rejects a cached config whose identity differs from the directory hint', async () => {
  jest.mocked(getVerifiedWorkerCanonicalSessionBootstrap).mockReturnValueOnce(config);
  await expect(resolveLoginSettingsSessionConfig(slug, { ...hint, sessionId: `0x${'ff'.repeat(16)}` })).rejects.toThrow(
    /identity/i,
  );
  expect(fetchWorkerCanonicalSessionBootstrap).not.toHaveBeenCalled();
});
