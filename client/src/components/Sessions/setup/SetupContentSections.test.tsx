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
  it('takes instructions for AI agents on Worker-hosted sessions, saying agents read them and anyone can', () => {
    const { unmount } = render(<Harness Section={WorkerParticipation} initial={{ interviewModeEnabled: false }} />);
    const field = screen.getByLabelText('Instructions for AI agents');
    expect(field).toHaveAttribute('maxlength', '8000');
    expect(field).toHaveAccessibleDescription(
      'Optional, in Markdown. AI agents read these before taking part, for example to learn which group to join. Anyone can read them, at the Session Worker’s /llms.txt.',
    );
    expect(screen.getByRole('button', { name: 'About Instructions for AI agents' })).toBeInTheDocument();
    fireEvent.change(field, { target: { value: '# Taking part\n\nJoin the group tagged ai-agents.' } });
    expect(latest.agentInstructions).toBe('# Taking part\n\nJoin the group tagged ai-agents.');
    unmount();

    render(<Harness Section={ChainParticipation} initial={{ interviewModeEnabled: false, agentInstructions: 'x' }} />);
    expect(screen.queryByLabelText('Instructions for AI agents')).not.toBeInTheDocument();
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
