import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerGroupAutoJoinLink from './WorkerGroupAutoJoinLink';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';

const group: WorkerGroup = {
  groupId: 'participants-2026',
  label: 'Participants 2026',
  joinMode: 'open',
  memberVisibility: 'session',
};

it('copies a session auto-join link without copying credentials from the current URL', async () => {
  window.history.replaceState({}, '', '/group/participants-2026?sessionName=alpha&agentToken=private#secret');
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<WorkerGroupAutoJoinLink group={group} sessionSlug="alpha" workerUrl="https://worker.example" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy auto-join link for Participants 2026' }));
  expect(await screen.findByText('Auto-join link copied.')).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}/session/alpha?joinGroup=participants-2026&worker=https%3A%2F%2Fworker.example`,
  );
});

it('keeps same-session source, mode, and Worker while dropping private prefill context when copying', async () => {
  window.history.replaceState(
    {},
    '',
    '/session/alpha?mode=interview&src=partner&groups=EDDY-2026&agentToken=private#prefill=abc&secret=hidden',
  );
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<WorkerGroupAutoJoinLink group={group} sessionSlug="alpha" workerUrl="https://worker.example" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy auto-join link for Participants 2026' }));
  expect(await screen.findByText('Auto-join link copied.')).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}/session/alpha?mode=interview&src=partner&joinGroup=participants-2026&worker=https%3A%2F%2Fworker.example`,
  );
});

it('does not offer auto-join for closed or restricted groups', () => {
  const { rerender } = render(
    <WorkerGroupAutoJoinLink
      group={{ ...group, joinMode: 'admin_add' }}
      sessionSlug="alpha"
      workerUrl="https://worker.example"
    />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(
    <WorkerGroupAutoJoinLink
      group={{ ...group, memberVisibility: 'members' }}
      sessionSlug="alpha"
      workerUrl="https://worker.example"
    />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
