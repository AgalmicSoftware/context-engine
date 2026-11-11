import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import {
  SetupContextSection,
  SetupParticipationSection,
  SetupQuestionsSection,
  describeContextProblem,
} from './SetupContentSections';
import type { SetupDraft, SetupSectionProps } from './setupSectionTypes';
import { readContextHtmlPage } from '../../OnePageSession/SessionContextHtml';

let latest: SetupDraft = {};

// Holds the draft the way the page does: each section writes one top-level key.
const Harness = ({
  initial,
  Section,
}: {
  initial: SetupDraft;
  Section: (props: SetupSectionProps) => React.ReactElement | null;
}) => {
  const [draft, setDraft] = useState<SetupDraft>(initial);
  latest = draft;
  return (
    <Section
      draft={draft}
      onChange={([key], value) => setDraft((prev) => ({ ...prev, [key]: value }))}
      mode="create"
      open
      onToggle={() => {}}
      conflicts={[]}
    />
  );
};

const WorkerParticipation = (props: SetupSectionProps) => <SetupParticipationSection {...props} workerHosted />;
const ChainParticipation = (props: SetupSectionProps) => <SetupParticipationSection {...props} workerHosted={false} />;

describe('setup content sections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('takes instructions for AI agents on Worker-hosted sessions, saying they add to the site’s guide and are public', () => {
    const { unmount } = render(<Harness Section={WorkerParticipation} initial={{ interviewModeEnabled: false }} />);
    const field = screen.getByLabelText('Instructions for AI agents');
    expect(field).toHaveAttribute('maxlength', '8000');
    expect(field).toHaveAccessibleDescription(
      'Optional Markdown that AI agents read before taking part, such as which group to join or what to focus on. It adds to the site’s guide for agents. Anyone can read it without signing in, at the Session Worker’s /session-config and /llms.txt, so put nothing private in it.',
    );
    expect(screen.getByRole('button', { name: 'About Instructions for AI agents' })).toBeInTheDocument();
    fireEvent.change(field, { target: { value: '# Taking part\n\nJoin the Reviewers group.' } });
    expect(latest.agentInstructions).toBe('# Taking part\n\nJoin the Reviewers group.');
    unmount();

    render(<Harness Section={ChainParticipation} initial={{ interviewModeEnabled: false, agentInstructions: 'x' }} />);
    expect(screen.queryByLabelText('Instructions for AI agents')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Instructions file')).not.toBeInTheDocument();
  });

  it('loads instructions for AI agents from a .md or .txt file into the box, up to 8,000 characters', async () => {
    render(
      <Harness Section={WorkerParticipation} initial={{ interviewModeEnabled: false, agentInstructions: 'Earlier' }} />,
    );
    const file = screen.getByLabelText('Instructions file');
    const choose = (contents: string, name: string, type: string) =>
      fireEvent.change(file, { target: { files: [new File([contents], name, { type })] } });
    expect(file).toHaveAttribute('accept', '.md,.txt,text/markdown,text/plain');
    expect(file).toHaveAccessibleDescription(
      'A .md or .txt file of up to 8,000 characters. Its text replaces the instructions above, where you can edit it.',
    );

    choose('# Taking part\n\nJoin the Reviewers group.', 'agents.md', 'text/markdown');
    await waitFor(() =>
      expect(screen.getByLabelText('Instructions for AI agents')).toHaveValue(
        '# Taking part\n\nJoin the Reviewers group.',
      ),
    );
    choose('Focus on the budget questions.', 'agents.txt', 'text/plain');
    await waitFor(() => expect(latest.agentInstructions).toBe('Focus on the budget questions.'));

    choose('x'.repeat(8001), 'long.md', 'text/markdown');
    expect(await screen.findByRole('alert')).toHaveTextContent('The file is longer than 8,000 characters.');
    expect(latest.agentInstructions).toBe('Focus on the budget questions.');

    // 8,001 characters as saved, and 8,000 once its CRLF is one line break, as in the box.
    choose(`${'x'.repeat(3999)}\r\n${'x'.repeat(4000)}`, 'windows.txt', 'text/plain');
    await waitFor(() => expect(latest.agentInstructions).toBe(`${'x'.repeat(3999)}\n${'x'.repeat(4000)}`));
  });

  it.each([
    ['in another encoding', [0x63, 0x61, 0x66, 0xe9]],
    ['binary', [0x50, 0x4b, 0x00, 0x03]],
  ])('refuses an instructions file %s and keeps the box as it was', async (_label, bytes) => {
    render(
      <Harness Section={WorkerParticipation} initial={{ interviewModeEnabled: false, agentInstructions: 'Earlier' }} />,
    );
    fireEvent.change(screen.getByLabelText('Instructions file'), {
      target: { files: [new File([new Uint8Array(bytes)], 'agents.txt', { type: 'text/plain' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('This file isn’t plain text saved as UTF-8.');
    expect(latest.agentInstructions).toBe('Earlier');
  });

  it('refuses an oversized or unreadable instructions file, and clears the picker after each try', async () => {
    const reads = jest.spyOn(FileReader.prototype, 'readAsText');
    render(
      <Harness Section={WorkerParticipation} initial={{ interviewModeEnabled: false, agentInstructions: 'Earlier' }} />,
    );
    const picker = screen.getByLabelText('Instructions file');
    // A cleared picker fires again when the same file is chosen.
    const clears = jest.fn();
    Object.defineProperty(picker, 'value', { configurable: true, get: () => '', set: clears });
    const choose = (file: File) => fireEvent.change(picker, { target: { files: [file] } });

    // No character takes more than 4 bytes, so a larger file is refused unread.
    choose(new File(['x'.repeat(32001)], 'huge.md', { type: 'text/markdown' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The file is longer than 8,000 characters.');
    expect(reads).not.toHaveBeenCalled();
    await waitFor(() => expect(clears).toHaveBeenCalledWith(''));

    reads.mockImplementationOnce(function (this: FileReader) {
      this.onerror?.call(this, new ProgressEvent('error') as ProgressEvent<FileReader>);
    });
    choose(new File(['Join the Reviewers group.'], 'agents.md', { type: 'text/markdown' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This file couldn’t be read.'));
    await waitFor(() => expect(clears).toHaveBeenCalledTimes(2));
    expect(latest.agentInstructions).toBe('Earlier');
  });

  it('edits the context title, paragraphs and https links, and asks for files again', () => {
    render(<Harness Section={SetupContextSection} initial={{ contextFiles: [{ name: 'brief.pdf' }] }} />);
    expect(screen.getByTestId('ce-setup-summary-context')).toHaveTextContent('No context yet');
    expect(screen.getByTestId('ce-setup-context-files')).toHaveTextContent(
      'Attach these files again after setup: brief.pdf.',
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Background' } });
    fireEvent.click(screen.getByTestId('ce-setup-context-add-paragraph'));
    fireEvent.change(screen.getByLabelText('Paragraph 1'), { target: { value: 'Parks need shade.' } });
    fireEvent.click(screen.getByTestId('ce-setup-context-add-link'));
    fireEvent.change(screen.getByLabelText('Link label'), { target: { value: 'Plan' } });
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'http://parks.example' } });
    expect(screen.getByText('Use an https:// link.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://parks.example' } });
    expect(screen.queryByText('Use an https:// link.')).not.toBeInTheDocument();
    expect(latest.sessionContext).toEqual({
      title: 'Background',
      paragraphs: ['Parks need shade.'],
      links: [{ label: 'Plan', url: 'https://parks.example' }],
    });
    expect(screen.getByTestId('ce-setup-summary-context')).toHaveTextContent('Background: 1 paragraph, 1 link');

    fireEvent.click(screen.getByRole('button', { name: 'Remove paragraph' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove link 1' }));
    expect(latest.sessionContext).toEqual({ title: 'Background', paragraphs: [], links: [] });
  });

  const uploadHtml = (body: string, name = 'atlas.html') =>
    fireEvent.change(screen.getByTestId('ce-setup-context-html-file'), {
      target: { files: [new File([body], name, { type: 'text/html' })] },
    });

  it('takes an HTML file instead of text, cleaned, with a preview that says what was removed', async () => {
    render(<Harness Section={SetupContextSection} initial={{}} />);
    fireEvent.change(screen.getByTestId('ce-setup-context-format'), { target: { value: 'html' } });
    expect(screen.queryByTestId('ce-setup-context-add-paragraph')).not.toBeInTheDocument();

    uploadHtml('<h2>Atlas</h2><script>steal()</script><p style="color:red">Who decides?</p>');
    expect(await screen.findByTestId('ce-setup-context-html-removed')).toHaveTextContent(
      'Removed from the file: <script>.',
    );
    expect(latest.sessionContext).toEqual({
      title: '',
      paragraphs: [],
      links: [],
      html: '<h2>Atlas</h2><p style="color:red">Who decides?</p>',
    });
    // The preview renders once its sanitizer has loaded.
    await waitFor(() =>
      expect(readContextHtmlPage(screen.getByTestId('ce-setup-context-html-shown'))?.textContent).toContain(
        'Who decides?',
      ),
    );
    const shown = readContextHtmlPage(screen.getByTestId('ce-setup-context-html-shown'));
    expect(shown?.querySelector('script')).toBeNull();
    expect(screen.getByTestId('ce-setup-summary-context')).toHaveTextContent('HTML file');

    uploadHtml('<p>Clean</p>');
    await waitFor(() =>
      expect(screen.getByTestId('ce-setup-context-html-removed')).toHaveTextContent(
        'Nothing was removed from the file.',
      ),
    );
    fireEvent.click(screen.getByTestId('ce-setup-context-html-remove'));
    expect(latest.sessionContext).toEqual({ title: '', paragraphs: [], links: [] });
  });

  it('refuses a file with nothing to show, or over 1 MB, and keeps the page it had', async () => {
    render(
      <Harness
        Section={SetupContextSection}
        initial={{ sessionContext: { title: '', paragraphs: [], links: [], html: '<p>Kept</p>' } }}
      />,
    );
    uploadHtml('<script>only()</script>');
    expect(await screen.findByTestId('ce-setup-context-html-error')).toHaveTextContent(
      'Nothing in this file can be shown.',
    );
    uploadHtml('x'.repeat(1024 * 1024 + 1));
    await waitFor(() =>
      expect(screen.getByTestId('ce-setup-context-html-error')).toHaveTextContent('The file is larger than 1 MB.'),
    );
    expect(latest.sessionContext).toEqual({ title: '', paragraphs: [], links: [], html: '<p>Kept</p>' });
  });

  it('asks before switching form discards the text or the HTML', () => {
    const confirm = jest.spyOn(window, 'confirm');
    try {
      render(
        <Harness
          Section={SetupContextSection}
          initial={{ sessionContext: { title: 'Notes', paragraphs: ['Typed'], links: [] } }}
        />,
      );
      const format = screen.getByTestId('ce-setup-context-format');
      confirm.mockReturnValueOnce(false);
      fireEvent.change(format, { target: { value: 'html' } });
      expect(format).toHaveValue('text');
      expect(latest.sessionContext).toEqual({ title: 'Notes', paragraphs: ['Typed'], links: [] });

      confirm.mockReturnValueOnce(true);
      fireEvent.change(format, { target: { value: 'html' } });
      expect(format).toHaveValue('html');
      expect(latest.sessionContext).toEqual({ title: 'Notes', paragraphs: [], links: [] });
      expect(confirm).toHaveBeenCalledTimes(2);
    } finally {
      confirm.mockRestore();
    }
  });

  it('shows stored HTML in the HTML form, and asks before going back to text', () => {
    const confirm = jest.spyOn(window, 'confirm');
    try {
      render(
        <Harness
          Section={SetupContextSection}
          initial={{ sessionContext: { title: 'Atlas', paragraphs: [], links: [], html: '<p>Page</p>' } }}
        />,
      );
      const format = screen.getByTestId('ce-setup-context-format');
      expect(format).toHaveValue('html');
      confirm.mockReturnValueOnce(false);
      fireEvent.change(format, { target: { value: 'text' } });
      expect(latest.sessionContext).toEqual({ title: 'Atlas', paragraphs: [], links: [], html: '<p>Page</p>' });
      confirm.mockReturnValueOnce(true);
      fireEvent.change(format, { target: { value: 'text' } });
      expect(format).toHaveValue('text');
      expect(latest.sessionContext).toEqual({ title: 'Atlas', paragraphs: [], links: [] });
      expect(screen.getByTestId('ce-setup-context-add-paragraph')).toBeInTheDocument();
    } finally {
      confirm.mockRestore();
    }
  });

  it('names what set-config would refuse and stops adding past the limits', () => {
    const paragraphs = Array.from({ length: 6 }, (_, index) => `Paragraph ${index}`);
    render(
      <Harness
        Section={SetupContextSection}
        initial={{ sessionContext: { title: 'x'.repeat(81), paragraphs, links: [] } }}
      />,
    );
    expect(screen.getByTestId('ce-setup-context-problems')).toHaveTextContent(
      'The context title is longer than 80 characters.',
    );
    expect(screen.getByTestId('ce-setup-context-add-paragraph')).toBeDisabled();
    expect(screen.getByLabelText('Paragraph 1')).toHaveAttribute('maxLength', '2000');
    expect(describeContextProblem(latest)).toBe('The context title is longer than 80 characters.');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Background' } });
    expect(screen.queryByTestId('ce-setup-context-problems')).not.toBeInTheDocument();
    expect(describeContextProblem(latest)).toBe('');
    expect(describeContextProblem({ sessionContext: { links: [{ label: 'Plan', url: 'http://plan.example' }] } })).toBe(
      'Link 1 must be an https:// link.',
    );
  });

  it('adds, edits and removes questions, asking choice questions for two options', () => {
    const scale = { min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' };
    render(
      <Harness
        Section={SetupQuestionsSection}
        initial={{ questions: [{ prompt: 'How safe?', type: 'rating', scale }] }}
      />,
    );
    expect(screen.getByText('Scale 1 (Low) to 5 (High)')).toBeInTheDocument();
    const add = screen.getByTestId('ce-setup-question-add');
    expect(add).toBeDisabled();

    fireEvent.change(screen.getByTestId('ce-setup-question-prompt'), { target: { value: ' Parks need shade. ' } });
    fireEvent.click(add);
    expect(latest.questions).toEqual([
      { prompt: 'How safe?', type: 'rating', scale },
      { prompt: 'Parks need shade.', type: 'binary', tags: [] },
    ]);
    expect(screen.getByTestId('ce-setup-summary-questions')).toHaveTextContent('2 questions');

    fireEvent.change(screen.getByLabelText('New question type'), { target: { value: 'multichoice' } });
    fireEvent.change(screen.getByTestId('ce-setup-question-prompt'), { target: { value: 'Which park?' } });
    const options = screen.getByLabelText('Options, one per line');
    fireEvent.change(options, { target: { value: 'North' } });
    expect(add).toBeDisabled();
    fireEvent.change(options, { target: { value: 'North\n\n South ' } });
    fireEvent.click(add);
    expect((latest.questions as unknown[])[2]).toEqual({
      prompt: 'Which park?',
      type: 'multichoice',
      tags: [],
      options: ['North', 'South'],
    });

    const rows = screen.getAllByTestId('ce-setup-question');
    fireEvent.change(within(rows[1]).getByLabelText('Question 2'), { target: { value: 'Parks need more shade.' } });
    const choices = within(rows[2]).getByLabelText('Question 3 options, one per line');
    fireEvent.change(choices, { target: { value: 'North\nEast \n' } });
    fireEvent.blur(choices);
    fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }));
    expect(latest.questions).toEqual([
      { prompt: 'Parks need more shade.', type: 'binary', tags: [] },
      { prompt: 'Which park?', type: 'multichoice', tags: [], options: ['North', 'East'] },
    ]);
  });
});
