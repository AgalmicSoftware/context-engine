// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/SessionRegistry.sol";
import "../../contracts/Surveys.sol";
import "../../contracts/SBTFactory.sol";

interface Vm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployAll {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SessionRegistry registry, Surveys surveys, SBTFactory sbtFactory) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        registry = new SessionRegistry();
        surveys = new Surveys();
        sbtFactory = new SBTFactory();
        vm.stopBroadcast();
    }
}
