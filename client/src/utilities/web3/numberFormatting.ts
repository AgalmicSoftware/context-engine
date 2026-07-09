/**
 * @module numberFormatting
 * @description Thin ethers BigNumber formatting helpers shared by contractScripts.
 */

import { ethers } from 'ethers';
import { createLogger } from '../logging.js';

const contractsLog = createLogger('contracts');
type BigNumberLike = ReturnType<typeof ethers.BigNumber.from>;
type BigNumberFormattingContext = {
  objectIsBN?: (value: unknown) => boolean;
};

export function decimalEighteen(coinAmount: unknown, callingFunc?: unknown): string {
  const coinAmountIsBN = ethers.BigNumber.isBigNumber(coinAmount);
  if (coinAmountIsBN) {
    return ethers.utils.formatEther(coinAmount);
  } else if (typeof coinAmount === 'string' || coinAmount instanceof String) {
    try {
      return ethers.utils.formatEther(String(coinAmount));
    } catch {
      /* ignore */
    }
  } else if (typeof coinAmount === 'number' || coinAmount instanceof Number) {
    try {
      return ethers.utils.formatEther(String(coinAmount));
    } catch {
      /* ignore */
    }
  }
  contractsLog.log('WRONG TYPE OF BIGNUMBER Passed to decimalEighteen()', coinAmount, 'from:', callingFunc);
  return '0.0';
}

export function toEighteenDecimals(coinAmount: unknown): ReturnType<typeof ethers.utils.parseEther> {
  return ethers.utils.parseEther(String(coinAmount));
}

export function getBigNumber(numString: unknown, callingFunc?: unknown): ReturnType<typeof ethers.BigNumber.from> {
  if (numString != null) {
    try {
      return ethers.BigNumber.from(String(numString));
    } catch {
      /* ignore */
    }
  }
  contractsLog.log('CHECK – getBigNumber() – undefined or invalid numString passed', numString, 'from:', callingFunc);
  return ethers.BigNumber.from(0);
}

export function objectIsBN(object: unknown): boolean {
  return ethers.BigNumber.isBigNumber(object);
}

export function getJsNumberFromBN(
  this: BigNumberFormattingContext | undefined,
  BNObject: unknown,
  callingFunc?: unknown,
): number {
  const objectIsBigNumber =
    this && typeof this.objectIsBN === 'function' ? this.objectIsBN(BNObject) : objectIsBN(BNObject);
  if (objectIsBigNumber) {
    try {
      return (BNObject as BigNumberLike).toNumber();
    } catch {
      /* ignore */
    }
  }
  contractsLog.log('BAD BN VALUE Passed to getJsNumberFromBN()', BNObject, 'from:', callingFunc);
  return 0;
}

export async function timeout(delay: number): Promise<void> {
  return new Promise((res) => setTimeout(res, delay));
}
