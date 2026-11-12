import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QRCodeSVG } from 'qrcode.react';
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

it('shows the copied link as a QR code at error-correction level M', async () => {
  window.history.replaceState({}, '', '/session/alpha?mode=interview&agentToken=private');
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<WorkerGroupAutoJoinLink group={group} sessionSlug="alpha" workerUrl="https://worker.example" />);
  expect(screen.queryByTitle('Join Participants 2026')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show auto-join QR code for Participants 2026' }));
  const code = screen.getByTitle('Join Participants 2026').closest('svg')!;
  fireEvent.click(screen.getByRole('button', { name: 'Copy auto-join link for Participants 2026' }));
  expect(await screen.findByText('Auto-join link copied.')).toBeInTheDocument();
  const copied = writeText.mock.calls[0][0];
  expect(copied).toBe(
    `${window.location.origin}/session/alpha?mode=interview&joinGroup=participants-2026&worker=https%3A%2F%2Fworker.example`,
  );
  // The code's size tells the level: this link needs a larger code at M than at L.
  const sized = (level: 'L' | 'M') =>
    render(<QRCodeSVG value={copied} level={level} marginSize={4} />)
      .container.querySelector('svg')!
      .getAttribute('viewBox');
  expect(sized('M')).not.toBe(sized('L'));
  expect(code.getAttribute('viewBox')).toBe(sized('M'));
});

it('says so in place of the QR code when the link cannot be made', () => {
  window.history.replaceState({}, '', '/session/alpha');
  render(<WorkerGroupAutoJoinLink group={group} sessionSlug="alpha" workerUrl="https://worker.example/private" />);
  fireEvent.click(screen.getByRole('button', { name: 'Show auto-join QR code for Participants 2026' }));
  expect(screen.getByRole('status')).toHaveTextContent('Could not make the auto-join QR code.');
  expect(screen.queryByTitle('Join Participants 2026')).not.toBeInTheDocument();
});
