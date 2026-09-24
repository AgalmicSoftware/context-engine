import { loadWorkerGroupCohort, resolveWorkerGroupFilterScope } from './workerGroupResultsAccess';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWorkerSessionToken, loadWorkerGroupOverview, type WorkerGroup } from './workerGroupPorts';
import { subscribeWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import {
  hasWorkerGroupSelection,
  normalizeWorkerGroupSelection,
  usesWorkerGroupFilters,
  type WorkerGroupCohort,
} from './workerGroupResultsFilter';

export type WorkerGroupFilterInput = {
  sessionConfig?: unknown;
  sessionSlug: string;
  account?: unknown;
  provider?: unknown;
  selection?: unknown;
  discover?: boolean;
};
const errorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';
  if (message === 'worker_group_member_directory_unavailable')
    return 'This session’s Worker needs an update before Group filters can load members.';
  if (message.includes('forbidden') || message.includes('denied'))
    return 'You do not have permission to read this Group’s members. Clear the filter or sign in with an eligible account.';
  return message && !message.startsWith('worker_')
    ? message
    : 'Group members could not be loaded. Retry or clear the Group filter.';
};
export function useWorkerGroupResultsFilter({
  sessionConfig,
  sessionSlug,
  account,
  provider,
  selection: input,
  discover = false,
}: WorkerGroupFilterInput) {
  const enabled = usesWorkerGroupFilters(sessionConfig);
  const scope = resolveWorkerGroupFilterScope(sessionConfig, sessionSlug);
  const scopeKey = scope ? JSON.stringify([scope.sessionId, scope.sessionSlug, scope.workerUrl]) : '';
  const inputKey = JSON.stringify(input ?? null);
  const viewer = String(account || '')
    .trim()
    .toLowerCase();
  const active = enabled && hasWorkerGroupSelection(input);
  const key = JSON.stringify([enabled, scopeKey, viewer, inputKey, discover]);
  const inputs = useRef({ sessionConfig, scope, input });
  inputs.current = { sessionConfig, scope, input };
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    provider: unknown;
    revision: number;
    cohort: WorkerGroupCohort;
    groups: WorkerGroup[];
  } | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled || (!active && !discover)) return undefined;
    const unsubscribe = subscribeWorkerGroupsChanged((detail) => {
      const current = inputs.current.scope;
      if (current && current.sessionSlug === detail.sessionSlug && current.sessionId === detail.sessionId) refresh();
    });
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [enabled, active, discover, refresh]);
  useEffect(() => {
    if (!enabled || (!active && !discover)) return undefined;
    let current = true;
    const { scope: target, input: selectionInput, sessionConfig: config } = inputs.current;
    const publish = (cohort: WorkerGroupCohort, groups: WorkerGroup[] = []) => {
      if (current) setSnapshot({ key, provider, revision, cohort, groups });
    };
    void (async () => {
      try {
        if (!target) throw new Error('The session’s Group service is unavailable.');
        const selection = normalizeWorkerGroupSelection(selectionInput, target);
        if (!viewer) throw new Error('Sign in to filter results by Group.');
        const token = await getWorkerSessionToken({
          sessionConfig: config,
          sessionSlug: target.sessionSlug,
          workerUrl: target.workerUrl,
          context: { account: viewer, providerLike: provider, chainId: target.chainId },
        });
        if (!current) return;
        const overview = discover ? await loadWorkerGroupOverview({ ...target, credentialToken: token }) : null;
        if (!current) return;
        const members = selection ? await loadWorkerGroupCohort(selection, token) : {};
        publish({ active, selection, members, status: 'ready', message: '' }, overview?.groups || []);
      } catch (error) {
        publish({ active, selection: null, members: {}, status: 'error', message: errorMessage(error) });
      }
    })();
    return () => {
      current = false;
    };
  }, [key, provider, revision, enabled, active, discover, viewer]);
  const value = useMemo(() => {
    if (!enabled || (!active && !discover))
      return {
        cohort: { active: false, status: 'ready', message: '', selection: null, members: {} } as WorkerGroupCohort,
        groups: [] as WorkerGroup[],
      };
    // Match during render as well as effects: a new account/filter must never see the old cohort.
    if (
      snapshot?.key === key &&
      snapshot.provider === provider &&
      (snapshot.revision === revision || snapshot.cohort.status === 'ready')
    )
      return snapshot;
    return {
      cohort: {
        active,
        status: 'loading',
        message: viewer ? 'Loading Group members…' : 'Sign in to filter results by Group.',
        selection: null,
        members: {},
      } as WorkerGroupCohort,
      groups: [] as WorkerGroup[],
    };
  }, [enabled, active, discover, key, provider, revision, snapshot, viewer]);
  return { ...value, scope, refresh, enabled };
}
