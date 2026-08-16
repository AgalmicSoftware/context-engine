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

    const bookmarkButton = screen.getByRole('button', { name: 'Remove bookmark' });
    expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(bookmarkButton);

    expect(screen.getByLabelText('Checking for existing response')).toBeInTheDocument();
    expect(screen.getByTitle('View on Arweave')).toHaveAttribute('href', 'https://arweave.net/demo');
    expect(screen.getByTitle('View question page')).toHaveAttribute('href', '/question/q1?session=edge');
    expect(onBookmarkToggle).toHaveBeenCalledTimes(1);
  });

  it('exposes an immediate pressed-state change when the bookmark state updates', () => {
    const onBookmarkToggle = jest.fn();
    const { rerender } = render(<QuestionCardLinks onBookmarkToggle={onBookmarkToggle} />);

    const inactiveButton = screen.getByRole('button', { name: 'Bookmark question' });
    expect(inactiveButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(inactiveButton);
    expect(onBookmarkToggle).toHaveBeenCalledTimes(1);

    rerender(<QuestionCardLinks isQuestionBookmarked onBookmarkToggle={onBookmarkToggle} />);

    const activeButton = screen.getByRole('button', { name: 'Remove bookmark' });
    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    expect(activeButton.querySelector('svg')).toHaveStyle({ color: 'var(--ce-status-warning)' });
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
    expect(resolveQuestionCardBookmarkIconStyle(true)).toEqual({ color: 'var(--ce-status-warning)' });
    expect(resolveQuestionCardBookmarkIconStyle(false)).toEqual({ color: 'var(--ce-panel-text)' });
  });
});
