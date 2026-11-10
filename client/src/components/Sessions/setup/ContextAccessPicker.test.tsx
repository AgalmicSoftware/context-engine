import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal, ModalBody } from 'reactstrap';

import ContextAccessPicker, { contextAccessKey, contextGroupsLabel } from './ContextAccessPicker';
import type { ContextFileAccess } from '../../../utilities/docLibrary/contextSources';

const GROUPS = [
  { groupId: 'salon', label: 'Salon' },
  { groupId: 'hosts', label: 'Hosts' },
];
let latest: ContextFileAccess = {};
const Harness = ({
  allowAdminsOnly = false,
  groups = GROUPS,
  initial = {},
  onKeyDown,
}: {
  allowAdminsOnly?: boolean;
  groups?: typeof GROUPS;
  initial?: ContextFileAccess;
  onKeyDown?: () => void;
}) => {
  const [access, setAccess] = useState<ContextFileAccess>(initial);
  latest = access;
  return (
    <div onKeyDown={onKeyDown}>
      <label htmlFor="access">Visible to</label>
      <ContextAccessPicker
        id="access"
        value={access}
        groups={groups}
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

  it('closes its choices on Escape without closing a dialog around it, which closes on the keyup', () => {
    const close = jest.fn();
    const InDialog = () => {
      const [access, setAccess] = useState<ContextFileAccess>({});
      return (
        <Modal isOpen fade={false} toggle={close}>
          <ModalBody>
            <ContextAccessPicker
              id="in-dialog"
              aria-label="Who can read it"
              value={access}
              groups={GROUPS}
              onChange={setAccess}
            />
          </ModalBody>
        </Modal>
      );
    };
    render(<InDialog />);
    const opener = screen.getByLabelText('Who can read it');
    fireEvent.click(opener);
    expect(screen.getByRole('group', { name: 'Who can read it' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Salon' }), { key: 'Escape', keyCode: 27 });
    fireEvent.keyUp(opener, { key: 'Escape', keyCode: 27 });
    expect(screen.queryByRole('group')).toBeNull();
    expect(close).not.toHaveBeenCalled();
    // With the choices closed, Escape belongs to the dialog again.
    fireEvent.keyDown(opener, { key: 'Escape', keyCode: 27 });
    fireEvent.keyUp(opener, { key: 'Escape', keyCode: 27 });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('stops at the most groups a file can be locked to, and says so', () => {
    const many = Array.from({ length: 21 }, (_, index) => ({ groupId: `g${index}`, label: `Group ${index}` }));
    render(<Harness groups={many} />);
    fireEvent.click(toggle());
    for (let index = 0; index < 20; index += 1) press(`Group ${index}`);
    expect(latest.groupIds).toHaveLength(20);
    expect(screen.getByRole('button', { name: 'Group 20' })).toBeDisabled();
    expect(screen.getByText('Up to 20 groups.')).toBeInTheDocument();
    press('Group 0');
    expect(screen.getByRole('button', { name: 'Group 20' })).toBeEnabled();
    expect(screen.queryByText('Up to 20 groups.')).toBeNull();
  });

  it('keeps focus in the picker when a group the list doesn’t name is taken off', () => {
    render(<Harness initial={{ groupIds: ['gone'] }} />);
    expect(toggle()).toHaveTextContent('One group');
    fireEvent.click(toggle());
    press('This group');
    expect(latest).toEqual({});
    expect(toggle()).toHaveFocus();
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
