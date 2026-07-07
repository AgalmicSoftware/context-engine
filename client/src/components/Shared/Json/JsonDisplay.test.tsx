import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import JsonDisplay from './JsonDisplay';
import { copyJsonToClipboard, formatJsonForDisplay } from '../../../utilities/ui/jsonFunctions';

jest.mock('../../../utilities/ui/jsonFunctions', () => ({
  copyJsonToClipboard: jest.fn(() => Promise.resolve()),
  formatJsonForDisplay: jest.fn(() => '{\n  "alpha": 1\n}'),
}));

describe('JsonDisplay', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no data is provided', () => {
    const { container } = render(<JsonDisplay data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('toggles the JSON panel and copies the underlying data', () => {
    render(<JsonDisplay data={{ alpha: 1 }} label="View .json" />);

    fireEvent.click(screen.getByRole('button', { name: /view \.json/i }));

    expect(formatJsonForDisplay).toHaveBeenCalledWith({ alpha: 1 });
    expect(screen.getByRole('button', { name: /copy json/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copy json/i }));
    expect(copyJsonToClipboard).toHaveBeenCalledWith({ alpha: 1 });
  });
});
