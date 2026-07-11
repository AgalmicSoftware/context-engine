import { getEffectiveArweaveKey } from '../session/resourceKeys.js';
import { getSessionConfigBySlugOrDefault } from '../web3/sessionConfigResolvers.js';
import { resolveArweaveUploadOpts } from './arweaveUploadHelpers';

jest.mock('../session/resourceKeys.js', () => ({
  getEffectiveArweaveKey: jest.fn(),
}));

jest.mock('../web3/sessionConfigResolvers.js', () => ({
  getSessionConfigBySlugOrDefault: jest.fn(),
  normalizeSessionSlug: jest.fn((value) => String(value || '').trim()),
}));

const mockedGetEffectiveArweaveKey = jest.mocked(getEffectiveArweaveKey);
const mockedGetSessionConfig = jest.mocked(getSessionConfigBySlugOrDefault);

describe('arweaveUploadHelpers targeted session refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetEffectiveArweaveKey.mockResolvedValue({
      arweaveJwk: '',
      source: 'session',
      sessionConfigSource: 'registry',
      status: 'worker',
      preferLocal: false,
      sessionStatus: 'worker',
      groupStatus: 'worker',
      localStatus: 'missing',
    });
  });

  it('refreshes a string-selected session before choosing its upload worker config', async () => {
    const staleConfig = { slug: 'demo-1', networkChainId: 11155420 };
    const refreshedConfig = {
      ...staleConfig,
      corsWorkerUrl: 'https://demo-1-worker.example.test',
      sponsoredKeys: { arweave: true },
    };
    mockedGetSessionConfig.mockReturnValue(staleConfig);
    const refreshSessionConfig = jest.fn(async () => refreshedConfig);

    const result = await resolveArweaveUploadOpts('demo-1', {
      providerLike: { request: jest.fn() },
      refreshSessionConfig,
    });

    expect(refreshSessionConfig).toHaveBeenCalledWith({
      slug: 'demo-1',
      sessionConfig: staleConfig,
      providerLike: expect.any(Object),
    });
    expect(result.sessionConfig).toBe(refreshedConfig);
    expect(mockedGetEffectiveArweaveKey).toHaveBeenCalledWith({
      sessionSlug: 'demo-1',
      sessionConfig: refreshedConfig,
    });
  });
});
