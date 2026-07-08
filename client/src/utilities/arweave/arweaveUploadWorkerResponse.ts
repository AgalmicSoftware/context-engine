export interface ArweaveUploadResponseParseDetails {
  status: number | null;
  bodyPreview: string;
}

export interface ArweaveUploadResponseLogger {
  warn?: (message: string, details: ArweaveUploadResponseParseDetails) => void;
  error?: (message: string, details: ArweaveUploadResponseParseDetails) => void;
}

export type ArweaveUploadWorkerPayload = Record<string, unknown>;

export const readWorkerUploadResponseBodyPreview = async (
  response: Pick<Response, 'text'> | null | undefined,
): Promise<string> => {
  if (!response || typeof response.text !== 'function') return '';
  try {
    return String(await response.text()).slice(0, 200);
  } catch {
    return '';
  }
};

export const parseWorkerUploadResponseJson = async (
  response: Response,
  logger: ArweaveUploadResponseLogger = {},
): Promise<ArweaveUploadWorkerPayload> => {
  let previewResponse: Response | Pick<Response, 'text'> | null = null;
  try {
    previewResponse = typeof response?.clone === 'function' ? response.clone() : response;
  } catch {
    previewResponse = response;
  }

  try {
    return (await response.json()) as ArweaveUploadWorkerPayload;
  } catch {
    const details = {
      status: Number(response?.status || 0) || null,
      bodyPreview: await readWorkerUploadResponseBodyPreview(previewResponse),
    };
    if (!response?.ok) {
      logger.warn?.('arweave upload response parse failed', details);
      return {};
    }
    logger.error?.('arweave upload response parse failed', details);
    throw new Error('arweave upload response malformed');
  }
};
