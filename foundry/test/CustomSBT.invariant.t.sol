// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/SBTFactory.sol";
import "../../contracts/CustomSBT.sol";

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

    address[] private actors;
    mapping(address => bool) private knownActor;

    constructor(MySBT sbt_) {
        sbt = sbt_;
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

contract CustomSBTInvariantTest is TestUtils, InvariantUtils {
    SBTFactory private factory;
    MySBT private sbt;
    CustomSBTInvariantHandler private handler;

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

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = CustomSBTInvariantHandler.claim.selector;
        selectors[1] = CustomSBTInvariantHandler.burn.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
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
