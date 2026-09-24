import React from 'react';
import { render, screen } from '@testing-library/react';
import { ImportedResponderContextEditor } from './SessionInterviewVoiceControls';

it('keeps the outer context heading and an accessible editor without a duplicated visible title', () => {
  render(
    <ImportedResponderContextEditor
      expanded
      value="Imported context"
      disabled={false}
      onExpandedChange={jest.fn()}
      onChange={jest.fn()}
    />,
  );
  expect(screen.getByText('Imported responder context')).toBeVisible();
  expect(screen.queryByText('Imported responder context details')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Imported responder context details' })).toHaveValue('Imported context');
});
