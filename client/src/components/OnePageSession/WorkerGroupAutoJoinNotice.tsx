import React from 'react';
import styles from './WorkerGroupAutoJoinNotice.module.scss';

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
  return (
    <section className={styles.notice} aria-label="Group auto-join" data-testid="ce-session-worker-group-auto-join">
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
}
