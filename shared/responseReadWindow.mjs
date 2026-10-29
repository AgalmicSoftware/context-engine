export const responsePairKey = (responder, id) =>
  `${String(responder || '').toLowerCase()}|${String(id || '').toLowerCase()}`;

// A reader may prove unchanged pairs safe at latest. Without that proof, every
// pair uses the end block; a historical-read failure must never fall back to latest.
export const responseReadWindowOptions = (window, responder, id) => window
  ? {
      _responseReadWindow: window,
      ...(!window.laterPairs || window.laterPairs.has(responsePairKey(responder, id)) ? { blockTag: window.blockTag } : {}),
    }
  : {};

export const historicalResponseReadError = (error, blockTag) => Object.assign(
  new Error(`Response state at block ${String(blockTag)} is unavailable: ${error instanceof Error ? error.message : String(error)}`),
  { code: 'RESPONSE_HISTORY_UNAVAILABLE', retryable: true, blockTag, cause: error },
);
