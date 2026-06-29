// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/SessionRegistry.sol";
import "../../contracts/Surveys.sol";
import "../../contracts/SBTFactory.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function writeFile(string calldata path, string calldata data) external;
    function projectRoot() external view returns (string memory);
    function toString(address value) external pure returns (string memory);
    function toString(uint256 value) external pure returns (string memory);
}

contract DeployLocal {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        vm.startBroadcast();

        SessionRegistry sessionRegistry = new SessionRegistry();
        Surveys surveys = new Surveys();
        SBTFactory sbtFactory = new SBTFactory();

        vm.stopBroadcast();

        string memory outputPath = string.concat(
            vm.projectRoot(),
            "/client/src/variables/local-contracts.json"
        );
        string memory json = string(
            abi.encodePacked(
                "{\n",
                "  \"chainId\": ",
                vm.toString(block.chainid),
                ",\n",
                "  \"SessionRegistry\": \"",
                vm.toString(address(sessionRegistry)),
                "\",\n",
                "  \"Surveys\": \"",
                vm.toString(address(surveys)),
                "\",\n",
                "  \"SBTFactory\": \"",
                vm.toString(address(sbtFactory)),
                "\"\n",
                "}\n"
            )
        );

        vm.writeFile(outputPath, json);
    }
}
