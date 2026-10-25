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

    function testAddSurveyRejectsZeroContentHash() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-zero-hash"));
        bytes32[] memory empty = new bytes32[](0);

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey content hash cannot be zero"));
        surveys.addSurvey(surveyId, bytes32(0), empty, empty);
    }

    function testAddSurveyRejectsZeroSurveyId() public {
        bytes32[] memory empty = new bytes32[](0);

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey ID cannot be zero"));
        surveys.addSurvey(bytes32(0), keccak256(abi.encodePacked("survey-data")), empty, empty);
    }

    function testAddSurveyDuplicateCannotReplaceCreator() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-creator-guard"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32 replacementHash = keccak256(abi.encodePacked("replacement-data"));
        bytes32[] memory empty = new bytes32[](0);

        vm.prank(creator);
        surveys.addSurvey(surveyId, surveyHash, empty, empty);

        vm.prank(otherUser);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey with this ID already exists"));
        surveys.addSurvey(surveyId, replacementHash, empty, empty);

        assertEq(surveys.surveyCreators(surveyId), creator, "duplicate changed survey creator");
    }

    function testAddQuestionsRejectsZeroContentHash() public {
        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        bytes32[] memory surveyIds = new bytes32[](1);
        questionIds[0] = keccak256(abi.encodePacked("zero-hash-question"));
        questionHashes[0] = bytes32(0);
        surveyIds[0] = bytes32(0);

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question content hash cannot be zero"));
        surveys.addQuestions(questionIds, questionHashes, surveyIds);
    }

    function testAddQuestionsRejectsZeroQuestionId() public {
        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        bytes32[] memory surveyIds = new bytes32[](1);
        questionIds[0] = bytes32(0);
        questionHashes[0] = keccak256(abi.encodePacked("question-data"));
        surveyIds[0] = bytes32(0);

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question ID cannot be zero"));
        surveys.addQuestions(questionIds, questionHashes, surveyIds);
    }

    function testAddSurveyRejectsLinkedZeroQuestionHashWithoutReservingIds() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-linked-zero"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32 questionId = keccak256(abi.encodePacked("linked-zero-question"));
        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        questionIds[0] = questionId;
        questionHashes[0] = bytes32(0);

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question content hash cannot be zero"));
        surveys.addSurvey(surveyId, surveyHash, questionIds, questionHashes);

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey does not exist"));
        surveys.getSurveyHash(surveyId);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question does not exist"));
        surveys.getQuestionHash(questionId);
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

    function testAddSurveyRejectsExistingQuestionId() public {
        bytes32 id = bytes32(uint256(1));
        bytes32 questionHash = bytes32(uint256(10));
        bytes32 responseHash = bytes32(uint256(100));
        bytes32[] memory empty = new bytes32[](0);
        vm.prank(otherUser);
        surveys.addQuestions(singleton(id), singleton(questionHash), singleton(bytes32(0)));
        vm.prank(user);
        surveys.submitResponses(singleton(id), singleton(responseHash), bytes32(0), bytes32(0));

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey ID already used by question"));
        surveys.addSurvey(id, bytes32(uint256(20)), empty, empty);

        assertEq(surveys.getQuestionHash(id), questionHash, "existing question changed");
        assertEq(surveys.surveyHashes(id), bytes32(0), "collision stored survey hash");
        assertEq(surveys.surveyCreators(id), address(0), "collision stored survey creator");
        assertEq(surveys.getResponse(user, id), responseHash, "existing question response changed");
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey does not exist"));
        surveys.getSurveyHash(id);
    }

    function testAddQuestionsRejectsExistingSurveyId() public {
        bytes32 id = bytes32(uint256(1));
        bytes32 surveyHash = bytes32(uint256(20));
        bytes32 responseHash = bytes32(uint256(200));
        bytes32[] memory empty = new bytes32[](0);
        vm.prank(creator);
        surveys.addSurvey(id, surveyHash, empty, empty);
        vm.prank(user);
        surveys.submitResponses(empty, empty, id, responseHash);

        vm.prank(otherUser);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question ID already used by survey"));
        surveys.addQuestions(singleton(id), singleton(bytes32(uint256(10))), singleton(bytes32(0)));

        assertEq(surveys.getSurveyHash(id), surveyHash, "existing survey changed");
        assertEq(surveys.surveyCreators(id), creator, "existing survey creator changed");
        assertEq(surveys.questionHashes(id), bytes32(0), "collision stored question hash");
        assertEq(surveys.getResponse(user, id), responseHash, "existing survey response changed");
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question does not exist"));
        surveys.getQuestionHash(id);
    }

    function testAddSurveyRejectsItsIdInInitialQuestionBatchAtomically() public {
        bytes32 surveyId = bytes32(uint256(1));
        bytes32 questionId = bytes32(uint256(2));
        bytes32 contentHash = bytes32(uint256(10));
        bytes32[] memory ids = new bytes32[](2);
        bytes32[] memory hashes = new bytes32[](2);
        ids[0] = questionId;
        ids[1] = surveyId;
        hashes[0] = contentHash;
        hashes[1] = contentHash;

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question ID already used by survey"));
        surveys.addSurvey(surveyId, contentHash, ids, hashes);

        assertEq(surveys.surveyHashes(surveyId), bytes32(0), "failed batch stored survey hash");
        assertEq(surveys.surveyCreators(surveyId), address(0), "failed batch stored survey creator");
        assertEq(surveys.questionHashes(questionId), bytes32(0), "failed batch stored earlier question");
        assertEq(surveys.questionHashes(surveyId), bytes32(0), "failed batch stored colliding question");
        assertEq(surveys.questionToSurvey(questionId), bytes32(0), "failed batch linked earlier question");
        surveys.addSurvey(surveyId, contentHash, singleton(questionId), singleton(contentHash));
        assertEq(surveys.getQuestionSurvey(questionId), surveyId, "rolled-back IDs were not reusable");
    }

    function testAddSurveyRejectsExistingSurveyInInitialQuestionBatchAtomically() public {
        bytes32 existingSurveyId = bytes32(uint256(1));
        bytes32 newSurveyId = bytes32(uint256(2));
        bytes32 questionId = bytes32(uint256(3));
        bytes32 contentHash = bytes32(uint256(10));
        bytes32[] memory empty = new bytes32[](0);
        surveys.addSurvey(existingSurveyId, contentHash, empty, empty);
        bytes32[] memory ids = new bytes32[](2);
        bytes32[] memory hashes = new bytes32[](2);
        ids[0] = questionId;
        ids[1] = existingSurveyId;
        hashes[0] = contentHash;
        hashes[1] = contentHash;

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question ID already used by survey"));
        surveys.addSurvey(newSurveyId, contentHash, ids, hashes);

        assertEq(surveys.surveyCreators(newSurveyId), address(0), "failed batch reserved new survey");
        assertEq(surveys.questionHashes(questionId), bytes32(0), "failed batch stored earlier question");
        assertEq(surveys.questionToSurvey(questionId), bytes32(0), "failed batch linked earlier question");
        assertEq(surveys.getSurveyHash(existingSurveyId), contentHash, "existing survey changed");
        surveys.addSurvey(newSurveyId, contentHash, singleton(questionId), singleton(contentHash));
        assertEq(surveys.getQuestionSurvey(questionId), newSurveyId, "rolled-back IDs were not reusable");
    }

    function testAddQuestionsRejectsSurveyIdInMixedBatchAtomically() public {
        bytes32 surveyId = bytes32(uint256(1));
        bytes32 questionId = bytes32(uint256(2));
        bytes32 contentHash = bytes32(uint256(10));
        bytes32[] memory empty = new bytes32[](0);
        surveys.addSurvey(surveyId, contentHash, empty, empty);
        bytes32[] memory ids = new bytes32[](2);
        bytes32[] memory hashes = new bytes32[](2);
        bytes32[] memory surveyIds = new bytes32[](2);
        ids[0] = questionId;
        ids[1] = surveyId;
        hashes[0] = contentHash;
        hashes[1] = contentHash;
        surveyIds[0] = surveyId;

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question ID already used by survey"));
        surveys.addQuestions(ids, hashes, surveyIds);

        assertEq(surveys.questionHashes(questionId), bytes32(0), "failed batch stored earlier question");
        assertEq(surveys.questionToSurvey(questionId), bytes32(0), "failed batch linked earlier question");
        assertEq(surveys.questionHashes(surveyId), bytes32(0), "failed batch stored colliding question");
        assertEq(surveys.getSurveyHash(surveyId), contentHash, "existing survey changed");
        surveys.addQuestions(singleton(questionId), singleton(contentHash), singleton(surveyId));
        assertEq(surveys.getQuestionHash(questionId), contentHash, "rolled-back question ID was not reusable");
    }

    function testDistinctIdsKeepSurveyAndQuestionResponseUpdatesSeparate() public {
        bytes32 surveyId = bytes32(uint256(1));
        bytes32 questionId = bytes32(uint256(2));
        bytes32 contentHash = bytes32(uint256(10));
        bytes32 questionResponse = bytes32(uint256(100));
        bytes32 surveyResponse = bytes32(uint256(200));
        bytes32[] memory empty = new bytes32[](0);
        surveys.addSurvey(surveyId, contentHash, singleton(questionId), singleton(contentHash));
        vm.prank(user);
        surveys.submitResponses(singleton(questionId), singleton(questionResponse), surveyId, surveyResponse);
        assertEq(surveys.getResponse(user, questionId), questionResponse, "question response collided");
        assertEq(surveys.getResponse(user, surveyId), surveyResponse, "survey response collided");

        questionResponse = bytes32(uint256(101));
        vm.prank(user);
        surveys.submitResponses(singleton(questionId), singleton(questionResponse), bytes32(0), bytes32(0));
        assertEq(surveys.getResponse(user, surveyId), surveyResponse, "question update changed survey response");
        surveyResponse = bytes32(uint256(201));
        vm.prank(user);
        surveys.submitResponses(empty, empty, surveyId, surveyResponse);
        assertEq(surveys.getResponse(user, questionId), questionResponse, "survey update changed question response");
        assertEq(surveys.userResponses(user, surveyId), surveyResponse, "survey update did not persist");
    }

    function singleton(bytes32 value) internal pure returns (bytes32[] memory values) {
        values = new bytes32[](1);
        values[0] = value;
    }

    function testSubmitResponsesRejectsZeroQuestionResponseHash() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-zero-response"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32 questionId = keccak256(abi.encodePacked("question-zero-response"));
        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        questionIds[0] = questionId;
        questionHashes[0] = keccak256(abi.encodePacked("question-data"));
        surveys.addSurvey(surveyId, surveyHash, questionIds, questionHashes);

        bytes32[] memory responseHashes = new bytes32[](1);
        responseHashes[0] = bytes32(0);

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Question response hash cannot be zero"));
        surveys.submitResponses(questionIds, responseHashes, bytes32(0), bytes32(0));
    }

    function testSubmitResponsesRejectsMismatchedSurveyResponsePairs() public {
        bytes32 surveyId = keccak256(abi.encodePacked("survey-mismatched-response"));
        bytes32 surveyHash = keccak256(abi.encodePacked("survey-data"));
        bytes32 questionId = keccak256(abi.encodePacked("question-mismatched-response"));
        bytes32[] memory questionIds = new bytes32[](1);
        bytes32[] memory questionHashes = new bytes32[](1);
        questionIds[0] = questionId;
        questionHashes[0] = keccak256(abi.encodePacked("question-data"));
        surveys.addSurvey(surveyId, surveyHash, questionIds, questionHashes);

        bytes32[] memory responseHashes = new bytes32[](1);
        responseHashes[0] = keccak256(abi.encodePacked("response-data"));

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey response ID/hash mismatch"));
        surveys.submitResponses(questionIds, responseHashes, surveyId, bytes32(0));

        vm.expectRevert(abi.encodeWithSignature("Error(string)", "Survey response ID/hash mismatch"));
        surveys.submitResponses(
            questionIds,
            responseHashes,
            bytes32(0),
            keccak256(abi.encodePacked("survey-response-data"))
        );
    }
}
