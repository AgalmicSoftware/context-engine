// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/SBTFactory.sol";
import "../../contracts/CustomSBT.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ReentrantReceiver is IERC721Receiver {
    MySBT private immutable sbt;
    bool public reentryAttempted;
    bool public reentryBlocked;

    constructor(MySBT sbt_) {
        sbt = sbt_;
    }

    function attackClaim() external {
        sbt.claim();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (!reentryAttempted) {
            reentryAttempted = true;
            (bool ok,) = address(sbt).call(abi.encodeWithSignature("claim()"));
            reentryBlocked = !ok;
        }

        return IERC721Receiver.onERC721Received.selector;
    }
}

contract BurnOnReceiveReceiver is IERC721Receiver {
    MySBT private immutable sbt;
    bool public burnAttempted;
    bool public burnBlocked;

    constructor(MySBT sbt_) {
        sbt = sbt_;
    }

    function attackClaim() external {
        sbt.claim();
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        if (!burnAttempted) {
            burnAttempted = true;
            (bool ok,) = address(sbt).call(abi.encodeWithSignature("burn(uint256)", tokenId));
            burnBlocked = !ok;
        }

        return IERC721Receiver.onERC721Received.selector;
    }
}

contract CustomSBTTest is TestUtils {
    using MessageHashUtils for bytes32;

    SBTFactory private factory;
    address private admin;
    address private user;
    address private userTwo;
    uint256 private signerKey;
    address private signer;

    bytes32 private constant SBT_CREATED_TOPIC = keccak256("SBTCreated(address)");
    bytes32 private constant LOCKED_TOPIC = keccak256("Locked(uint256)");
    bytes32 private constant ISSUED_TOPIC = keccak256("Issued(address,address,uint256,uint8)");
    bytes32 private constant SBT_ACTIVITY_TOPIC = keccak256("SBTActivity(address,uint256,bool)");
    bytes4 private constant ERC165_INTERFACE_ID = 0x01ffc9a7;
    bytes4 private constant ERC5192_INTERFACE_ID = 0xb45a3c0e;
    bytes4 private constant ERC5484_INTERFACE_ID = 0x0489b56f;

    function setUp() public {
        factory = new SBTFactory();
        admin = address(0xA11CE);
        user = address(0xBEEF);
        userTwo = address(0xCAFE);
        signerKey = 0xB0B;
        signer = vm.addr(signerKey);
    }

    function deploySbt(
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

    function signGroupMint(MySBT sbt, address minter, uint256 key) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encodePacked(address(sbt), minter));
        bytes32 digest = message.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function signInvite(MySBT sbt, uint256 nonce, uint256 key) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encodePacked(address(sbt), nonce));
        bytes32 digest = message.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function assertHistorySummary(
        MySBT sbt,
        uint256 expectedTotalMinted,
        uint256 expectedTotalBurned,
        uint256 expectedActiveSupply,
        uint256 expectedCurrentHolderCount,
        uint256 expectedHistoricalHolderCount
    ) internal view {
        (
            uint256 totalMinted,
            uint256 totalBurned,
            uint256 activeSupply,
            uint256 currentHolderCount,
            uint256 historicalHolderCount
        ) = sbt.getHistorySummary();

        assertEq(totalMinted, expectedTotalMinted, "totalMinted mismatch");
        assertEq(totalBurned, expectedTotalBurned, "totalBurned mismatch");
        assertEq(activeSupply, expectedActiveSupply, "activeSupply mismatch");
        assertEq(currentHolderCount, expectedCurrentHolderCount, "currentHolderCount mismatch");
        assertEq(historicalHolderCount, expectedHistoricalHolderCount, "historicalHolderCount mismatch");
    }

    function findLogIndexByTopic(Vm.Log[] memory entries, bytes32 topic) internal pure returns (uint256 index, bool ok) {
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics.length > 0 && entries[i].topics[0] == topic) {
                return (i, true);
            }
        }
        return (0, false);
    }

    function testFactoryCreatesSbtAndIncrementsCount() public {
        uint256 beforeCount = factory.sbtCount();
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));
        uint256 afterCount = factory.sbtCount();
        assertEq(afterCount, beforeCount + 1, "sbtCount not incremented");
        assertTrue(address(sbt) != address(0), "sbt address missing");
    }

    function testPredictConfiguredSbtAddressMatchesDeterministicDeploy() public {
        bytes32[] memory empty = new bytes32[](0);
        bytes32 salt = keccak256("predict-configured");
        address predicted = factory.predictConfiguredSBTAddress(
            salt, "ContextEngine", "CE-SBT-CFG1", 0, admin, 0, false, MySBT.BurnAuth.Neither, empty, false
        );

        vm.prank(admin);
        address deployed = factory.createSBTDeterministicConfigured(
            salt,
            "ContextEngine",
            "CE-SBT-CFG1",
            0,
            admin,
            0,
            false,
            MySBT.BurnAuth.Neither,
            empty,
            "ar://configured-metadata",
            bytes32(0),
            false
        );

        assertEq(deployed, predicted, "configured deterministic address mismatch");
        assertEq(factory.sbtCount(), 1, "configured create should increment count");
        (,,,,,,,, string memory collectionTokenURI) = MySBT(deployed).getSBTMetadata();
        assertEq(
            keccak256(bytes(collectionTokenURI)),
            keccak256(bytes("ar://configured-metadata")),
            "token URI should be finalized"
        );
    }

    function testDeterministicConfiguredDeployInitializesGroupPasswordHash() public {
        bytes32[] memory empty = new bytes32[](0);
        bytes32 salt = keccak256("predict-group-password");
        bytes32 finalGroupPasswordHash = keccak256(abi.encodePacked(signer));
        address predicted = factory.predictConfiguredSBTAddress(
            salt, "ContextEngine", "CE-SBT-CFG2", 0, admin, 0, false, MySBT.BurnAuth.Neither, empty, true
        );

        vm.prank(admin);
        address deployed = factory.createSBTDeterministicConfigured(
            salt,
            "ContextEngine",
            "CE-SBT-CFG2",
            0,
            admin,
            0,
            false,
            MySBT.BurnAuth.Neither,
            empty,
            "ar://group-password",
            finalGroupPasswordHash,
            true
        );

        MySBT sbt = MySBT(deployed);
        assertEq(deployed, predicted, "group-password configured address mismatch");
        assertEq(sbt.groupPasswordHash(), finalGroupPasswordHash, "group password hash should be finalized");
        assertFalse(sbt.groupPasswordHashInitAllowed(), "group password init should be disabled after deploy");
        assertFalse(sbt.tokenURIInitAllowed(), "token URI init should be disabled after deploy");
    }

    function testDeterministicConfiguredDeployRejectsNonAdminCaller() public {
        bytes32[] memory empty = new bytes32[](0);

        vm.prank(user);
        vm.expectRevert("Configured deterministic deploy caller must be admin");
        factory.createSBTDeterministicConfigured(
            keccak256("predict-non-admin"),
            "ContextEngine",
            "CE-SBT-CFG-NONADMIN",
            0,
            admin,
            0,
            false,
            MySBT.BurnAuth.Neither,
            empty,
            "ar://configured-metadata",
            bytes32(0),
            false
        );
    }

    function testDeterministicConfiguredDeployRejectsZeroAdmin() public {
        bytes32[] memory empty = new bytes32[](0);

        vm.expectRevert("Configured deterministic deploy requires admin");
        factory.createSBTDeterministicConfigured(
            keccak256("predict-zero-admin"),
            "ContextEngine",
            "CE-SBT-CFG-ZERO",
            0,
            address(0),
            0,
            false,
            MySBT.BurnAuth.Neither,
            empty,
            "ar://configured-metadata",
            bytes32(0),
            false
        );
    }

    function testDeterministicConfiguredDeployRejectsPreinitializedGroupPasswordHash() public {
        bytes32[] memory empty = new bytes32[](0);
        bytes32 salt = keccak256("predict-group-password-unsupported");
        bytes32 finalGroupPasswordHash = keccak256(abi.encodePacked(signer));
        vm.prank(admin);
        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                factory.createSBTDeterministicConfigured.selector,
                salt,
                "ContextEngine",
                "CE-SBT-CFG3",
                0,
                admin,
                0,
                false,
                MySBT.BurnAuth.Neither,
                empty,
                "ar://group-password",
                finalGroupPasswordHash,
                false
            )
        );

        assertFalse(ok, "configured deterministic deploy should reject non-zero group hash without deferred init");
    }

    function testFactoryRejectsPasswordModeWithoutHashes() public {
        bytes32[] memory empty = new bytes32[](0);
        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                factory.createSBT.selector,
                "ContextEngine",
                "CE-BAD-PW",
                0,
                admin,
                0,
                true,
                MySBT.BurnAuth.Neither,
                empty,
                "",
                bytes32(0)
            )
        );

        assertFalse(ok, "password mode should require at least one hashed password");
    }

    function testFactoryRejectsPublicModeWithHashedPasswords() public {
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked("secret"));
        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                factory.createSBT.selector,
                "ContextEngine",
                "CE-BAD-PUB",
                0,
                admin,
                0,
                false,
                MySBT.BurnAuth.Neither,
                hashed,
                "",
                bytes32(0)
            )
        );

        assertFalse(ok, "public mode should reject preloaded password hashes");
    }

    function testFactoryRejectsInviteModeWithoutSignerHash() public {
        bytes32[] memory empty = new bytes32[](0);
        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                factory.createSBT.selector,
                "ContextEngine",
                "CE-BAD-INV",
                1,
                admin,
                0,
                true,
                MySBT.BurnAuth.Neither,
                empty,
                "",
                bytes32(0)
            )
        );

        assertFalse(ok, "invite mode should require a signer hash");
    }

    function testPublicClaimMints() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));

        vm.prank(user);
        sbt.claim();

        assertEq(sbt.mintedTokens(), 1, "mintedTokens should be 1");
        assertEq(sbt.getTokenIdByOwner(user), 1, "tokenId mismatch");
    }

    function testSupportsErc165Erc5192AndErc5484Interfaces() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.Both, 0);

        assertTrue(sbt.supportsInterface(ERC165_INTERFACE_ID), "ERC165 should be supported");
        assertTrue(sbt.supportsInterface(ERC5192_INTERFACE_ID), "ERC5192 should be supported");
        assertTrue(sbt.supportsInterface(ERC5484_INTERFACE_ID), "ERC5484 should be supported");
    }

    function testMintEmitsLockedIssuedAndActivityEvents() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.OwnerOnly, 0);

        vm.recordLogs();
        vm.prank(user);
        sbt.claim();
        Vm.Log[] memory entries = vm.getRecordedLogs();

        (uint256 issuedIndex, bool issuedFound) = findLogIndexByTopic(entries, ISSUED_TOPIC);
        assertTrue(issuedFound, "Issued log missing");
        Vm.Log memory issuedLog = entries[issuedIndex];
        assertEq(address(uint160(uint256(issuedLog.topics[1]))), admin, "Issued.from mismatch");
        assertEq(address(uint160(uint256(issuedLog.topics[2]))), user, "Issued.to mismatch");
        assertEq(uint256(issuedLog.topics[3]), 1, "Issued.tokenId mismatch");
        assertEq(abi.decode(issuedLog.data, (uint8)), uint8(MySBT.BurnAuth.OwnerOnly), "Issued burnAuth mismatch");

        (uint256 lockedIndex, bool lockedFound) = findLogIndexByTopic(entries, LOCKED_TOPIC);
        assertTrue(lockedFound, "Locked log missing");
        Vm.Log memory lockedLog = entries[lockedIndex];
        assertEq(abi.decode(lockedLog.data, (uint256)), 1, "Locked tokenId mismatch");

        (uint256 activityIndex, bool activityFound) = findLogIndexByTopic(entries, SBT_ACTIVITY_TOPIC);
        assertTrue(activityFound, "SBTActivity mint log missing");
        Vm.Log memory activityLog = entries[activityIndex];
        assertEq(address(uint160(uint256(activityLog.topics[1]))), user, "SBTActivity.account mismatch");
        assertEq(uint256(activityLog.topics[2]), 1, "SBTActivity.tokenId mismatch");
        assertEq(uint256(activityLog.topics[3]), 0, "SBTActivity burn flag mismatch");

        assertTrue(sbt.locked(1), "token should report locked");
        assertEq(uint256(sbt.burnAuth(1)), uint256(MySBT.BurnAuth.OwnerOnly), "token burnAuth mismatch");
        assertEq(
            uint256(sbt.collectionBurnAuth()),
            uint256(MySBT.BurnAuth.OwnerOnly),
            "collection burnAuth mismatch"
        );
        assertHistorySummary(sbt, 1, 0, 1, 1, 1);
    }

    function testTokenURIRevertsForNonexistentAndBurnedTokens() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = new MySBT(
            "ContextEngine",
            "CE",
            0,
            admin,
            0,
            MySBT.MintMode.PublicClaim,
            MySBT.BurnAuth.OwnerOnly,
            empty,
            "ar://collection-metadata",
            bytes32(0),
            false,
            false
        );

        vm.expectRevert(InvalidTokenId.selector);
        sbt.tokenURI(1);

        vm.prank(user);
        sbt.claim();
        uint256 tokenId = sbt.getTokenIdByOwner(user);
        assertEq(
            keccak256(bytes(sbt.tokenURI(tokenId))),
            keccak256(bytes("ar://collection-metadata")),
            "live token URI mismatch"
        );

        (,,,,,,,, string memory collectionTokenURI) = sbt.getSBTMetadata();
        assertEq(
            keccak256(bytes(collectionTokenURI)),
            keccak256(bytes("ar://collection-metadata")),
            "collection metadata URI mismatch"
        );

        vm.prank(user);
        sbt.burn(tokenId);

        vm.expectRevert(InvalidTokenId.selector);
        sbt.tokenURI(tokenId);
    }

    function testBurnEmitsActivityEventAndKeepsCollectionBurnAuthReadable() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.OwnerOnly, 0);

        vm.prank(user);
        sbt.claim();
        uint256 tokenId = sbt.getTokenIdByOwner(user);

        vm.recordLogs();
        vm.prank(user);
        sbt.burn(tokenId);
        Vm.Log[] memory entries = vm.getRecordedLogs();

        (uint256 activityIndex, bool activityFound) = findLogIndexByTopic(entries, SBT_ACTIVITY_TOPIC);
        assertTrue(activityFound, "SBTActivity burn log missing");
        Vm.Log memory activityLog = entries[activityIndex];
        assertEq(address(uint160(uint256(activityLog.topics[1]))), user, "burn activity account mismatch");
        assertEq(uint256(activityLog.topics[2]), tokenId, "burn activity tokenId mismatch");
        assertEq(uint256(activityLog.topics[3]), 1, "burn activity flag mismatch");

        assertEq(uint256(sbt.collectionBurnAuth()), uint256(MySBT.BurnAuth.OwnerOnly), "collection burnAuth changed");
        assertHistorySummary(sbt, 1, 1, 0, 0, 1);
    }

    function testHistorySummaryTracksMintBurnRemintFlows() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.Both, 0);

        vm.prank(user);
        sbt.claim();
        assertHistorySummary(sbt, 1, 0, 1, 1, 1);

        vm.prank(userTwo);
        sbt.claim();
        assertHistorySummary(sbt, 2, 0, 2, 2, 2);

        uint256 userTokenId = sbt.getTokenIdByOwner(user);
        vm.prank(user);
        sbt.burn(userTokenId);
        assertHistorySummary(sbt, 2, 1, 1, 1, 2);

        vm.prank(user);
        sbt.claim();
        assertHistorySummary(sbt, 3, 1, 2, 2, 2);
    }

    function testClaimBlocksReentrancyDuringSafeMint() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));
        ReentrantReceiver receiver = new ReentrantReceiver(sbt);

        receiver.attackClaim();

        assertTrue(receiver.reentryAttempted(), "reentry should be attempted");
        assertTrue(receiver.reentryBlocked(), "reentry should be blocked");
        assertEq(sbt.mintedTokens(), 1, "only one token should be minted");
        assertEq(sbt.getTokenIdByOwner(address(receiver)), 1, "receiver should hold exactly one token");
    }

    function testClaimBlocksBurnReentrancyDuringSafeMintAndKeepsHistorySummaryCorrect() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.OwnerOnly, 0);
        BurnOnReceiveReceiver receiver = new BurnOnReceiveReceiver(sbt);

        receiver.attackClaim();

        assertTrue(receiver.burnAttempted(), "burn reentry should be attempted");
        assertTrue(receiver.burnBlocked(), "burn reentry should be blocked");
        assertEq(sbt.mintedTokens(), 1, "only one token should be minted");
        assertEq(sbt.getTokenIdByOwner(address(receiver)), 1, "receiver should still hold the token");
        assertHistorySummary(sbt, 1, 0, 1, 1, 1);
    }

    function testClaimRevertsWhenPasswordMintEnabled() public {
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked("secret"));
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, true, hashed, bytes32(0));

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claim()"));
        assertFalse(ok, "claim should revert when password mint enabled");
    }

    function testFactoryDerivesExplicitMintModesForAllSupportedFlows() public {
        bytes32[] memory empty = new bytes32[](0);
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked("secret"));
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));

        MySBT publicSbt = deploySbt("ContextEngine", "CE-PUB", 0, false, empty, bytes32(0));
        assertEq(uint256(publicSbt.mintMode()), uint256(MySBT.MintMode.PublicClaim), "public claim mode mismatch");

        MySBT passwordSbt = deploySbt("ContextEngine", "CE-PW", 0, true, hashed, bytes32(0));
        assertEq(
            uint256(passwordSbt.mintMode()),
            uint256(MySBT.MintMode.PasswordCommitReveal),
            "password mode mismatch"
        );
        assertTrue(passwordSbt.hasPasswordMint(), "password mode should preserve legacy password flag");

        MySBT groupSbt = deploySbt("ContextEngine", "CE-GRP", 0, false, empty, groupPasswordHash);
        assertEq(
            uint256(groupSbt.mintMode()),
            uint256(MySBT.MintMode.UnlimitedGroupSignature),
            "group signature mode mismatch"
        );
        assertFalse(groupSbt.hasPasswordMint(), "group signature mode should clear legacy password flag");

        MySBT inviteSbt = deploySbt("ContextEngine", "CE-INV", 2, true, empty, groupPasswordHash);
        assertEq(
            uint256(inviteSbt.mintMode()),
            uint256(MySBT.MintMode.LimitedInviteSignature),
            "invite mode mismatch"
        );
        assertTrue(inviteSbt.hasPasswordMint(), "invite mode should preserve legacy password flag");
    }

    function testPasswordClaimFlowConsumesPassword() public {
        string memory password = "invite-pass";
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked(password));
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, true, hashed, bytes32(0));

        assertTrue(sbt.isPasswordValid(hashed[0]), "password should be valid");

        bytes32 commit = keccak256(abi.encodePacked(password, user));
        vm.prank(user);
        sbt.startClaim(commit);

        vm.prank(user);
        (bool okEarly,) = address(sbt).call(abi.encodeWithSignature("claimWithPassword(string)", password));
        assertFalse(okEarly, "claim should require delay");

        vm.warp(block.timestamp + 6);

        vm.prank(user);
        (bool okWrong,) = address(sbt).call(abi.encodeWithSignature("claimWithPassword(string)", "wrong"));
        assertFalse(okWrong, "wrong password should fail");

        vm.prank(user);
        sbt.claimWithPassword(password);

        assertEq(sbt.mintedTokens(), 1, "mintedTokens should be 1");
        assertFalse(sbt.isPasswordValid(hashed[0]), "password should be consumed");
    }

    function testGroupSignatureMint() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, groupPasswordHash);

        bytes32 message = keccak256(abi.encodePacked(address(sbt), user));
        bytes32 digest = message.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user);
        sbt.mintWithGroupSignature(signature);

        assertEq(sbt.mintedTokens(), 1, "mintedTokens should be 1");
        assertEq(sbt.getTokenIdByOwner(user), 1, "tokenId mismatch");
    }

    function testGroupSignatureModeRejectsPublicClaim() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, groupPasswordHash);

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claim()"));
        assertFalse(ok, "group signature mode should reject public claim");
        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testInviteClaimMintsAndBlocksWrongNonce() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 2, true, empty, groupPasswordHash);

        uint256 nonce = 1;
        bytes memory signature = signInvite(sbt, nonce, signerKey);

        vm.prank(user);
        sbt.claimWithInvite(nonce, signature);

        assertEq(sbt.mintedTokens(), 1, "mintedTokens should be 1");

        vm.prank(userTwo);
        vm.expectRevert(abi.encodeWithSelector(InvalidNonce.selector, 2, 1));
        sbt.claimWithInvite(1, signature);

        assertEq(sbt.mintedTokens(), 1, "mintedTokens should stay 1");
        assertEq(sbt.getTokenIdByOwner(userTwo), 0, "userTwo should not mint");
    }

    function testInviteModeRejectsPublicClaimAndGroupSignatureMint() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 2, true, empty, groupPasswordHash);

        vm.prank(user);
        (bool claimOk,) = address(sbt).call(abi.encodeWithSignature("claim()"));
        assertFalse(claimOk, "invite mode should reject public claim");

        bytes memory signature = signGroupMint(sbt, user, signerKey);
        vm.prank(user);
        (bool groupSigOk,) = address(sbt).call(abi.encodeWithSignature("mintWithGroupSignature(bytes)", signature));
        assertFalse(groupSigOk, "invite mode should reject reusable group signatures");
        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testMintingEndTimeBlocksClaims() public {
        bytes32[] memory empty = new bytes32[](0);
        uint256 endTime = block.timestamp + 5;
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.Neither, endTime);

        vm.prank(user);
        sbt.claim();

        vm.warp(endTime + 1);
        vm.prank(userTwo);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claim()"));
        assertFalse(ok, "claim should revert after minting end");
    }

    function testMaxTokensCapsMints() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbtWithConfig("ContextEngine", "CE", 1, false, empty, bytes32(0), MySBT.BurnAuth.Neither, 0);

        vm.prank(user);
        sbt.claim();

        vm.prank(userTwo);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claim()"));
        assertFalse(ok, "maxTokens should cap mints");
        assertEq(sbt.mintedTokens(), 1, "mintedTokens should stay capped");
    }

    function testAddressCannotMintTwice() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));

        vm.prank(user);
        sbt.claim();

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claim()"));
        assertFalse(ok, "address should not mint twice");
    }

    function testTransferFromRevertsToPreserveSoulboundGuarantee() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));

        vm.prank(user);
        sbt.claim();

        uint256 tokenId = sbt.getTokenIdByOwner(user);
        vm.prank(user);
        (bool ok,) =
            address(sbt).call(abi.encodeWithSignature("transferFrom(address,address,uint256)", user, userTwo, tokenId));

        assertFalse(ok, "transferFrom should revert for soulbound tokens");
        assertEq(sbt.ownerOf(tokenId), user, "owner should remain unchanged");
        assertEq(sbt.getTokenIdByOwner(user), tokenId, "holder mapping should remain intact");
        assertEq(sbt.getTokenIdByOwner(userTwo), 0, "recipient should not receive a token");
    }

    function testSafeTransferFromRevertsToPreserveSoulboundGuarantee() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));

        vm.prank(user);
        sbt.claim();

        uint256 tokenId = sbt.getTokenIdByOwner(user);
        vm.prank(user);
        (bool ok,) = address(sbt).call(
            abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", user, userTwo, tokenId)
        );

        assertFalse(ok, "safeTransferFrom should revert for soulbound tokens");
        assertEq(sbt.ownerOf(tokenId), user, "owner should remain unchanged");
    }

    function testApprovalsRevertForSoulboundTokens() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));

        vm.prank(user);
        sbt.claim();

        uint256 tokenId = sbt.getTokenIdByOwner(user);
        vm.prank(user);
        (bool approveOk,) = address(sbt).call(abi.encodeWithSignature("approve(address,uint256)", userTwo, tokenId));
        assertFalse(approveOk, "approve should revert for soulbound tokens");

        vm.prank(user);
        (bool approvalForAllOk,) =
            address(sbt).call(abi.encodeWithSignature("setApprovalForAll(address,bool)", userTwo, true));
        assertFalse(approvalForAllOk, "setApprovalForAll should revert for soulbound tokens");
    }

    function testStartClaimRequiresPasswordMode() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));
        bytes32 commit = keccak256(abi.encodePacked("pw", user));

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("startClaim(bytes32)", commit));
        assertFalse(ok, "startClaim should revert when password mint disabled");
    }

    function testClaimWithPasswordRequiresStart() public {
        string memory password = "pw";
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked(password));
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, true, hashed, bytes32(0));

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claimWithPassword(string)", password));
        assertFalse(ok, "claimWithPassword should require startClaim");
        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testClaimWithPasswordCommitmentMismatch() public {
        string memory password = "pw-a";
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked(password));
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, true, hashed, bytes32(0));

        bytes32 commit = keccak256(abi.encodePacked(password, user));
        vm.prank(user);
        sbt.startClaim(commit);

        vm.warp(block.timestamp + 6);

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claimWithPassword(string)", "pw-b"));
        assertFalse(ok, "commitment mismatch should fail");
        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testClaimWithPasswordInvalidPassword() public {
        string memory password = "pw-a";
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked("pw-b"));
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, true, hashed, bytes32(0));

        bytes32 commit = keccak256(abi.encodePacked(password, user));
        vm.prank(user);
        sbt.startClaim(commit);

        vm.warp(block.timestamp + 6);

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("claimWithPassword(string)", password));
        assertFalse(ok, "invalid password should fail");
        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testAddHashedPasswordsOnlyAdmin() public {
        bytes32[] memory initialHashed = new bytes32[](1);
        initialHashed[0] = keccak256(abi.encodePacked("initial"));
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, true, initialHashed, bytes32(0));
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked("pw"));

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("addHashedPasswords(bytes32[])", hashed));
        assertFalse(ok, "non-admin cannot add hashed passwords");
    }

    function testAddHashedPasswordsFailsWhenMaxTokensReached() public {
        string memory password = "pw";
        bytes32[] memory hashed = new bytes32[](1);
        hashed[0] = keccak256(abi.encodePacked(password));
        MySBT sbt = deploySbtWithConfig("ContextEngine", "CE", 1, true, hashed, bytes32(0), MySBT.BurnAuth.Neither, 0);

        bytes32 commit = keccak256(abi.encodePacked(password, user));
        vm.prank(user);
        sbt.startClaim(commit);
        vm.warp(block.timestamp + 6);
        vm.prank(user);
        sbt.claimWithPassword(password);

        bytes32[] memory extra = new bytes32[](1);
        extra[0] = keccak256(abi.encodePacked("extra"));

        vm.prank(admin);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("addHashedPasswords(bytes32[])", extra));
        assertFalse(ok, "should not add passwords after max tokens");
    }

    function testGroupSignatureRequiresGroupSignatureMode() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("mintWithGroupSignature(bytes)", ""));
        assertFalse(ok, "group signature should reject public claim mode");
    }

    function testGroupSignatureRejectsWrongSigner() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, groupPasswordHash);

        bytes memory badSig = signGroupMint(sbt, user, 0xB0C);

        vm.prank(user);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("mintWithGroupSignature(bytes)", badSig));
        assertFalse(ok, "wrong signer should fail");
        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testInviteClaimRequiresInviteMode() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 0, false, empty, bytes32(0));
        bytes memory signature = signInvite(sbt, 1, signerKey);

        vm.prank(user);
        vm.expectRevert(bytes("Invite mint not enabled"));
        sbt.claimWithInvite(1, signature);

        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testInviteClaimRejectsWrongNonce() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 1, true, empty, groupPasswordHash);

        bytes memory signature = signInvite(sbt, 2, signerKey);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InvalidNonce.selector, 1, 2));
        sbt.claimWithInvite(2, signature);

        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testInviteClaimRejectsWrongSigner() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 1, true, empty, groupPasswordHash);

        bytes memory signature = signInvite(sbt, 1, 0xB0C);

        vm.prank(user);
        vm.expectRevert(InvalidSignature.selector);
        sbt.claimWithInvite(1, signature);

        assertEq(sbt.mintedTokens(), 0, "mintedTokens should stay 0");
    }

    function testInviteClaimBlocksWhenMaxTokensReached() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 1, true, empty, groupPasswordHash, MySBT.BurnAuth.Neither, 0);

        bytes memory sig1 = signInvite(sbt, 1, signerKey);
        vm.prank(user);
        sbt.claimWithInvite(1, sig1);
        assertEq(sbt.mintedTokens(), 1, "mintedTokens should be 1");

        bytes memory sig2 = signInvite(sbt, 2, signerKey);
        vm.prank(userTwo);
        vm.expectRevert(MaxTokensReached.selector);
        sbt.claimWithInvite(2, sig2);
        assertEq(sbt.mintedTokens(), 1, "mintedTokens should stay capped");
    }

    function testInviteClaimBlocksWhenAddressAlreadyOwns() public {
        bytes32 groupPasswordHash = keccak256(abi.encodePacked(signer));
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbt("ContextEngine", "CE", 2, true, empty, groupPasswordHash);

        bytes memory sig1 = signInvite(sbt, 1, signerKey);
        vm.prank(user);
        sbt.claimWithInvite(1, sig1);
        assertEq(sbt.mintedTokens(), 1, "mintedTokens should be 1");

        bytes memory sig2 = signInvite(sbt, 2, signerKey);
        vm.prank(user);
        vm.expectRevert(AlreadyOwns.selector);
        sbt.claimWithInvite(2, sig2);
        assertEq(sbt.mintedTokens(), 1, "mintedTokens should stay 1");
    }

    function testBurnAuthOwnerOnly() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.OwnerOnly, 0);

        vm.prank(user);
        sbt.claim();
        uint256 tokenId = sbt.getTokenIdByOwner(user);

        vm.prank(admin);
        (bool okAdmin,) = address(sbt).call(abi.encodeWithSignature("burn(uint256)", tokenId));
        assertFalse(okAdmin, "admin should not burn in OwnerOnly");

        vm.prank(user);
        sbt.burn(tokenId);
        assertEq(sbt.getTokenIdByOwner(user), 0, "token should be cleared");
    }

    function testBurnAuthIssuerOnly() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt =
            deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.IssuerOnly, 0);

        vm.prank(user);
        sbt.claim();
        uint256 tokenId = sbt.getTokenIdByOwner(user);

        vm.prank(user);
        (bool okUser,) = address(sbt).call(abi.encodeWithSignature("burn(uint256)", tokenId));
        assertFalse(okUser, "owner should not burn in IssuerOnly");

        vm.prank(admin);
        sbt.burn(tokenId);
        assertEq(sbt.getTokenIdByOwner(user), 0, "token should be cleared");
    }

    function testBurnAuthBoth() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.Both, 0);

        vm.prank(user);
        sbt.claim();
        uint256 tokenId = sbt.getTokenIdByOwner(user);

        vm.prank(user);
        sbt.burn(tokenId);
        assertEq(sbt.getTokenIdByOwner(user), 0, "owner burn should clear token");

        vm.prank(userTwo);
        sbt.claim();
        uint256 tokenIdTwo = sbt.getTokenIdByOwner(userTwo);

        vm.prank(admin);
        sbt.burn(tokenIdTwo);
        assertEq(sbt.getTokenIdByOwner(userTwo), 0, "admin burn should clear token");
    }

    function testBurnAuthNeither() public {
        bytes32[] memory empty = new bytes32[](0);
        MySBT sbt = deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.Neither, 0);

        vm.prank(user);
        sbt.claim();
        uint256 tokenId = sbt.getTokenIdByOwner(user);

        vm.prank(user);
        (bool okUser,) = address(sbt).call(abi.encodeWithSignature("burn(uint256)", tokenId));
        assertFalse(okUser, "owner should not burn in Neither");

        vm.prank(admin);
        (bool okAdmin,) = address(sbt).call(abi.encodeWithSignature("burn(uint256)", tokenId));
        assertFalse(okAdmin, "admin should not burn in Neither");
    }
}
