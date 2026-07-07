// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestUtils.sol";
import "../../contracts/Surveys.sol";

contract SurveysTest is TestUtils {
    Surveys private surveys;
    address private user = address(0xBEEF);
    address private creator = address(0xA11CE);
    address private otherUser = address(0xCAFE);

    function setUp() public {
        surveys = new Surveys();
    }

    function testAddSurveyAndQuestionsStoresHashes() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-1"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));

        bytes32[] memory questionIds = new bytes32[](2);
        bytes32[] memory questionHashes = new bytes32[](2);
        questionIds[0] = keccak256(abi.encodePacked("question-1"));
        questionIds[1] = keccak256(abi.encodePacked("question-2"));
        questionHashes[0] = keccak256(abi.encodePacked("question-data-1"));
        questionHashes[1] = keccak256(abi.encodePacked("question-data-2"));

        surveys.addSurvey(surveyId, surveyHash, questionIds, questionHashes);

        assertEq(surveys.surveyHashes(surveyId), surveyHash, "survey hash mismatch");
        assertEq(surveys.questionHashes(questionIds[0]), questionHashes[0], "question hash mismatch");
        assertEq(surveys.questionToSurvey(questionIds[0]), surveyId, "question->survey mismatch");
    }

    function testAddSurveyDuplicateReverts() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-dupe"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32[] memory empty = new bytes32[](0);

        surveys.addSurvey(surveyId, surveyHash, empty, empty);

        (bool ok,) = address(surveys).call(
            abi.encodeWithSignature(
                "addSurvey(bytes32,bytes32,bytes32[],bytes32[])",
                surveyId,
                surveyHash,
                empty,
                empty
            )
        );
        assertFalse(ok, "expected duplicate survey to revert");
    }

    function testAddQuestionsStandaloneAndAssociated() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-standalone"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32[] memory empty = new bytes32[](0);
        surveys.addSurvey(surveyId, surveyHash, empty, empty);

        bytes32[] memory questionIds = new bytes32[](2);
        bytes32[] memory hashes = new bytes32[](2);
        bytes32[] memory surveyIds = new bytes32[](2);

        questionIds[0] = keccak256(abi.encodePacked("standalone-q"));
        hashes[0] = keccak256(abi.encodePacked("standalone-hash"));
        surveyIds[0] = bytes32(0);

        questionIds[1] = keccak256(abi.encodePacked("linked-q"));
        hashes[1] = keccak256(abi.encodePacked("linked-hash"));
        surveyIds[1] = surveyId;

        surveys.addQuestions(questionIds, hashes, surveyIds);

        assertEq(surveys.questionToSurvey(questionIds[0]), bytes32(0), "standalone should be zero");
        assertEq(surveys.questionToSurvey(questionIds[1]), surveyId, "linked survey mismatch");
    }

    function testAddQuestionsToSurveyRequiresCreator() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-access-control"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32[] memory empty = new bytes32[](0);

        vm.prank(creator);
        surveys.addSurvey(surveyId, surveyHash, empty, empty);

        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        bytes32[] memory surveyIds = new bytes32[](1);
        questionIds[0] = keccak256(abi.encodePacked("restricted-question"));
        questionHashes[0] = keccak256(abi.encodePacked("restricted-question-hash"));
        surveyIds[0] = surveyId;

        vm.prank(otherUser);
        (bool ok, bytes memory revertData) = address(surveys).call(
            abi.encodeWithSignature(
                "addQuestions(bytes32[],bytes32[],bytes32[])",
                questionIds,
                questionHashes,
                surveyIds
            )
        );

        assertFalse(ok, "non-creator should not add linked questions");
        assertEq(
            keccak256(revertData),
            keccak256(abi.encodeWithSignature("Error(string)", "Only survey creator can add questions")),
            "revert reason mismatch"
        );
        assertEq(surveys.questionHashes(questionIds[0]), bytes32(0), "restricted question should not be stored");
    }

    function testAddQuestionsStandaloneRemainsOpen() public {
        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        bytes32[] memory surveyIds = new bytes32[](1);
        questionIds[0] = keccak256(abi.encodePacked("standalone-open-question"));
        questionHashes[0] = keccak256(abi.encodePacked("standalone-open-hash"));
        surveyIds[0] = bytes32(0);

        vm.prank(otherUser);
        surveys.addQuestions(questionIds, questionHashes, surveyIds);

        assertEq(surveys.questionHashes(questionIds[0]), questionHashes[0], "standalone question hash mismatch");
        assertEq(surveys.questionToSurvey(questionIds[0]), bytes32(0), "standalone question should remain unlinked");
    }

    function testSubmitResponsesStoresHashes() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-response"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32 questionId = keccak256(abi.encodePacked("question-response"));
        bytes32 questionHash = keccak256(abi.encodePacked("question-data"));

        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        questionIds[0] = questionId;
        questionHashes[0] = questionHash;

        surveys.addSurvey(surveyId, surveyHash, questionIds, questionHashes);

        bytes32 responseHash = keccak256(abi.encodePacked("response-data"));
        bytes32 surveyResponseHash = keccak256(abi.encodePacked("survey-response-data"));
        bytes32[] memory responseHashes = new bytes32[](1);
        responseHashes[0] = responseHash;

        vm.prank(user);
        surveys.submitResponses(questionIds, responseHashes, surveyId, surveyResponseHash);

        assertEq(
            surveys.userResponses(user, questionId),
            responseHash,
            "question response mismatch"
        );
        assertEq(
            surveys.userResponses(user, surveyId),
            surveyResponseHash,
            "survey response mismatch"
        );
    }
}
