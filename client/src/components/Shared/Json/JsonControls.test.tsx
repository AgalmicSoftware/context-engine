import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons';

import { JsonIconButton, JsonPanel, JsonToggleButton } from './JsonControls';

describe('JsonControls', () => {
  it('fires onClick for JsonIconButton', () => {
    const onClick = jest.fn();
    render(<JsonIconButton label=".json" title="View JSON" onClick={onClick} />);

    const button = screen.getByRole('button', { name: /view json/i });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders JsonToggleButton with icon and active state', () => {
    render(<JsonToggleButton label="Show JSON" active icon={faCaretUp} onClick={() => {}} />);

    const button = screen.getByRole('button', { name: /show json/i });
    expect(button.className).toContain('jsonToggleButtonActive');
  });

  it('renders JsonPanel copy button and calls handler', () => {
    const onCopy = jest.fn();
    render(
      <JsonPanel onCopy={onCopy} copyTitle="Copy JSON">
        {'{}'}
      </JsonPanel>,
    );

    const copyButton = screen.getByRole('button', { name: /copy json/i });
    fireEvent.click(copyButton);

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('omits JsonPanel copy button when handler is missing', () => {
    render(<JsonPanel>{'{}'}</JsonPanel>);

    const copyButton = screen.queryByRole('button', { name: /copy json/i });
    expect(copyButton).toBeNull();
  });
});
