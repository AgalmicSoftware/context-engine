import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { addContextLink, readContextPdf, uploadContextFile } from '../../utilities/docLibrary/contextSources';
import SessionContextComposer, { contextLinkIn } from './SessionContextComposer';

jest.mock('../../utilities/docLibrary/contextSources', () => ({
  ...(jest.requireActual('../../utilities/docLibrary/contextSources') as object),
  uploadContextFile: jest.fn(async () => 'new-file'),
  readContextPdf: jest.fn(async () => ({})),
  addContextLink: jest.fn(async () => ({})),
}));

const upload = jest.mocked(uploadContextFile);
const read = jest.mocked(readContextPdf);
const link = jest.mocked(addContextLink);
const options = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, context: { account: '0xme' } };
const groups = [
  { groupId: 'salon', label: 'Salon' },
  { groupId: 'hosts', label: 'Hosts' },
];
const pdf = () => new File(['%PDF'], 'deck.pdf', { type: 'application/pdf' });

const renderBox = (props: Partial<React.ComponentProps<typeof SessionContextComposer>> = {}) => {
  const onAdded = jest.fn();
  render(
    <SessionContextComposer
      sessionSlug="salon"
      sessionConfig={{ slug: 'salon' }}
      account="0xme"
      groups={groups}
      onAdded={onAdded}
      {...props}
    />,
  );
  return onAdded;
};
const box = () => screen.getByTestId('ce-session-context-compose');
const type = (value: string) => fireEvent.change(box(), { target: { value } });
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('ce-session-context-file-input'), { target: { files: [file] } });
const addButton = () => screen.getByTestId('ce-session-context-compose-add');
const add = () => act(async () => fireEvent.click(addButton()));
const says = () => screen.getByTestId('ce-session-context-compose-says').textContent;
const pick = (label: string) => {
  const toggle = screen.getByTestId('ce-session-context-access');
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: label }));
};
const textOf = (file: File) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(file);
  });

describe('the one box that adds to a session’s context', () => {
  beforeEach(() => {
    upload.mockClear();
    read.mockClear();
    link.mockClear();
  });

  it('tells a lone https address from a note', () => {
    expect(contextLinkIn(' https://example.org/essay ')).toBe('https://example.org/essay');
    expect(contextLinkIn('http://example.org')).toBe('');
    expect(contextLinkIn('See https://example.org/essay')).toBe('');
    expect(contextLinkIn('https://example.org/a b')).toBe('');
    expect(contextLinkIn(`https://example.org/${'a'.repeat(1000)}`)).toBe('');
    expect(contextLinkIn('')).toBe('');
  });

  it('adds nothing until there is something to add, then a typed note as a Markdown file', async () => {
    const onAdded = renderBox();
    expect(addButton()).toBeDisabled();
    expect(screen.queryByLabelText('Note title')).not.toBeInTheDocument();
    type('  Residents asked for evening sessions.  ');
    expect(says()).toBe('Adds a note for everyone in the session.');
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Evening sessions' } });
    pick('Salon');
    expect(says()).toBe('Adds a note for Salon.');
    await add();
    const [[{ file: note, groupIds }, sent]] = upload.mock.calls;
    expect(note.name).toBe('Evening sessions.md');
    expect(note.type).toBe('text/markdown');
    expect(await textOf(note)).toBe('Residents asked for evening sessions.');
    expect(groupIds).toEqual(['salon']);
    expect(sent).toEqual(options);
    expect(link).not.toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Note added.');
    expect(box()).toHaveValue('');
  });

  it('adds a lone https address as a link, for everyone, where links are taken', async () => {
    const onAdded = renderBox({ linksAllowed: true });
    type(' https://example.org/essay ');
    expect(says()).toBe('Adds a link for everyone in the session: the session reads the page for its AI.');
    fireEvent.change(screen.getByLabelText('Link title'), { target: { value: 'Essay' } });
    await add();
    expect(link).toHaveBeenCalledWith({ url: 'https://example.org/essay', title: 'Essay' }, options);
    expect(upload).not.toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Link added.');

    // A link is for everyone. For a group, the address is kept as a note, so the audience chosen is never widened.
    type('https://example.org/other');
    pick('Hosts');
    expect(says()).toBe('A link can be for everyone, so for Hosts this address is kept as a note.');
    expect(screen.queryByRole('button', { name: 'Admins only' })).not.toBeInTheDocument();
    await add();
    expect(link).toHaveBeenCalledTimes(1);
    const [{ file: kept, groupIds }] = upload.mock.calls[0];
    expect(await textOf(kept)).toBe('https://example.org/other');
    expect(groupIds).toEqual(['hosts']);
  });

  it('keeps an address as a note where links are not taken, and says so', async () => {
    renderBox();
    expect(box()).toHaveAttribute('placeholder', 'Write a note, or drop a file');
    type('https://example.org/essay');
    expect(says()).toBe('Links can’t be added here, so this is kept as a note for everyone in the session.');
    await add();
    expect(link).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('lets an admin add a link for admins only, and anything for admins only', async () => {
    renderBox({ asAdmin: true, linksAllowed: true });
    type('https://example.org/private');
    pick('Admins only');
    expect(says()).toBe('Adds a link for admins only: the session reads the page for its AI.');
    await add();
    expect(link).toHaveBeenCalledWith(
      { url: 'https://example.org/private', title: '', adminsOnly: true },
      { ...options, asAdmin: true },
    );
    type('For the hosts.');
    expect(says()).toBe('Adds a note for admins only.');
    await add();
    expect(upload).toHaveBeenLastCalledWith(expect.objectContaining({ adminsOnly: true }), {
      ...options,
      asAdmin: true,
    });
    // Groups are not for links, for an admin either: the address is kept as a note for the group.
    type('https://example.org/x');
    pick('Hosts');
    expect(says()).toBe('A link can be for everyone or for admins only, so for Hosts this address is kept as a note.');
    await add();
    expect(link).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenLastCalledWith(expect.objectContaining({ groupIds: ['hosts'] }), {
      ...options,
      asAdmin: true,
    });
  });

  it('adds an admin’s file as an admin, read by the AI with cards off too, and says how to retry a failed read', async () => {
    read.mockRejectedValueOnce('offline');
    renderBox({ asAdmin: true, linksAllowed: true });
    choose(pdf());
    expect(screen.getByLabelText('Analyze with the session’s AI')).toBeChecked();
    pick('Hosts');
    await add();
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ groupIds: ['hosts'] }), {
      ...options,
      asAdmin: true,
    });
    expect(read).toHaveBeenCalledWith('new-file', { ...options, asAdmin: true });
    expect(screen.getByRole('status')).toHaveTextContent('could not read it: try Read with AI.');
  });

  it('keeps what was typed when a file is attached and added, and takes one file at a time', async () => {
    renderBox();
    type('A note I was writing');
    const notes = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('ce-session-context-file-input'), {
      target: { files: [notes, new File(['b'], 'second.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Only notes.txt was taken. Add the others one at a time.');
    expect(says()).toBe('Adds this file for everyone in the session. What you typed is kept in the box for after.');
    await add();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith({ file: notes }, options);
    // The note was not sent, and is still there to add.
    expect(box()).toHaveValue('A note I was writing');
    expect(says()).toBe('Adds a note for everyone in the session.');
    // Removing a chosen file puts focus on the attach button beside it.
    choose(notes);
    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }));
    expect(screen.getByRole('button', { name: 'Attach a file' })).toHaveFocus();
    expect(addButton()).toHaveAccessibleDescription('Adds a note for everyone in the session.');
  });

  it('shows an attached or dropped file in the box, removable, and adds it for the groups chosen', async () => {
    const onAdded = renderBox();
    const notes = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    choose(notes);
    expect(screen.getByTestId('ce-session-context-chosen-file')).toHaveTextContent('notes.txt');
    expect(screen.queryByTestId('ce-session-context-compose')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }));
    expect(box()).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();

    fireEvent.drop(box().parentElement as HTMLElement, { dataTransfer: { files: [notes], types: ['Files'] } });
    expect(screen.getByTestId('ce-session-context-chosen-file')).toHaveTextContent('notes.txt');
    pick('Salon');
    pick('Hosts');
    expect(says()).toBe('Adds this file for Salon, Hosts.');
    await add();
    expect(upload).toHaveBeenCalledWith({ file: notes, groupIds: ['salon', 'hosts'] }, options);
    expect(onAdded).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('File added.');
    expect(box()).toBeInTheDocument();
  });

  it('has the session’s AI read a PDF or image where the session allows it, unless it is unticked', async () => {
    renderBox({ cardsOn: true });
    choose(pdf());
    expect(screen.getByLabelText('Analyze with the session’s AI')).toBeChecked();
    await add();
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ file: expect.any(File) }), options);
    expect(read).toHaveBeenCalledWith('new-file', options);
    expect(screen.getByRole('status')).toHaveTextContent('File added and read by the session’s AI.');

    choose(new File(['png'], 'chart.png', { type: 'image/png' }));
    fireEvent.click(screen.getByLabelText('Analyze with the session’s AI'));
    await add();
    expect(upload).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('File added.');
  });

  it('says so when the file is added but the AI could not read it', async () => {
    read.mockRejectedValueOnce(new Error('Rate limit exceeded.'));
    const onAdded = renderBox({ cardsOn: true });
    choose(pdf());
    await add();
    expect(screen.getByRole('status')).toHaveTextContent(
      'File added, but the session’s AI could not read it: Rate limit exceeded.',
    );
    expect(onAdded).toHaveBeenCalled();
  });

  it('offers no reading for a text file, and none and no images where cards are off', async () => {
    renderBox({ cardsOn: true });
    choose(new File(['notes'], 'notes.md', { type: 'text/markdown' }));
    expect(screen.queryByLabelText('Analyze with the session’s AI')).not.toBeInTheDocument();
    await add();
    expect(read).not.toHaveBeenCalled();
  });

  it('asks for no reading, and takes no image, where cards are off or the Worker keeps none', async () => {
    renderBox();
    expect(screen.getByTestId('ce-session-context-file-input').getAttribute('accept')).not.toMatch(/image|\.png/);
    choose(new File(['png'], 'chart.png', { type: 'image/png' }));
    expect(
      screen.getByText('A session takes images only once Context cards are on in its settings.'),
    ).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove chart.png' }));
    choose(pdf());
    expect(screen.queryByLabelText('Analyze with the session’s AI')).not.toBeInTheDocument();
    await add();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps what was typed when adding fails, and says why', async () => {
    upload.mockRejectedValueOnce(new Error('You have added as many items as this session allows.'));
    renderBox();
    type('A note');
    await add();
    expect(screen.getByRole('status')).toHaveTextContent('You have added as many items as this session allows.');
    expect(box()).toHaveValue('A note');
  });
});
