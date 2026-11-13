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
