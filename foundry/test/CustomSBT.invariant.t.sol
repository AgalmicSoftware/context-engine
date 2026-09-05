// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/SBTFactory.sol";
import "../../contracts/CustomSBT.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

struct FuzzSelector {
    address addr;
    bytes4[] selectors;
}

abstract contract InvariantUtils {
    address[] internal _targetedContracts;
    FuzzSelector[] internal _targetedSelectors;

    function targetContract(address newTargetedContract) internal {
        _targetedContracts.push(newTargetedContract);
    }

    function targetSelector(FuzzSelector memory newTargetedSelector) internal {
        _targetedSelectors.push(newTargetedSelector);
    }

    function targetContracts() public view returns (address[] memory) {
        return _targetedContracts;
    }

    function targetSelectors() public view returns (FuzzSelector[] memory) {
        return _targetedSelectors;
    }
}

contract CustomSBTInvariantHandler is TestUtils {
    MySBT internal immutable sbt;

    address public expectedAdmin;
    bool public authorityViolation;
    address[] private actors;
    mapping(address => bool) private knownActor;

    constructor(MySBT sbt_) {
        sbt = sbt_;
        expectedAdmin = sbt_.admin();
    }

    function claim(uint256 seed) external {
        address actor = deriveAddress(seed);
        vm.prank(actor);
        (bool ok,) = address(sbt).call(abi.encodeWithSelector(MySBT.claim.selector));
        if (ok) {
            trackActor(actor);
        }
    }

    function burn(uint256 seed) external {
        if (actors.length == 0) {
            return;
        }

        address actor = actors[seed % actors.length];
        if (sbt.balanceOf(actor) == 0) {
            return;
        }

        uint256 tokenId = sbt.getTokenIdByOwner(actor);
        if (tokenId == 0) {
            return;
        }

        vm.prank(actor);
        (bool ok,) = address(sbt).call(abi.encodeWithSelector(MySBT.burn.selector, tokenId));
        ok;
    }

    function rotateAdmin(uint256 seed) external {
        address next = seed % 4 == 0 ? address(0) : deriveAddress(seed);
        vm.prank(expectedAdmin);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("changeAdmin(address)", next));
        if (ok != (expectedAdmin != address(0))) authorityViolation = true;
        if (ok) expectedAdmin = next;
    }

    function unauthorizedRotation(uint256 seed) external {
        address attacker = deriveAddress(seed);
        if (attacker == expectedAdmin) return;
        vm.prank(attacker);
        (bool ok,) = address(sbt).call(abi.encodeWithSignature("changeAdmin(address)", attacker));
        if (ok) authorityViolation = true;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 index) external view returns (address) {
        return actors[index];
    }

    function trackActor(address actor) internal {
        if (!knownActor[actor]) {
            knownActor[actor] = true;
            actors.push(actor);
        }
    }

    function deriveAddress(uint256 seed) internal pure returns (address actor) {
        actor = address(uint160(uint256(keccak256(abi.encodePacked(seed)))));
        if (actor == address(0)) {
            actor = address(0xC0DE);
        }
    }
}

contract InviteSlotInvariantHandler is TestUtils {
    using MessageHashUtils for bytes32;
    MySBT public immutable SBT;
    uint256 public successfulClaims;
    bool public violation;
    mapping(uint256 => bool) public expectedUsed;

    constructor() {
        SBT = new MySBT("Slots", "SLOT", 8, address(0), 0, MySBT.MintMode.LimitedInviteSignature,
            MySBT.BurnAuth.OwnerOnly, new bytes32[](0), "", keccak256(abi.encodePacked(vm.addr(0xD1))), false, false);
    }

    function claim(uint8 slotSeed, uint8 actorSeed, bool validDomain) external {
        uint256 slot = uint256(slotSeed) % 10;
        address actor = address(0x1000 + uint160(actorSeed) % 8);
        bytes32 domain = validDomain ? keccak256("ContextEngine.SBT.Invite:1") : keccak256("Wrong domain");
        bytes32 hash = keccak256(abi.encode(domain, block.chainid, address(SBT), slot)).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 sigS) = vm.sign(0xD1, hash);
        vm.prank(actor);
        (bool ok,) = address(SBT).call(abi.encodeWithSelector(MySBT.claimWithInvite.selector, slot, abi.encodePacked(r, sigS, v)));
        if (ok) {
            if (!validDomain || slot == 0 || slot > 8 || expectedUsed[slot]) violation = true;
            expectedUsed[slot] = true;
            successfulClaims++;
        }
    }

    function burn(uint8 actorSeed) external {
        address actor = address(0x1000 + uint160(actorSeed) % 8);
        uint256 id = SBT.getTokenIdByOwner(actor);
        if (id == 0) return;
        vm.prank(actor);
        SBT.burn(id);
    }
}

contract CustomSBTInvariantTest is TestUtils, InvariantUtils {
    SBTFactory private factory;
    MySBT private sbt;
    CustomSBTInvariantHandler private handler;
    InviteSlotInvariantHandler private inviteHandler;

    address private admin;
    address private immutableHolder;

    bytes32 private constant SBT_CREATED_TOPIC = keccak256("SBTCreated(address)");
    bytes4 private constant SOULBOUND_SELECTOR = bytes4(keccak256("Soulbound()"));

    function setUp() public {
        factory = new SBTFactory();
        admin = address(0xA11CE);
        immutableHolder = address(0xBEEF);

        bytes32[] memory empty = new bytes32[](0);
        sbt = deploySbtWithConfig("ContextEngine", "CE", 0, false, empty, bytes32(0), MySBT.BurnAuth.OwnerOnly, 0);

        vm.prank(immutableHolder);
        sbt.claim();

        handler = new CustomSBTInvariantHandler(sbt);
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = CustomSBTInvariantHandler.claim.selector;
        selectors[1] = CustomSBTInvariantHandler.burn.selector;
        selectors[2] = CustomSBTInvariantHandler.rotateAdmin.selector;
        selectors[3] = CustomSBTInvariantHandler.unauthorizedRotation.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        inviteHandler = new InviteSlotInvariantHandler();
        targetContract(address(inviteHandler));
        bytes4[] memory inviteSelectors = new bytes4[](2);
        inviteSelectors[0] = InviteSlotInvariantHandler.claim.selector;
        inviteSelectors[1] = InviteSlotInvariantHandler.burn.selector;
        targetSelector(FuzzSelector({addr: address(inviteHandler), selectors: inviteSelectors}));
    }

    function invariant_invitesStayConsumedAcrossBurnsAndArbitraryOrder() public view {
        assertFalse(inviteHandler.violation(), "invalid or duplicate authorization succeeded");
        MySBT invites = inviteHandler.SBT();
        assertEq(invites.mintedTokens(), inviteHandler.successfulClaims(), "lifetime claims track successful slots");
        for (uint256 slot = 0; slot <= 9; slot++) {
            assertTrue(invites.usedInviteSlots(slot) == inviteHandler.expectedUsed(slot), "slot consumption changed");
        }
        for (uint160 i = 0; i < 8; i++) {
            assertTrue(invites.balanceOf(address(0x1000 + i)) <= 1, "one live token per collection");
        }
    }

    function invariant_singleAdminAuthority() public view {
        assertFalse(handler.authorityViolation(), "rotation must enforce sole nonzero admin authority");
        assertEq(sbt.admin(), handler.expectedAdmin(), "admin tracks only authorized changes");
    }

    function invariant_soulbound() public {
        uint256 tokenId = sbt.getTokenIdByOwner(immutableHolder);

        vm.prank(immutableHolder);
        vm.expectRevert(SOULBOUND_SELECTOR);
        sbt.transferFrom(immutableHolder, address(0xCAFE), tokenId);
    }

    function invariant_noDoubleMint() public view {
        assertTrue(sbt.balanceOf(immutableHolder) <= 1, "immutable holder balance exceeds 1");

        uint256 actorCount = handler.actorCount();
        for (uint256 i = 0; i < actorCount; i++) {
            address actor = handler.actorAt(i);
            assertTrue(sbt.balanceOf(actor) <= 1, "tracked actor balance exceeds 1");
        }
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
}
