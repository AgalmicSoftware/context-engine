// Vite aliases @metamask/superstruct to this file. Only @metamask/utils, pulled
// in through wagmi's Coinbase Wallet SDK, imports it; forward the named exports
// to the installed superstruct package.
export * from 'superstruct';
// Provide a harmless placeholder for 'Struct' if some builds import it at runtime
export const Struct = function () {};
const superstructDefault = {};
export default superstructDefault;
