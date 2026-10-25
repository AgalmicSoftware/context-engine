import { randomUUID } from 'node:crypto';
import { ethers } from 'ethers';
import { checkRegistryChain } from './registryChain.mjs';
import { arweaveIdToHex } from './registryPayloads.mjs';

const MAX_COST = ethers.utils.parseEther('0.005');
const stopped = (signal) => { if (signal?.aborted) throw new Error('Stopped before the chain transaction was sent.'); };

const transactionHashOf = (error) => [error?.transactionHash, error?.transaction?.hash, error?.receipt?.transactionHash]
  .find((value) => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value));

const chainRequest = async (request, { submission = false } = {}) => {
  try { return await request(); }
  catch (error) {
    // ethers messages can include a keyed RPC URL, signed transaction, or call
    // data. Preserve only the error code and a validated public transaction hash.
    const txHash = transactionHashOf(error);
    const code = typeof error?.code === 'string' && /^[A-Z_]{3,40}$/.test(error.code) ? ` (${error.code})` : '';
    const message = submission
      ? `${txHash ? `Transaction ${txHash}` : 'The transaction'} may have been submitted but its outcome is unknown${code}. Check the chain before retrying.`
      : `The chain request failed${code}. Check the RPC connection and retry.`;
    throw Object.assign(new Error(message), submission ? { reconciliationRequired: true, ...(txHash ? { txHash } : {}) } : {});
  }
};

export const createRegistryWriter = ({ provider, chainId, wallet, surveys, slug, remember }) => {
  const checkChain = () => checkRegistryChain({ send: (...args) => chainRequest(() => provider.send(...args)) }, chainId);
  const prepare = async ({ client, gasLimit, fund, signal }) => {
    stopped(signal);
    await checkChain();
    const gasPrice = await chainRequest(() => provider.getGasPrice());
    const cost = gasPrice.mul(gasLimit);
    if (cost.gt(MAX_COST)) throw new Error('This transaction would exceed the 0.005 ETH gas cap; retry when gas is cheaper.');
    let balance = await chainRequest(() => provider.getBalance(wallet.address));
    const shortfall = `Fund ${wallet.address} with test ETH on chain ${chainId}; this transaction needs up to ${ethers.utils.formatEther(cost)} ETH.`;
    let fundingNote = '';
    if (balance.lt(cost) && fund) {
      const offer = await client.describeTestEth();
      if (offer.offered && offer.tokenHasFaucetScope !== false) {
        let funding;
        try { funding = await fund(); }
        catch (error) { throw new Error(`${shortfall} ${String(error?.message || 'The faucet request failed.').slice(0, 250)}`); }
        if (funding?.sent) fundingNote = ` Faucet transaction ${funding.txHash} was sent; check it before requesting another payout.`;
        else if (funding?.reason === 'balance_high') fundingNote = ' The faucet refused because the balance is above its threshold.';
        balance = await chainRequest(() => provider.getBalance(wallet.address)).catch(() => null);
        if (!balance) throw new Error(`${shortfall}${fundingNote} The current balance could not be checked.`);
      }
    }
    if (balance.lt(cost)) throw new Error(`${shortfall}${fundingNote}`);
    await client.ensureToken();
    return { gasLimit, gasPrice };
  };

  const upload = async (client, resource, id, record, signal) => {
    stopped(signal);
    const result = await client.request('/arweave/upload', { method: 'POST', auth: true, body: {
      data: JSON.stringify(record), contentType: 'application/json', requestId: randomUUID(), sessionSlug: slug,
      tags: [{ name: 'CE-SessionSlug', value: slug }, { name: 'CE-Resource', value: resource }, { name: 'CE-ResourceId', value: id }],
    } });
    return arweaveIdToHex(result?.id);
  };

  const confirm = async (tx, eventName, ids) => {
    let receipt;
    let timer;
    try {
      receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('confirmation timeout')), 180000); }),
      ]);
    } catch { throw Object.assign(new Error(`Transaction ${tx.hash} was submitted but could not be confirmed. Check it before retrying.`), { txHash: tx.hash, reconciliationRequired: true }); }
    finally { clearTimeout(timer); }
    if (Number(receipt?.status) !== 1) throw new Error(`Transaction ${tx.hash} failed on chain.`);
    const confirmed = receipt.logs.some((log) => {
      if (log.address?.toLowerCase() !== surveys.address.toLowerCase()) return false;
      try {
        const parsed = surveys.interface.parseLog(log);
        const actor = parsed.args.responder || parsed.args.creator;
        return parsed.name === eventName && actor?.toLowerCase() === wallet.address.toLowerCase() &&
          parsed.args.questionIds.length === ids.length && parsed.args.questionIds.every((id, index) => id.toLowerCase() === ids[index].toLowerCase());
      } catch { return false; }
    });
    if (!confirmed) throw new Error(`Transaction ${tx.hash} did not contain the expected ${eventName} event.`);
    return receipt;
  };

  const submitAnswers = async ({ client, records, fund, signal }) => {
    if (!records.length || records.length > 25) throw new Error('Submit between 1 and 25 answers per call.');
    const fees = await prepare({ client, gasLimit: 200000 + 60000 * records.length, fund, signal });
    const ids = records.map((record) => record.questionID);
    const pointers = [];
    for (const record of records) pointers.push(await upload(client, 'responses', record.questionID, record, signal));
    stopped(signal);
    await checkChain();
    const tx = await chainRequest(() => surveys.connect(wallet.connect(provider)).submitResponses(ids, pointers, ethers.constants.HashZero, ethers.constants.HashZero, fees), { submission: true });
    const receipt = await confirm(tx, 'ResponsesSubmitted', ids);
    records.forEach((record, index) => remember('responses', record.questionID, record, pointers[index], receipt));
    return { txHash: tx.hash, receipt };
  };

  const addStatement = async ({ client, record, fund, signal }) => {
    await checkChain();
    if ((await chainRequest(() => surveys.questionHashes(record.id))) !== ethers.constants.HashZero) {
      throw new Error('This statement already exists on chain, possibly in another session; reword it to add a new statement.');
    }
    const fees = await prepare({ client, gasLimit: 400000, fund, signal });
    const pointer = await upload(client, 'questions', record.id, record, signal);
    stopped(signal);
    await checkChain();
    const tx = await chainRequest(() => surveys.connect(wallet.connect(provider)).addQuestions([record.id], [pointer], [ethers.constants.HashZero], fees), { submission: true });
    const receipt = await confirm(tx, 'QuestionsAdded', [record.id]);
    remember('questions', record.id, record, pointer, receipt);
    return { txHash: tx.hash };
  };
  return { submitAnswers, addStatement };
};
