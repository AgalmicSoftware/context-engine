import { fireEvent, render, screen } from '@testing-library/react';
import WorkerGroupInvitesPanel from './WorkerGroupInvitesPanel';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';

const group = {
  groupId: 'salon',
  sessionSlug: 'alpha',
  label: 'Salon',
  joinMode: 'group_password',
  passwordSet: false,
} as WorkerGroup;

it('opens a group with no password on a generated one, and a group with one on an empty field', () => {
  const props = {
    sessionId: `0x${'1'.repeat(32)}`,
    sessionSlug: 'alpha',
    workerUrl: 'https://worker.example',
    postSignedRequest: jest.fn(),
    onGroupChanged: jest.fn(),
  };
  const { unmount } = render(<WorkerGroupInvitesPanel group={group} {...props} />);
  const field = screen.getByLabelText('New group password') as HTMLInputElement;
  expect(field.value).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
  expect(screen.getByRole('button', { name: 'Set password' })).toBeEnabled();
  // Selected on focus, so typing replaces it.
  fireEvent.focus(field);
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
  unmount();
  render(<WorkerGroupInvitesPanel group={{ ...group, passwordSet: true }} {...props} />);
  expect(screen.getByLabelText('New group password')).toHaveValue('');
});

it('says why a password joiners couldn’t type can’t be set', () => {
  const postSignedRequest = jest.fn();
  render(
    <WorkerGroupInvitesPanel
      group={group}
      sessionId={`0x${'1'.repeat(32)}`}
      sessionSlug="alpha"
      workerUrl="https://worker.example"
      postSignedRequest={postSignedRequest}
      onGroupChanged={jest.fn()}
    />,
  );
  const input = screen.getByLabelText('New group password');
  const set = screen.getByRole('button', { name: 'Set password' });
  fireEvent.change(input, { target: { value: 'river stone lamp ' } });
  expect(screen.getByText('No spaces at the start or end.')).toBeInTheDocument();
  expect(set).toBeDisabled();
  fireEvent.change(input, { target: { value: 'gp:river stone lamp' } });
  expect(screen.getByText('That reads as a link code. Choose another.')).toBeInTheDocument();
  expect(set).toBeDisabled();
  fireEvent.change(input, { target: { value: 'river stone lamp' } });
  expect(set).toBeEnabled();
  expect(postSignedRequest).not.toHaveBeenCalled();
});
