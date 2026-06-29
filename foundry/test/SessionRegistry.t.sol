// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/SessionRegistry.sol";

contract SessionRegistryTest is TestUtils {
    SessionRegistry private registry;
    address private admin;
    address private other;
    uint256 private constant FEE = 0.0001 ether;

    receive() external payable {}

    function setUp() public {
        registry = new SessionRegistry();
        admin = address(0xA11CE);
        other = address(0xBEEF);
        vm.deal(admin, 100 ether);
        vm.deal(other, 100 ether);
    }

    function buildFields() internal pure returns (SessionRegistry.SessionFieldInput[] memory) {
        SessionRegistry.SessionFieldInput[] memory fields = new SessionRegistry.SessionFieldInput[](2);
        fields[0] = SessionRegistry.SessionFieldInput({
            key: "corsWorkerUrl",
            value: "https://example.workers.dev"
        });
        fields[1] = SessionRegistry.SessionFieldInput({
            key: "sponsored_ai",
            value: "1"
        });
        return fields;
    }

    function buildGates() internal pure returns (SessionRegistry.ResourceGateInput[] memory) {
        SessionRegistry.ResourceGateInput[] memory gates = new SessionRegistry.ResourceGateInput[](1);
        address[] memory sbts = new address[](1);
        sbts[0] = address(0xCAFE);
        gates[0] = SessionRegistry.ResourceGateInput({
            resourceKey: "ai",
            sbtAddresses: sbts,
            chainId: 84532,
            mode: 0,
            perMemberLimit: 5
        });
        return gates;
    }

    function testCreateSessionStoresData() public {
        SessionRegistry.SessionFieldInput[] memory fields = buildFields();
        SessionRegistry.ResourceGateInput[] memory gates = buildGates();
        bytes16 sessionId = bytes16(keccak256("session-1"));

        vm.prank(admin);
        registry.createSession{value: FEE}(
            "test-18",
            sessionId,
            84532,
            "ar://txid",
            ""
        );

        vm.prank(admin);
        string[] memory fieldKeys = new string[](fields.length);
        string[] memory fieldValues = new string[](fields.length);
        for (uint256 i = 0; i < fields.length; i++) {
            fieldKeys[i] = fields[i].key;
            fieldValues[i] = fields[i].value;
        }
        registry.setSessionFields("test-18", fieldKeys, fieldValues);

        vm.prank(admin);
        registry.setResourceGates("test-18", gates);

        (
            string memory slug,
            uint256 chainId,
            string memory metadataURI,
            string memory encryptedMetadataURI,
            address adminAddr,
            uint256 createdAt,
            uint256 updatedAt,
            bytes16 loadedSessionId
        ) = registry.getSessionBySlug("test-18");

        assertEq(keccak256(bytes(slug)), keccak256(bytes("test-18")), "slug mismatch");
        assertEq(chainId, 84532, "chainId mismatch");
        assertEq(keccak256(bytes(metadataURI)), keccak256(bytes("ar://txid")), "metadataURI mismatch");
        assertEq(keccak256(bytes(encryptedMetadataURI)), keccak256(bytes("")), "encryptedURI mismatch");
        assertEq(adminAddr, admin, "admin mismatch");
        assertTrue(createdAt > 0, "createdAt missing");
        assertTrue(updatedAt >= createdAt, "updatedAt invalid");
        assertEq(bytes32(loadedSessionId), bytes32(sessionId), "sessionId mismatch");

        string memory fieldValue = registry.getSessionField("test-18", "corsWorkerUrl");
        assertEq(keccak256(bytes(fieldValue)), keccak256(bytes("https://example.workers.dev")), "field mismatch");

        (address[] memory sbtAddresses, uint256 gateChainId, uint8 mode, uint256 limit) =
            registry.getResourceGate("test-18", "ai");
        assertEq(sbtAddresses.length, 1, "sbt length mismatch");
        assertEq(sbtAddresses[0], address(0xCAFE), "sbt mismatch");
        assertEq(gateChainId, 84532, "gate chain mismatch");
        assertEq(mode, 0, "gate mode mismatch");
        assertEq(limit, 5, "gate limit mismatch");
    }

    function testCreateSessionRevertsWhenSlugExists() public {
        bytes16 sessionId = bytes16(keccak256("session-dup"));
        vm.prank(admin);
        registry.createSession{value: FEE}(
            "dup",
            sessionId,
            84532,
            "ar://txid",
            ""
        );

        vm.prank(admin);
        (bool ok,) = address(registry).call{value: FEE}(
            abi.encodeWithSelector(
                registry.createSession.selector,
                "dup",
                bytes16(keccak256("session-dup-2")),
                84532,
                "ar://txid",
                ""
            )
        );
        assertFalse(ok, "expected revert on duplicate slug");
    }

    function testCreateSessionRevertsWhenSessionIdExists() public {
        bytes16 sessionId = bytes16(keccak256("session-dup-id"));
        vm.prank(admin);
        registry.createSession{value: FEE}(
            "dup-id-1",
            sessionId,
            84532,
            "ar://txid",
            ""
        );

        vm.prank(admin);
        (bool ok,) = address(registry).call{value: FEE}(
            abi.encodeWithSelector(
                registry.createSession.selector,
                "dup-id-2",
                sessionId,
                84532,
                "ar://txid",
                ""
            )
        );
        assertFalse(ok, "expected revert on duplicate sessionId");
    }

    function testSetResourceGatesRevertsOnInvalidMode() public {
        bytes16 sessionId = bytes16(keccak256("session-bad-mode"));
        SessionRegistry.ResourceGateInput[] memory gates = new SessionRegistry.ResourceGateInput[](1);
        address[] memory sbts = new address[](1);
        sbts[0] = address(0xCAFE);
        gates[0] = SessionRegistry.ResourceGateInput({
            resourceKey: "ai",
            sbtAddresses: sbts,
            chainId: 84532,
            mode: 2,
            perMemberLimit: 0
        });

        vm.prank(admin);
        registry.createSession{value: FEE}(
            "bad-mode",
            sessionId,
            84532,
            "ar://txid",
            ""
        );

        vm.prank(admin);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.setResourceGates.selector,
                "bad-mode",
                gates
            )
        );
        assertFalse(ok, "expected revert on invalid gate mode");
    }

    function testCreateSessionRevertsOnEmptySlug() public {
        bytes16 sessionId = bytes16(keccak256("session-empty-slug"));
        vm.prank(admin);
        (bool ok,) = address(registry).call{value: FEE}(
            abi.encodeWithSelector(
                registry.createSession.selector,
                "",
                sessionId,
                84532,
                "ar://txid",
                ""
            )
        );
        assertFalse(ok, "expected revert on empty slug");
    }

    function testCreateSessionRevertsWithoutFee() public {
        bytes16 sessionId = bytes16(keccak256("session-no-fee"));
        vm.prank(admin);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.createSession.selector,
                "no-fee",
                sessionId,
                84532,
                "ar://txid",
                ""
            )
        );
        assertFalse(ok, "expected revert without creation fee");
    }

    function testCreateSessionRevertsOnOverpayment() public {
        bytes16 sessionId = bytes16(keccak256("session-overpay"));
        vm.prank(admin);
        (bool ok,) = address(registry).call{value: FEE + 1}(
            abi.encodeWithSelector(
                registry.createSession.selector,
                "overpay",
                sessionId,
                84532,
                "ar://txid",
                ""
            )
        );

        assertFalse(ok, "expected revert on overpayment");
    }

    function testWithdrawFeesByDeployer() public {
        uint256 startBalance = address(this).balance;

        vm.prank(admin);
        registry.createSession{value: FEE}(
            "withdraw-ok",
            bytes16(keccak256("withdraw-ok")),
            84532,
            "ar://txid",
            ""
        );

        registry.withdrawFees();

        assertEq(address(registry).balance, 0, "registry balance should be empty");
        assertEq(address(this).balance, startBalance + FEE, "owner should receive withdrawn fees");
    }

    function testWithdrawFeesRevertsForNonDeployer() public {
        vm.prank(admin);
        registry.createSession{value: FEE}(
            "withdraw-nope",
            bytes16(keccak256("withdraw-nope")),
            84532,
            "ar://txid",
            ""
        );

        vm.prank(other);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.withdrawFees.selector)
        );

        assertFalse(ok, "expected revert for non-owner withdrawal");
    }

    function testWithdrawFeesAfterOwnershipTransfer() public {
        uint256 otherStartBalance = other.balance;

        vm.prank(admin);
        registry.createSession{value: FEE}(
            "withdraw-transfer",
            bytes16(keccak256("withdraw-transfer")),
            84532,
            "ar://txid",
            ""
        );

        registry.transferOwnership(other);

        (bool oldOwnerOk,) = address(registry).call(
            abi.encodeWithSelector(registry.withdrawFees.selector)
        );
        assertFalse(oldOwnerOk, "old owner should not withdraw after ownership transfer");

        vm.prank(other);
        registry.withdrawFees();

        assertEq(address(registry).balance, 0, "registry balance should be empty");
        assertEq(other.balance, otherStartBalance + FEE, "new owner should receive withdrawn fees");
    }
}
