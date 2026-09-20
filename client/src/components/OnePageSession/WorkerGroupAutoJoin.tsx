import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  finishWorkerGroupAutoJoin,
  canAutoJoinWorkerGroup,
  readWorkerGroupAutoJoinId,
  resolveWorkerGroupAutoJoinContext,
} from '../../domains/worker/workerGroupAutoJoin';
import { getWorkerSessionToken, joinWorkerGroup, loadWorkerGroupOverview } from '../../domains/worker/workerGroupPorts';
import styles from './OnePageSession.module.scss';

type Props = {
  sessionConfig: unknown;
  sessionSlug: string;
  account: unknown;
  provider: unknown;
  loginComplete: unknown;
  toggleLoginModal: unknown;
};
type Context = NonNullable<ReturnType<typeof resolveWorkerGroupAutoJoinContext>>;
type Progress = { phase: 'loading' | 'countdown' | 'joining' | 'done' | 'error'; message: string };

const subscribeLocation = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};
const readSearch = () => window.location.search;
const autoJoinErrorMessage = (error: unknown): string => {
  const reason = error instanceof Error ? error.message : '';
  if (reason === 'worker_group_member_cap_exceeded' || reason === 'worker_group_session_cap_exceeded')
    return 'This group has reached its member limit.';
  if (reason === 'worker_group_join_ended') return 'The joining deadline for this group has passed.';
  if (reason === 'worker_group_join_denied') return 'This group is not open for joining.';
  if (reason === 'worker_group_not_found') return 'This group is unavailable in this session.';
  return reason.startsWith('worker_group_') || !reason
    ? 'Could not join this group. Please retry or contact the session host.'
    : reason;
};

function AutoJoinIntent({
  context,
  groupId,
  linkActive,
  ...props
}: Props & { context: Context; groupId: string; linkActive: boolean }) {
  const { sessionId, sessionSlug, workerUrl, chainId } = context;
  const account = String(props.account || '').trim();
  const ready = !!account && !!props.loginComplete;
  const configRef = useRef(props.sessionConfig);
  configRef.current = props.sessionConfig;
  const finishedRef = useRef(false);
  const completedAccountRef = useRef<string>();
  const cancelRef = useRef(() => {});
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState<Progress>({ phase: 'loading', message: 'Preparing to join group…' });

  useEffect(() => {
    if (!ready || !linkActive || finishedRef.current) return undefined;
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      active = false;
      clearInterval(timer);
    };
    cancelRef.current = stop;
    const fail = (error: unknown) => {
      if (active) setProgress({ phase: 'error', message: autoJoinErrorMessage(error) });
    };
    const complete = (message: string) => {
      if (!active) return;
      finishedRef.current = true;
      completedAccountRef.current = account;
      setProgress({ phase: 'done', message });
      finishWorkerGroupAutoJoin(sessionSlug, groupId, sessionId);
    };
    setProgress({ phase: 'loading', message: 'Preparing to join group…' });
    void (async () => {
      try {
        const credentialToken = await getWorkerSessionToken({
          sessionConfig: configRef.current,
          sessionSlug,
          workerUrl,
          context: { account, providerLike: props.provider, chainId },
        });
        if (!active) return;
        const request = { workerUrl, credentialToken, sessionId, sessionSlug };
        const overview = await loadWorkerGroupOverview(request);
        if (!active) return;
        const membership = overview.memberships.find(({ group }) => group.groupId === groupId);
        if (membership) {
          complete(`You’re already in ${membership.group.label}.`);
          return;
        }
        const group = overview.groups.find((candidate) => candidate.groupId === groupId);
        if (!group) throw new Error('This group is unavailable in this session.');
        if (!canAutoJoinWorkerGroup(group)) throw new Error('This group is not open for joining.');
        let remaining = 5;
        setProgress({ phase: 'countdown', message: `Joining ${group.label} in ${remaining}…` });
        timer = setInterval(() => {
          remaining -= 1;
          if (!active) return;
          if (remaining > 0) {
            setProgress({ phase: 'countdown', message: `Joining ${group.label} in ${remaining}…` });
            return;
          }
          clearInterval(timer);
          setProgress({ phase: 'joining', message: `Joining ${group.label}…` });
          void joinWorkerGroup({ ...request, groupId })
            .then(() => complete(`Joined ${group.label}.`))
            .catch(fail);
        }, 1000);
      } catch (error) {
        fail(error);
      }
    })();
    // Account, session, provider changes and unmount invalidate pending auth,
    // reads and countdowns before they can submit a join for the previous viewer.
    return stop;
  }, [account, ready, linkActive, props.provider, sessionId, sessionSlug, workerUrl, chainId, groupId, retry]);

  const cancel = () => {
    cancelRef.current();
    finishedRef.current = true;
    finishWorkerGroupAutoJoin(sessionSlug, groupId);
    setProgress({ phase: 'done', message: 'Auto-join cancelled.' });
  };
  const done = progress.phase === 'done';
  if ((!linkActive && !done) || (done && completedAccountRef.current && completedAccountRef.current !== account))
    return null;
  return (
    <div
      className={`${styles.workerGroupNotice} ${styles.workerGroupAutoJoinNotice}`}
      data-testid="ce-session-worker-group-auto-join"
    >
      <span role={progress.phase === 'error' ? 'alert' : 'status'}>
        {!ready && !done ? 'Sign in to join this group automatically.' : progress.message}
      </span>
      {!ready && !done ? (
        <button
          type="button"
          className={styles.telegramPrimaryButton}
          onClick={() => {
            if (typeof props.toggleLoginModal === 'function') props.toggleLoginModal(true);
          }}
        >
          Sign in
        </button>
      ) : null}
      {ready && progress.phase === 'error' ? (
        <button type="button" className={styles.telegramSecondaryButton} onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      ) : null}
      {!done && progress.phase !== 'joining' ? (
        <button type="button" className={styles.telegramSecondaryButton} onClick={cancel}>
          Cancel auto-join
        </button>
      ) : null}
    </div>
  );
}

export default function WorkerGroupAutoJoin(props: Props) {
  const search = useSyncExternalStore(subscribeLocation, readSearch, () => '');
  const incomingGroupId = readWorkerGroupAutoJoinId(search);
  const context = resolveWorkerGroupAutoJoinContext(props.sessionConfig, props.sessionSlug);
  const scope = context ? `${context.sessionId}:${context.sessionSlug}:${context.workerUrl}` : '';
  const [intent, setIntent] = useState({ scope, groupId: incomingGroupId });
  // Keep the intent through login and URL cleanup, but never carry it to a
  // different session/Worker or ignore a newly opened invitation.
  if (intent.scope !== scope || (incomingGroupId && incomingGroupId !== intent.groupId)) {
    setIntent({ scope, groupId: incomingGroupId });
    return null;
  }
  if (!context || !intent.groupId) return null;
  return (
    <AutoJoinIntent
      key={`${scope}:${intent.groupId}`}
      {...props}
      context={context}
      groupId={intent.groupId}
      linkActive={incomingGroupId === intent.groupId}
    />
  );
}
