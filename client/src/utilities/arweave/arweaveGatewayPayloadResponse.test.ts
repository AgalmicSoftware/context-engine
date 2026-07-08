import { classifyArweaveGatewayPayloadResponse } from './arweaveGatewayPayloadResponse';

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
