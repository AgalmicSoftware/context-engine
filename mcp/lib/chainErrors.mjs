// ethers errors quote the RPC URL (which may carry an API key), request
// bodies, and signed transactions or call data in their messages and fields.
// Chain failures leave this module rebuilt from checked public parts only.

const SAFE_CODE = /^[A-Z_]{3,40}$/;
const SAFE_REASON = /^[A-Za-z][\w .,'()-]{0,119}$/;
const TX_HASH = /^0x[0-9a-f]{64}$/i;

export const safeErrorCode = (error) => (typeof error?.code === 'string' && SAFE_CODE.test(error.code) ? error.code : '');

/** A short revert reason or ethers summary; never a URL, payload, or quotation. */
export const safeErrorReason = (error) =>
  [error?.reason, error?.errorName, error?.error?.reason]
    .map((value) => (typeof value === 'string' ? value.replace(/^execution reverted:?\s*/i, '').trim() : ''))
    .find((value) => SAFE_REASON.test(value)) || '';

const transactionHashOf = (error) => [error?.transactionHash, error?.transaction?.hash, error?.receipt?.transactionHash]
  .find((value) => typeof value === 'string' && TX_HASH.test(value));

export const safeChainError = (error, { submission = false } = {}) => {
  const code = safeErrorCode(error);
  const detail = [code, safeErrorReason(error)].filter(Boolean).join(': ');
  const note = detail ? ` (${detail})` : '';
  if (submission) {
    const txHash = transactionHashOf(error);
    return Object.assign(new Error(`${txHash ? `Transaction ${txHash}` : 'The transaction'} may have been submitted but its outcome is unknown${note}. Check the chain before retrying.`),
      { ...(code ? { code } : {}), reconciliationRequired: true, ...(txHash ? { txHash } : {}) });
  }
  // A revert is the contract's answer, so repeating the call will not change it.
  const retryable = code !== 'CALL_EXCEPTION';
  return Object.assign(new Error(retryable ? `The chain request failed${note}. Check the RPC connection and retry.` : `The contract rejected the request${note}.`),
    { ...(code ? { code } : {}), retryable });
};

export const chainRequest = async (request, options) => {
  try { return await request(); }
  catch (error) { throw safeChainError(error, options); }
};
