/**
 * @module contractWrites
 * @description Gas estimation and raw transaction submission helpers.
 *              Stateless — no module-level mutable state.
 *
 * Key exports: resolveTxGasOverrides, sendContractWriteViaProvider
 */

import { ethers } from 'ethers';
import { createLogger } from '../logging.js';
import { isExecutionRevertDuringEstimate, extractEstimateErrorMessage } from './errorClassifiers.js';

type AnyRecord = Record<string, any>;
type ResolveReceiptRevertMessageOptions = {
  contract?: AnyRecord | null;
  method?: string;
  args?: unknown[];
  txOverrides?: AnyRecord;
  from?: string;
  ethersProvider?: AnyRecord | null;
  txParams?: AnyRecord;
  receipt?: AnyRecord | null;
  fallbackMessage?: string;
};
type ResolveTxGasOverridesOptions = {
  contract?: AnyRecord | null;
  method?: string;
  args?: unknown[];
  existingOverrides?: AnyRecord;
  fallbackGasLimit?: unknown;
  minEstimate?: unknown;
  logLabel?: string;
  preferFallbackGasLimit?: boolean;
};
type SendContractWriteViaProviderOptions = {
  signingProvider?: AnyRecord | null;
  ethersProvider?: AnyRecord | null;
  signer?: AnyRecord | null;
  contract?: AnyRecord | null;
  method?: string;
  args?: unknown[];
  txOverrides?: AnyRecord;
  onBroadcastTxHash?: ((txHash: unknown) => unknown) | null;
  rpcFunction?: string;
  revertMessage?: string;
  sensitiveArgs?: boolean;
  resolveSensitiveErrorMessage?: ((error: unknown) => string | null | undefined) | null;
};

const contractsLog = createLogger('contracts');
const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const rpcLog = (...args: unknown[]): void => {
  rpcLogger.log(...args);
};
const logBroadcastCallbackFailure = (method: unknown, error: unknown): void => {
  contractsLog.warn(
    `[${method}] onBroadcastTxHash callback failed; continuing transaction wait`,
    extractEstimateErrorMessage(error),
  );
};

const resolveReceiptRevertMessage = async ({
  contract,
  method,
  args,
  txOverrides,
  from,
  ethersProvider,
  txParams,
  receipt,
  fallbackMessage,
}: ResolveReceiptRevertMessageOptions = {}): Promise<string> => {
  const methodName = String(method || '');
  const resolvedFallbackMessage = String(fallbackMessage || '');
  const staticCall = contract?.callStatic?.[methodName];
  if (typeof staticCall === 'function') {
    try {
      await staticCall(...(Array.isArray(args) ? args : []), {
        ...(txOverrides && typeof txOverrides === 'object' ? txOverrides : {}),
        from,
      });
      return resolvedFallbackMessage;
    } catch (error) {
      const reason = extractEstimateErrorMessage(error).trim();
      if (reason) {
        return reason;
      }
    }
  }

  if (!ethersProvider || typeof ethersProvider.call !== 'function') {
    return resolvedFallbackMessage;
  }

  const callTx = {
    from: txParams?.from,
    to: txParams?.to,
    data: txParams?.data,
    ...(txParams?.value != null ? { value: txParams.value } : {}),
  };

  try {
    await ethersProvider.call(callTx, receipt?.blockNumber ?? 'latest');
    return resolvedFallbackMessage;
  } catch (error) {
    const reason = extractEstimateErrorMessage(error).trim();
    return reason || resolvedFallbackMessage;
  }
};

const resolveTxGasOverrides = async ({
  contract,
  method,
  args = [],
  existingOverrides = {},
  fallbackGasLimit = '500000',
  minEstimate = '80000',
  logLabel = 'tx',
  preferFallbackGasLimit = false,
}: ResolveTxGasOverridesOptions = {}): Promise<AnyRecord> => {
  const methodName = String(method || '');
  const fallback = ethers.BigNumber.from(String(fallbackGasLimit));
  const min = ethers.BigNumber.from(String(minEstimate));
  const safeOverrides = existingOverrides && typeof existingOverrides === 'object' ? existingOverrides : {};
  let gasLimit = fallback;

  if (preferFallbackGasLimit) {
    return { ...safeOverrides, gasLimit };
  }

  try {
    const estimateFn = contract?.estimateGas?.[methodName];
    if (typeof estimateFn !== 'function') {
      throw new Error(`estimateGas.${methodName} unavailable`);
    }
    const estimate = await estimateFn(...args, safeOverrides);
    if (!estimate || estimate.lt(min)) {
      contractsLog.warn(
        `[${logLabel}] estimateGas too low; using fallback gasLimit`,
        estimate?.toString?.() || String(estimate),
        fallback.toString(),
      );
    } else {
      gasLimit = estimate.mul(120).div(100);
    }
  } catch (err) {
    if (isExecutionRevertDuringEstimate(err)) {
      throw err;
    }
    contractsLog.warn(
      `[${logLabel}] estimateGas failed; using fallback gasLimit`,
      fallback.toString(),
      extractEstimateErrorMessage(err),
    );
  }

  return { ...safeOverrides, gasLimit };
};

// Some wallet/RPC combinations return partially-populated transaction response
// objects (for example `null` fee fields), which makes ethers v5 fail while
// formatting the response before we ever get a tx hash. For signer writes that
// only need a hash + receipt, broadcast through raw `eth_sendTransaction`
// instead of relying on ethers' transaction response normalization.
const sendContractWriteViaProvider = async ({
  signingProvider,
  ethersProvider,
  signer,
  contract,
  method,
  args = [],
  txOverrides = {},
  onBroadcastTxHash,
  rpcFunction = method,
  revertMessage = `${method} transaction reverted on-chain.`,
  sensitiveArgs = false,
  resolveSensitiveErrorMessage = null,
}: SendContractWriteViaProviderOptions = {}): Promise<{ txHash: unknown; receipt: AnyRecord }> => {
  const methodName = String(method || '');
  if (!contract?.interface || typeof contract.interface.encodeFunctionData !== 'function') {
    throw new Error(`sendContractWriteViaProvider requires a contract interface for ${methodName}.`);
  }
  const to = contract?.address || contract?.target;
  if (!to) {
    throw new Error(`sendContractWriteViaProvider requires a contract address for ${methodName}.`);
  }
  if (!signer || typeof signer.getAddress !== 'function') {
    throw new Error(`sendContractWriteViaProvider requires a signer for ${methodName}.`);
  }

  const from = await signer.getAddress();
  const data = contract.interface.encodeFunctionData(methodName, args);
  const txParams: AnyRecord = {
    from,
    to,
    data,
  };

  const assignHexQuantity = (key: string, value: unknown): void => {
    if (value == null) return;
    txParams[key] = ethers.BigNumber.from(value).toHexString();
  };

  if (txOverrides?.gasLimit != null) {
    assignHexQuantity('gas', txOverrides.gasLimit);
  }
  if (txOverrides?.value != null) {
    assignHexQuantity('value', txOverrides.value);
  }
  assignHexQuantity('gasPrice', txOverrides?.gasPrice);
  assignHexQuantity('maxFeePerGas', txOverrides?.maxFeePerGas);
  assignHexQuantity('maxPriorityFeePerGas', txOverrides?.maxPriorityFeePerGas);
  assignHexQuantity('nonce', txOverrides?.nonce);

  rpcLog('RPC Call (Tx):', {
    function: rpcFunction,
    method: 'eth_sendTransaction',
    params: {
      from,
      to,
      calldataBytes: Math.max(0, (data.length - 2) / 2),
      hasValue: txParams.value != null,
      hasGasLimit: txParams.gas != null,
    },
  });

  const buildSensitiveWriteError = (error: unknown): Error => {
    if (typeof resolveSensitiveErrorMessage === 'function') {
      try {
        const resolvedMessage = String(resolveSensitiveErrorMessage(error) || '').trim();
        if (resolvedMessage) {
          return new Error(resolvedMessage);
        }
      } catch {
        // Fall through to the fixed message without exposing the resolver failure.
      }
    }
    return new Error(revertMessage);
  };

  let txHash;
  try {
    if (signingProvider && typeof signingProvider.request === 'function') {
      txHash = await signingProvider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
    } else if (ethersProvider && typeof ethersProvider.send === 'function') {
      txHash = await ethersProvider.send('eth_sendTransaction', [txParams]);
    } else {
      throw new Error('Connected wallet provider does not support eth_sendTransaction.');
    }
  } catch (error) {
    if (sensitiveArgs) {
      throw buildSensitiveWriteError(error);
    }
    throw error;
  }

  if (typeof onBroadcastTxHash === 'function') {
    try {
      const callbackResult = onBroadcastTxHash(txHash);
      const callbackPromise = callbackResult as { catch?: (onRejected: (error: unknown) => void) => unknown };
      if (callbackPromise && typeof callbackPromise.catch === 'function') {
        callbackPromise.catch((error: unknown) => {
          logBroadcastCallbackFailure(method, error);
        });
      }
    } catch (error) {
      logBroadcastCallbackFailure(method, error);
    }
  }

  if (!ethersProvider || typeof ethersProvider.waitForTransaction !== 'function') {
    throw new Error('Connected wallet provider does not support waiting for transaction receipts.');
  }
  let receipt: AnyRecord;
  try {
    receipt = (await ethersProvider.waitForTransaction(txHash)) as AnyRecord;
  } catch (error) {
    if (sensitiveArgs) {
      throw buildSensitiveWriteError(error);
    }
    throw error;
  }
  if (!receipt || (receipt.status !== undefined && receipt.status !== 1)) {
    const resolvedRevertMessage = sensitiveArgs
      ? revertMessage
      : await resolveReceiptRevertMessage({
          contract,
          method,
          args,
          txOverrides,
          from,
          ethersProvider,
          txParams,
          receipt,
          fallbackMessage: revertMessage,
        });
    throw new Error(resolvedRevertMessage);
  }
  return { txHash, receipt };
};

export { resolveTxGasOverrides, sendContractWriteViaProvider };
