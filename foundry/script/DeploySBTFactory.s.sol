// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/SBTFactory.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeploySBTFactory {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SBTFactory factory) {
        vm.startBroadcast();
        factory = new SBTFactory();
        vm.stopBroadcast();
    }
}
