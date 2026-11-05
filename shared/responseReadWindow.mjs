export const responsePairKey = (responder, id) =>
  `${String(responder || '').toLowerCase()}|${String(id || '').toLowerCase()}`;

// A scan may prove a pair unchanged from the end block up to unchangedBlockTag, which nodes that no longer hold the
// end block can still answer for. Latest could return an edit made after the scan. Without that proof, every pair
// uses the end block; a historical-read failure must never fall back to latest.
export const responseReadWindowOptions = (window, responder, id) => window
  ? {
      _responseReadWindow: window,
      blockTag: window.laterPairs && !window.laterPairs.has(responsePairKey(responder, id))
        ? window.unchangedBlockTag
        : window.blockTag,
    }
  : {};

export const historicalResponseReadError = (error, blockTag) => Object.assign(
  new Error(`Response state at block ${String(blockTag)} is unavailable: ${error instanceof Error ? error.message : String(error)}`),
  { code: 'RESPONSE_HISTORY_UNAVAILABLE', retryable: true, blockTag, cause: error },
);
