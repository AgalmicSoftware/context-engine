/** @file useSessionContextSources.ts: the context sources a reader may see, and their text for the AI. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { participantsMayAddContext } from '@ce-shared/sessionContextSources.mjs';
import { buildSessionContextPrompt } from '@ce-shared/sessionContextText.mjs';
import { getUsableSessionWorkerUrl } from '../session/sessionWorkerAvailability';
import { resolveWorkerCanonicalSessionIdHex } from '../session/sessionWorkerDiscovery';
import { isConfiguredAdmin } from '../storage/storageClient';
import { requiresLitForSessionStorage, usesCloudflareSessionStorage } from '../storage/sessionStorageConfig';
import { hasCachedWorkerSessionToken, subscribeWorkerSessionToken } from '../worker/workerAuth.js';
import { subscribeWorkerGroupsChanged } from '../worker/workerGroupChangeEvents';
import {
  listContextSources,
  loadContextSourcesForAi,
  workerAcceptsParticipantContext,
  type ContextSource,
} from './contextSources';

/** Context sources need Worker storage the Worker can read: not Arweave, not Lit-encrypted. */
export const supportsContextSources = (sessionConfig: unknown): boolean =>
  usesCloudflareSessionStorage(sessionConfig) && !requiresLitForSessionStorage(sessionConfig);

type Input = { sessionSlug: string; sessionConfig: unknown; account?: unknown; enabled?: boolean };
type ListInput = Input & { offersAdding?: boolean };

export type SessionContextSourcesState = ReturnType<typeof useSessionContextSources>;

const NO_SOURCES: ContextSource[] = [];

/** Whose sources these are: another session, reader, role or Worker never sees them. */
const contextSourcesIdentity = (input: Input, isAdmin: boolean): string =>
  JSON.stringify([
    input.sessionSlug,
    String(input.account || '').toLowerCase(),
    isAdmin,
    getUsableSessionWorkerUrl({ slug: input.sessionSlug, sessionConfig: input.sessionConfig }),
    resolveWorkerCanonicalSessionIdHex(input.sessionConfig),
  ]);

export function useSessionContextSources({
  sessionSlug,
  sessionConfig,
  account = '',
  enabled = true,
  offersAdding = true,
}: ListInput) {
  const supported = supportsContextSources(sessionConfig);
  const isAdmin = isConfiguredAdmin(sessionConfig, { account });
  const identity = contextSourcesIdentity({ sessionSlug, sessionConfig, account }, isAdmin);
  const configRef = useRef(sessionConfig);
  configRef.current = sessionConfig;
  const [revision, setRevision] = useState(0);
  // Only a reader's first list may ask them to sign in; later ones follow a sign-in or group change elsewhere.
  const listedFor = useRef('');
  const [state, setState] = useState<{ identity: string; sources: ContextSource[]; loading: boolean; error: string }>({
    identity: '',
    sources: [],
    loading: false,
    error: '',
  });
  const active = enabled && supported && !!sessionSlug;
  useEffect(() => {
    if (!active) {
      listedFor.current = '';
      setState({ identity, sources: [], loading: false, error: '' });
      return undefined;
    }
    const prompt = listedFor.current !== identity;
    listedFor.current = identity;
    let current = true;
    // Only a reload for the same identity keeps the current list while loading.
    setState((prev) =>
      prev.identity === identity
        ? { ...prev, loading: true, error: '' }
        : { identity, sources: [], loading: true, error: '' },
    );
    listContextSources({
      sessionSlug,
      sessionConfig: configRef.current,
      context: { account },
      asAdmin: isAdmin,
      prompt,
    })
      .then((sources) => current && setState({ identity, sources, loading: false, error: '' }))
      .catch((error: unknown) => {
        if (current) {
          setState({
            identity,
            sources: [],
            loading: false,
            error: error instanceof Error ? error.message : 'Context sources could not be read.',
          });
        }
      });
    return () => {
      current = false;
    };
  }, [active, identity, sessionSlug, account, isAdmin, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  // A token or a new membership can open files the last list couldn't show.
  useEffect(() => {
    if (!active || isAdmin) return undefined;
    const stopHearingToken = subscribeWorkerSessionToken(reload);
    const stopHearingGroups = subscribeWorkerGroupsChanged(reload);
    return () => {
      stopHearingToken();
      stopHearingGroups();
    };
  }, [active, isAdmin, reload]);
  // Someone signed in whose browser holds no token, as after a declined sign-in, can't yet be shown their
  // groups' files, so the page offers it.
  const [groupFilesHidden, setGroupFilesHidden] = useState(false);
  useEffect(() => {
    if (!active || isAdmin || !account) {
      setGroupFilesHidden(false);
      return undefined;
    }
    let current = true;
    void hasCachedWorkerSessionToken({ sessionSlug, sessionConfig: configRef.current, context: { account } }).then(
      (holdsToken) => current && setGroupFilesHidden(!holdsToken),
    );
    return () => {
      current = false;
    };
  }, [active, isAdmin, account, sessionSlug, revision]);
  // Only someone signed in can add, so only they make this check, and only where adding is on offer.
  const [workerAccepts, setWorkerAccepts] = useState(false);
  const mayAdd = active && offersAdding && !!account && participantsMayAddContext(sessionConfig);
  useEffect(() => {
    if (!mayAdd) return undefined;
    let current = true;
    void workerAcceptsParticipantContext({ sessionSlug, sessionConfig: configRef.current, context: { account } }).then(
      (accepts) => current && setWorkerAccepts(accepts),
    );
    return () => {
      current = false;
    };
  }, [mayAdd, sessionSlug, account]);
  // The render that changes identity runs before the effect clears the old list.
  const { identity: loadedFor, ...loaded } = state;
  const fresh = loadedFor === identity;
  const loading = fresh ? loaded.loading : active;
  return {
    sources: fresh ? loaded.sources : NO_SOURCES,
    loading,
    error: fresh ? loaded.error : '',
    supported,
    isAdmin,
    participantsCanAdd: mayAdd && workerAccepts,
    // Not offered while the list, and any sign-in it asked for, is still under way.
    groupFilesHidden: groupFilesHidden && !loading,
    reload,
  };
}

/**
 * The shared context block for an AI acting for this reader: the session's
 * notes and links plus the sources this reader may see. '' while loading or
 * when there is nothing.
 */
export function useSessionContextPrompt({ totalChars, ...input }: Input & { totalChars: number }) {
  const { sources, loading, isAdmin } = useSessionContextSources({ ...input, offersAdding: false });
  const identity = contextSourcesIdentity(input, isAdmin);
  const [prompt, setPrompt] = useState({ identity: '', text: '' });
  const configRef = useRef(input.sessionConfig);
  configRef.current = input.sessionConfig;
  const notes = JSON.stringify((input.sessionConfig as { sessionContext?: unknown } | null)?.sessionContext ?? null);
  useEffect(() => {
    let current = true;
    const options = {
      sessionSlug: input.sessionSlug,
      sessionConfig: configRef.current,
      context: { account: input.account },
      asAdmin: isAdmin,
    };
    void loadContextSourcesForAi(sources, options).then((loaded) => {
      if (!current) return;
      const text = buildSessionContextPrompt({ sessionContext: JSON.parse(notes), sources: loaded, totalChars }).text;
      setPrompt({ identity, text });
    });
    return () => {
      current = false;
    };
  }, [sources, notes, totalChars, identity, input.sessionSlug, input.account, isAdmin]);
  return { text: prompt.identity === identity ? prompt.text : '', loading, sources, isAdmin };
}
