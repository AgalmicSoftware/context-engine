import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import QuestionCardLinks from './QuestionCardLinks';

describe('QuestionCardLinks', () => {
  it('renders bookmark, spinner, and external links with the expected behavior', () => {
    const onBookmarkToggle = jest.fn();
    render(
      <QuestionCardLinks
        showResponseLookupSpinner
        isQuestionBookmarked
        onBookmarkToggle={onBookmarkToggle}
        arweaveHref="https://arweave.net/demo"
        questionHref="/question/q1?session=edge"
      />,
    );

    fireEvent.click(screen.getByTitle('Remove Bookmark'));

    expect(screen.getByLabelText('Checking for existing response')).toBeInTheDocument();
    expect(screen.getByTitle('View on Arweave')).toHaveAttribute('href', 'https://arweave.net/demo');
    expect(screen.getByTitle('View question page')).toHaveAttribute('href', '/question/q1?session=edge');
    expect(onBookmarkToggle).toHaveBeenCalledTimes(1);
  });

  it('builds bookmark button display helpers', () => {
    expect(
      buildQuestionCardBookmarkClassName({
        activeClassName: 'active',
        baseClassName: 'base',
        bookmarkClassName: 'bookmark',
        isQuestionBookmarked: true,
      }),
    ).toBe('base bookmark active');
    expect(
      buildQuestionCardBookmarkClassName({
        activeClassName: 'active',
        baseClassName: 'base',
        bookmarkClassName: 'bookmark',
        isQuestionBookmarked: false,
      }),
    ).toBe('base bookmark');
    expect(resolveQuestionCardBookmarkIconStyle(true)).toEqual({ color: '#ffc107' });
    expect(resolveQuestionCardBookmarkIconStyle(false)).toEqual({ color: 'white' });
  });
});
