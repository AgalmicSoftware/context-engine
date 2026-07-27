import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerParticipantGroupCreatePanel from './WorkerParticipantGroupCreatePanel';

const SESSION_ID = '0x11111111111111111111111111111111';

describe('WorkerParticipantGroupCreatePanel', () => {
  it('creates only through the bearer-authenticated participant route and refreshes groups', async () => {
    const onGroupsChanged = jest.fn();
    const fetchImpl = jest.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'demo-sh',
          group: {
            groupId: 'participant-review',
            sessionSlug: 'demo-sh',
            label: body.group.label,
            description: body.group.description,
            imageUrl: body.group.imageUrl,
            joinMode: 'open',
            memberVisibility: 'session',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    render(
      <WorkerParticipantGroupCreatePanel
        sessionId={SESSION_ID}
        sessionSlug="demo-sh"
        workerToken="participant-token"
        workerUrl="https://demo-sh-worker.example/"
        fetchImpl={fetchImpl}
        onGroupsChanged={onGroupsChanged}
      />,
    );

    fireEvent.change(screen.getByTestId('ce-session-worker-participant-group-label'), {
      target: { value: 'Participant review' },
    });
    fireEvent.change(screen.getByTestId('ce-session-worker-participant-group-description'), {
      target: { value: 'Open working group.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() =>
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://demo-sh-worker.example/groups/create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer participant-token' }),
        }),
      ),
    );
    expect(await screen.findByText('Group created. It is open to session participants.')).toBeInTheDocument();
    expect(onGroupsChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ce-session-worker-participant-group-label')).toHaveValue('');
  });

  it('does not issue a request without a group label', () => {
    const fetchImpl = jest.fn();
    render(
      <WorkerParticipantGroupCreatePanel
        sessionId={SESSION_ID}
        sessionSlug="demo-sh"
        workerToken="participant-token"
        workerUrl="https://demo-sh-worker.example"
        fetchImpl={fetchImpl}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(screen.getByText('Group label is required.')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('matches the Worker metadata limits before submission', () => {
    render(
      <WorkerParticipantGroupCreatePanel
        sessionId={SESSION_ID}
        sessionSlug="demo-sh"
        workerToken="participant-token"
        workerUrl="https://demo-sh-worker.example"
      />,
    );

    expect(screen.getByLabelText('Group name')).toHaveAttribute('maxlength', '120');
    expect(screen.getByLabelText('Description')).toHaveAttribute('maxlength', '500');
    expect(screen.getByLabelText('Image URL (optional)')).toHaveAttribute('maxlength', '2048');
    expect(screen.getByLabelText('Image URL (optional)')).toHaveAttribute('type', 'url');
  });
});
