import { readPublicEnv } from '../../variables/publicEnv.js';

type TerminologyDictionary = Record<string, string>;
type TerminologyMode = 'crypto' | 'plain';

export const DICTIONARIES = Object.freeze({
  crypto: Object.freeze({
    sbt: 'SBT',
    sbtLower: 'SBT',
    sbts: 'SBTs',
    sbtsLower: 'SBTs',
    sbtFull: 'Soulbound Token',
    sbtFullLower: 'soulbound token',
    mint: 'Mint',
    mintLower: 'mint',
    minting: 'Minting',
    mintingLower: 'minting',
    minted: 'Minted',
    mintedLower: 'minted',
    burn: 'Burn',
    burnLower: 'burn',
    burned: 'Burned',
    burnedLower: 'burned',
    gate: 'Gate',
    gateLower: 'gate',
    gates: 'Gates',
    gatesLower: 'gates',
    gated: 'Gated',
    gatedLower: 'gated',
    wallet: 'Wallet',
    walletLower: 'wallet',
    wallets: 'Wallets',
    walletsLower: 'wallets',
    onChain: 'On-chain',
    onChainLower: 'on-chain',
    transaction: 'Transaction',
    transactionLower: 'transaction',
    gas: 'Gas',
    gasLower: 'gas',
    tokenUri: 'Token URI',
    tokenUriLower: 'token URI',
  }),
  plain: Object.freeze({
    sbt: 'Group',
    sbtLower: 'group',
    sbts: 'Groups',
    sbtsLower: 'groups',
    sbtFull: 'Digital Group',
    sbtFullLower: 'group',
    mint: 'Collect',
    mintLower: 'collect',
    minting: 'Collecting',
    mintingLower: 'collecting',
    minted: 'Collected',
    mintedLower: 'collected',
    burn: 'Remove',
    burnLower: 'remove',
    burned: 'Removed',
    burnedLower: 'removed',
    gate: 'Access Rule',
    gateLower: 'access rule',
    gates: 'Access Rules',
    gatesLower: 'access rules',
    gated: 'Restricted',
    gatedLower: 'restricted',
    wallet: 'Account',
    walletLower: 'account',
    wallets: 'Accounts',
    walletsLower: 'accounts',
    onChain: 'Verified',
    onChainLower: 'verified',
    transaction: 'Action',
    transactionLower: 'action',
    gas: 'Transaction fee',
    gasLower: 'transaction fee',
    tokenUri: 'Metadata Link',
    tokenUriLower: 'metadata link',
  }),
});

const MODE: TerminologyMode = (() => {
  const raw = readPublicEnv('REACT_APP_TERMINOLOGY_MODE', 'plain');
  const normalized = String(raw || '').trim().toLowerCase();
  return normalized === 'crypto' ? 'crypto' : 'plain';
})();

export const sbtBasePath = () => (MODE === 'crypto' ? '/sbt' : '/group');

export const sbtsListPath = () => (MODE === 'crypto' ? '/sbts' : '/groups');

export const isCryptoMode = () => MODE === 'crypto';

export const t = (key: unknown): string => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return '';

  const dictionary = (DICTIONARIES[MODE] || DICTIONARIES.plain) as TerminologyDictionary;
  return dictionary[normalizedKey] || (DICTIONARIES.crypto as TerminologyDictionary)[normalizedKey] || normalizedKey;
};
