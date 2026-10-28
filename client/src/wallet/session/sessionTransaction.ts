import { ethers } from 'ethers';

const quantityFields = [
  'value',
  'gas',
  'gasLimit',
  'gasPrice',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'nonce',
  'chainId',
  'type',
] as const;

export const parseTransactionQuantity = (value: unknown, field: string): ethers.BigNumber | undefined => {
  if (value === undefined) return undefined;
  try {
    // isBigNumber accepts plain objects, including structured clones; require a real instance.
    const accepted =
      value instanceof ethers.BigNumber ||
      (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
      (typeof value === 'bigint' && value >= 0n) ||
      (typeof value === 'string' && /^(?:\d+|0x[0-9a-fA-F]+)$/.test(value));
    if (accepted) {
      const parsed = ethers.BigNumber.from(typeof value === 'number' ? String(value) : (value as ethers.BigNumberish));
      if (!parsed.isNegative()) return parsed;
    }
  } catch (_) {
    /* Report one stable field error for all invalid quantities. */
  }
  throw new Error(`Invalid transaction ${field}.`);
};

export const normalizeSessionTransaction = (
  input: unknown,
  method: string,
): ethers.providers.TransactionRequest & Record<string, unknown> => {
  const raw = (input || {}) as Record<string, unknown>;
  const tx: Record<string, unknown> =
    method === 'eth_signTransaction' ? { ...raw } : { from: raw.from, to: raw.to, data: raw.data };
  for (const field of quantityFields) {
    const value = parseTransactionQuantity(raw[field], field);
    if (value === undefined) continue;
    if (field === 'chainId' || field === 'type') {
      try {
        tx[field] = value.toNumber();
      } catch (_) {
        throw new Error(`Invalid transaction ${field}.`);
      }
    } else {
      tx[field] = ethers.utils.hexValue(value);
    }
  }
  if (tx.gas !== undefined) tx.gasLimit = tx.gas;
  delete tx.gas;
  return tx;
};
