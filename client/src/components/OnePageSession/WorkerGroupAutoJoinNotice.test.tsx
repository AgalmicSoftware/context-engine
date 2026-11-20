import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { VOICE_DIALOG_NOTICE_SLOT_ID } from '../../utilities/ui/voiceDialogNoticeSlot';
import WorkerGroupAutoJoinNotice from './WorkerGroupAutoJoinNotice';

const addSlot = () => {
  const slot = document.createElement('div');
  slot.id = VOICE_DIALOG_NOTICE_SLOT_ID;
  document.body.append(slot);
  return slot;
};

afterEach(() => document.getElementById(VOICE_DIALOG_NOTICE_SLOT_ID)?.remove());

const renderNotice = () =>
  render(
    <div data-testid="page">
      <WorkerGroupAutoJoinNotice groupLabel="Salon" message="Will be joined upon sign-in">
        <button type="button">Cancel auto-join</button>
      </WorkerGroupAutoJoinNotice>
    </div>,
  );

describe('WorkerGroupAutoJoinNotice', () => {
  it('stays on the page when no voice dialog is open', () => {
    renderNotice();
    expect(screen.getByTestId('page')).toContainElement(screen.getByTestId('ce-session-worker-group-auto-join'));
  });

  it('shows inside a voice dialog that is already open, so a link that opens one still names the group', () => {
    const slot = addSlot();
    renderNotice();
    expect(slot).toContainElement(screen.getByTestId('ce-session-worker-group-auto-join'));
    expect(slot).toContainElement(screen.getByRole('button', { name: 'Cancel auto-join' }));
    expect(screen.getByRole('status')).toHaveTextContent('Salon: Will be joined upon sign-in');
  });

  it('moves into a dialog that opens later and back to the page when it closes', async () => {
    renderNotice();
    let slot: HTMLElement;
    act(() => {
      slot = addSlot();
    });
    await waitFor(() => expect(slot).toContainElement(screen.getByTestId('ce-session-worker-group-auto-join')));
    act(() => slot.remove());
    await waitFor(() =>
      expect(screen.getByTestId('page')).toContainElement(screen.getByTestId('ce-session-worker-group-auto-join')),
    );
  });
});
