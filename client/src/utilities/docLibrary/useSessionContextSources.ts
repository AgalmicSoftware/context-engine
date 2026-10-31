/** @file useSessionContextSources.ts: the context sources a reader may see, and their text for the AI. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { buildSessionContextPrompt } from '@ce-shared/sessionContextText.mjs';
import { isConfiguredAdmin } from '../storage/storageClient';
import { requiresLitForSessionStorage, usesCloudflareSessionStorage } from '../storage/sessionStorageConfig';
import { listContextSources, loadContextSourcesForAi, type ContextSource } from './contextSources';

/** Context sources need Worker storage the Worker can read: not Arweave, not Lit-encrypted. */
export const supportsContextSources = (sessionConfig: unknown): boolean =>
  usesCloudflareSessionStorage(sessionConfig) && !requiresLitForSessionStorage(sessionConfig);

type Input = { sessionSlug: string; sessionConfig: unknown; account?: unknown; enabled?: boolean };

export type SessionContextSourcesState = ReturnType<typeof useSessionContextSources>;

export function useSessionContextSources({ sessionSlug, sessionConfig, account = '', enabled = true }: Input) {
  const supported = supportsContextSources(sessionConfig);
  const isAdmin = isConfiguredAdmin(sessionConfig, { account });
  const configRef = useRef(sessionConfig);
  configRef.current = sessionConfig;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ sources: ContextSource[]; loading: boolean; error: string }>({
    sources: [],
    loading: false,
    error: '',
  });
  const active = enabled && supported && !!sessionSlug;
  useEffect(() => {
    if (!active) {
      setState({ sources: [], loading: false, error: '' });
      return undefined;
    }
    let current = true;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    listContextSources({ sessionSlug, sessionConfig: configRef.current, context: { account }, asAdmin: isAdmin })
      .then((sources) => current && setState({ sources, loading: false, error: '' }))
      .catch((error: unknown) => {
        if (current) {
          setState({
            sources: [],
            loading: false,
            error: error instanceof Error ? error.message : 'Context sources could not be read.',
          });
        }
      });
    return () => {
      current = false;
    };
  }, [active, sessionSlug, account, isAdmin, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, supported, isAdmin, reload };
}

/**
 * The shared context block for an AI acting for this reader: the session's
 * notes and links plus the sources this reader may see. '' while loading or
 * when there is nothing.
 */
export function useSessionContextPrompt({ totalChars, ...input }: Input & { totalChars: number }) {
  const { sources, loading, isAdmin } = useSessionContextSources(input);
  const [text, setText] = useState('');
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
      setText(buildSessionContextPrompt({ sessionContext: JSON.parse(notes), sources: loaded, totalChars }).text);
    });
    return () => {
      current = false;
    };
  }, [sources, notes, totalChars, input.sessionSlug, input.account, isAdmin]);
  return { text, loading };
}
