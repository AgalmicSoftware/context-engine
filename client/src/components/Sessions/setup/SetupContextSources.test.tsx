import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { SetupContextFiles, SetupContextPublisher, usePendingContextFiles } from './SetupContextSources';
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
const Harness = ({ initial, created = false }: { initial: SetupDraft; created?: boolean }) => {
  const [draft, setDraft] = useState<SetupDraft>(initial);
  const pending = usePendingContextFiles();
  latest = draft;
  const onChange = ([key]: string[], value: unknown) => setDraft((prev) => ({ ...prev, [key]: value }));
  return (
    <>
      <SetupContextFiles draft={draft} onChange={onChange} pending={pending} />
      <SetupContextPublisher
        draft={draft}
        onChange={onChange}
        pending={pending}
        sessionConfig={created ? { slug: 'salon' } : null}
        sessionSlug="salon"
        account="0xadmin"
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
    fireEvent.click(screen.getAllByLabelText('Admins only')[1]);
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
    fireEvent.click(screen.getAllByLabelText('Admins only')[0]);
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
});
