import React from 'react';
import { render, screen } from '@testing-library/react';

import { QuestionStanceCard, selectConcreteQuestionStances } from './QuestionStanceCard';

describe('QuestionStanceCard', () => {
  it('shows the prompt, option metadata, and concrete stance totals', () => {
    render(
      <QuestionStanceCard
        label="Q abcd…1234"
        prompt="Should this proposal pass?"
        metaLabel="Option: later"
        votes={[1, 0, -1, 1, null, undefined, 2]}
      />,
    );

    expect(screen.getByText(/Q abcd…1234: Should this proposal pass\?/)).toBeInTheDocument();
    expect(screen.getByText('Option: later')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, node) =>
          node?.tagName === 'SPAN' &&
          node.textContent?.replace(/\s+/g, ' ').trim() === 'Agree: 2 / Disagree: 1 / Unsure: 1',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Agree 2, unsure 1, disagree 1' })).toBeInTheDocument();
  });

  it('ignores missing and unsupported values and reports an empty comparison', () => {
    render(<QuestionStanceCard prompt="No shared answers" votes={[null, undefined, 2]} />);

    expect(screen.getByText('No responses in this comparison.')).toBeInTheDocument();
    expect(selectConcreteQuestionStances([1, 0, -1, null, 2])).toEqual([1, 0, -1]);
  });
});
