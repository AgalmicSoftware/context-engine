import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import CompareVenn from './CompareVenn';

const users = [
  {
    questions: [{ id: 'question-one', type: 'binary', answer: 'agree', prompt: 'Build the park?' }],
    sbts: [{ name: 'builders', image: 'https://arweave.net/builders' }],
  },
  {
    questions: [{ id: 'question-one', type: 'binary', answer: 'agree', prompt: 'Build the park?' }],
    sbts: [{ name: 'builders' }],
  },
];

describe('CompareVenn', () => {
  it('pins a region detail card on keyboard focus and closes it with Escape', () => {
    render(
      <CompareVenn
        dimension={2}
        labels={['Alpha', 'Beta']}
        users={users}
        sets={[new Set(['builders']), new Set(['builders'])]}
        preCounts={{ a: 0, b: 0, ab: 1 }}
        evidence={{ ab: ['question-one (+)'] }}
      />,
    );

    const intersection = screen.getByRole('button', { name: /Alpha & Beta: 1/ });
    fireEvent.focus(intersection);

    expect(intersection).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Alpha & Beta details' })).toBeInTheDocument();
    expect(screen.getByText(/Q questi\.\.\.-one: Build the park\?/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'builders membership' })).toBeInTheDocument();

    fireEvent.keyDown(intersection, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Alpha & Beta details' })).not.toBeInTheDocument();
  });

  it('previews on hover without pinning and clears the preview when the pointer leaves', () => {
    render(
      <CompareVenn
        dimension={2}
        labels={['Alpha', 'Beta']}
        users={users}
        sets={[new Set(['builders']), new Set(['builders'])]}
        preCounts={{ a: 0, b: 0, ab: 1 }}
        evidence={{ ab: ['question-one (+)'] }}
      />,
    );

    const intersection = screen.getByRole('button', { name: /Alpha & Beta: 1/ });
    fireEvent.mouseEnter(intersection);

    expect(intersection).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('region', { name: 'Alpha & Beta details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close Venn details' })).not.toBeInTheDocument();

    fireEvent.mouseLeave(intersection);
    expect(screen.queryByRole('region', { name: 'Alpha & Beta details' })).not.toBeInTheDocument();
  });

  it('renders the complete seven-region control surface for three participants', () => {
    render(
      <CompareVenn
        dimension={3}
        labels={['Alpha', 'Beta', 'Gamma']}
        users={[...users, { questions: [], sbts: [] }]}
        sets={[new Set(), new Set(), new Set()]}
        preCounts={{ a: 1, b: 2, c: 3, ab: 4, ac: 5, bc: 6, abc: 7 }}
        evidence={{}}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('button', { name: /Alpha, Beta & Gamma: 7/ })).toBeInTheDocument();
  });

  it('does not let a pin from a removed region block the next diagram model', () => {
    const { rerender } = render(
      <CompareVenn
        dimension={3}
        labels={['Alpha', 'Beta', 'Gamma']}
        users={[...users, { questions: [], sbts: [] }]}
        sets={[new Set(), new Set(), new Set()]}
        preCounts={{ c: 1 }}
        evidence={{}}
      />,
    );
    fireEvent.focus(screen.getByRole('button', { name: /Gamma only: 1/ }));

    rerender(
      <CompareVenn
        dimension={2}
        labels={['Alpha', 'Beta']}
        users={users}
        sets={[new Set(), new Set()]}
        preCounts={{ ab: 1 }}
        evidence={{ ab: ['question-one (+)'] }}
      />,
    );
    const intersection = screen.getByRole('button', { name: /Alpha & Beta: 1/ });
    fireEvent.mouseEnter(intersection);

    expect(screen.getByRole('region', { name: 'Alpha & Beta details' })).toBeInTheDocument();
  });
});
