import React from 'react';
import { render } from '@testing-library/react';

import SurveyResultsQuestionSummariesList from './SurveyResultsQuestionSummariesList';
import SurveyResultsQuestionSummariesPanel from './SurveyResultsQuestionSummariesPanel';

const findFirstNodeByType = (node: any, type: any): any => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) stack.push(current[i]);
      continue;
    }
    if (typeof current !== 'object') continue;
    if (current.type === type) return current;
    const children = current.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const baseProps = {
  filterLoading: false,
  renderQuestionSummary: jest.fn((questionId: string) => <div>{questionId}</div>),
  styleMap: { questionSummaries: 'questionSummaries' },
};

describe('SurveyResultsQuestionSummariesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes survey aggregate entries to the summary list', () => {
    const tree = SurveyResultsQuestionSummariesPanel({
      ...baseProps,
      surveyAggregateEntries: [['q1', [{ answer: 'survey' }]]],
      surveyViewMode: 'aggregate',
      viewMode: 'survey',
    });
    const list = findFirstNodeByType(tree, SurveyResultsQuestionSummariesList);

    expect(list?.props?.entries).toEqual([['q1', [{ answer: 'survey' }]]]);
    expect(list?.props?.renderQuestionSummary).toBe(baseProps.renderQuestionSummary);
  });

  it('routes question-mode entries to the summary list', () => {
    const tree = SurveyResultsQuestionSummariesPanel({
      ...baseProps,
      questionModeEntries: [['q2', [{ answer: 'question' }]]],
      surveyViewMode: 'aggregate',
      viewMode: 'questions',
    });
    const list = findFirstNodeByType(tree, SurveyResultsQuestionSummariesList);

    expect(list?.props?.entries).toEqual([['q2', [{ answer: 'question' }]]]);
  });

  it('does not render summaries outside aggregate or question modes', () => {
    const { container } = render(
      <SurveyResultsQuestionSummariesPanel
        {...baseProps}
        surveyAggregateEntries={[['q1', []]]}
        surveyViewMode="individuals"
        viewMode="survey"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
