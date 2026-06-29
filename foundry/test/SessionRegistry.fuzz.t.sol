// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/SessionRegistry.sol";

contract SessionRegistryFuzzTest is TestUtils {
    SessionRegistry private registry;
    address private admin;

    uint256 private constant FEE = 0.0001 ether;

    function setUp() public {
        registry = new SessionRegistry();
        admin = address(0xA11CE);
        vm.deal(admin, 10 ether);
    }

    function testFuzz_gateMode_alwaysValid(uint8 mode) public {
        fuzz_gateMode_alwaysValid(mode);
    }

    function testFuzz_updateRequiresAdmin(address caller) public {
        fuzz_updateRequiresAdmin(caller);
    }

    function fuzz_gateMode_alwaysValid(uint8 mode) internal {
        createSession("gate-mode");

        SessionRegistry.ResourceGateInput[] memory gates = new SessionRegistry.ResourceGateInput[](1);
        address[] memory sbts = new address[](1);
        sbts[0] = address(0xCAFE);
        gates[0] = SessionRegistry.ResourceGateInput({
            resourceKey: "ai",
            sbtAddresses: sbts,
            chainId: 84532,
            mode: mode,
            perMemberLimit: 5
        });

        vm.prank(admin);
        if (mode <= 1) {
            registry.setResourceGates("gate-mode", gates);
            (, uint256 chainId, uint8 storedMode, uint256 limit) = registry.getResourceGate("gate-mode", "ai");
            assertEq(chainId, 84532, "gate chainId mismatch");
            assertEq(uint256(storedMode), uint256(mode), "gate mode mismatch");
            assertEq(limit, 5, "gate limit mismatch");
        } else {
            vm.expectRevert();
            registry.setResourceGates("gate-mode", gates);
        }
    }

    function fuzz_updateRequiresAdmin(address caller) internal {
        createSession("metadata-update");
        caller = normalizeCaller(caller);

        vm.prank(caller);
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.updateSessionMetadata.selector, "metadata-update", "ar://updated", "ar://updated-encrypted"
            )
        );

        assertFalse(ok, "non-admin should not update metadata");

        (, , string memory metadataURI, string memory encryptedMetadataURI, address adminAddr, , ,) =
            registry.getSessionBySlug("metadata-update");
        assertEq(keccak256(bytes(metadataURI)), keccak256(bytes("ar://meta")), "metadata URI should remain unchanged");
        assertEq(
            keccak256(bytes(encryptedMetadataURI)),
            keccak256(bytes("")),
            "encrypted metadata URI should remain unchanged"
        );
        assertEq(adminAddr, admin, "session admin should remain unchanged");
    }

    function createSession(string memory slug) internal {
        vm.prank(admin);
        registry.createSession{value: FEE}(slug, bytes16(keccak256(bytes(slug))), 84532, "ar://meta", "");
    }

    function normalizeCaller(address caller) internal view returns (address normalized) {
        normalized = address(uint160(uint256(keccak256(abi.encodePacked(caller)))));
        if (normalized == address(0) || normalized == admin) {
            normalized = address(uint160(uint256(keccak256(abi.encodePacked(caller, uint256(1))))));
        }
        if (normalized == address(0) || normalized == admin) {
            normalized = address(0xD00D);
        }
    }
}
