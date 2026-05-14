// src/shims/metamask-delegation-utils.js
// Hoisted (function) exports so webpack can safely create re-export getters
// without hitting "Cannot access 'X' before initialization".
// a result of updating Web3Auth from v8 to v10


function notAvailable(name) {
  throw new Error(`'${name}' is unavailable in this build (delegation-utils shim).`);
}

// Export functions (hoisted), not consts
export function AllowedCalldataEnforcer() { return notAvailable('AllowedCalldataEnforcer'); }
export function AllowedAddressEnforcer() { return notAvailable('AllowedAddressEnforcer'); }
export function AllowedFunctionEnforcer() { return notAvailable('AllowedFunctionEnforcer'); }
export function AllowedAddressPairEnforcer() { return notAvailable('AllowedAddressPairEnforcer'); }
export function LimitedCallsEnforcer() { return notAvailable('LimitedCallsEnforcer'); }
export function AllowedTargetEnforcer() { return notAvailable('AllowedTargetEnforcer'); }

// If something does `new AllowedCalldataEnforcer()`, this will still throw,
// which is fine since AA isn’t used in your build.

// Default export (some packages import the module default)
const defaultExport = {};
export default defaultExport;
