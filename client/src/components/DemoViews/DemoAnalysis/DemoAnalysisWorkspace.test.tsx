import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DemoAnalysisWorkspace from './DemoAnalysisWorkspace';

jest.mock('../../Shared/CheckboxMultiSelect', () => ({
  __esModule: true,
  default: ({ inputId, onChange, options = [], value = [] }: any) => (
    <select
      data-testid={inputId}
      id={inputId}
      multiple
      onChange={(event) => {
        const selectedValues = Array.from(event.target.selectedOptions).map((option: any) => option.value);
        onChange(options.filter((option: any) => selectedValues.includes(String(option.value))));
      }}
      value={Array.isArray(value) ? value.map((option) => option.value) : []}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }: any) => <div data-testid="mock-composable-map">{children}</div>,
  Geographies: ({ children }: any) =>
    children({
      geographies: [
        { rsmKey: 'usa', properties: { name: 'United States of America' } },
        { rsmKey: 'gbr', properties: { name: 'United Kingdom' } },
        { rsmKey: 'ind', properties: { name: 'India' } },
        { rsmKey: 'chn', properties: { name: 'China' } },
      ],
    }),
  Geography: ({ children, geography }: any) => (
    <div data-testid={`mock-geo-${geography.properties.name}`}>{children}</div>
  ),
  Sphere: () => null,
  Graticule: () => null,
}));

const setMultiSelectValues = (testId: string, values: string[]) => {
  const select = screen.getByTestId(testId) as HTMLSelectElement;
  Array.from(select.options).forEach((option) => {
    option.selected = values.includes(option.value);
  });
  fireEvent.change(select);
};

describe('DemoAnalysisWorkspace', () => {
  it('keeps the selected question banner readable on the light breakdown surface', () => {
    const scssPath = path.join(__dirname, 'DemoAnalysisWorkspace.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(
      /\.selectedQuestionFrame\s*{[\s\S]*background:\s*linear-gradient\(145deg,\s*#f8fbff 0%,\s*#edf4ff 100%\);/,
    );
    expect(scss).toMatch(/\.selectedQuestionFrame\s*{[\s\S]*border:\s*1px solid rgba\(15,\s*94,\s*199,\s*0\.14\);/);
    expect(scss).toMatch(/\.selectedQuestionCard\s*{[\s\S]*background:\s*transparent !important;/);
    expect(scss).toMatch(/\.selectedQuestionCardPrompt\s*{[\s\S]*color:\s*#1f2733 !important;/);
    expect(scss).toMatch(/\.selectedQuestionTension\s*{[\s\S]*color:\s*#364252;/);
    expect(scss).not.toMatch(/\.selectedQuestionCardPrompt\s*{[\s\S]*color:\s*#f8fbff;/);
  });

  it('starts with empty map and question breakdown states until a question is selected', () => {
    render(<DemoAnalysisWorkspace />);

    expect(screen.getByTestId('demo-analysis-world-map')).toHaveTextContent(/choose a comparison suggestion/i);
    expect(screen.getByTestId('demo-analysis-question-breakdown')).toHaveTextContent(/select a question to inspect/i);
    expect(screen.queryByTestId('demo-analysis-selected-question')).not.toBeInTheDocument();
  });

  it('updates the report when demographics are selected while keeping the map unselected', async () => {
    render(<DemoAnalysisWorkspace />);

    expect(screen.getByTestId('demo-analysis-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-world-map')).toHaveTextContent(/choose a comparison suggestion/i);

    setMultiSelectValues('demo-analysis-select-era', ['Modern', 'Industrial']);

    await waitFor(() => {
      expect(screen.getByTestId('demo-analysis-report-summary')).toHaveTextContent('Era: Modern');
      expect(screen.getByTestId('demo-analysis-report-summary')).toHaveTextContent('Era: Industrial');
    });

    expect(screen.queryByTestId('demo-analysis-empty-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-world-map')).toHaveTextContent(/choose a comparison suggestion/i);
    expect(screen.getAllByText('Era: Modern').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Era: Industrial').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Show .* More Tags/i })).toBeInTheDocument();
  });

  it('focuses the map only when country groups are selected after a question is chosen', async () => {
    render(<DemoAnalysisWorkspace />);

    setMultiSelectValues('demo-analysis-select-country', ['United States', 'United Kingdom']);
    fireEvent.click(screen.getByLabelText(/Auto-select strongest correlation/i));

    await waitFor(() => {
      expect(screen.getByTestId('demo-analysis-selected-question')).toBeInTheDocument();
    });

    expect(screen.getByText(/Country focus:/i)).toBeInTheDocument();
  });

  it('applies a suggestion pair and populates the map and breakdown when a suggestion is clicked', async () => {
    render(<DemoAnalysisWorkspace />);

    const firstSuggestion = await screen.findByTestId('demo-analysis-suggestion-0');
    const suggestionQuestionText = firstSuggestion.children[1]?.textContent || '';

    fireEvent.click(firstSuggestion);

    await waitFor(() => {
      expect(screen.queryByTestId('demo-analysis-empty-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('demo-analysis-selected-question').textContent).toBe(suggestionQuestionText);
    expect(screen.queryByTestId('demo-analysis-breakdown-question')).not.toBeInTheDocument();
    expect(suggestionQuestionText).toBeTruthy();
    expect(screen.getByTestId('demo-analysis-question-breakdown')).toHaveTextContent(/overall/i);
    expect(screen.getByTestId('demo-analysis-question-breakdown')).toHaveTextContent(/modeled responses/i);
    expect(screen.getByTestId('demo-analysis-question-breakdown')).not.toHaveTextContent(/personas\s*·/i);
    expect(screen.getByTestId('demo-analysis-report-summary').textContent).toMatch(/:/);
    expect(screen.getByTestId('demo-analysis-suggestion-0')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows corpus grounding and key tension for the selected question banner', async () => {
    render(
      <DemoAnalysisWorkspace
        sessionSlug="demo"
        demoData={{
          comments: [
            {
              commentBody: 'Custom grounded question',
              type: 'binary',
              category: 'CUSTOM GROUNDING',
              key_tension: 'A concrete test tension for the selected question banner.',
              sources: 'tweets, LessWrong',
            },
          ],
          participantsVotes: [
            {
              participant: '0xbase-ada',
              xid: 'AdaLovelace',
              votes: { 0: 1 },
            },
            {
              participant: '0xbase-grace',
              xid: 'GraceHopper',
              votes: { 0: -1 },
            },
          ],
        }}
        metadataByXid={{
          AdaLovelace: {
            eraBucket: 'Modern',
            region: 'Europe',
            country: 'United Kingdom',
            gender: 'Woman',
            affiliation: 'Mathematics',
            atlasCategory: 'Foundations',
          },
          GraceHopper: {
            eraBucket: 'Industrial',
            region: 'North America',
            country: 'United States',
            gender: 'Woman',
            affiliation: 'Computer Science',
            atlasCategory: 'Foundations',
          },
        }}
      />,
    );

    fireEvent.click(await screen.findByTestId('demo-analysis-suggestion-0'));

    await waitFor(() => {
      expect(screen.getByTestId('demo-analysis-selected-question')).toBeInTheDocument();
    });

    const banner = screen.getByTestId('demo-analysis-question-banner');
    const customGroundingTag = within(banner).getByRole('link', { name: 'Custom Grounding' });
    const tweetsTag = within(banner).getByRole('link', { name: 'Tweets' });

    expect(screen.getByTestId('demo-analysis-selected-question-tension')).toHaveTextContent(/Key tension:/i);
    expect(customGroundingTag).toHaveAttribute('href', '/tag/Custom%20Grounding?session=demo');
    expect(tweetsTag).toHaveAttribute('href', '/tag/Tweets?session=demo');
  });

  it('auto-selects a strong correlation from the wand action', async () => {
    render(<DemoAnalysisWorkspace />);

    fireEvent.click(screen.getByLabelText(/Auto-select strongest correlation/i));

    await waitFor(() => {
      expect(screen.queryByTestId('demo-analysis-empty-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('demo-analysis-selected-question').textContent).toBeTruthy();
    expect(screen.getByTestId('demo-analysis-question-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-analysis-breakdown-question')).not.toBeInTheDocument();
  });

  it('keeps auto-select usable after only one demographic segment is chosen', async () => {
    render(<DemoAnalysisWorkspace />);

    setMultiSelectValues('demo-analysis-select-era', ['Modern']);
    fireEvent.click(screen.getByLabelText(/Auto-select strongest correlation/i));

    await waitFor(() => {
      expect(screen.getByTestId('demo-analysis-selected-question')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('demo-analysis-empty-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-report-summary')).toHaveTextContent('Era: Modern');
  });

  it('shows the empty comparison state until at least two groups are selected', () => {
    render(<DemoAnalysisWorkspace />);

    expect(screen.getByTestId('demo-analysis-empty-state')).toHaveTextContent(/Select two or more demographic groups/i);

    setMultiSelectValues('demo-analysis-select-era', ['Modern']);

    expect(screen.getByTestId('demo-analysis-empty-state')).toBeInTheDocument();
  });

  it('does not expose the temporary drilldown details modal', async () => {
    render(<DemoAnalysisWorkspace />);

    fireEvent.click(await screen.findByTestId('demo-analysis-suggestion-0'));

    await waitFor(() => {
      expect(screen.getByTestId('demo-analysis-selected-question')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-analysis-drilldown-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modeled respondent mix')).not.toBeInTheDocument();
  });
});
