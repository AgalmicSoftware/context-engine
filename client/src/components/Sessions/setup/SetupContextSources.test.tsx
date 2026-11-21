import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import {
  SetupContextFiles,
  SetupContextPublisher,
  usePendingContextFiles,
  type SetupGroupOption,
} from './SetupContextSources';
import {
  addContextLink,
  readContextPdf,
  uploadContextFile,
  workerReadsSessionLinks,
} from '../../../utilities/docLibrary/contextSources';
import { sessionTemplateFromDraft } from '@ce-shared/sessionTemplate.mjs';
import type { SetupDraft } from './setupSectionTypes';

jest.mock('../../../utilities/docLibrary/contextSources', () => ({
  ...jest.requireActual<typeof import('../../../utilities/docLibrary/contextSources')>(
    '../../../utilities/docLibrary/contextSources',
  ),
  addContextLink: jest.fn(async () => ({})),
  // An older Worker unless a test says otherwise: it reads a link only when asked.
  workerReadsSessionLinks: jest.fn(async () => false),
  readContextPdf: jest.fn(async () => ({})),
  uploadContextFile: jest.fn(async ({ file }: { file: File }) => `id-${file.name}`),
}));

let latest: SetupDraft = {};
// The page holds the draft and the chosen files; the session exists once `created`,
// and from then on both list the groups Create `made`, as /new does.
const Harness = ({
  initial,
  created = false,
  groups = [],
  made = [],
  config = { slug: 'salon' },
}: {
  initial: SetupDraft;
  created?: boolean;
  groups?: SetupGroupOption[];
  made?: SetupGroupOption[];
  config?: Record<string, unknown>;
}) => {
  const [draft, setDraft] = useState<SetupDraft>(initial);
  const pending = usePendingContextFiles();
  latest = draft;
  const onChange = ([key]: string[], value: unknown) => setDraft((prev) => ({ ...prev, [key]: value }));
  return (
    <>
      <SetupContextFiles
        draft={draft}
        onChange={onChange}
        pending={pending}
        groups={created ? made : groups}
        sessionConfig={created ? config : null}
      />
      <SetupContextPublisher
        draft={draft}
        onChange={onChange}
        pending={pending}
        sessionConfig={created ? config : null}
        sessionSlug="salon"
        account="0xadmin"
        groups={made}
      />
    </>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

// Opens a file's Visible to and presses one of its choices.
const choose = (index: number, label: string) => {
  const toggle = screen.getAllByLabelText('Visible to')[index];
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
  fireEvent.click(within(toggle.parentElement as HTMLElement).getByRole('button', { name: label }));
};
const shown = () => screen.getAllByLabelText('Visible to').map((toggle) => toggle.textContent);

describe('setup context files', () => {
  it('keeps chosen files for after Create, with privacy, and asks again for names alone', () => {
    render(<Harness initial={{ contextFiles: [{ name: 'brief.pdf' }] }} />);
    expect(screen.getByText('brief.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Attach again')).toBeInTheDocument();
    const deck = new File(['%PDF'], 'deck.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [deck] } });
    expect(latest.contextFiles).toEqual([
      { name: 'brief.pdf', adminsOnly: false },
      { name: 'deck.pdf', adminsOnly: false },
    ]);
    expect(screen.getByText('Added to the session after Create.')).toBeInTheDocument();
    choose(1, 'Admins only');
    expect(latest.contextFiles).toEqual([
      { name: 'brief.pdf', adminsOnly: false },
      { name: 'deck.pdf', adminsOnly: true },
    ]);
    expect(screen.getByText('Files are added to the session once it is created.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), {
      target: { files: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })] },
    });
    expect(screen.getByText('Add a PDF, or a Markdown, plain text, CSV or JSON file.')).toBeInTheDocument();
    // A new session has cards off unless they are turned on here, so setup takes no image yet.
    expect(screen.getByTestId('ce-setup-context-cards')).not.toBeChecked();
    expect(screen.getByTestId('ce-setup-context-file-input').getAttribute('accept')).not.toMatch(/image|\.png/);
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), {
      target: { files: [new File(['png'], 'chart.png', { type: 'image/png' })] },
    });
    expect(
      screen.getByText('A session takes images only once Context cards are on in its settings.'),
    ).toBeInTheDocument();
    expect(latest.contextFiles).toEqual([
      { name: 'brief.pdf', adminsOnly: false },
      { name: 'deck.pdf', adminsOnly: true },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove brief.pdf' }));
    expect(latest.contextFiles).toEqual([{ name: 'deck.pdf', adminsOnly: true }]);
  });

  it('takes images once Context cards are turned on for the new session', () => {
    render(<Harness initial={{}} />);
    fireEvent.click(screen.getByTestId('ce-setup-context-cards'));
    expect(latest.contextCardsEnabled).toBe(true);
    expect(screen.getByTestId('ce-setup-context-file-input').getAttribute('accept')).toMatch(/image\/png/);
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), {
      target: { files: [new File(['png'], 'chart.png', { type: 'image/png' })] },
    });
    expect(latest.contextFiles).toEqual([{ name: 'chart.png', adminsOnly: false }]);
    // An image is read by the session's AI, as a PDF is.
    expect(screen.getByLabelText('Analyze with the session’s AI')).toBeChecked();
    fireEvent.click(screen.getByTestId('ce-setup-context-cards'));
    expect(latest.contextCardsEnabled).toBe(false);
    expect(screen.getByTestId('ce-setup-context-file-input').getAttribute('accept')).not.toMatch(/image/);
  });

  it('after Create, the session’s own setting decides on images, and the tick box is fixed', () => {
    const made = render(<Harness initial={{}} created config={{ slug: 'salon', contextCardsEnabled: true }} />);
    expect(screen.getByTestId('ce-setup-context-cards')).toBeChecked();
    expect(screen.getByTestId('ce-setup-context-cards')).toBeDisabled();
    expect(screen.getByTestId('ce-setup-context-file-input').getAttribute('accept')).toMatch(/image\/png/);
    made.unmount();
    // A draft ticked after a session was made without cards changes nothing: Settings does.
    render(<Harness initial={{ contextCardsEnabled: true }} created />);
    expect(screen.getByTestId('ce-setup-context-cards')).not.toBeChecked();
    expect(screen.getByTestId('ce-setup-context-cards')).toBeDisabled();
    expect(screen.getByTestId('ce-setup-context-file-input').getAttribute('accept')).not.toMatch(/image/);
  });

  it('after Create, adds the files, reads the PDFs asked for and the links, once', async () => {
    const { rerender } = render(
      <Harness
        initial={{
          contextFiles: [],
          sessionContext: { links: [{ label: 'Essay', url: 'https://example.org/essay' }] },
        }}
      />,
    );
    const deck = new File(['%PDF'], 'deck.pdf', { type: 'application/pdf' });
    const notes = new File(['# Notes'], 'notes.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [deck] } });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [notes] } });
    choose(0, 'Admins only');
    rerender(<Harness initial={{}} created />);
    // A re-render keeps the same harness state, now with a created session. The tick shows once the Worker has
    // said it does not read links by itself.
    expect(await screen.findByLabelText('Read the linked pages for the AI')).toBeChecked();
    await act(async () => fireEvent.click(screen.getByTestId('ce-setup-context-publish')));
    expect(uploadContextFile).toHaveBeenCalledWith(
      { file: deck, adminsOnly: true },
      expect.objectContaining({ sessionSlug: 'salon', asAdmin: true }),
    );
    expect(uploadContextFile).toHaveBeenCalledWith({ file: notes, adminsOnly: false }, expect.anything());
    expect(readContextPdf).toHaveBeenCalledTimes(1);
    expect(readContextPdf).toHaveBeenCalledWith('id-deck.pdf', expect.anything());
    expect(addContextLink).toHaveBeenCalledWith(
      { url: 'https://example.org/essay', title: 'Essay' },
      expect.anything(),
    );
    expect(latest.contextFiles).toEqual([]);
    expect(screen.getByTestId('ce-setup-context-status')).toHaveTextContent('Context added to the session.');
    expect(screen.queryByTestId('ce-setup-context-publish')).not.toBeInTheDocument();
  });

  it('leaves the links to a Worker that reads them by itself: no tick, and no second read from here', async () => {
    jest.mocked(workerReadsSessionLinks).mockResolvedValue(true);
    const initial = {
      contextFiles: [],
      sessionContext: { links: [{ label: 'Essay', url: 'https://example.org/essay' }] },
    };
    const { rerender, unmount } = render(<Harness initial={initial} />);
    const notes = new File(['# Notes'], 'notes.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [notes] } });
    rerender(<Harness initial={{}} created />);
    // Until the Worker has answered, nothing is added: the links' fate is not known yet.
    expect(screen.getByTestId('ce-setup-context-publish')).toBeDisabled();
    expect(await screen.findByTestId('ce-setup-context-links-read-by-worker')).toHaveTextContent(
      'The session reads its linked pages for the AI by itself.',
    );
    expect(screen.queryByLabelText('Read the linked pages for the AI')).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByTestId('ce-setup-context-publish')));
    expect(uploadContextFile).toHaveBeenCalledTimes(1);
    expect(addContextLink).not.toHaveBeenCalled();
    unmount();

    // With only links, nothing is left to do from here, and the page says who reads them.
    render(<Harness initial={initial} created />);
    expect(await screen.findByTestId('ce-setup-context-links-read-by-worker')).toHaveTextContent(
      'The session reads its linked pages for the AI by itself.',
    );
    expect(screen.queryByTestId('ce-setup-context-publish')).not.toBeInTheDocument();
    expect(addContextLink).not.toHaveBeenCalled();
    jest.mocked(workerReadsSessionLinks).mockResolvedValue(false);
  });

  it('reads no link from here when the Worker could not be asked, and says so', async () => {
    // Not a "no": on a Worker that does read them, a second read from here could store a page twice.
    jest.mocked(workerReadsSessionLinks).mockResolvedValue(null);
    render(
      <Harness
        initial={{
          contextFiles: [],
          sessionContext: { links: [{ label: 'Essay', url: 'https://example.org/essay' }] },
        }}
        created
      />,
    );
    expect(await screen.findByTestId('ce-setup-context-links-read-by-worker')).toHaveTextContent(
      'could not be asked whether it reads its linked pages by itself',
    );
    expect(screen.queryByLabelText('Read the linked pages for the AI')).not.toBeInTheDocument();
    expect(addContextLink).not.toHaveBeenCalled();
    jest.mocked(workerReadsSessionLinks).mockResolvedValue(false);
  });

  it('locks a file to groups set up before Create, and keeps it with admins once none of them is', () => {
    const salon = { groupId: 'group-salon', label: 'Reverse Alignment Salon' };
    const hosts = { groupId: 'group-hosts', label: 'Hosts' };
    const { rerender } = render(
      <Harness initial={{ contextFiles: [{ name: 'brief.pdf' }] }} groups={[salon, hosts]} />,
    );
    const toggle = screen.getByLabelText('Visible to');
    fireEvent.click(toggle);
    const choices = within(toggle.parentElement as HTMLElement).getByRole('group');
    expect(
      within(choices)
        .getAllByRole('button')
        .map((choice) => choice.textContent),
    ).toEqual(['Everyone in the session', 'Admins only', 'Reverse Alignment Salon', 'Hosts']);
    choose(0, 'Reverse Alignment Salon');
    choose(0, 'Hosts');
    expect(latest.contextFiles).toEqual([
      { name: 'brief.pdf', adminsOnly: true, groupIds: ['group-salon', 'group-hosts'] },
    ]);
    expect(shown()).toEqual(['Reverse Alignment Salon, Hosts']);
    // A template keeps no groups, so the file it carries is for admins, not everyone.
    const exported = sessionTemplateFromDraft(latest);
    expect(exported.ok && exported.template.contextFiles).toEqual([{ name: 'brief.pdf', adminsOnly: true }]);
    rerender(<Harness initial={{}} groups={[hosts]} />);
    expect(shown()).toEqual(['Hosts']);
    rerender(<Harness initial={{}} groups={[]} />);
    expect(shown()).toEqual(['Admins only']);
  });

  it('after Create, adds each file for the groups Create made, or keeps it with admins if it made none of them', async () => {
    const salon = { groupId: 'group-salon', label: 'Reverse Alignment Salon' };
    const later = { groupId: 'group-later', label: 'Later' };
    const { rerender } = render(<Harness initial={{ contextFiles: [] }} groups={[salon, later]} />);
    const brief = new File(['# Brief'], 'brief.md', { type: 'text/markdown' });
    const plan = new File(['# Plan'], 'plan.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [brief] } });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [plan] } });
    choose(0, 'Reverse Alignment Salon');
    choose(0, 'Later');
    choose(1, 'Later');
    // Create made only the salon group, and the list shows where each file will go.
    rerender(<Harness initial={{}} created made={[salon]} />);
    expect(shown()).toEqual(['Reverse Alignment Salon', 'Admins only']);
    await act(async () => fireEvent.click(screen.getByTestId('ce-setup-context-publish')));
    expect(uploadContextFile).toHaveBeenCalledWith({ file: brief, groupIds: ['group-salon'] }, expect.anything());
    expect(uploadContextFile).toHaveBeenCalledWith({ file: plan, adminsOnly: true }, expect.anything());
  });
});
