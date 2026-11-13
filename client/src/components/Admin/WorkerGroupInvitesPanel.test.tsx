import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerGroupInvitesPanel from './WorkerGroupInvitesPanel';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';
import { saveWorkerGroupPassword } from '../../domains/worker/workerGroupSecrets';

type MockSecrets = typeof import('../../domains/worker/workerGroupSecrets');
// Stretching a password takes seconds in jsdom; the Worker's reply is what matters here.
jest.mock('../../domains/worker/workerGroupSecrets', () => ({
  ...jest.requireActual<MockSecrets>('../../domains/worker/workerGroupSecrets'),
  saveWorkerGroupPassword: jest.fn(async ({ groupId }: { groupId: string }) => ({
    groupId,
    passwordSet: true as const,
    signerSetAt: '2026-11-13T00:00:00.000Z',
  })),
}));

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

it('says a group shut by wrong guesses opens again with a new password', async () => {
  const onGroupChanged = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(
    <WorkerGroupInvitesPanel
      group={{ ...group, passwordSet: true, guessLimited: true }}
      sessionId={`0x${'1'.repeat(32)}`}
      sessionSlug="alpha"
      workerUrl="https://worker.example"
      postSignedRequest={jest.fn()}
      onGroupChanged={onGroupChanged}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Closed to password joins after too many wrong tries in the last hour. A new password opens it again at once',
  );
  fireEvent.change(screen.getByLabelText('New group password'), { target: { value: 'river stone lamp' } });
  fireEvent.click(screen.getByRole('button', { name: 'New password' }));
  await waitFor(() => expect(onGroupChanged).toHaveBeenCalledWith(expect.objectContaining({ guessLimited: false })));
  expect(saveWorkerGroupPassword).toHaveBeenCalledWith(expect.objectContaining({ password: 'river stone lamp' }));
});
