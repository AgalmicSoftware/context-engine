import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { readContextPdf, uploadContextFile } from '../../utilities/docLibrary/contextSources';
import SessionContextAddFile from './SessionContextAddFile';

jest.mock('../../utilities/docLibrary/contextSources', () => ({
  ...(jest.requireActual('../../utilities/docLibrary/contextSources') as object),
  uploadContextFile: jest.fn(async () => 'new-file'),
  readContextPdf: jest.fn(async () => ({})),
}));

const upload = jest.mocked(uploadContextFile);
const read = jest.mocked(readContextPdf);
const options = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, context: { account: '0xme' } };
const pdf = () => new File(['%PDF'], 'deck.pdf', { type: 'application/pdf' });

const renderForm = (cardsOn: boolean) => {
  const onAdded = jest.fn();
  render(
    <SessionContextAddFile
      sessionSlug="salon"
      sessionConfig={{ slug: 'salon' }}
      account="0xme"
      groups={[]}
      cardsOn={cardsOn}
      onAdded={onAdded}
    />,
  );
  return onAdded;
};
const choose = (file: File) => fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } });
const add = () => act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add file' })));

describe('a participant adding a file to the context', () => {
  beforeEach(() => {
    upload.mockClear();
    read.mockClear();
  });

  it('has the session’s AI read their PDF or image where the session allows it, unless they untick it', async () => {
    renderForm(true);
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
    const onAdded = renderForm(true);
    choose(pdf());
    await add();
    expect(screen.getByRole('status')).toHaveTextContent(
      'File added, but the session’s AI could not read it: Rate limit exceeded.',
    );
    expect(onAdded).toHaveBeenCalled();
  });

  it('offers no reading for a text file, or where the session has none to offer', async () => {
    renderForm(true);
    choose(new File(['notes'], 'notes.md', { type: 'text/markdown' }));
    expect(screen.queryByLabelText('Analyze with the session’s AI')).not.toBeInTheDocument();
    await add();
    expect(read).not.toHaveBeenCalled();
  });

  it('asks for no reading, and takes no image, where cards are off or the Worker keeps none', async () => {
    renderForm(false);
    expect(screen.getByLabelText('File').getAttribute('accept')).not.toMatch(/image|\.png/);
    choose(new File(['png'], 'chart.png', { type: 'image/png' }));
    expect(
      screen.getByText('A session takes images only once Context cards are on in its settings.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add file' })).toBeDisabled();
    choose(pdf());
    expect(screen.queryByLabelText('Analyze with the session’s AI')).not.toBeInTheDocument();
    await add();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
  });
});
