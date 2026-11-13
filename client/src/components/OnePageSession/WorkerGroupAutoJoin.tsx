import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { finishWorkerGroupAutoJoin, canAutoJoinWorkerGroup } from '../../domains/worker/workerGroupAutoJoin';
import { resolveWorkerGroupAutoJoinContext } from '../../domains/worker/workerGroupAutoJoinContext';
import {
  autoJoinIntentKey,
  clearPendingAutoJoin,
  loadAutoJoinSessionConfig,
  readAutoJoinLink,
  readPendingAutoJoin,
  removeGroupInviteFromAddress,
  savePendingAutoJoin,
  type WorkerGroupAutoJoinIntent,
} from '../../domains/worker/workerGroupAutoJoinIntent';
import {
  clearWorkerGroupAutoJoinCancellation,
  isWorkerGroupAutoJoinCancelled,
  rememberWorkerGroupAutoJoinCancellation,
} from '../../domains/worker/workerGroupAutoJoinPreference';
import { BUSY_WORKER_GROUP_JOIN_MESSAGE, isBusyWorkerGroupError } from '../../domains/worker/workerGroupBusy';
import WorkerGroupAutoJoinNotice from './WorkerGroupAutoJoinNotice';
import WorkerGroupCodeField from './WorkerGroupCodeField';
import styles from './WorkerGroupAutoJoinNotice.module.scss';

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
// 'code': signed in, and the group needs a password or claim code this tab doesn't hold.
type Progress = { phase: 'loading' | 'joining' | 'done' | 'cancelled' | 'error' | 'code'; message: string };
// What public discovery said of the group before sign-in: an unlisted group isn't there.
type PublicGroup = 'unknown' | 'open' | 'secret' | 'absent';

export const REFUSED_JOIN_MESSAGE = 'That link, invite or password didn’t work. Ask whoever invited you for a new one.';
const NEEDS_CODE_MESSAGE = 'Enter the group password or claim code from your invitation.';

const subscribeLocation = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};
const readLocation = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const autoJoinErrorMessage = (error: unknown): string => {
  if (isBusyWorkerGroupError(error)) return BUSY_WORKER_GROUP_JOIN_MESSAGE;
  const reason = error instanceof Error ? error.message : '';
  if (reason === 'worker_group_member_cap_exceeded' || reason === 'worker_group_session_cap_exceeded')
    return 'This group has reached its member limit.';
  if (reason === 'worker_group_join_ended') return 'The joining deadline for this group has passed.';
  if (reason === 'worker_group_join_refused') return REFUSED_JOIN_MESSAGE;
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
  const [groupLabel, setGroupLabel] = useState(groupId);
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState<Progress>({ phase: 'loading', message: 'Preparing to join group…' });
  // The link's invite, or one the person typed; it stays in this tab.
  const [token, setToken] = useState(intent.token || '');
  const [publicGroup, setPublicGroup] = useState<PublicGroup>('unknown');

  useEffect(() => {
    if (ready || finishedRef.current) return undefined;
    let active = true;
    void import('../../domains/worker/workerGroupPorts')
      .then(async ({ loadPublicWorkerGroups }) => {
        if (!active) return;
        const groups = await loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug, joinGroup: groupId });
        const group = groups.find((candidate) => candidate.groupId === groupId);
        if (!active) return;
        if (group) setGroupLabel(group.label);
        // An unlisted group keeps its name until its member signs in.
        else setGroupLabel('Group invitation');
        setPublicGroup(!group ? 'absent' : group.joinMode === 'open' ? 'open' : 'secret');
      })
      .catch(() => {
        // An unavailable public label must not block sign-in. Use the group ID
        // until authenticated discovery can provide its validated name.
      });
    return () => {
      active = false;
    };
  }, [ready, workerUrl, sessionId, sessionSlug, groupId]);

  // A cancellation holds for this browser: signing in, switching accounts or
  // following the invitation again must not turn it into a join.
  const consumeCancellation = useCallback(() => {
    if (!isWorkerGroupAutoJoinCancelled({ workerUrl, sessionSlug, sessionId, groupId })) return false;
    finishedRef.current = true;
    onConsumed();
    clearPendingAutoJoin(intent);
    finishWorkerGroupAutoJoin(sessionSlug, groupId);
    setProgress({ phase: 'cancelled', message: 'Auto-join cancelled. Join whenever you choose.' });
    return true;
  }, [groupId, intent, onConsumed, sessionId, sessionSlug, workerUrl]);

  useEffect(() => {
    if (!finishedRef.current && consumeCancellation()) return undefined;
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
          setGroupLabel(membership.group.label);
          complete('');
          return;
        }
        // An unlisted group shows only to its members, so with an invite it is joined without being listed.
        const group = overview.groups.find((candidate) => candidate.groupId === groupId);
        if (group) setGroupLabel(group.label);
        if (group?.joinMode === 'open') {
          if (!canAutoJoinWorkerGroup(group)) throw new Error('This group is not open for joining.');
          if (consumeCancellation()) return;
          setProgress({ phase: 'joining', message: `Joining ${group.label}…` });
          await joinWorkerGroup({ ...request, groupId });
          complete(`Joined ${group.label}.`);
          return;
        }
        if (group?.joinMode === 'admin_add') throw new Error('This group is not open for joining.');
        if (!token) {
          setProgress({ phase: 'code', message: NEEDS_CODE_MESSAGE });
          return;
        }
        if (consumeCancellation()) return;
        setProgress({ phase: 'joining', message: group ? `Joining ${group.label}…` : 'Joining the group…' });
        const { buildWorkerGroupJoinCredentials } = await import('../../domains/worker/workerGroupSecrets');
        const credentials = await buildWorkerGroupJoinCredentials({ token, sessionId, groupId, address: account });
        if (!active) return;
        if (!credentials) throw new Error('worker_group_join_refused');
        const joined = await joinWorkerGroup({ ...request, groupId, ...credentials });
        const label = String((joined.group as { label?: unknown } | undefined)?.label || group?.label || '');
        if (label) setGroupLabel(label);
        complete(label ? `Joined ${label}.` : 'Joined the group.');
      } catch (error) {
        fail(error);
      }
    })();
    // Account, session, provider changes and unmount invalidate pending auth,
    // and reads before they can submit a join for the previous viewer.
    return stop;
  }, [
    account,
    ready,
    props.provider,
    sessionId,
    sessionSlug,
    workerUrl,
    chainId,
    groupId,
    retry,
    intent,
    onConsumed,
    consumeCancellation,
    token,
  ]);

  useEffect(() => {
    if (progress.phase !== 'done' || !progress.message) return;
    const timer = setTimeout(() => setProgress({ phase: 'done', message: '' }), 10_000);
    return () => clearTimeout(timer);
  }, [progress]);

  const cancel = () => {
    cancelRef.current();
    finishedRef.current = true;
    onConsumed();
    clearPendingAutoJoin(intent);
    finishWorkerGroupAutoJoin(sessionSlug, groupId);
    const saved = rememberWorkerGroupAutoJoinCancellation({ workerUrl, sessionSlug, sessionId, groupId });
    setProgress({
      phase: 'cancelled',
      message: saved ? 'Auto-join cancelled.' : 'Auto-join cancelled for this visit. Browser storage is unavailable.',
    });
  };
  const cancelled = progress.phase === 'cancelled';
  const done = progress.phase === 'done' || cancelled;
  // A typed code is kept like a link's, so a sign-in that reloads the page still has it.
  const submitCode = (code: string) => {
    setToken(code);
    savePendingAutoJoin({ ...intent, sessionId, token: code });
    if (ready) {
      finishedRef.current = false;
      setProgress({ phase: 'loading', message: 'Preparing to join group…' });
      setRetry((value) => value + 1);
    }
  };
  const refused = progress.phase === 'error' && progress.message === REFUSED_JOIN_MESSAGE;
  const asksCode =
    (ready && (progress.phase === 'code' || refused)) ||
    (!ready && !token && (publicGroup === 'secret' || publicGroup === 'absent'));
  const joinExplicitly = () => {
    clearWorkerGroupAutoJoinCancellation({ workerUrl, sessionSlug, sessionId, groupId });
    finishedRef.current = false;
    savePendingAutoJoin({ ...intent, sessionId });
    setProgress({ phase: 'loading', message: 'Preparing to join group…' });
    setRetry((value) => value + 1);
  };
  if (done && !progress.message) return null;
  if (done && completedAccountRef.current && completedAccountRef.current !== account) return null;
  return (
    <WorkerGroupAutoJoinNotice
      // Only a join waiting for sign-in moves into the interview's Groups section; joining and its outcome show here.
      groupId={!ready && !done ? groupId : undefined}
      groupLabel={!ready && !done ? groupLabel : undefined}
      message={!ready && !done ? (asksCode ? NEEDS_CODE_MESSAGE : 'Will be joined upon sign-in') : progress.message}
      isError={progress.phase === 'error'}
    >
      {asksCode && !done ? (
        <WorkerGroupCodeField
          groupLabel={groupLabel}
          formClassName={styles.codeForm}
          inputClassName={styles.codeInput}
          buttonClassName={styles.secondaryButton}
          onSubmit={submitCode}
        />
      ) : null}
      {cancelled ? (
        <button type="button" className={styles.secondaryButton} onClick={joinExplicitly}>
          Join {groupLabel}
        </button>
      ) : null}
      {done ? (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setProgress({ phase: 'done', message: '' })}
          aria-label="Dismiss group notice"
        >
          Dismiss
        </button>
      ) : null}
      {ready && progress.phase === 'error' && !refused ? (
        <button type="button" className={styles.secondaryButton} onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      ) : null}
      {!done && progress.phase !== 'joining' ? (
        <button type="button" className={styles.secondaryButton} onClick={cancel} aria-label="Cancel auto-join">
          Cancel
        </button>
      ) : null}
    </WorkerGroupAutoJoinNotice>
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
    removeGroupInviteFromAddress();
    if (!incoming) return;
    setIntent((previous) => {
      if (
        previous &&
        consumedKey.current !== autoJoinIntentKey(previous) &&
        previous.groupId === incoming.groupId &&
        previous.sessionSlug === incoming.sessionSlug &&
        previous.workerOrigin === incoming.workerOrigin &&
        (!incoming.token || incoming.token === previous.token)
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
    <WorkerGroupAutoJoinNotice
      groupId={intent.groupId}
      groupLabel={intent.groupId}
      message={error || 'Preparing your group invitation…'}
      isError={!!error}
    >
      {error ? (
        <button type="button" className={styles.secondaryButton} onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      ) : null}
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => {
          rememberWorkerGroupAutoJoinCancellation({
            workerUrl: intent.workerOrigin,
            sessionSlug: intent.sessionSlug,
            sessionId: intent.sessionId,
            groupId: intent.groupId,
          });
          clearPendingAutoJoin(intent);
          finishWorkerGroupAutoJoin(intent.sessionSlug, intent.groupId);
          setIntent(null);
        }}
        aria-label="Cancel auto-join"
      >
        Cancel
      </button>
    </WorkerGroupAutoJoinNotice>
  );
}
