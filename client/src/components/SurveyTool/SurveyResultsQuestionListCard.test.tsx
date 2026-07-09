import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsQuestionListCard from './SurveyResultsQuestionListCard';

const styleMap = {
  aggregatorDarkCardBody: 'aggregatorDarkCardBody',
  biggerIcon: 'biggerIcon',
  questionListCard: 'questionListCard',
  questionSummaryHeader: 'questionSummaryHeader',
  questionTitle: 'questionTitle',
  surveyResultsCollapse: 'surveyResultsCollapse',
};

describe('SurveyResultsQuestionListCard', () => {
  it('renders the empty question state without table content', () => {
    render(
      <SurveyResultsQuestionListCard
        isOpen={true}
        onToggle={jest.fn()}
        questionTableNode={<div>Question table</div>}
        showEmptyState={true}
        styleMap={styleMap}
        title="View & Sort Questions"
      />,
    );

    expect(screen.getByText('No questions found.')).toBeInTheDocument();
    expect(screen.queryByText('Question table')).not.toBeInTheDocument();
  });

  it('renders supplied table content and preserves header toggle wiring', () => {
    const onToggle = jest.fn();
    const tableWrapperRef = React.createRef<HTMLDivElement>();
    const { container } = render(
      <SurveyResultsQuestionListCard
        isOpen={false}
        onToggle={onToggle}
        questionTableNode={<div data-testid="question-table">Question table</div>}
        showEmptyState={false}
        styleMap={styleMap}
        tableWrapperRef={tableWrapperRef}
        title=" View & Sort Questions"
        trailingLabelStyle={{ marginLeft: '10px' }}
      />,
    );

    expect(screen.getByText('View & Sort Questions')).toBeInTheDocument();
    expect(screen.getByTestId('question-table')).toHaveTextContent('Question table');
    expect(tableWrapperRef.current).toContainElement(screen.getByTestId('question-table'));
    expect(container.querySelector('svg')).toHaveStyle({ marginLeft: '10px' });

    fireEvent.click(screen.getByText('View & Sort Questions').closest('.questionSummaryHeader') as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps the question list wrapper transparent so the blue header fills the card', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(
      /\.questionListCard\s*{[\s\S]*?padding:\s*0;[\s\S]*?background:\s*transparent !important;[\s\S]*?border:\s*0;[\s\S]*?overflow:\s*hidden;/,
    );
    expect(scss).toMatch(
      /\.questionListCard \.questionSummaryHeader\s*{[\s\S]*?border-radius:\s*var\(--ce-radius-12\) !important;/,
    );
  });
});
