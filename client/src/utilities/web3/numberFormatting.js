/**
 * @module numberFormatting
 * @description Thin ethers BigNumber formatting helpers shared by contractScripts.
 */

import { ethers } from 'ethers';
import { createLogger } from '../logging.js';

const contractsLog = createLogger('contracts');

export function decimalEighteen(coinAmount, callingFunc) {
  const coinAmountIsBN = ethers.BigNumber.isBigNumber(coinAmount);
  if (coinAmountIsBN) {
    return ethers.utils.formatEther(coinAmount);
  }
  else if (typeof coinAmount === 'string' || coinAmount instanceof String) {
    try { return ethers.utils.formatEther(coinAmount); } catch { /* ignore */ }
  }
  else if (typeof coinAmount === 'number' || coinAmount instanceof Number) {
    try { return ethers.utils.formatEther(coinAmount.toString()); } catch { /* ignore */ }
  }
  contractsLog.log('WRONG TYPE OF BIGNUMBER Passed to decimalEighteen()', coinAmount, 'from:', callingFunc);
  return '0.0';
}

export function toEighteenDecimals(coinAmount) {
  return ethers.utils.parseEther(coinAmount.toString());
}

export function getBigNumber(numString, callingFunc) {
  if (numString !== undefined) {
    try { return ethers.BigNumber.from(numString.toString()); } catch { /* ignore */ }
  }
  contractsLog.log('CHECK – getBigNumber() – undefined or invalid numString passed', numString, 'from:', callingFunc);
  return ethers.BigNumber.from(0);
}

export function objectIsBN(object) {
  return ethers.BigNumber.isBigNumber(object);
}

export function getJsNumberFromBN(BNObject, callingFunc) {
  const objectIsBigNumber = (
    this &&
    typeof this.objectIsBN === 'function'
  )
    ? this.objectIsBN(BNObject)
    : objectIsBN(BNObject);
  if (objectIsBigNumber) { try { return BNObject.toNumber(); } catch { /* ignore */ } }
  contractsLog.log('BAD BN VALUE Passed to getJsNumberFromBN()', BNObject, 'from:', callingFunc);
  return 0;
}

export async function timeout(delay) {
  return new Promise((res) => setTimeout(res, delay));
}
