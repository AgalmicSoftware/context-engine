import { buildUploadSessionCandidates } from './arweaveUploadCandidates';
import { resolveCorsProxyUrl } from '../worker/corsProxy.js';
import { readSessionScanSlugs } from '../session/sessionScanScope.js';
import { readSponsoredBootstrapFundingContext } from '../session/sponsoredBootstrapFunding.js';
import { getSharedFallbackWorkerUrl } from '../session/sessionWorkerAvailability.js';

jest.mock('../worker/corsProxy.js', () => ({
  resolveCorsProxyUrl: jest.fn(),
}));

jest.mock('../worker/workerSessionResolution.js', () => ({
  defaultStrictAllowDemoFallback: jest.fn(() => false),
}));

jest.mock('../session/sessionScanScope.js', () => ({
  readSessionScanSlugs: jest.fn(),
}));

jest.mock('../session/sponsoredBootstrapFunding.js', () => ({
  readSponsoredBootstrapFundingContext: jest.fn(),
}));

jest.mock('../session/sessionWorkerAvailability.js', () => ({
  getSharedFallbackWorkerUrl: jest.fn(),
}));

const mockedResolveCorsProxyUrl = jest.mocked(resolveCorsProxyUrl);
const mockedReadSessionScanSlugs = jest.mocked(readSessionScanSlugs);
const mockedReadSponsoredBootstrapFundingContext = jest.mocked(readSponsoredBootstrapFundingContext);
const mockedGetSharedFallbackWorkerUrl = jest.mocked(getSharedFallbackWorkerUrl);

describe('arweaveUploadCandidates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedReadSessionScanSlugs.mockReturnValue([]);
    mockedReadSponsoredBootstrapFundingContext.mockReturnValue(null);
    mockedGetSharedFallbackWorkerUrl.mockReturnValue('');
  });

  it('keeps the selected explicit worker as the first upload candidate', async () => {
    const candidates = await buildUploadSessionCandidates({
      selectedSessionSlug: ' session-one ',
      initialWorkerUrl: 'https://worker.example/root/',
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        reason: 'selected-session',
        sessionSlug: 'session-one',
        workerUrl: 'https://worker.example/root',
      }),
    ]);
    expect(mockedResolveCorsProxyUrl).not.toHaveBeenCalled();
  });

  it('adds sponsored and shared fallback workers while preserving selected-session priority', async () => {
    mockedReadSponsoredBootstrapFundingContext.mockReturnValue({
      sessionSlug: 'sponsored-session',
      targetSessionSlug: 'selected-session',
      workerUrl: 'https://sponsored.example',
    });
    mockedGetSharedFallbackWorkerUrl.mockReturnValue('https://shared.example/');

    const candidates = await buildUploadSessionCandidates({
      selectedSessionSlug: 'selected-session',
      initialWorkerUrl: 'https://selected.example',
    });

    expect(candidates.map((candidate) => candidate.reason)).toEqual([
      'selected-session',
      'sponsored-referrer',
      'shared-fallback',
    ]);
    expect(candidates.map((candidate) => candidate.workerUrl)).toEqual([
      'https://selected.example',
      'https://sponsored.example',
      'https://shared.example',
    ]);
  });

  it('resolves scoped workers and ignores sponsored context for a different selected slug', async () => {
    mockedReadSessionScanSlugs.mockReturnValue(['scope-one']);
    mockedReadSponsoredBootstrapFundingContext.mockReturnValue({
      sessionSlug: 'sponsored-session',
      targetSessionSlug: 'other-session',
      workerUrl: 'https://sponsored.example',
    });
    mockedResolveCorsProxyUrl.mockResolvedValue({
      url: 'https://scope-worker.example/',
      session: {
        resources: {
          arweave: {
            enabled: true,
          },
        },
      },
    });

    const candidates = await buildUploadSessionCandidates({
      selectedSessionSlug: 'selected-session',
      context: { requestId: 'req-1' },
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        reason: 'selected-session',
        sessionSlug: 'selected-session',
        workerUrl: 'https://scope-worker.example',
      }),
      expect.objectContaining({
        reason: 'scope-list',
        sessionSlug: 'scope-one',
        workerUrl: 'https://scope-worker.example',
      }),
    ]);
    expect(mockedResolveCorsProxyUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        allowDemoFallback: false,
        context: { requestId: 'req-1' },
        sessionSlug: 'selected-session',
      }),
    );
    expect(mockedResolveCorsProxyUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        allowDemoFallback: false,
        context: { requestId: 'req-1' },
        sessionSlug: 'scope-one',
      }),
    );
  });
});
