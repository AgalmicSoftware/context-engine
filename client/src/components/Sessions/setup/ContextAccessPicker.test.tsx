import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import ContextAccessPicker, { contextAccessKey, contextGroupsLabel } from './ContextAccessPicker';
import type { ContextFileAccess } from '../../../utilities/docLibrary/contextSources';

const GROUPS = [
  { groupId: 'salon', label: 'Salon' },
  { groupId: 'hosts', label: 'Hosts' },
];
let latest: ContextFileAccess = {};
const Harness = ({ allowAdminsOnly = false, onKeyDown }: { allowAdminsOnly?: boolean; onKeyDown?: () => void }) => {
  const [access, setAccess] = useState<ContextFileAccess>({});
  latest = access;
  return (
    <div onKeyDown={onKeyDown}>
      <label htmlFor="access">Visible to</label>
      <ContextAccessPicker
        id="access"
        value={access}
        groups={GROUPS}
        allowAdminsOnly={allowAdminsOnly}
        onChange={setAccess}
      />
      <button type="button">Elsewhere</button>
    </div>
  );
};
const toggle = () => screen.getByLabelText('Visible to');
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('a file’s Visible to', () => {
  it('opens as toggles, and any mix of groups replaces everyone until the last one is taken off', () => {
    render(<Harness />);
    expect(toggle()).toHaveTextContent('Everyone in the session');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Everyone in the session', pressed: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Admins only' })).toBeNull();

    press('Salon');
    press('Hosts');
    expect(latest).toEqual({ groupIds: ['salon', 'hosts'] });
    expect(toggle()).toHaveTextContent('Salon, Hosts');
    expect(screen.getByRole('button', { name: 'Everyone in the session', pressed: false })).toBeInTheDocument();
    press('Salon');
    expect(latest).toEqual({ groupIds: ['hosts'] });
    press('Hosts');
    expect(latest).toEqual({});
    expect(toggle()).toHaveTextContent('Everyone in the session');
  });

  it('gives admins Admins only, which clears the groups, as Everyone does', () => {
    render(<Harness allowAdminsOnly />);
    fireEvent.click(toggle());
    press('Salon');
    press('Admins only');
    expect(latest).toEqual({ adminsOnly: true });
    expect(screen.getByRole('button', { name: 'Salon', pressed: false })).toBeInTheDocument();
    press('Hosts');
    expect(latest).toEqual({ groupIds: ['hosts'] });
    press('Everyone in the session');
    expect(latest).toEqual({});
  });

  it('closes on Escape without closing what it sits in, on a click elsewhere, and when focus leaves', () => {
    const outerKeyDown = jest.fn();
    render(<Harness onKeyDown={outerKeyDown} />);
    fireEvent.click(toggle());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Salon' }), { key: 'Escape' });
    expect(screen.queryByRole('group')).toBeNull();
    expect(toggle()).toHaveFocus();
    expect(outerKeyDown).not.toHaveBeenCalled();

    fireEvent.click(toggle());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('group')).toBeNull();

    fireEvent.click(toggle());
    fireEvent.blur(screen.getByRole('button', { name: 'Salon' }), {
      relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }),
    });
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('names the groups it knows and counts the rest, and keys the same choice the same way', () => {
    expect(contextGroupsLabel(['salon', 'hosts'], GROUPS)).toBe('Salon, Hosts');
    expect(contextGroupsLabel(['salon', 'gone'], GROUPS)).toBe('Salon and one other group');
    expect(contextGroupsLabel(['gone', 'lost'], GROUPS)).toBe('2 groups');
    expect(contextAccessKey({ groupIds: ['salon', 'hosts'] })).toBe(contextAccessKey({ groupIds: ['hosts', 'salon'] }));
    expect(contextAccessKey({ adminsOnly: true, groupIds: ['salon'] })).toBe('admins');
    expect(contextAccessKey({ groupIds: [] })).toBe(contextAccessKey({}));
  });
});
