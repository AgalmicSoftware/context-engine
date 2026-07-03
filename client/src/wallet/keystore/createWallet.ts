import { Wallet } from 'ethers';
import type { HexString } from '../types.js';

export const createRandomEoaPrivateKey = (): HexString => Wallet.createRandom().privateKey as HexString;

export const getAddressForPrivateKey = (privateKey: HexString): HexString => (
  new Wallet(privateKey).address as HexString
);
