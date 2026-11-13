import { useState } from 'react';
import { Button } from 'reactstrap';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';
import { buildWorkerGroupInviteLink, groupPasswordToken } from '../../domains/worker/workerGroupSecrets';
import styles from './AdminPage.module.scss';

/** A Group Password, shown once after it is set: the Worker keeps only its signer address. */
export default function WorkerGroupPasswordReveal({
  group,
  password,
  sessionSlug,
  workerUrl,
  onDone,
}: {
  group: Pick<WorkerGroup, 'groupId' | 'label'>;
  password: string;
  sessionSlug: string;
  workerUrl: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState('');
  const link = (withPassword: boolean) =>
    buildWorkerGroupInviteLink({
      sessionSlug,
      groupId: group.groupId,
      workerUrl,
      token: withPassword ? groupPasswordToken(password) : '',
    });
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${what} copied.`);
    } catch {
      setCopied('Could not copy. Select the password and copy it.');
    }
  };
  const button = (text: string, onClick: () => void) => (
    <Button className={styles.subtleActionButton} size="sm" color="secondary" outline onClick={onClick}>
      {text}
    </Button>
  );
  return (
    <div className={styles.statusItem} data-testid="ce-admin-worker-group-password-reveal">
      <strong>Password for {group.label}. Keep a copy: it isn’t saved anywhere.</strong>
      <code>{password}</code>
      <div>
        {button('Copy password', () => void copy(password, 'Password'))}{' '}
        {button('Copy link with password', () => void copy(link(true), 'Link'))}{' '}
        {button('Copy link without password', () => void copy(link(false), 'Link'))} {button('Done', onDone)}
      </div>
      {copied ? <span role="status">{copied}</span> : null}
    </div>
  );
}
