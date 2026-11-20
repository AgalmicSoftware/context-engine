import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { VOICE_DIALOG_NOTICE_SLOT_ID } from '../../utilities/ui/voiceDialogNoticeSlot';
import styles from './WorkerGroupAutoJoinNotice.module.scss';

// A link can open the voice dialog over the page. The notice moves into it, so someone who signs in from the
// dialog still sees which group they'll join, and can cancel.
const subscribeToDialogSlot = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
};
const readDialogSlot = () => document.getElementById(VOICE_DIALOG_NOTICE_SLOT_ID);

export default function WorkerGroupAutoJoinNotice({
  groupLabel,
  message,
  isError = false,
  children,
}: {
  groupLabel?: string;
  message: string;
  isError?: boolean;
  children?: React.ReactNode;
}) {
  const dialogSlot = useSyncExternalStore(subscribeToDialogSlot, readDialogSlot);
  const notice = (
    <section
      className={dialogSlot ? `${styles.notice} ${styles.noticeInDialog}` : styles.notice}
      aria-label="Group auto-join"
      data-testid="ce-session-worker-group-auto-join"
    >
      <p className={styles.message} role={isError ? 'alert' : 'status'}>
        {groupLabel ? (
          <>
            <strong>{groupLabel}:</strong>{' '}
          </>
        ) : null}
        {message}
      </p>
      {React.Children.toArray(children).length ? <div className={styles.actions}>{children}</div> : null}
    </section>
  );
  return dialogSlot ? createPortal(notice, dialogSlot) : notice;
}
