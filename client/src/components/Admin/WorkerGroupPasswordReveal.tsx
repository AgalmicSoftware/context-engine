import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';
import { buildWorkerGroupInviteLink, groupPasswordToken } from '../../domains/worker/workerGroupSecrets';
import { copyText, selectText } from '../../utilities/ui/copyText';
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
  const passwordRef = useRef<HTMLElement>(null);
  // A link that couldn't be copied, shown selected to copy by hand: links aren't on screen otherwise.
  const [manualLink, setManualLink] = useState({ text: '', request: 0 });
  const manualLinkRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const field = manualLinkRef.current;
    if (!manualLink.request || !field) return;
    field.focus();
    field.setSelectionRange(0, field.value.length);
  }, [manualLink]);
  const copy = async (text: string, what: string) => {
    if (await copyText(text)) {
      setManualLink({ text: '', request: 0 });
      setCopied(`${what} copied.`);
      return;
    }
    const thing = what.toLowerCase();
    setCopied(`Copying isn't allowed here, so the ${thing} is selected. Copy it yourself.`);
    if (what === 'Password') {
      setManualLink({ text: '', request: 0 });
      selectText(passwordRef.current);
    } else setManualLink((current) => ({ text, request: current.request + 1 }));
  };
  const button = (text: string, onClick: () => void) => (
    <Button className={styles.subtleActionButton} size="sm" color="secondary" outline onClick={onClick}>
      {text}
    </Button>
  );
  return (
    <div className={styles.statusItem} data-testid="ce-admin-worker-group-password-reveal">
      <strong>Password for {group.label}. Keep a copy: it isn’t saved anywhere.</strong>
      <code ref={passwordRef}>{password}</code>
      <div>
        {button('Copy password', () => void copy(password, 'Password'))}{' '}
        {button('Copy link with password', () => void copy(link(true), 'Link'))}{' '}
        {button('Copy link without password', () => void copy(link(false), 'Link'))} {button('Done', onDone)}
      </div>
      {manualLink.text ? (
        <input ref={manualLinkRef} type="text" readOnly value={manualLink.text} aria-label="Link to copy" />
      ) : null}
      {copied ? <span role="status">{copied}</span> : null}
    </div>
  );
}
