import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BullhornToggleButton from './BullhornToggleButton';

describe('BullhornToggleButton', () => {
  it('applies active classes when active and invokes the click handler', () => {
    const onClick = jest.fn();
    render(<BullhornToggleButton active onClick={onClick} />);

    const button = screen.getByRole('button', { name: /conviction \/ importance/i });
    fireEvent.click(button);

    expect(button.className).toContain('iconButtonActive');
    expect(document.querySelector('svg.iconGlow')).not.toBeNull();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the active classes when inactive', () => {
    render(<BullhornToggleButton active={false} />);

    const button = screen.getByRole('button', { name: /conviction \/ importance/i });

    expect(button.className).not.toContain('iconButtonActive');
    expect(document.querySelector('svg.iconGlow')).toBeNull();
  });

  it('builds bullhorn display helpers', () => {
    expect(
      buildBullhornToggleButtonClassName({
        active: true,
        activeClassName: 'active',
        baseClassName: 'base',
        bullhornClassName: 'bullhorn',
        commentClassName: 'comment',
      }),
    ).toBe('base comment bullhorn active');
    expect(
      buildBullhornToggleButtonClassName({
        active: false,
        activeClassName: 'active',
        baseClassName: 'base',
        bullhornClassName: 'bullhorn',
        commentClassName: 'comment',
      }),
    ).toBe('base comment bullhorn');
    expect(
      resolveBullhornToggleIconClassName({
        active: true,
        iconGlowClassName: 'glow',
      }),
    ).toBe('glow');
    expect(
      resolveBullhornToggleIconClassName({
        active: false,
        iconGlowClassName: 'glow',
      }),
    ).toBeUndefined();
  });
});
