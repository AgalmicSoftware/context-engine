import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AUTO_JOIN_CLAIM_ATTRIBUTE, VOICE_DIALOG_NOTICE_SLOT_ID } from '../../utilities/ui/voiceDialogNoticeSlot';
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
      <WorkerGroupAutoJoinNotice groupId="salon" groupLabel="Salon" message="Will be joined upon sign-in">
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

  it('stands aside while the open interview’s Groups area lists its group, and only that group', async () => {
    const addClaim = (groupId: string) => {
      const claim = document.createElement('span');
      claim.setAttribute(AUTO_JOIN_CLAIM_ATTRIBUTE, groupId);
      document.body.append(claim);
      return claim;
    };
    const other = addClaim('another-group');
    addSlot();
    renderNotice();
    expect(screen.getByTestId('ce-session-worker-group-auto-join')).toBeInTheDocument();
    let claim: HTMLElement;
    act(() => {
      claim = addClaim('salon');
    });
    await waitFor(() => expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument());
    act(() => claim.remove());
    await waitFor(() => expect(screen.getByTestId('ce-session-worker-group-auto-join')).toBeInTheDocument());
    other.remove();
  });

  // A closed interview dialog stays mounted, Groups area and all, but drops its slot.
  it('comes back on the page once the interview dialog closes, though its Groups area is still mounted', async () => {
    const claim = document.createElement('span');
    claim.setAttribute(AUTO_JOIN_CLAIM_ATTRIBUTE, 'salon');
    document.body.append(claim);
    const slot = addSlot();
    renderNotice();
    expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument();
    act(() => slot.remove());
    await waitFor(() =>
      expect(screen.getByTestId('page')).toContainElement(screen.getByTestId('ce-session-worker-group-auto-join')),
    );
    expect(screen.getByRole('button', { name: 'Cancel auto-join' })).toBeInTheDocument();
    claim.remove();
  });
});
