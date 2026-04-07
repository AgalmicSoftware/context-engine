import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import MetrChart from './MetrChart.jsx';

describe('MetrChart', () => {
  it('renders chart data above the summary and forwards tag clicks', () => {
    const onTagClick = jest.fn();
    const entry = {
      title: 'Measuring AI Ability to Complete Long Tasks',
      authors: ['Beth Barnes', 'et al.'],
      date: '2025-03-19',
      category: 'metric',
      summary: 'Time horizon trend summary.',
      tags: ['Time Horizon', 'METR'],
      url: 'https://metr.org/blog/example',
      chart_data: {
        type: 'bar',
        labels: ['2023 Q1', '2023 Q3', '2024 Q1'],
        values: [15, 45, 120],
        unit: 'minutes',
      },
    };

    render(
      <MemoryRouter>
        <MetrChart entry={entry} onTagClick={onTagClick} />
      </MemoryRouter>
    );

    expect(screen.getByText('Metric snapshot')).toBeInTheDocument();
    expect(screen.getByText('2023 Q1')).toBeInTheDocument();
    expect(screen.getByText('Time horizon trend summary.')).toBeInTheDocument();
    expect(screen.getAllByTitle('2024 Q1: 120 minutes')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View source' })).toHaveAttribute(
      'href',
      'https://metr.org/blog/example'
    );

    fireEvent.click(screen.getByRole('button', { name: 'METR' }));
    expect(onTagClick).toHaveBeenCalledWith('METR');
  });

  it('falls back to the standard entry-card layout when chart data is absent', () => {
    render(
      <MemoryRouter>
        <MetrChart
          entry={{
            title: 'Clarifying limitations of time horizon',
            authors: ['METR'],
            date: '2026-01-22',
            category: 'metric',
            summary: 'Time horizon is one signal among many.',
            tags: ['Time Horizon'],
          }}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText('Metric snapshot')).not.toBeInTheDocument();
    expect(screen.getByText('Time horizon is one signal among many.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Time Horizon' })).toBeInTheDocument();
  });
});
