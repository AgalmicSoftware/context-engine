import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DemoAnalysisWorkspace from './DemoAnalysisWorkspace.jsx';

jest.mock('react-select', () => ({
  __esModule: true,
  default: ({
    inputId,
    isMulti,
    onChange,
    options = [],
    value = [],
  }) => (
    <select
      data-testid={inputId}
      id={inputId}
      multiple={Boolean(isMulti)}
      onChange={(event) => {
        if (isMulti) {
          const selectedValues = Array.from(event.target.selectedOptions).map((option) => option.value);
          onChange(
            options.filter((option) => selectedValues.includes(String(option.value)))
          );
          return;
        }
        const nextOption = options.find((option) => String(option.value) === event.target.value) || null;
        onChange(nextOption);
      }}
      value={Array.isArray(value) ? value.map((option) => option.value) : (value?.value || '')}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }) => <div data-testid="mock-composable-map">{children}</div>,
  Geographies: ({ children }) => children({
    geographies: [
      { rsmKey: 'usa', properties: { name: 'United States of America' } },
      { rsmKey: 'gbr', properties: { name: 'United Kingdom' } },
      { rsmKey: 'ind', properties: { name: 'India' } },
      { rsmKey: 'chn', properties: { name: 'China' } },
    ],
  }),
  Geography: ({ children, geography }) => (
    <div data-testid={`mock-geo-${geography.properties.name}`}>
      {children}
    </div>
  ),
  Sphere: () => null,
  Graticule: () => null,
}));

const setMultiSelectValues = (testId, values) => {
  const select = screen.getByTestId(testId);
  Array.from(select.options).forEach((option) => {
    option.selected = values.includes(option.value);
  });
  fireEvent.change(select);
};

describe('DemoAnalysisWorkspace', () => {
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
    expect(suggestionQuestionText).toBeTruthy();
    expect(screen.getByTestId('demo-analysis-question-breakdown')).toHaveTextContent(/overall/i);
    expect(screen.getByTestId('demo-analysis-report-summary').textContent).toMatch(/:/);
  });

  it('auto-selects a strong correlation from the wand action', async () => {
    render(<DemoAnalysisWorkspace />);

    fireEvent.click(screen.getByLabelText(/Auto-select strongest correlation/i));

    await waitFor(() => {
      expect(screen.queryByTestId('demo-analysis-empty-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('demo-analysis-selected-question').textContent).toBeTruthy();
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
});
