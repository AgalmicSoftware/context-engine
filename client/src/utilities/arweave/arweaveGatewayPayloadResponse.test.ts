import { buildArweaveGatewayHttpFailure, classifyArweaveGatewayPayloadResponse } from './arweaveGatewayPayloadResponse';

describe('classifyArweaveGatewayPayloadResponse', () => {
  it('keeps non-empty non-html gateway text as a usable payload', () => {
    expect(
      classifyArweaveGatewayPayloadResponse({
        text: '{"ok":true}',
        contentType: 'application/json',
        txId: 'tx123',
        gateway: 'https://arweave.net',
        attempt: 2,
      }),
    ).toEqual({
      ok: true,
      text: '{"ok":true}',
    });
  });

  it('classifies blank gateway bodies as retryable network errors', () => {
    const result = classifyArweaveGatewayPayloadResponse({
      text: '   ',
      txId: 'tx-empty',
      gateway: 'https://arweave.net',
      attempt: 3,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'empty',
        status: null,
        statusKind: 'network',
        retryable: true,
      }),
    );
    if (!result.ok) {
      expect(result.error.name).toBe('ArweaveFetchError');
      expect(result.error.message).toBe('Arweave gateway returned empty response body.');
      expect(result.error.txId).toBe('tx-empty');
      expect(result.error.gateway).toBe('https://arweave.net');
      expect(result.error.attempt).toBe(3);
      expect(result.error.kind).toBe('network');
      expect(result.error.retryable).toBe(true);
      expect(result.error.status).toBe(0);
    }
  });

  it('turns HTML status payloads into typed fetch errors', () => {
    const result = classifyArweaveGatewayPayloadResponse({
      text: '<!doctype html><title>429 Too Many Requests</title>',
      contentType: 'text/html; charset=utf-8',
      txId: 'tx-rate',
      gateway: 'https://arweave.net',
      attempt: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'html-status',
        status: 429,
        statusKind: 'rate_limited',
        retryable: true,
      }),
    );
    if (!result.ok) {
      expect(result.error.name).toBe('ArweaveFetchError');
      expect(result.error.message).toBe('Arweave gateway returned HTML payload (429)');
      expect(result.error.txId).toBe('tx-rate');
      expect(result.error.gateway).toBe('https://arweave.net');
      expect(result.error.attempt).toBe(1);
      expect(result.error.kind).toBe('rate_limited');
      expect(result.error.retryable).toBe(true);
      expect(result.error.status).toBe(429);
    }
  });
});

describe('buildArweaveGatewayHttpFailure', () => {
  it('builds non-retryable not-found errors for 404 gateway misses', () => {
    const failure = buildArweaveGatewayHttpFailure({
      status: 404,
      txId: 'tx-missing',
      gateway: 'https://arweave.net',
      attempt: 2,
    });

    expect(failure).toEqual(
      expect.objectContaining({
        status: 404,
        statusKind: 'not_found',
        retryable: false,
      }),
    );
    expect(failure.error.name).toBe('ArweaveFetchError');
    expect(failure.error.message).toBe('Arweave fetch failed (404)');
    expect(failure.error.txId).toBe('tx-missing');
    expect(failure.error.gateway).toBe('https://arweave.net');
    expect(failure.error.attempt).toBe(2);
    expect(failure.error.kind).toBe('not_found');
    expect(failure.error.retryable).toBe(false);
    expect(failure.error.status).toBe(404);
  });

  it('builds retryable server errors for 503 gateway misses', () => {
    const failure = buildArweaveGatewayHttpFailure({
      status: 503,
      txId: 'tx-pending',
      gateway: 'wayfinder',
      attempt: 0,
    });

    expect(failure).toEqual(
      expect.objectContaining({
        status: 503,
        statusKind: 'server',
        retryable: true,
      }),
    );
    expect(failure.error.message).toBe('Arweave fetch failed (503)');
    expect(failure.error.kind).toBe('server');
    expect(failure.error.retryable).toBe(true);
    expect(failure.error.status).toBe(503);
  });

  it('builds unknown non-retryable errors when no status is available', () => {
    const failure = buildArweaveGatewayHttpFailure({
      txId: 'tx-unknown',
      gateway: 'wayfinder',
      attempt: 1,
    });

    expect(failure).toEqual(
      expect.objectContaining({
        status: null,
        statusKind: 'unknown',
        retryable: false,
      }),
    );
    expect(failure.error.message).toBe('Arweave fetch failed (unknown)');
    expect(failure.error.status).toBe(0);
    expect(failure.error.kind).toBe('unknown');
    expect(failure.error.retryable).toBe(false);
  });
});
