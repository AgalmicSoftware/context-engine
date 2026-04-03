// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function addr(uint256 privateKey) external view returns (address);
    function prank(address sender) external;
    function deal(address account, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory entries);
    function expectRevert() external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
}

abstract contract TestUtils {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(bytes32 a, bytes32 b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(address a, address b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertTrue(bool value, string memory message) internal pure {
        require(value, message);
    }

    function assertFalse(bool value, string memory message) internal pure {
        require(!value, message);
    }
}
