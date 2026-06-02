import React from 'react';

import SingleQuestionResponse from './SingleQuestionResponse';
import { renderSurveyResultsDisplayPanels } from './SurveyResultsDisplayPanels';
import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';
import SurveyResultsQuestionListCard from './SurveyResultsQuestionListCard';
import SurveyResultsQuestionSummariesList from './SurveyResultsQuestionSummariesList';
import SurveyResultsStatusMessages from './SurveyResultsStatusMessages';
import SurveyResultsSurveyViewModeToggle from './SurveyResultsSurveyViewModeToggle';

const findFirstNodeByType = (node, type) => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (current.type === type) return current;
    const children = current.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const defaultStyleMap = {
  alertMessage: 'alertMessage',
  aggregatorDarkCardBody: 'aggregatorDarkCardBody',
  biggerIcon: 'biggerIcon',
  clickableQuestionId: 'clickableQuestionId',
  externalLink: 'externalLink',
  loadingContainer: 'loadingContainer',
  promptColumn: 'promptColumn',
  questionIdTable: 'questionIdTable',
  questionIdTableWrapper: 'questionIdTableWrapper',
  questionListCard: 'questionListCard',
  questionSummaries: 'questionSummaries',
  questionSummaryHeader: 'questionSummaryHeader',
  questionTitle: 'questionTitle',
  responseCard: 'responseCard',
  responseHeader: 'responseHeader',
  responseList: 'responseList',
  responderAddress: 'responderAddress',
  responderLink: 'responderLink',
  singleResponseCard: 'singleResponseCard',
  surveyResultsCollapse: 'surveyResultsCollapse',
  surveyResultsOverride: 'surveyResultsOverride',
  tableActionButton: 'tableActionButton',
};

const baseProps = {
  account: '',
  activeQuestionToggles: {},
  activeToggles: {},
  alertMessage: '',
  applyDecryptedOverrideToResponse: jest.fn(({ response }) => response),
  currentSurveyId: 'survey-1',
  effectiveSlug: 'session-one',
  filterControlsNode: <div data-testid="filters">Filters</div>,
  filterLoading: false,
  filterSummaryDisplay: {
    displayedTotalQuestionsCount: 0,
    displayedTotalResponsesCount: 0,
    normalizedFilteredQuestionsCount: 0,
    normalizedFilteredResponsesCount: 0,
    showFilteredCountSpinner: false,
  },
  getFallbackQuestion: jest.fn((questionId) => ({ id: questionId, prompt: 'Fallback', type: 'freeform' })),
  getLockedResponseKey: jest.fn(() => 'locked-key'),
  getResponseCardProps: jest.fn(() => ({
    containerClassName: 'response-card',
    bodyClassName: 'response-body',
  })),
  lockedResponsesBannerNode: <div data-testid="locked">Locked</div>,
  network: { id: 84532 },
  onSurveyViewModeKeyDown: jest.fn(),
  onSurveyViewModeToggle: jest.fn(),
  onToggleQuestionList: jest.fn(),
  onToggleResponse: jest.fn(),
  preNetworkQuestions: {},
  questionListDisplay: {
    shouldRenderQuestionTable: false,
    showEmptyState: true,
  },
  questionModeEntries: [],
  questionResponsesNonce: 1,
  questionsCacheNonce: 2,
  renderQuestionSummary: jest.fn((questionId) => <div>{questionId}</div>),
  renderQuestionTable: jest.fn(() => <table><tbody /></table>),
  responses: [],
  sbtCacheRevision: 3,
  styleMap: defaultStyleMap,
  surveyAggregateEntries: [],
  surveyViewMode: 'aggregate',
  viewMode: 'survey',
};

describe('SurveyResultsDisplayPanels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the status, toggle, question-list, filter, and aggregate panels', () => {
    const renderQuestionSummary = jest.fn((questionId) => <div>{questionId}</div>);
    const renderQuestionTable = jest.fn(() => <table><tbody /></table>);

    const tree = renderSurveyResultsDisplayPanels({
      ...baseProps,
      activeQuestionToggles: { __questionList__: true },
      filterSummaryDisplay: {
        ...baseProps.filterSummaryDisplay,
        displayedTotalQuestionsCount: 2,
        displayedTotalResponsesCount: 4,
      },
      questionListDisplay: {
        shouldRenderQuestionTable: true,
        showEmptyState: false,
      },
      renderQuestionSummary,
      renderQuestionTable,
      surveyAggregateEntries: [['q1', [{ answer: 'yes' }]]],
      viewMode: 'survey',
      surveyViewMode: 'aggregate',
    });
    const status = findFirstNodeByType(tree, SurveyResultsStatusMessages);
    const toggle = findFirstNodeByType(tree, SurveyResultsSurveyViewModeToggle);
    const questionList = findFirstNodeByType(tree, SurveyResultsQuestionListCard);
    const summaries = findFirstNodeByType(tree, SurveyResultsQuestionSummariesList);

    expect(status?.props?.styleMap).toBe(defaultStyleMap);
    expect(toggle?.props?.isAggregate).toBe(true);
    expect(questionList?.props?.title).toBe(' View & Sort Questions');
    expect(questionList?.props?.questionTableNode.type).toBe('table');
    expect(summaries?.props?.entries).toEqual([['q1', [{ answer: 'yes' }]]]);

    questionList.props.onToggle();
    summaries.props.renderQuestionSummary('q1', [{ answer: 'yes' }]);

    expect(baseProps.onToggleQuestionList).toHaveBeenCalledTimes(1);
    expect(renderQuestionSummary).toHaveBeenCalledWith('q1', [{ answer: 'yes' }]);
    expect(renderQuestionTable).toHaveBeenCalledTimes(1);
  });

  it('routes question mode entries to the question summary list', () => {
    const tree = renderSurveyResultsDisplayPanels({
      ...baseProps,
      questionModeEntries: [['q2', [{ answer: 'question' }]]],
      viewMode: 'questions',
      surveyViewMode: 'aggregate',
    });

    const summaries = findFirstNodeByType(tree, SurveyResultsQuestionSummariesList);
    const questionList = findFirstNodeByType(tree, SurveyResultsQuestionListCard);

    expect(questionList?.props?.title).toBe('View & Sort Questions');
    expect(summaries?.props?.entries).toEqual([['q2', [{ answer: 'question' }]]]);
  });

  it('routes individual mode responses and preserves response-card display args', () => {
    const applyDecryptedOverrideToResponse = jest.fn(({ response }) => ({
      ...response,
      answer: { value: 'Decrypted answer' },
    }));
    const getLockedResponseKey = jest.fn(() => 'response-key');
    const getResponseCardProps = jest.fn(() => ({
      containerClassName: 'response-card',
      bodyClassName: 'response-body',
    }));
    const tree = renderSurveyResultsDisplayPanels({
      ...baseProps,
      account: '0xabc',
      activeToggles: { 0: true },
      applyDecryptedOverrideToResponse,
      getLockedResponseKey,
      getResponseCardProps,
      preNetworkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Question one',
          sessionSlug: 'question-session',
          type: 'freeform',
        },
      },
      responses: [{
        responder: '0xABC',
        surveyId: 'survey-1',
        response: {
          responses: [{
            questionID: 'q1',
            answer: { value: 'Locked answer' },
          }],
        },
      }],
      surveyViewMode: 'individuals',
      viewMode: 'survey',
    });
    const individualList = findFirstNodeByType(tree, SurveyResultsIndividualResponsesList);
    const responseBody = individualList.props.renderResponseBody(individualList.props.responses[0], 0);
    const responseCard = findFirstNodeByType(responseBody, SingleQuestionResponse);

    expect(individualList?.props?.responses).toHaveLength(1);
    expect(responseCard?.props?.question.prompt).toBe('Question one');
    expect(responseCard?.props?.response.answer.value).toBe('Decrypted answer');
    expect(responseCard?.props?.isOwnResponse).toBe(true);
    expect(responseCard?.props?.activeSessionSlug).toBe('question-session');
    expect(responseCard?.props?.containerClassName).toBe('response-card');
    expect(getLockedResponseKey).toHaveBeenCalledWith({
      responder: '0xABC',
      questionId: 'q1',
      surveyId: 'survey-1',
      response: {
        questionID: 'q1',
        answer: { value: 'Locked answer' },
      },
    });
    expect(applyDecryptedOverrideToResponse).toHaveBeenCalledWith({
      response: {
        questionID: 'q1',
        answer: { value: 'Locked answer' },
      },
      key: 'response-key',
    });
    expect(getResponseCardProps).toHaveBeenCalledTimes(1);
  });

  it('renders cached response rows with fallback question metadata when the question cache is missing', () => {
    const applyDecryptedOverrideToResponse = jest.fn(({ response }) => response);
    const getFallbackQuestion = jest.fn((questionId) => ({
      id: questionId,
      prompt: `Fallback ${questionId}`,
      type: 'freeform',
    }));
    const getLockedResponseKey = jest.fn(() => 'fallback-response-key');
    const getResponseCardProps = jest.fn(() => ({
      containerClassName: 'response-card',
      bodyClassName: 'response-body',
    }));
    const onToggleResponse = jest.fn();
    const tree = renderSurveyResultsDisplayPanels({
      ...baseProps,
      applyDecryptedOverrideToResponse,
      getFallbackQuestion,
      getLockedResponseKey,
      getResponseCardProps,
      onToggleResponse,
      preNetworkQuestions: {},
      responses: [{
        responder: '0xDEF',
        surveyId: 'survey-1',
        response: {
          responses: [{
            questionID: 'q-missing',
            answer: { value: 'Cached answer' },
          }],
        },
      }],
      surveyViewMode: 'individuals',
      viewMode: 'survey',
    });
    const individualList = findFirstNodeByType(tree, SurveyResultsIndividualResponsesList);
    const responseBody = individualList.props.renderResponseBody(individualList.props.responses[0], 0);
    const responseCard = findFirstNodeByType(responseBody, SingleQuestionResponse);

    expect(individualList?.props?.responses).toHaveLength(1);
    expect(responseCard?.props?.question).toEqual({
      id: 'q-missing',
      prompt: 'Fallback q-missing',
      type: 'freeform',
    });
    expect(responseCard?.props?.response.answer.value).toBe('Cached answer');
    expect(responseCard?.props?.activeSessionSlug).toBe('session-one');
    expect(getFallbackQuestion).toHaveBeenCalledWith('q-missing', 'individual');
    expect(getLockedResponseKey).toHaveBeenCalledWith({
      responder: '0xDEF',
      questionId: 'q-missing',
      surveyId: 'survey-1',
      response: {
        questionID: 'q-missing',
        answer: { value: 'Cached answer' },
      },
    });
    expect(applyDecryptedOverrideToResponse).toHaveBeenCalledWith({
      response: {
        questionID: 'q-missing',
        answer: { value: 'Cached answer' },
      },
      key: 'fallback-response-key',
    });
    expect(getResponseCardProps).toHaveBeenCalledTimes(1);
    expect(onToggleResponse).not.toHaveBeenCalled();
  });
});
