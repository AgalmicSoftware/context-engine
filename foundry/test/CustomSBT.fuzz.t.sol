// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/SBTFactory.sol";
import "../../contracts/CustomSBT.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract CustomSBTFuzzTest is TestUtils {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    SBTFactory private factory;
    address private admin;
    address private user;
    uint256 private signerKey;
    address private signer;

    bytes32 private constant SBT_CREATED_TOPIC = keccak256("SBTCreated(address)");

    function setUp() public {
        factory = new SBTFactory();
        admin = address(0xA11CE);
        user = address(0xBEEF);
        signerKey = 0xB0B;
        signer = vm.addr(signerKey);
    }

    function testFuzz_claimWithInvite_invalidNonce(uint256 nonce) public {
        fuzz_claimWithInvite_invalidNonce(nonce);
    }

    function testFuzz_claimWithInvite_randomSignature(bytes memory sig) public {
        fuzz_claimWithInvite_randomSignature(sig);
    }

    function testFuzz_burn_nonOwner(address caller) public {
        fuzz_burn_nonOwner(caller);
    }

    function testFuzz_maxTokens_enforced(uint8 maxTokens) public {
        fuzz_maxTokens_enforced(maxTokens);
    }

    function fuzz_claimWithInvite_invalidNonce(uint256 nonce) internal {
        nonce = (nonce % type(uint64).max) + 2;

        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbtWithConfig("ContextEngine", "CE", 100, true, empty, keccak256(abi.encodePacked(signer)));
        bytes memory signature = signInvite(sbt, nonce, signerKey);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InvalidNonce.selector, 1, nonce));
        sbt.claimWithInvite(nonce, signature);

        assertEq(sbt.mintedTokens(), 0, "mintedTokens should remain 0");
    }

    function fuzz_claimWithInvite_randomSignature(bytes memory sig) internal {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbtWithConfig("ContextEngine", "CE", 100, true, empty, keccak256(abi.encodePacked(signer)));
        bytes32 digest = keccak256(abi.encodePacked(address(sbt), uint256(1))).toEthSignedMessageHash();

        if (sig.length == 65) {
            (address recoveredSigner, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, sig);
            if (err == ECDSA.RecoverError.NoError && keccak256(abi.encodePacked(recoveredSigner)) == sbt.groupPasswordHash()) {
                sig[0] = bytes1(uint8(sig[0]) ^ 0x01);
            }
        }

        vm.prank(user);
        vm.expectRevert(InvalidSignature.selector);
        sbt.claimWithInvite(1, sig);

        assertEq(sbt.mintedTokens(), 0, "mintedTokens should remain 0");
    }

    function fuzz_burn_nonOwner(address caller) internal {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.Both, 0);

        vm.prank(user);
        sbt.claim();

        uint256 tokenId = sbt.getTokenIdByOwner(user);
        caller = normalizeNonPrivileged(caller, admin, user);

        vm.prank(caller);
        vm.expectRevert();
        sbt.burn(tokenId);

        assertEq(sbt.ownerOf(tokenId), user, "token owner should remain unchanged");
        assertEq(sbt.getTokenIdByOwner(user), tokenId, "owner token mapping should remain unchanged");
    }

    function fuzz_maxTokens_enforced(uint8 maxTokens) internal {
        uint256 cappedMaxTokens = (uint256(maxTokens) % 10) + 1;
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbtWithConfig(
            "ContextEngine", "CE", cappedMaxTokens, false, empty, bytes32(0), MySBT.BurnAuth.Neither, 0
        );

        for (uint256 i = 0; i < cappedMaxTokens; i++) {
            address minter = deriveAddress(i + 1);
            vm.prank(minter);
            sbt.claim();
        }

        vm.prank(deriveAddress(cappedMaxTokens + 1));
        vm.expectRevert();
        sbt.claim();

        assertEq(sbt.mintedTokens(), cappedMaxTokens, "mintedTokens should stay capped");
    }

    function deploySbtWithConfig(
        string memory name,
        string memory symbol,
        uint256 maxTokens,
        bool hasPasswordMint,
        bytes32[] memory hashedPasswords,
        bytes32 groupPasswordHash
    ) internal returns (MySBT) {
        return deploySbtWithConfig(
            name, symbol, maxTokens, hasPasswordMint, hashedPasswords, groupPasswordHash, MySBT.BurnAuth.Neither, 0
        );
    }

    function deploySbtWithConfig(
        string memory name,
        string memory symbol,
        uint256 maxTokens,
        bool hasPasswordMint,
        bytes32[] memory hashedPasswords,
        bytes32 groupPasswordHash,
        MySBT.BurnAuth burnAuth,
        uint256 mintingEndTime
    ) internal returns (MySBT) {
        vm.recordLogs();
        factory.createSBT(
            name,
            symbol,
            maxTokens,
            admin,
            mintingEndTime,
            hasPasswordMint,
            burnAuth,
            hashedPasswords,
            "",
            groupPasswordHash
        );

        Vm.Log[] memory entries = vm.getRecordedLogs();
        address sbtAddress = address(0);
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics.length > 0 && entries[i].topics[0] == SBT_CREATED_TOPIC) {
                sbtAddress = address(uint160(uint256(entries[i].topics[1])));
                break;
            }
        }

        require(sbtAddress != address(0), "SBTCreated event not found");
        return MySBT(sbtAddress);
    }

    function signInvite(MySBT sbt, uint256 nonce, uint256 key) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encodePacked(address(sbt), nonce));
        bytes32 digest = message.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function deriveAddress(uint256 seed) internal pure returns (address actor) {
        actor = address(uint160(uint256(keccak256(abi.encodePacked(seed)))));
        if (actor == address(0)) {
            actor = address(0xB0B);
        }
    }

    function normalizeNonPrivileged(address candidate, address forbiddenA, address forbiddenB)
        internal
        pure
        returns (address normalized)
    {
        normalized = address(uint160(uint256(keccak256(abi.encodePacked(candidate)))));
        if (normalized == address(0) || normalized == forbiddenA || normalized == forbiddenB) {
            normalized = address(uint160(uint256(keccak256(abi.encodePacked(candidate, uint256(1))))));
        }
        if (normalized == address(0) || normalized == forbiddenA || normalized == forbiddenB) {
            normalized = address(0xD00D);
        }
    }
}
