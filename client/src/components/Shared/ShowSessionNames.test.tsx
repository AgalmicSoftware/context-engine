/** @file ShowSessionNames.test.tsx */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ShowSessionNames from './ShowSessionNames';

it('shows nothing when names are already read as this person, or as no one', () => {
  const { container } = render(<ShowSessionNames signIn={null} />);
  expect(container).toBeEmptyDOMElement();
});

it('signs in only when pressed, and says so when the sign-in does not finish', async () => {
  const signIn = jest.fn<Promise<void>, []>().mockRejectedValueOnce(new Error('closed')).mockResolvedValue(undefined);
  render(<ShowSessionNames signIn={signIn} />);
  expect(screen.getByRole('status')).toHaveTextContent('Sign in to this session to see the names people have set.');
  expect(signIn).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Show names' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('The sign-in didn’t finish. Try again.'));
  fireEvent.click(screen.getByRole('button', { name: 'Show names' }));
  await waitFor(() => expect(signIn).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Show names' })).toBeEnabled());
});
