import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { chainRequest, safeChainError } from './chainErrors.mjs';

const SECRET_RPC = 'https://rpc.example.invalid/v2/SYNTHETIC_RPC_SECRET_123';
const SIGNED_TX = '0x02f8feedfacecafe';
// ethers' own formatter, so the message quotes the URL and request like a live RPC failure.
const rpcFailure = (reason, code, fields = {}) => Object.assign(ethers.logger.makeError(reason, code, {
  requestBody: JSON.stringify({ method: 'eth_sendRawTransaction', params: [SIGNED_TX], id: 42, jsonrpc: '2.0' }), requestMethod: 'POST', url: SECRET_RPC,
}), fields);

test('read failures keep only the error code, an ethers summary, and retry advice', async () => {
  const error = await chainRequest(async () => { throw rpcFailure('missing response', ethers.errors.SERVER_ERROR); }).catch((caught) => caught);
  assert.equal(error.message, 'The chain request failed (SERVER_ERROR: missing response). Check the RPC connection and retry.');
  assert.deepEqual({ ...error }, { code: 'SERVER_ERROR', retryable: true });
});

test('contract reverts keep a checked reason and are not retryable', () => {
  const revert = Object.assign(ethers.logger.makeError('call revert exception', ethers.errors.CALL_EXCEPTION, { errorName: 'Error', reason: 'session not found' }),
    { transaction: { data: SIGNED_TX } });
  const error = safeChainError(revert);
  assert.equal(error.message, 'The contract rejected the request (CALL_EXCEPTION: session not found).');
  assert.deepEqual({ ...error }, { code: 'CALL_EXCEPTION', retryable: false });
});

test('submission failures keep a checked transaction hash and require reconciliation', () => {
  const transactionHash = ethers.utils.id('uncertain');
  const error = safeChainError(rpcFailure('processing response error', ethers.errors.SERVER_ERROR,
    { transactionHash, transaction: { hash: transactionHash, data: SIGNED_TX } }), { submission: true });
  assert.equal(error.message, `Transaction ${transactionHash} may have been submitted but its outcome is unknown (SERVER_ERROR: processing response error). Check the chain before retrying.`);
  assert.deepEqual({ ...error }, { code: 'SERVER_ERROR', reconciliationRequired: true, txHash: transactionHash });
});

test('unchecked codes, reasons, and hashes never pass through', () => {
  const forged = { code: `bad ${SECRET_RPC}`, reason: `denied for ${SECRET_RPC}`, errorName: 'x"y', transactionHash: SIGNED_TX };
  const submission = safeChainError(forged, { submission: true });
  assert.equal(submission.message, 'The transaction may have been submitted but its outcome is unknown. Check the chain before retrying.');
  assert.deepEqual({ ...submission }, { reconciliationRequired: true });
  const read = safeChainError(`url=${SECRET_RPC}`);
  assert.equal(read.message, 'The chain request failed. Check the RPC connection and retry.');
  assert.deepEqual({ ...read }, { retryable: true });
});
