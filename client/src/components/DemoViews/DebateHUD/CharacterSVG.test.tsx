import React from 'react';
import { render, screen } from '@testing-library/react';

import { Avatar, CharacterSVG } from './CharacterSVG';

describe('CharacterSVG', () => {
  it('renders known debate figures as fixed-size SVG portraits', () => {
    const { container } = render(<CharacterSVG name="Condorcet" size={48} />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('falls back to initials for figures without bundled SVG art', () => {
    render(<Avatar name="Ada Lovelace" color="#123456" size={40} />);

    const fallback = screen.getByText('AL');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveStyle({ width: '40px', height: '40px' });
  });
});
