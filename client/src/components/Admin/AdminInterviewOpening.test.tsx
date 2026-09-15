import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminInterviewOpening from './AdminInterviewOpening';

it('disables refresh during generation and displays the saved opening', async () => {
  const onRefresh = jest.fn().mockResolvedValue({ openingPrompt: 'What is your AI expertise?' });
  render(<AdminInterviewOpening settings={{}} onRefresh={onRefresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate interview opening' }));
  expect(screen.getByRole('button')).toBeDisabled();
  expect(await screen.findByRole('status')).toHaveTextContent('What is your AI expertise?');
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it('hides refresh for owner openings and disabled refresh', () => {
  const onRefresh = jest.fn();
  const { rerender } = render(<AdminInterviewOpening settings={{ openingMode: 'owner' }} onRefresh={onRefresh} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<AdminInterviewOpening settings={{ allowManualRefresh: false }} onRefresh={onRefresh} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('shows actionable refresh errors', async () => {
  render(
    <AdminInterviewOpening
      settings={{}}
      onRefresh={async () => {
        throw new Error('Check the session AI key.');
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check the session AI key.');
  expect(screen.getByRole('button')).toBeEnabled();
});
