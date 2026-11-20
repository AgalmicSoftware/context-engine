import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionInterviewUserName from './SessionInterviewUserName';
import type { SessionNamesSource } from '../../utilities/session/sessionNames';

const ACCOUNT = '0x00000000000000000000000000000000000000Ab';
const source = (setOwn: SessionNamesSource['setOwn'], enabled = true): SessionNamesSource => ({
  enabled,
  readAll: jest.fn(async () => ({})),
  readAllOrFail: jest.fn(async () => ({})),
  hasSignIn: jest.fn(async () => true),
  signIn: jest.fn(async () => {}),
  setOwn: jest.fn(setOwn),
});

it('shows nothing where the session keeps no names, has them off, or no one is signed in', () => {
  const { container, rerender } = render(<SessionInterviewUserName source={null} names={{}} account={ACCOUNT} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<SessionInterviewUserName source={source(async () => null, false)} names={{}} account={ACCOUNT} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<SessionInterviewUserName source={source(async () => null)} names={{}} account="" />);
  expect(container).toBeEmptyDOMElement();
});

it('offers the imported name unsaved, and saves only on Save', async () => {
  const names = source(async (name) => name);
  render(<SessionInterviewUserName source={names} names={{}} account={ACCOUNT} suggestion="Robin" />);
  const input = screen.getByLabelText('Username (optional)');
  expect(input).toHaveValue('Robin');
  expect(screen.getByRole('status')).toHaveTextContent('It is not written into your answers.');
  expect(names.setOwn).not.toHaveBeenCalled();

  fireEvent.change(input, { target: { value: '  Robin   Example ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved.'));
  expect(names.setOwn).toHaveBeenCalledWith('Robin Example');
});

it('shows the stored name, keeps Save off until it changes, and removes it when cleared', async () => {
  const names = source(async () => null);
  render(<SessionInterviewUserName source={names} names={{ [ACCOUNT.toLowerCase()]: 'Robin' }} account={ACCOUNT} />);
  const input = screen.getByLabelText('Username (optional)');
  expect(input).toHaveValue('Robin');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your username was removed.'));
  expect(names.setOwn).toHaveBeenCalledWith('');
});

it('shows the Worker’s refusal as written', async () => {
  const names = source(async () => {
    throw new Error('Names can’t claim a role.');
  });
  render(<SessionInterviewUserName source={names} names={{}} account={ACCOUNT} />);
  fireEvent.change(screen.getByLabelText('Username (optional)'), { target: { value: 'Admin' } });
  fireEvent.keyDown(screen.getByLabelText('Username (optional)'), { key: 'Enter' });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Names can’t claim a role.'));
});

it('keeps showing what was saved, and offers no imported name after a removal', async () => {
  const names = source(async () => null);
  const { rerender } = render(
    <SessionInterviewUserName
      source={names}
      names={{ [ACCOUNT.toLowerCase()]: 'Robin' }}
      account={ACCOUNT}
      suggestion="Ada"
    />,
  );
  const input = screen.getByLabelText('Username (optional)');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your username was removed.'));
  // The session's names haven't caught up yet: the box still shows the removal, not "Robin" or "Ada".
  expect(input).toHaveValue('');
  rerender(<SessionInterviewUserName source={names} names={{}} account={ACCOUNT} suggestion="Ada" />);
  expect(input).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});
