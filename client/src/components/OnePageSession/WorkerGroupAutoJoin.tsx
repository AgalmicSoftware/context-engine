import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  finishWorkerGroupAutoJoin,
  canAutoJoinWorkerGroup,
  resolveWorkerGroupAutoJoinContext,
} from '../../domains/worker/workerGroupAutoJoin';
import {
  autoJoinIntentKey,
  clearPendingAutoJoin,
  loadAutoJoinSessionConfig,
  readAutoJoinLink,
  readPendingAutoJoin,
  savePendingAutoJoin,
  type WorkerGroupAutoJoinIntent,
} from '../../domains/worker/workerGroupAutoJoinIntent';
import styles from './OnePageSession.module.scss';

export type WorkerGroupAutoJoinProps = {
  sessionConfig: unknown;
  sessionSlug: string;
  account: unknown;
  provider: unknown;
  loginComplete: unknown;
  toggleLoginModal: unknown;
};
type Props = WorkerGroupAutoJoinProps;
type Context = NonNullable<ReturnType<typeof resolveWorkerGroupAutoJoinContext>>;
type Progress = { phase: 'loading' | 'joining' | 'done' | 'error'; message: string };

const subscribeLocation = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};
const readLocation = () => `${window.location.pathname}${window.location.search}`;
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
  intent,
  onConsumed,
  ...props
}: Props & { context: Context; groupId: string; intent: WorkerGroupAutoJoinIntent; onConsumed: () => void }) {
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
    if (!ready || finishedRef.current) return undefined;
    let active = true;
    const stop = () => {
      active = false;
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
      onConsumed();
      clearPendingAutoJoin(intent);
      finishWorkerGroupAutoJoin(sessionSlug, groupId, sessionId);
    };
    setProgress({ phase: 'loading', message: 'Preparing to join group…' });
    void (async () => {
      try {
        const { getWorkerSessionToken, joinWorkerGroup, loadWorkerGroupOverview } =
          await import('../../domains/worker/workerGroupPorts');
        if (!active) return;
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
        setProgress({ phase: 'joining', message: `Joining ${group.label}…` });
        await joinWorkerGroup({ ...request, groupId });
        complete(`Joined ${group.label}.`);
      } catch (error) {
        fail(error);
      }
    })();
    // Account, session, provider changes and unmount invalidate pending auth,
    // and reads before they can submit a join for the previous viewer.
    return stop;
  }, [account, ready, props.provider, sessionId, sessionSlug, workerUrl, chainId, groupId, retry, intent, onConsumed]);

  const cancel = () => {
    cancelRef.current();
    finishedRef.current = true;
    onConsumed();
    clearPendingAutoJoin(intent);
    finishWorkerGroupAutoJoin(sessionSlug, groupId);
    setProgress({ phase: 'done', message: 'Auto-join cancelled.' });
  };
  const done = progress.phase === 'done';
  if (done && completedAccountRef.current && completedAccountRef.current !== account) return null;
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
  const location = useSyncExternalStore(subscribeLocation, readLocation, () => '');
  const currentContext = resolveWorkerGroupAutoJoinContext(props.sessionConfig, props.sessionSlug);
  const contextKey = currentContext
    ? `${currentContext.sessionId}:${currentContext.sessionSlug}:${currentContext.workerUrl}`
    : '';
  const configRef = useRef(props.sessionConfig);
  configRef.current = props.sessionConfig;
  const [intent, setIntent] = useState(readPendingAutoJoin);
  const intentKey = intent ? autoJoinIntentKey(intent) : '';
  const consumedKey = useRef('');
  const onConsumed = useCallback(() => {
    consumedKey.current = intentKey;
  }, [intentKey]);
  const [resolved, setResolved] = useState<{ key: string; config: unknown; context: Context } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const incoming = readAutoJoinLink(
      location,
      resolveWorkerGroupAutoJoinContext(configRef.current, props.sessionSlug),
    );
    if (!incoming) return;
    setIntent((previous) => {
      if (
        previous &&
        consumedKey.current !== autoJoinIntentKey(previous) &&
        previous.groupId === incoming.groupId &&
        previous.sessionSlug === incoming.sessionSlug &&
        previous.workerOrigin === incoming.workerOrigin
      )
        return previous;
      savePendingAutoJoin(incoming);
      return incoming;
    });
  }, [location, contextKey, props.sessionSlug]);

  useEffect(() => {
    if (!intent) return undefined;
    const controller = new AbortController();
    setError('');
    const accept = (config: unknown) => {
      const context = resolveWorkerGroupAutoJoinContext(config, intent.sessionSlug);
      if (
        !context ||
        new URL(context.workerUrl).origin !== intent.workerOrigin ||
        (intent.sessionId && context.sessionId.toLowerCase() !== intent.sessionId.toLowerCase())
      )
        throw new Error('The session identity has changed. Ask the host for a new invitation.');
      if (!controller.signal.aborted) {
        // Pin the canonical identity before login; browsing another session must
        // never redirect a remembered invitation to that session's Worker.
        savePendingAutoJoin({ ...intent, sessionId: context.sessionId });
        setResolved({ key: intentKey, config, context });
      }
    };
    const context = resolveWorkerGroupAutoJoinContext(configRef.current, intent.sessionSlug);
    if (context && new URL(context.workerUrl).origin === intent.workerOrigin) {
      try {
        accept(configRef.current);
      } catch (failure) {
        setError(autoJoinErrorMessage(failure));
      }
    } else {
      void loadAutoJoinSessionConfig(intent, controller.signal)
        .then(accept)
        .catch((failure) => {
          if (!controller.signal.aborted) setError(autoJoinErrorMessage(failure));
        });
    }
    return () => controller.abort();
    // An invitation owns its config independently of the currently viewed route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentKey, retry]);

  if (!intent) return null;
  if (resolved?.key === intentKey)
    return (
      <AutoJoinIntent
        key={intentKey}
        {...props}
        sessionConfig={resolved.config}
        context={resolved.context}
        groupId={intent.groupId}
        intent={intent}
        onConsumed={onConsumed}
      />
    );
  return (
    <div
      className={`${styles.workerGroupNotice} ${styles.workerGroupAutoJoinNotice}`}
      data-testid="ce-session-worker-group-auto-join"
    >
      <span role={error ? 'alert' : 'status'}>{error || 'Preparing your group invitation…'}</span>
      {error ? (
        <button type="button" className={styles.telegramSecondaryButton} onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      ) : null}
      <button
        type="button"
        className={styles.telegramSecondaryButton}
        onClick={() => {
          clearPendingAutoJoin(intent);
          finishWorkerGroupAutoJoin(intent.sessionSlug, intent.groupId);
          setIntent(null);
        }}
      >
        Cancel auto-join
      </button>
    </div>
  );
}
