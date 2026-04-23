import React from 'react';
import { render, screen } from '@testing-library/react';
import RightSide from './RightSide';

describe('RightSide', () => {
  it('renders the home right sidebar shell', () => {
    render(<RightSide />);

    expect(screen.getByTestId('ce-home-right-sidebar')).toBeInTheDocument();
  });
});
