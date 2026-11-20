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

const box = () => screen.getByLabelText('Username (optional)');
const check = () => screen.queryByRole('button', { name: 'Save username' });

it('offers the imported name with a checkmark, so it is plainly unsaved, and saves only on the checkmark', async () => {
  const names = source(async (name) => name);
  const { container } = render(
    <SessionInterviewUserName source={names} names={{}} account={ACCOUNT} suggestion="Robin" />,
  );
  expect(box()).toHaveValue('Robin');
  expect(check()).toBeInTheDocument();
  expect(names.setOwn).not.toHaveBeenCalled();
  // No helper sentence: the label, the box and the checkmark.
  expect(container.querySelector('p')).toBeNull();

  fireEvent.change(box(), { target: { value: '  Robin   Example ' } });
  fireEvent.click(check()!);
  await waitFor(() => expect(check()).not.toBeInTheDocument());
  expect(names.setOwn).toHaveBeenCalledWith('Robin Example');
  expect(box()).toHaveValue('Robin Example');
});

it('shows the stored name without a checkmark, offers one when it changes, and removes it when cleared', async () => {
  const names = source(async () => null);
  render(<SessionInterviewUserName source={names} names={{ [ACCOUNT.toLowerCase()]: 'Robin' }} account={ACCOUNT} />);
  expect(box()).toHaveValue('Robin');
  expect(check()).not.toBeInTheDocument();
  fireEvent.change(box(), { target: { value: 'Robin ' } });
  expect(check()).not.toBeInTheDocument();
  fireEvent.change(box(), { target: { value: '' } });
  fireEvent.click(check()!);
  await waitFor(() => expect(names.setOwn).toHaveBeenCalledWith(''));
  await waitFor(() => expect(check()).not.toBeInTheDocument());
});

it('saves on Enter and shows the Worker’s refusal as written', async () => {
  const names = source(async () => {
    throw new Error('Names can’t claim a role.');
  });
  render(<SessionInterviewUserName source={names} names={{}} account={ACCOUNT} />);
  expect(check()).not.toBeInTheDocument();
  fireEvent.change(box(), { target: { value: 'Admin' } });
  fireEvent.keyDown(box(), { key: 'Enter' });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Names can’t claim a role.'));
  expect(check()).toBeInTheDocument();
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
  fireEvent.change(box(), { target: { value: '' } });
  fireEvent.click(check()!);
  await waitFor(() => expect(check()).not.toBeInTheDocument());
  // The session's names haven't caught up yet: the box still shows the removal, not "Robin" or "Ada".
  expect(box()).toHaveValue('');
  rerender(<SessionInterviewUserName source={names} names={{}} account={ACCOUNT} suggestion="Ada" />);
  expect(box()).toHaveValue('');
  expect(check()).not.toBeInTheDocument();
});
