export type ResponseReadWindow = { blockTag: number; laterPairs: Set<string> } | null;

export const responsePairKey = (responder: unknown, id: unknown): string =>
  `${String(responder || '').toLowerCase()}|${String(id || '').toLowerCase()}`;

export const responseReadWindowOptions = (
  window: ResponseReadWindow,
  responder: unknown,
  id: unknown,
): { _responseReadWindow?: ResponseReadWindow; blockTag?: number } =>
  window
    ? {
        _responseReadWindow: window,
        ...(window.laterPairs.has(responsePairKey(responder, id)) ? { blockTag: window.blockTag } : {}),
      }
    : {};

export const historicalResponseReadError = (error: unknown, blockTag: unknown): Error =>
  Object.assign(
    new Error(
      `Response state at block ${String(blockTag)} is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    ),
    {
      code: 'RESPONSE_HISTORY_UNAVAILABLE',
      retryable: true,
      blockTag,
      cause: error,
    },
  );
