import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  SetupContextFiles,
  SetupContextPublisher,
  usePendingContextFiles,
  type SetupGroupOption,
} from './SetupContextSources';
import { addContextLink, readContextPdf, uploadContextFile } from '../../../utilities/docLibrary/contextSources';
import type { SetupDraft } from './setupSectionTypes';

jest.mock('../../../utilities/docLibrary/contextSources', () => ({
  ...jest.requireActual<typeof import('../../../utilities/docLibrary/contextSources')>(
    '../../../utilities/docLibrary/contextSources',
  ),
  addContextLink: jest.fn(async () => ({})),
  readContextPdf: jest.fn(async () => ({})),
  uploadContextFile: jest.fn(async ({ file }: { file: File }) => `id-${file.name}`),
}));

let latest: SetupDraft = {};
// The page holds the draft and the chosen files; the session exists once `created`.
const Harness = ({
  initial,
  created = false,
  groups = [],
  made = [],
}: {
  initial: SetupDraft;
  created?: boolean;
  groups?: SetupGroupOption[];
  made?: SetupGroupOption[];
}) => {
  const [draft, setDraft] = useState<SetupDraft>(initial);
  const pending = usePendingContextFiles();
  latest = draft;
  const onChange = ([key]: string[], value: unknown) => setDraft((prev) => ({ ...prev, [key]: value }));
  return (
    <>
      <SetupContextFiles draft={draft} onChange={onChange} pending={pending} groups={groups} />
      <SetupContextPublisher
        draft={draft}
        onChange={onChange}
        pending={pending}
        sessionConfig={created ? { slug: 'salon' } : null}
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
    fireEvent.change(screen.getAllByLabelText('Visible to')[1], { target: { value: 'admins' } });
    expect(latest.contextFiles).toEqual([
      { name: 'brief.pdf', adminsOnly: false },
      { name: 'deck.pdf', adminsOnly: true },
    ]);
    expect(screen.getByText('Files are added to the session once it is created.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), {
      target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] },
    });
    expect(screen.getByText(/Add a PDF, Markdown, plain text, CSV or JSON file/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove brief.pdf' }));
    expect(latest.contextFiles).toEqual([{ name: 'deck.pdf', adminsOnly: true }]);
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
    fireEvent.change(screen.getAllByLabelText('Visible to')[0], { target: { value: 'admins' } });
    rerender(<Harness initial={{}} created />);
    // A re-render keeps the same harness state, now with a created session.
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

  it('locks a file to a group set up before Create, and keeps it with admins if that group goes', () => {
    const salon = { groupId: 'group-salon', label: 'Reverse Alignment Salon' };
    const { rerender } = render(<Harness initial={{ contextFiles: [{ name: 'brief.pdf' }] }} groups={[salon]} />);
    const visibleTo = screen.getByLabelText('Visible to');
    expect([...visibleTo.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'Everyone in the session',
      'Admins only',
      'Reverse Alignment Salon',
    ]);
    fireEvent.change(visibleTo, { target: { value: 'group:group-salon' } });
    expect(latest.contextFiles).toEqual([{ name: 'brief.pdf', adminsOnly: false, groupId: 'group-salon' }]);
    rerender(<Harness initial={{}} groups={[]} />);
    expect(screen.getByLabelText('Visible to')).toHaveValue('admins');
  });

  it('after Create, adds a file locked to a group Create made, and keeps one whose group it did not make with admins', async () => {
    const salon = { groupId: 'group-salon', label: 'Reverse Alignment Salon' };
    const later = { groupId: 'group-later', label: 'Later' };
    const { rerender } = render(<Harness initial={{ contextFiles: [] }} groups={[salon, later]} />);
    const brief = new File(['# Brief'], 'brief.md', { type: 'text/markdown' });
    const plan = new File(['# Plan'], 'plan.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [brief] } });
    fireEvent.change(screen.getByTestId('ce-setup-context-file-input'), { target: { files: [plan] } });
    fireEvent.change(screen.getAllByLabelText('Visible to')[0], { target: { value: 'group:group-salon' } });
    fireEvent.change(screen.getAllByLabelText('Visible to')[1], { target: { value: 'group:group-later' } });
    // Create made only the salon group.
    rerender(<Harness initial={{}} created made={[salon]} />);
    await act(async () => fireEvent.click(screen.getByTestId('ce-setup-context-publish')));
    expect(uploadContextFile).toHaveBeenCalledWith({ file: brief, groupId: 'group-salon' }, expect.anything());
    expect(uploadContextFile).toHaveBeenCalledWith({ file: plan, adminsOnly: true }, expect.anything());
  });
});
