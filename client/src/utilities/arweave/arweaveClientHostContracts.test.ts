import { buildArweaveUploadFallbackTelemetryEntry } from './arweaveClientHostContracts.js';

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
});
