import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Label } from 'reactstrap';
import {
  addWorkerGroupInvites,
  listWorkerGroupInvites,
  revokeWorkerGroupInvites,
  type PostSignedWorkerGroupRequest,
  type WorkerGroup,
  type WorkerGroupInvite,
  type WorkerGroupInviteCounts,
} from '../../domains/worker/workerGroupPorts';
import {
  buildOneUseInvitesCsv,
  buildWorkerGroupInviteLink,
  makeOneUseInvites,
  oneUseInviteToken,
  saveWorkerGroupPassword,
} from '../../domains/worker/workerGroupSecrets';
import { isWorkerGroupPasswordLongEnough, WORKER_GROUP_INVITE_BATCH_MAX } from '../../../../shared/workerGroupJoin.mjs';
import WorkerGroupPasswordReveal from './WorkerGroupPasswordReveal';
import { generateCreateSbtGroupPassphrase } from '../SBTs/createSbtGroupPasswordHelpers';
import styles from './AdminPage.module.scss';

type Props = {
  group: WorkerGroup;
  sessionId: string;
  sessionSlug: string;
  workerUrl: string;
  postSignedRequest: PostSignedWorkerGroupRequest;
  onGroupChanged: (group: Partial<WorkerGroup> & { groupId: string }) => void;
};

const STATE_LABELS: Record<WorkerGroupInvite['state'], string> = { unused: 'Unused', used: 'Used', revoked: 'Revoked' };
const when = (value?: string) => (value ? new Date(value).toLocaleString() : '');

const download = (content: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

// One-use links are shown once, as on chain: the Worker keeps only their hashes.
function OneUseInvites({ group, sessionId, sessionSlug, workerUrl, postSignedRequest, onGroupChanged }: Props) {
  const [count, setCount] = useState('10');
  const [expiresAt, setExpiresAt] = useState('');
  const [fresh, setFresh] = useState<{ secret: string; link: string }[]>([]);
  const [invites, setInvites] = useState<WorkerGroupInvite[]>([]);
  const [cursor, setCursor] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const request = { groupId: group.groupId, sessionId, sessionSlug, postSignedRequest };
  const noteCounts = (invitesCounts: WorkerGroupInviteCounts) =>
    onGroupChanged({ groupId: group.groupId, invites: invitesCounts });

  const load = useCallback(
    async (after = '') => {
      setBusy(true);
      try {
        const page = await listWorkerGroupInvites({
          groupId: group.groupId,
          sessionId,
          sessionSlug,
          postSignedRequest,
          cursor: after,
        });
        setInvites((current) => (after ? [...current, ...page.invites] : page.invites));
        setCursor(page.cursor);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not load the invites.');
      } finally {
        setBusy(false);
      }
    },
    [group.groupId, postSignedRequest, sessionId, sessionSlug],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const total = Number(count);
  const countInvalid = !Number.isSafeInteger(total) || total < 1 || total > WORKER_GROUP_INVITE_BATCH_MAX;
  const generate = async () => {
    setBusy(true);
    setStatus('');
    try {
      const made = await makeOneUseInvites(total);
      const saved = await addWorkerGroupInvites({
        ...request,
        hashes: made.map(({ hash }) => hash),
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      });
      setFresh(
        made.map(({ secret }) => ({
          secret,
          link: buildWorkerGroupInviteLink({
            sessionSlug,
            groupId: group.groupId,
            workerUrl,
            token: oneUseInviteToken(secret),
          }),
        })),
      );
      noteCounts(saved.counts);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not make the invites.');
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (hashes: string[] | 'allUnused') => {
    if (
      hashes === 'allUnused' &&
      !window.confirm('Revoke every unused link? People who haven’t joined can’t use them.')
    )
      return;
    setBusy(true);
    setStatus('');
    try {
      const result = await revokeWorkerGroupInvites({ ...request, hashes });
      noteCounts(result.counts);
      setStatus(result.revoked === 1 ? '1 link revoked.' : `${result.revoked} links revoked.`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not revoke.');
    } finally {
      setBusy(false);
    }
  };
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(fresh.map(({ link }) => link).join('\n'));
      setStatus('Links copied.');
    } catch {
      setStatus('Could not copy the links. Use Export Passwords.');
    }
  };

  return (
    <>
      <div className={styles.formRow}>
        <Label for={`invites-count-${group.groupId}`}>How many</Label>
        <Input
          id={`invites-count-${group.groupId}`}
          type="number"
          min="1"
          max={WORKER_GROUP_INVITE_BATCH_MAX}
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />
        <Label for={`invites-expiry-${group.groupId}`}>Expires (optional)</Label>
        <Input
          id={`invites-expiry-${group.groupId}`}
          type="datetime-local"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
        <Button color="primary" disabled={busy || countInvalid} onClick={() => void generate()}>
          Generate Additional Password Invites
        </Button>
      </div>
      {fresh.length ? (
        <div className={styles.statusItem} data-testid="ce-admin-worker-group-fresh-invites">
          <strong>Copy or export these now: they won’t be shown again.</strong>
          <div>
            <Button
              className={styles.subtleActionButton}
              size="sm"
              color="secondary"
              outline
              onClick={() =>
                download(buildOneUseInvitesCsv(fresh), `${group.groupId}_passwords_${new Date().toISOString()}.csv`)
              }
            >
              Export Passwords
            </Button>{' '}
            <Button
              className={styles.subtleActionButton}
              size="sm"
              color="secondary"
              outline
              onClick={() => void copyAll()}
            >
              Copy all
            </Button>{' '}
            <Button
              className={styles.subtleActionButton}
              size="sm"
              color="secondary"
              outline
              onClick={() => setFresh([])}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}
      <div className={styles.panelSubtitle}>
        {group.invites
          ? `${group.invites.unused} unused, ${group.invites.used} used, ${group.invites.revoked} revoked`
          : null}
        {group.invites?.unused ? (
          <>
            {' '}
            <Button
              className={styles.dangerActionButton}
              size="sm"
              color="danger"
              outline
              disabled={busy}
              onClick={() => void revoke('allUnused')}
            >
              Revoke all unused
            </Button>
          </>
        ) : null}
      </div>
      {invites.map((invite) => (
        <div key={invite.hash} className={styles.statusItem}>
          <span>
            <code>{invite.hash.slice(0, 8)}</code> {STATE_LABELS[invite.state]}
            {invite.usedAt ? `, ${when(invite.usedAt)}` : ''}
            {invite.state === 'unused' && invite.expiresAt ? `, expires ${when(invite.expiresAt)}` : ''}
          </span>
          {invite.state === 'unused' ? (
            <Button
              className={styles.dangerActionButton}
              size="sm"
              color="danger"
              outline
              disabled={busy}
              aria-label={`Revoke link ${invite.hash.slice(0, 8)}`}
              onClick={() => void revoke([invite.hash])}
            >
              Revoke
            </Button>
          ) : null}
        </div>
      ))}
      {cursor ? (
        <Button
          className={styles.subtleActionButton}
          size="sm"
          color="secondary"
          outline
          disabled={busy}
          onClick={() => void load(cursor)}
        >
          Load more
        </Button>
      ) : null}
      {status ? (
        <div className={styles.statusNote} role="status">
          {status}
        </div>
      ) : null}
    </>
  );
}

function GroupPassword({ group, sessionId, sessionSlug, workerUrl, postSignedRequest, onGroupChanged }: Props) {
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const save = async () => {
    if (
      group.passwordSet &&
      !window.confirm('Replace the password? The old one, and every link that carries it, stops working. Members stay.')
    )
      return;
    setBusy(true);
    setStatus('');
    try {
      const saved = await saveWorkerGroupPassword({
        password,
        groupId: group.groupId,
        sessionId,
        sessionSlug,
        postSignedRequest,
      });
      onGroupChanged(saved);
      setRevealed(password);
      setPassword('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not set the password.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div>{group.passwordSet ? 'A password is set.' : 'No password yet: no one can join until one is set.'}</div>
      <div className={styles.formRow}>
        <Input
          type="text"
          value={password}
          placeholder="Enter the group password"
          aria-label="New group password"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button
          className={styles.subtleActionButton}
          color="secondary"
          outline
          onClick={() => setPassword(generateCreateSbtGroupPassphrase())}
        >
          Generate new
        </Button>
        <Button
          color="primary"
          disabled={busy || !isWorkerGroupPasswordLongEnough(password)}
          onClick={() => void save()}
        >
          {group.passwordSet ? 'New password' : 'Set password'}
        </Button>
      </div>
      {revealed ? (
        <WorkerGroupPasswordReveal
          group={group}
          password={revealed}
          sessionSlug={sessionSlug}
          workerUrl={workerUrl}
          onDone={() => setRevealed('')}
        />
      ) : null}
      {status ? (
        <div className={styles.statusNote} role="status">
          {status}
        </div>
      ) : null}
    </>
  );
}

/** A secret group's invites: One-use URLs' links, or the Group Password. */
export default function WorkerGroupInvitesPanel(props: Props) {
  const { group } = props;
  return (
    <section className={styles.statusItem} aria-label={`Invites for ${group.label}`}>
      <strong>Invites: {group.label}</strong>
      {group.guessLimited ? <div role="alert">Too many wrong passwords in the last hour.</div> : null}
      {group.joinMode === 'one_use' ? <OneUseInvites {...props} /> : <GroupPassword {...props} />}
    </section>
  );
}
