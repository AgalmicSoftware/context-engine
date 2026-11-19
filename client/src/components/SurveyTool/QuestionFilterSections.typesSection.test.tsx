import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { QuestionFilterQuestionTypesSection } from './QuestionFilterSections';

// The Question Types tile for a quadratic question shows the same small picture as the create view's tile
// (a step down, +2, a step up and the four credits it costs), not a line of text.
it('draws the quadratic tile with the create view’s preview', () => {
  const onTypeSelection = jest.fn();
  render(
    <QuestionFilterQuestionTypesSection
      disabled={false}
      expandedSections={{ types: true }}
      onToggleSection={jest.fn()}
      onTypeSelection={onTypeSelection}
      pendingSelectedTypes={['quadratic']}
    />,
  );
  const tile = screen.getByRole('button', { name: 'Quadratic allocation' });
  const preview = within(tile).getByTestId('ce-quadratic-type-preview');
  expect(preview).toHaveTextContent('−2+');
  expect(preview.querySelectorAll('i')).toHaveLength(4);
  // Drawn in the tile's own text colour, so it shows on a light tile and on a pressed one.
  expect(preview.className).toMatch(/plain/);
  expect(tile).not.toHaveTextContent('voice credits');
  expect(tile).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(tile);
  expect(onTypeSelection).toHaveBeenCalledWith('quadratic');
});
