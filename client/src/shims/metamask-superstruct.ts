// Forward all named exports from the real library
// a result of updating Web3Auth from v8 to v10
export * from 'superstruct';
// Provide a harmless placeholder for 'Struct' if some builds import it at runtime
export const Struct = function () {};
const superstructDefault = {};
export default superstructDefault;
