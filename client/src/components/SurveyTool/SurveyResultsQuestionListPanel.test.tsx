import React from 'react';
import { render } from '@testing-library/react';

import SurveyResultsQuestionListCard from './SurveyResultsQuestionListCard';
import SurveyResultsQuestionListPanel from './SurveyResultsQuestionListPanel';

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
  activeQuestionToggles: { __questionList__: true },
  onToggleQuestionList: jest.fn(),
  questionListDisplay: {
    shouldRenderQuestionTable: true,
    showEmptyState: false,
  },
  renderQuestionTable: jest.fn(() => (
    <table>
      <tbody />
    </table>
  )),
  styleMap: { questionListCard: 'questionListCard' },
};

describe('SurveyResultsQuestionListPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the survey aggregate question list with the table wrapper ref', () => {
    const tableWrapperRef = React.createRef<HTMLDivElement>();
    const tree = SurveyResultsQuestionListPanel({
      ...baseProps,
      surveyViewMode: 'aggregate',
      tableWrapperRef,
      viewMode: 'survey',
    });
    const card = findFirstNodeByType(tree, SurveyResultsQuestionListCard);

    expect(card?.props?.title).toBe(' View & Sort Questions');
    expect(card?.props?.isOpen).toBe(true);
    expect(card?.props?.questionTableNode.type).toBe('table');
    expect(card?.props?.tableWrapperRef).toBe(tableWrapperRef);
  });

  it('renders the questions mode question list without a survey table wrapper ref', () => {
    const tableWrapperRef = React.createRef<HTMLDivElement>();
    const tree = SurveyResultsQuestionListPanel({
      ...baseProps,
      surveyViewMode: 'aggregate',
      tableWrapperRef,
      viewMode: 'questions',
    });
    const card = findFirstNodeByType(tree, SurveyResultsQuestionListCard);

    expect(card?.props?.title).toBe('View & Sort Questions');
    expect(card?.props?.tableWrapperRef).toBeUndefined();
  });

  it('does not render outside survey aggregate or questions modes', () => {
    const { container } = render(
      <SurveyResultsQuestionListPanel {...baseProps} surveyViewMode="individuals" viewMode="survey" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
