// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/Surveys.sol";

contract SurveysFuzzTest is TestUtils {
    Surveys private surveys;
    address private creator;

    function setUp() public {
        surveys = new Surveys();
        creator = address(0xA11CE);
    }

    function testFuzz_addSurvey_noDuplicate(bytes32 id) public {
        fuzz_addSurvey_noDuplicate(id);
    }

    function testFuzz_submitResponses_anyUser(address user) public {
        fuzz_submitResponses_anyUser(user);
    }

    function fuzz_addSurvey_noDuplicate(bytes32 id) internal {
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-hash", id));
        bytes32[] memory empty = new bytes32[](0);

        surveys.addSurvey(id, surveyHash, empty, empty);

        (bool ok,) = address(surveys).call(
            abi.encodeWithSelector(surveys.addSurvey.selector, id, surveyHash, empty, empty)
        );

        assertFalse(ok, "duplicate survey IDs should revert");
        assertEq(surveys.surveyHashes(id), surveyHash, "stored survey hash should remain unchanged");
    }

    function fuzz_submitResponses_anyUser(address user) internal {
        user = normalizeUser(user);

        bytes32 surveyId = keccak256(abi.encodePacked("survey", user));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-hash", user));
        bytes32 questionId = keccak256(abi.encodePacked("question", user));
        bytes32 questionHash = keccak256(abi.encodePacked("question-hash", user));

        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        questionIds[0] = questionId;
        questionHashes[0] = questionHash;

        vm.prank(creator);
        surveys.addSurvey(surveyId, surveyHash, questionIds, questionHashes);

        bytes32 responseHash = keccak256(abi.encodePacked("response-hash", user));
        bytes32 surveyResponseHash = keccak256(abi.encodePacked("survey-response-hash", user));
        bytes32[] memory responseHashes = new bytes32[](1);
        responseHashes[0] = responseHash;

        vm.prank(user);
        surveys.submitResponses(questionIds, responseHashes, surveyId, surveyResponseHash);

        assertEq(surveys.userResponses(user, questionId), responseHash, "question response hash mismatch");
        assertEq(surveys.userResponses(user, surveyId), surveyResponseHash, "survey response hash mismatch");
    }

    function normalizeUser(address user) internal pure returns (address normalized) {
        normalized = address(uint160(uint256(keccak256(abi.encodePacked(user)))));
        if (normalized == address(0)) {
            normalized = address(0xBEEF);
        }
    }
}
