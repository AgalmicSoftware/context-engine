import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerGroupInvitesPanel from './WorkerGroupInvitesPanel';
import WorkerGroupPasswordReveal from './WorkerGroupPasswordReveal';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';

jest.mock('../../domains/worker/workerGroupPorts', () => ({
  ...jest.requireActual<object>('../../domains/worker/workerGroupPorts'),
  listWorkerGroupInvites: jest.fn(async () => ({ invites: [], cursor: '' })),
  addWorkerGroupInvites: jest.fn(async () => ({ counts: { unused: 1, used: 0, revoked: 0 } })),
}));

const refuseCopying = () =>
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
    configurable: true,
  });

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

it('says copying the fresh links was refused and points to the export', async () => {
  refuseCopying();
  render(
    <WorkerGroupInvitesPanel
      group={{ ...group, joinMode: 'one_use' } as WorkerGroup}
      sessionId={`0x${'1'.repeat(32)}`}
      sessionSlug="alpha"
      workerUrl="https://worker.example"
      postSignedRequest={jest.fn()}
      onGroupChanged={jest.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '1' } });
  const generate = screen.getByRole('button', { name: 'Generate Additional Password Invites' });
  await waitFor(() => expect(generate).toBeEnabled());
  fireEvent.click(generate);
  const copyAll = await screen.findByRole('button', { name: 'Copy all' });
  await act(async () => {
    fireEvent.click(copyAll);
  });
  expect(screen.getByRole('status')).toHaveTextContent("Copying isn't allowed here. Use Export Passwords.");
});

const renderReveal = () =>
  render(
    <WorkerGroupPasswordReveal
      group={group}
      password="river-stone-lamp"
      sessionSlug="alpha"
      workerUrl="https://worker.example"
      onDone={jest.fn()}
    />,
  );

it('selects the shown password where copying it is refused', async () => {
  refuseCopying();
  renderReveal();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy password' }));
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    "Copying isn't allowed here, so the password is selected. Copy it yourself.",
  );
  expect(window.getSelection()?.toString()).toBe('river-stone-lamp');
  expect(screen.queryByRole('textbox', { name: 'Link to copy' })).toBeNull();
  window.getSelection()?.removeAllRanges();
});

// The link without the password is for sharing apart from it, so a refusal never offers the password.
it('shows a refused link selected, never the password in its place', async () => {
  refuseCopying();
  renderReveal();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy link without password' }));
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    "Copying isn't allowed here, so the link is selected. Copy it yourself.",
  );
  const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Link to copy' });
  expect(field.value).toContain('alpha');
  expect(field.value).not.toContain('river-stone-lamp');
  expect(document.activeElement).toBe(field);
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
  expect(window.getSelection()?.toString()).not.toBe('river-stone-lamp');
});
