import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsTagModalSlot from './SurveyQuestionsTagModalSlot';

jest.mock(
  '../TagPage/TagModal',
  () =>
    function MockTagModal({
      activeTag,
      isOpen,
      toggle,
    }: {
      activeTag?: string | null;
      isOpen?: boolean;
      toggle?: () => void;
    }) {
      return (
        <button
          data-testid="tag-modal"
          data-active-tag={activeTag || ''}
          data-open={isOpen ? 'true' : 'false'}
          onClick={toggle}
          type="button"
        >
          Tag modal
        </button>
      );
    },
);

describe('SurveyQuestionsTagModalSlot', () => {
  it('renders the tag modal when the layout display state enables it', () => {
    const onClose = jest.fn();

    render(
      <SurveyQuestionsTagModalSlot
        layoutDisplayState={{
          activeTagModalTag: 'research',
          useTagModal: true,
        }}
        tagModalProps={{ onClose }}
      />,
    );

    const modal = screen.getByTestId('tag-modal');
    expect(modal).toHaveAttribute('data-active-tag', 'research');
    expect(modal).toHaveAttribute('data-open', 'true');
    modal.click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render the tag modal when the route does not use tags', () => {
    render(
      <SurveyQuestionsTagModalSlot
        layoutDisplayState={{
          activeTagModalTag: 'research',
          useTagModal: false,
        }}
      />,
    );

    expect(screen.queryByTestId('tag-modal')).not.toBeInTheDocument();
  });
});
