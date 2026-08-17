import {
  buildArweaveUploadFallbackTelemetryEntry,
  type ArweaveClientApi,
  type ArweaveFailureCacheRecord,
  type ArweaveUploadAttemptInput,
} from './arweaveClientHostContracts.js';

describe('arweaveClientHostContracts', () => {
  it('builds timestamped fallback telemetry without mutating the payload', () => {
    const payload = {
      requestId: 'request-1',
      responseStatus: 503,
      attemptIndex: 2,
    };

    const entry = buildArweaveUploadFallbackTelemetryEntry(payload, () => new Date('2026-07-09T12:00:00.000Z'));

    expect(entry).toEqual({
      ts: '2026-07-09T12:00:00.000Z',
      requestId: 'request-1',
      responseStatus: 503,
      attemptIndex: 2,
    });
    expect(payload).toEqual({
      requestId: 'request-1',
      responseStatus: 503,
      attemptIndex: 2,
    });
  });

  it('normalizes primitive fallback payloads into a value field', () => {
    expect(buildArweaveUploadFallbackTelemetryEntry('network unavailable', () => new Date(0))).toEqual({
      ts: '1970-01-01T00:00:00.000Z',
      value: 'network unavailable',
    });
  });

  it('keeps the host attempt, failure-cache, and public API contracts compilable', () => {
    const attempt = {
      candidate: {
        allowsArweaveUpload: true,
        gateStatus: 'open',
        hasSponsoredArweaveKey: true,
        order: 0,
        preferenceRank: 0,
        reason: 'selected-session',
        sessionConfig: null,
        sessionSlug: 'general',
        workerUrl: 'https://worker.example',
      },
      buildRequestInit: () => ({ method: 'POST' }),
      attemptIndex: 0,
    } satisfies ArweaveUploadAttemptInput;
    const failure = {
      attempts: 1,
      nextRetryAtMs: 100,
      status: 503,
    } satisfies ArweaveFailureCacheRecord;
    const apiKeys = ['uploadDataToArweave', 'downloadDataFromArweave', 'checkTxExists'] satisfies Array<
      keyof ArweaveClientApi
    >;

    expect(attempt.candidate.sessionSlug).toBe('general');
    expect(failure.status).toBe(503);
    expect(apiKeys).toHaveLength(3);
  });
});
