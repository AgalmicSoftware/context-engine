import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerParticipantGroupCreatePanel from './WorkerParticipantGroupCreatePanel';

const SESSION_ID = '0x11111111111111111111111111111111';
const ADDRESS = '0x00000000000000000000000000000000000000aa';

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
            tags: body.group.tags,
            documentURLs: body.group.documentURLs,
            memberLimit: body.group.memberLimit,
            joinEndsAt: body.group.joinEndsAt,
            adminAddress: ADDRESS,
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
        sessionName="Demo Session"
        participantAddress={ADDRESS}
        sessionSlug="demo-sh"
        workerToken="participant-token"
        workerUrl="https://demo-sh-worker.example/"
        fetchImpl={fetchImpl}
        onGroupsChanged={onGroupsChanged}
      />,
    );

    expect(screen.getByTestId('ce-session-worker-group-create-active-session')).toHaveTextContent('Demo Session');
    expect(screen.getByTestId('ce-session-worker-group-create-active-session')).toHaveTextContent('/demo-sh');
    expect(screen.queryByText(/on-chain|contract address|gas|RPC/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ce-session-worker-participant-group-label'), {
      target: { value: 'Participant review' },
    });
    fireEvent.change(screen.getByTestId('ce-session-worker-participant-group-description'), {
      target: { value: 'Open working group.' },
    });
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'reviewers' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    fireEvent.change(screen.getByLabelText('Reference URL'), {
      target: { value: 'https://docs.example.test/brief' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add reference URL' }));
    fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Join deadline'), { target: { value: '2030-01-01T12:00' } });
    expect(screen.getByLabelText('Group admin address')).toHaveValue(ADDRESS);
    expect(screen.getByLabelText('Group admin address')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    await waitFor(() =>
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://demo-sh-worker.example/groups/create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer participant-token' }),
        }),
      ),
    );
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body || '{}'));
    expect(requestBody.group).toMatchObject({
      tags: ['reviewers'],
      documentURLs: ['https://docs.example.test/brief'],
      memberLimit: 25,
      adminAddress: ADDRESS,
    });
    expect(requestBody.group.joinEndsAt).toBe(new Date('2030-01-01T12:00').toISOString());
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

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    expect(screen.getByText('Group label is required.')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('preserves a complete signed-out draft through authentication and prompts only on final submit', async () => {
    const fetchImpl = jest.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'demo-sh',
          group: {
            groupId: 'draft-group',
            sessionSlug: 'demo-sh',
            ...body.group,
            adminAddress: ADDRESS,
            joinMode: 'open',
            memberVisibility: 'session',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const onRequestAuthentication = jest.fn();
    const props = {
      sessionId: SESSION_ID,
      sessionName: 'Demo Session',
      sessionSlug: 'demo-sh',
      workerUrl: 'https://demo-sh-worker.example',
      fetchImpl,
      onRequestAuthentication,
    };
    const { rerender } = render(
      <WorkerParticipantGroupCreatePanel
        {...props}
        authenticationRequired={true}
        participantAddress=""
        workerToken=""
      />,
    );

    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Draft group' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Draft description.' } });
    fireEvent.change(screen.getByLabelText('Image URL'), {
      target: { value: 'https://images.example.test/draft.png' },
    });
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'draft-tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    fireEvent.change(screen.getByLabelText('Reference URL'), {
      target: { value: 'https://docs.example.test/draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add reference URL' }));
    fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in & create' }));

    expect(onRequestAuthentication).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByText('Sign in to create this group. Your draft will stay here.')).toBeInTheDocument();

    rerender(
      <WorkerParticipantGroupCreatePanel
        {...props}
        authenticationRequired={false}
        participantAddress={ADDRESS}
        workerToken="participant-token"
      />,
    );

    expect(screen.getByLabelText('Group name')).toHaveValue('Draft group');
    expect(screen.getByLabelText('Description')).toHaveValue('Draft description.');
    expect(screen.getByLabelText('Image URL')).toHaveValue('https://images.example.test/draft.png');
    expect(screen.getByText('draft-tag')).toBeInTheDocument();
    expect(screen.getByText('https://docs.example.test/draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Member limit')).toHaveValue(40);
    expect(screen.getByLabelText('Group admin address')).toHaveValue(ADDRESS);
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body || '{}'));
    expect(requestBody.group).toMatchObject({
      label: 'Draft group',
      description: 'Draft description.',
      imageUrl: 'https://images.example.test/draft.png',
      tags: ['draft-tag'],
      documentURLs: ['https://docs.example.test/draft'],
      memberLimit: 40,
      adminAddress: ADDRESS,
    });
  });

  it('prefills Worker-native tag defaults from the selected session', () => {
    render(
      <WorkerParticipantGroupCreatePanel
        sessionId={SESSION_ID}
        sessionConfig={{ defaultGroupTags: 'facilitators,reviewers' }}
        sessionSlug="demo-sh"
        workerToken="participant-token"
        workerUrl="https://demo-sh-worker.example"
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove facilitators' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove reviewers' })).toBeInTheDocument();
  });

  it('uploads a selected image through the active Cloudflare session before creating the group', async () => {
    const fetchImpl = jest.fn(async (input?: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input || '');
      if (url.endsWith('/storage/upload')) {
        return new Response(
          JSON.stringify({
            id: 'cf_01j7groupimage',
            storageRef: {
              backend: 'cloudflare',
              id: 'cf_01j7groupimage',
              uri: '/storage/read?id=cf_01j7groupimage',
              contentType: 'image/png',
              resource: 'images',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      const body = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'demo-sh',
          group: {
            groupId: 'with-image',
            sessionSlug: 'demo-sh',
            ...body.group,
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
        sessionConfig={{
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { gate: 'none', encryption: 'none' },
          },
        }}
        sessionSlug="demo-sh"
        workerToken="participant-token"
        workerUrl="https://demo-sh-worker.example"
        fetchImpl={fetchImpl}
      />,
    );

    fireEvent.change(screen.getByTestId('ce-session-worker-participant-group-image-file'), {
      target: { files: [new File(['image'], 'group.png', { type: 'image/png' })] },
    });
    expect(await screen.findByText('Image uploaded.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ce-session-worker-participant-group-label'), {
      target: { value: 'Image group' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    await waitFor(() => {
      const createCall = fetchImpl.mock.calls.find(([input]) => String(input).endsWith('/groups/create'));
      expect(createCall).toBeDefined();
      expect(JSON.parse(String(createCall?.[1]?.body || '{}')).group.imageUrl).toBe(
        'https://demo-sh-worker.example/storage/read?id=cf_01j7groupimage',
      );
    });
    const uploadCall = fetchImpl.mock.calls.find(([input]) => String(input).endsWith('/storage/upload'));
    expect(uploadCall?.[1]?.headers).toEqual(expect.any(Headers));
    expect((uploadCall?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer participant-token');
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
    expect(screen.getByLabelText('Image URL')).toHaveAttribute('maxlength', '2048');
    expect(screen.getByLabelText('Image URL')).toHaveAttribute('type', 'url');
  });
});
