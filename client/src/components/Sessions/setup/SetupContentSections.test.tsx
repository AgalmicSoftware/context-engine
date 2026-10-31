import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { SetupContextSection, SetupQuestionsSection } from './SetupContentSections';
import type { SetupDraft, SetupSectionProps } from './setupSectionTypes';

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

describe('setup content sections', () => {
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
