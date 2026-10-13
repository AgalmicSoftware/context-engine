import React from 'react';
import { render, screen } from '@testing-library/react';

import { QuestionStanceBar, selectConcreteQuestionStances } from './QuestionStanceCard';

describe('QuestionStanceBar', () => {
  it('labels and fills concrete stance totals in agree, unsure, disagree order', () => {
    render(<QuestionStanceBar votes={[1, 0, -1, 1, null, undefined, 2]} />);

    const bar = screen.getByRole('img', { name: 'Agree 2, unsure 1, disagree 1' });
    expect([...bar.querySelectorAll('rect')].slice(1).map((segment) => segment.getAttribute('fill'))).toEqual([
      'var(--ce-binary-choice-agree-bg)',
      'var(--ce-binary-choice-unsure-bg)',
      'var(--ce-binary-choice-disagree-bg)',
    ]);
  });

  it('ignores missing and unsupported values and draws only the outline when empty', () => {
    render(<QuestionStanceBar votes={[null, undefined, 2]} />);

    const bar = screen.getByRole('img', { name: 'Agree 0, unsure 0, disagree 0' });
    expect(bar.querySelectorAll('rect')).toHaveLength(1);
    expect(selectConcreteQuestionStances([1, 0, -1, null, 2])).toEqual([1, 0, -1]);
  });
});
