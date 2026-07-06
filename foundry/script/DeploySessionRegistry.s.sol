// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/SessionRegistry.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeploySessionRegistry {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SessionRegistry registry) {
        vm.startBroadcast();
        registry = new SessionRegistry();
        vm.stopBroadcast();
    }
}
