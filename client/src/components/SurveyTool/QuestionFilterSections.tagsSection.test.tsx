import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { QuestionFilterTagsSection } from './QuestionFilterSections';

describe('QuestionFilterTagsSection hooks', () => {
  it('exposes the tags section header and each tag button through stable test IDs', () => {
    const onTagSelection = jest.fn();
    render(
      <QuestionFilterTagsSection
        allTagsCount={2}
        disabled={false}
        disabledReason=""
        expandedSections={{ tags: true }}
        onTagSelection={onTagSelection}
        onToggleSection={jest.fn()}
        onToggleShowAllTags={jest.fn()}
        selectedTags={['beta']}
        showAllTags={false}
        tagsToDisplay={['alpha', 'beta']}
        tooltipId="tags-tooltip"
      />,
    );

    expect(screen.getByTestId('ce-question-filter-section-tags')).toBeInTheDocument();
    const tags = screen.getAllByTestId('ce-question-filter-tag');
    expect(tags.map((tag) => tag.textContent)).toEqual(['#alpha', '#beta']);
    expect(tags[1]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(tags[0]);
    expect(onTagSelection).toHaveBeenCalledWith('alpha');
    expect(screen.queryByTestId('ce-question-filter-tags-show-more')).toBeNull();
  });

  it('exposes Show More through a stable test ID when more than 10 tags exist', () => {
    const onToggleShowAllTags = jest.fn();
    render(
      <QuestionFilterTagsSection
        allTagsCount={11}
        disabled={false}
        disabledReason=""
        expandedSections={{ tags: true }}
        onTagSelection={jest.fn()}
        onToggleSection={jest.fn()}
        onToggleShowAllTags={onToggleShowAllTags}
        selectedTags={[]}
        showAllTags={false}
        tagsToDisplay={['alpha']}
        tooltipId="tags-tooltip"
      />,
    );

    fireEvent.click(screen.getByTestId('ce-question-filter-tags-show-more'));
    expect(onToggleShowAllTags).toHaveBeenCalledTimes(1);
  });
});
