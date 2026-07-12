//  ________  ________  ________   _________  _______      ___    ___ _________
// |\   ____\|\   __  \|\   ___  \|\___   ___|\  ___ \    |\  \  /  /|\___   ___\
// \ \  \___|\ \  \|\  \ \  \\ \  \|___ \  \_\ \   __/|   \ \  \/  / \|___ \  \_|
//  \ \  \    \ \  \\\  \ \  \\ \  \   \ \  \ \ \  \_|/__  \ \    / /     \ \  \
//   \ \  \____\ \  \\\  \ \  \\ \  \   \ \  \ \ \  \_|\ \  /     \/       \ \  \
//    \ \_______\ \_______\ \__\\ \__\   \ \__\ \ \_______\/  /\   \        \ \__\
//     \|_______|\|_______|\|__| \|__|    \|__|  \|_______/__/ /\ __\        \|__|
//  _______   ________   ________  ___  ________   _______|__|/ \|__|
// |\  ___ \ |\   ___  \|\   ____\|\  \|\   ___  \|\  ___ \
// \ \   __/|\ \  \\ \  \ \  \___|\ \  \ \  \\ \  \ \   __/|
//  \ \  \_|/_\ \  \\ \  \ \  \  __\ \  \ \  \\ \  \ \  \_|/__
//   \ \  \_|\ \ \  \\ \  \ \  \|\  \ \  \ \  \\ \  \ \  \_|\ \
//    \ \_______\ \__\\ \__\ \_______\ \__\ \__\\ \__\ \_______\
//     \|_______|\|__| \|__|\|_______|\|__|\|__| \|__|\|_______|

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Enhanced Survey and Question Management on Ethereum
/// @author Context Engine (Beta)
/// @notice This contract allows users to create surveys, standalone questions, and submit responses, with off-chain storage via Arweave.
contract Surveys {
    // Storage
    mapping(bytes32 => bytes32) public surveyHashes; // surveyId => contentHash
    mapping(bytes32 => address) public surveyCreators; // surveyId => creator
    mapping(bytes32 => bytes32) public questionHashes; // questionId => contentHash
    mapping(bytes32 => bytes32) public questionToSurvey; // questionId => surveyId (optional)
    mapping(address => mapping(bytes32 => bytes32)) public userResponses; // User address => (questionId or surveyId) => responseHash

    // Events
    event SurveyAdded(address indexed creator, bytes32 indexed surveyId);
    event QuestionsAdded(address indexed creator, bytes32[] questionIds, bytes32[] surveyIds);
    event ResponsesSubmitted(address indexed responder, bytes32[] questionIds, bytes32 indexed surveyId);

    /// @notice Adds a new survey with its initial question set.
    /// @dev The caller becomes the recorded survey creator and can add more linked questions later.
    /// @param surveyId The unique hash ID of the survey.
    /// @param surveyContentHash The hash pointing to the stored survey data.
    /// @param questionIds The hash IDs of the initial questions.
    /// @param questionContentHashes The hashes pointing to the stored question data.
    function addSurvey(
        bytes32 surveyId,
        bytes32 surveyContentHash,
        bytes32[] calldata questionIds,
        bytes32[] calldata questionContentHashes
    ) external {
        require(surveyContentHash != bytes32(0), "Invalid survey content hash");
        require(surveyHashes[surveyId] == bytes32(0), "Survey with this ID already exists");
        surveyHashes[surveyId] = surveyContentHash;
        surveyCreators[surveyId] = msg.sender;

        bytes32[] memory surveyIds = new bytes32[](questionIds.length);
        for (uint256 i = 0; i < questionIds.length; i++) {
            surveyIds[i] = surveyId;
        }

        addQuestions(questionIds, questionContentHashes, surveyIds);
        emit SurveyAdded(msg.sender, surveyId);
    }

    /// @notice Adds new questions, optionally linking each one to a survey.
    /// @dev Linked questions can only be added by the creator of the associated survey.
    /// @param questionIds The unique hash IDs of the questions.
    /// @param contentHashes The hashes pointing to the stored question data.
    /// @param surveyIds The survey IDs to associate with each question, or `bytes32(0)` for standalone questions.
    function addQuestions(bytes32[] memory questionIds, bytes32[] memory contentHashes, bytes32[] memory surveyIds)
        public
    {
        require(
            questionIds.length == contentHashes.length && questionIds.length == surveyIds.length,
            "Array lengths must match"
        );

        for (uint256 i = 0; i < questionIds.length; i++) {
            require(contentHashes[i] != bytes32(0), "Invalid question content hash");
            require(questionHashes[questionIds[i]] == bytes32(0), "Question with this ID already exists");
            questionHashes[questionIds[i]] = contentHashes[i];

            if (surveyIds[i] != bytes32(0)) {
                require(surveyHashes[surveyIds[i]] != bytes32(0), "Associated survey does not exist");
                require(msg.sender == surveyCreators[surveyIds[i]], "Only survey creator can add questions");
                questionToSurvey[questionIds[i]] = surveyIds[i];
            }
        }

        emit QuestionsAdded(msg.sender, questionIds, surveyIds);
    }

    /// @notice Submits or updates response hashes for multiple questions and an optional survey response.
    /// @dev Each response hash is stored under the caller address and overwrites any prior value for the same ID.
    /// @param questionIds The question IDs the response hashes belong to.
    /// @param questionResponseHashes The hashes pointing to stored question response payloads.
    /// @param surveyId The survey ID for an optional survey-level response, or zero when omitted.
    /// @param surveyResponseHash The hash pointing to the stored survey response payload, or zero when omitted.
    function submitResponses(
        bytes32[] calldata questionIds,
        bytes32[] calldata questionResponseHashes,
        bytes32 surveyId,
        bytes32 surveyResponseHash
    ) external {
        require(questionIds.length == questionResponseHashes.length, "Array lengths must match");

        for (uint256 i = 0; i < questionIds.length; i++) {
            require(questionHashes[questionIds[i]] != bytes32(0), "Question does not exist");
            userResponses[msg.sender][questionIds[i]] = questionResponseHashes[i];
        }

        if (surveyId != bytes32(0) && surveyResponseHash != bytes32(0)) {
            require(surveyHashes[surveyId] != bytes32(0), "Survey does not exist");
            userResponses[msg.sender][surveyId] = surveyResponseHash;
        }

        emit ResponsesSubmitted(msg.sender, questionIds, surveyId);
    }

    /// @notice Returns the stored response hash for a user and question or survey ID.
    /// @dev Returns `bytes32(0)` when no response has been stored for that user and ID.
    /// @param user The address of the user whose response is being queried.
    /// @param id The question ID or survey ID to query.
    /// @return The hash pointing to the stored response payload.
    function getResponse(address user, bytes32 id) external view returns (bytes32) {
        return userResponses[user][id];
    }

    /// @notice Returns the stored content hash for a question.
    /// @dev Reverts when the question ID has not been registered.
    /// @param questionId The ID of the question to query.
    /// @return The hash pointing to the stored question content.
    function getQuestionHash(bytes32 questionId) external view returns (bytes32) {
        require(questionHashes[questionId] != bytes32(0), "Question does not exist");
        return questionHashes[questionId];
    }

    /// @notice Returns the stored content hash for a survey.
    /// @dev Reverts when the survey ID has not been registered.
    /// @param surveyId The ID of the survey to query.
    /// @return The hash pointing to the stored survey content.
    function getSurveyHash(bytes32 surveyId) external view returns (bytes32) {
        require(surveyHashes[surveyId] != bytes32(0), "Survey does not exist");
        return surveyHashes[surveyId];
    }

    /// @notice Returns the survey associated with a question, if any.
    /// @dev Standalone questions return `bytes32(0)`.
    /// @param questionId The ID of the question to query.
    /// @return The associated survey ID, or `bytes32(0)` for standalone questions.
    function getQuestionSurvey(bytes32 questionId) external view returns (bytes32) {
        return questionToSurvey[questionId];
    }
}
