import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AdminSessionAgentExportPanel from './AdminSessionAgentExportPanel';

const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
const WITH_AGENT = { slug: 'salon', sessionAgent: { audiences: [{ who: everyone, answers: 'general' }] } };
// Spaced as the Worker spaced it: parsing and writing it again would change it.
const CONTENT = '{\n  "format": "ce.session-agent-export",\n  "items": []\n}\n';

const textOf = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const renderPanel = (props: Partial<React.ComponentProps<typeof AdminSessionAgentExportPanel>> = {}) => {
  const postSignedRequest = jest.fn();
  render(
    <AdminSessionAgentExportPanel
      sessionSlug="salon"
      sessionConfig={WITH_AGENT}
      canAdminWorker
      postSignedRequest={postSignedRequest}
      {...props}
    />,
  );
  return postSignedRequest;
};

describe('AdminSessionAgentExportPanel', () => {
  const saved: Array<{ blob: Blob; name: string }> = [];
  let click: jest.SpyInstance;
  beforeEach(() => {
    saved.length = 0;
    let latest: Blob | null = null;
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        latest = blob;
        return 'blob:export';
      },
      revokeObjectURL: jest.fn(),
    });
    click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function save(this: HTMLAnchorElement) {
      if (latest) saved.push({ blob: latest, name: this.download });
    });
  });
  afterEach(() => {
    click.mockRestore();
  });

  it('is offered only to a config admin of a session that has a Session Agent', () => {
    renderPanel({ canAdminWorker: false });
    expect(screen.queryByTestId('ce-admin-session-agent-export')).not.toBeInTheDocument();
    renderPanel({ sessionConfig: { slug: 'salon' } });
    expect(screen.queryByTestId('ce-admin-session-agent-export')).not.toBeInTheDocument();
    renderPanel();
    expect(screen.getByRole('button', { name: 'Export Session Agent' })).toBeInTheDocument();
  });

  it('says what the file holds, that opting out keeps membership, and that older copies stay', () => {
    renderPanel();
    // What is always on screen says it too: the file is not address-free.
    expect(
      screen.getByText(
        'A snapshot. It holds members’ account addresses, with what they wrote and added. Keep copies somewhere private.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no names or addresses/)).not.toBeInTheDocument();
    const help = screen.getByRole('button', { name: 'About the Session Agent export' });
    expect(help).toHaveAccessibleDescription(/^What the Session Agent may give a member, as one file/);
    expect(help).toHaveAccessibleDescription(/Admins-only context is not in it/);
    expect(help).toHaveAccessibleDescription(/and any chats people chose to store/);
    expect(help).toHaveAccessibleDescription(
      /carries its writer’s account address, unless that person chose to leave it off; nothing carries a name/,
    );
    expect(help).toHaveAccessibleDescription(
      /people who opted out included: opting out keeps a person’s answers out, not their membership/,
    );
    expect(help).toHaveAccessibleDescription(/copies already made keep their earlier answers and addresses/);
  });

  it('signs for the export, saves the Worker’s own bytes under its name, and says what was left out', async () => {
    const postSignedRequest = renderPanel();
    postSignedRequest.mockResolvedValue({
      data: {
        filename: 'salon.session-agent.json',
        content: CONTENT,
        manifest: {
          itemCount: 1204,
          leftOut: { optedOut: 3, patternMatches: 1, belowMinAnswers: 2, adminsOnlyContext: 0, unreadableContext: 1 },
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export Session Agent' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Saved salon.session-agent.json: 1,204 items. Left out: 3 from people who opted out; 1 written answer that may name someone; answers to 2 questions with too few answers; 1 context item that can’t be read.',
    );
    expect(postSignedRequest).toHaveBeenCalledWith({
      action: 'session-agent/export',
      path: '/admin/session-agent/export',
      body: { sessionSlug: 'salon' },
    });
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('salon.session-agent.json');
    // Not parsed and written again: the same session must give the same file.
    expect(await textOf(saved[0].blob)).toBe(CONTENT);
  });

  it('says so plainly when the Worker is too old to export, or refuses', async () => {
    const postSignedRequest = renderPanel();
    postSignedRequest.mockRejectedValueOnce(new Error('Unknown admin action.'));
    fireEvent.click(screen.getByRole('button', { name: 'Export Session Agent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This Session Worker can’t export the Session Agent yet. Update the Session Worker first.',
    );
    postSignedRequest.mockRejectedValueOnce(
      new Error('This session has no Session Agent to export. Turn it on in Settings first.'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export Session Agent' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Turn it on in Settings first.'));
    expect(saved).toHaveLength(0);
  });

  it('saves nothing when the answer holds no file', async () => {
    const postSignedRequest = renderPanel();
    postSignedRequest.mockResolvedValue({ data: { ok: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Export Session Agent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The Session Worker sent no file.');
    expect(saved).toHaveLength(0);
  });
});
