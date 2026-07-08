import { parseWorkerUploadResponseJson, readWorkerUploadResponseBodyPreview } from './arweaveUploadWorkerResponse.js';

const makeResponse = (overrides: Partial<Response>): Response => overrides as Response;

describe('arweaveUploadWorkerResponse', () => {
  it('returns parsed worker upload JSON payloads', async () => {
    const response = makeResponse({
      ok: true,
      status: 200,
      clone: jest.fn(),
      json: jest.fn().mockResolvedValue({ id: 'abc123' }),
    });

    await expect(parseWorkerUploadResponseJson(response)).resolves.toEqual({ id: 'abc123' });
  });

  it('returns an empty payload and warns for malformed non-ok responses', async () => {
    const logger = { warn: jest.fn(), error: jest.fn() };
    const preview = `${'x'.repeat(210)}tail`;
    const response = makeResponse({
      ok: false,
      status: 502,
      clone: jest.fn(() => makeResponse({ text: jest.fn().mockResolvedValue(preview) })),
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    });

    await expect(parseWorkerUploadResponseJson(response, logger)).resolves.toEqual({});
    expect(logger.warn).toHaveBeenCalledWith('arweave upload response parse failed', {
      status: 502,
      bodyPreview: 'x'.repeat(200),
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws and logs an error for malformed ok responses', async () => {
    const logger = { warn: jest.fn(), error: jest.fn() };
    const response = makeResponse({
      ok: true,
      status: 200,
      clone: jest.fn(() => makeResponse({ text: jest.fn().mockResolvedValue('not-json') })),
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    });

    await expect(parseWorkerUploadResponseJson(response, logger)).rejects.toThrow('arweave upload response malformed');
    expect(logger.error).toHaveBeenCalledWith('arweave upload response parse failed', {
      status: 200,
      bodyPreview: 'not-json',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to an empty preview when response text cannot be read', async () => {
    const response = makeResponse({
      text: jest.fn().mockRejectedValue(new Error('body unavailable')),
    });

    await expect(readWorkerUploadResponseBodyPreview(response)).resolves.toBe('');
  });
});
